import { ref, computed, reactive } from 'vue'
import { useSeatChart } from './useSeatChart'
import { useZoom } from './useZoom'
import { useStudentData } from './useStudentData'
import { useLayoutConstants } from './useLayoutConstants'
import { parseSeatId, generateSeatId, isGuardSeatId } from '@/utils/seatHelpers'

const { LAYOUT: L } = useLayoutConstants()

const state = reactive({
  isActive: false,
  isDragging: false,
  isAnimatingToDrop: false,
  anchorSeatId: null,
  selectedSeatIds: [],
  mouseX: 0,
  mouseY: 0,
  snapGrid: null
})

let chartEl = null
let cachedChartRect = null
let previewEl = null
let updateRafId = null

export function useDragPreview() {
  const { seatConfig, getSeat } = useSeatChart()
  const { scale } = useZoom()
  const { students } = useStudentData()

  const registerChartElement = (el) => {
    chartEl = el
  }

  const registerPreviewElement = (el) => {
    previewEl = el
  }

  function clientToChartLocal(clientX, clientY) {
    if (!cachedChartRect) return null
    return {
      x: (clientX - cachedChartRect.left) / scale.value,
      y: (clientY - cachedChartRect.top) / scale.value
    }
  }

  function chartLocalToGrid(x, y) {
    const cpg = seatConfig.value.columnsPerGroup
    const spc = seatConfig.value.seatsPerColumn
    const gc = seatConfig.value.groupCount
    const groupW = cpg * L.SEAT_W + (cpg - 1) * L.COL_GAP
    const groupStride = groupW + L.GROUP_GAP

    const gFloat = (x - L.PAD_L) / groupStride
    const g = Math.round(gFloat)
    if (g < 0 || g >= gc) return null

    const groupLeft = L.PAD_L + g * groupStride
    const colStride = L.SEAT_W + L.COL_GAP
    const cFloat = (x - groupLeft) / colStride
    const c = Math.round(cFloat)
    if (c < 0 || c >= cpg) return null

    const rowStride = L.SEAT_H + L.ROW_GAP
    const rFloat = (y - L.PAD_T - L.LABEL_H) / rowStride
    const r = Math.round(rFloat)
    if (r < 0 || r >= spc) return null

    return { g, c, r }
  }

  const startDragPreview = (anchorSeatId, selectedSeatIds, clientX, clientY) => {
    state.isActive = true
    state.isDragging = true
    state.isAnimatingToDrop = false
    state.anchorSeatId = anchorSeatId
    state.selectedSeatIds = selectedSeatIds
    state.mouseX = clientX
    state.mouseY = clientY
    state.snapGrid = null

    if (chartEl) {
      cachedChartRect = chartEl.getBoundingClientRect()
    }

    if (previewEl) {
      previewEl.style.left = `${clientX}px`
      previewEl.style.top = `${clientY}px`
      previewEl.style.transform = 'translate(-50%, -50%)'
      previewEl.style.transition = 'none'
    }
  }

  const updateDragPreview = (clientX, clientY) => {
    if (!state.isActive || !state.isDragging) return

    state.mouseX = clientX
    state.mouseY = clientY

    if (previewEl) {
      previewEl.style.left = `${clientX}px`
      previewEl.style.top = `${clientY}px`
    }

    if (updateRafId) {
      cancelAnimationFrame(updateRafId)
    }

    updateRafId = requestAnimationFrame(() => {
      updateRafId = null

      const local = clientToChartLocal(clientX, clientY)
      if (local) {
        state.snapGrid = chartLocalToGrid(local.x, local.y)
      }
    })
  }

  const endDragPreview = (dropTargetSeatIds = null) => {
    if (!state.isActive) return

    if (updateRafId) {
      cancelAnimationFrame(updateRafId)
      updateRafId = null
    }

    resetState()
  }

  const resetState = () => {
    state.isActive = false
    state.isDragging = false
    state.isAnimatingToDrop = false
    state.anchorSeatId = null
    state.selectedSeatIds = []
    state.snapGrid = null
    cachedChartRect = null
  }

  const ghostSeatIds = computed(() => {
    return new Set()
  })

  const isGhostSeat = (seatId) => {
    return ghostSeatIds.value.has(seatId)
  }

  const previewItems = computed(() => {
    if (!state.isActive || !state.anchorSeatId) return []

    if (isGuardSeatId(state.anchorSeatId)) {
      const seat = getSeat(state.anchorSeatId)
      const student = students.value.find(s => s.id === seat?.studentId)
      return [{
        seatId: state.anchorSeatId,
        studentId: seat?.studentId ?? null,
        studentName: student?.name || '',
        isAnchor: true,
        style: {
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${L.SEAT_W}px`,
          height: `${L.SEAT_H}px`
        }
      }]
    }

    const anchor = parseSeatId(state.anchorSeatId)
    const cpg = seatConfig.value.columnsPerGroup

    let seatW = L.SEAT_W
    let seatH = L.SEAT_H
    let colGap = L.COL_GAP
    let rowGap = L.ROW_GAP
    let groupGap = L.GROUP_GAP

    if (chartEl) {
      const seatEl = chartEl.querySelector('.seat-item')
      if (seatEl) {
        const rect = seatEl.getBoundingClientRect()
        seatW = rect.width
        seatH = rect.height
      }

      const columnEl = chartEl.querySelector('.seat-column')
      if (columnEl) {
        const style = window.getComputedStyle(columnEl)
        const gap = parseFloat(style.gap)
        if (!isNaN(gap)) rowGap = gap
      }

      const groupContentEl = chartEl.querySelector('.group-content')
      if (groupContentEl) {
        const style = window.getComputedStyle(groupContentEl)
        const gap = parseFloat(style.gap)
        if (!isNaN(gap)) colGap = gap
      }

      const seatChartEl = chartEl
      if (seatChartEl) {
        const style = window.getComputedStyle(seatChartEl)
        const gap = parseFloat(style.gap)
        if (!isNaN(gap)) groupGap = gap
      }
    }

    const groupW = cpg * seatW + (cpg - 1) * colGap

    return state.selectedSeatIds.map(sid => {
      const parsed = parseSeatId(sid)

      const dx = (parsed.groupIndex * (groupW + groupGap) + parsed.columnIndex * (seatW + colGap)) -
                 (anchor.groupIndex * (groupW + groupGap) + anchor.columnIndex * (seatW + colGap))
      const dy = (parsed.rowIndex * (seatH + rowGap)) - (anchor.rowIndex * (seatH + rowGap))

      const seat = getSeat(sid)
      const isAnchor = sid === state.anchorSeatId
      const student = students.value.find(s => s.id === seat?.studentId)

      return {
        seatId: sid,
        studentId: seat?.studentId ?? null,
        studentName: student?.name || '',
        isAnchor,
        style: {
          left: `calc(50% + ${dx}px)`,
          top: `calc(50% + ${dy}px)`,
          transform: 'translate(-50%, -50%)',
          width: `${seatW}px`,
          height: `${seatH}px`
        }
      }
    })
  })

  return {
    dragPreviewState: state,
    ghostSeatIds,
    isGhostSeat,
    previewItems,
    registerChartElement,
    registerPreviewElement,
    startDragPreview,
    updateDragPreview,
    endDragPreview,
    L
  }
}
