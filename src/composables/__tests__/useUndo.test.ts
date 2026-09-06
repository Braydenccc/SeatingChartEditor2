import { describe, it, expect, beforeEach } from 'vitest'
import { useUndo } from '../useUndo'
import { replaceSeatsRaw, seats } from '../seatChartState'
import type { Seat } from '@/types/models'

const createSeat = (id: string): Seat => ({
  id,
  groupIndex: 0,
  columnIndex: 0,
  rowIndex: Number(id.charAt(id.length - 1)),
  studentId: null,
  isEmpty: false,
  kind: 'regular'
})

describe('useUndo', () => {
  let undo: ReturnType<typeof useUndo>

  beforeEach(() => {
    replaceSeatsRaw([
      createSeat('seat-0-0-0'),
      createSeat('seat-0-0-1')
    ])
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

    it('does not record clearing an already unoccupied seat', () => {
      expect(undo.recordClear('seat-0-0-0', null)).toBe(false)
      expect(undo.canUndo.value).toBe(false)
    })
  })

  describe('recordSwap', () => {
    it('should record swap operation', () => {
      seats.value[0].studentId = 1
      seats.value[1].studentId = 2
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

    it('invalidates all history when a command can no longer be replayed', () => {
      undo.recordAssign('seat-missing', 1, null)

      expect(undo.undo()).toBe(false)
      expect(undo.canUndo.value).toBe(false)
      expect(undo.canRedo.value).toBe(false)
    })
  })

  describe('redo', () => {
    it('should redo undone operation', () => {
      seats.value[0].studentId = 1
      undo.recordAssign('seat-0-0-0', 1, null)
      undo.undo()

      expect(undo.canRedo.value).toBe(true)

      undo.redo()

      expect(undo.canRedo.value).toBe(false)
      expect(undo.canUndo.value).toBe(true)
      expect(seats.value[0].studentId).toBe(1)
    })

    it('should redo assignment after undoing it', () => {
      seats.value[0].studentId = 1
      undo.recordAssign('seat-0-0-0', 1, null)

      undo.undo()
      expect(seats.value[0].studentId).toBeNull()

      undo.redo()
      expect(seats.value[0].studentId).toBe(1)
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

    it('rejects an invalid empty-seat snapshot without partially writing', () => {
      seats.value[0].studentId = 2
      seats.value[1].studentId = 3
      const before = seats.value.map(seat => ({ ...seat }))
      undo.recordBatch(
        [
          { id: 'seat-0-0-0', studentId: 1, isEmpty: true },
          { id: 'seat-0-0-1', studentId: 3, isEmpty: false }
        ],
        [
          { id: 'seat-0-0-0', studentId: 2, isEmpty: false },
          { id: 'seat-0-0-1', studentId: 3, isEmpty: false }
        ]
      )

      expect(undo.undo()).toBe(false)

      expect(seats.value).toEqual(before)
      expect(undo.canUndo.value).toBe(false)
      expect(undo.canRedo.value).toBe(false)
    })

    it('rejects a snapshot with a different seat ID set without partially writing', () => {
      seats.value[0].studentId = 2
      seats.value[1].studentId = 3
      const before = seats.value.map(seat => ({ ...seat }))
      undo.recordBatch(
        [
          { id: 'seat-0-0-0', studentId: 1, isEmpty: false },
          { id: 'seat-missing', studentId: null, isEmpty: false }
        ],
        [
          { id: 'seat-0-0-0', studentId: 2, isEmpty: false },
          { id: 'seat-0-0-1', studentId: 3, isEmpty: false }
        ]
      )

      expect(undo.undo()).toBe(false)

      expect(seats.value).toEqual(before)
      expect(undo.canUndo.value).toBe(false)
      expect(undo.canRedo.value).toBe(false)
    })

    it('rejects a snapshot that assigns one student to multiple seats', () => {
      seats.value[0].studentId = 2
      seats.value[1].studentId = 3
      const before = seats.value.map(seat => ({ ...seat }))
      undo.recordBatch(
        [
          { id: 'seat-0-0-0', studentId: 1, isEmpty: false },
          { id: 'seat-0-0-1', studentId: 1, isEmpty: false }
        ],
        [
          { id: 'seat-0-0-0', studentId: 2, isEmpty: false },
          { id: 'seat-0-0-1', studentId: 3, isEmpty: false }
        ]
      )

      expect(undo.undo()).toBe(false)

      expect(seats.value).toEqual(before)
      expect(undo.canUndo.value).toBe(false)
      expect(undo.canRedo.value).toBe(false)
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
