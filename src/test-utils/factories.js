export function createMockStudent(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    name: '',
    studentNumber: null,
    tags: [],
    ...overrides
  }
}

export function createMockStudents(count, overrides = {}) {
  return Array.from({ length: count }, (_, i) =>
    createMockStudent({
      name: `学生${i + 1}`,
      studentNumber: i + 1,
      ...overrides
    })
  )
}

export function createMockSeat(overrides = {}) {
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

export function createMockSeats(groupCount, columnsPerGroup, seatsPerColumn) {
  const seats = []
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

export function createMockTag(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    name: '',
    color: '#23587b',
    ...overrides
  }
}

export function createMockZone(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    name: '',
    seatIds: [],
    ...overrides
  }
}

export function createMockRule(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    type: 'attract',
    studentIds: [],
    enabled: true,
    ...overrides
  }
}

export function createMockSeatConfig(overrides = {}) {
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
    ...overrides
  }
}


export function assignStudentToSeat(seats, seatId, studentId) {
  const seat = findSeatById(seats, seatId)
  if (seat) {
    seat.studentId = studentId
  }
  return seat
}

export function clearSeat(seats, seatId) {
  const seat = findSeatById(seats, seatId)
  if (seat) {
    seat.studentId = null
  }
  return seat
}

export function getOccupiedSeats(seats) {
  return seats.filter(s => s.studentId !== null)
}

export function getEmptySeats(seats) {
  return seats.filter(s => s.studentId === null && !s.isEmpty)
}

export function getDisabledSeats(seats) {
  return seats.filter(s => s.isEmpty)
}
