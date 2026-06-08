import { ref } from 'vue'

// HTML5 Drag（电脑端）：从座位拖拽中
const isDraggingFromSeat = ref(false)
const dragCleanupVersion = ref(0)

// Touch Drag（手机端）：从座位长按拖拽中
const isTouchDraggingFromSeat = ref(false)

export function useDragState() {
  const cleanupDragDomClasses = () => {
    if (typeof document === 'undefined') return
    document.querySelectorAll('.seat-item.drag-over').forEach(el => {
      el.classList.remove('drag-over')
    })
    document.querySelectorAll('.student-items.drag-over').forEach(el => {
      el.classList.remove('drag-over')
    })
    document.querySelectorAll('.seat-touch-drop-out-zone.is-touch-over').forEach(el => {
      el.classList.remove('is-touch-over')
    })
  }

  const requestDragCleanup = () => {
    dragCleanupVersion.value += 1
    cleanupDragDomClasses()
  }

  const startDragFromSeat = () => {
    isDraggingFromSeat.value = true
  }

  const endDragFromSeat = () => {
    isDraggingFromSeat.value = false
    requestDragCleanup()
  }

  const startTouchDragFromSeat = () => {
    isTouchDraggingFromSeat.value = true
  }

  const endTouchDragFromSeat = () => {
    isTouchDraggingFromSeat.value = false
    requestDragCleanup()
  }

  return {
    isDraggingFromSeat,
    dragCleanupVersion,
    requestDragCleanup,
    startDragFromSeat,
    endDragFromSeat,
    isTouchDraggingFromSeat,
    startTouchDragFromSeat,
    endTouchDragFromSeat
  }
}
