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
import { initializeTags } from './useTagData'
import { parseSeatId, isGuardSeatId } from '@/utils/seatHelpers'
import { isTauriRuntime } from '@/platform/runtime'
import { openTextFile, saveTextFile, workspaceFileFilters, writeTextFilePath } from '@/platform/files'
import {
  cloneWorkspaceInput,
  formatWorkspaceValidationErrors,
  MAX_WORKSPACE_GROUPS,
  MAX_WORKSPACE_SEATS,
  validateWorkspaceDocument
} from '@/utils/workspaceValidation'
import type {
  RuleInput,
  RuleSubject,
  SeatConfig,
  Workspace,
  WorkspaceMeta,
  WorkspaceSeat
} from '@/types/models'
import type { AuthType } from '@/types/models'

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
  tagId?: number
  zoneId?: number
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
const CURRENT_VERSION = '2.2'
const currentLocalWorkspacePath = ref<string | null>(null)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getErrorMessage = (errorValue: unknown) =>
  errorValue instanceof Error ? errorValue.message : String(errorValue)

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

export function useWorkspace() {
  const {
    students,
    selectedStudentId,
    addStudent,
    updateStudent,
    clearAllStudents,
    syncStudentIdCounter
  } = useStudentData()
  const { tags, addTag, clearAllTags, showTagsInSeatChart, tagDisplayMode, setShowTagsInSeatChart, setTagDisplayMode } = useTagData()
  const { seatConfig, seats, updateConfig, clearAllSeats, batchUpdateSeats } = useSeatChart()
  const { exportSettings, resetExportSettings, applyExportSettings } = useExportSettings()
  const { zones, selectedZoneId, clearAllZones, addZone, updateZone, syncZoneIdCounter } = useZoneData()
  const { rules, clearAllRules, addRule } = useSeatRules()
  const {
    attributeDefinitions,
    replaceAttributeDefinitions,
    showNumericAttributesInEditor,
    setShowNumericAttributesInEditor
  } = useStudentAttributes()
  const { success, warning, error } = useLogger()
  const { undoStack, redoStack, highlightedSeats, clearHistory } = useUndo()
  const {
    selectedSeatIds,
    isSelecting,
    isDraggingSelection,
    isSelectionMode,
    clearSelection
  } = useSelection()
  const { currentMode, firstSelectedSeat, resetEditMode } = useEditMode()
  const {
    rotGroups,
    editingZoneId,
    clearAllRotData,
    syncZoneRotationIdCounter
  } = useZoneRotation()

  // 生成工作区 JSON 数据 (用于云端或本地保存)
  const getWorkspaceJson = () => {
    try {
      const workspace = {
        meta: {
          version: CURRENT_VERSION,
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
    const workspace = migrateWorkspace(cloned as MigratingWorkspace)
    const validation = validateWorkspaceDocument(workspace)
    if (!validation.valid) {
      throw new Error(formatWorkspaceValidationErrors(validation.errors))
    }
    return validation.data
  }

  const captureRuntimeSnapshot = () => {
    const workspaceJson = getWorkspaceJson()
    if (!workspaceJson) {
      throw new Error('无法创建当前工作区回滚快照')
    }

    return {
      workspace: JSON.parse(workspaceJson),
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
      rotGroups: cloneWorkspaceInput(rotGroups.value),
      editingZoneId: editingZoneId.value
    }
  }

  const restoreRuntimeSnapshot = (snapshot: ReturnType<typeof captureRuntimeSnapshot>) => {
    applyWorkspaceState(prepareWorkspaceData(snapshot.workspace))
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
    rotGroups.value = cloneWorkspaceInput(snapshot.rotGroups)
    editingZoneId.value = snapshot.editingZoneId
    syncZoneRotationIdCounter()
  }

  const buildDefaultWorkspaceName = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    return `座位表_${timestamp}${FILE_EXT}`
  }

  // 保存工作区
  const saveWorkspace = async (options: SaveWorkspaceOptions = {}) => {
    try {
      const json = getWorkspaceJson()
      if (!json) return false

      if (isTauriRuntime() && currentLocalWorkspacePath.value && !options.saveAs) {
        await writeTextFilePath(currentLocalWorkspacePath.value, json)
        return true
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

      return result.success
    } catch (error) {
      return false
    }
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
        const oldTagIdToNewId = new Map<number, number>()
        workspace.tags.forEach(tag => {
          addTag({ 
            name: tag.name, 
            color: tag.color, 
            showInSeatChart: tag.showInSeatChart !== false 
          })
          const added = tags.value.find(t => t.name === tag.name && t.color === tag.color)
          if (added) oldTagIdToNewId.set(tag.id, added.id)
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
        const oldStudentIdToNewId = new Map<number, number>()
        workspace.students.forEach(s => {
          const newId = addStudent()
          const mappedTags = (s.tags || [])
            .map(tagId => oldTagIdToNewId.get(tagId))
            .filter((tagId): tagId is number => tagId !== undefined)
          updateStudent(newId, {
            name: s.name,
            studentNumber: s.studentNumber,
            tags: mappedTags,
            numericAttributes: { ...(s.numericAttributes || {}) }
          })
          oldStudentIdToNewId.set(s.id, newId)
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
              studentId: typeof sw.studentId === 'number' ? (oldStudentIdToNewId.get(sw.studentId) ?? null) : null
            }
          }).filter((update): update is { seatId: string; isEmpty: boolean; studentId: number | null } => update !== null)

          if (updates.length > 0) {
            batchUpdateSeats(updates, false)  // recordUndo=false，历史数据恢复不记录
          }
        }

        // 恢复导出设置
        if (workspace.exportSettings) {
          applyExportSettings(workspace.exportSettings)
        }

        // 注意：旧版的 relations (人际关系) 已被废弃，我们不再从存档中恢复它们。
        // 如有需要，用户应使用最新的 SeatRules (座位规则) 机制进行配置。

        // 恢复选区数据
        const oldZoneIdToNewId = new Map<number, number>()
        if (workspace.zones && Array.isArray(workspace.zones)) {
          clearAllZones()

          workspace.zones.forEach(z => {
            const newZoneId = addZone()
            const mappedTagIds = (z.tagIds || [])
              .map(tagId => oldTagIdToNewId.get(tagId))
              .filter((tagId): tagId is number => tagId !== undefined)
            updateZone(newZoneId, {
              name: z.name,
              tagIds: mappedTagIds,
              seatIds: [...z.seatIds],
              visible: z.visible !== undefined ? z.visible : false
            })
            oldZoneIdToNewId.set(z.id, newZoneId)
          })
        }

        const normalizeRule = (rule: RuleInput): { subjects: RuleSubject[] } => {
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
          entry: RuleSubject,
          oldStudentIdToNewIdMap: Map<number, number>,
          oldTagIdToNewIdMap: Map<number, number>
        ): RuleSubject | null => {
          if (!entry) return null
          if (entry.type === 'person') {
            return { ...entry, id: entry.id === null ? null : oldStudentIdToNewIdMap.get(entry.id) ?? null }
          }
          if (entry.type === 'tag') {
            return { ...entry, id: entry.id === null ? null : oldTagIdToNewIdMap.get(entry.id) ?? null }
          }
          if (entry.type === 'all') {
            return { type: 'all', id: null }
          }
          return entry
        }

        // 恢复智能排位规则
        if (workspace.rules && Array.isArray(workspace.rules)) {
          clearAllRules()
          let totalDroppedSubjects = 0
          let totalDroppedRules = 0

          workspace.rules.forEach(r => {
            const normalized = normalizeRule(r)

            const remappedSubjects = normalized.subjects.map(entry => remapEntry(entry, oldStudentIdToNewId, oldTagIdToNewId))
            const subjects = remappedSubjects.filter((entry): entry is RuleSubject =>
              entry !== null && (entry.type === 'all' || entry.id !== null)
            )
            const dropped = remappedSubjects.length - subjects.length
            if (dropped > 0) {
              totalDroppedSubjects += dropped
              warning('Workspace rule subject remap dropped entries', {
                rule: r,
                dropped
              })
            }

            const remapParams = (params: RemappableRuleParams = {}) => {
              const newParams: RemappableRuleParams = { ...params }
              if (newParams.tagId) newParams.tagId = oldTagIdToNewId.get(newParams.tagId)
              if (newParams.zoneId) newParams.zoneId = oldZoneIdToNewId.get(newParams.zoneId)
              return newParams
            }

            const hasValidSubjects = subjects.length > 0
            if (hasValidSubjects) {
              const subRules = Array.isArray(r.subRules)
                ? r.subRules
                  .filter((subRule): subRule is typeof subRule & { predicate: string } => typeof subRule.predicate === 'string')
                  .map(sr => ({
                  predicate: sr.predicate,
                  not: sr.not ?? false,
                  subjects,
                  params: remapParams(sr.params)
                }))
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
                totalDroppedRules += 1
                warning('Workspace rule skipped due to validation failure', {
                  rule: r,
                  warnings: result?.warnings || []
                })
              }
            } else {
              totalDroppedRules += 1
            }
          })

          if (totalDroppedSubjects > 0 || totalDroppedRules > 0) {
            warning(
              `工作区规则迁移时丢失了 ${totalDroppedSubjects} 个对象条目，跳过了 ${totalDroppedRules} 条无效规则，请检查规则配置。`
            )
          }
        }

        // 3. 同步所有 ID 计数器（必须在数据恢复完成后执行）
        syncStudentIdCounter()
        syncZoneIdCounter()
        syncZoneRotationIdCounter()

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
      clearAllRotData()
      updateConfig(createDefaultSeatConfig())
      clearAllSeats()

      currentLocalWorkspacePath.value = null
      eraseCookie(LAST_WORKSPACE_COOKIE)
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
        version: CURRENT_VERSION,
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

    // 确保默认值
    ws.meta = {
      ...(ws.meta || {}),
      version: CURRENT_VERSION,
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
    saveWorkspace,
    saveWorkspaceAs,
    loadWorkspace,
    getWorkspaceJson,
    prepareWorkspaceData,
    createNewWorkspace,
    applyWorkspaceData
  }
}
