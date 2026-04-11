import { ref } from 'vue'

// HTML5 Drag（电脑端）：从座位拖拽中
const isDraggingFromSeat = ref(false)

// Touch Drag（手机端）：从座位长按拖拽中
const isTouchDraggingFromSeat = ref(false)

export function useDragState() {
  const startDragFromSeat = () => {
    isDraggingFromSeat.value = true
  }

  const endDragFromSeat = () => {
    isDraggingFromSeat.value = false
  }

  const startTouchDragFromSeat = () => {
    isTouchDraggingFromSeat.value = true
  }

  const endTouchDragFromSeat = () => {
    isTouchDraggingFromSeat.value = false
  }

  return {
    isDraggingFromSeat,
    startDragFromSeat,
    endDragFromSeat,
    isTouchDraggingFromSeat,
    startTouchDragFromSeat,
    endTouchDragFromSeat
  }
}
