type PodiumPosition = 'top' | 'bottom'
type GuardSide = 'left' | 'right'

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

interface CenteredPodiumLayoutOptions {
  seatTableWidth: number
  podiumWidth: number
  sideSeatWidth: number
  gap: number
  hasLeftSideSeat: boolean
  hasRightSideSeat: boolean
}

interface CenteredPodiumLayout {
  innerContentWidth: number
  seatTableLeft: number
  podiumLeft: number
  leftSideSeatLeft: number | null
  rightSideSeatLeft: number | null
}

interface ImageExportVerticalLayoutOptions {
  titleHeight: number
  seatRowCount: number
  seatHeight: number
  rowGap: number
  groupLabelHeight: number
  podiumHeight: number
  padding: number
  showPodium: boolean
  showGroupLabels: boolean
  isPodiumTop: boolean
  areGroupLabelsAboveSeats: boolean
}

interface ImageExportVerticalLayout {
  contentHeight: number
  seatStartY: number
  podiumRowY: number | null
  podiumSeatGap: number
}

const toBoolean = (value: unknown): boolean => value === true

export function normalizePodiumPosition(value: unknown): PodiumPosition {
  return value === 'top' ? 'top' : 'bottom'
}

export function getEffectivePodiumPosition(podiumPosition: unknown, flipVertical: boolean): PodiumPosition {
  const normalized = normalizePodiumPosition(podiumPosition)
  if (!flipVertical) return normalized
  return normalized === 'top' ? 'bottom' : 'top'
}

export function getGuardSideForVisualSlot(visualSide: unknown, podiumPosition: unknown): GuardSide {
  const normalizedSide = visualSide === 'right' ? 'right' : 'left'
  if (normalizePodiumPosition(podiumPosition) !== 'top') return normalizedSide
  return normalizedSide === 'left' ? 'right' : 'left'
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

export function getCenteredPodiumLayout(options: CenteredPodiumLayoutOptions): CenteredPodiumLayout {
  const {
    seatTableWidth,
    podiumWidth,
    sideSeatWidth,
    gap,
    hasLeftSideSeat,
    hasRightSideSeat
  } = options

  const leftExtension = hasLeftSideSeat ? sideSeatWidth + gap : 0
  const rightExtension = hasRightSideSeat ? sideSeatWidth + gap : 0
  const halfWidth = Math.max(
    seatTableWidth / 2,
    podiumWidth / 2 + leftExtension,
    podiumWidth / 2 + rightExtension
  )
  const centerX = halfWidth
  const podiumLeft = centerX - podiumWidth / 2

  return {
    innerContentWidth: halfWidth * 2,
    seatTableLeft: centerX - seatTableWidth / 2,
    podiumLeft,
    leftSideSeatLeft: hasLeftSideSeat ? podiumLeft - gap - sideSeatWidth : null,
    rightSideSeatLeft: hasRightSideSeat ? podiumLeft + podiumWidth + gap : null
  }
}

export function getImageExportVerticalLayout(options: ImageExportVerticalLayoutOptions): ImageExportVerticalLayout {
  const {
    titleHeight,
    seatRowCount,
    seatHeight,
    rowGap,
    groupLabelHeight,
    podiumHeight,
    padding,
    showPodium,
    showGroupLabels,
    isPodiumTop,
    areGroupLabelsAboveSeats
  } = options

  const seatBlockHeight = Math.max(0, seatRowCount) * seatHeight +
    Math.max(0, seatRowCount - 1) * rowGap
  const hasPodium = showPodium && podiumHeight > 0
  const visibleGroupLabelHeight = showGroupLabels ? groupLabelHeight : 0
  const podiumSeatGap = hasPodium ? rowGap : 0
  const contentHeight = titleHeight +
    seatBlockHeight +
    visibleGroupLabelHeight +
    podiumHeight +
    podiumSeatGap +
    2 * padding

  let seatStartY = padding + titleHeight
  if (isPodiumTop && hasPodium) {
    seatStartY += podiumHeight + podiumSeatGap
  }
  if (areGroupLabelsAboveSeats && showGroupLabels) {
    seatStartY += groupLabelHeight
  }

  return {
    contentHeight,
    seatStartY,
    podiumRowY: hasPodium
      ? (isPodiumTop ? padding + titleHeight : contentHeight - padding - podiumHeight)
      : null,
    podiumSeatGap
  }
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
