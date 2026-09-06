import { ref } from 'vue'
import { generateGuardSeatId, generateSeatId, isGuardSeatId } from '@/utils/seatHelpers'
import type { GuardSeatsConfig, Seat, SeatConfig } from '@/types/models'

export type SeatStateUpdate = Partial<Pick<Seat, 'studentId' | 'isEmpty'>>
export type BatchSeatUpdate = SeatStateUpdate & { seatId: string }

export interface SeatSnapshotEntry {
  id: string
  studentId: number | null
  isEmpty: boolean
}

export const defaultGuardSeatsConfig: GuardSeatsConfig = {
  enabled: true,
  leftEnabled: true,
  rightEnabled: true,
  includeInAutoAssignment: false,
  hideEmptyOnExport: true
}

const createDefaultSeatConfig = (): SeatConfig => ({
  groupCount: 4,
  columnsPerGroup: 2,
  seatsPerColumn: 7,
  groups: [
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 }
  ],
  shiftDistance: 4,
  podiumPosition: 'bottom',
  guardSeats: { ...defaultGuardSeatsConfig }
})

const createDefaultSeats = (config: SeatConfig): Seat[] => {
  const nextSeats: Seat[] = []
  for (let groupIndex = 0; groupIndex < config.groupCount; groupIndex++) {
    const group = config.groups[groupIndex] ?? {
      columns: config.columnsPerGroup,
      rows: config.seatsPerColumn
    }
    for (let columnIndex = 0; columnIndex < group.columns; columnIndex++) {
      for (let rowIndex = 0; rowIndex < group.rows; rowIndex++) {
        nextSeats.push({
          id: generateSeatId(groupIndex, columnIndex, rowIndex),
          groupIndex,
          columnIndex,
          rowIndex,
          studentId: null,
          isEmpty: false,
          kind: 'regular'
        })
      }
    }
  }
  nextSeats.push(
    {
      id: generateGuardSeatId('left'),
      groupIndex: -1,
      columnIndex: -1,
      rowIndex: -1,
      studentId: null,
      isEmpty: false,
      kind: 'guard',
      guardSide: 'left'
    },
    {
      id: generateGuardSeatId('right'),
      groupIndex: -1,
      columnIndex: 1,
      rowIndex: -1,
      studentId: null,
      isEmpty: false,
      kind: 'guard',
      guardSide: 'right'
    }
  )
  return nextSeats
}

export const seatConfig = ref<SeatConfig>(createDefaultSeatConfig())
export const seats = ref<Seat[]>(createDefaultSeats(seatConfig.value))

let seatMap = new Map<string, Seat>()

export const rebuildSeatMap = () => {
  const nextMap = new Map<string, Seat>()
  for (const seat of seats.value) nextMap.set(seat.id, seat)
  seatMap = nextMap
}

rebuildSeatMap()

const cloneSeatWithValidState = (seat: Seat): Seat => ({
  ...seat,
  studentId: seat.isEmpty ? null : seat.studentId
})

export const getSeatRaw = (seatId: string) => seatMap.get(seatId) ?? null
export const hasSeatRaw = (seatId: string) => seatMap.has(seatId)

const hasSynchronizedSeatMap = () => (
  seatMap.size === seats.value.length &&
  seats.value.every(seat => seatMap.get(seat.id) === seat)
)

const hasUniqueAssignedStudents = (states: Iterable<Pick<Seat, 'studentId'>>) => {
  const assignedStudentIds = new Set<number>()
  for (const state of states) {
    if (state.studentId === null) continue
    if (assignedStudentIds.has(state.studentId)) return false
    assignedStudentIds.add(state.studentId)
  }
  return true
}

export const replaceSeatsRaw = (nextSeats: Seat[]) => {
  seats.value = nextSeats.map(cloneSeatWithValidState)
  rebuildSeatMap()
}

export const replaceSeatChartStateRaw = (nextConfig: SeatConfig, nextSeats: Seat[]) => {
  seatConfig.value = {
    ...nextConfig,
    groups: nextConfig.groups.map(group => ({ ...group })),
    guardSeats: nextConfig.guardSeats
      ? { ...nextConfig.guardSeats }
      : { ...defaultGuardSeatsConfig }
  }
  replaceSeatsRaw(nextSeats)
}

const applySeatStateToSeatRaw = (seat: Seat, updates: SeatStateUpdate) => {
  Object.assign(seat, updates)
  if (seat.isEmpty) seat.studentId = null
}

export const updateSeatStateRaw = (seatId: string, updates: SeatStateUpdate) => {
  const seat = seatMap.get(seatId)
  if (!seat) return false

  const willBeEmpty = updates.isEmpty ?? seat.isEmpty
  if (
    !willBeEmpty &&
    updates.studentId !== undefined &&
    updates.studentId !== null &&
    updates.studentId !== seat.studentId
  ) {
    for (const candidate of seats.value) {
      if (candidate.studentId === updates.studentId && candidate.id !== seatId) {
        candidate.studentId = null
      }
    }
  }

  applySeatStateToSeatRaw(seat, updates)
  return true
}

export const batchUpdateSeatsRaw = (updates: BatchSeatUpdate[]) => {
  if (!hasSynchronizedSeatMap()) return false

  const finalStateBySeatId = new Map(seats.value.map(seat => [seat.id, {
    studentId: seat.studentId,
    isEmpty: seat.isEmpty
  }]))
  const stagedSeatIds = new Set<string>()

  for (const { seatId, ...changes } of updates) {
    const current = finalStateBySeatId.get(seatId)
    if (!current || stagedSeatIds.has(seatId)) return false

    const isEmpty = changes.isEmpty ?? current.isEmpty
    const studentId = isEmpty
      ? null
      : changes.studentId !== undefined
        ? changes.studentId
        : current.studentId
    finalStateBySeatId.set(seatId, { isEmpty, studentId })
    stagedSeatIds.add(seatId)
  }

  if (!hasUniqueAssignedStudents(finalStateBySeatId.values())) return false

  const stagedUpdates: Array<{ seat: Seat; studentId: number | null; isEmpty: boolean }> = []
  for (const seatId of stagedSeatIds) {
    const seat = seatMap.get(seatId)
    const nextState = finalStateBySeatId.get(seatId)
    if (!seat || !nextState) return false
    stagedUpdates.push({ seat, ...nextState })
  }
  for (const update of stagedUpdates) {
    update.seat.isEmpty = update.isEmpty
    update.seat.studentId = update.studentId
  }
  return true
}

export const assignStudentRaw = (seatId: string, studentId: number) => {
  const seat = seatMap.get(seatId)
  if (!seat || seat.isEmpty) return false

  for (const candidate of seats.value) {
    if (candidate.studentId === studentId && candidate.id !== seatId) {
      candidate.studentId = null
    }
  }
  seat.studentId = studentId
  return true
}

export const clearSeatRaw = (seatId: string) => {
  const seat = seatMap.get(seatId)
  if (!seat) return false
  seat.studentId = null
  return true
}

export const swapSeatsRaw = (seatId1: string, seatId2: string) => {
  const seat1 = seatMap.get(seatId1)
  const seat2 = seatMap.get(seatId2)
  if (!seat1 || !seat2 || seat1.isEmpty || seat2.isEmpty || seatId1 === seatId2) return false

  const studentId = seat1.studentId
  seat1.studentId = seat2.studentId
  seat2.studentId = studentId
  return true
}

export const toggleEmptyRaw = (seatId: string) => {
  const seat = seatMap.get(seatId)
  if (!seat || seat.kind === 'guard' || isGuardSeatId(seat.id)) return false

  seat.isEmpty = !seat.isEmpty
  if (seat.isEmpty) seat.studentId = null
  return true
}

export const clearAllSeatsRaw = () => {
  for (const seat of seats.value) seat.studentId = null
}

export const createSeatSnapshot = (): SeatSnapshotEntry[] => {
  return seats.value.map(seat => ({
    id: seat.id,
    studentId: seat.studentId,
    isEmpty: seat.isEmpty
  }))
}

export const restoreSeatSnapshotRaw = (snapshot: SeatSnapshotEntry[]) => {
  if (!hasSynchronizedSeatMap() || snapshot.length !== seats.value.length) return false

  const snapshotBySeatId = new Map<string, SeatSnapshotEntry>()
  for (const data of snapshot) {
    if (
      snapshotBySeatId.has(data.id) ||
      !seatMap.has(data.id) ||
      data.isEmpty && data.studentId !== null
    ) return false
    snapshotBySeatId.set(data.id, data)
  }
  if (
    seats.value.some(seat => !snapshotBySeatId.has(seat.id)) ||
    !hasUniqueAssignedStudents(snapshotBySeatId.values())
  ) return false

  const stagedSnapshot: Array<{ seat: Seat; data: SeatSnapshotEntry }> = []
  for (const seat of seats.value) {
    const data = snapshotBySeatId.get(seat.id)
    if (!data) return false
    stagedSnapshot.push({ seat, data })
  }
  for (const { seat, data } of stagedSnapshot) {
    seat.isEmpty = data.isEmpty
    seat.studentId = data.studentId
  }
  return true
}
