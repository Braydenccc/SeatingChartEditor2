import { ref, computed, triggerRef } from 'vue'

const selectedSeatIds = ref(new Set())
const isSelecting = ref(false)
const isDraggingSelection = ref(false)
const isSelectionMode = ref(false)
const visitedSeatIds = new Set()
const suppressingContextSelection = ref(false)
let contextSelectionSuppressTimer = null

const clearContextSelectionSuppressTimer = () => {
  if (!contextSelectionSuppressTimer) return
  clearTimeout(contextSelectionSuppressTimer)
  contextSelectionSuppressTimer = null
}

export function useSelection() {
  const addSeatToSelection = (seatId) => {
    selectedSeatIds.value.add(seatId)
    triggerRef(selectedSeatIds)
  }

  const removeSeatFromSelection = (seatId) => {
    selectedSeatIds.value.delete(seatId)
    triggerRef(selectedSeatIds)
  }

  const toggleSeatInSelection = (seatId) => {
    const set = selectedSeatIds.value
    if (set.has(seatId)) {
      set.delete(seatId)
    } else {
      set.add(seatId)
    }
    triggerRef(selectedSeatIds)
  }

  const clearSelection = () => {
    selectedSeatIds.value.clear()
    triggerRef(selectedSeatIds)
  }

  const toggleSelectionMode = () => {
    isSelectionMode.value = !isSelectionMode.value
  }

  const setSelection = (seatIds) => {
    selectedSeatIds.value = new Set(seatIds)
  }

  const selectSingleSeat = (seatId) => {
    if (!seatId) {
      clearSelection()
      return
    }
    selectedSeatIds.value = new Set([seatId])
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

  const suppressContextSelectionOnce = (timeout = 600) => {
    suppressingContextSelection.value = true
    clearContextSelectionSuppressTimer()
    contextSelectionSuppressTimer = setTimeout(() => {
      suppressingContextSelection.value = false
      contextSelectionSuppressTimer = null
    }, timeout)
  }

  const consumeContextSelectionSuppression = () => {
    if (!suppressingContextSelection.value) return false
    suppressingContextSelection.value = false
    clearContextSelectionSuppressTimer()
    return true
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
    isSelectionMode,
    addSeatToSelection,
    removeSeatFromSelection,
    toggleSeatInSelection,
    clearSelection,
    toggleSelectionMode,
    setSelection,
    selectSingleSeat,
    isSeatSelected,
    selectedCount,
    selectedSeatsArray,
    startSelection,
    updateSelection,
    endSelection,
    suppressContextSelectionOnce,
    consumeContextSelectionSuppression,
    startDraggingSelection,
    endDraggingSelection
  }
}
