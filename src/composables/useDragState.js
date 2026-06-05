import { ref } from 'vue'

// HTML5 Drag（电脑端）：从座位拖拽中
const isDraggingFromSeat = ref(false)
const dragCleanupVersion = ref(0)

// Touch Drag（手机端）：从座位长按拖拽中
const isTouchDraggingFromSeat = ref(false)

export function useDragState() {
  const startDragFromSeat = () => {
    isDraggingFromSeat.value = true
  }

  const endDragFromSeat = () => {
    isDraggingFromSeat.value = false
    dragCleanupVersion.value += 1
  }

  const startTouchDragFromSeat = () => {
    isTouchDraggingFromSeat.value = true
  }

  const endTouchDragFromSeat = () => {
    isTouchDraggingFromSeat.value = false
  }

  return {
    isDraggingFromSeat,
    dragCleanupVersion,
    startDragFromSeat,
    endDragFromSeat,
    isTouchDraggingFromSeat,
    startTouchDragFromSeat,
    endTouchDragFromSeat
  }
}
