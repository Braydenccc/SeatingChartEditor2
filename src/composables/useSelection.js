import { ref, computed, triggerRef } from 'vue'

const selectedSeatIds = ref(new Set())
const isSelecting = ref(false)
const isDraggingSelection = ref(false)
const visitedSeatIds = new Set()

const notify = () => triggerRef(selectedSeatIds)

export function useSelection() {
  const addSeatToSelection = (seatId) => {
    selectedSeatIds.value.add(seatId)
    notify()
  }

  const removeSeatFromSelection = (seatId) => {
    selectedSeatIds.value.delete(seatId)
    notify()
  }

  const toggleSeatInSelection = (seatId) => {
    const set = selectedSeatIds.value
    if (set.has(seatId)) {
      set.delete(seatId)
    } else {
      set.add(seatId)
    }
    notify()
  }

  const clearSelection = () => {
    selectedSeatIds.value.clear()
    notify()
  }

  const setSelection = (seatIds) => {
    selectedSeatIds.value = new Set(seatIds)
  }

  const isSeatSelected = (seatId) => {
    return selectedSeatIds.value.has(seatId)
  }

  const selectedCount = computed(() => selectedSeatIds.value.size)
  const selectedSeatsArray = computed(() => Array.from(selectedSeatIds.value))

  const startSelection = (seatId) => {
    isSelecting.value = true
    visitedSeatIds.clear()
    if (seatId) {
      visitedSeatIds.add(seatId)
      addSeatToSelection(seatId)
    }
  }

  const updateSelection = (seatId) => {
    if (!isSelecting.value || !seatId) return
    if (!visitedSeatIds.has(seatId)) {
      visitedSeatIds.add(seatId)
      addSeatToSelection(seatId)
    }
  }

  const endSelection = () => {
    isSelecting.value = false
    visitedSeatIds.clear()
  }

  const startDraggingSelection = () => {
    isDraggingSelection.value = true
  }

  const endDraggingSelection = () => {
    isDraggingSelection.value = false
  }

  return {
    selectedSeatIds,
    isSelecting,
    isDraggingSelection,
    addSeatToSelection,
    removeSeatFromSelection,
    toggleSeatInSelection,
    clearSelection,
    setSelection,
    isSeatSelected,
    selectedCount,
    selectedSeatsArray,
    startSelection,
    updateSelection,
    endSelection,
    startDraggingSelection,
    endDraggingSelection
  }
}
