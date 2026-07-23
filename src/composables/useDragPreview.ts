import { computed, reactive } from 'vue'
import { useSeatChart } from './useSeatChart'
import { useZoom } from './useZoom'
import { useStudentData } from './useStudentData'
import { useLayoutConstants } from './useLayoutConstants'
import { parseSeatId, isGuardSeatId } from '@/utils/seatHelpers'

const { LAYOUT: L } = useLayoutConstants()

interface DragPreviewGrid {
  g: number
  c: number
  r: number
}

interface DragPreviewState {
  isActive: boolean
  isDragging: boolean
  isAnimatingToDrop: boolean
  anchorSeatId: string | null
  selectedSeatIds: string[]
  mouseX: number
  mouseY: number
  snapGrid: DragPreviewGrid | null
}

const state = reactive<DragPreviewState>({
  isActive: false,
  isDragging: false,
  isAnimatingToDrop: false,
  anchorSeatId: null,
  selectedSeatIds: [],
  mouseX: 0,
  mouseY: 0,
  snapGrid: null
})

let chartEl: HTMLElement | null = null
let cachedChartRect: DOMRect | null = null
let previewEl: HTMLElement | null = null
let updateRafId: number | null = null

const positionPreviewElement = () => {
  if (!previewEl || !state.isActive) return

  previewEl.style.left = `${state.mouseX}px`
  previewEl.style.top = `${state.mouseY}px`
  previewEl.style.transform = 'translate(-50%, -50%)'
  previewEl.style.transition = 'none'
}

export function useDragPreview() {
  const { seatConfig, getSeat, getGroupConfig, toGlobalCol } = useSeatChart()
  const { scale } = useZoom()
  const { students } = useStudentData()

  const registerChartElement = (el: HTMLElement | null) => {
    chartEl = el
  }

  const registerPreviewElement = (el: HTMLElement | null) => {
    previewEl = el
    positionPreviewElement()
  }

  function clientToChartLocal(clientX: number, clientY: number) {
    if (!cachedChartRect) return null
    return {
      x: (clientX - cachedChartRect.left) / scale.value,
      y: (clientY - cachedChartRect.top) / scale.value
    }
  }

  function chartLocalToGrid(x: number, y: number): DragPreviewGrid | null {
    const gc = seatConfig.value.groupCount
    const colStride = L.SEAT_W + L.COL_GAP
    let groupLeft = L.PAD_L

    for (let g = 0; g < gc; g++) {
      const groupConfig = getGroupConfig(g)
      const groupW = groupConfig.columns * L.SEAT_W + Math.max(0, groupConfig.columns - 1) * L.COL_GAP
      const c = Math.round((x - groupLeft) / colStride)
      const firstColumnLeft = groupLeft - L.SEAT_W / 2
      const lastColumnRight = groupLeft + Math.max(0, groupConfig.columns - 1) * colStride + L.SEAT_W / 2

      if (x >= firstColumnLeft && x <= lastColumnRight && c >= 0 && c < groupConfig.columns) {
        const rowStride = L.SEAT_H + L.ROW_GAP
        const r = Math.round((y - L.PAD_T - L.LABEL_H) / rowStride)
        if (r < 0 || r >= groupConfig.rows) return null
        return { g, c, r }
      }

      groupLeft += groupW + L.GROUP_GAP
    }

    return null
  }

  const startDragPreview = (
    anchorSeatId: string,
    selectedSeatIds: string[],
    clientX: number,
    clientY: number
  ) => {
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

    positionPreviewElement()
  }

  const updateDragPreview = (clientX: number, clientY: number) => {
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

  const endDragPreview = (dropTargetSeatIds: string[] | null = null) => {
    if (!state.isActive) return

    void dropTargetSeatIds

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
    return new Set<string>()
  })

  const isGhostSeat = (seatId: string) => {
    return ghostSeatIds.value.has(seatId)
  }

  const previewItems = computed(() => {
    if (!state.isActive || !state.anchorSeatId) return []

    const getMeasuredSeatSize = () => {
      if (!chartEl) return { seatW: L.SEAT_W, seatH: L.SEAT_H }
      const seatEl = chartEl.querySelector('.seat-item')
      if (!seatEl) return { seatW: L.SEAT_W, seatH: L.SEAT_H }
      const rect = seatEl.getBoundingClientRect()
      return {
        seatW: rect.width > 0 ? rect.width : L.SEAT_W,
        seatH: rect.height > 0 ? rect.height : L.SEAT_H
      }
    }

    if (isGuardSeatId(state.anchorSeatId)) {
      const seat = getSeat(state.anchorSeatId)
      const student = students.value.find(s => s.id === seat?.studentId)
      const { seatW, seatH } = getMeasuredSeatSize()
      return [{
        seatId: state.anchorSeatId,
        studentId: seat?.studentId ?? null,
        student: student || null,
        isEmptySeat: !student,
        isAnchor: true,
        style: {
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${seatW}px`,
          height: `${seatH}px`
        }
      }]
    }

    const anchor = parseSeatId(state.anchorSeatId)

    let seatW = L.SEAT_W
    let seatH = L.SEAT_H
    let colGap = L.COL_GAP
    let rowGap = L.ROW_GAP
    let groupGap = L.GROUP_GAP

    if (chartEl) {
      const seatEl = chartEl.querySelector('.seat-item')
      if (seatEl) {
        const rect = seatEl.getBoundingClientRect()
        seatW = rect.width > 0 ? rect.width : L.SEAT_W
        seatH = rect.height > 0 ? rect.height : L.SEAT_H
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

    const toLayoutX = (position: ReturnType<typeof parseSeatId>) => {
      const globalColumn = toGlobalCol(position)
      return globalColumn * (seatW + colGap) + position.groupIndex * (groupGap - colGap)
    }
    const anchorX = toLayoutX(anchor)

    return state.selectedSeatIds.map(sid => {
      const parsed = parseSeatId(sid)

      const dx = toLayoutX(parsed) - anchorX
      const dy = (parsed.rowIndex * (seatH + rowGap)) - (anchor.rowIndex * (seatH + rowGap))

      const seat = getSeat(sid)
      const isAnchor = sid === state.anchorSeatId
      const student = students.value.find(s => s.id === seat?.studentId)

      return {
        seatId: sid,
        studentId: seat?.studentId ?? null,
        student: student || null,
        isEmptySeat: !student,
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
