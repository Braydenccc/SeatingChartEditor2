import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUndo } from '../useUndo'

vi.mock('../useSeatChart', () => ({
  useSeatChart: () => ({
    seats: { value: [] },
    assignStudent: vi.fn(),
    clearSeat: vi.fn(),
    swapSeats: vi.fn(),
    toggleEmpty: vi.fn()
  })
}))

describe('useUndo', () => {
  let undo

  beforeEach(() => {
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
      undo.recordAssign('seat-0-0-0', 1, null)
      undo.undo()

      expect(undo.canRedo.value).toBe(true)

      undo.redo()

      expect(undo.canRedo.value).toBe(false)
      expect(undo.canUndo.value).toBe(true)
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
