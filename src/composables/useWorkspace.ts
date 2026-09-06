import { ref } from 'vue'
import { useStudentData } from './useStudentData'
import { useTagData } from './useTagData'
import { useSeatChart } from './useSeatChart'
import { useExportSettings } from './useExportSettings'
import { useZoneData } from './useZoneData'
import { useSeatRules } from './useSeatRules'
import { useStudentAttributes } from './useStudentAttributes'
import { useLogger } from './useLogger'
import { setCookie, getCookie, eraseCookie } from './useAuth'
import { useUndo } from './useUndo'
import { useSelection } from './useSelection'
import { useEditMode } from './useEditMode'
import { useZoneRotation } from './useZoneRotation'
import { useEditorWorkbench } from './useEditorWorkbench'
import { initializeTags } from './useTagData'
import { parseSeatId, isGuardSeatId } from '@/utils/seatHelpers'
import { getNextColor, normalizeTagColor } from '@/constants/tagColors'
import { isTauriRuntime } from '@/platform/runtime'
import { openTextFile, saveTextFile, workspaceFileFilters, writeTextFilePath } from '@/platform/files'
import {
  cloneWorkspaceInput,
  formatWorkspaceValidationErrors,
  getWorkspaceVersionError,
  MAX_WORKSPACE_GROUPS,
  MAX_WORKSPACE_SEATS,
  validateWorkspaceDocument
} from '@/utils/workspaceValidation'
import { WORKSPACE_SCHEMA_VERSION } from '@/types/models'
import type {
  RuleSubject,
  RuleParams,
  SeatConfig,
  Workspace,
  WorkspaceIdentifier,
  WorkspaceMeta,
  WorkspaceRuleInput,
  WorkspaceRuleSubject,
  WorkspaceSeat
} from '@/types/models'
import type { AuthType } from '@/types/models'
import type { WorkspaceSaveResult } from '@/types/composables'

interface WorkspaceSeatInput extends Partial<WorkspaceSeat> {
  groupIndex?: number
  columnIndex?: number
  rowIndex?: number
  isEmpty?: boolean
}

interface MigratingWorkspace extends Omit<Partial<Workspace>, 'layout' | 'meta'> {
  meta?: Partial<WorkspaceMeta>
  version?: string
  timestamp?: string
  bindings?: unknown[]
  relations?: unknown
  seats?: WorkspaceSeatInput[]
  seatConfig?: Partial<SeatConfig>
  layout?: {
    config: Partial<SeatConfig>
    seats: WorkspaceSeatInput[]
  }
}

interface SaveWorkspaceOptions {
  saveAs?: boolean
}

interface ApplyWorkspaceOptions {
  localPath?: string | null
}

interface RemappableRuleParams extends Record<string, unknown> {
  tagId?: WorkspaceIdentifier | null
  zoneId?: WorkspaceIdentifier | null
}

interface LoadedWorkspace {
  data: Workspace
  name: string
  path: string | null
}

interface LastWorkspaceInfo {
  type: 'local' | 'cloud' | 'fuckseats' | 'sdes' | 'autosave'
  name: string
  fileId?: string
  source?: AuthType
  baseUrl?: string
  classroomId?: string | number
  classId?: string
  seatChartId?: string
  time?: string
}

const LAST_WORKSPACE_COOKIE = 'sce_last_workspace'

const FILE_EXT = '.sce'
const currentLocalWorkspacePath = ref<string | null>(null)
const isSavingWorkspace = ref(false)
let workspaceSaveQueue: Promise<void> = Promise.resolve()
let pendingWorkspaceSaveCount = 0

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const normalizeLegacyTagColors = (workspace: MigratingWorkspace) => {
  if (!Array.isArray(workspace.tags)) return
  workspace.tags.forEach((tag, index) => {
    if (!isRecord(tag) || typeof tag.color !== 'string') return
    tag.color = normalizeTagColor(tag.color, getNextColor(index))
  })
}

const getErrorMessage = (errorValue: unknown) =>
  errorValue instanceof Error ? errorValue.message : String(errorValue)

const getIdentifierKey = (value: unknown) => String(value)

const createDefaultSeatConfig = (): SeatConfig => ({
  groupCount: 4,
  columnsPerGroup: 2,
  seatsPerColumn: 7,
  groups: [
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 }
  ],
  shiftDistance: 4,
  podiumPosition: 'bottom',
  guardSeats: {
    enabled: true,
    leftEnabled: true,
    rightEnabled: true,
    includeInAutoAssignment: false,
    hideEmptyOnExport: true
  }
})

const toIndex = (value: unknown) => {
  const numberValue = Number(value)
  return Number.isInteger(numberValue) ? numberValue : undefined
}

const getSeatPosition = (seat: WorkspaceSeatInput = {}) => {
  const directPosition = {
    group: toIndex(seat.group ?? seat.groupIndex),
    col: toIndex(seat.col ?? seat.columnIndex),
    row: toIndex(seat.row ?? seat.rowIndex)
  }

  if (
    directPosition.group !== undefined &&
    directPosition.col !== undefined &&
    directPosition.row !== undefined
  ) {
    return directPosition
  }

  if (typeof seat.id === 'string' && !isGuardSeatId(seat.id)) {
    const parsed = parseSeatId(seat.id)
    const parsedPosition = {
      group: toIndex(parsed.groupIndex),
      col: toIndex(parsed.columnIndex),
      row: toIndex(parsed.rowIndex)
    }

    if (
      parsedPosition.group !== undefined &&
      parsedPosition.col !== undefined &&
      parsedPosition.row !== undefined
    ) {
      return parsedPosition
    }
  }

  return directPosition
}

const normalizeWorkspaceSeat = (seat: WorkspaceSeatInput = {}) => {
  const position = getSeatPosition(seat)
  const guardSide = seat.guardSide ||
    (seat.id === 'guard-left' ? 'left' : seat.id === 'guard-right' ? 'right' : undefined)

  return {
    id: seat.id,
    kind: seat.kind || (typeof seat.id === 'string' && isGuardSeatId(seat.id) ? 'guard' : 'regular'),
    guardSide,
    group: position.group,
    col: position.col,
    row: position.row,
    studentId: seat.studentId ?? null,
    empty: seat.empty ?? seat.isEmpty ?? false
  }
}

const getRequiredDecimalPrecision = (value: number) => {
  const [coefficient, exponentText] = value.toString().toLowerCase().split('e')
  const fractionDigits = coefficient.split('.')[1]?.length ?? 0
  const exponent = Number(exponentText ?? 0)
  return Math.max(0, fractionDigits - exponent)
}

const normalizeLegacyStudentData = (workspace: MigratingWorkspace) => {
  if (!Array.isArray(workspace.students)) return

  const attributeDefinitionsById = new Map<string, Record<string, unknown>>()
  if (Array.isArray(workspace.studentAttributeDefinitions)) {
    workspace.studentAttributeDefinitions.forEach(definition => {
      if (!isRecord(definition) || typeof definition.id !== 'string' || !definition.id) return
      attributeDefinitionsById.set(definition.id, definition)
    })
  }

  workspace.students.forEach(studentValue => {
    if (!isRecord(studentValue)) return
    const studentRecord = studentValue as Record<string, unknown>

    const studentNumber = studentRecord.studentNumber
    if (
      studentNumber === undefined ||
      (typeof studentNumber === 'string' && studentNumber.trim() === '')
    ) {
      studentRecord.studentNumber = null
    } else if (typeof studentNumber === 'string') {
      const normalizedStudentNumber = Number(studentNumber)
      if (Number.isFinite(normalizedStudentNumber)) {
        studentRecord.studentNumber = normalizedStudentNumber
      }
    }

    const numericAttributes = studentRecord.numericAttributes
    // PHP 的关联数组解码会把空对象 `{}` 重新编码成 `[]`；旧云端存档因此
    // 可能把没有数值属性的学生保存成空数组（部分旧数据也使用 null）。
    if (numericAttributes === null || (Array.isArray(numericAttributes) && numericAttributes.length === 0)) {
      studentRecord.numericAttributes = {}
      return
    }
    if (!isRecord(numericAttributes)) return
    Object.entries(numericAttributes).forEach(([attributeId, attributeValue]) => {
      let normalizedValue = attributeValue
      if (typeof attributeValue === 'string') {
        const text = attributeValue.trim()
        if (text === '') {
          normalizedValue = null
        } else {
          const numberValue = Number(text)
          if (Number.isFinite(numberValue)) normalizedValue = numberValue
        }
      }

      const definition = attributeDefinitionsById.get(attributeId)
      if (definition && typeof normalizedValue === 'number' && Number.isFinite(normalizedValue)) {
        if (typeof definition.min === 'number' && normalizedValue < definition.min) {
          definition.min = normalizedValue
        }
        if (typeof definition.max === 'number' && normalizedValue > definition.max) {
          definition.max = normalizedValue
        }

        const requiredPrecision = getRequiredDecimalPrecision(normalizedValue)
        if (
          requiredPrecision <= 10 &&
          typeof definition.precision === 'number' &&
          Number.isInteger(definition.precision) &&
          requiredPrecision > definition.precision
        ) {
          definition.precision = requiredPrecision
        }
      }

      numericAttributes[attributeId] = normalizedValue
    })
  })
}

export function useWorkspace() {
  const {
    students,
    selectedStudentId,
    addStudent,
    updateStudent,
    clearAllStudents,
    replaceStudentData,
    syncStudentIdCounter
  } = useStudentData()
  const { tags, addTag, clearAllTags, replaceTagData, showTagsInSeatChart, tagDisplayMode, setShowTagsInSeatChart, setTagDisplayMode } = useTagData()
  const { seatConfig, seats, updateConfig, clearAllSeats, batchUpdateSeats, replaceSeatChartState } = useSeatChart()
  const { exportSettings, resetExportSettings, applyExportSettings } = useExportSettings()
  const { zones, selectedZoneId, clearAllZones, replaceZoneData, addZone, updateZone, syncZoneIdCounter } = useZoneData()
  const { rules, clearAllRules, addRule } = useSeatRules()
  const {
    attributeDefinitions,
    replaceAttributeDefinitions,
    showNumericAttributesInEditor,
    setShowNumericAttributesInEditor
  } = useStudentAttributes()
  const { success, error } = useLogger()
  const { undoStack, redoStack, highlightedSeats, clearHistory } = useUndo()
  const {
    selectedSeatIds,
    isSelecting,
    isDraggingSelection,
    isSelectionMode,
    clearSelection
  } = useSelection()
  const { currentMode, firstSelectedSeat, resetEditMode } = useEditMode()
  const { resetTransientWorkbenchState } = useEditorWorkbench()
  const {
    editingZoneId,
    getRotationData,
    replaceRotationData,
    resetRotationData,
    clearEditingZone
  } = useZoneRotation()

  // 生成工作区 JSON 数据 (用于云端或本地保存)
  const getWorkspaceJson = () => {
    try {
      const workspace = {
        meta: {
          version: WORKSPACE_SCHEMA_VERSION,
          app: 'SeatingChartEditor',
          createdAt: new Date().toISOString()
        },
        students: students.value.map(s => ({
          id: s.id,
          name: s.name,
          studentNumber: s.studentNumber,
          tags: s.tags,
          numericAttributes: { ...(s.numericAttributes || {}) }
        })),
        studentAttributeDefinitions: attributeDefinitions.value.map(def => ({ ...def })),
        studentAttributeSettings: {
          showNumericAttributesInEditor: showNumericAttributesInEditor.value
        },
        tags: tags.value.map(t => ({
          id: t.id,
          name: t.name,
          color: t.color,
          showInSeatChart: t.showInSeatChart
        })),
        tagSettings: {
          showTagsInSeatChart: showTagsInSeatChart.value,
          tagDisplayMode: tagDisplayMode.value
        },
        layout: {
          config: { ...seatConfig.value },
          seats: seats.value.map(s => ({
            id: s.id,
            kind: s.kind || 'regular',
            guardSide: s.guardSide,
            group: s.groupIndex,
            col: s.columnIndex,
            row: s.rowIndex,
            studentId: s.studentId,
            empty: s.isEmpty || false
          }))
        },
        zones: zones.value.map(z => ({
          id: z.id,
          name: z.name,
          tagIds: [...z.tagIds],
          seatIds: [...z.seatIds],
          visible: z.visible
        })),
        rotationGroups: getRotationData(),
        exportSettings: { ...exportSettings.value },
        rules: (rules.value || []).map(r => ({
          id: r.id,
          version: r.version,
          enabled: r.enabled,
          priority: r.priority,
          subjects: [...(r.subjects || [])],
          // 兼容导出旧字段
          subjectMode: r.subjectMode,
          subjectsA: [...(r.subjectsA || [])],
          subjectsB: [...(r.subjectsB || [])],
          predicate: r.predicate,
          params: { ...r.params },
          description: r.description,
          createdAt: r.createdAt,
          not: r.not ?? false,
          logicOperator: r.logicOperator ?? null,
          subRules: Array.isArray(r.subRules)
            ? r.subRules.map(sr => ({
              predicate: sr.predicate,
              not: sr.not ?? false,
              subjects: [...(sr.subjects || [])],
              params: { ...(sr.params || {}) }
            }))
            : null
        }))
      }
      return JSON.stringify(workspace, null, 2)
    } catch (e) {
      console.error(e)
      return null
    }
  }

  const prepareWorkspaceData = (workspaceRaw: unknown) => {
    const cloned: unknown = cloneWorkspaceInput(workspaceRaw)
    if (!isRecord(cloned)) throw new Error('工作区根节点必须是对象')
    const sourceVersion = isRecord(cloned.meta)
      ? cloned.meta.version
      : cloned.version ?? '1.0'
    const versionError = getWorkspaceVersionError(sourceVersion)
    if (versionError) throw new Error(versionError)
    const workspace = migrateWorkspace(cloned as MigratingWorkspace)
    const validation = validateWorkspaceDocument(workspace)
    if (!validation.valid) {
      throw new Error(formatWorkspaceValidationErrors(validation.errors))
    }
    return validation.data
  }

  const captureRuntimeSnapshot = () => {
    return {
      students: cloneWorkspaceInput(students.value),
      tags: cloneWorkspaceInput(tags.value),
      seatConfig: cloneWorkspaceInput(seatConfig.value),
      seats: cloneWorkspaceInput(seats.value),
      zones: cloneWorkspaceInput(zones.value),
      rules: cloneWorkspaceInput(rules.value),
      attributeDefinitions: cloneWorkspaceInput(attributeDefinitions.value),
      showNumericAttributesInEditor: showNumericAttributesInEditor.value,
      showTagsInSeatChart: showTagsInSeatChart.value,
      tagDisplayMode: tagDisplayMode.value,
      exportSettings: cloneWorkspaceInput(exportSettings.value),
      undoStack: cloneWorkspaceInput(undoStack.value),
      redoStack: cloneWorkspaceInput(redoStack.value),
      highlightedSeatIds: [...highlightedSeats.value],
      selectedSeatIds: [...selectedSeatIds.value],
      isSelecting: isSelecting.value,
      isDraggingSelection: isDraggingSelection.value,
      isSelectionMode: isSelectionMode.value,
      selectedStudentId: selectedStudentId.value,
      selectedZoneId: selectedZoneId.value,
      currentMode: currentMode.value,
      firstSelectedSeat: firstSelectedSeat.value,
      rotGroups: getRotationData(),
      editingZoneId: editingZoneId.value
    }
  }

  const restoreRuntimeSnapshot = (snapshot: ReturnType<typeof captureRuntimeSnapshot>) => {
    replaceTagData(snapshot.tags)
    replaceStudentData(snapshot.students)
    replaceSeatChartState(snapshot.seatConfig, snapshot.seats)
    replaceZoneData(snapshot.zones)
    replaceAttributeDefinitions(snapshot.attributeDefinitions, { useDefaultsWhenEmpty: false })
    setShowNumericAttributesInEditor(snapshot.showNumericAttributesInEditor)
    setShowTagsInSeatChart(snapshot.showTagsInSeatChart)
    setTagDisplayMode(snapshot.tagDisplayMode)
    resetExportSettings()
    applyExportSettings(snapshot.exportSettings)
    rules.value = cloneWorkspaceInput(snapshot.rules)
    undoStack.value = cloneWorkspaceInput(snapshot.undoStack)
    redoStack.value = cloneWorkspaceInput(snapshot.redoStack)
    highlightedSeats.value = new Set(snapshot.highlightedSeatIds)
    selectedSeatIds.value = new Set(snapshot.selectedSeatIds)
    isSelecting.value = snapshot.isSelecting
    isDraggingSelection.value = snapshot.isDraggingSelection
    isSelectionMode.value = snapshot.isSelectionMode
    selectedStudentId.value = snapshot.selectedStudentId
    selectedZoneId.value = snapshot.selectedZoneId
    currentMode.value = snapshot.currentMode
    firstSelectedSeat.value = snapshot.firstSelectedSeat
    const rotationResult = replaceRotationData(snapshot.rotGroups)
    if (!rotationResult.success) throw new Error(rotationResult.error)
    editingZoneId.value = snapshot.editingZoneId
  }

  const restoreRotationGroups = (groups: Workspace['rotationGroups'] = []) => {
    const result = replaceRotationData(groups)
    if (!result.success) throw new Error(result.error)
    clearEditingZone()
  }

  const buildDefaultWorkspaceName = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    return `座位表_${timestamp}${FILE_EXT}`
  }

  // 保存工作区
  const performSaveWorkspace = async (options: SaveWorkspaceOptions = {}): Promise<WorkspaceSaveResult> => {
    try {
      const json = getWorkspaceJson()
      if (!json) {
        return { success: false, canceled: false, error: '生成工作区数据失败' }
      }

      if (isTauriRuntime() && currentLocalWorkspacePath.value && !options.saveAs) {
        await writeTextFilePath(currentLocalWorkspacePath.value, json)
        return { success: true, canceled: false }
      }

      const result = await saveTextFile(json, {
        title: options.saveAs ? '另存工作区' : '保存工作区',
        defaultPath: buildDefaultWorkspaceName(),
        filters: workspaceFileFilters,
        extension: FILE_EXT,
        mimeType: 'application/json;charset=utf-8'
      })

      if (result.success && result.path) {
        currentLocalWorkspacePath.value = result.path
      }

      if (result.canceled) return { success: false, canceled: true }
      if (!result.success) return { success: false, canceled: false, error: '工作区保存失败' }
      return { success: true, canceled: false }
    } catch (error) {
      return {
        success: false,
        canceled: false,
        error: getErrorMessage(error) || '工作区保存失败'
      }
    }
  }

  const saveWorkspace = (options: SaveWorkspaceOptions = {}): Promise<WorkspaceSaveResult> => {
    pendingWorkspaceSaveCount += 1
    isSavingWorkspace.value = true

    const operation = workspaceSaveQueue.then(() => performSaveWorkspace(options))
    workspaceSaveQueue = operation.then(
      () => undefined,
      () => undefined
    )

    return operation.finally(() => {
      pendingWorkspaceSaveCount = Math.max(0, pendingWorkspaceSaveCount - 1)
      isSavingWorkspace.value = pendingWorkspaceSaveCount > 0
    })
  }

  const saveWorkspaceAs = () => saveWorkspace({ saveAs: true })

  // 加载工作区
  const parseWorkspaceText = (text: string, name = '') => {
    try {
      if (name) {
        const lowerName = name.toLowerCase()
        if (!lowerName.endsWith(FILE_EXT) && !lowerName.endsWith('.bydsce.json')) {
          throw new Error(`请选择 ${FILE_EXT} 格式的工作区文件`)
        }
      }

      return prepareWorkspaceData(JSON.parse(text))
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('请选择')) {
        throw error
      }
      throw new Error(`解析工作区文件失败: ${getErrorMessage(error)}`)
    }
  }

  const loadWorkspace = async (file: File | null = null): Promise<LoadedWorkspace | null> => {
    if (!file) {
      const selected = await openTextFile({
        title: '加载工作区',
        accept: '.sce,.bydsce.json',
        filters: workspaceFileFilters
      })
      if (!selected) return null
      return {
        data: parseWorkspaceText(selected.text, selected.name),
        name: selected.name,
        path: selected.path
      }
    }

    return new Promise<LoadedWorkspace>((resolve, reject) => {
      // 支持 .sce 和旧格式 .bydsce.json
      const name = file.name.toLowerCase()
      if (!name.endsWith(FILE_EXT) && !name.endsWith('.bydsce.json')) {
        reject(new Error(`请选择 ${FILE_EXT} 格式的工作区文件`))
        return
      }

      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          if (typeof e.target?.result !== 'string') throw new Error('工作区文件内容不是文本')
          resolve({
            data: parseWorkspaceText(e.target.result, file.name),
            name: file.name,
            path: null
          })
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = () => {
        reject(new Error('读取文件失败'))
      }

      reader.readAsText(file)
    })
  }

  // 应用工作区数据 (云端或本地解析后共享的逻辑)
  const applyWorkspaceState = (workspace: Workspace) => {
        // 1. 清理所有 UI 状态
        clearHistory()
        clearSelection()
        resetEditMode()
        resetExportSettings()

        // 2. 清空现有数据
        clearAllStudents()
        clearAllTags()
        replaceAttributeDefinitions(
          workspace.studentAttributeDefinitions || [],
          { useDefaultsWhenEmpty: false }
        )
        if (workspace.studentAttributeSettings?.showNumericAttributesInEditor !== undefined) {
          setShowNumericAttributesInEditor(workspace.studentAttributeSettings.showNumericAttributesInEditor)
        }

        // 恢复标签并记录旧ID->新ID映射
        const oldTagIdToNewId = new Map<string, number>()
        workspace.tags.forEach(tag => {
          const newTagId = addTag({
            name: tag.name, 
            color: tag.color, 
            showInSeatChart: tag.showInSeatChart !== false 
          })
          oldTagIdToNewId.set(getIdentifierKey(tag.id), newTagId)
        })

        // 恢复标签显示设置
        if (workspace.tagSettings) {
          if (workspace.tagSettings.showTagsInSeatChart !== undefined) {
            setShowTagsInSeatChart(workspace.tagSettings.showTagsInSeatChart)
          }
          if (workspace.tagSettings.tagDisplayMode) {
            setTagDisplayMode(workspace.tagSettings.tagDisplayMode)
          }
        }

        // 恢复学生并记录旧ID->新ID映射
        const oldStudentIdToNewId = new Map<string, number>()
        workspace.students.forEach(s => {
          const newId = addStudent()
          const mappedTags = (s.tags || [])
            .map(tagId => oldTagIdToNewId.get(getIdentifierKey(tagId)))
            .filter((tagId): tagId is number => tagId !== undefined)
          updateStudent(newId, {
            name: s.name,
            studentNumber: s.studentNumber,
            tags: mappedTags,
            numericAttributes: { ...(s.numericAttributes || {}) }
          })
          oldStudentIdToNewId.set(getIdentifierKey(s.id), newId)
        })

        // 恢复座位配置
        if (workspace.layout && workspace.layout.config) {
          updateConfig(workspace.layout.config)
        }

        // 清空所有分配
        clearAllSeats()

        if (workspace.layout && Array.isArray(workspace.layout.seats)) {
          const updates = workspace.layout.seats.map(sw => {
            const isGuardSeat = sw.kind === 'guard' || isGuardSeatId(sw.id)
            const match = isGuardSeat
              ? seats.value.find(st => st.id === sw.id || (st.kind === 'guard' && st.guardSide === sw.guardSide))
              : seats.value.find(st => st.id === sw.id) || seats.value.find(st =>
                st.groupIndex === sw.group && st.columnIndex === sw.col && st.rowIndex === sw.row
              )
            if (!match) return null
            return {
              seatId: match.id,
              isEmpty: !!sw.empty,
              studentId: sw.studentId === null || sw.studentId === undefined
                ? null
                : (oldStudentIdToNewId.get(getIdentifierKey(sw.studentId)) ?? null)
            }
          }).filter((update): update is { seatId: string; isEmpty: boolean; studentId: number | null } => update !== null)

          if (updates.length > 0) {
            const restored = batchUpdateSeats(updates, false)  // recordUndo=false，历史数据恢复不记录
            if (!restored) throw new Error('工作区座位分配包含冲突，无法原子恢复')
          }
        }

        // 恢复导出设置
        if (workspace.exportSettings) {
          applyExportSettings(workspace.exportSettings)
        }

        restoreRotationGroups(workspace.rotationGroups)

        // 注意：旧版的 relations (人际关系) 已被废弃，我们不再从存档中恢复它们。
        // 如有需要，用户应使用最新的 SeatRules (座位规则) 机制进行配置。

        // 恢复选区数据
        const oldZoneIdToNewId = new Map<string, number>()
        if (workspace.zones && Array.isArray(workspace.zones)) {
          clearAllZones()

          workspace.zones.forEach(z => {
            const newZoneId = addZone()
            const mappedTagIds = (z.tagIds || [])
              .map(tagId => oldTagIdToNewId.get(getIdentifierKey(tagId)))
              .filter((tagId): tagId is number => tagId !== undefined)
            updateZone(newZoneId, {
              name: z.name,
              tagIds: mappedTagIds,
              seatIds: [...z.seatIds],
              visible: z.visible !== undefined ? z.visible : false
            })
            oldZoneIdToNewId.set(getIdentifierKey(z.id), newZoneId)
          })
        }

        const normalizeRule = (rule: WorkspaceRuleInput): { subjects: WorkspaceRuleSubject[] } => {
          if (Array.isArray(rule.subjects)) {
            return { subjects: (rule.subjects || []).map(item => ({ ...item })) }
          }
          if (rule.subjectMode === 'single' || rule.subjectMode === 'dual') {
            const subjectsA = (rule.subjectsA || []).map(item => ({ ...item }))
            const subjectsB = (rule.subjectsB || []).map(item => ({ ...item }))
            return {
              subjects: [...subjectsA, ...subjectsB]
            }
          }
          const subject = rule.subject || {}
          if (subject.kind === 'student') {
            return { subjects: [{ type: 'person', id: subject.id ?? null }] }
          }
          if (subject.kind === 'tag') {
            return { subjects: [{ type: 'tag', id: subject.tagId ?? null }] }
          }
          if (subject.kind === 'pair') {
            return { subjects: [{ type: 'person', id: subject.id1 ?? null }, { type: 'person', id: subject.id2 ?? null }] }
          }
          if (subject.kind === 'tag_pair') {
            return { subjects: [{ type: 'tag', id: subject.tagId1 ?? null }, { type: 'tag', id: subject.tagId2 ?? null }] }
          }
          return { subjects: [] }
        }

        const remapEntry = (
          entry: WorkspaceRuleSubject,
          oldStudentIdToNewIdMap: Map<string, number>,
          oldTagIdToNewIdMap: Map<string, number>
        ): RuleSubject | null => {
          if (!entry) return null
          if (entry.type === 'person') {
            return { ...entry, id: entry.id === null ? null : oldStudentIdToNewIdMap.get(getIdentifierKey(entry.id)) ?? null }
          }
          if (entry.type === 'tag') {
            return { ...entry, id: entry.id === null ? null : oldTagIdToNewIdMap.get(getIdentifierKey(entry.id)) ?? null }
          }
          if (entry.type === 'all') {
            return { type: 'all', id: null }
          }
          return null
        }

        // 恢复智能排位规则
        if (workspace.rules && Array.isArray(workspace.rules)) {
          clearAllRules()

          workspace.rules.forEach((r, ruleIndex) => {
            const normalized = normalizeRule(r)

            const remappedSubjects = normalized.subjects.map(entry => remapEntry(entry, oldStudentIdToNewId, oldTagIdToNewId))
            const subjects = remappedSubjects.filter((entry): entry is RuleSubject =>
              entry !== null && (entry.type === 'all' || entry.id !== null)
            )
            const dropped = remappedSubjects.length - subjects.length
            if (dropped > 0) {
              throw new Error(`rules[${ruleIndex}] 包含无法恢复的规则对象`)
            }

            const remapParams = (params: RemappableRuleParams = {}): RuleParams => {
              const { tagId, zoneId, ...otherParams } = params
              const newParams: RuleParams = { ...otherParams }
              if (tagId !== null && tagId !== undefined) {
                newParams.tagId = oldTagIdToNewId.get(getIdentifierKey(tagId))
              }
              if (zoneId !== null && zoneId !== undefined) {
                newParams.zoneId = oldZoneIdToNewId.get(getIdentifierKey(zoneId))
              }
              return newParams
            }

            const hasValidSubjects = subjects.length > 0
            if (hasValidSubjects) {
              const subRules = Array.isArray(r.subRules)
                ? r.subRules
                  .filter((subRule): subRule is typeof subRule & { predicate: string } => typeof subRule.predicate === 'string')
                  .map((sr, subRuleIndex) => {
                    const sourceSubjects = Array.isArray(sr.subjects) && sr.subjects.length > 0
                      ? sr.subjects
                      : normalized.subjects
                    const remappedSubRuleSubjects = sourceSubjects
                      .map(entry => remapEntry(entry, oldStudentIdToNewId, oldTagIdToNewId))
                      .filter((entry): entry is RuleSubject => entry !== null && (entry.type === 'all' || entry.id !== null))
                    if (remappedSubRuleSubjects.length !== sourceSubjects.length) {
                      throw new Error(`rules[${ruleIndex}].subRules[${subRuleIndex}] 包含无法恢复的规则对象`)
                    }
                    return {
                      predicate: sr.predicate,
                      not: sr.not ?? false,
                      subjects: remappedSubRuleSubjects,
                      params: remapParams(sr.params)
                    }
                  })
                : null
              const result = addRule({
                enabled: r.enabled ?? true,
                priority: r.priority,
                subjects,
                predicate: r.predicate,
                params: remapParams(r.params),
                description: r.description || '',
                not: r.not ?? false,
                logicOperator: r.logicOperator ?? null,
                subRules
              })
              if (!result?.success) {
                throw new Error(`rules[${ruleIndex}] 无法恢复: ${(result?.warnings || []).join('；')}`)
              }
            } else {
              throw new Error(`rules[${ruleIndex}] 没有可恢复的规则对象`)
            }
          })
        }

        // 3. 同步所有 ID 计数器（必须在数据恢复完成后执行）
        syncStudentIdCounter()
        syncZoneIdCounter()
        return true
  }

  const applyWorkspaceData = async (workspaceRaw: unknown, options: ApplyWorkspaceOptions = {}) => {
    let workspace: Workspace
    try {
      workspace = prepareWorkspaceData(workspaceRaw)
    } catch (err) {
      console.error('Workspace validation failed:', err)
      error('工作区文件内容不完整或格式不正确: ' + getErrorMessage(err))
      return false
    }

    let runtimeSnapshot: ReturnType<typeof captureRuntimeSnapshot>
    try {
      runtimeSnapshot = captureRuntimeSnapshot()
    } catch (err) {
      console.error('Workspace snapshot failed:', err)
      error('加载前无法创建安全回滚快照，已取消加载: ' + getErrorMessage(err))
      return false
    }

    try {
      applyWorkspaceState(workspace)
      currentLocalWorkspacePath.value = options.localPath ?? null
      resetTransientWorkbenchState()
      return true
    } catch (err) {
      console.error('Apply Workspace Data failed:', err)
      try {
        restoreRuntimeSnapshot(runtimeSnapshot)
        error('恢复工作区时发生错误，已保留原工作区: ' + getErrorMessage(err))
      } catch (rollbackError) {
        console.error('Workspace rollback failed:', rollbackError)
        error('恢复工作区失败，且无法自动回滚: ' + getErrorMessage(rollbackError))
      }
      return false
    }
  }

  const createNewWorkspace = () => {
    try {
      clearHistory()
      clearSelection()
      resetEditMode()
      resetExportSettings()

      clearAllStudents()
      clearAllTags()
      initializeTags()
      replaceAttributeDefinitions()
      setShowNumericAttributesInEditor(true)
      setShowTagsInSeatChart(true)
      setTagDisplayMode('dot')

      clearAllZones()
      clearAllRules()
      resetRotationData()
      updateConfig(createDefaultSeatConfig())
      clearAllSeats()

      currentLocalWorkspacePath.value = null
      eraseCookie(LAST_WORKSPACE_COOKIE)
      resetTransientWorkbenchState()
      success('已新建空白工作区')
      return true
    } catch (err) {
      console.error('Create new workspace failed:', err)
      error('新建工作区失败: ' + getErrorMessage(err))
      return false
    }
  }

  // 版本迁移
  function migrateWorkspace(ws: MigratingWorkspace): MigratingWorkspace {
    const version = String(ws.meta?.version || ws.version || '1.0')

    // v1.0 → v1.1：bindings → relations (忽略)
    if (version === '1.0') {
      if (ws.bindings && Array.isArray(ws.bindings)) {
        delete ws.bindings
      }
    }

    // 旧版扁平结构 → layout 结构。部分近期云端存档版本号不可靠，因此按数据形状迁移。
    if (!ws.layout && (ws.seats || ws.seatConfig)) {
      const oldSeats = Array.isArray(ws.seats) ? ws.seats : []
      if (oldSeats.length > MAX_WORKSPACE_SEATS + 2) {
        throw new Error(`工作区座位数不能超过 ${MAX_WORKSPACE_SEATS + 2}`)
      }
      ws.layout = {
        config: ws.seatConfig || {},
        seats: oldSeats.map(normalizeWorkspaceSeat)
      }
      delete ws.seatConfig
      delete ws.seats
    } else if (ws.layout) {
      if (!ws.layout.config && ws.seatConfig) {
        ws.layout.config = ws.seatConfig
      }
      if (Array.isArray(ws.layout.seats)) {
        if (ws.layout.seats.length > MAX_WORKSPACE_SEATS + 2) {
          throw new Error(`工作区座位数不能超过 ${MAX_WORKSPACE_SEATS + 2}`)
        }
        ws.layout.seats = ws.layout.seats.map(normalizeWorkspaceSeat)
      }
    }

    // v1.x → v2.0：丢弃旧关系并补齐 meta
    if (version.startsWith('1.')) {
      // 丢弃旧的 relations
      if (ws.relations) {
        delete ws.relations
      }

      // 添加 meta
      ws.meta = {
        version: WORKSPACE_SCHEMA_VERSION,
        app: 'SeatingChartEditor',
        createdAt: ws.timestamp || new Date().toISOString()
      }
      delete ws.version
      delete ws.timestamp
    }

    // 旧版或缺少可靠版本号的存档：添加 groups 数组支持每大组独立配置
    if (ws.layout?.config && !ws.layout.config.groups) {
      const config = ws.layout.config
      const groupCount = config.groupCount || 4
      if (!Number.isInteger(groupCount) || groupCount <= 0 || groupCount > MAX_WORKSPACE_GROUPS) {
        throw new Error(`工作区大组数必须在 1 到 ${MAX_WORKSPACE_GROUPS} 之间`)
      }
      config.groups = []
      for (let i = 0; i < groupCount; i++) {
        config.groups.push({
          columns: config.columnsPerGroup || 2,
          rows: config.seatsPerColumn || 7
        })
      }
    }

    // v2.x → 当前：编辑器方向统一为 podiumPosition
    if (ws.layout?.config) {
      const config = ws.layout.config
      if (!config.groupCount && Array.isArray(config.groups)) config.groupCount = config.groups.length
      if (!config.columnsPerGroup) config.columnsPerGroup = 2
      if (!config.seatsPerColumn) config.seatsPerColumn = 7
      if (!config.podiumPosition && config.seatAlignment) {
        config.podiumPosition = config.seatAlignment
      }
      if (!config.podiumPosition && config.alignment) {
        config.podiumPosition = config.alignment
      }
      delete config.alignment
      delete config.seatAlignment
    }

    // 确保默认值
    if (ws.layout?.config) {
      if (!ws.layout.config.podiumPosition) ws.layout.config.podiumPosition = 'bottom'
      ws.layout.config.guardSeats = {
        enabled: ws.layout.config.guardSeats?.enabled !== false,
        leftEnabled: ws.layout.config.guardSeats?.leftEnabled !== false,
        rightEnabled: ws.layout.config.guardSeats?.rightEnabled !== false,
        includeInAutoAssignment: ws.layout.config.guardSeats?.includeInAutoAssignment === true,
        hideEmptyOnExport: ws.layout.config.guardSeats?.hideEmptyOnExport !== false
      }
    }

    // 分支前允许保存定义范围外的有限数值；迁移时扩展定义，避免重载时截断旧数据。
    normalizeLegacyStudentData(ws)
    normalizeLegacyTagColors(ws)

    // 确保默认值
    ws.meta = {
      ...(ws.meta || {}),
      version: WORKSPACE_SCHEMA_VERSION,
      app: ws.meta?.app || 'SeatingChartEditor',
      createdAt: ws.meta?.createdAt || new Date().toISOString()
    }
    ws.studentAttributeDefinitions = ws.studentAttributeDefinitions || []
    ws.studentAttributeSettings = {
      showNumericAttributesInEditor: ws.studentAttributeSettings?.showNumericAttributesInEditor !== false
    }
    ws.tagSettings = {
      showTagsInSeatChart: ws.tagSettings?.showTagsInSeatChart !== false,
      tagDisplayMode: ws.tagSettings?.tagDisplayMode || 'dot'
    }
    ws.zones = ws.zones || []
    ws.rotationGroups = ws.rotationGroups || []
    ws.rules = ws.rules || []
    ws.exportSettings = ws.exportSettings || {}

    return ws
  }

  const saveLastWorkspace = (info: LastWorkspaceInfo) => {
    try {
      if (!info) return
      setCookie(LAST_WORKSPACE_COOKIE, JSON.stringify(info), 30) // 30 days
    } catch (e) {
      console.error('Save last workspace failed:', e)
    }
  }

  const getLastWorkspace = (): LastWorkspaceInfo | null => {
    try {
      const saved = getCookie(LAST_WORKSPACE_COOKIE)
      if (!saved) return null
      const parsed: unknown = JSON.parse(saved)
      if (!parsed || typeof parsed !== 'object') return null
      const value = parsed as Record<string, unknown>
      if (typeof value.type !== 'string' || typeof value.name !== 'string') return null
      if (!['local', 'cloud', 'fuckseats', 'sdes', 'autosave'].includes(value.type)) return null
      return value as unknown as LastWorkspaceInfo
    } catch (e) {
      return null
    }
  }

  const clearLastWorkspace = () => {
    try {
      eraseCookie(LAST_WORKSPACE_COOKIE)
    } catch (e) {
      console.error('Clear last workspace failed:', e)
    }
  }

  return {
    saveLastWorkspace,
    getLastWorkspace,
    clearLastWorkspace,
    isSavingWorkspace,
    saveWorkspace,
    saveWorkspaceAs,
    loadWorkspace,
    getWorkspaceJson,
    prepareWorkspaceData,
    createNewWorkspace,
    applyWorkspaceData
  }
}
