import { describe, expect, it } from 'vitest'
import { useExcelData } from '../useExcelData'
import type { SeatChartExcelOptions } from '../useExcelData'
import type { GuardSeatsConfig, Seat, SeatConfig } from '@/types/models'

const createSeatConfig = (guardSeats: Partial<GuardSeatsConfig> = {}): SeatConfig => ({
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

const createWideSeatConfig = (guardSeats: Partial<GuardSeatsConfig> = {}): SeatConfig => ({
  ...createSeatConfig(guardSeats),
  columnsPerGroup: 4,
  groups: [{ columns: 4, rows: 1 }]
})

const createTopWideSeatConfig = (guardSeats: Partial<GuardSeatsConfig> = {}): SeatConfig => ({
  ...createWideSeatConfig(guardSeats),
  podiumPosition: 'top'
})

const createSeats = (columns = 1): Seat[][][] => [
  Array.from({ length: columns }, (_, columnIndex) => [{
    id: `seat-0-${columnIndex}-0`,
    groupIndex: 0,
    columnIndex,
    rowIndex: 0,
    studentId: null,
    isEmpty: false
  }])
]

const createGuardSeat = (guardSide: 'left' | 'right', studentId: number | null = null): Seat => ({
  id: `guard-${guardSide}`,
  groupIndex: -1,
  columnIndex: guardSide === 'left' ? -1 : 1,
  rowIndex: 0,
  kind: 'guard',
  guardSide,
  studentId,
  isEmpty: false
})

const baseOptions: SeatChartExcelOptions = {
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

const getCellValue = (worksheet: Record<string, unknown>, address: string) => {
  const cell = worksheet[address]
  if (!cell || typeof cell !== 'object' || !('v' in cell)) return undefined
  return (cell as { v: unknown }).v
}

describe('useExcelData guard seats', () => {
  it('should preserve student number zero in seat chart cells', async () => {
    const { generateSeatChartWorkbook } = useExcelData()
    const seats = createSeats()
    seats[0][0][0].studentId = 1
    const result = await generateSeatChartWorkbook(
      seats,
      [{ id: 1, name: 'Ada', studentNumber: 0, tags: [] }],
      [],
      createSeatConfig(),
      {
        ...baseOptions,
        layout: { ...baseOptions.layout, showStudentId: true, showPodium: false },
        content: { title: '座位表', cellFormat: '%n|%i' }
      }
    )

    expect(Object.keys(result.ws).some(address => getCellValue(result.ws, address) === 'Ada|0')).toBe(true)
  })

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
          createGuardSeat('left'),
          createGuardSeat('right')
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
          createGuardSeat('left', 1),
          createGuardSeat('right')
        ]
      }
    )

    expect(result.maxCol).toBe(2)
    expect(Object.keys(result.ws).some(address => getCellValue(result.ws, address) === 'Ada')).toBe(true)
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
          createGuardSeat('left'),
          createGuardSeat('right')
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
          createGuardSeat('left', 1),
          createGuardSeat('right')
        ]
      }
    )

    expect(result.maxCol).toBe(3)
    expect(getCellValue(result.ws, 'A2')).toBe('Ada')
    expect(getCellValue(result.ws, 'B2')).toBe('讲台')
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
          createGuardSeat('left'),
          createGuardSeat('right', 1)
        ]
      }
    )

    expect(result.maxCol).toBe(3)
    expect(getCellValue(result.ws, 'B2')).toBe('讲台')
    expect(getCellValue(result.ws, 'D2')).toBe('Ada')
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
          createGuardSeat('left', 1),
          createGuardSeat('right')
        ]
      }
    )

    expect(result.maxCol).toBe(3)
    expect(getCellValue(result.ws, 'B1')).toBe('讲台')
    expect(getCellValue(result.ws, 'D1')).toBe('Ada')
    expect(result.ws['!merges']).toContainEqual({ s: { r: 0, c: 1 }, e: { r: 0, c: 2 } })
  })
})
