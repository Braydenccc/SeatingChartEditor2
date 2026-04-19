export const createMockStudent = (overrides = {}) => ({
  id: 1,
  name: '张三',
  studentNumber: 1,
  tags: [],
  ...overrides
})

export const createMockStudents = (count = 5) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `学生${i + 1}`,
    studentNumber: i + 1,
    tags: []
  }))
}

export const createMockSeat = (overrides = {}) => ({
  id: 'seat-0-0-0',
  groupIndex: 0,
  columnIndex: 0,
  rowIndex: 0,
  studentId: null,
  isEmpty: false,
  ...overrides
})

export const createMockSeats = (groupCount = 4, columnsPerGroup = 2, seatsPerColumn = 7) => {
  const seats = []
  for (let g = 0; g < groupCount; g++) {
    for (let c = 0; c < columnsPerGroup; c++) {
      for (let r = 0; r < seatsPerColumn; r++) {
        seats.push({
          id: `seat-${g}-${c}-${r}`,
          groupIndex: g,
          columnIndex: c,
          rowIndex: r,
          studentId: null,
          isEmpty: false
        })
      }
    }
  }
  return seats
}

export const createMockTag = (overrides = {}) => ({
  id: 1,
  name: '男生',
  color: '#3b82f6',
  showInSeatChart: true,
  ...overrides
})

export const createMockTags = () => [
  { id: 1, name: '男生', color: '#3b82f6', showInSeatChart: true },
  { id: 2, name: '女生', color: '#ec4899', showInSeatChart: true },
  { id: 3, name: '班干部', color: '#f59e0b', showInSeatChart: true }
]

export const createMockRule = (overrides = {}) => ({
  id: 'rule-1',
  priority: 'required',
  predicate: 'MUST_BE_SEATMATES',
  subjects: [
    { type: 'person', id: 1 },
    { type: 'person', id: 2 }
  ],
  params: {},
  enabled: true,
  ...overrides
})

export const createMockSeatConfig = (overrides = {}) => ({
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
  seatAlignment: 'bottom',
  ...overrides
})
