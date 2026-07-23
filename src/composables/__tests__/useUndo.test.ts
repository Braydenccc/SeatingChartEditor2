import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUndo } from '../useUndo'

interface MockSeat {
  id: string
  studentId: number | null
  isEmpty: boolean
}

const mockSeatChart = vi.hoisted(() => {
  const seats: { value: MockSeat[] } = { value: [] }
  const findSeat = (seatId: string) => seats.value.find(seat => seat.id === seatId)

  return {
    seats,
    assignStudent: vi.fn((seatId: string, studentId: number) => {
      const seat = findSeat(seatId)
      if (!seat || seat.isEmpty) return false
      const previousSeat = seats.value.find(item => item.studentId === studentId && item.id !== seatId)
      if (previousSeat) previousSeat.studentId = null
      seat.studentId = studentId
      return true
    }),
    clearSeat: vi.fn((seatId: string) => {
      const seat = findSeat(seatId)
      if (seat) seat.studentId = null
    }),
    swapSeats: vi.fn((seatId1: string, seatId2: string) => {
      const seat1 = findSeat(seatId1)
      const seat2 = findSeat(seatId2)
      if (!seat1 || !seat2) return
      const studentId = seat1.studentId
      seat1.studentId = seat2.studentId
      seat2.studentId = studentId
    }),
    toggleEmpty: vi.fn((seatId: string) => {
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
  let undo: ReturnType<typeof useUndo>

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
    undo.setMaxHistory(50)
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
      undo.recordSwap('seat-0-0-0', 'seat-0-0-1')

      expect(undo.canUndo.value).toBe(true)
    })
  })

  describe('recordToggleEmpty', () => {
    it('should record toggle empty operation', () => {
      undo.recordToggleEmpty('seat-0-0-0')

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
      undo.recordBatch(
        [
          { id: 'seat-0-0-0', studentId: null, isEmpty: false },
          { id: 'seat-0-0-1', studentId: null, isEmpty: false }
        ],
        [
          { id: 'seat-0-0-0', studentId: 1, isEmpty: false },
          { id: 'seat-0-0-1', studentId: 2, isEmpty: false }
        ]
      )

      expect(undo.canUndo.value).toBe(true)

      undo.undo()

      expect(undo.canUndo.value).toBe(false)
    })

    it('should keep the empty-seat invariant when restoring a snapshot', () => {
      mockSeatChart.seats.value[0] = { id: 'seat-0-0-0', studentId: 2, isEmpty: false }
      undo.recordBatch(
        [{ id: 'seat-0-0-0', studentId: 1, isEmpty: true }],
        [{ id: 'seat-0-0-0', studentId: 2, isEmpty: false }]
      )

      undo.undo()

      expect(mockSeatChart.seats.value[0]).toEqual({
        id: 'seat-0-0-0',
        studentId: null,
        isEmpty: true
      })
    })
  })

  describe('setMaxHistory', () => {
    it('should immediately trim both undo and redo stacks', () => {
      for (let index = 0; index < 25; index++) {
        undo.recordClear('seat-0-0-0', index)
      }
      for (let index = 0; index < 12; index++) undo.undo()

      expect(undo.undoStack.value).toHaveLength(13)
      expect(undo.redoStack.value).toHaveLength(12)

      undo.setMaxHistory(10)

      expect(undo.undoStack.value).toHaveLength(10)
      expect(undo.redoStack.value).toHaveLength(10)
    })
  })
})
