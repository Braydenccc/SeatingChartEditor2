import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSeatChart } from '../useSeatChart'

vi.mock('../useZoneData', () => ({
  useZoneData: () => ({
    cleanupInvalidSeats: vi.fn()
  })
}))

vi.mock('../useUndo', () => ({
  useUndo: () => ({
    recordAssign: vi.fn(),
    recordClear: vi.fn(),
    recordSwap: vi.fn(),
    recordToggleEmpty: vi.fn(),
    recordBatch: vi.fn(),
    createSnapshot: vi.fn(() => [])
  })
}))

describe('useSeatChart', () => {
  let seatChart

  beforeEach(() => {
    seatChart = useSeatChart()
    seatChart.updateConfig({
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
      guardSeats: {
        enabled: true,
        leftEnabled: true,
        rightEnabled: true,
        includeInAutoAssignment: false,
        hideEmptyOnExport: true
      }
    })
    seatChart.seats.value.forEach(seat => {
      seat.studentId = null
      seat.isEmpty = false
    })
  })

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(seatChart.seatConfig.value.groupCount).toBe(4)
      expect(seatChart.seatConfig.value.columnsPerGroup).toBe(2)
      expect(seatChart.seatConfig.value.seatsPerColumn).toBe(7)
      expect(seatChart.seatConfig.value.podiumPosition).toBe('bottom')
      expect(seatChart.seatConfig.value.seatAlignment).toBeUndefined()
    })

    it('should create correct number of seats', () => {
      const expectedSeats = 4 * 2 * 7 + 2
      expect(seatChart.seats.value).toHaveLength(expectedSeats)
    })

    it('should generate unique seat IDs', () => {
      const ids = seatChart.seats.value.map(s => s.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('assignStudent', () => {
    it('should assign student to seat', () => {
      const seatId = 'seat-0-0-0'
      const studentId = 1

      const result = seatChart.assignStudent(seatId, studentId, false)

      expect(result).toBe(true)
      expect(seatChart.getStudentAtSeat(seatId)).toBe(studentId)
    })

    it('should not assign to empty seat', () => {
      const seatId = 'seat-0-0-0'
      seatChart.toggleEmpty(seatId, false)

      const result = seatChart.assignStudent(seatId, 1, false)

      expect(result).toBe(false)
      expect(seatChart.getStudentAtSeat(seatId)).toBe(null)
    })

    it('should move same student to different seat', () => {
      const seat1 = 'seat-0-0-0'
      const seat2 = 'seat-0-0-1'

      seatChart.assignStudent(seat1, 1, false)
      seatChart.assignStudent(seat2, 1, false)

      expect(seatChart.getStudentAtSeat(seat1)).toBe(null)
      expect(seatChart.getStudentAtSeat(seat2)).toBe(1)
    })
  })

  describe('guard seats', () => {
    it('should create guard seats with default enabled config', () => {
      expect(seatChart.seatConfig.value.guardSeats).toEqual({
        enabled: true,
        leftEnabled: true,
        rightEnabled: true,
        includeInAutoAssignment: false,
        hideEmptyOnExport: true
      })
      expect(seatChart.guardSeats.value.map(seat => seat.id)).toEqual(['guard-left', 'guard-right'])
      expect(seatChart.visibleGuardSeats.value.map(seat => seat.guardSide)).toEqual(['left', 'right'])
      expect(seatChart.organizedSeats.value.flat(Infinity).some(seat => seat.kind === 'guard')).toBe(false)
    })

    it('should respect left and right guard switches', () => {
      seatChart.updateConfig({
        guardSeats: {
          enabled: true,
          leftEnabled: false,
          rightEnabled: true,
          includeInAutoAssignment: false,
          hideEmptyOnExport: true
        }
      })

      expect(seatChart.visibleGuardSeats.value.map(seat => seat.id)).toEqual(['guard-right'])
    })

    it('should assign, clear, and swap guard seats manually', () => {
      seatChart.assignStudent('guard-left', 1, false)
      seatChart.assignStudent('seat-0-0-0', 2, false)
      seatChart.swapSeats('guard-left', 'seat-0-0-0', false)

      expect(seatChart.getStudentAtSeat('guard-left')).toBe(2)
      expect(seatChart.getStudentAtSeat('seat-0-0-0')).toBe(1)

      seatChart.clearSeat('guard-left', false)
      expect(seatChart.getStudentAtSeat('guard-left')).toBe(null)
    })

    it('should move a student between regular and guard seats', () => {
      seatChart.assignStudent('seat-0-0-0', 1, false)
      seatChart.assignStudent('guard-left', 1, false)

      expect(seatChart.getStudentAtSeat('seat-0-0-0')).toBe(null)
      expect(seatChart.getStudentAtSeat('guard-left')).toBe(1)
    })

    it('should exclude guard seats from available seats unless requested', () => {
      expect(seatChart.getAvailableSeats().some(seat => seat.kind === 'guard')).toBe(false)

      seatChart.updateConfig({
        guardSeats: {
          enabled: true,
          leftEnabled: true,
          rightEnabled: true,
          includeInAutoAssignment: true,
          hideEmptyOnExport: true
        }
      })

      expect(seatChart.getAvailableSeats(true).filter(seat => seat.kind === 'guard')).toHaveLength(2)
    })
  })

  describe('clearSeat', () => {
    it('should remove student from seat', () => {
      const seatId = 'seat-0-0-0'
      seatChart.assignStudent(seatId, 1, false)

      seatChart.clearSeat(seatId, false)

      expect(seatChart.getStudentAtSeat(seatId)).toBe(null)
    })
  })

  describe('swapSeats', () => {
    it('should swap students between two seats', () => {
      const seat1 = 'seat-0-0-0'
      const seat2 = 'seat-0-0-1'

      seatChart.assignStudent(seat1, 1, false)
      seatChart.assignStudent(seat2, 2, false)

      seatChart.swapSeats(seat1, seat2, false)

      expect(seatChart.getStudentAtSeat(seat1)).toBe(2)
      expect(seatChart.getStudentAtSeat(seat2)).toBe(1)
    })

    it('should handle swapping with empty seat', () => {
      const seat1 = 'seat-0-0-0'
      const seat2 = 'seat-0-0-1'

      seatChart.assignStudent(seat1, 1, false)

      seatChart.swapSeats(seat1, seat2, false)

      expect(seatChart.getStudentAtSeat(seat1)).toBe(null)
      expect(seatChart.getStudentAtSeat(seat2)).toBe(1)
    })
  })

  describe('toggleEmpty', () => {
    it('should toggle seat empty state', () => {
      const seatId = 'seat-0-0-0'
      const seat = seatChart.seats.value.find(s => s.id === seatId)

      expect(seat.isEmpty).toBe(false)
      seatChart.toggleEmpty(seatId, false)
      expect(seat.isEmpty).toBe(true)
      seatChart.toggleEmpty(seatId, false)
      expect(seat.isEmpty).toBe(false)
    })

    it('should clear student when toggling to empty', () => {
      const seatId = 'seat-0-0-0'
      seatChart.assignStudent(seatId, 1, false)

      seatChart.toggleEmpty(seatId, false)

      const seat = seatChart.seats.value.find(s => s.id === seatId)
      expect(seat.isEmpty).toBe(true)
      expect(seat.studentId).toBe(null)
    })
  })

  describe('areDeskmates', () => {
    it('should return true for same row, different column in same group', () => {
      const seat1 = 'seat-0-0-0'
      const seat2 = 'seat-0-1-0'

      expect(seatChart.areDeskmates(seat1, seat2)).toBe(true)
    })

    it('should return false for different rows', () => {
      const seat1 = 'seat-0-0-0'
      const seat2 = 'seat-0-0-1'

      expect(seatChart.areDeskmates(seat1, seat2)).toBe(false)
    })

    it('should return false for different groups', () => {
      const seat1 = 'seat-0-0-0'
      const seat2 = 'seat-1-0-0'

      expect(seatChart.areDeskmates(seat1, seat2)).toBe(false)
    })

    it('should return false for same seat', () => {
      const seat1 = 'seat-0-0-0'

      expect(seatChart.areDeskmates(seat1, seat1)).toBe(false)
    })
  })

  describe('getSeatDistance', () => {
    it('should return 0 for same seat', () => {
      const distance = seatChart.getSeatDistance('seat-0-0-0', 'seat-0-0-0')
      expect(distance).toBe(0)
    })

    it('should calculate Manhattan distance within same group', () => {
      const distance1 = seatChart.getSeatDistance('seat-0-0-0', 'seat-0-0-2')
      expect(distance1).toBe(2)

      const distance2 = seatChart.getSeatDistance('seat-0-0-0', 'seat-0-1-0')
      expect(distance2).toBe(1)

      const distance3 = seatChart.getSeatDistance('seat-0-0-0', 'seat-0-1-2')
      expect(distance3).toBe(3)
    })

    it('should return Infinity for different groups', () => {
      const distance = seatChart.getSeatDistance('seat-0-0-0', 'seat-1-0-0')
      expect(distance).toBe(Infinity)
    })
  })

  describe('isInRowRange', () => {
    it('should correctly identify seats in row range with bottom podium', () => {
      const result = seatChart.isInRowRange('seat-0-0-6', 1, 2)
      expect(result).toBe(true)
    })

    it('should return false for seats outside range', () => {
      const result = seatChart.isInRowRange('seat-0-0-0', 1, 2)
      expect(result).toBe(false)
    })

    it('should reverse row range when podium is at top', () => {
      seatChart.updateConfig({ podiumPosition: 'top' })

      expect(seatChart.isInRowRange('seat-0-0-0', 1, 2)).toBe(true)
      expect(seatChart.isInRowRange('seat-0-0-6', 1, 2)).toBe(false)
    })
  })

  describe('direction compatibility', () => {
    it('should migrate legacy alignment to podiumPosition', () => {
      seatChart.updateConfig({ alignment: 'top' })

      expect(seatChart.seatConfig.value.podiumPosition).toBe('top')
      expect(seatChart.seatConfig.value.alignment).toBeUndefined()
      expect(seatChart.seatConfig.value.seatAlignment).toBeUndefined()
    })

    it('should migrate legacy seatAlignment to podiumPosition', () => {
      seatChart.updateConfig({ seatAlignment: 'top' })

      expect(seatChart.seatConfig.value.podiumPosition).toBe('top')
      expect(seatChart.seatConfig.value.seatAlignment).toBeUndefined()
    })

    it('should use bottom podium as the front direction by default', () => {
      expect(seatChart.isDirectlyBehind('seat-0-0-6', 'seat-0-0-5')).toBe(true)
      expect(seatChart.isDirectlyBehind('seat-0-0-5', 'seat-0-0-6')).toBe(false)
    })

    it('should use top podium as the front direction when configured', () => {
      seatChart.updateConfig({ podiumPosition: 'top' })

      expect(seatChart.isDirectlyBehind('seat-0-0-0', 'seat-0-0-1')).toBe(true)
      expect(seatChart.isDirectlyBehind('seat-0-0-1', 'seat-0-0-0')).toBe(false)
    })
  })

  describe('getColumnType', () => {
    it('should identify wall columns', () => {
      expect(seatChart.getColumnType('seat-0-0-0')).toBe('wall')
      expect(seatChart.getColumnType('seat-3-1-0')).toBe('wall')
    })

    it('should identify aisle columns', () => {
      expect(seatChart.getColumnType('seat-0-1-0')).toBe('aisle')
      expect(seatChart.getColumnType('seat-1-0-0')).toBe('aisle')
    })
  })
})
