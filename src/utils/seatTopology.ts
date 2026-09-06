import type { Seat, SeatConfig, SeatPosition } from '@/types/models'

export const minDeskmateColumnDistance = 1
export const maxDeskmateColumnDistance = 2

type SeatPositionLike = Pick<SeatPosition, 'groupIndex' | 'columnIndex' | 'rowIndex'>
type TopologySeat = Pick<Seat, 'id' | 'groupIndex' | 'columnIndex' | 'rowIndex'> &
  Partial<Pick<Seat, 'kind'>>

const normalizeDimension = (value: unknown, fallback: unknown): number => {
  const candidate = Number(value)
  if (Number.isInteger(candidate) && candidate > 0) return candidate
  const normalizedFallback = Number(fallback)
  return Number.isInteger(normalizedFallback) && normalizedFallback > 0 ? normalizedFallback : 0
}

const isValidIndex = (value: number, upperBound: number): boolean => (
  Number.isInteger(value) && value >= 0 && value < upperBound
)

export const getGroupShape = (config: SeatConfig, groupIndex: number) => {
  const group = config.groups?.[groupIndex]
  return {
    columns: normalizeDimension(group?.columns, config.columnsPerGroup),
    rows: normalizeDimension(group?.rows, config.seatsPerColumn)
  }
}

export const getRowNumberFromPodium = (
  position: SeatPositionLike,
  config: SeatConfig
): number | null => {
  const { rows } = getGroupShape(config, position.groupIndex)
  if (!isValidIndex(position.rowIndex, rows)) return null
  return config.podiumPosition === 'top'
    ? position.rowIndex + 1
    : rows - position.rowIndex
}

export const isPositionInRowRange = (
  position: SeatPositionLike,
  config: SeatConfig,
  minRow: number,
  maxRow: number
): boolean => {
  const rowNumber = getRowNumberFromPodium(position, config)
  return rowNumber !== null && rowNumber >= minRow && rowNumber <= maxRow
}

export const getSeatDepthRatio = (
  position: SeatPositionLike,
  config: SeatConfig
): number | null => {
  const { rows } = getGroupShape(config, position.groupIndex)
  if (!isValidIndex(position.rowIndex, rows)) return null
  if (rows <= 1) return 0

  const frontZeroIndex = config.podiumPosition === 'top'
    ? position.rowIndex
    : rows - 1 - position.rowIndex
  return frontZeroIndex / (rows - 1)
}

export const areSeatPositionsDeskmates = (
  first: SeatPositionLike,
  second: SeatPositionLike,
  config: SeatConfig
): boolean => {
  if (first.groupIndex !== second.groupIndex) return false
  const { columns, rows } = getGroupShape(config, first.groupIndex)
  if (columns <= 1) return false
  if (
    !isValidIndex(first.columnIndex, columns) ||
    !isValidIndex(second.columnIndex, columns) ||
    !isValidIndex(first.rowIndex, rows) ||
    !isValidIndex(second.rowIndex, rows)
  ) {
    return false
  }

  const columnDistance = Math.abs(first.columnIndex - second.columnIndex)
  return first.rowIndex === second.rowIndex &&
    columnDistance >= minDeskmateColumnDistance &&
    columnDistance <= maxDeskmateColumnDistance
}

export const buildDeskmateAdjacency = (
  seats: readonly TopologySeat[],
  config: SeatConfig
): Map<string, Set<string>> => {
  const adjacency = new Map<string, Set<string>>()
  const seatByCoordinate = new Map<string, TopologySeat>()

  for (const seat of seats) {
    if (seat.kind === 'guard') continue
    const { columns, rows } = getGroupShape(config, seat.groupIndex)
    if (!isValidIndex(seat.columnIndex, columns) || !isValidIndex(seat.rowIndex, rows)) continue
    adjacency.set(seat.id, new Set())
    seatByCoordinate.set(`${seat.groupIndex}:${seat.columnIndex}:${seat.rowIndex}`, seat)
  }

  for (const seat of seatByCoordinate.values()) {
    for (
      let distance = minDeskmateColumnDistance;
      distance <= maxDeskmateColumnDistance;
      distance++
    ) {
      const mate = seatByCoordinate.get(
        `${seat.groupIndex}:${seat.columnIndex + distance}:${seat.rowIndex}`
      )
      if (!mate || !areSeatPositionsDeskmates(seat, mate, config)) continue
      adjacency.get(seat.id)?.add(mate.id)
      adjacency.get(mate.id)?.add(seat.id)
    }
  }

  return adjacency
}
