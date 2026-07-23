<template>
  <div class="seat-chart-container">
    <div ref="viewportRef" class="seat-chart-viewport" :class="{ 'is-panning': isPanning }" @wheel.prevent="handleWheel"
      @click.capture="handleViewportClickCapture"
      @mousedown="handleMouseDown" @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp"
      @touchstart="handleTouchStart" @touchmove.prevent="handleTouchMove" @touchend="handleTouchEnd"
      @dragover.prevent="handleDragOver" @drop.prevent="handleDrop" @contextmenu.prevent="handleContextMenu">
      <div
        ref="chartRef"
        class="seat-chart"
        :class="seatConfig.podiumPosition === 'top' ? 'align-top' : 'align-bottom'"
        :style="chartTransformStyle"
      >
        <div class="seat-chart-body">
          <div v-if="showEditorRowNumbers" class="seat-group row-number-group">
            <div class="group-label row-number-label" aria-hidden="true">&nbsp;</div>
            <div class="row-number-column" aria-label="行号">
              <div
                v-for="rowNumber in editorRowNumbers"
                :key="rowNumber"
                class="row-number-item"
                :title="`第 ${rowNumber} 排`"
              >
                {{ rowNumber }}
              </div>
            </div>
          </div>
          <div class="seat-chart-main">
            <div v-if="seatConfig.podiumPosition === 'top'" class="podium-row">
              <SeatItem
                v-if="guardSeatLeft"
                :key="guardSeatLeftRenderKey"
                :seat="guardSeatLeft"
                class="guard-seat-item"
                @assign-student="handleAssignStudent"
                @clear-seat="handleClearSeat"
                @swap-seat="handleSwapSeat"
                @drag-start-seat="handleDragStartSeat"
                @drag-enter-seat="handleDragEnterSeat"
                @drag-end-seat="handleDragEndSeat"
                @edit-student="handleEditStudent"
              />
              <div v-else class="guard-seat-spacer" aria-hidden="true"></div>
              <div class="podium-block">讲台</div>
              <SeatItem
                v-if="guardSeatRight"
                :key="guardSeatRightRenderKey"
                :seat="guardSeatRight"
                class="guard-seat-item"
                @assign-student="handleAssignStudent"
                @clear-seat="handleClearSeat"
                @swap-seat="handleSwapSeat"
                @drag-start-seat="handleDragStartSeat"
                @drag-enter-seat="handleDragEnterSeat"
                @drag-end-seat="handleDragEndSeat"
                @edit-student="handleEditStudent"
              />
              <div v-else class="guard-seat-spacer" aria-hidden="true"></div>
            </div>

            <div class="seat-groups">
              <div v-for="(group, groupIndex) in organizedSeats" :key="groupIndex" class="seat-group">
                <div class="group-label">第 {{ groupIndex + 1 }} 组</div>
                <div class="group-content">
                  <div v-for="(column, columnIndex) in group" :key="columnIndex" class="seat-column">
                    <SeatItem v-for="seat in column" :key="seat.id" :seat="seat"
                      :is-drop-target="dropTargetSeatIds.has(seat.id)"
                      @assign-student="handleAssignStudent"
                      @toggle-empty="handleToggleEmpty" @clear-seat="handleClearSeat" @swap-seat="handleSwapSeat"
                      @drag-start-seat="handleDragStartSeat"
                      @drag-enter-seat="handleDragEnterSeat"
                      @drag-end-seat="handleDragEndSeat"
                      @edit-student="handleEditStudent" />
                  </div>
                </div>
              </div>
            </div>

            <div v-if="seatConfig.podiumPosition !== 'top'" class="podium-row">
              <SeatItem
                v-if="guardSeatLeft"
                :key="guardSeatLeftRenderKey"
                :seat="guardSeatLeft"
                class="guard-seat-item"
                @assign-student="handleAssignStudent"
                @clear-seat="handleClearSeat"
                @swap-seat="handleSwapSeat"
                @drag-start-seat="handleDragStartSeat"
                @drag-enter-seat="handleDragEnterSeat"
                @drag-end-seat="handleDragEndSeat"
                @edit-student="handleEditStudent"
              />
              <div v-else class="guard-seat-spacer" aria-hidden="true"></div>
              <div class="podium-block">讲台</div>
              <SeatItem
                v-if="guardSeatRight"
                :key="guardSeatRightRenderKey"
                :seat="guardSeatRight"
                class="guard-seat-item"
                @assign-student="handleAssignStudent"
                @clear-seat="handleClearSeat"
                @swap-seat="handleSwapSeat"
                @drag-start-seat="handleDragStartSeat"
                @drag-enter-seat="handleDragEnterSeat"
                @drag-end-seat="handleDragEndSeat"
                @edit-student="handleEditStudent"
              />
              <div v-else class="guard-seat-spacer" aria-hidden="true"></div>
            </div>
          </div>
        </div>

        <!-- 选区轮换 SVG 箭头叠加层 -->
        <svg v-if="showOverlay" class="zone-arrows-svg" aria-hidden="true">
          <defs>
            <!-- 为每条箭头定义专属 marker，避免颜色冲突 -->
            <template v-for="(gd, gi) in zoneArrowData" :key="gi">
              <marker v-for="arr in gd.arrows" :key="arr.markerId"
                :id="arr.markerId" markerWidth="8" markerHeight="6"
                refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                <polygon :fill="arr.color" points="0 0, 8 3, 0 6"/>
              </marker>
            </template>
          </defs>

          <template v-for="(gd, gi) in zoneArrowData" :key="gi">
            <!-- 箭头线 -->
            <line v-for="(arr, ai) in gd.arrows" :key="ai"
              :x1="arr.x1" :y1="arr.y1" :x2="arr.x2" :y2="arr.y2"
              :stroke="arr.color" stroke-width="2.5" stroke-linecap="round"
              :marker-end="`url(#${arr.markerId})`" opacity="0.85"/>

            <!-- 各选区圆形标记 + 名称 -->
            <g v-for="(circ, ci) in gd.circles" :key="ci">
              <circle :cx="circ.x" :cy="circ.y" r="20"
                :fill="circ.color" fill-opacity="0.25"
                :stroke="circ.color" stroke-width="2.5"/>
              <text :x="circ.x" :y="circ.y + 4"
                text-anchor="middle" font-size="11" font-weight="600"
                :fill="circ.color">{{ circ.label }}</text>
            </g>
          </template>
        </svg>
      </div>

      <!-- 矩形框选叠加层 -->
      <div v-if="isRectSelecting" class="rect-select-overlay" :style="rectSelectStyle"></div>
    </div>

    <!-- 学生编辑弹窗 -->
    <StudentEditDialog
      v-model:visible="showStudentEditDialog"
      :studentId="editingStudentId"
    />

    <!-- 浮动拖拽预览 -->
    <Teleport v-if="dragPreviewState.isActive" to="body">
      <div ref="dragPreviewRef" class="drag-preview-overlay">
        <div v-for="item in previewItems" :key="item.seatId"
          class="drag-preview-seat"
          :class="{ 'is-anchor': item.isAnchor, 'is-empty': item.isEmptySeat }"
          :style="item.style">
          <StudentCardFace
            v-if="item.student"
            :student="item.student"
            variant="seat"
            density="standard"
          />
          <span v-else class="drag-preview-name">{{ item.isEmptySeat ? '空位' : '未命名' }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { mobileWorkbenchMediaQuery } from '@/constants/layout'
import SeatItem from './SeatItem.vue'
import StudentCardFace from '@/components/student/StudentCardFace.vue'
import StudentEditDialog from '@/components/student/StudentEditDialog.vue'
import { useSeatChart } from '@/composables/useSeatChart'
import { useEditMode } from '@/composables/useEditMode'
import { useStudentData } from '@/composables/useStudentData'
import { useZoom } from '@/composables/useZoom'
import { useZoneRotation } from '@/composables/useZoneRotation'
import { useUndo } from '@/composables/useUndo'
import { useDragState } from '@/composables/useDragState'
import { useSelection } from '@/composables/useSelection'
import { useDragPreview } from '@/composables/useDragPreview'
import { useLayoutConstants } from '@/composables/useLayoutConstants'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { parseSeatId } from '@/utils/seatHelpers'
import { getRowNumber } from '@/utils/exportLayout'
import type { RotationZone, Seat } from '@/types/models'

// Fisher-Yates 洗牌算法
const shuffleArray = <T,>(array: readonly T[]): T[] => {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const {
  seatConfig,
  seats,
  organizedSeats,
  visibleGuardSeats,
  initializeSeats,
  assignStudent,
  toggleEmpty,
  clearSeat,
  swapSeats,
  moveSelection,
  findSeatByStudent,
  getStudentAtSeat,
  getSeat,
  isGuardSeatId,
  toGlobalCol,
  getTranslatedSeatId
} = useSeatChart()

const { firstSelectedSeat, setFirstSelectedSeat, clearFirstSelectedSeat } = useEditMode()
const { clearSelection: clearStudentSelection, students } = useStudentData()
const { scale, panX, panY, zoomIn, zoomOut, setScale, MIN_SCALE, MAX_SCALE, registerViewport, fitToViewport } = useZoom()
const { recordBatch, createSnapshot, canUndo, canRedo, undo, redo } = useUndo()
const {
  isDraggingFromSeat: globalIsDraggingFromSeat,
  isTouchDraggingFromSeat,
  requestDragCleanup,
  endDragFromSeat,
  endTouchDragFromSeat
} = useDragState()
const {
  clearSelection: clearSeatSelection,
  selectedSeatIds,
  selectedSeatsArray,
  selectedCount,
  addSeatToSelection,
  selectSingleSeat,
  setSelection,
  startSelection,
  updateSelection,
  endSelection,
  suppressContextSelectionOnce,
  isSelectionMode,
  toggleSelectionMode
} = useSelection()
const {
  dragPreviewState,
  isGhostSeat,
  previewItems,
  registerChartElement,
  registerPreviewElement,
  updateDragPreview,
  endDragPreview
} = useDragPreview()
const { setRightRailTab, showMobileSheet, closeMobileDrawer } = useEditorWorkbench()

const dragPreviewRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const chartRef = ref<HTMLElement | null>(null)
const isPanning = ref(false)

// 多选拖拽落点高亮
const currentDragAnchorSeatId = ref<string | null>(null)
const currentDragTargetSeatId = ref<string | null>(null)
const dropTargetSeatIds = computed(() => {
  if (!currentDragTargetSeatId.value || !currentDragAnchorSeatId.value || selectedCount.value <= 1) return new Set<string>()
  if (isGuardSeatId(currentDragTargetSeatId.value) || isGuardSeatId(currentDragAnchorSeatId.value)) return new Set<string>()

  const anchor = getSeat(currentDragAnchorSeatId.value)
  const target = getSeat(currentDragTargetSeatId.value)
  if (!anchor || !target || anchor.isEmpty || target.isEmpty) return new Set<string>()

  const offsetCol = toGlobalCol(target) - toGlobalCol(anchor)
  const offsetRow = target.rowIndex - anchor.rowIndex
  if (toGlobalCol(anchor) < 0 || toGlobalCol(target) < 0) return new Set<string>()

  const targets = new Set<string>()
  for (const sid of selectedSeatsArray.value) {
    const source = getSeat(sid)
    if (!source || source.isEmpty || isGuardSeatId(source.id)) return new Set<string>()
    if (source.studentId === null) continue

    const destinationId = getTranslatedSeatId(sid, offsetCol, offsetRow)
    if (!destinationId) return new Set<string>()
    const destination = getSeat(destinationId)
    if (!destination || destination.isEmpty || isGuardSeatId(destination.id)) return new Set<string>()
    targets.add(destinationId)
  }

  return targets
})

// 响应式断点检测
const isMobileWorkbench = useMediaQuery(mobileWorkbenchMediaQuery)

// 候选区是否已隐藏（所有学生均已入座）
const candidateAreaHidden = computed(() => {
  return students.value.length > 0 && students.value.every(s => findSeatByStudent(s.id))
})

// 是否显示功能栏的移出放置区
const showDropZone = computed(() => globalIsDraggingFromSeat.value && candidateAreaHidden.value)

const focusSeatContext = (seatId: string) => {
  if (!seatId || isGuardSeatId(seatId)) return
  selectSingleSeat(seatId)
  setRightRailTab('selection')
  if (isMobileWorkbench.value) showMobileSheet('context')
}

// ==================== 变换样式 ====================
const chartTransformStyle = computed(() => ({
  transform: `translate(calc(-50% + ${panX.value}px), calc(-50% + ${panY.value}px)) scale(${scale.value})`,
  transformOrigin: 'center center',
  willChange: 'transform' // 提示浏览器优化渲染
}))

// ==================== 鼠标拖拽平移 ====================
let mouseDown = false
let startMouseX = 0
let startMouseY = 0
let startPanX = 0
let startPanY = 0
let mouseMoved = false
let panRafId: number | null = null
let suppressNextClick = false

// rAF 批量更新 pan（避免每次 mousemove 都触发 Vue 重新渲染）
const schedulePanUpdate = (x: number, y: number) => {
  if (panRafId) return // 已有待处理帧
  panRafId = requestAnimationFrame(() => {
    panRafId = null
    panX.value = x
    panY.value = y
  })
}

// 立即刷新 pan（用于最终位置）
const flushPan = (x: number, y: number) => {
  if (panRafId) { cancelAnimationFrame(panRafId); panRafId = null }
  panX.value = x
  panY.value = y
}

let pendingPanX = 0
let pendingPanY = 0

let rightMouseDown = false
let rightStartX = 0
let rightStartY = 0
let rightStartSeatId: string | null = null
let leftSelectionMouseDown = false
let leftSelectionStartX = 0
let leftSelectionStartY = 0

// 矩形框选状态
const isRectSelecting = ref(false)
const rectSelectStart = ref({ x: 0, y: 0 })
const rectSelectEnd = ref({ x: 0, y: 0 })

const handleMouseDown = (e: MouseEvent) => {
  if (e.button === 0 && isSelectionMode.value) {
    const seatEl = findSeatElement(e.target)
    const seatId = seatEl?.dataset?.seatId
    if (seatId && !isGuardSeatId(seatId)) {
      leftSelectionMouseDown = true
      mouseMoved = false
      leftSelectionStartX = e.clientX
      leftSelectionStartY = e.clientY
      startSelection(seatId)
      setRightRailTab('selection')
      e.preventDefault()
      return
    }
  }

  if (e.button === 2) {
    // Shift+右键：矩形框选模式
    if (e.shiftKey) {
      isRectSelecting.value = true
      rectSelectStart.value = { x: e.clientX, y: e.clientY }
      rectSelectEnd.value = { x: e.clientX, y: e.clientY }
      e.preventDefault()
      return
    }
    
    // 普通右键：涂抹选择模式
    rightMouseDown = true
    mouseMoved = false
    rightStartX = e.clientX
    rightStartY = e.clientY
    const seatEl = findSeatElement(e.target)
    rightStartSeatId = seatEl?.dataset.seatId || null
    startSelection()
    e.preventDefault()
    return
  }

  // 空白区域、中键或无学生座位可启动视图平移
  if (e.button === 1 || (e.button === 0 && canStartPanFromTarget(e.target))) {
    mouseDown = true
    mouseMoved = false
    startMouseX = e.clientX
    startMouseY = e.clientY
    startPanX = panX.value
    startPanY = panY.value
    e.preventDefault()
  }
}

const handleMouseMove = (e: MouseEvent) => {
  // 矩形框选模式：更新结束位置
  if (isRectSelecting.value) {
    rectSelectEnd.value = { x: e.clientX, y: e.clientY }
    return
  }

  if (leftSelectionMouseDown) {
    const dx = e.clientX - leftSelectionStartX
    const dy = e.clientY - leftSelectionStartY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      mouseMoved = true
    }
    const seatEl = findSeatElement(e.target)
    if (seatEl && seatEl.dataset.seatId && !isGuardSeatId(seatEl.dataset.seatId)) {
      updateSelection(seatEl.dataset.seatId)
    }
    return
  }

  if (rightMouseDown) {
    const dx = e.clientX - rightStartX
    const dy = e.clientY - rightStartY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      mouseMoved = true
      suppressContextSelectionOnce(5000)
    }
    const seatEl = findSeatElement(e.target)
    if (seatEl && seatEl.dataset.seatId && !isGuardSeatId(seatEl.dataset.seatId)) {
      updateSelection(seatEl.dataset.seatId)
    }
    return
  }

  if (!mouseDown) return
  const dx = e.clientX - startMouseX
  const dy = e.clientY - startMouseY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    mouseMoved = true
    isPanning.value = true
  }
  pendingPanX = startPanX + dx
  pendingPanY = startPanY + dy
  schedulePanUpdate(pendingPanX, pendingPanY)
}

const handleMouseUp = (e: MouseEvent) => {
  // 完成矩形框选
  if (isRectSelecting.value) {
    selectSeatsInRect()
    isRectSelecting.value = false
    return
  }

  if (leftSelectionMouseDown) {
    endSelection()
    leftSelectionMouseDown = false
    if (e?.type !== 'mouseleave') {
      suppressNextClick = true
    }
    return
  }

  if (rightMouseDown) {
    if (!mouseMoved && rightStartSeatId && !isGuardSeatId(rightStartSeatId)) {
      addSeatToSelection(rightStartSeatId)
    } else if (mouseMoved) {
      suppressContextSelectionOnce()
    }
    endSelection()
    if (selectedCount.value > 0) {
      setRightRailTab('selection')
    }
    rightMouseDown = false
    rightStartSeatId = null
    return
  }

  if (mouseDown && mouseMoved) {
    flushPan(pendingPanX, pendingPanY)
    suppressNextClick = true
  }
  mouseDown = false
  isPanning.value = false
}

const handleViewportClickCapture = (e: MouseEvent) => {
  if (
    document.body?.classList.contains('student-dragging-from-candidate') ||
    document.body?.classList.contains('student-drag-ended-from-candidate')
  ) {
    e.preventDefault()
    e.stopPropagation()
    return
  }

  if (suppressNextClick) {
    suppressNextClick = false
    e.preventDefault()
    e.stopPropagation()
    return
  }

  if (!findSeatElement(e.target) && selectedCount.value > 0) {
    clearSeatSelection()
  }

  if (isMobileWorkbench.value && !findSeatElement(e.target)) {
    closeMobileDrawer()
  }
}

const isPannableEmptySeatTarget = (el: EventTarget | null) => {
  if (isSelectionMode.value) return false
  const seatEl = findSeatElement(el)
  if (!seatEl?.dataset?.seatId) return false
  const seat = getSeat(seatEl.dataset.seatId)
  return Boolean(seat && seat.studentId === null)
}

const canStartPanFromTarget = (el: EventTarget | null) => {
  return !isInteractiveTarget(el) || isPannableEmptySeatTarget(el)
}

// 判断是否为可交互元素（座位、按钮等）
const isInteractiveTarget = (el: EventTarget | null) => {
  let cur = el instanceof HTMLElement ? el : null
  while (cur && cur !== viewportRef.value) {
    if (cur.dataset?.seatId || cur.tagName === 'BUTTON' || cur.tagName === 'INPUT') {
      return true
    }
    if (cur.classList?.contains('seat-item')) {
      return true
    }
    cur = cur.parentElement
  }
  return false
}

// ==================== 触摸手势 ====================
let lastTouchDistance = 0
let lastTouchScale = 1
let touchPanStartX = 0
let touchPanStartY = 0
let touchStartPanX = 0
let touchStartPanY = 0
let touchPanMoved = false
let touchMode: '' | 'pan' | 'pinch' = ''
let touchRafId: number | null = null

const getTouchDistance = (touches: TouchList) => {
  const first = touches.item(0)
  const second = touches.item(1)
  if (!first || !second) return 0
  const dx = first.clientX - second.clientX
  const dy = first.clientY - second.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

const cancelSeatTouchDragForPinch = () => {
  if (isTouchDraggingFromSeat.value) {
    endTouchDragFromSeat()
  } else {
    requestDragCleanup()
  }
}

const startPinchTouch = (touches: TouchList) => {
  cancelSeatTouchDragForPinch()
  touchMode = 'pinch'
  lastTouchDistance = getTouchDistance(touches)
  lastTouchScale = scale.value
  touchPanMoved = false
  isPanning.value = false
}

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length >= 2) {
    // 双指缩放
    startPinchTouch(e.touches)
  } else if (e.touches.length === 1 && canStartPanFromTarget(e.target)) {
    // 单指拖拽平移（空白区域或无学生座位）
    touchMode = 'pan'
    const touch = e.touches.item(0)
    if (!touch) return
    touchPanStartX = touch.clientX
    touchPanStartY = touch.clientY
    touchStartPanX = panX.value
    touchStartPanY = panY.value
    pendingPanX = touchStartPanX
    pendingPanY = touchStartPanY
    touchPanMoved = false
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length >= 2 && touchMode !== 'pinch') {
    startPinchTouch(e.touches)
  }

  if (touchMode === 'pinch' && e.touches.length === 2) {
    const currentDistance = getTouchDistance(e.touches)
    const ratio = currentDistance / lastTouchDistance
    const newScale = lastTouchScale * ratio
    if (touchRafId) cancelAnimationFrame(touchRafId)
    touchRafId = requestAnimationFrame(() => {
      touchRafId = null
      setScale(newScale)
    })
  } else if (touchMode === 'pan' && e.touches.length === 1) {
    const touch = e.touches.item(0)
    if (!touch) return
    const dx = touch.clientX - touchPanStartX
    const dy = touch.clientY - touchPanStartY
    pendingPanX = touchStartPanX + dx
    pendingPanY = touchStartPanY + dy
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      touchPanMoved = true
      isPanning.value = true
    }
    schedulePanUpdate(pendingPanX, pendingPanY)
  }
}

const handleTouchEnd = () => {
  if (touchMode === 'pan') {
    flushPan(pendingPanX, pendingPanY)
    if (touchPanMoved) {
      suppressNextClick = true
    }
  }
  if (touchRafId) { cancelAnimationFrame(touchRafId); touchRafId = null }
  touchMode = ''
  lastTouchDistance = 0
  touchPanMoved = false
  isPanning.value = false
}

// ==================== 鼠标滚轮缩放 ====================
let wheelRafId: number | null = null

const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    // Ctrl+滚轮 = 缩放
    if (e.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
  } else {
    // 普通滚轮 = 平移（rAF 节流）
    pendingPanX = panX.value - e.deltaX
    pendingPanY = panY.value - e.deltaY
    if (wheelRafId) cancelAnimationFrame(wheelRafId)
    wheelRafId = requestAnimationFrame(() => {
      wheelRafId = null
      panX.value = pendingPanX
      panY.value = pendingPanY
    })
  }
}

// ==================== 拖放处理 ====================
const handleDragStartSeat = (seatId: string, isSelection: boolean) => {
  if (isSelection) {
    currentDragAnchorSeatId.value = seatId
  } else {
    currentDragAnchorSeatId.value = null
  }
}

const handleDragEnterSeat = (seatId: string) => {
  currentDragTargetSeatId.value = seatId
}

const handleDragEndSeat = () => {
  currentDragAnchorSeatId.value = null
  currentDragTargetSeatId.value = null
}

type DragPayload =
  | { type: 'student'; studentId: number }
  | { type: 'seat'; seatId: string; selectedSeatIds?: string[] }

const parseDragPayload = (raw: string): DragPayload | null => {
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value)) return null
    if (value.type === 'student' && typeof value.studentId === 'number') {
      return { type: 'student', studentId: value.studentId }
    }
    if (value.type === 'seat' && typeof value.seatId === 'string') {
      return {
        type: 'seat',
        seatId: value.seatId,
        ...(isStringArray(value.selectedSeatIds) ? { selectedSeatIds: value.selectedSeatIds } : {})
      }
    }
    return null
  } catch {
    return null
  }
}

const handleDragOver = (e: DragEvent) => {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  if (dragPreviewState.isActive) {
    updateDragPreview(e.clientX, e.clientY)
  }
}

const handleDrop = (e: DragEvent) => {
  currentDragAnchorSeatId.value = null
  currentDragTargetSeatId.value = null
  const raw = getDragData(e)
  if (!raw) {
    endDragPreview()
    return
  }

  try {
    const data = parseDragPayload(raw)
    if (!data) {
      endDragPreview()
      return
    }
    const targetEl = findSeatElement(e.target)
    if (!targetEl) {
      endDragPreview()
      return
    }
    const targetSeatId = targetEl.dataset.seatId
    if (!targetSeatId) {
      endDragPreview()
      return
    }

    if (data.type === 'student') {
      handleAssignStudent(targetSeatId, data.studentId)
      focusSeatContext(targetSeatId)
      endDragPreview([targetSeatId])
    } else if (data.type === 'seat') {
      if (data.selectedSeatIds && data.selectedSeatIds.length > 1) {
        if (isGuardSeatId(targetSeatId) || isGuardSeatId(data.seatId) || data.selectedSeatIds.some(isGuardSeatId)) {
          endDragPreview()
          clearSeatSelection()
          return
        }
        // 选区拖拽
        if (data.seatId !== targetSeatId) {
          const beforeSnapshot = createSnapshot()
          const movableSeatIds = data.selectedSeatIds.filter(seatId => getSeat(seatId)?.studentId !== null)
          const moved = moveSelection(data.selectedSeatIds, data.seatId, targetSeatId)
          if (moved) {
            const afterSnapshot = createSnapshot()
            recordBatch(beforeSnapshot, afterSnapshot)
            const anchor = parseSeatId(data.seatId)
            const target = parseSeatId(targetSeatId)
            const offsetCol = toGlobalCol(target) - toGlobalCol(anchor)
            const offsetRow = target.rowIndex - anchor.rowIndex

            const destIds = movableSeatIds.flatMap(sid => {
              const destinationId = getTranslatedSeatId(sid, offsetCol, offsetRow)
              return destinationId ? [destinationId] : []
            })
            endDragPreview(destIds)
          } else {
            endDragPreview()
          }
        } else {
          endDragPreview()
        }
        clearSeatSelection()
      } else if (data.seatId !== targetSeatId) {
        const swapped = swapSeats(data.seatId, targetSeatId)
        if (swapped) {
          focusSeatContext(targetSeatId)
          endDragPreview([targetSeatId])
        } else {
          endDragPreview()
        }
        clearSeatSelection()
      } else {
        endDragPreview()
      }
    } else {
      endDragPreview()
    }
  } catch {
    endDragPreview()
  } finally {
    endDragFromSeat()
    endDragPreview()
  }
}

// ==================== 功能栏拖放（移出学生） ====================
const handleToolbarDragOver = (e: DragEvent) => {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

const handleToolbarDragLeave = () => {
  // 保持 isDraggingFromSeat 不变，仅用于视觉反馈
}

const handleToolbarDrop = (e: DragEvent) => {
  const raw = getDragData(e)
  if (!raw) return

  try {
    const data = parseDragPayload(raw)
    if (!data) return
    if (data.type === 'seat' && data.seatId) {
      clearSeat(data.seatId)
      clearSeatSelection()
    }
  } catch {
    // ignore
  }
}

const findSeatElement = (el: EventTarget | null): HTMLElement | null => {
  let current = el instanceof HTMLElement ? el : null
  while (current && current !== viewportRef.value) {
    if (current.dataset && current.dataset.seatId) {
      return current
    }
    current = current.parentElement
  }
  return null
}

const getDragData = (e: DragEvent) => {
  return e.dataTransfer?.getData('application/json') || e.dataTransfer?.getData('text/plain') || ''
}

// 矩形框选：选中矩形区域内的所有座位
const selectSeatsInRect = () => {
  if (!viewportRef.value) return

  const x1 = Math.min(rectSelectStart.value.x, rectSelectEnd.value.x)
  const y1 = Math.min(rectSelectStart.value.y, rectSelectEnd.value.y)
  const x2 = Math.max(rectSelectStart.value.x, rectSelectEnd.value.x)
  const y2 = Math.max(rectSelectStart.value.y, rectSelectEnd.value.y)

  // 如果矩形太小（小于5px），不执行选择
  if (x2 - x1 < 5 && y2 - y1 < 5) return

  const viewportRect = viewportRef.value.getBoundingClientRect()
  const seatElements = viewportRef.value.querySelectorAll<HTMLElement>('[data-seat-id]')
  const seatIdsToSelect: string[] = []

  seatElements.forEach(el => {
    const seatId = el.dataset.seatId
    if (!seatId || isGuardSeatId(seatId)) return
    const rect = el.getBoundingClientRect()
    const seatCenterX = rect.left + rect.width / 2
    const seatCenterY = rect.top + rect.height / 2

    // 判断座位中心点是否在矩形框内
    if (seatCenterX >= x1 && seatCenterX <= x2 && seatCenterY >= y1 && seatCenterY <= y2) {
      seatIdsToSelect.push(seatId)
    }
  })

  if (seatIdsToSelect.length > 0) {
    setSelection(seatIdsToSelect)
  }
}

// ==================== 触摸自定义事件 ====================
interface TouchSeatDropDetail {
  sourceSeatId: string
  targetSeatId: string
  isSelection: boolean
  selectedSeatIds: string[]
}

interface TouchStudentDropDetail {
  studentId: number
  targetSeatId: string
}

interface TouchSeatToListDetail {
  seatId: string
  isSelection: boolean
  selectedSeatIds: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every(item => typeof item === 'string')
)

const readCustomDetail = (event: Event): unknown => (
  event instanceof CustomEvent ? event.detail : null
)

const isTouchSeatDropDetail = (value: unknown): value is TouchSeatDropDetail => (
  isRecord(value) &&
  typeof value.sourceSeatId === 'string' &&
  typeof value.targetSeatId === 'string' &&
  typeof value.isSelection === 'boolean' &&
  isStringArray(value.selectedSeatIds)
)

const isTouchStudentDropDetail = (value: unknown): value is TouchStudentDropDetail => (
  isRecord(value) &&
  typeof value.studentId === 'number' &&
  typeof value.targetSeatId === 'string'
)

const isTouchSeatToListDetail = (value: unknown): value is TouchSeatToListDetail => (
  isRecord(value) &&
  typeof value.seatId === 'string' &&
  typeof value.isSelection === 'boolean' &&
  isStringArray(value.selectedSeatIds)
)

const handleTouchSeatDrop = (e: Event) => {
  const detail = readCustomDetail(e)
  if (!isTouchSeatDropDetail(detail)) return
  const { sourceSeatId, targetSeatId, isSelection, selectedSeatIds } = detail

  if (isSelection && selectedSeatIds && selectedSeatIds.length > 1) {
    if (isGuardSeatId(sourceSeatId) || isGuardSeatId(targetSeatId) || selectedSeatIds.some(isGuardSeatId)) {
      clearSeatSelection()
      return
    }
    // 选区拖拽：移动整个选区
    if (sourceSeatId !== targetSeatId) {
      const beforeSnapshot = createSnapshot()
      const moved = moveSelection(selectedSeatIds, sourceSeatId, targetSeatId)
      if (moved) {
        const afterSnapshot = createSnapshot()
        recordBatch(beforeSnapshot, afterSnapshot)
      }
    }
    clearSeatSelection()
  } else if (sourceSeatId !== targetSeatId) {
    if (swapSeats(sourceSeatId, targetSeatId)) {
      focusSeatContext(targetSeatId)
    }
  }
}

const handleTouchStudentDrop = (e: Event) => {
  const detail = readCustomDetail(e)
  if (!isTouchStudentDropDetail(detail)) return
  const { studentId, targetSeatId } = detail
  handleAssignStudent(targetSeatId, studentId)
  focusSeatContext(targetSeatId)
}

const handleTouchSeatToList = (e: Event) => {
  const detail = readCustomDetail(e)
  if (!isTouchSeatToListDetail(detail)) return
  const { seatId, isSelection, selectedSeatIds } = detail

  if (isSelection && selectedSeatIds && selectedSeatIds.length > 1) {
    const beforeSnapshot = createSnapshot()
    selectedSeatIds.forEach(sid => {
      const studentId = getStudentAtSeat(sid)
      if (studentId !== null) {
        clearSeat(sid, false)
      }
    })
    const afterSnapshot = createSnapshot()
    recordBatch(beforeSnapshot, afterSnapshot)
    clearSeatSelection()
  } else {
    clearSeat(seatId)
  }
}

// ==================== 全局拖拽状态追踪 ====================
const handleGlobalDragStart = (e: DragEvent) => {
  const el = e.target instanceof Element ? e.target : null
  const seatEl = el?.closest('[data-seat-id]')
  if (!(seatEl instanceof HTMLElement)) return
  const seatId = seatEl.dataset.seatId
  if (!seatId) return
  const seat = getSeat(seatId)
  if (seat && seat.studentId !== null && !seat.isEmpty) {
    globalIsDraggingFromSeat.value = true
  }
}

const handleGlobalDragEnd = () => {
  currentDragAnchorSeatId.value = null
  currentDragTargetSeatId.value = null
  endDragFromSeat()
  endDragPreview()
}

const handleGlobalDragOver = (e: DragEvent) => {
  if (dragPreviewState.isActive) {
    updateDragPreview(e.clientX, e.clientY)
  }
}

// ==================== 键盘快捷键 ====================
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (isMobileWorkbench.value && isSelectionMode.value) {
      toggleSelectionMode()
    } else {
      clearSeatSelection()
    }
  }
}

// 学生编辑弹窗
const showStudentEditDialog = ref(false)
const editingStudentId = ref<number | null>(null)

const handleContextMenu = (e: MouseEvent) => {
  const seatEl = findSeatElement(e.target)
  const seatId = seatEl?.dataset?.seatId
  if (!seatId || isGuardSeatId(seatId)) return

  if (!selectedSeatIds.value.has(seatId)) {
    addSeatToSelection(seatId)
  }
  setRightRailTab('selection')
  if (isMobileWorkbench.value) showMobileSheet('context')
}

// 处理双击编辑学生
const handleEditStudent = (studentId: number) => {
  editingStudentId.value = studentId
  showStudentEditDialog.value = true
}

// ====================  初始化 ====================
onMounted(() => {
  if (seats.value.length === 0) {
    initializeSeats()
  }
  registerViewport(viewportRef.value, chartRef.value)
  registerChartElement(chartRef.value)

  if (viewportRef.value) {
    viewportRef.value.addEventListener('touch-seat-drop', handleTouchSeatDrop)
  }
  document.addEventListener('touch-seat-to-list', handleTouchSeatToList)
  document.addEventListener('touch-student-drop', handleTouchStudentDrop)
  document.addEventListener('dragstart', handleGlobalDragStart)
  document.addEventListener('dragend', handleGlobalDragEnd)
  document.addEventListener('dragover', handleGlobalDragOver)
  document.addEventListener('keydown', handleKeyDown)

  // 首次自适应
  nextTick(() => {
    setTimeout(fitToViewport, 100)
  })
})

onUnmounted(() => {
  if (viewportRef.value) {
    viewportRef.value.removeEventListener('touch-seat-drop', handleTouchSeatDrop)
  }
  document.removeEventListener('touch-seat-to-list', handleTouchSeatToList)
  document.removeEventListener('touch-student-drop', handleTouchStudentDrop)
  document.removeEventListener('dragstart', handleGlobalDragStart)
  document.removeEventListener('dragend', handleGlobalDragEnd)
  document.removeEventListener('dragover', handleGlobalDragOver)
  document.removeEventListener('keydown', handleKeyDown)
})

// 配置变化时重新自适应
watch(
  () => [
    seatConfig.value.groupCount,
    seatConfig.value.columnsPerGroup,
    seatConfig.value.seatsPerColumn,
    seatConfig.value.podiumPosition,
    seatConfig.value.guardSeats?.enabled,
    seatConfig.value.guardSeats?.leftEnabled,
    seatConfig.value.guardSeats?.rightEnabled
  ],
  () => {
    nextTick(() => {
      setTimeout(fitToViewport, 100)
    })
  }
)

watch(dragPreviewRef, (el) => {
  registerPreviewElement(el)
}, { flush: 'post' })

// 窗口大小变化时重新自适应
let resizeObserver: ResizeObserver | null = null
let removeViewportResizeListener: (() => void) | null = null

const startViewportResizeTracking = () => {
  if (!viewportRef.value) return

  if (typeof window.ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => {
      fitToViewport()
    })
    resizeObserver.observe(viewportRef.value)
    return
  }

  const handleViewportResize = () => fitToViewport()
  window.addEventListener('resize', handleViewportResize)
  removeViewportResizeListener = () => {
    window.removeEventListener('resize', handleViewportResize)
  }
}

onMounted(() => {
  startViewportResizeTracking()
})
onUnmounted(() => {
  resizeObserver?.disconnect()
  removeViewportResizeListener?.()
})

// 计算总座位数
const totalSeats = computed(() => {
  return seatConfig.value.groupCount *
    seatConfig.value.columnsPerGroup *
    seatConfig.value.seatsPerColumn
})

// 处理分配学生
const handleAssignStudent = (seatId: string, studentId: number) => {
  if (assignStudent(seatId, studentId)) {
    clearStudentSelection()
  }
}

// 处理切换空置状态
const handleToggleEmpty = (seatId: string) => {
  toggleEmpty(seatId)
}

// 处理清空座位
const handleClearSeat = (seatId: string) => {
  clearSeat(seatId)
}

// 处理交换座位
const handleSwapSeat = (seatId: string, sourceSeatId: string | null = null) => {
  if (sourceSeatId) {
    return swapSeats(sourceSeatId, seatId)
  } else {
    if (!firstSelectedSeat.value) {
      setFirstSelectedSeat(seatId)
    } else if (firstSelectedSeat.value === seatId) {
      clearFirstSelectedSeat()
    } else {
      if (swapSeats(firstSelectedSeat.value, seatId)) {
        clearFirstSelectedSeat()
      }
    }
  }
}

// ==================== 选区轮换 SVG 箭头 ====================
const { rotGroups, editingZoneId, PALETTE } = useZoneRotation()
const { LAYOUT: L } = useLayoutConstants()
const { settings } = useGlobalSettings()

const showEditorRowNumbers = computed(() => settings.value.ui.showEditorRowNumbers !== false)

const getGuardSeatInVisualSlot = (visualSide: 'left' | 'right') => {
  const seat = visibleGuardSeats.value.find(seat => seat.guardSide === visualSide) || null
  if (seat) {
    void seat.studentId
    void seat.isEmpty
  }
  return seat
}

const guardSeatLeft = computed(() => getGuardSeatInVisualSlot('left'))

const guardSeatRight = computed(() => getGuardSeatInVisualSlot('right'))

const getGuardSeatRenderKey = (seat: Seat | null) => (
  seat ? `${seat.id}:${seat.studentId ?? 'empty'}:${seat.isEmpty ? '1' : '0'}` : 'none'
)

const guardSeatLeftRenderKey = computed(() => getGuardSeatRenderKey(guardSeatLeft.value))

const guardSeatRightRenderKey = computed(() => getGuardSeatRenderKey(guardSeatRight.value))

const getColumnRowCount = (groupIndex: number, columnIndex: number) => {
  const column = organizedSeats.value?.[groupIndex]?.[columnIndex] || []
  if (column.length === 0) return 0
  return Math.max(column.length, ...column.map(seat => seat.rowIndex + 1))
}

const editorRowCount = computed(() => {
  const columnRowCounts = organizedSeats.value.flatMap(group => (
    group.map(column => (
      column.length === 0 ? 0 : Math.max(column.length, ...column.map(seat => seat.rowIndex + 1))
    ))
  ))

  return Math.max(seatConfig.value.seatsPerColumn || 0, ...columnRowCounts)
})

const editorRowNumbers = computed(() => {
  const rowCount = editorRowCount.value
  return Array.from({ length: rowCount }, (_, rowIndex) => (
    getRowNumber(rowIndex, rowCount, seatConfig.value.podiumPosition)
  ))
})

const getGroupColumnCount = (groupIndex: number) => {
  return seatConfig.value.groups?.[groupIndex]?.columns || seatConfig.value.columnsPerGroup
}

const getRowNumberSpace = () => {
  return showEditorRowNumbers.value ? L.ROW_NUMBER_W + L.GROUP_GAP : 0
}

const getPodiumTopOffset = () => {
  return seatConfig.value.podiumPosition === 'top' ? L.PODIUM_ROW_H + L.PODIUM_GAP : 0
}

const getGroupWidth = (groupIndex: number) => {
  const columnCount = getGroupColumnCount(groupIndex)
  return columnCount * L.SEAT_W + Math.max(0, columnCount - 1) * L.COL_GAP
}

const getGroupLeft = (groupIndex: number) => {
  let left = L.PAD_L + getRowNumberSpace()
  for (let i = 0; i < groupIndex; i++) {
    left += getGroupWidth(i) + L.GROUP_GAP
  }
  return left
}

interface Point {
  x: number
  y: number
}

const getSeatCenter = (seatId: string): Point | null => {
  if (typeof seatId !== 'string') return null
  const {
    groupIndex: g,
    columnIndex: c,
    rowIndex: r
  } = parseSeatId(seatId)
  if (![g, c, r].every(Number.isInteger)) return null
  if (!organizedSeats.value?.[g]?.[c]?.some(seat => seat.id === seatId)) return null

  const rowOffset = seatConfig.value.podiumPosition === 'bottom'
    ? Math.max(0, editorRowCount.value - getColumnRowCount(g, c))
    : 0
  const seatOuterH = L.SEAT_H + L.SEAT_BORDER_W * 2

  return {
    x: getGroupLeft(g) + c * (L.SEAT_W + L.COL_GAP) + L.SEAT_W / 2,
    y: L.PAD_T + getPodiumTopOffset() + (rowOffset + r) * (seatOuterH + L.ROW_GAP) + seatOuterH / 2
  }
}

const getZoneCentroid = (zone: RotationZone): Point | null => {
  if (!zone.seatIds?.length) return null
  let sx = 0, sy = 0
  let count = 0
  zone.seatIds.forEach(sid => {
    const p = getSeatCenter(sid)
    if (!p) return
    sx += p.x
    sy += p.y
    count++
  })
  if (count === 0) return null
  return { x: sx / count, y: sy / count }
}

// 计算从 from 到 to 的调整端点（距圆心 R 处，留出箭头空间）
const adjustLine = (from: Point, to: Point, R = 24, endGap = 6) => {
  const dx = to.x - from.x, dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
  return {
    x1: from.x + dx / len * R,
    y1: from.y + dy / len * R,
    x2: to.x   - dx / len * (R + endGap),
    y2: to.y   - dy / len * (R + endGap)
  }
}

// 互换双向偏移线
const biDirLines = (cA: Point, cB: Point, offset = 8) => {
  const dx = cB.x - cA.x, dy = cB.y - cA.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return []
  const px = -dy / len * offset, py = dx / len * offset
  return [
    { from: { x: cA.x + px, y: cA.y + py }, to: { x: cB.x + px, y: cB.y + py } },
    { from: { x: cB.x - px, y: cB.y - py }, to: { x: cA.x - px, y: cA.y - py } }
  ]
}

// 所有箭头数据（只在编辑时计算）
const zoneArrowData = computed(() => {
  if (!editingZoneId.value) return []
  const res = []
  let colorIdx = 0
  for (const group of rotGroups.value) {
    const zones = group.zones
    const colors = zones.map(() => PALETTE[colorIdx++ % PALETTE.length])
    const centroids = zones.map(z => getZoneCentroid(z))
    const validCentroids = centroids.filter((centroid): centroid is Point => centroid !== null)
    if (validCentroids.length !== centroids.length || validCentroids.length < 2) continue
    const firstCentroid = validCentroids[0]
    const secondCentroid = validCentroids[1]
    if (!firstCentroid || !secondCentroid) continue

    const arrows = []
    const circles = validCentroids.map((centroid, index) => ({
      ...centroid,
      color: colors[index] ?? 'var(--color-primary)',
      label: zones[index]?.name ?? ''
    }))

    if (group.type === 'swap') {
      biDirLines(firstCentroid, secondCentroid).forEach(({ from, to }, idx) => {
        const adj = adjustLine(from, to, 24, 6)
        arrows.push({ ...adj, color: 'var(--color-mode-swap)', markerId: `sw-${group.id}-${idx}` })
      })
    } else {
      // cycle arrows: 0→1→2→...→n-1→0
      for (let i = 0; i < validCentroids.length; i++) {
        const from = validCentroids[i]
        const to = validCentroids[(i + 1) % validCentroids.length]
        if (!from || !to) continue
        const adj = adjustLine(from, to, 24, 6)
        arrows.push({ ...adj, color: 'var(--color-primary)', markerId: `cy-${group.id}-${i}` })
      }
    }
    res.push({ group, circles, arrows })
  }
  return res
})

const showOverlay = computed(() => editingZoneId.value !== null)

// 矩形框选样式
const rectSelectStyle = computed(() => {
  if (!isRectSelecting.value) return {}
  
  const x1 = Math.min(rectSelectStart.value.x, rectSelectEnd.value.x)
  const y1 = Math.min(rectSelectStart.value.y, rectSelectEnd.value.y)
  const x2 = Math.max(rectSelectStart.value.x, rectSelectEnd.value.x)
  const y2 = Math.max(rectSelectStart.value.y, rectSelectEnd.value.y)
  
  return {
    left: `${x1}px`,
    top: `${y1}px`,
    width: `${x2 - x1}px`,
    height: `${y2 - y1}px`
  }
})
</script>

<style scoped>
.zone-arrows-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  z-index: 5;
}

.drag-preview-overlay {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  will-change: transform;
}

.drag-preview-seat {
  position: absolute;
  box-sizing: border-box;
  border: var(--seat-card-border-width) solid var(--color-primary);
  border-radius: var(--seat-card-radius);
  background: var(--color-bg-selected);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  padding: 0;
  box-shadow: var(--seat-card-shadow-drag);
  opacity: 1;
}

.drag-preview-seat.is-empty {
  border-color: var(--color-border);
  background: var(--color-surface);
}

.drag-preview-name {
  max-width: 100%;
  padding: 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  font-size: var(--seat-card-placeholder-size);
  font-weight: 400;
  line-height: 1.2;
}

.drag-preview-seat.is-anchor {
  box-shadow: var(--seat-card-shadow-drag), 0 0 0 2px color-mix(in srgb, var(--color-info) 42%, transparent);
  z-index: 10;
}

.rect-select-overlay {
  position: fixed;
  background: color-mix(in srgb, var(--color-info) 15%, transparent);
  border: 2px solid var(--color-info);
  border-radius: 4px;
  pointer-events: none;
  z-index: 1000;
}

.seat-chart-container {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
  overflow: hidden;
}


/* 缩放视口 — 无滚动条 */
.seat-chart-viewport {
  flex: 1;
  overflow: hidden;
  position: relative;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  min-height: 0;
}

.seat-chart-viewport.is-panning {
  cursor: grabbing;
}

.seat-chart {
  --chart-main-gap: 18px;
  --chart-group-gap: 40px;
  --podium-row-height: 84px;
  display: inline-flex;
  align-items: flex-start;
  padding: 30px 20px;
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: center center;
  /* 默认居中，由 JS 控制 transform */
  margin-left: 0;
  margin-top: 0;
}

.seat-chart.align-top {
  align-items: center;
}

.seat-chart.align-bottom {
  align-items: center;
}

.seat-chart-body {
  display: inline-flex;
  justify-content: center;
  align-items: flex-start;
  gap: var(--chart-group-gap);
}

.seat-chart-main {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--chart-main-gap);
}

.seat-groups {
  display: inline-flex;
  justify-content: center;
  align-items: flex-start;
  gap: var(--chart-group-gap);
}

.podium-row {
  display: grid;
  grid-template-columns: var(--seat-card-width) minmax(220px, 320px) var(--seat-card-width);
  align-items: center;
  justify-content: center;
  gap: 20px;
  min-height: var(--podium-row-height);
  width: max-content;
  min-width: 100%;
}

.podium-block {
  height: 48px;
  border: 2px solid var(--color-primary);
  border-radius: 8px;
  color: var(--color-primary);
  background: var(--color-surface);
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.guard-seat-item,
.guard-seat-spacer {
  width: var(--seat-card-width);
}

.guard-seat-item {
  height: var(--seat-card-height);
}

.guard-seat-spacer {
  height: var(--seat-card-outer-height);
  visibility: hidden;
}

.seat-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.group-label {
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-primary);
  padding: 0px 0px;
  order: 1;
}

.group-content {
  display: flex;
  gap: 16px;
  order: 0;
}

.seat-chart.align-top .group-content {
  align-items: flex-start;
}

.seat-chart.align-bottom .group-content {
  align-items: flex-end;
}

.row-number-group {
  pointer-events: none;
}

.row-number-label {
  visibility: hidden;
}

.row-number-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 32px;
  order: 0;
}

.seat-chart.align-top .row-number-column {
  margin-top: calc(var(--podium-row-height) + var(--chart-main-gap));
}

.row-number-item {
  height: var(--seat-card-outer-height);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-disabled);
  font-size: 13px;
  font-weight: 400;
  box-sizing: border-box;
}

.seat-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: var(--seat-card-width);
}


@media (max-width: 1366px) and (min-width: 1025px) {

  .seat-chart {
    --chart-main-gap: 26px;
    --chart-group-gap: 26px;
    padding: 22px 14px;
  }

  .podium-row {
    grid-template-columns: var(--seat-card-width) minmax(200px, 280px) var(--seat-card-width);
    gap: 16px;
  }

  .seat-group {
    gap: 10px;
  }

  .group-label {
    font-size: 14px;
    padding: 6px 10px;
  }

  .group-content {
    gap: 12px;
  }

  .row-number-column {
    width: 30px;
    gap: 9px;
  }

  .row-number-item {
    font-size: 12px;
    border-radius: 7px;
  }

  .seat-column {
    gap: 9px;
  }
}

/* 小高度屏幕优化 */
@media (max-height: 820px) and (min-width: 1025px) {

  .seat-chart {
    --chart-main-gap: 24px;
    --chart-group-gap: 24px;
    padding: 18px 12px;
  }

  .podium-row {
    grid-template-columns: var(--seat-card-width) minmax(180px, 260px) var(--seat-card-width);
    gap: 14px;
  }

  .seat-group {
    gap: 8px;
  }

  .group-content {
    gap: 10px;
  }

  .row-number-column {
    width: 28px;
    gap: 8px;
  }

  .row-number-item {
    font-size: 11px;
    border-radius: 7px;
  }

  .seat-column {
    gap: 8px;
  }
}

/* ==================== 响应式 ==================== */
@media (max-width: 1024px) {
  .seat-chart-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }


  .seat-chart-viewport {
    flex: 1;
    min-height: 0;
  }

  .seat-chart {
    --chart-main-gap: 16px;
    --chart-group-gap: 16px;
    padding: 16px 10px;
  }

  .podium-row {
    grid-template-columns: var(--seat-card-width) minmax(156px, 220px) var(--seat-card-width);
    gap: 10px;
  }

  .group-label {
    font-size: 13px;
    padding: 6px 10px;
  }

  .group-content {
    gap: 8px;
  }

  .row-number-column {
    width: 24px;
    gap: 7px;
  }

  .row-number-item {
    font-size: 11px;
    border-radius: 7px;
  }

  .seat-column {
    gap: 7px;
  }

}

@media (max-width: 480px) {

  .seat-chart {
    --chart-main-gap: 10px;
    --chart-group-gap: 10px;
    padding: 12px 6px;
  }

  .podium-row {
    grid-template-columns: var(--seat-card-width) minmax(128px, 180px) var(--seat-card-width);
    gap: 6px;
  }

  .podium-block {
    height: 40px;
    font-size: 15px;
  }

  .group-label {
    font-size: 12px;
    padding: 5px 8px;
    border-radius: 6px;
  }

  .seat-group {
    gap: 8px;
  }

  .group-content {
    gap: 8px;
  }

  .row-number-column {
    width: 24px;
    gap: 6px;
  }

  .row-number-item {
    font-size: 10px;
    border-radius: 6px;
  }

  .seat-column {
    gap: 6px;
  }

}
</style>
