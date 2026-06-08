import { describe, it, expect } from 'vitest'
import { useDragState } from '../useDragState'

describe('useDragState', () => {
  describe('initial state', () => {
    it('should have isDraggingFromSeat as false by default', () => {
      const { isDraggingFromSeat } = useDragState()

      expect(isDraggingFromSeat.value).toBe(false)
    })

    it('should have isTouchDraggingFromSeat as false by default', () => {
      const { isTouchDraggingFromSeat } = useDragState()

      expect(isTouchDraggingFromSeat.value).toBe(false)
    })
  })

  describe('startDragFromSeat', () => {
    it('should set isDraggingFromSeat to true', () => {
      const { isDraggingFromSeat, startDragFromSeat } = useDragState()

      startDragFromSeat()

      expect(isDraggingFromSeat.value).toBe(true)
    })
  })

  describe('endDragFromSeat', () => {
    it('should set isDraggingFromSeat to false', () => {
      const { isDraggingFromSeat, startDragFromSeat, endDragFromSeat } = useDragState()

      startDragFromSeat()
      endDragFromSeat()

      expect(isDraggingFromSeat.value).toBe(false)
    })

    it('should notify seat items to clean drag visuals', () => {
      const { dragCleanupVersion, startDragFromSeat, endDragFromSeat } = useDragState()
      const before = dragCleanupVersion.value

      startDragFromSeat()
      endDragFromSeat()

      expect(dragCleanupVersion.value).toBe(before + 1)
    })
  })

  describe('requestDragCleanup', () => {
    it('should notify drag visual cleanup without changing drag state', () => {
      const { dragCleanupVersion, isDraggingFromSeat, requestDragCleanup } = useDragState()
      const before = dragCleanupVersion.value

      requestDragCleanup()

      expect(dragCleanupVersion.value).toBe(before + 1)
      expect(isDraggingFromSeat.value).toBe(false)
    })

    it('should remove transient drag highlight classes', () => {
      const { requestDragCleanup } = useDragState()
      const seat = document.createElement('div')
      seat.className = 'seat-item drag-over'
      const studentList = document.createElement('div')
      studentList.className = 'student-items drag-over'
      const dropOut = document.createElement('div')
      dropOut.className = 'seat-touch-drop-out-zone is-touch-over'
      document.body.append(seat, studentList, dropOut)

      requestDragCleanup()

      expect(seat.classList.contains('drag-over')).toBe(false)
      expect(studentList.classList.contains('drag-over')).toBe(false)
      expect(dropOut.classList.contains('is-touch-over')).toBe(false)

      seat.remove()
      studentList.remove()
      dropOut.remove()
    })
  })

  describe('startTouchDragFromSeat', () => {
    it('should set isTouchDraggingFromSeat to true', () => {
      const { isTouchDraggingFromSeat, startTouchDragFromSeat } = useDragState()

      startTouchDragFromSeat()

      expect(isTouchDraggingFromSeat.value).toBe(true)
    })
  })

  describe('endTouchDragFromSeat', () => {
    it('should set isTouchDraggingFromSeat to false', () => {
      const { dragCleanupVersion, isTouchDraggingFromSeat, startTouchDragFromSeat, endTouchDragFromSeat } = useDragState()
      const before = dragCleanupVersion.value

      startTouchDragFromSeat()
      endTouchDragFromSeat()

      expect(isTouchDraggingFromSeat.value).toBe(false)
      expect(dragCleanupVersion.value).toBe(before + 1)
    })
  })

  describe('independent drag states', () => {
    it('should track HTML5 drag and touch drag independently', () => {
      const {
        isDraggingFromSeat,
        isTouchDraggingFromSeat,
        startDragFromSeat,
        startTouchDragFromSeat,
        endDragFromSeat
      } = useDragState()

      startDragFromSeat()
      startTouchDragFromSeat()

      expect(isDraggingFromSeat.value).toBe(true)
      expect(isTouchDraggingFromSeat.value).toBe(true)

      endDragFromSeat()

      expect(isDraggingFromSeat.value).toBe(false)
      expect(isTouchDraggingFromSeat.value).toBe(true)
    })
  })
})
