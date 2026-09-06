import type { Seat, SeatConfig, Student, Tag, Zone } from '@/types/models'

interface LegacyMockRule {
  id: number
  type: string
  studentIds: number[]
  enabled: boolean
}

export function createMockStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: Math.floor(Math.random() * 10000),
    name: '',
    studentNumber: null,
    tags: [],
    ...overrides
  }
}

export function createMockStudents(count: number, overrides: Partial<Student> = {}): Student[] {
  return Array.from({ length: count }, (_, i) =>
    createMockStudent({
      name: `学生${i + 1}`,
      studentNumber: i + 1,
      ...overrides
    })
  )
}

export function createMockSeat(overrides: Partial<Seat> = {}): Seat {
  return {
    id: `seat-0-0-0`,
    groupIndex: 0,
    columnIndex: 0,
    rowIndex: 0,
    studentId: null,
    isEmpty: false,
    ...overrides
  }
}

export function createMockSeats(groupCount: number, columnsPerGroup: number, seatsPerColumn: number): Seat[] {
  const seats: Seat[] = []
  for (let g = 0; g < groupCount; g++) {
    for (let c = 0; c < columnsPerGroup; c++) {
      for (let r = 0; r < seatsPerColumn; r++) {
        seats.push(createMockSeat({
          id: `seat-${g}-${c}-${r}`,
          groupIndex: g,
          columnIndex: c,
          rowIndex: r
        }))
      }
    }
  }
  return seats
}

export function createMockTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: Math.floor(Math.random() * 10000),
    name: '',
    color: '#23587b',
    showInSeatChart: true,
    ...overrides
  }
}

export function createMockZone(overrides: Partial<Zone> = {}): Zone {
  return {
    id: Math.floor(Math.random() * 10000),
    name: '',
    tagIds: [],
    seatIds: [],
    visible: true,
    ...overrides
  }
}

export function createMockRule(overrides: Partial<LegacyMockRule> = {}): LegacyMockRule {
  return {
    id: Math.floor(Math.random() * 10000),
    type: 'attract',
    studentIds: [],
    enabled: true,
    ...overrides
  }
}

export function createMockSeatConfig(overrides: Partial<SeatConfig> = {}): SeatConfig {
  return {
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
    ...overrides
  }
}

export function findSeatById(seats: Seat[], seatId: string) {
  return seats.find(seat => seat.id === seatId)
}

export function assignStudentToSeat(seats: Seat[], seatId: string, studentId: number) {
  const seat = findSeatById(seats, seatId)
  if (seat) {
    seat.studentId = studentId
  }
  return seat
}

export function clearSeat(seats: Seat[], seatId: string) {
  const seat = findSeatById(seats, seatId)
  if (seat) {
    seat.studentId = null
  }
  return seat
}

export function getOccupiedSeats(seats: Seat[]) {
  return seats.filter(s => s.studentId !== null)
}

export function getEmptySeats(seats: Seat[]) {
  return seats.filter(s => s.studentId === null && !s.isEmpty)
}

export function getDisabledSeats(seats: Seat[]) {
  return seats.filter(s => s.isEmpty)
}
