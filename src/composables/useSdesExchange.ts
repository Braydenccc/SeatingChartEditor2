import { useExportSettings } from './useExportSettings'
import { useSeatChart } from './useSeatChart'
import { useSeatRules } from './useSeatRules'
import { useStudentAttributes } from './useStudentAttributes'
import { useStudentData } from './useStudentData'
import { useTagData } from './useTagData'
import { useWorkspace } from './useWorkspace'
import { useZoneData } from './useZoneData'
import { appBuildInfo } from '@/constants/appBuildInfo'
import { saveTextFile, sdesFileFilters } from '@/platform/files'
import { generateGuardSeatId, generateSeatId, isGuardSeatId } from '@/utils/seatHelpers'
import { convertGridToGroupedColumns, type GridToGroupedCell } from '@/utils/gridToGroupedColumns'
import type { NumericAttributeDefinition, Seat, Tag } from '@/types'

export const SDES_FORMAT = 'student-data-exchange-schema'
export const SDES_VERSION = 1
export const BSCE_EXTENSION_KEY = 'app.bsce'

type SdesLayoutModel = 'grid' | 'groupedColumns'
type SdesSeatKind = 'seat' | 'guard' | 'platform' | 'door' | 'aisle' | 'empty'
type PodiumPosition = 'top' | 'bottom'
type GuardSide = 'left' | 'right'

interface SdesManifest {
  producer?: string
  producerVersion?: string
  exportedAt?: string
  locale?: string
}

interface SdesName {
  display?: string
  family?: string
  given?: string
  nickname?: string
}

interface SdesStudent {
  id?: string
  number?: string
  gender?: string
  name?: SdesName
  tags?: string[]
  attributes?: Record<string, unknown>
}

interface SdesTag {
  id?: string
  name?: string
  color?: string
}

interface SdesAttributeDefinition {
  id?: string
  name?: string
  type?: 'string' | 'number' | 'boolean' | 'color'
  unit?: string
}

interface SdesGroupedColumnGroup {
  id?: string
  columns?: number
  rows?: number
}

interface SdesSeat {
  id?: string
  kind?: SdesSeatKind
  x?: number
  y?: number
  group?: number | string
  column?: number
  row?: number
  capacity?: number
  guardPos?: {
    side?: GuardSide
    index?: number
  }
}

interface SdesAssignment {
  seatId?: string
  studentId?: string
}

interface SdesCoordinateSystem {
  origin?: 'front-left' | 'front-right' | 'back-left' | 'back-right'
  xDirection?: 'left-to-right' | 'right-to-left'
  yDirection?: 'front-to-back' | 'back-to-front'
}

interface SdesSeatChart {
  id?: string
  name?: string
  layoutModel?: SdesLayoutModel
  platformPosition?: PodiumPosition
  doorPosition?: 'left' | 'right'
  coordinateSystem?: SdesCoordinateSystem
  grid?: {
    rows?: number
    columns?: number
  }
  groupedColumns?: {
    groups?: SdesGroupedColumnGroup[]
  }
  seats?: SdesSeat[]
  assignments?: SdesAssignment[]
}

interface SdesClass {
  id?: string
  metadata?: {
    name?: string
    description?: string
    class?: number
    grade?: number
  }
  floor?: number
  building?: string
  room?: string
  students?: SdesStudent[]
  tags?: SdesTag[]
  attributeDefinitions?: SdesAttributeDefinition[]
  seatCharts?: SdesSeatChart[]
}

export interface SdesDocument {
  format: string
  version: number
  manifest?: SdesManifest
  classes: SdesClass[]
  extensions?: Record<string, unknown>
}

export interface SdesImportTarget {
  id: string
  classIndex: number
  seatChartIndex: number
  classId: string
  className: string
  chartId: string
  chartName: string
  layoutModel: SdesLayoutModel
  studentCount: number
  seatCount: number
  assignmentCount: number
  warnings: string[]
}

export interface SdesIssue {
  code: string
  message: string
}

export interface SdesConversionReport {
  warnings: SdesIssue[]
  skippedStudents: number
  skippedTags: number
  skippedAttributes: number
  skippedAssignments: number
  skippedSeats: number
  unsupportedGuards: number
  gridMarkers: number
  gridCollapsedColumns: number
  gridInferredGroups: number
  gridExplicitGroups: number
  gridFilledEmptyCells: number
  lostLeadingZeroNumbers: number
}

export interface SdesWorkspaceResult {
  workspace: Record<string, unknown>
  report: SdesConversionReport
}

interface WorkspaceSeat {
  id: string
  kind: 'regular' | 'guard'
  guardSide?: GuardSide
  group: number
  col: number
  row: number
  studentId: number | null
  empty: boolean
}

const createReport = (): SdesConversionReport => ({
  warnings: [],
  skippedStudents: 0,
  skippedTags: 0,
  skippedAttributes: 0,
  skippedAssignments: 0,
  skippedSeats: 0,
  unsupportedGuards: 0,
  gridMarkers: 0,
  gridCollapsedColumns: 0,
  gridInferredGroups: 0,
  gridExplicitGroups: 0,
  gridFilledEmptyCells: 0,
  lostLeadingZeroNumbers: 0
})

const warn = (report: SdesConversionReport, code: string, message: string) => {
  report.warnings.push({ code, message })
}

const isObject = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : []

const toStringValue = (value: unknown): string => String(value ?? '').trim()

const toPositiveInt = (value: unknown): number | null => {
  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null
}

const toNonNegativeInt = (value: unknown): number | null => {
  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : null
}

const normalizePodiumPosition = (value: unknown): PodiumPosition => (
  value === 'top' ? 'top' : 'bottom'
)

const normalizeColor = (value: unknown, fallback = '#4CAF50'): string => {
  const raw = toStringValue(value)
  return /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(raw) ? raw : fallback
}

const normalizeStudentNumber = (
  value: unknown,
  report: SdesConversionReport,
  studentLabel: string
): number | null => {
  const text = toStringValue(value)
  if (!text) return null
  if (/^0\d+$/.test(text)) {
    report.lostLeadingZeroNumbers += 1
    warn(report, 'student-number-leading-zero', `${studentLabel} 的学号 "${text}" 导入为数字后会丢失前导零。`)
  }
  const parsed = Number(text)
  if (!Number.isFinite(parsed)) {
    warn(report, 'student-number-nonnumeric', `${studentLabel} 的学号 "${text}" 不是当前应用支持的数字学号，已留空。`)
    return null
  }
  return parsed
}

const parseNumberAttribute = (
  value: unknown,
  report: SdesConversionReport,
  label: string
): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    warn(report, 'attribute-value-nonnumeric', `${label} 不是有效数字，已跳过。`)
    return null
  }
  return parsed
}

const getClassName = (clazz: SdesClass, classIndex: number): string => (
  toStringValue(clazz.metadata?.name) || toStringValue(clazz.id) || `班级 ${classIndex + 1}`
)

const getChartName = (chart: SdesSeatChart, chartIndex: number): string => (
  toStringValue(chart.name) || toStringValue(chart.id) || `座位表 ${chartIndex + 1}`
)

const getCoordinateX = (
  x: number,
  columns: number,
  coordinateSystem?: SdesCoordinateSystem
) => {
  const fromRight = coordinateSystem?.xDirection === 'right-to-left' ||
    (!coordinateSystem?.xDirection && coordinateSystem?.origin?.endsWith('right'))
  return fromRight ? columns - 1 - x : x
}

const getInternalRowIndex = (
  y: number,
  rows: number,
  podiumPosition: PodiumPosition,
  coordinateSystem?: SdesCoordinateSystem
) => {
  const yDirection = coordinateSystem?.yDirection ||
    (coordinateSystem?.origin?.startsWith('back') ? 'back-to-front' : 'front-to-back')
  const frontIndex = yDirection === 'back-to-front' ? rows - 1 - y : y
  return podiumPosition === 'top' ? frontIndex : rows - 1 - frontIndex
}

const getSdesRowFromInternal = (
  rowIndex: number,
  rows: number,
  podiumPosition: PodiumPosition
) => {
  if (podiumPosition === 'top') return rowIndex
  return rowIndex
}

const getCoordinateSystemForPodium = (podiumPosition: PodiumPosition): SdesCoordinateSystem => (
  podiumPosition === 'top'
    ? {
        origin: 'front-left',
        xDirection: 'left-to-right',
        yDirection: 'front-to-back'
      }
    : {
        origin: 'back-left',
        xDirection: 'left-to-right',
        yDirection: 'back-to-front'
      }
)

export const parseSdesText = (text: string): SdesDocument => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`SDES 文件不是有效 JSON：${(error as Error).message}`)
  }

  if (!isObject(parsed)) {
    throw new Error('SDES 文件根节点必须是 JSON Object')
  }
  if (parsed.format !== SDES_FORMAT) {
    throw new Error('文件格式标识不匹配，无法作为 SDES 导入')
  }
  if (parsed.version !== SDES_VERSION) {
    throw new Error(`当前仅支持 SDES v${SDES_VERSION}`)
  }
  if (!Array.isArray(parsed.classes) || parsed.classes.length === 0) {
    throw new Error('SDES 文件缺少 classes[]')
  }

  return parsed as unknown as SdesDocument
}

export const getSdesImportTargets = (document: SdesDocument): SdesImportTarget[] => {
  const targets: SdesImportTarget[] = []

  document.classes.forEach((clazz, classIndex) => {
    asArray<SdesSeatChart>(clazz.seatCharts).forEach((chart, seatChartIndex) => {
      if (chart.layoutModel !== 'grid' && chart.layoutModel !== 'groupedColumns') return

      const warnings: string[] = []
      const unsupportedAttributeCount = asArray<SdesAttributeDefinition>(clazz.attributeDefinitions)
        .filter(def => def.type && def.type !== 'number')
        .length
      const unsupportedGuardCount = asArray<SdesSeat>(chart.seats)
        .filter(seat => seat.kind === 'guard' && (seat.guardPos?.index !== 0 || !['left', 'right'].includes(String(seat.guardPos?.side))))
        .length
      if (unsupportedAttributeCount > 0) {
        warnings.push(`${unsupportedAttributeCount} 个非数值属性将跳过`)
      }
      if (unsupportedGuardCount > 0) {
        warnings.push(`${unsupportedGuardCount} 个额外护法位将跳过`)
      }
      if (chart.layoutModel === 'grid') {
        warnings.push('grid 座位表会按显式分组或走廊列转换为大组列行')
      }

      targets.push({
        id: `${classIndex}:${seatChartIndex}`,
        classIndex,
        seatChartIndex,
        classId: toStringValue(clazz.id) || `class:${classIndex}`,
        className: getClassName(clazz, classIndex),
        chartId: toStringValue(chart.id) || `chart:${seatChartIndex}`,
        chartName: getChartName(chart, seatChartIndex),
        layoutModel: chart.layoutModel,
        studentCount: asArray<SdesStudent>(clazz.students).length,
        seatCount: asArray<SdesSeat>(chart.seats).length,
        assignmentCount: asArray<SdesAssignment>(chart.assignments).length,
        warnings
      })
    })
  })

  return targets
}

const buildStudents = (
  clazz: SdesClass,
  report: SdesConversionReport
) => {
  const students: Array<{
    id: number
    name: string
    studentNumber: number | null
    tags: number[]
    numericAttributes: Record<string, number | null>
  }> = []
  const tagIdMap = new Map<string, number>()
  const studentIdMap = new Map<string, number>()
  const attributeIdSet = new Set<string>()
  let nextTagId = 1
  let nextStudentId = 1

  const tags = asArray<SdesTag>(clazz.tags).map(tag => {
    const sourceId = toStringValue(tag.id)
    const name = toStringValue(tag.name)
    if (!sourceId || !name || tagIdMap.has(sourceId)) {
      report.skippedTags += 1
      warn(report, 'tag-invalid', `标签 "${sourceId || name || '未命名'}" 缺少 ID、名称或重复，已跳过。`)
      return null
    }
    const id = nextTagId++
    tagIdMap.set(sourceId, id)
    return {
      id,
      name,
      color: normalizeColor(tag.color),
      showInSeatChart: true
    }
  }).filter((tag): tag is Tag => !!tag)

  const studentAttributeDefinitions: NumericAttributeDefinition[] = []
  asArray<SdesAttributeDefinition>(clazz.attributeDefinitions).forEach(def => {
    const id = toStringValue(def.id)
    const name = toStringValue(def.name)
    if (!id || !name) {
      report.skippedAttributes += 1
      warn(report, 'attribute-invalid', `属性 "${id || name || '未命名'}" 缺少 ID 或名称，已跳过。`)
      return
    }
    if (def.type !== 'number') {
      report.skippedAttributes += 1
      warn(report, 'attribute-unsupported', `属性 "${name}" 的类型 ${def.type || 'unknown'} 当前不支持，已跳过。`)
      return
    }
    attributeIdSet.add(id)
    studentAttributeDefinitions.push({
      id,
      name,
      unit: toStringValue(def.unit),
      min: null,
      max: null,
      precision: 1,
      enabled: true,
      showInEditor: true,
      createdFrom: 'manual'
    })
  })

  asArray<SdesStudent>(clazz.students).forEach(student => {
    const sourceId = toStringValue(student.id)
    const name = toStringValue(student.name?.display)
    if (!sourceId || !name || studentIdMap.has(sourceId)) {
      report.skippedStudents += 1
      warn(report, 'student-invalid', `学生 "${sourceId || name || '未命名'}" 缺少 ID、姓名或重复，已跳过。`)
      return
    }

    const id = nextStudentId++
    studentIdMap.set(sourceId, id)
    const tagIds = asArray<string>(student.tags)
      .map(tagId => {
        const mapped = tagIdMap.get(tagId)
        if (!mapped) {
          warn(report, 'student-tag-missing', `${name} 引用了不存在的标签 ${tagId}，已跳过该标签。`)
        }
        return mapped
      })
      .filter((tagId): tagId is number => Number.isInteger(tagId))
    const numericAttributes: Record<string, number | null> = {}

    Object.entries(student.attributes || {}).forEach(([attributeId, value]) => {
      if (!attributeIdSet.has(attributeId)) return
      numericAttributes[attributeId] = parseNumberAttribute(value, report, `${name} 的属性 ${attributeId}`)
    })

    students.push({
      id,
      name,
      studentNumber: normalizeStudentNumber(student.number, report, name),
      tags: [...new Set(tagIds)],
      numericAttributes
    })
  })

  return {
    students,
    tags,
    studentAttributeDefinitions,
    studentIdMap
  }
}

const createRegularSeat = (
  group: number,
  col: number,
  row: number,
  empty = true
): WorkspaceSeat => ({
  id: generateSeatId(group, col, row),
  kind: 'regular',
  group,
  col,
  row,
  studentId: null,
  empty
})

const createGuardSeat = (side: GuardSide): WorkspaceSeat => ({
  id: generateGuardSeatId(side),
  kind: 'guard',
  guardSide: side,
  group: -1,
  col: side === 'left' ? -1 : 1,
  row: -1,
  studentId: null,
  empty: false
})

const ensureGuardSeat = (
  seats: WorkspaceSeat[],
  seatMap: Map<string, WorkspaceSeat>,
  side: GuardSide
) => {
  const id = generateGuardSeatId(side)
  const existing = seatMap.get(id)
  if (existing) return existing

  const seat = createGuardSeat(side)
  seats.push(seat)
  seatMap.set(id, seat)
  return seat
}

const buildGroupedSeats = (
  chart: SdesSeatChart,
  report: SdesConversionReport
) => {
  const podiumPosition = normalizePodiumPosition(chart.platformPosition)
  const rawGroups = asArray<SdesGroupedColumnGroup>(chart.groupedColumns?.groups)
  if (rawGroups.length === 0) {
    throw new Error('groupedColumns 座位表缺少 groups[]')
  }

  const groups = rawGroups.map((group, index) => {
    const columns = toPositiveInt(group.columns)
    const rows = toPositiveInt(group.rows)
    if (!columns || !rows) {
      throw new Error(`第 ${index + 1} 个大组的 columns/rows 必须是正整数`)
    }
    return {
      id: toStringValue(group.id),
      columns,
      rows
    }
  })
  const groupIdToIndex = new Map<string, number>()
  groups.forEach((group, index) => {
    if (group.id) groupIdToIndex.set(group.id, index)
  })
  const workspaceSeats: WorkspaceSeat[] = []
  const workspaceSeatMap = new Map<string, WorkspaceSeat>()
  const sdesSeatIdToWorkspaceId = new Map<string, string>()
  const seenPositions = new Set<string>()

  groups.forEach((group, groupIndex) => {
    for (let col = 0; col < group.columns; col += 1) {
      for (let row = 0; row < group.rows; row += 1) {
        const seat = createRegularSeat(groupIndex, col, row, true)
        workspaceSeats.push(seat)
        workspaceSeatMap.set(seat.id, seat)
      }
    }
  })

  const resolveGroupIndex = (value: unknown): number | null => {
    if (typeof value === 'string' && groupIdToIndex.has(value)) return groupIdToIndex.get(value) ?? null
    const index = Number(value)
    return Number.isInteger(index) && index >= 0 && index < groups.length ? index : null
  }

  asArray<SdesSeat>(chart.seats).forEach(seat => {
    const sourceSeatId = toStringValue(seat.id)
    if (!sourceSeatId) {
      report.skippedSeats += 1
      warn(report, 'seat-missing-id', '发现缺少 ID 的座位项，已跳过。')
      return
    }

    if (seat.kind === 'guard') {
      const side = seat.guardPos?.side
      const index = toNonNegativeInt(seat.guardPos?.index)
      if ((side === 'left' || side === 'right') && index === 0) {
        const guardSeat = ensureGuardSeat(workspaceSeats, workspaceSeatMap, side)
        sdesSeatIdToWorkspaceId.set(sourceSeatId, guardSeat.id)
      } else {
        report.unsupportedGuards += 1
        warn(report, 'guard-unsupported', `护法位 ${sourceSeatId} 不是当前支持的左右 index 0，已跳过。`)
      }
      return
    }

    const groupIndex = resolveGroupIndex(seat.group)
    const col = toNonNegativeInt(seat.column)
    if (groupIndex === null || col === null || col >= groups[groupIndex].columns) {
      report.skippedSeats += 1
      warn(report, 'seat-position-invalid', `座位 ${sourceSeatId} 的大组或列无效，已跳过。`)
      return
    }
    const sourceRow = toNonNegativeInt(seat.row)
    if (sourceRow === null || sourceRow >= groups[groupIndex].rows) {
      report.skippedSeats += 1
      warn(report, 'seat-position-invalid', `座位 ${sourceSeatId} 的行无效，已跳过。`)
      return
    }
    const row = getInternalRowIndex(sourceRow, groups[groupIndex].rows, podiumPosition, chart.coordinateSystem)
    const positionKey = `${groupIndex}:${col}:${row}`
    if (seenPositions.has(positionKey)) {
      report.skippedSeats += 1
      warn(report, 'seat-position-duplicate', `座位坐标 ${positionKey} 重复，${sourceSeatId} 已跳过。`)
      return
    }
    seenPositions.add(positionKey)

    const workspaceSeatId = generateSeatId(groupIndex, col, row)
    const workspaceSeat = workspaceSeatMap.get(workspaceSeatId)
    if (!workspaceSeat) return

    if (seat.kind === 'seat') {
      workspaceSeat.empty = false
      sdesSeatIdToWorkspaceId.set(sourceSeatId, workspaceSeat.id)
      if (Number(seat.capacity) > 1) {
        warn(report, 'seat-capacity-unsupported', `座位 ${sourceSeatId} 的 capacity > 1，当前应用按单人座位导入。`)
      }
    } else {
      workspaceSeat.empty = true
    }
  })

  return {
    seatConfig: {
      groupCount: groups.length,
      columnsPerGroup: groups[0]?.columns || 1,
      seatsPerColumn: Math.max(...groups.map(group => group.rows)),
      groups: groups.map(group => ({
        columns: group.columns,
        rows: group.rows
      })),
      shiftDistance: 4,
      podiumPosition,
      guardSeats: {
        enabled: true,
        leftEnabled: true,
        rightEnabled: true,
        includeInAutoAssignment: false,
        hideEmptyOnExport: true
      }
    },
    workspaceSeats,
    workspaceSeatMap,
    sdesSeatIdToWorkspaceId
  }
}

const buildGridSeats = (
  chart: SdesSeatChart,
  report: SdesConversionReport
) => {
  const podiumPosition = normalizePodiumPosition(chart.platformPosition)
  const rows = toPositiveInt(chart.grid?.rows)
  const columns = toPositiveInt(chart.grid?.columns)
  if (!rows || !columns) {
    throw new Error('grid 座位表缺少有效 rows/columns')
  }

  const guardSeats: WorkspaceSeat[] = []
  const guardSeatMap = new Map<string, WorkspaceSeat>()
  const sdesSeatIdToWorkspaceId = new Map<string, string>()
  const seenPositions = new Set<string>()
  const gridCells: GridToGroupedCell[] = []

  asArray<SdesSeat>(chart.seats).forEach(seat => {
    const sourceSeatId = toStringValue(seat.id)
    if (!sourceSeatId) {
      report.skippedSeats += 1
      warn(report, 'seat-missing-id', '发现缺少 ID 的座位项，已跳过。')
      return
    }

    if (seat.kind === 'guard') {
      const side = seat.guardPos?.side
      const index = toNonNegativeInt(seat.guardPos?.index)
      if ((side === 'left' || side === 'right') && index === 0) {
        const guardSeat = ensureGuardSeat(guardSeats, guardSeatMap, side)
        sdesSeatIdToWorkspaceId.set(sourceSeatId, guardSeat.id)
      } else {
        report.unsupportedGuards += 1
        warn(report, 'guard-unsupported', `护法位 ${sourceSeatId} 不是当前支持的左右 index 0，已跳过。`)
      }
      return
    }

    const rawX = toNonNegativeInt(seat.x)
    const rawY = toNonNegativeInt(seat.y)
    if (rawX === null || rawY === null || rawX >= columns || rawY >= rows) {
      report.skippedSeats += 1
      warn(report, 'seat-position-invalid', `座位或标志物 ${sourceSeatId} 的 x/y 超出 grid 范围，已跳过。`)
      return
    }

    const col = getCoordinateX(rawX, columns, chart.coordinateSystem)
    const row = getInternalRowIndex(rawY, rows, podiumPosition, chart.coordinateSystem)
    const positionKey = `${col}:${row}`
    if (seenPositions.has(positionKey)) {
      report.skippedSeats += 1
      warn(report, 'seat-position-duplicate', `grid 坐标 ${positionKey} 重复，${sourceSeatId} 已跳过。`)
      return
    }
    seenPositions.add(positionKey)

    if (seat.kind === 'seat' && Number(seat.capacity) > 1) {
      warn(report, 'seat-capacity-unsupported', `座位 ${sourceSeatId} 的 capacity > 1，当前应用按单人座位导入。`)
    }

    gridCells.push({
      sourceId: sourceSeatId,
      x: col,
      y: row,
      kind: seat.kind || 'seat',
      groupId: seat.group,
      studentId: null
    })
  })

  const gridResult = convertGridToGroupedColumns(rows, columns, gridCells)
  const regularSeats = gridResult.seats as WorkspaceSeat[]
  const workspaceSeats = [...regularSeats, ...guardSeats]
  const workspaceSeatMap = new Map<string, WorkspaceSeat>()
  gridResult.seatMap.forEach((seat, id) => workspaceSeatMap.set(id, seat as WorkspaceSeat))
  guardSeatMap.forEach((seat, id) => workspaceSeatMap.set(id, seat))
  gridResult.sourceIdToSeatId.forEach((workspaceSeatId, sourceSeatId) => {
    sdesSeatIdToWorkspaceId.set(sourceSeatId, workspaceSeatId)
  })

  report.gridMarkers += gridResult.metrics.markerCells
  report.gridCollapsedColumns += gridResult.metrics.collapsedSeparatorColumns
  if (gridResult.metrics.usedExplicitGroups) {
    report.gridExplicitGroups += gridResult.metrics.explicitGroupCount
  } else {
    report.gridInferredGroups += gridResult.metrics.inferredGroupCount
  }
  report.gridFilledEmptyCells += gridResult.metrics.filledEmptyCells

  if (gridResult.metrics.usedExplicitGroups) {
    warn(report, 'grid-explicit-groups-used', `SDES grid 已按 ${gridResult.metrics.explicitGroupCount} 个显式分组转换为大组列行。`)
  } else {
    warn(report, 'grid-groups-inferred', `SDES grid 已按走廊/空列推断为 ${gridResult.metrics.inferredGroupCount} 个大组。`)
  }
  if (gridResult.metrics.collapsedSeparatorColumns > 0) {
    warn(report, 'grid-separator-columns-collapsed', `${gridResult.metrics.collapsedSeparatorColumns} 列 grid 分隔列已折叠为大组间距。`)
  }
  if (gridResult.metrics.explicitGroupsIncomplete) {
    warn(report, 'grid-explicit-groups-incomplete', 'SDES grid 只有部分座位带有 group，已改用走廊列推断。')
  }
  if (gridResult.metrics.explicitGroupsOverlapped) {
    warn(report, 'grid-explicit-groups-overlapped', 'SDES grid 的显式 group 在物理列上交错，已改用走廊列推断以保留几何结构。')
  }
  if (gridResult.metrics.markerCells > 0) {
    warn(report, 'grid-markers-as-empty', `${gridResult.metrics.markerCells} 个 grid 标志物已作为空置格或分隔列处理。`)
  }

  return {
    seatConfig: {
      ...gridResult.seatConfig,
      shiftDistance: 4,
      podiumPosition,
      guardSeats: {
        enabled: true,
        leftEnabled: true,
        rightEnabled: true,
        includeInAutoAssignment: false,
        hideEmptyOnExport: true
      }
    },
    workspaceSeats,
    workspaceSeatMap,
    sdesSeatIdToWorkspaceId
  }
}

const applyAssignments = (
  chart: SdesSeatChart,
  studentIdMap: Map<string, number>,
  workspaceSeatMap: Map<string, WorkspaceSeat>,
  sdesSeatIdToWorkspaceId: Map<string, string>,
  report: SdesConversionReport
) => {
  const assignedStudents = new Set<number>()
  const assignedSeats = new Set<string>()

  asArray<SdesAssignment>(chart.assignments).forEach(assignment => {
    const sourceStudentId = toStringValue(assignment.studentId)
    const sourceSeatId = toStringValue(assignment.seatId)
    const studentId = studentIdMap.get(sourceStudentId)
    const workspaceSeatId = sdesSeatIdToWorkspaceId.get(sourceSeatId)
    const workspaceSeat = workspaceSeatId ? workspaceSeatMap.get(workspaceSeatId) : null

    if (!studentId || !workspaceSeat) {
      report.skippedAssignments += 1
      warn(report, 'assignment-unresolved', `分配 ${sourceStudentId || '?'} -> ${sourceSeatId || '?'} 无法解析，已跳过。`)
      return
    }
    if (workspaceSeat.empty) {
      report.skippedAssignments += 1
      warn(report, 'assignment-to-unavailable-seat', `分配 ${sourceStudentId} -> ${sourceSeatId} 指向不可用座位，已跳过。`)
      return
    }
    if (assignedStudents.has(studentId)) {
      report.skippedAssignments += 1
      warn(report, 'assignment-student-duplicate', `学生 ${sourceStudentId} 在同一座位表中被重复分配，后续分配已跳过。`)
      return
    }
    if (assignedSeats.has(workspaceSeat.id)) {
      report.skippedAssignments += 1
      warn(report, 'assignment-seat-duplicate', `座位 ${sourceSeatId} 被重复分配，后续分配已跳过。`)
      return
    }

    workspaceSeat.studentId = studentId
    assignedStudents.add(studentId)
    assignedSeats.add(workspaceSeat.id)
  })
}

export const buildWorkspaceFromSdes = (
  document: SdesDocument,
  target: Pick<SdesImportTarget, 'classIndex' | 'seatChartIndex'>
): SdesWorkspaceResult => {
  const clazz = document.classes[target.classIndex]
  const chart = clazz?.seatCharts?.[target.seatChartIndex]
  if (!clazz || !chart) {
    throw new Error('选择的 SDES 班级或座位表不存在')
  }
  if (chart.layoutModel !== 'grid' && chart.layoutModel !== 'groupedColumns') {
    throw new Error(`不支持的 SDES 座位表模型：${chart.layoutModel || 'unknown'}`)
  }

  const report = createReport()
  const studentResult = buildStudents(clazz, report)
  const seatResult = chart.layoutModel === 'grid'
    ? buildGridSeats(chart, report)
    : buildGroupedSeats(chart, report)

  applyAssignments(
    chart,
    studentResult.studentIdMap,
    seatResult.workspaceSeatMap,
    seatResult.sdesSeatIdToWorkspaceId,
    report
  )

  return {
    workspace: {
      meta: {
        version: '2.2',
        app: 'SeatingChartEditor',
        createdAt: new Date().toISOString(),
        source: 'sdes',
        sourceFormatVersion: document.version,
        sourceClassId: clazz.id,
        sourceSeatChartId: chart.id
      },
      students: studentResult.students,
      studentAttributeDefinitions: studentResult.studentAttributeDefinitions,
      studentAttributeSettings: {
        showNumericAttributesInEditor: true
      },
      tags: studentResult.tags,
      tagSettings: {
        showTagsInSeatChart: true,
        tagDisplayMode: 'dot'
      },
      layout: {
        config: seatResult.seatConfig,
        seats: seatResult.workspaceSeats
      },
      zones: [],
      rules: [],
      exportSettings: {}
    },
    report
  }
}

export const formatSdesReportSummary = (report: SdesConversionReport): string => {
  const parts: string[] = []
  if (report.skippedStudents) parts.push(`${report.skippedStudents} 名学生跳过`)
  if (report.skippedAttributes) parts.push(`${report.skippedAttributes} 个属性跳过`)
  if (report.skippedAssignments) parts.push(`${report.skippedAssignments} 个座位分配跳过`)
  if (report.unsupportedGuards) parts.push(`${report.unsupportedGuards} 个护法位不兼容`)
  if (report.lostLeadingZeroNumbers) parts.push(`${report.lostLeadingZeroNumbers} 个学号丢失前导零`)
  if (report.gridInferredGroups > 1 || report.gridExplicitGroups > 1) {
    parts.push(`grid 转为 ${Math.max(report.gridInferredGroups, report.gridExplicitGroups)} 个大组`)
  }
  if (report.gridCollapsedColumns) parts.push(`${report.gridCollapsedColumns} 列 grid 分隔列已折叠`)
  if (report.gridMarkers) parts.push(`${report.gridMarkers} 个 grid 标志物按空置或分隔处理`)
  return parts.length > 0 ? parts.join('，') : '无兼容性降级'
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const createSdesSeatId = (seat: Seat): string => {
  if (seat.kind === 'guard' || isGuardSeatId(seat.id)) {
    return `guard:${seat.guardSide || (seat.id === 'guard-right' ? 'right' : 'left')}:0`
  }
  return `seat:grouped:${seat.groupIndex}:${seat.columnIndex}:${seat.rowIndex}`
}

export const buildSdesDocumentFromState = (state: {
  students: Array<{
    id: number
    name: string
    studentNumber: number | null
    tags: number[]
    numericAttributes?: Record<string, number | null>
  }>
  tags: Tag[]
  attributeDefinitions: NumericAttributeDefinition[]
  seatConfig: {
    groupCount: number
    columnsPerGroup: number
    seatsPerColumn: number
    groups?: Array<{ columns: number; rows: number }>
    shiftDistance?: number
    podiumPosition?: PodiumPosition
    guardSeats?: Record<string, unknown>
  }
  seats: Seat[]
  zones: unknown[]
  rules: unknown[]
  exportSettings: unknown
  tagSettings: {
    showTagsInSeatChart: boolean
    tagDisplayMode: string
  }
  studentAttributeSettings: {
    showNumericAttributesInEditor: boolean
  }
}): SdesDocument => {
  const podiumPosition = normalizePodiumPosition(state.seatConfig.podiumPosition)
  const groups = Array.isArray(state.seatConfig.groups) && state.seatConfig.groups.length > 0
    ? state.seatConfig.groups
    : Array.from({ length: state.seatConfig.groupCount }, () => ({
        columns: state.seatConfig.columnsPerGroup,
        rows: state.seatConfig.seatsPerColumn
      }))
  const seatIdByInternalId = new Map<string, string>()

  const sdesSeats = state.seats
    .filter(seat => {
      if (seat.kind === 'guard' || isGuardSeatId(seat.id)) return true
      return seat.groupIndex >= 0 && seat.columnIndex >= 0 && seat.rowIndex >= 0
    })
    .map(seat => {
      const sdesId = createSdesSeatId(seat)
      seatIdByInternalId.set(seat.id, sdesId)

      if (seat.kind === 'guard' || isGuardSeatId(seat.id)) {
        const side = (seat.guardSide || (seat.id === 'guard-right' ? 'right' : 'left')) as GuardSide
        return {
          id: sdesId,
          kind: 'guard' as const,
          guardPos: {
            side,
            index: 0
          }
        }
      }

      const groupRows = groups[seat.groupIndex]?.rows || state.seatConfig.seatsPerColumn
      return {
        id: sdesId,
        kind: seat.isEmpty ? 'empty' as const : 'seat' as const,
        group: seat.groupIndex,
        column: seat.columnIndex,
        row: getSdesRowFromInternal(seat.rowIndex, groupRows, podiumPosition),
        capacity: seat.isEmpty ? undefined : 1
      }
    })

  return {
    format: SDES_FORMAT,
    version: SDES_VERSION,
    manifest: {
      producer: 'BraydenSCE V2',
      producerVersion: appBuildInfo.releaseVersion,
      exportedAt: new Date().toISOString(),
      locale: typeof navigator !== 'undefined' ? navigator.language : 'zh-CN'
    },
    classes: [
      {
        id: 'class:current',
        metadata: {
          name: '当前工作区'
        },
        students: state.students.map(student => ({
          id: `student:${student.id}`,
          number: student.studentNumber === null || student.studentNumber === undefined
            ? undefined
            : String(student.studentNumber),
          name: {
            display: student.name
          },
          tags: (student.tags || []).map(tagId => `tag:${tagId}`),
          attributes: Object.fromEntries(
            Object.entries(student.numericAttributes || {})
              .filter(([, value]) => value !== null && value !== undefined)
          )
        })),
        tags: state.tags.map(tag => ({
          id: `tag:${tag.id}`,
          name: tag.name,
          color: normalizeColor(tag.color, '#4CAF50')
        })),
        attributeDefinitions: state.attributeDefinitions.map(def => ({
          id: def.id,
          name: def.name,
          type: 'number' as const,
          unit: def.unit || undefined
        })),
        seatCharts: [
          {
            id: 'chart:current',
            name: '当前座位表',
            layoutModel: 'groupedColumns',
            platformPosition: podiumPosition,
            coordinateSystem: getCoordinateSystemForPodium(podiumPosition),
            groupedColumns: {
              groups: groups.map((group, index) => ({
                id: `group:${index}`,
                columns: group.columns,
                rows: group.rows
              }))
            },
            seats: sdesSeats,
            assignments: state.seats
              .filter(seat => seat.studentId !== null && seat.studentId !== undefined && !seat.isEmpty)
              .map(seat => ({
                seatId: seatIdByInternalId.get(seat.id),
                studentId: `student:${seat.studentId}`
              }))
              .filter((assignment): assignment is { seatId: string; studentId: string } => !!assignment.seatId)
          }
        ]
      }
    ],
    extensions: {
      [BSCE_EXTENSION_KEY]: {
        workspaceVersion: '2.2',
        note: 'SDES 是交换格式；完整备份请使用 .sce 工作区文件。',
        seatConfig: {
          shiftDistance: state.seatConfig.shiftDistance,
          guardSeats: cloneJson(state.seatConfig.guardSeats || {})
        },
        tagSettings: cloneJson(state.tagSettings),
        studentAttributeSettings: cloneJson(state.studentAttributeSettings),
        zones: cloneJson(state.zones),
        rules: cloneJson(state.rules),
        exportSettings: cloneJson(state.exportSettings)
      }
    }
  }
}

export function useSdesExchange() {
  const { applyWorkspaceData, saveLastWorkspace } = useWorkspace()
  const { students } = useStudentData()
  const { tags, showTagsInSeatChart, tagDisplayMode } = useTagData()
  const { seatConfig, seats } = useSeatChart()
  const { attributeDefinitions, showNumericAttributesInEditor } = useStudentAttributes()
  const { zones } = useZoneData()
  const { rules } = useSeatRules()
  const { exportSettings } = useExportSettings()

  const importSdesTarget = async (
    document: SdesDocument,
    target: SdesImportTarget
  ): Promise<SdesConversionReport> => {
    const { workspace, report } = buildWorkspaceFromSdes(document, target)
    const imported = await applyWorkspaceData(workspace)
    if (!imported) {
      throw new Error('SDES 数据导入失败')
    }

    saveLastWorkspace({
      type: 'sdes',
      name: `${target.className} / ${target.chartName}`,
      classId: target.classId,
      seatChartId: target.chartId
    })

    return report
  }

  const buildCurrentSdesDocument = (): SdesDocument => buildSdesDocumentFromState({
    students: students.value,
    tags: tags.value,
    attributeDefinitions: attributeDefinitions.value,
    seatConfig: {
      ...seatConfig.value,
      podiumPosition: normalizePodiumPosition(seatConfig.value.podiumPosition)
    },
    seats: seats.value,
    zones: zones.value,
    rules: rules.value,
    exportSettings: exportSettings.value,
    tagSettings: {
      showTagsInSeatChart: showTagsInSeatChart.value,
      tagDisplayMode: tagDisplayMode.value
    },
    studentAttributeSettings: {
      showNumericAttributesInEditor: showNumericAttributesInEditor.value
    }
  })

  const exportCurrentSdes = async () => {
    const document = buildCurrentSdesDocument()
    return saveTextFile(JSON.stringify(document, null, 2), {
      title: '导出 SDES',
      defaultPath: `座位表_${new Date().toISOString().slice(0, 10)}.sdes.json`,
      filters: sdesFileFilters,
      extension: '.sdes.json',
      mimeType: 'application/json;charset=utf-8'
    })
  }

  return {
    parseSdesText,
    getSdesImportTargets,
    buildWorkspaceFromSdes,
    importSdesTarget,
    buildCurrentSdesDocument,
    exportCurrentSdes
  }
}
