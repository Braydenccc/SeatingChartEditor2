import { ref, computed } from 'vue'
import { useZoneData } from './useZoneData'

// 座位表配置
const seatConfig = ref({
  groupCount: 4,        // 大组数量
  columnsPerGroup: 2,   // 每大组的列数（默认值，向后兼容）
  seatsPerColumn: 7,     // 每列的座位数（默认值，向后兼容）
  // 每大组的独立配置
  groups: [
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 }
  ],
  shiftDistance: 4,
  podiumPosition: 'bottom',   // 讲台位置：'top'（顶部）或 'bottom'（底部）
  seatAlignment: 'bottom'      // 座位对齐方式：'top'（对齐顶部/后排）或 'bottom'（对齐底部/前排）
})

// 座位数据
const seats = ref([])

// 座位查找索引 (id -> seat object)，O(1) 查找替代 .find()
let seatMap = new Map()

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
function getGroupConfig(groupIndex) {
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

// 生成座位ID
function generateSeatId(groupIndex, columnIndex, rowIndex) {
  return `seat-${groupIndex}-${columnIndex}-${rowIndex}`
}

// 从 seats.value（响应式代理）重建索引，确保 Map 持有代理对象
function rebuildSeatMap() {
  const newMap = new Map()
  for (const seat of seats.value) {
    newMap.set(seat.id, seat)
  }
  seatMap = newMap
}

// 初始化座位表
function initializeSeats() {
  const newSeats = []
  const { groupCount } = seatConfig.value
  ensureGroupsArray()

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
          isEmpty: false
        })
      }
    }
  }

  seats.value = newSeats
  rebuildSeatMap()
}

// 立即初始化座位数据，避免第一次加载时空白
initializeSeats()

// 按组和列组织座位数据（用于渲染）— 单遍分桶，O(n)
const organizedSeats = computed(() => {
  const { groupCount } = seatConfig.value
  ensureGroupsArray()
  
  // 预分配结构，根据每大组的列数
  const groups = Array.from({ length: groupCount }, (_, g) => {
    const groupConfig = getGroupConfig(g)
    return Array.from({ length: groupConfig.columns }, () => [])
  })

  // 单次遍历分桶
  for (const seat of seats.value) {
    if (groups[seat.groupIndex] && groups[seat.groupIndex][seat.columnIndex]) {
      groups[seat.groupIndex][seat.columnIndex].push(seat)
    }
  }

  // 每个桶按 rowIndex 排序，并根据 alignment 决定顺序
  for (const group of groups) {
    for (const col of group) {
      col.sort((a, b) => a.rowIndex - b.rowIndex)
      
      // 如果对齐顶部，保持原样（rowIndex 0 在最上面）
      // 如果对齐底部，保持原样（rowIndex 0 在最上面，rowIndex 大的在下面）
      // 这里的顺序不需要改变，因为渲染时顺序已经是从上到下
      // 视觉上的对齐通过 CSS 和 rowIndex 的含义来体现
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

  // 批量移动选区学生（以拖拽起始座位为锚点，整体平移）
  const moveSelection = (selectedSeatIds, anchorId, targetSeatId) => {
    if (!selectedSeatIds || selectedSeatIds.length === 0) return false

    const targetSeat = seatMap.get(targetSeatId)
    if (!targetSeat) return false

    const anchorSeat = seatMap.get(anchorId)
    if (!anchorSeat) return false

    const offsetCol = toGlobalCol(targetSeat) - toGlobalCol(anchorSeat)
    const offsetRow = targetSeat.rowIndex - anchorSeat.rowIndex

    // 收集源->目标映射，以及超出边界的座位
    const moves = []
    const outOfBoundsSeats = []

    for (const sid of selectedSeatIds) {
      const src = seatMap.get(sid)
      if (!src || src.isEmpty || src.studentId === null) continue

      const newGC = toGlobalCol(src) + offsetCol
      const newR = src.rowIndex + offsetRow
      const { groupIndex: newG, columnIndex: newC } = fromGlobalCol(newGC)
      const destId = generateSeatId(newG, newC, newR)
      const dest = seatMap.get(destId)

      if (dest && !dest.isEmpty) {
        moves.push({ srcId: sid, destId, studentId: src.studentId })
      } else {
        // 目标座位不存在或为空置，记录为超出边界
        outOfBoundsSeats.push({ srcId: sid, studentId: src.studentId })
      }
    }

    if (moves.length === 0 && outOfBoundsSeats.length === 0) return false

    // 快照所有涉及座位的当前学生（原子读取）
    const snapshot = new Map()
    for (const m of moves) {
      const srcSeat = seatMap.get(m.srcId)
      const destSeat = seatMap.get(m.destId)
      if (!srcSeat || !destSeat) return false
      if (!snapshot.has(m.srcId)) snapshot.set(m.srcId, srcSeat.studentId)
      if (!snapshot.has(m.destId)) snapshot.set(m.destId, destSeat.studentId)
    }

    // 目标座位集合
    const destIdSet = new Set(moves.map(m => m.destId))

    // 计算每个座位的最终学生
    const finalState = new Map()

    // 1. 目标位置填入选区学生
    for (const m of moves) {
      finalState.set(m.destId, m.studentId)
    }

    // 2. 收集所有被挤掉的学生（目标位置原有的非选区学生）
    const displacedStudents = []
    for (const m of moves) {
      const origDestStudent = snapshot.get(m.destId)
      if (origDestStudent !== null && origDestStudent !== undefined) {
        const isMovingStudent = moves.some(mv => mv.studentId === origDestStudent)
        if (!isMovingStudent) {
          displacedStudents.push(origDestStudent)
        }
      }
    }

    // 3. 找出所有空闲的源位置（不是其他 move 的目标）
    const availableSources = []
    for (const m of moves) {
      if (!destIdSet.has(m.srcId)) {
        availableSources.push(m.srcId)
      }
    }

    // 4. 清空超出边界的源座位
    for (const { srcId } of outOfBoundsSeats) {
      finalState.set(srcId, null)
    }

    // 5. 将被挤掉的学生依次放入空闲源位置
    for (let i = 0; i < displacedStudents.length && i < availableSources.length; i++) {
      finalState.set(availableSources[i], displacedStudents[i])
    }

    // 6. 剩余的空闲源位置清空
    for (let i = displacedStudents.length; i < availableSources.length; i++) {
      finalState.set(availableSources[i], null)
    }

    // 原子性批量写入（预先验证所有座位存在）
    const updates = []
    for (const [seatId, studentId] of finalState) {
      const seat = seatMap.get(seatId)
      if (!seat) return false
      updates.push({ seat, studentId })
    }

    // 执行批量更新
    for (const { seat, studentId } of updates) {
      seat.studentId = studentId
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
    ensureGroupsArray()
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
    
    // 必须同大组
    if (seat1.groupIndex !== seat2.groupIndex) return false
    
    const groupConfig = getGroupConfig(seat1.groupIndex)
    const columnsInGroup = groupConfig.columns

    // 列数<=1 时结构上不存在同桌位（0 也按不可同桌处理，避免无效配置误判）
    if (columnsInGroup <= 1) return false

    // 同桌 = 同大组 且 同排(rowIndex相同) 且 不是同一列
    return (
      seat1.rowIndex === seat2.rowIndex &&
      seat1.columnIndex !== seat2.columnIndex
    )
  }

  // 查找指定座位的同桌座位
  const findDeskmates = (seatId) => {
    const parsed = parseSeatId(seatId)
    const groupConfig = getGroupConfig(parsed.groupIndex)
    const columnsInGroup = groupConfig.columns
    if (columnsInGroup <= 1) return []
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
   * 根据 alignment 配置决定计数方向：
   * - 'bottom': 讲台在最下方，从下往上数（前排为 1，离讲台最近）
   * - 'top': 对齐顶部/后排，从上往下数（后排为 1，离讲台最远）
   * @param {string} seatId
   * @param {number} minRow - 最小排数（含），1-indexed
   * @param {number} maxRow - 最大排数（含），1-indexed
   */
  const isInRowRange = (seatId, minRow, maxRow) => {
    const { rowIndex, groupIndex } = parseSeatId(seatId)
    const groupConfig = getGroupConfig(groupIndex)
    const totalRows = groupConfig.rows
    const { seatAlignment } = seatConfig.value
    
    let normalizedRow
    if (seatAlignment === 'top') {
      // 对齐顶部/后排：从上往下数，rowIndex 0 为第 1 排（后排）
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
  const getColumnType = (seatId) => {
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
  const isColumnType = (seatId, columnType) => {
    const type = getColumnType(seatId)
    if (columnType === 'edge') return type === 'wall' || type === 'aisle'
    return type === columnType
  }

  /**
   * 判断 seatId1 是否在 seatId2 的视线前方（即 seatId1 遮挡 seatId2）
   * 根据 alignment 配置决定"前方"的方向：
   * - 'bottom': 讲台在下方，rowIndex 越大越靠前（离讲台近）
   * - 'top': 对齐顶部，rowIndex 越小越靠前（离讲台远但在顶部）
   * @param {string} seatId1 - 遮挡者（在前方）
   * @param {string} seatId2 - 被遮挡者（在后方）
   * @param {number} tolerance - 0=仅正前方; 1=正前方±1列
   */
  const isDirectlyBehind = (seatId1, seatId2, tolerance = 0) => {
    const s1 = parseSeatId(seatId1)
    const s2 = parseSeatId(seatId2)
    const { seatAlignment } = seatConfig.value

    // 遮挡者必须在同大组
    if (s1.groupIndex !== s2.groupIndex) return false

    // 根据对齐方式判断谁在前方
    let isInFront
    if (seatAlignment === 'top') {
      // 对齐顶部：rowIndex 越小越靠前（顶部）
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

  const hasSeat = (seatId) => seatMap.has(seatId)
  const getSeat = (seatId) => seatMap.get(seatId) ?? null

  // 全局列坐标转换工具
  const toGlobalCol = (seat) => seat.groupIndex * seatConfig.value.columnsPerGroup + seat.columnIndex
  const fromGlobalCol = (gc) => ({
    groupIndex: Math.floor(gc / seatConfig.value.columnsPerGroup),
    columnIndex: gc % seatConfig.value.columnsPerGroup
  })

  return {
    seatConfig,
    seats,
    organizedSeats,
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
    toGlobalCol,
    fromGlobalCol
  }
}
