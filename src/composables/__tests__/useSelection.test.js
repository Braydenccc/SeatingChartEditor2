import { describe, it, expect, beforeEach } from 'vitest'
import { useSelection } from '../useSelection'

describe('useSelection', () => {
  beforeEach(() => {
    const { clearSelection } = useSelection()
    clearSelection()
  })

  describe('addSeatToSelection', () => {
    it('should add seat to selection', () => {
      const { addSeatToSelection, isSeatSelected, selectedCount } = useSelection()

      addSeatToSelection('seat-1')

      expect(isSeatSelected('seat-1')).toBe(true)
      expect(selectedCount.value).toBe(1)
    })

    it('should add multiple seats', () => {
      const { addSeatToSelection, selectedCount } = useSelection()

      addSeatToSelection('seat-1')
      addSeatToSelection('seat-2')
      addSeatToSelection('seat-3')

      expect(selectedCount.value).toBe(3)
    })
  })

  describe('removeSeatFromSelection', () => {
    it('should remove seat from selection', () => {
      const { addSeatToSelection, removeSeatFromSelection, isSeatSelected, selectedCount } = useSelection()

      addSeatToSelection('seat-1')
      addSeatToSelection('seat-2')
      removeSeatFromSelection('seat-1')

      expect(isSeatSelected('seat-1')).toBe(false)
      expect(isSeatSelected('seat-2')).toBe(true)
      expect(selectedCount.value).toBe(1)
    })
  })

  describe('toggleSeatInSelection', () => {
    it('should add seat if not selected', () => {
      const { toggleSeatInSelection, isSeatSelected } = useSelection()

      toggleSeatInSelection('seat-1')

      expect(isSeatSelected('seat-1')).toBe(true)
    })

    it('should remove seat if already selected', () => {
      const { toggleSeatInSelection, isSeatSelected } = useSelection()

      toggleSeatInSelection('seat-1')
      toggleSeatInSelection('seat-1')

      expect(isSeatSelected('seat-1')).toBe(false)
    })
  })

  describe('clearSelection', () => {
    it('should clear all selected seats', () => {
      const { addSeatToSelection, clearSelection, selectedCount, isSeatSelected } = useSelection()

      addSeatToSelection('seat-1')
      addSeatToSelection('seat-2')
      addSeatToSelection('seat-3')
      clearSelection()

      expect(selectedCount.value).toBe(0)
      expect(isSeatSelected('seat-1')).toBe(false)
      expect(isSeatSelected('seat-2')).toBe(false)
      expect(isSeatSelected('seat-3')).toBe(false)
    })
  })

  describe('setSelection', () => {
    it('should set selection to given seat ids', () => {
      const { setSelection, selectedCount, isSeatSelected } = useSelection()

      setSelection(['seat-1', 'seat-2', 'seat-3'])

      expect(selectedCount.value).toBe(3)
      expect(isSeatSelected('seat-1')).toBe(true)
      expect(isSeatSelected('seat-2')).toBe(true)
      expect(isSeatSelected('seat-3')).toBe(true)
    })

    it('should replace existing selection', () => {
      const { addSeatToSelection, setSelection, isSeatSelected } = useSelection()

      addSeatToSelection('seat-old')
      setSelection(['seat-1', 'seat-2'])

      expect(isSeatSelected('seat-old')).toBe(false)
      expect(isSeatSelected('seat-1')).toBe(true)
    })
  })

  describe('selectSingleSeat', () => {
    it('should replace existing selection with one seat', () => {
      const { setSelection, selectSingleSeat, selectedCount, isSeatSelected } = useSelection()

      setSelection(['seat-1', 'seat-2'])
      selectSingleSeat('seat-3')

      expect(selectedCount.value).toBe(1)
      expect(isSeatSelected('seat-1')).toBe(false)
      expect(isSeatSelected('seat-2')).toBe(false)
      expect(isSeatSelected('seat-3')).toBe(true)
    })

    it('should clear selection when seat id is empty', () => {
      const { setSelection, selectSingleSeat, selectedCount } = useSelection()

      setSelection(['seat-1', 'seat-2'])
      selectSingleSeat(null)

      expect(selectedCount.value).toBe(0)
    })
  })

  describe('isSeatSelected', () => {
    it('should return false for non-selected seat', () => {
      const { isSeatSelected } = useSelection()

      expect(isSeatSelected('seat-1')).toBe(false)
    })

    it('should return true for selected seat', () => {
      const { addSeatToSelection, isSeatSelected } = useSelection()

      addSeatToSelection('seat-1')

      expect(isSeatSelected('seat-1')).toBe(true)
    })
  })

  describe('selectedSeatsArray', () => {
    it('should return array of selected seat ids', () => {
      const { addSeatToSelection, selectedSeatsArray } = useSelection()

      addSeatToSelection('seat-1')
      addSeatToSelection('seat-2')

      expect(selectedSeatsArray.value).toContain('seat-1')
      expect(selectedSeatsArray.value).toContain('seat-2')
      expect(selectedSeatsArray.value.length).toBe(2)
    })

    it('should return empty array when no seats selected', () => {
      const { clearSelection, selectedSeatsArray } = useSelection()

      clearSelection()

      expect(selectedSeatsArray.value).toEqual([])
    })
  })

  describe('toggleSelectionMode', () => {
    it('should toggle selection mode', () => {
      const { isSelectionMode, toggleSelectionMode } = useSelection()

      expect(isSelectionMode.value).toBe(false)

      toggleSelectionMode()
      expect(isSelectionMode.value).toBe(true)

      toggleSelectionMode()
      expect(isSelectionMode.value).toBe(false)
    })

    it('should clear selection when exiting selection mode', () => {
      const { addSeatToSelection, toggleSelectionMode, selectedCount } = useSelection()

      addSeatToSelection('seat-1')
      toggleSelectionMode()
      toggleSelectionMode()

      expect(selectedCount.value).toBe(0)
    })
  })

  describe('startSelection', () => {
    it('should set isSelecting to true', () => {
      const { isSelecting, startSelection } = useSelection()

      startSelection()

      expect(isSelecting.value).toBe(true)
    })

    it('should add initial seat if provided', () => {
      const { startSelection, isSeatSelected } = useSelection()

      startSelection('seat-1')

      expect(isSeatSelected('seat-1')).toBe(true)
    })

    it('should work without initial seat', () => {
      const { isSelecting, startSelection, selectedCount } = useSelection()

      startSelection()

      expect(isSelecting.value).toBe(true)
      expect(selectedCount.value).toBe(0)
    })
  })

  describe('updateSelection', () => {
    it('should add seat during selection', () => {
      const { startSelection, updateSelection, isSeatSelected } = useSelection()

      startSelection()
      updateSelection('seat-1')
      updateSelection('seat-2')

      expect(isSeatSelected('seat-1')).toBe(true)
      expect(isSeatSelected('seat-2')).toBe(true)
    })

    it('should not add seat if not selecting', () => {
      const { updateSelection, isSeatSelected } = useSelection()

      updateSelection('seat-1')

      expect(isSeatSelected('seat-1')).toBe(false)
    })

    it('should not add duplicate seats', () => {
      const { startSelection, updateSelection, selectedCount } = useSelection()

      startSelection()
      updateSelection('seat-1')
      updateSelection('seat-1')
      updateSelection('seat-1')

      expect(selectedCount.value).toBe(1)
    })
  })

  describe('endSelection', () => {
    it('should set isSelecting to false', () => {
      const { isSelecting, startSelection, endSelection } = useSelection()

      startSelection()
      endSelection()

      expect(isSelecting.value).toBe(false)
    })
  })

  describe('dragging selection', () => {
    it('should track dragging state', () => {
      const { isDraggingSelection, startDraggingSelection, endDraggingSelection } = useSelection()

      expect(isDraggingSelection.value).toBe(false)

      startDraggingSelection()
      expect(isDraggingSelection.value).toBe(true)

      endDraggingSelection()
      expect(isDraggingSelection.value).toBe(false)
    })
  })
})
