/**
 * 解析座位 ID 获取索引信息
 * @param {string} seatId - 格式: "seat-{groupIndex}-{columnIndex}-{rowIndex}"
 * @returns {{groupIndex: number, columnIndex: number, rowIndex: number}}
 */
export function parseSeatId(seatId) {
  const parts = seatId.split('-')
  return {
    groupIndex: parseInt(parts[1]),
    columnIndex: parseInt(parts[2]),
    rowIndex: parseInt(parts[3])
  }
}

/**
 * 生成座位 ID
 * @param {number} groupIndex - 分组索引
 * @param {number} columnIndex - 列索引
 * @param {number} rowIndex - 行索引
 * @returns {string} 格式: "seat-{groupIndex}-{columnIndex}-{rowIndex}"
 */
export function generateSeatId(groupIndex, columnIndex, rowIndex) {
  return `seat-${groupIndex}-${columnIndex}-${rowIndex}`
}

export const GUARD_SEAT_LEFT_ID = 'guard-left'
export const GUARD_SEAT_RIGHT_ID = 'guard-right'

export function generateGuardSeatId(side) {
  return side === 'right' ? GUARD_SEAT_RIGHT_ID : GUARD_SEAT_LEFT_ID
}

export function isGuardSeatId(seatId) {
  return seatId === GUARD_SEAT_LEFT_ID || seatId === GUARD_SEAT_RIGHT_ID
}
