import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUndo } from '../useUndo'

const mockSeatChart = vi.hoisted(() => {
  const seats = { value: [] }
  const findSeat = (seatId) => seats.value.find(seat => seat.id === seatId)

  return {
    seats,
    assignStudent: vi.fn((seatId, studentId) => {
      const seat = findSeat(seatId)
      if (!seat || seat.isEmpty) return false
      const previousSeat = seats.value.find(item => item.studentId === studentId && item.id !== seatId)
      if (previousSeat) previousSeat.studentId = null
      seat.studentId = studentId
      return true
    }),
    clearSeat: vi.fn((seatId) => {
      const seat = findSeat(seatId)
      if (seat) seat.studentId = null
    }),
    swapSeats: vi.fn((seatId1, seatId2) => {
      const seat1 = findSeat(seatId1)
      const seat2 = findSeat(seatId2)
      if (!seat1 || !seat2) return
      const studentId = seat1.studentId
      seat1.studentId = seat2.studentId
      seat2.studentId = studentId
    }),
    toggleEmpty: vi.fn((seatId) => {
      const seat = findSeat(seatId)
      if (!seat) return
      seat.isEmpty = !seat.isEmpty
      if (seat.isEmpty) seat.studentId = null
    })
  }
})

vi.mock('../useSeatChart', () => ({
  useSeatChart: () => mockSeatChart
}))

describe('useUndo', () => {
  let undo

  beforeEach(() => {
    mockSeatChart.seats.value = [
      { id: 'seat-0-0-0', studentId: null, isEmpty: false },
      { id: 'seat-0-0-1', studentId: null, isEmpty: false }
    ]
    mockSeatChart.assignStudent.mockClear()
    mockSeatChart.clearSeat.mockClear()
    mockSeatChart.swapSeats.mockClear()
    mockSeatChart.toggleEmpty.mockClear()
    undo = useUndo()
    undo.clear()
  })

  describe('recordAssign', () => {
    it('should record assignment operation', () => {
      expect(undo.canUndo.value).toBe(false)

      undo.recordAssign('seat-0-0-0', 1, null)

      expect(undo.canUndo.value).toBe(true)
    })
  })

  describe('recordClear', () => {
    it('should record clear operation', () => {
      undo.recordClear('seat-0-0-0', 1)

      expect(undo.canUndo.value).toBe(true)
    })
  })

  describe('recordSwap', () => {
    it('should record swap operation', () => {
      undo.recordSwap('seat-0-0-0', 'seat-0-0-1', 1, 2)

      expect(undo.canUndo.value).toBe(true)
    })
  })

  describe('recordToggleEmpty', () => {
    it('should record toggle empty operation', () => {
      undo.recordToggleEmpty('seat-0-0-0', false, null)

      expect(undo.canUndo.value).toBe(true)
    })
  })

  describe('undo', () => {
    it('should undo last operation', () => {
      undo.recordAssign('seat-0-0-0', 1, null)
      expect(undo.canUndo.value).toBe(true)

      undo.undo()

      expect(undo.canUndo.value).toBe(false)
      expect(undo.canRedo.value).toBe(true)
    })

    it('should not undo when history is empty', () => {
      expect(undo.canUndo.value).toBe(false)
      expect(() => undo.undo()).not.toThrow()
    })
  })

  describe('redo', () => {
    it('should redo undone operation', () => {
      mockSeatChart.seats.value[0].studentId = 1
      undo.recordAssign('seat-0-0-0', 1, null)
      undo.undo()

      expect(undo.canRedo.value).toBe(true)

      undo.redo()

      expect(undo.canRedo.value).toBe(false)
      expect(undo.canUndo.value).toBe(true)
      expect(mockSeatChart.seats.value[0].studentId).toBe(1)
    })

    it('should redo assignment after undoing it', () => {
      mockSeatChart.seats.value[0].studentId = 1
      undo.recordAssign('seat-0-0-0', 1, null)

      undo.undo()
      expect(mockSeatChart.seats.value[0].studentId).toBeNull()

      undo.redo()
      expect(mockSeatChart.seats.value[0].studentId).toBe(1)
    })

    it('should not redo when redo stack is empty', () => {
      expect(undo.canRedo.value).toBe(false)
      expect(() => undo.redo()).not.toThrow()
    })
  })

  describe('clear', () => {
    it('should clear all history', () => {
      undo.recordAssign('seat-0-0-0', 1, null)
      undo.recordAssign('seat-0-0-1', 2, null)

      expect(undo.canUndo.value).toBe(true)

      undo.clear()

      expect(undo.canUndo.value).toBe(false)
      expect(undo.canRedo.value).toBe(false)
    })
  })

  describe('recordBatch', () => {
    it('should record multiple operations as one batch', () => {
      undo.recordBatch([
        { type: 'assign', seatId: 'seat-0-0-0', newStudentId: 1, oldStudentId: null },
        { type: 'assign', seatId: 'seat-0-0-1', newStudentId: 2, oldStudentId: null }
      ])

      expect(undo.canUndo.value).toBe(true)

      undo.undo()

      expect(undo.canUndo.value).toBe(false)
    })
  })
})
