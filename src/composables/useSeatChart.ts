import { computed } from 'vue'
import { useZoneData } from './useZoneData'
import { useUndo } from './useUndo'
import { pruneRotationSeatIds } from './zoneRotationState'
import {
  assignStudentRaw,
  batchUpdateSeatsRaw,
  clearAllSeatsRaw,
  clearSeatRaw,
  defaultGuardSeatsConfig,
  getSeatRaw,
  hasSeatRaw,
  replaceSeatChartStateRaw,
  replaceSeatsRaw,
  seatConfig,
  seats,
  swapSeatsRaw,
  toggleEmptyRaw,
  updateSeatStateRaw
} from './seatChartState'
import { parseSeatId, generateSeatId, generateGuardSeatId, isGuardSeatId } from '@/utils/seatHelpers'
import type { GroupConfig, GuardSeatsConfig, Seat, SeatConfig, SeatPosition } from '@/types/models'
import type { BatchSeatUpdate, SeatStateUpdate } from './seatChartState'

type GuardSide = 'left' | 'right'
type ColumnType = 'wall' | 'aisle' | 'edge' | 'center'

interface SelectionMove {
  srcId: string
  destId: string
  studentId: number
}

// 确保 groups 数组存在且长度匹配
function ensureGroupsArray() {
  const config = seatConfig.value
  if (!config.groups || !Array.isArray(config.groups)) {
    config.groups = []
  }
  // 补齐或裁剪数组以匹配 groupCount
  while (config.groups.length < config.groupCount) {
    config.groups.push({
      columns: config.columnsPerGroup,
      rows: config.seatsPerColumn
    })
  }
  while (config.groups.length > config.groupCount) {
    config.groups.pop()
  }
}

// 获取指定大组的配置
function getGroupConfig(groupIndex: number): GroupConfig {
  ensureGroupsArray()
  const config = seatConfig.value
  if (config.groups[groupIndex]) {
    return {
      columns: config.groups[groupIndex].columns || config.columnsPerGroup,
      rows: config.groups[groupIndex].rows || config.seatsPerColumn
    }
  }
  return {
    columns: config.columnsPerGroup,
    rows: config.seatsPerColumn
  }
}

function normalizePodiumPosition(value: unknown): 'top' | 'bottom' {
  return value === 'top' ? 'top' : 'bottom'
}

function getPodiumPosition() {
  return normalizePodiumPosition(seatConfig.value.podiumPosition)
}

function normalizeGuardSeatsConfig(config: Partial<GuardSeatsConfig> = {}): GuardSeatsConfig {
  const source = config || {}
  return {
    ...defaultGuardSeatsConfig,
    ...source,
    enabled: source.enabled !== false,
    leftEnabled: source.leftEnabled !== false,
    rightEnabled: source.rightEnabled !== false,
    includeInAutoAssignment: source.includeInAutoAssignment === true,
    hideEmptyOnExport: source.hideEmptyOnExport !== false
  }
}

function ensureGuardSeatsConfig() {
  const normalized = normalizeGuardSeatsConfig(seatConfig.value.guardSeats)
  const current = seatConfig.value.guardSeats
  const changed = !current ||
    current.enabled !== normalized.enabled ||
    current.leftEnabled !== normalized.leftEnabled ||
    current.rightEnabled !== normalized.rightEnabled ||
    current.includeInAutoAssignment !== normalized.includeInAutoAssignment ||
    current.hideEmptyOnExport !== normalized.hideEmptyOnExport
  if (changed) {
    seatConfig.value.guardSeats = normalized
  }
  return normalized
}

function createGuardSeat(side: GuardSide): Seat {
  return {
    id: generateGuardSeatId(side),
    groupIndex: -1,
    columnIndex: side === 'left' ? -1 : 1,
    rowIndex: -1,
    studentId: null,
    isEmpty: false,
    kind: 'guard',
    guardSide: side
  }
}

function shouldPreserveGuardSeatStudent(seat: Seat | undefined, config: GuardSeatsConfig): boolean {
  if (!seat || (seat.kind !== 'guard' && !isGuardSeatId(seat.id))) return false
  if (!config.enabled) return false
  return (
    (seat.guardSide === 'left' && config.leftEnabled) ||
    (seat.guardSide === 'right' && config.rightEnabled)
  )
}

const replaceSeatChartState = (nextConfig: SeatConfig, nextSeats: Seat[]) => {
  replaceSeatChartStateRaw(nextConfig, nextSeats)
}

// 单座位状态更新（带撤销记录）
const updateSeatState = (seatId: string, updates: SeatStateUpdate, recordUndo = true) => {
  const seat = getSeatRaw(seatId)
  if (!seat) {
    console.warn(`[useSeatChart] Seat not found: ${seatId}`, { updates })
    return false
  }

  const undo = recordUndo ? useUndo() : null
  const beforeSnapshot = undo?.createSnapshot()
  updateSeatStateRaw(seatId, updates)
  if (undo && beforeSnapshot) {
    undo.recordBatch(beforeSnapshot, undo.createSnapshot())
  }

  return true
}

// 批量状态更新（带快照机制）
const batchUpdateSeats = (updates: BatchSeatUpdate[], recordUndo = true) => {
  const undo = recordUndo ? useUndo() : null
  const beforeSnapshot = undo?.createSnapshot()
  const updated = batchUpdateSeatsRaw(updates)
  if (!updated) return false

  if (undo && beforeSnapshot) {
    undo.recordBatch(beforeSnapshot, undo.createSnapshot())
  }
  return true
}

// 初始化座位表
function initializeSeats() {
  const newSeats: Seat[] = []
  const { groupCount } = seatConfig.value
  ensureGroupsArray()
  ensureGuardSeatsConfig()

  for (let g = 0; g < groupCount; g++) {
    const groupConfig = getGroupConfig(g)
    for (let c = 0; c < groupConfig.columns; c++) {
      for (let r = 0; r < groupConfig.rows; r++) {
        newSeats.push({
          id: generateSeatId(g, c, r),
          groupIndex: g,
          columnIndex: c,
          rowIndex: r,
          studentId: null,
          isEmpty: false,
          kind: 'regular'
        })
      }
    }
  }

  newSeats.push(createGuardSeat('left'), createGuardSeat('right'))

  replaceSeatsRaw(newSeats)
}

// 根据最新配置重建座位，保留仍存在且可见的座位状态
function reconcileSeatsWithConfig() {
  const previousSeats = new Map(seats.value.map(seat => [seat.id, seat]))
  const newSeats: Seat[] = []
  const { groupCount } = seatConfig.value
  ensureGroupsArray()
  const guardConfig = ensureGuardSeatsConfig()

  for (let g = 0; g < groupCount; g++) {
    const groupConfig = getGroupConfig(g)
    for (let c = 0; c < groupConfig.columns; c++) {
      for (let r = 0; r < groupConfig.rows; r++) {
        const id = generateSeatId(g, c, r)
        const previousSeat = previousSeats.get(id)
        const isEmpty = previousSeat?.isEmpty ?? false
        newSeats.push({
          id,
          groupIndex: g,
          columnIndex: c,
          rowIndex: r,
          studentId: isEmpty ? null : (previousSeat?.studentId ?? null),
          isEmpty,
          kind: 'regular'
        })
      }
    }
  }

  for (const side of ['left', 'right'] as const) {
    const guardSeat = createGuardSeat(side)
    const previousSeat = previousSeats.get(guardSeat.id)
    guardSeat.studentId = shouldPreserveGuardSeatStudent(previousSeat, guardConfig) && previousSeat
      ? previousSeat.studentId
      : null
    newSeats.push(guardSeat)
  }

  replaceSeatsRaw(newSeats)
}

// 按组和列组织座位数据（用于渲染）— 单遍分桶，O(n)
const organizedSeats = computed<Seat[][][]>(() => {
  const { groupCount } = seatConfig.value
  ensureGroupsArray()
  
  // 预分配结构，根据每大组的列数
  const groups: Seat[][][] = Array.from({ length: groupCount }, (_, g) => {
    const groupConfig = getGroupConfig(g)
    return Array.from({ length: groupConfig.columns }, () => [] as Seat[])
  })

  // 单次遍历分桶
  for (const seat of seats.value) {
    if (seat.kind === 'guard' || isGuardSeatId(seat.id)) continue
    if (groups[seat.groupIndex] && groups[seat.groupIndex][seat.columnIndex]) {
      groups[seat.groupIndex][seat.columnIndex].push(seat)
    }
  }

  // 每个桶按 rowIndex 排序，渲染顺序始终保持物理坐标不变
  for (const group of groups) {
    for (const col of group) {
      col.sort((a, b) => a.rowIndex - b.rowIndex)
    }
  }

  return groups
})

const guardSeats = computed<Seat[]>(() => {
  ensureGuardSeatsConfig()
  return (['left', 'right'] as const)
    .map(side => seats.value.find(seat => seat.id === generateGuardSeatId(side)))
    .filter((seat): seat is Seat => seat !== undefined)
})

const visibleGuardSeats = computed(() => {
  const config = ensureGuardSeatsConfig()
  if (!config.enabled) return []
  return guardSeats.value.filter(seat => (
    (seat.guardSide === 'left' && config.leftEnabled) ||
    (seat.guardSide === 'right' && config.rightEnabled)
  ))
})

// 学生到座位的反向索引：座位状态变化时懒重建，同一稳定状态下供所有调用端复用。
const studentSeatMap = computed(() => {
  const index = new Map<number, Seat>()
  for (const seat of seats.value) {
    if (!seat.isEmpty && seat.studentId !== null && !index.has(seat.studentId)) {
      index.set(seat.studentId, seat)
    }
  }
  return index
})

export function useSeatChart() {
  const { cleanupInvalidSeats } = useZoneData()

  const getTotalColumns = () => {
    ensureGroupsArray()
    let total = 0
    for (let groupIndex = 0; groupIndex < seatConfig.value.groupCount; groupIndex++) {
      total += getGroupConfig(groupIndex).columns
    }
    return total
  }

  const toGlobalCol = (seat: Pick<SeatPosition, 'groupIndex' | 'columnIndex'>) => {
    if (!Number.isInteger(seat.groupIndex) || !Number.isInteger(seat.columnIndex)) return -1
    if (seat.groupIndex < 0 || seat.groupIndex >= seatConfig.value.groupCount) return -1

    const groupConfig = getGroupConfig(seat.groupIndex)
    if (seat.columnIndex < 0 || seat.columnIndex >= groupConfig.columns) return -1

    let globalColumn = seat.columnIndex
    for (let groupIndex = 0; groupIndex < seat.groupIndex; groupIndex++) {
      globalColumn += getGroupConfig(groupIndex).columns
    }
    return globalColumn
  }

  const fromGlobalCol = (globalColumn: number): Pick<SeatPosition, 'groupIndex' | 'columnIndex'> | null => {
    if (!Number.isInteger(globalColumn) || globalColumn < 0) return null

    let remaining = globalColumn
    for (let groupIndex = 0; groupIndex < seatConfig.value.groupCount; groupIndex++) {
      const columns = getGroupConfig(groupIndex).columns
      if (remaining < columns) {
        return { groupIndex, columnIndex: remaining }
      }
      remaining -= columns
    }
    return null
  }

  const getTranslatedSeatId = (seatId: string, columnOffset: number, rowOffset: number) => {
    const source = getSeatRaw(seatId)
    if (!source || source.kind === 'guard' || isGuardSeatId(source.id)) return null

    const sourceGlobalColumn = toGlobalCol(source)
    if (sourceGlobalColumn < 0) return null
    const destination = fromGlobalCol(sourceGlobalColumn + columnOffset)
    if (!destination) return null

    const destinationRow = source.rowIndex + rowOffset
    if (destinationRow < 0) return null
    const destinationId = generateSeatId(destination.groupIndex, destination.columnIndex, destinationRow)
    return hasSeatRaw(destinationId) ? destinationId : null
  }

  // 分配学生到座位
  const assignStudent = (seatId: string, studentId: number, recordUndo = true) => {
    const seat = getSeatRaw(seatId)
    if (seat && !seat.isEmpty) {
      const undo = recordUndo ? useUndo() : null
      const beforeSnapshot = undo?.createSnapshot()
      assignStudentRaw(seatId, studentId)
      if (undo && beforeSnapshot) {
        undo.recordBatch(beforeSnapshot, undo.createSnapshot())
      }
      return true
    }
    return false
  }

  // 切换空置状态
  const toggleEmpty = (seatId: string, recordUndo = true) => {
    const seat = getSeatRaw(seatId)
    if (seat) {
      if (seat.kind === 'guard' || isGuardSeatId(seat.id)) return
      const undo = recordUndo ? useUndo() : null
      const beforeSnapshot = undo?.createSnapshot()
      toggleEmptyRaw(seatId)
      if (undo && beforeSnapshot) {
        undo.recordBatch(beforeSnapshot, undo.createSnapshot())
      }
    }
  }

  // 清空座位
  const clearSeat = (seatId: string, recordUndo = true) => {
    const seat = getSeatRaw(seatId)
    if (!seat || seat.studentId === null) return false
    if (recordUndo) {
      const { recordClear } = useUndo()
      recordClear(seatId, seat.studentId)
    }
    return clearSeatRaw(seatId)
  }

  // 交换两个座位的学生
  const swapSeats = (seatId1: string, seatId2: string, recordUndo = true) => {
    const seat1 = getSeatRaw(seatId1)
    const seat2 = getSeatRaw(seatId2)
    if (
      !seat1 ||
      !seat2 ||
      seat1.isEmpty ||
      seat2.isEmpty ||
      seatId1 === seatId2 ||
      seat1.studentId === seat2.studentId
    ) {
      return false
    }
    if (recordUndo) {
      const { recordSwap } = useUndo()
      recordSwap(seatId1, seatId2)
    }
    return swapSeatsRaw(seatId1, seatId2)
  }

  // 批量移动选区学生（以拖拽起始座位为锚点，整体平移）
  const moveSelection = (selectedSeatIds: string[], anchorId: string, targetSeatId: string) => {
    if (!selectedSeatIds || selectedSeatIds.length === 0) return false

    const targetSeat = getSeatRaw(targetSeatId)
    if (!targetSeat || targetSeat.isEmpty || targetSeat.kind === 'guard' || isGuardSeatId(targetSeat.id)) return false

    const anchorSeat = getSeatRaw(anchorId)
    if (!anchorSeat || anchorSeat.isEmpty || anchorSeat.kind === 'guard' || isGuardSeatId(anchorSeat.id)) return false

    const anchorGlobalColumn = toGlobalCol(anchorSeat)
    const targetGlobalColumn = toGlobalCol(targetSeat)
    if (anchorGlobalColumn < 0 || targetGlobalColumn < 0) return false

    const offsetCol = targetGlobalColumn - anchorGlobalColumn
    const offsetRow = targetSeat.rowIndex - anchorSeat.rowIndex
    if (offsetCol === 0 && offsetRow === 0) return false

    // 先计算并验证全部源->目标映射；任何目标无效时不修改当前座位状态。
    const moves: SelectionMove[] = []
    for (const sid of new Set(selectedSeatIds)) {
      const src = getSeatRaw(sid)
      if (!src || src.isEmpty || src.kind === 'guard' || isGuardSeatId(src.id)) return false
      if (src.studentId === null) continue

      const destId = getTranslatedSeatId(src.id, offsetCol, offsetRow)
      if (!destId) return false
      const dest = getSeatRaw(destId)
      if (!dest || dest.isEmpty || dest.kind === 'guard' || isGuardSeatId(dest.id)) return false

      moves.push({ srcId: sid, destId, studentId: src.studentId })
    }

    if (moves.length === 0) return false

    const sourceIdSet = new Set(moves.map(move => move.srcId))
    const destIdSet = new Set(moves.map(m => m.destId))
    if (destIdSet.size !== moves.length) return false

    const studentIdsBefore = seats.value
      .flatMap(seat => seat.studentId === null ? [] : [seat.studentId])
      .sort((a, b) => a - b)
    const finalState = new Map<string, number | null>()

    // 目标位置原有且不属于选区的学生，需要回填到被腾出的源座位。
    const displacedStudents: number[] = []
    for (const move of moves) {
      const destinationStudentId = getSeatRaw(move.destId)?.studentId ?? null
      if (destinationStudentId !== null && !sourceIdSet.has(move.destId)) {
        displacedStudents.push(destinationStudentId)
      }
    }

    const availableSources = moves
      .map(move => move.srcId)
      .filter(sourceId => !destIdSet.has(sourceId))
    if (displacedStudents.length > availableSources.length) return false

    for (const sourceId of availableSources) {
      finalState.set(sourceId, null)
    }
    for (const move of moves) {
      finalState.set(move.destId, move.studentId)
    }
    displacedStudents.forEach((studentId, index) => {
      finalState.set(availableSources[index], studentId)
    })

    const studentIdsAfter = seats.value
      .flatMap(seat => {
        const studentId = finalState.has(seat.id) ? finalState.get(seat.id) : seat.studentId
        return studentId === null || studentId === undefined ? [] : [studentId]
      })
      .sort((a, b) => a - b)
    if (studentIdsBefore.length !== studentIdsAfter.length || studentIdsBefore.some((id, index) => id !== studentIdsAfter[index])) {
      return false
    }

    const updates: Array<{ seat: Seat; studentId: number | null }> = []
    for (const [seatId, studentId] of finalState) {
      const seat = getSeatRaw(seatId)
      if (!seat) return false
      updates.push({ seat, studentId })
    }
    for (const update of updates) {
      update.seat.studentId = update.studentId
    }

    return true
  }

  /**
   * 将所有非空置座位上的学生进行循环换座（支持二维位移）
   *
   * @param {number} distance  - 行方向平移量（正=向后，负=向前）
   * @param {number} direction - 溢出时的列偏移量（正=溢出时向左，负=向右）
   * @param {number} colShift  - 直接列偏移量（不依赖溢出，正=向右，负=向左）
   *
   * 内部坐标系使用 groups[] 的实际列数前缀和。
   */
  const shiftSeats = (distance: number, direction = 0, colShift = 0) => {
    const totalCols = getTotalColumns()
    if (totalCols <= 0) return false

    const availableSeats = getAvailableSeats()
    if (availableSeats.length === 0) return false
    const availableSeatIds = new Set(availableSeats.map(seat => seat.id))
    const sourceIds = new Set<string>()
    const updates: Array<{ seat: Seat; studentId: number | null }> = []

    // 对每个目标座位反向推算来源；全部映射通过后再一次性写入。
    for (const seat of availableSeats) {
      const globalCol = toGlobalCol(seat)
      if (globalCol < 0) return false
      const rowCount = getGroupConfig(seat.groupIndex).rows
      if (rowCount <= 0) return false

      // 行方向：反推源行
      const srcRow_raw = seat.rowIndex - distance
      const overflow = Math.floor(srcRow_raw / rowCount)
      const srcRow = ((srcRow_raw % rowCount) + rowCount) % rowCount

      // 列方向：直接列偏移 + 溢出换列（两者叠加）
      //   colShift>0 表示学生向右移动，源在左侧（globalCol - colShift）
      //   overflow 部分同旧逻辑
      const srcCol = ((globalCol - colShift - overflow * direction) % totalCols + totalCols) % totalCols
      const sourcePosition = fromGlobalCol(srcCol)
      if (!sourcePosition) return false
      const sourceId = generateSeatId(sourcePosition.groupIndex, sourcePosition.columnIndex, srcRow)
      const sourceSeat = getSeatRaw(sourceId)
      if (!sourceSeat || sourceSeat.isEmpty || !availableSeatIds.has(sourceId) || sourceIds.has(sourceId)) {
        return false
      }

      sourceIds.add(sourceId)
      updates.push({ seat, studentId: sourceSeat.studentId })
    }

    const studentIdsBefore = availableSeats
      .flatMap(seat => seat.studentId === null ? [] : [seat.studentId])
      .sort((a, b) => a - b)
    const studentIdsAfter = updates
      .flatMap(update => update.studentId === null ? [] : [update.studentId])
      .sort((a, b) => a - b)
    if (studentIdsBefore.length !== studentIdsAfter.length || studentIdsBefore.some((id, index) => id !== studentIdsAfter[index])) {
      return false
    }

    for (const update of updates) {
      update.seat.studentId = update.studentId
    }
    return true
  }

  // 更新配置
  const updateConfig = (newConfig: Partial<SeatConfig>) => {
    const validConfig: Partial<SeatConfig> = {}
    if (newConfig.groupCount != null) validConfig.groupCount = newConfig.groupCount
    if (newConfig.columnsPerGroup != null) validConfig.columnsPerGroup = newConfig.columnsPerGroup
    if (newConfig.seatsPerColumn != null) validConfig.seatsPerColumn = newConfig.seatsPerColumn
    if (newConfig.groups != null) validConfig.groups = newConfig.groups
    if (newConfig.shiftDistance != null) validConfig.shiftDistance = newConfig.shiftDistance
    if (newConfig.shiftColShift != null) validConfig.shiftColShift = newConfig.shiftColShift
    if (newConfig.shiftDirection != null) validConfig.shiftDirection = newConfig.shiftDirection
    if (newConfig.guardSeats != null) validConfig.guardSeats = normalizeGuardSeatsConfig(newConfig.guardSeats)
    const podiumPosition = newConfig.podiumPosition ?? newConfig.alignment ?? newConfig.seatAlignment
    if (podiumPosition != null) validConfig.podiumPosition = normalizePodiumPosition(podiumPosition)
    seatConfig.value = { ...seatConfig.value, ...validConfig }
    delete seatConfig.value.alignment
    delete seatConfig.value.seatAlignment
    ensureGroupsArray()
    ensureGuardSeatsConfig()
    reconcileSeatsWithConfig()
    // 清理普通选区和轮换选区中已失效的座位引用
    const validSeatIds = seats.value.filter(s => s.kind !== 'guard').map(s => s.id)
    cleanupInvalidSeats(validSeatIds)
    pruneRotationSeatIds(validSeatIds)
    useUndo().clearHistory()
  }

  // 获取座位上的学生ID
  const getStudentAtSeat = (seatId: string) => {
    const seat = getSeatRaw(seatId)
    return seat ? seat.studentId : null
  }

  // 查找学生所在座位
  const findSeatByStudent = (studentId: number) => {
    return studentSeatMap.value.get(studentId)
  }

  // 清空所有座位
  const clearAllSeats = () => {
    clearAllSeatsRaw()
  }

  // 判断两个座位是否为同桌
  const areDeskmates = (seatId1: string, seatId2: string) => {
    const seat1 = parseSeatId(seatId1)
    const seat2 = parseSeatId(seatId2)
    
    // 必须同大组
    if (seat1.groupIndex !== seat2.groupIndex) return false
    
    const groupConfig = getGroupConfig(seat1.groupIndex)
    const columnsInGroup = groupConfig.columns

    // 列数<=1 时结构上不存在同桌位（0 也按不可同桌处理，避免无效配置误判）
    if (columnsInGroup <= 1) return false

    // 同桌 = 同大组、同排，且列距离在相邻/近邻范围内
    const colDiff = Math.abs(seat1.columnIndex - seat2.columnIndex)
    return (
      seat1.rowIndex === seat2.rowIndex &&
      colDiff >= 1 &&
      colDiff <= 2
    )
  }

  // 查找指定座位的同桌座位
  const findDeskmates = (seatId: string) => {
    const parsed = parseSeatId(seatId)
    const groupConfig = getGroupConfig(parsed.groupIndex)
    const columnsInGroup = groupConfig.columns
    if (columnsInGroup <= 1) return []
    return seats.value.filter(seat =>
      seat.groupIndex === parsed.groupIndex &&
      seat.rowIndex === parsed.rowIndex &&
      Math.abs(seat.columnIndex - parsed.columnIndex) >= 1 &&
      Math.abs(seat.columnIndex - parsed.columnIndex) <= 2 &&
      seat.id !== seatId
    )
  }

  // 获取所有可用座位(非空置)
  const getAvailableSeats = (includeGuardSeats = false) => {
    const config = ensureGuardSeatsConfig()
    return seats.value.filter(seat => {
      if (seat.isEmpty) return false
      if (seat.kind !== 'guard' && !isGuardSeatId(seat.id)) return true
      return includeGuardSeats && config.enabled &&
        ((seat.guardSide === 'left' && config.leftEnabled) ||
          (seat.guardSide === 'right' && config.rightEnabled))
    })
  }

  // 获取所有空座位(无学生且非空置)
  const getEmptySeats = (includeGuardSeats = false) => {
    return getAvailableSeats(includeGuardSeats).filter(seat => seat.studentId === null)
  }

  // ==================== 座位距离与相邻性 ====================

  /**
   * 计算两个座位之间的曼哈顿距离
   * @param {string} seatId1 - 座位1的ID
   * @param {string} seatId2 - 座位2的ID
   * @returns {number} 距离值，不同大组返回Infinity
   */
  const getSeatDistance = (seatId1: string, seatId2: string) => {
    if (seatId1 === seatId2) return 0

    const seat1 = parseSeatId(seatId1)
    const seat2 = parseSeatId(seatId2)

    // 不同大组视为无限远
    if (seat1.groupIndex !== seat2.groupIndex) {
      return Infinity
    }

    // 同一大组内，使用曼哈顿距离
    const colDiff = Math.abs(seat1.columnIndex - seat2.columnIndex)
    const rowDiff = Math.abs(seat1.rowIndex - seat2.rowIndex)

    return colDiff + rowDiff
  }

  /**
   * 获取指定座位的相邻座位
   * @param {string} seatId - 座位ID
   * @param {number} maxDistance - 最大距离（默认1表示直接相邻）
   * @returns {Array} 相邻座位数组
   */
  const getAdjacentSeats = (seatId: string, maxDistance = 1) => {
    const parsed = parseSeatId(seatId)

    return seats.value.filter(seat => {
      // 必须在同一大组
      if (seat.groupIndex !== parsed.groupIndex) return false

      // 排除自己
      if (seat.id === seatId) return false

      // 排除空置座位
      if (seat.isEmpty) return false

      // 计算距离
      const distance = getSeatDistance(seatId, seat.id)

      return distance > 0 && distance <= maxDistance
    })
  }

  /**
   * 验证两个座位是否满足排斥关系的最小距离要求
   * @param {string} seatId1 - 座位1的ID
   * @param {string} seatId2 - 座位2的ID
   * @param {number} minDistance - 最小距离要求
   * @returns {boolean} true表示满足排斥要求（距离足够远）
   */
  const validateRepulsion = (seatId1: string, seatId2: string, minDistance = 2) => {
    const distance = getSeatDistance(seatId1, seatId2)
    return distance >= minDistance
  }

  /**
   * 获取指定座位周围的危险区域座位（用于排斥关系）
   * @param {string} seatId - 座位ID
   * @param {number} dangerZone - 危险区域半径
   * @returns {Array} 危险区域内的座位数组
   */
  const getDangerZoneSeats = (seatId: string, dangerZone = 2) => {
    const parsed = parseSeatId(seatId)

    return seats.value.filter(seat => {
      if (seat.groupIndex !== parsed.groupIndex) return false
      if (seat.id === seatId) return false
      if (seat.isEmpty) return false

      const distance = getSeatDistance(seatId, seat.id)
      return distance > 0 && distance < dangerZone
    })
  }

  // ==================== 拓扑判定工具（纯函数，供规则引擎使用）====================

  /**
   * 判断座位是否在指定行范围内
   * 根据 podiumPosition 配置决定计数方向：
   * - 'bottom': 讲台在最下方，从下往上数（前排为 1，离讲台最近）
   * - 'top': 讲台在最上方，从上往下数（前排为 1，离讲台最近）
   * @param {string} seatId
   * @param {number} minRow - 最小排数（含），1-indexed
   * @param {number} maxRow - 最大排数（含），1-indexed
   */
  const isInRowRange = (seatId: string, minRow: number, maxRow: number) => {
    const { rowIndex, groupIndex } = parseSeatId(seatId)
    const groupConfig = getGroupConfig(groupIndex)
    const totalRows = groupConfig.rows
    const podiumPosition = getPodiumPosition()
    
    let normalizedRow
    if (podiumPosition === 'top') {
      // 讲台在顶部：从上往下数，rowIndex 0 为第 1 排（前排）
      normalizedRow = rowIndex + 1
    } else {
      // 对齐底部/讲台：从下往上数，rowIndex 最大为第 1 排（前排）
      normalizedRow = totalRows - rowIndex
    }
    
    return normalizedRow >= minRow && normalizedRow <= maxRow
  }

  /**
   * 获取座位的列类型
   * - wall: 每个大组的最左或最右列（groupIndex 的两端列）
   * - aisle: 紧邻走廊的列（大组内的最外列，每组最左列和最右列）
   * - center: 既非 wall 也非 aisle 的中间列
   *
   * 简化规则：
   *   该组列数 = 2 时：所有列都是 edge（wall+aisle 重合）
   *   该组列数 > 2 时：
   *     columnIndex 0 或 该组列数-1 的是 aisle（紧邻走廊的组外侧）
   *     同时 groupIndex 0 的 columnIndex 0 也是 wall（最左墙）
   *     groupIndex groupCount-1 的 columnIndex 该组列数-1 也是 wall（最右墙）
   */
  const getColumnType = (seatId: string): Exclude<ColumnType, 'edge'> => {
    const { groupIndex, columnIndex } = parseSeatId(seatId)
    const { groupCount } = seatConfig.value
    const groupConfig = getGroupConfig(groupIndex)
    const columnsInGroup = groupConfig.columns

    const isFirstGroup = groupIndex === 0
    const isLastGroup = groupIndex === groupCount - 1
    const isFirstCol = columnIndex === 0
    const isLastCol = columnIndex === columnsInGroup - 1

    // 最边缘的墙边列（整个座位图的最左/最右列）
    const isWall = (isFirstGroup && isFirstCol) || (isLastGroup && isLastCol)

    // 靠近走廊的列（大组两侧的最外列）
    const isAisle = isFirstCol || isLastCol

    if (isWall) return 'wall'
    if (isAisle) return 'aisle'
    return 'center'
  }

  /**
   * 判断座位是否为指定列类型
   * columnType: 'wall' | 'aisle' | 'edge' | 'center'
   * edge = wall + aisle
   */
  const isColumnType = (seatId: string, columnType: ColumnType) => {
    const type = getColumnType(seatId)
    if (columnType === 'edge') return type === 'wall' || type === 'aisle'
    return type === columnType
  }

  /**
   * 判断 seatId1 是否在 seatId2 的视线前方（即 seatId1 遮挡 seatId2）
   * 根据 podiumPosition 配置决定"前方"的方向：
   * - 'bottom': 讲台在下方，rowIndex 越大越靠前（离讲台近）
   * - 'top': 讲台在上方，rowIndex 越小越靠前（离讲台近）
   * @param {string} seatId1 - 遮挡者（在前方）
   * @param {string} seatId2 - 被遮挡者（在后方）
   * @param {number} tolerance - 0=仅正前方; 1=正前方±1列
   */
  const isDirectlyBehind = (seatId1: string, seatId2: string, tolerance = 0) => {
    const s1 = parseSeatId(seatId1)
    const s2 = parseSeatId(seatId2)
    const podiumPosition = getPodiumPosition()

    // 遮挡者必须在同大组
    if (s1.groupIndex !== s2.groupIndex) return false

    // 根据对齐方式判断谁在前方
    let isInFront
    if (podiumPosition === 'top') {
      // 讲台在顶部：rowIndex 越小越靠前（离讲台近）
      isInFront = s1.rowIndex < s2.rowIndex
    } else {
      // 对齐底部/讲台：rowIndex 越大越靠前（离讲台近）
      isInFront = s1.rowIndex > s2.rowIndex
    }

    if (!isInFront) return false

    const colDiff = Math.abs(s1.columnIndex - s2.columnIndex)
    return colDiff <= tolerance
  }

  /**
   * 判断两个座位是否在相邻排（同大组，行差为 1）
   */
  const isAdjacentRow = (seatId1: string, seatId2: string) => {
    const s1 = parseSeatId(seatId1)
    const s2 = parseSeatId(seatId2)
    if (s1.groupIndex !== s2.groupIndex) return false
    return Math.abs(s1.rowIndex - s2.rowIndex) === 1
  }

  /**
   * 判断座位是否在指定大组范围内（1-indexed，1=最左大组）
   */
  const isInGroupRange = (seatId: string, minGroup: number, maxGroup: number) => {
    const { groupIndex } = parseSeatId(seatId)
    const group1 = groupIndex + 1 // 转为 1-indexed
    return group1 >= minGroup && group1 <= maxGroup
  }

  /**
   * 获取座位表总行数
   */
  const getTotalRows = () => seatConfig.value.seatsPerColumn

  /**
   * 获取座位所在大组（1-indexed）
   */
  const getSeatGroup = (seatId: string) => parseSeatId(seatId).groupIndex + 1

  const hasSeat = (seatId: string) => hasSeatRaw(seatId)
  const getSeat = (seatId: string) => getSeatRaw(seatId)

  return {
    seatConfig,
    seats,
    organizedSeats,
    guardSeats,
    visibleGuardSeats,
    studentSeatMap,
    initializeSeats,
    assignStudent,
    toggleEmpty,
    clearSeat,
    swapSeats,
    moveSelection,
    shiftSeats,
    updateConfig,
    getStudentAtSeat,
    findSeatByStudent,
    clearAllSeats,
    parseSeatId,
    areDeskmates,
    findDeskmates,
    getAvailableSeats,
    getEmptySeats,
    // 统一状态修改接口
    updateSeatState,
    batchUpdateSeats,
    replaceSeatChartState,
    // 距离与相邻性
    getSeatDistance,
    getAdjacentSeats,
    validateRepulsion,
    getDangerZoneSeats,
    // 规则引擎拓扑判定（新增）
    isInRowRange,
    getColumnType,
    isColumnType,
    isDirectlyBehind,
    isAdjacentRow,
    isInGroupRange,
    getTotalRows,
    getSeatGroup,
    // 新增的布局配置辅助函数
    getGroupConfig,
    ensureGroupsArray,
    hasSeat,
    getSeat,
    generateSeatId,
    generateGuardSeatId,
    isGuardSeatId,
    normalizeGuardSeatsConfig,
    toGlobalCol,
    fromGlobalCol,
    getTranslatedSeatId
  }
}
