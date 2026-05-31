type PodiumPosition = 'top' | 'bottom'

interface ExportFlips {
  flipHorizontal: boolean
  flipVertical: boolean
}

interface SeatColumn<TSeat = unknown> {
  columnIndex: number
  seats: TSeat[]
}

interface SeatGroup<TSeat = unknown> {
  groupIndex: number
  columns: SeatColumn<TSeat>[]
}

const toBoolean = (value: unknown): boolean => value === true

export function normalizePodiumPosition(value: unknown): PodiumPosition {
  return value === 'top' ? 'top' : 'bottom'
}

export function getExportFlips(source: Record<string, unknown> = {}): ExportFlips {
  return {
    flipHorizontal: toBoolean(source.flipHorizontal),
    flipVertical: toBoolean(source.flipVertical)
  }
}

export function getOrderedIndices(count: number, shouldReverse: boolean): number[] {
  const indices = Array.from({ length: Math.max(0, count) }, (_, index) => index)
  return shouldReverse ? indices.reverse() : indices
}

export function getSourceRowIndex(visualRowIndex: number, rowCount: number, flipVertical: boolean): number {
  return flipVertical ? rowCount - 1 - visualRowIndex : visualRowIndex
}

export function getRowNumber(rowIndex: number, rowCount: number, podiumPosition: unknown): number {
  return normalizePodiumPosition(podiumPosition) === 'top'
    ? rowIndex + 1
    : rowCount - rowIndex
}

export function getVisualRowNumber(
  visualRowIndex: number,
  rowCount: number,
  podiumPosition: unknown,
  flipVertical: boolean
): number {
  return getRowNumber(getSourceRowIndex(visualRowIndex, rowCount, flipVertical), rowCount, podiumPosition)
}

export function createOrderedSeatGroups<TSeat>(
  organizedSeats: TSeat[][][],
  flips: ExportFlips
): SeatGroup<TSeat>[] {
  const groupIndices = getOrderedIndices(organizedSeats.length, flips.flipHorizontal)

  return groupIndices.map(groupIndex => {
    const group = organizedSeats[groupIndex] || []
    const columnIndices = getOrderedIndices(group.length, flips.flipHorizontal)

    return {
      groupIndex,
      columns: columnIndices.map(columnIndex => {
        const seats = group[columnIndex] || []
        return {
          columnIndex,
          seats: flips.flipVertical ? [...seats].reverse() : seats
        }
      })
    }
  })
}
