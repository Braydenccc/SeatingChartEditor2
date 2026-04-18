import { ref, computed, reactive } from 'vue'
import { useSeatChart } from './useSeatChart'
import { useZoom } from './useZoom'
import { useStudentData } from './useStudentData'
import { useLayoutConstants } from './useLayoutConstants'

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

export function useDragPreview() {
  const { seatConfig, parseSeatId, generateSeatId, getSeat } = useSeatChart()
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
      previewEl.style.transform = 'translate(-50%, -50%) scale(1)'
      previewEl.style.transition = 'none'
    }
  }

  const updateDragPreview = (clientX, clientY) => {
    if (!state.isActive || !state.isDragging) return

    state.mouseX = clientX
    state.mouseY = clientY

    const local = clientToChartLocal(clientX, clientY)
    if (local) {
      state.snapGrid = chartLocalToGrid(local.x, local.y)
    }

    // 直接更新位置
    if (previewEl) {
      previewEl.style.left = `${clientX}px`
      previewEl.style.top = `${clientY}px`
    }
  }

  const endDragPreview = (dropTargetSeatIds = null) => {
    if (!state.isActive) return
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

    const anchor = parseSeatId(state.anchorSeatId)
    const cpg = seatConfig.value.columnsPerGroup
    const groupW = cpg * L.SEAT_W + (cpg - 1) * L.COL_GAP

    return state.selectedSeatIds.map(sid => {
      const parsed = parseSeatId(sid)

      // 计算相对于锚点的偏移
      const dx = (parsed.groupIndex * (groupW + L.GROUP_GAP) + parsed.columnIndex * (L.SEAT_W + L.COL_GAP)) -
                 (anchor.groupIndex * (groupW + L.GROUP_GAP) + anchor.columnIndex * (L.SEAT_W + L.COL_GAP))
      const dy = (parsed.rowIndex * (L.SEAT_H + L.ROW_GAP)) - (anchor.rowIndex * (L.SEAT_H + L.ROW_GAP))

      const seat = getSeat(sid)
      const isAnchor = sid === state.anchorSeatId
      const student = students.value.find(s => s.id === seat?.studentId)

      return {
        seatId: sid,
        studentId: seat?.studentId ?? null,
        studentName: student?.name || '',
        isAnchor,
        style: {
          // 相对于容器中心的偏移，锚点座位在中心 (0, 0)
          left: `calc(50% + ${dx}px)`,
          top: `calc(50% + ${dy}px)`,
          transform: 'translate(-50%, -50%)',
          width: `${L.SEAT_W}px`,
          height: `${L.SEAT_H}px`
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
