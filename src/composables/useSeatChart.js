import { ref, computed } from 'vue'
import { useZoneData } from './useZoneData'

// 座位表配置
const seatConfig = ref({
  groupCount: 4,        // 大组数量
  columnsPerGroup: 2,   // 每大组的列数
  seatsPerColumn: 7,     // 每列的座位数
  shiftDistance: 4
})

// 座位数据
const seats = ref([])

// 座位查找索引 (id -> seat object)，O(1) 查找替代 .find()
let seatMap = new Map()

// 生成座位ID
function generateSeatId(groupIndex, columnIndex, rowIndex) {
  return `seat-${groupIndex}-${columnIndex}-${rowIndex}`
}

// 初始化座位表
function initializeSeats() {
  const newSeats = []
  const { groupCount, columnsPerGroup, seatsPerColumn } = seatConfig.value

  for (let g = 0; g < groupCount; g++) {
    for (let c = 0; c < columnsPerGroup; c++) {
      for (let r = 0; r < seatsPerColumn; r++) {
        newSeats.push({
          id: generateSeatId(g, c, r),
          groupIndex: g,
          columnIndex: c,
          rowIndex: r,
          studentId: null,
          isEmpty: false
        })
      }
    }
  }

  seats.value = newSeats
  rebuildSeatMap()
}

// 从 seats.value（响应式代理）重建索引，确保 Map 持有代理对象
function rebuildSeatMap() {
  const newMap = new Map()
  for (const seat of seats.value) {
    newMap.set(seat.id, seat)
  }
  seatMap = newMap
}

// 按组和列组织座位数据（用于渲染）— 单遍分桶，O(n)
const organizedSeats = computed(() => {
  const { groupCount, columnsPerGroup } = seatConfig.value
  // 预分配结构
  const groups = Array.from({ length: groupCount }, () =>
    Array.from({ length: columnsPerGroup }, () => [])
  )

  // 单次遍历分桶
  for (const seat of seats.value) {
    groups[seat.groupIndex][seat.columnIndex].push(seat)
  }

  // 每个桶按 rowIndex 排序
  for (const group of groups) {
    for (const col of group) {
      col.sort((a, b) => a.rowIndex - b.rowIndex)
    }
  }

  return groups
})

export function useSeatChart() {
  const { cleanupInvalidSeats } = useZoneData()

  // 分配学生到座位
  const assignStudent = (seatId, studentId) => {
    const seat = seatMap.get(seatId)
    if (seat && !seat.isEmpty) {
      seat.studentId = studentId
      return true
    }
    return false
  }

  // 切换空置状态
  const toggleEmpty = (seatId) => {
    const seat = seatMap.get(seatId)
    if (seat) {
      seat.isEmpty = !seat.isEmpty
      if (seat.isEmpty) {
        seat.studentId = null  // 空置座位清除学生
      }
    }
  }

  // 清空座位
  const clearSeat = (seatId) => {
    const seat = seatMap.get(seatId)
    if (seat) {
      seat.studentId = null
    }
  }

  // 交换两个座位的学生
  const swapSeats = (seatId1, seatId2) => {
    const seat1 = seatMap.get(seatId1)
    const seat2 = seatMap.get(seatId2)
    if (seat1 && seat2) {
      const temp = seat1.studentId
      seat1.studentId = seat2.studentId
      seat2.studentId = temp
    }
  }

  /**
   * 将所有非空置座位上的学生进行循环换座（支持二维位移）
   *
   * @param {number} distance  - 行方向平移量（正=向后，负=向前）
   * @param {number} direction - 溢出时的列偏移量（正=溢出时向左，负=向右）
   * @param {number} colShift  - 直接列偏移量（不依赖溢出，正=向右，负=向左）
   *
   * 内部坐标系：
   *   globalCol = groupIndex * columnsPerGroup + columnIndex
   *   totalCols = groupCount * columnsPerGroup
   */
  const shiftSeats = (distance, direction = 0, colShift = 0) => {
    const { groupCount, columnsPerGroup, seatsPerColumn } = seatConfig.value
    const totalCols = groupCount * columnsPerGroup

    // 1. 拍快照：记录每个非空置座位当前的学生 ID
    const snapshot = new Map()
    for (const seat of getAvailableSeats()) {
      const globalCol = seat.groupIndex * columnsPerGroup + seat.columnIndex
      snapshot.set(`${globalCol},${seat.rowIndex}`, seat.studentId)
    }

    if (snapshot.size === 0) return

    // 2. 对每个目标座位，反向推算"谁应该坐到这里"
    for (const seat of getAvailableSeats()) {
      const globalCol = seat.groupIndex * columnsPerGroup + seat.columnIndex

      // 行方向：反推源行
      const srcRow_raw = seat.rowIndex - distance
      const overflow = Math.floor(srcRow_raw / seatsPerColumn)
      const srcRow = ((srcRow_raw % seatsPerColumn) + seatsPerColumn) % seatsPerColumn

      // 列方向：直接列偏移 + 溢出换列（两者叠加）
      //   colShift>0 表示学生向右移动，源在左侧（globalCol - colShift）
      //   overflow 部分同旧逻辑
      const srcCol = ((globalCol - colShift - overflow * direction) % totalCols + totalCols) % totalCols

      seat.studentId = snapshot.get(`${srcCol},${srcRow}`) ?? null
    }
  }

  // 更新配置
  const updateConfig = (newConfig) => {
    seatConfig.value = { ...seatConfig.value, ...newConfig }
    initializeSeats()  // 重新初始化座位
    // 清理选区中已失效的座位引用
    cleanupInvalidSeats(seats.value.map(s => s.id))
  }

  // 获取座位上的学生ID
  const getStudentAtSeat = (seatId) => {
    const seat = seatMap.get(seatId)
    return seat ? seat.studentId : null
  }

  // 查找学生所在座位
  const findSeatByStudent = (studentId) => {
    return seats.value.find(s => s.studentId === studentId)
  }

  // 清空所有座位
  const clearAllSeats = () => {
    seats.value.forEach(seat => {
      seat.studentId = null
    })
  }

  // 解析座位ID获取索引信息
  const parseSeatId = (seatId) => {
    // 格式: "seat-{groupIndex}-{columnIndex}-{rowIndex}"
    const parts = seatId.split('-')
    return {
      groupIndex: parseInt(parts[1]),
      columnIndex: parseInt(parts[2]),
      rowIndex: parseInt(parts[3])
    }
  }

  // 判断两个座位是否为同桌
  const areDeskmates = (seatId1, seatId2) => {
    const seat1 = parseSeatId(seatId1)
    const seat2 = parseSeatId(seatId2)
    const columnsPerGroup = Number(seatConfig.value?.columnsPerGroup || 0)

    // 列数<=1 时结构上不存在同桌位（0 也按不可同桌处理，避免无效配置误判）
    if (columnsPerGroup <= 1) return false

    // 同桌 = 同大组 且 同排(rowIndex相同) 且 不是同一列
    return (
      seat1.groupIndex === seat2.groupIndex &&
      seat1.rowIndex === seat2.rowIndex &&
      seat1.columnIndex !== seat2.columnIndex
    )
  }

  // 查找指定座位的同桌座位
  const findDeskmates = (seatId) => {
    const parsed = parseSeatId(seatId)
    const columnsPerGroup = Number(seatConfig.value?.columnsPerGroup || 0)
    if (columnsPerGroup <= 1) return []
    return seats.value.filter(seat =>
      seat.groupIndex === parsed.groupIndex &&
      seat.rowIndex === parsed.rowIndex &&
      seat.columnIndex !== parsed.columnIndex &&
      seat.id !== seatId
    )
  }

  // 获取所有可用座位(非空置)
  const getAvailableSeats = () => {
    return seats.value.filter(seat => !seat.isEmpty)
  }

  // 获取所有空座位(无学生且非空置)
  const getEmptySeats = () => {
    return seats.value.filter(seat => !seat.isEmpty && seat.studentId === null)
  }

  // ==================== 座位距离与相邻性 ====================

  /**
   * 计算两个座位之间的曼哈顿距离
   * @param {string} seatId1 - 座位1的ID
   * @param {string} seatId2 - 座位2的ID
   * @returns {number} 距离值，不同大组返回Infinity
   */
  const getSeatDistance = (seatId1, seatId2) => {
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
  const getAdjacentSeats = (seatId, maxDistance = 1) => {
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
  const validateRepulsion = (seatId1, seatId2, minDistance = 2) => {
    const distance = getSeatDistance(seatId1, seatId2)
    return distance >= minDistance
  }

  /**
   * 获取指定座位周围的危险区域座位（用于排斥关系）
   * @param {string} seatId - 座位ID
   * @param {number} dangerZone - 危险区域半径
   * @returns {Array} 危险区域内的座位数组
   */
  const getDangerZoneSeats = (seatId, dangerZone = 2) => {
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
   * 讲台在最下方，行数从下往上数（前排为 1=离讲台最近的排，即图形底部的排，rowIndex 最大）
   * @param {string} seatId
   * @param {number} minRow - 最小排数（含），1-indexed
   * @param {number} maxRow - 最大排数（含），1-indexed
   */
  const isInRowRange = (seatId, minRow, maxRow) => {
    const { rowIndex } = parseSeatId(seatId)
    const totalRows = seatConfig.value.seatsPerColumn
    const rowFromPodium = totalRows - rowIndex // 讲台在最下方，rowIndex 最大即第 1 排
    return rowFromPodium >= minRow && rowFromPodium <= maxRow
  }

  /**
   * 获取座位的列类型
   * - wall: 每个大组的最左或最右列（groupIndex 的两端列）
   * - aisle: 紧邻走廊的列（大组内的最外列，每组最左列和最右列）
   * - center: 既非 wall 也非 aisle 的中间列
   *
   * 简化规则：
   *   columnsPerGroup = 2 时：所有列都是 edge（wall+aisle 重合）
   *   columnsPerGroup > 2 时：
   *     columnIndex 0 或 columnsPerGroup-1 的是 aisle（紧邻走廊的组外侧）
   *     同时 groupIndex 0 的 columnIndex 0 也是 wall（最左墙）
   *     groupIndex groupCount-1 的 columnIndex columnsPerGroup-1 也是 wall（最右墙）
   */
  const getColumnType = (seatId) => {
    const { groupIndex, columnIndex } = parseSeatId(seatId)
    const { groupCount, columnsPerGroup } = seatConfig.value

    const isFirstGroup = groupIndex === 0
    const isLastGroup = groupIndex === groupCount - 1
    const isFirstCol = columnIndex === 0
    const isLastCol = columnIndex === columnsPerGroup - 1

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
  const isColumnType = (seatId, columnType) => {
    const type = getColumnType(seatId)
    if (columnType === 'edge') return type === 'wall' || type === 'aisle'
    return type === columnType
  }

  /**
   * 判断 seatId1 是否在 seatId2 的视线前方（即 seatId1 遮挡 seatId2）
   * 讲台在下方：rowIndex 越大的座位在屏幕上越靠下，离讲台越近。
   * 若 s1 遮挡 s2，则 s1 必须在 s2 前方（离讲台更近），即 s1.rowIndex 必须更大。
   * @param {string} seatId1 - 遮挡者（在前方，离讲台更近）
   * @param {string} seatId2 - 被遮挡者（在后方，离讲台更远）
   * @param {number} tolerance - 0=仅正前方; 1=正前方±1列
   */
  const isDirectlyBehind = (seatId1, seatId2, tolerance = 0) => {
    const s1 = parseSeatId(seatId1)
    const s2 = parseSeatId(seatId2)

    // 遮挡者必须在被遮挡者的前方（离讲台更近，因此 rowIndex 必须更大）
    if (s1.rowIndex <= s2.rowIndex) return false

    // 遮挡者必须在同大组
    if (s1.groupIndex !== s2.groupIndex) return false

    const colDiff = Math.abs(s1.columnIndex - s2.columnIndex)
    return colDiff <= tolerance
  }

  /**
   * 判断两个座位是否在相邻排（同大组，行差为 1）
   */
  const isAdjacentRow = (seatId1, seatId2) => {
    const s1 = parseSeatId(seatId1)
    const s2 = parseSeatId(seatId2)
    if (s1.groupIndex !== s2.groupIndex) return false
    return Math.abs(s1.rowIndex - s2.rowIndex) === 1
  }

  /**
   * 判断座位是否在指定大组范围内（1-indexed，1=最左大组）
   */
  const isInGroupRange = (seatId, minGroup, maxGroup) => {
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
  const getSeatGroup = (seatId) => parseSeatId(seatId).groupIndex + 1

  return {
    seatConfig,
    seats,
    organizedSeats,
    initializeSeats,
    assignStudent,
    toggleEmpty,
    clearSeat,
    swapSeats,
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
    getSeatGroup
  }
}
