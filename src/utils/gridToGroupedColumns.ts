import { generateSeatId } from '@/utils/seatHelpers'

export interface GridToGroupedCell {
  sourceId?: string
  x: number
  y: number
  kind: string
  studentId?: number | null
  groupId?: string | number | null
  groupName?: string
}

export interface GridGroupedSeat {
  id: string
  kind: 'regular'
  group: number
  col: number
  row: number
  studentId: number | null
  empty: boolean
}

export interface GridToGroupedResult {
  seatConfig: {
    groupCount: number
    columnsPerGroup: number
    seatsPerColumn: number
    groups: Array<{ columns: number; rows: number }>
  }
  seats: GridGroupedSeat[]
  seatMap: Map<string, GridGroupedSeat>
  sourceIdToSeatId: Map<string, string>
  metrics: {
    usedExplicitGroups: boolean
    explicitGroupCount: number
    inferredGroupCount: number
    collapsedSeparatorColumns: number
    markerCells: number
    filledEmptyCells: number
    explicitGroupsOverlapped: boolean
    explicitGroupsIncomplete: boolean
  }
}

interface ColumnRange {
  start: number
  end: number
  key?: string
  name?: string
}

const isSeatCell = (cell: GridToGroupedCell): boolean => cell.kind === 'seat'

const normalizeGroupKey = (value: unknown): string => {
  const text = String(value ?? '').trim()
  return text
}

const rangeContains = (range: ColumnRange, x: number): boolean => x >= range.start && x <= range.end

const getExplicitColumnRanges = (cells: GridToGroupedCell[]): {
  ranges: ColumnRange[]
  incomplete: boolean
  overlapped: boolean
} => {
  const seatCells = cells.filter(isSeatCell)
  const groupedSeatCells = seatCells.filter(cell => normalizeGroupKey(cell.groupId))
  const incomplete = groupedSeatCells.length !== seatCells.length
  if (incomplete || groupedSeatCells.length === 0) {
    return { ranges: [], incomplete, overlapped: false }
  }

  const rangeByGroup = new Map<string, ColumnRange>()
  groupedSeatCells.forEach(cell => {
    const key = normalizeGroupKey(cell.groupId)
    const existing = rangeByGroup.get(key)
    if (existing) {
      existing.start = Math.min(existing.start, cell.x)
      existing.end = Math.max(existing.end, cell.x)
      if (!existing.name && cell.groupName) existing.name = cell.groupName
      return
    }
    rangeByGroup.set(key, {
      key,
      name: cell.groupName,
      start: cell.x,
      end: cell.x
    })
  })

  const ranges = Array.from(rangeByGroup.values())
    .sort((a, b) => a.start - b.start || a.end - b.end || String(a.key).localeCompare(String(b.key)))
  const overlapped = ranges.some((range, index) => index > 0 && range.start <= ranges[index - 1].end)

  return {
    ranges: overlapped || ranges.length <= 1 ? [] : ranges,
    incomplete: false,
    overlapped
  }
}

const getInferredColumnRanges = (
  columns: number,
  cells: GridToGroupedCell[]
): { ranges: ColumnRange[]; separatorColumns: Set<number> } => {
  const seatColumns = new Set<number>()
  cells.forEach(cell => {
    if (isSeatCell(cell)) seatColumns.add(cell.x)
  })

  if (seatColumns.size === 0) {
    return {
      ranges: [{ start: 0, end: columns - 1 }],
      separatorColumns: new Set()
    }
  }

  const separatorColumns = new Set<number>()
  for (let x = 0; x < columns; x += 1) {
    if (seatColumns.has(x)) continue
    const hasSeatBefore = Array.from(seatColumns).some(column => column < x)
    const hasSeatAfter = Array.from(seatColumns).some(column => column > x)
    if (hasSeatBefore && hasSeatAfter) {
      separatorColumns.add(x)
    }
  }

  const ranges: ColumnRange[] = []
  let start: number | null = null
  for (let x = 0; x < columns; x += 1) {
    if (separatorColumns.has(x)) {
      if (start !== null) {
        ranges.push({ start, end: x - 1 })
        start = null
      }
      continue
    }
    if (start === null) start = x
  }
  if (start !== null) ranges.push({ start, end: columns - 1 })

  return {
    ranges: ranges.length > 0 ? ranges : [{ start: 0, end: columns - 1 }],
    separatorColumns
  }
}

export const convertGridToGroupedColumns = (
  rows: number,
  columns: number,
  cells: GridToGroupedCell[]
): GridToGroupedResult => {
  const boundedCells = cells.filter(cell => (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.y) &&
    cell.x >= 0 &&
    cell.x < columns &&
    cell.y >= 0 &&
    cell.y < rows
  ))
  const explicit = getExplicitColumnRanges(boundedCells)
  const inferred = explicit.ranges.length > 0
    ? { ranges: explicit.ranges, separatorColumns: new Set<number>() }
    : getInferredColumnRanges(columns, boundedCells)
  const ranges = inferred.ranges
  const seats: GridGroupedSeat[] = []
  const seatMap = new Map<string, GridGroupedSeat>()
  const sourceIdToSeatId = new Map<string, string>()
  let filledEmptyCells = 0

  ranges.forEach((range, groupIndex) => {
    for (let col = 0; col <= range.end - range.start; col += 1) {
      for (let row = 0; row < rows; row += 1) {
        const seat: GridGroupedSeat = {
          id: generateSeatId(groupIndex, col, row),
          kind: 'regular',
          group: groupIndex,
          col,
          row,
          studentId: null,
          empty: true
        }
        seats.push(seat)
        seatMap.set(seat.id, seat)
        filledEmptyCells += 1
      }
    }
  })

  boundedCells.forEach(cell => {
    const groupIndex = ranges.findIndex(range => rangeContains(range, cell.x))
    if (groupIndex < 0) return
    const localCol = cell.x - ranges[groupIndex].start
    const seatId = generateSeatId(groupIndex, localCol, cell.y)
    const seat = seatMap.get(seatId)
    if (!seat) return

    if (cell.sourceId) {
      sourceIdToSeatId.set(cell.sourceId, seat.id)
    }

    filledEmptyCells -= 1
    if (isSeatCell(cell)) {
      seat.empty = false
      seat.studentId = cell.studentId ?? null
    } else {
      seat.empty = true
      seat.studentId = null
    }
  })

  return {
    seatConfig: {
      groupCount: ranges.length,
      columnsPerGroup: ranges[0]?.end - ranges[0]?.start + 1 || columns,
      seatsPerColumn: rows,
      groups: ranges.map(range => ({
        columns: range.end - range.start + 1,
        rows
      }))
    },
    seats,
    seatMap,
    sourceIdToSeatId,
    metrics: {
      usedExplicitGroups: explicit.ranges.length > 0,
      explicitGroupCount: explicit.ranges.length,
      inferredGroupCount: ranges.length,
      collapsedSeparatorColumns: explicit.ranges.length > 0
        ? columns - ranges.reduce((sum, range) => sum + range.end - range.start + 1, 0)
        : inferred.separatorColumns.size,
      markerCells: boundedCells.filter(cell => !isSeatCell(cell)).length,
      filledEmptyCells,
      explicitGroupsOverlapped: explicit.overlapped,
      explicitGroupsIncomplete: explicit.incomplete
    }
  }
}
