import { ref, computed } from 'vue'
import { useZoneData } from './useZoneData'

// 座位表配置
const seatConfig = ref({
  groupCount: 4,        // 大组数量
  columnsPerGroup: 2,   // 每大组的列数
  seatsPerColumn: 7     // 每列的座位数
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

  // 更新配置
  const updateConfig = (newConfig) => {
    seatConfig.value = { ...seatConfig.value, ...newConfig }
    initializeSeats()  // 重新初始化座位
    // 清理选区中已失效的座位引用
    const { cleanupInvalidSeats } = useZoneData()
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

    // 同桌 = 同大组 且 同排(rowIndex相同)
    return seat1.groupIndex === seat2.groupIndex && seat1.rowIndex === seat2.rowIndex
  }

  // 查找指定座位的同桌座位
  const findDeskmates = (seatId) => {
    const parsed = parseSeatId(seatId)
    return seats.value.filter(seat =>
      seat.groupIndex === parsed.groupIndex &&
      seat.rowIndex === parsed.rowIndex &&
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

  return {
    seatConfig,
    seats,
    organizedSeats,
    initializeSeats,
    assignStudent,
    toggleEmpty,
    clearSeat,
    swapSeats,
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
    getDangerZoneSeats
  }
}
