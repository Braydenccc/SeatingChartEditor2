import { describe, expect, it } from 'vitest'
import { useExcelData } from '../useExcelData'

const createSeatConfig = (guardSeats = {}) => ({
  groupCount: 1,
  columnsPerGroup: 1,
  seatsPerColumn: 1,
  groups: [{ columns: 1, rows: 1 }],
  shiftDistance: 4,
  podiumPosition: 'bottom',
  guardSeats: {
    enabled: true,
    leftEnabled: true,
    rightEnabled: true,
    includeInAutoAssignment: false,
    hideEmptyOnExport: true,
    ...guardSeats
  }
})

const createWideSeatConfig = (guardSeats = {}) => ({
  ...createSeatConfig(guardSeats),
  columnsPerGroup: 4,
  groups: [{ columns: 4, rows: 1 }]
})

const createTopWideSeatConfig = (guardSeats = {}) => ({
  ...createWideSeatConfig(guardSeats),
  podiumPosition: 'top'
})

const createSeats = (columns = 1) => [
  Array.from({ length: columns }, (_, columnIndex) => [{
    id: `seat-0-${columnIndex}-0`,
    groupIndex: 0,
    columnIndex,
    rowIndex: 0,
    studentId: null,
    isEmpty: false
  }])
]

const baseOptions = {
  layout: {
    showTitle: false,
    showGroupLabels: false,
    showRowNumbers: false,
    showStudentId: false,
    showPodium: true,
    showGroupGap: false,
    flipHorizontal: false,
    flipVertical: false
  },
  content: {
    title: '座位表',
    cellFormat: '%n'
  }
}

describe('useExcelData guard seats', () => {
  it('should hide empty guard seats by default', async () => {
    const { generateSeatChartWorkbook } = useExcelData()
    const result = await generateSeatChartWorkbook(
      createSeats(),
      [],
      [],
      createSeatConfig(),
      {
        ...baseOptions,
        guardSeats: [
          { id: 'guard-left', kind: 'guard', guardSide: 'left', studentId: null, isEmpty: false },
          { id: 'guard-right', kind: 'guard', guardSide: 'right', studentId: null, isEmpty: false }
        ]
      }
    )

    expect(result.maxCol).toBe(0)
  })

  it('should render occupied guard seats even when empty guards are hidden', async () => {
    const { generateSeatChartWorkbook } = useExcelData()
    const result = await generateSeatChartWorkbook(
      createSeats(),
      [{ id: 1, name: 'Ada', studentNumber: null, tags: [] }],
      [],
      createSeatConfig(),
      {
        ...baseOptions,
        guardSeats: [
          { id: 'guard-left', kind: 'guard', guardSide: 'left', studentId: 1, isEmpty: false },
          { id: 'guard-right', kind: 'guard', guardSide: 'right', studentId: null, isEmpty: false }
        ]
      }
    )

    expect(result.maxCol).toBe(2)
    expect(Object.values(result.ws).some(cell => cell?.v === 'Ada')).toBe(true)
  })

  it('should render empty guard seats when export hiding is disabled', async () => {
    const { generateSeatChartWorkbook } = useExcelData()
    const result = await generateSeatChartWorkbook(
      createSeats(),
      [],
      [],
      createSeatConfig({ hideEmptyOnExport: false }),
      {
        ...baseOptions,
        guardSeats: [
          { id: 'guard-left', kind: 'guard', guardSide: 'left', studentId: null, isEmpty: false },
          { id: 'guard-right', kind: 'guard', guardSide: 'right', studentId: null, isEmpty: false }
        ]
      }
    )

    expect(result.maxCol).toBe(2)
  })

  it('should shorten the podium instead of adding blank side columns when one guard seat is visible', async () => {
    const { generateSeatChartWorkbook } = useExcelData()
    const result = await generateSeatChartWorkbook(
      createSeats(4),
      [{ id: 1, name: 'Ada', studentNumber: null, tags: [] }],
      [],
      createWideSeatConfig(),
      {
        ...baseOptions,
        guardSeats: [
          { id: 'guard-left', kind: 'guard', guardSide: 'left', studentId: 1, isEmpty: false },
          { id: 'guard-right', kind: 'guard', guardSide: 'right', studentId: null, isEmpty: false }
        ]
      }
    )

    expect(result.maxCol).toBe(3)
    expect(result.ws.A2.v).toBe('Ada')
    expect(result.ws.B2.v).toBe('讲台')
    expect(result.ws['!merges']).toContainEqual({ s: { r: 1, c: 1 }, e: { r: 1, c: 2 } })
  })

  it('should reserve both guard slots when only the right guard seat is visible', async () => {
    const { generateSeatChartWorkbook } = useExcelData()
    const result = await generateSeatChartWorkbook(
      createSeats(4),
      [{ id: 1, name: 'Ada', studentNumber: null, tags: [] }],
      [],
      createWideSeatConfig(),
      {
        ...baseOptions,
        guardSeats: [
          { id: 'guard-left', kind: 'guard', guardSide: 'left', studentId: null, isEmpty: false },
          { id: 'guard-right', kind: 'guard', guardSide: 'right', studentId: 1, isEmpty: false }
        ]
      }
    )

    expect(result.maxCol).toBe(3)
    expect(result.ws.B2.v).toBe('讲台')
    expect(result.ws.D2.v).toBe('Ada')
    expect(result.ws['!merges']).toContainEqual({ s: { r: 1, c: 1 }, e: { r: 1, c: 2 } })
  })

  it('should swap guard seat columns when the podium is at the top', async () => {
    const { generateSeatChartWorkbook } = useExcelData()
    const result = await generateSeatChartWorkbook(
      createSeats(4),
      [{ id: 1, name: 'Ada', studentNumber: null, tags: [] }],
      [],
      createTopWideSeatConfig(),
      {
        ...baseOptions,
        guardSeats: [
          { id: 'guard-left', kind: 'guard', guardSide: 'left', studentId: 1, isEmpty: false },
          { id: 'guard-right', kind: 'guard', guardSide: 'right', studentId: null, isEmpty: false }
        ]
      }
    )

    expect(result.maxCol).toBe(3)
    expect(result.ws.B1.v).toBe('讲台')
    expect(result.ws.D1.v).toBe('Ada')
    expect(result.ws['!merges']).toContainEqual({ s: { r: 0, c: 1 }, e: { r: 0, c: 2 } })
  })
})
