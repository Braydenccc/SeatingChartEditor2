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
    <Teleport to="body">
      <div v-show="dragPreviewState.isActive" ref="dragPreviewRef" class="drag-preview-overlay">
        <div v-for="item in previewItems" :key="item.seatId"
          class="drag-preview-seat" :class="{ 'is-anchor': item.isAnchor }" :style="item.style"
          v-html="item.contentHtml">
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import SeatItem from './SeatItem.vue'
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
import { parseSeatId, generateSeatId } from '@/utils/seatHelpers'
import { getRowNumber } from '@/utils/exportLayout'

// Fisher-Yates 洗牌算法
const shuffleArray = (array) => {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const {
  seatConfig,
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
  fromGlobalCol
} = useSeatChart()

const { firstSelectedSeat, setFirstSelectedSeat, clearFirstSelectedSeat } = useEditMode()
const { clearSelection: clearStudentSelection, students } = useStudentData()
const { scale, panX, panY, zoomIn, zoomOut, setScale, MIN_SCALE, MAX_SCALE, registerViewport, fitToViewport } = useZoom()
const { recordAssign, recordBatch, createSnapshot, canUndo, canRedo, undo, redo } = useUndo()
const { isDraggingFromSeat: globalIsDraggingFromSeat, endDragFromSeat } = useDragState()
const {
  clearSelection: clearSeatSelection,
  selectedSeatIds,
  selectedSeatsArray,
  selectedCount,
  addSeatToSelection,
  setSelection,
  startSelection,
  updateSelection,
  endSelection,
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
const { setRightRailTab, showMobileDrawer, closeMobileDrawer } = useEditorWorkbench()

const dragPreviewRef = ref(null)
const viewportRef = ref(null)
const chartRef = ref(null)
const isPanning = ref(false)

// 多选拖拽落点高亮
const currentDragAnchorSeatId = ref(null)
const currentDragTargetSeatId = ref(null)
const dropTargetSeatIds = computed(() => {
  if (!currentDragTargetSeatId.value || !currentDragAnchorSeatId.value || selectedCount.value <= 1) return new Set()
  if (isGuardSeatId(currentDragTargetSeatId.value) || isGuardSeatId(currentDragAnchorSeatId.value)) return new Set()

  const anchor = parseSeatId(currentDragAnchorSeatId.value)
  const target = parseSeatId(currentDragTargetSeatId.value)

  const offsetCol = toGlobalCol(target) - toGlobalCol(anchor)
  const offsetRow = target.rowIndex - anchor.rowIndex

  const targets = new Set()
  const gc = seatConfig.value.groupCount
  const cpg = seatConfig.value.columnsPerGroup
  const spc = seatConfig.value.seatsPerColumn

  for (const sid of selectedSeatsArray.value) {
    const src = parseSeatId(sid)
    const destGC = toGlobalCol(src) + offsetCol
    const destR = src.rowIndex + offsetRow
    const { groupIndex: destG, columnIndex: destC } = fromGlobalCol(destGC)

    // 检查是否在边界内
    if (destG >= 0 && destG < gc && destC >= 0 && destC < cpg && destR >= 0 && destR < spc) {
      targets.add(generateSeatId(destG, destC, destR))
    }
  }

  return targets
})

// 响应式断点检测
const isMobile = useMediaQuery('(max-width: 768px)')

// 候选区是否已隐藏（所有学生均已入座）
const candidateAreaHidden = computed(() => {
  return students.value.length > 0 && students.value.every(s => findSeatByStudent(s.id))
})

// 是否显示功能栏的移出放置区
const showDropZone = computed(() => globalIsDraggingFromSeat.value && candidateAreaHidden.value)

const focusSeatContext = (seatId) => {
  if (!seatId || isGuardSeatId(seatId)) return
  selectSingleSeat(seatId)
  setRightRailTab('selection')
  if (isMobile.value) showMobileDrawer('selection')
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
let panRafId = null
let suppressNextClick = false

// rAF 批量更新 pan（避免每次 mousemove 都触发 Vue 重新渲染）
const schedulePanUpdate = (x, y) => {
  if (panRafId) return // 已有待处理帧
  panRafId = requestAnimationFrame(() => {
    panRafId = null
    panX.value = x
    panY.value = y
  })
}

// 立即刷新 pan（用于最终位置）
const flushPan = (x, y) => {
  if (panRafId) { cancelAnimationFrame(panRafId); panRafId = null }
  panX.value = x
  panY.value = y
}

let pendingPanX = 0
let pendingPanY = 0

let rightMouseDown = false
let rightStartX = 0
let rightStartY = 0
let rightStartSeatId = null
let leftSelectionMouseDown = false
let leftSelectionStartX = 0
let leftSelectionStartY = 0

// 矩形框选状态
const isRectSelecting = ref(false)
const rectSelectStart = ref({ x: 0, y: 0 })
const rectSelectEnd = ref({ x: 0, y: 0 })

const handleMouseDown = (e) => {
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
    startSelection(null)
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

const handleMouseMove = (e) => {
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

const handleMouseUp = (e) => {
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
    }
    endSelection()
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

const handleViewportClickCapture = (e) => {
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

  if (isMobile.value && !findSeatElement(e.target)) {
    closeMobileDrawer()
  }
}

const isPannableEmptySeatTarget = (el) => {
  if (isSelectionMode.value) return false
  const seatEl = findSeatElement(el)
  if (!seatEl?.dataset?.seatId) return false
  const seat = getSeat(seatEl.dataset.seatId)
  return Boolean(seat && seat.studentId === null)
}

const canStartPanFromTarget = (el) => {
  return !isInteractiveTarget(el) || isPannableEmptySeatTarget(el)
}

// 判断是否为可交互元素（座位、按钮等）
const isInteractiveTarget = (el) => {
  let cur = el
  while (cur && cur !== viewportRef.value) {
    if (cur.dataset?.seatId || cur.tagName === 'BUTTON' || cur.tagName === 'INPUT') {
      return true
    }
    if (cur.classList?.contains('seat-item') || cur.classList?.contains('zoom-controls')) {
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
let touchMode = '' // 'pan' | 'pinch' | ''
let touchRafId = null

const getTouchDistance = (touches) => {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

const handleTouchStart = (e) => {
  if (e.touches.length === 2) {
    // 双指缩放
    touchMode = 'pinch'
    lastTouchDistance = getTouchDistance(e.touches)
    lastTouchScale = scale.value
  } else if (e.touches.length === 1 && canStartPanFromTarget(e.target)) {
    // 单指拖拽平移（空白区域或无学生座位）
    touchMode = 'pan'
    touchPanStartX = e.touches[0].clientX
    touchPanStartY = e.touches[0].clientY
    touchStartPanX = panX.value
    touchStartPanY = panY.value
    pendingPanX = touchStartPanX
    pendingPanY = touchStartPanY
    touchPanMoved = false
  }
}

const handleTouchMove = (e) => {
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
    const dx = e.touches[0].clientX - touchPanStartX
    const dy = e.touches[0].clientY - touchPanStartY
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
let wheelRafId = null

const handleWheel = (e) => {
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
const handleDragStartSeat = (seatId, isSelection) => {
  if (isSelection) {
    currentDragAnchorSeatId.value = seatId
  } else {
    currentDragAnchorSeatId.value = null
  }
}

const handleDragEnterSeat = (seatId) => {
  currentDragTargetSeatId.value = seatId
}

const handleDragEndSeat = () => {
  currentDragAnchorSeatId.value = null
  currentDragTargetSeatId.value = null
}

const handleDragOver = (e) => {
  e.dataTransfer.dropEffect = 'move'
  if (dragPreviewState.isActive) {
    updateDragPreview(e.clientX, e.clientY)
  }
}

const handleDrop = (e) => {
  currentDragAnchorSeatId.value = null
  currentDragTargetSeatId.value = null
  const raw = getDragData(e)
  if (!raw) {
    endDragPreview()
    return
  }

  try {
    const data = JSON.parse(raw)
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
          const moved = moveSelection(data.selectedSeatIds, data.seatId, targetSeatId)
          if (moved) {
            const afterSnapshot = createSnapshot()
            recordBatch(beforeSnapshot, afterSnapshot)
            const anchor = parseSeatId(data.seatId)
            const target = parseSeatId(targetSeatId)
            const offsetCol = toGlobalCol(target) - toGlobalCol(anchor)
            const offsetRow = target.rowIndex - anchor.rowIndex

            const destIds = data.selectedSeatIds.map(sid => {
              const src = parseSeatId(sid)
              const destGC = toGlobalCol(src) + offsetCol
              const destR = src.rowIndex + offsetRow
              const { groupIndex: destG, columnIndex: destC } = fromGlobalCol(destGC)
              return generateSeatId(destG, destC, destR)
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
        swapSeats(data.seatId, targetSeatId)
        focusSeatContext(targetSeatId)
        endDragPreview([targetSeatId])
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
const handleToolbarDragOver = (e) => {
  e.dataTransfer.dropEffect = 'move'
}

const handleToolbarDragLeave = () => {
  // 保持 isDraggingFromSeat 不变，仅用于视觉反馈
}

const handleToolbarDrop = (e) => {
  const raw = getDragData(e)
  if (!raw) return

  try {
    const data = JSON.parse(raw)
    if (data.type === 'seat' && data.seatId) {
      clearSeat(data.seatId)
      clearSeatSelection()
    }
  } catch {
    // ignore
  }
}

const findSeatElement = (el) => {
  let current = el
  while (current && current !== viewportRef.value) {
    if (current.dataset && current.dataset.seatId) {
      return current
    }
    current = current.parentElement
  }
  return null
}

const getDragData = (e) => {
  return e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain')
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
  const seatElements = viewportRef.value.querySelectorAll('[data-seat-id]')
  const seatIdsToSelect = []

  seatElements.forEach(el => {
    if (isGuardSeatId(el.dataset.seatId)) return
    const rect = el.getBoundingClientRect()
    const seatCenterX = rect.left + rect.width / 2
    const seatCenterY = rect.top + rect.height / 2

    // 判断座位中心点是否在矩形框内
    if (seatCenterX >= x1 && seatCenterX <= x2 && seatCenterY >= y1 && seatCenterY <= y2) {
      seatIdsToSelect.push(el.dataset.seatId)
    }
  })

  if (seatIdsToSelect.length > 0) {
    setSelection(seatIdsToSelect)
  }
}

// ==================== 触摸自定义事件 ====================
const handleTouchSeatDrop = (e) => {
  const { sourceSeatId, targetSeatId, isSelection, selectedSeatIds } = e.detail

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
    swapSeats(sourceSeatId, targetSeatId)
    focusSeatContext(targetSeatId)
  }
}

const handleTouchStudentDrop = (e) => {
  const { studentId, targetSeatId } = e.detail
  handleAssignStudent(targetSeatId, studentId)
  focusSeatContext(targetSeatId)
}

const handleTouchSeatToList = (e) => {
  const { seatId, isSelection, selectedSeatIds } = e.detail

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
const handleGlobalDragStart = (e) => {
  const el = e.target
  const seatEl = el.closest?.('[data-seat-id]')
  if (!seatEl) return
  const seatId = seatEl.dataset.seatId
  if (!seatId) return
  const seat = getSeat(seatId)
  if (seat && seat.studentId !== null && !seat.isEmpty) {
    globalIsDraggingFromSeat.value = true
  }
}

const handleGlobalDragEnd = () => {
  endDragFromSeat()
  endDragPreview()
}

const handleGlobalDragOver = (e) => {
  if (dragPreviewState.isActive) {
    updateDragPreview(e.clientX, e.clientY)
  }
}

// ==================== 键盘快捷键 ====================
const handleKeyDown = (e) => {
  if (e.key === 'Escape') {
    if (isMobile.value && isSelectionMode.value) {
      toggleSelectionMode()
    } else {
      clearSeatSelection()
    }
  }
}

// 学生编辑弹窗
const showStudentEditDialog = ref(false)
const editingStudentId = ref(null)

const handleContextMenu = (e) => {
  const seatEl = findSeatElement(e.target)
  const seatId = seatEl?.dataset?.seatId
  if (!seatId || isGuardSeatId(seatId)) return

  if (!selectedSeatIds.value.has(seatId)) {
    addSeatToSelection(seatId)
  }
  setRightRailTab('selection')
}

// 处理双击编辑学生
const handleEditStudent = (studentId) => {
  editingStudentId.value = studentId
  showStudentEditDialog.value = true
}

// ====================  初始化 ====================
onMounted(() => {
  initializeSeats()
  registerViewport(viewportRef.value, chartRef.value)
  registerChartElement(chartRef.value)
  registerPreviewElement(dragPreviewRef.value)

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

// 窗口大小变化时重新自适应
let resizeObserver = null
let removeViewportResizeListener = null

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
const handleAssignStudent = (seatId, studentId) => {
  const existingSeat = findSeatByStudent(studentId)
  const previousSeatId = existingSeat ? existingSeat.id : null
  if (existingSeat) {
    clearSeat(existingSeat.id, false)
  }
  assignStudent(seatId, studentId, false)
  clearStudentSelection()
  recordAssign(seatId, studentId, previousSeatId)
}

// 处理切换空置状态
const handleToggleEmpty = (seatId) => {
  toggleEmpty(seatId)
}

// 处理清空座位
const handleClearSeat = (seatId) => {
  clearSeat(seatId)
}

// 处理交换座位
const handleSwapSeat = (seatId, sourceSeatId = null) => {
  if (sourceSeatId) {
    swapSeats(sourceSeatId, seatId)
  } else {
    if (!firstSelectedSeat.value) {
      setFirstSelectedSeat(seatId)
    } else if (firstSelectedSeat.value === seatId) {
      clearFirstSelectedSeat()
    } else {
      swapSeats(firstSelectedSeat.value, seatId)
      clearFirstSelectedSeat()
    }
  }
}

// ==================== 选区轮换 SVG 箭头 ====================
const { rotGroups, editingZoneId, PALETTE } = useZoneRotation()
const { LAYOUT: L } = useLayoutConstants()
const { settings } = useGlobalSettings()

const showEditorRowNumbers = computed(() => settings.value.ui.showEditorRowNumbers !== false)

const getGuardSeatInVisualSlot = (visualSide) => {
  const seat = visibleGuardSeats.value.find(seat => seat.guardSide === visualSide) || null
  if (seat) {
    void seat.studentId
    void seat.isEmpty
  }
  return seat
}

const guardSeatLeft = computed(() => getGuardSeatInVisualSlot('left'))

const guardSeatRight = computed(() => getGuardSeatInVisualSlot('right'))

const getGuardSeatRenderKey = (seat) => (
  seat ? `${seat.id}:${seat.studentId ?? 'empty'}:${seat.isEmpty ? '1' : '0'}` : 'none'
)

const guardSeatLeftRenderKey = computed(() => getGuardSeatRenderKey(guardSeatLeft.value))

const guardSeatRightRenderKey = computed(() => getGuardSeatRenderKey(guardSeatRight.value))

const getColumnRowCount = (groupIndex, columnIndex) => {
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

const getGroupColumnCount = (groupIndex) => {
  return seatConfig.value.groups?.[groupIndex]?.columns || seatConfig.value.columnsPerGroup
}

const getRowNumberSpace = () => {
  return showEditorRowNumbers.value ? L.ROW_NUMBER_W + L.GROUP_GAP : 0
}

const getPodiumTopOffset = () => {
  return seatConfig.value.podiumPosition === 'top' ? L.PODIUM_ROW_H + L.PODIUM_GAP : 0
}

const getGroupWidth = (groupIndex) => {
  const columnCount = getGroupColumnCount(groupIndex)
  return columnCount * L.SEAT_W + Math.max(0, columnCount - 1) * L.COL_GAP
}

const getGroupLeft = (groupIndex) => {
  let left = L.PAD_L + getRowNumberSpace()
  for (let i = 0; i < groupIndex; i++) {
    left += getGroupWidth(i) + L.GROUP_GAP
  }
  return left
}

const getSeatCenter = (seatId) => {
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

const getZoneCentroid = (zone) => {
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
const adjustLine = (from, to, R = 24, endGap = 6) => {
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
const biDirLines = (cA, cB, offset = 8) => {
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
    if (centroids.some(c => !c) || centroids.length < 2) continue

    const arrows = []
    const circles = centroids.map((c, i) => ({ ...c, color: colors[i], label: zones[i].name }))

    if (group.type === 'swap') {
      biDirLines(centroids[0], centroids[1]).forEach(({ from, to }, idx) => {
        const adj = adjustLine(from, to, 24, 6)
        arrows.push({ ...adj, color: 'var(--color-accent)', markerId: `sw-${group.id}-${idx}` })
      })
    } else {
      // cycle arrows: 0→1→2→...→n-1→0
      for (let i = 0; i < centroids.length; i++) {
        const from = centroids[i]
        const to = centroids[(i + 1) % centroids.length]
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
}

.drag-preview-seat {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--color-primary);
  border-radius: 12px;
  background: var(--color-bg-selected);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  padding: 0;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-primary) 35%, transparent);
  opacity: 0.95;
}

.drag-preview-seat.is-anchor {
  border-width: 3px;
  box-shadow: 0 12px 32px color-mix(in srgb, var(--color-primary) 45%, transparent);
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

/* ==================== 顶部功能栏 ==================== */
.seat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  z-index: 10;
  pointer-events: auto;
  flex-shrink: 0;
  min-height: 40px;
}

.toolbar-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.info-item {
  font-weight: 500;
  color: var(--color-text-muted);
}

.info-separator {
  color: var(--color-border);
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
  --seat-card-width: 120px;
  --seat-card-height: 80px;
  --seat-card-border-width: 2px;
  --seat-card-outer-height: calc(var(--seat-card-height) + var(--seat-card-border-width) * 2);
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

/* ==================== 缩放控件 ==================== */
.zoom-controls {
  display: flex;
  align-items: center;
  gap: 2px;
}

.zoom-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-primary);
  transition: all 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.zoom-btn:hover:not(:disabled) {
  background: var(--color-bg-selected);
}

.zoom-btn:active:not(:disabled) {
  background: var(--color-bg-hover);
  transform: scale(0.92);
}

.zoom-btn:disabled {
  color: var(--color-text-disabled);
  cursor: not-allowed;
}

.zoom-label {
  min-width: 52px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  transition: all 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.zoom-label:hover {
  background: var(--color-bg-secondary);
  color: var(--color-primary);
}

@media (max-width: 1366px) and (min-width: 1025px) {
  .seat-toolbar {
    padding: 8px 14px;
  }

  .toolbar-info {
    font-size: 12px;
    gap: 6px;
  }

  .seat-chart {
    --seat-card-width: 104px;
    --seat-card-height: 68px;
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
  .seat-toolbar {
    padding: 6px 12px;
  }

  .toolbar-info {
    font-size: 11px;
    gap: 4px;
  }

  .seat-chart {
    --seat-card-width: 100px;
    --seat-card-height: 64px;
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
@media (max-width: 768px) {
  .seat-chart-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .seat-toolbar {
    display: flex;
    justify-content: space-between;
    padding: 5px 10px;
    min-height: 36px;
    flex-shrink: 0;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mobile-select-btn {
    height: 36px;
    padding: 0 14px;
    font-size: 13px;
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    transition: all 0.2s;
    cursor: pointer;
  }

  .mobile-select-btn.active {
    background: var(--color-primary);
    color: var(--color-surface);
  }

  .mobile-undo-btn,
  .mobile-redo-btn {
    height: 36px;
    width: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-primary);
    border: 1px solid var(--color-border);
    transition: all 0.2s;
    cursor: pointer;
  }

  .mobile-undo-btn:disabled,
  .mobile-redo-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .mobile-undo-btn:not(:disabled):active,
  .mobile-redo-btn:not(:disabled):active {
    background: var(--color-bg-hover);
  }

  .toolbar-info {
    flex-wrap: wrap;
    justify-content: center;
    font-size: 10px;
    gap: 3px;
  }

  .info-item {
    color: var(--color-primary);
    font-weight: 500;
  }

  .seat-chart-viewport {
    flex: 1;
    min-height: 0;
  }

  .seat-chart {
    --seat-card-width: 92px;
    --seat-card-height: 62px;
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

  .drag-preview-seat {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .seat-toolbar {
    padding: 4px 8px;
    flex-direction: column;
    gap: 4px;
    min-height: 32px;
  }

  .toolbar-info {
    font-size: 9px;
    justify-content: center;
  }

  .zoom-controls {
    padding: 2px;
  }

  .seat-chart {
    --seat-card-width: 78px;
    --seat-card-height: 50px;
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

  .drag-preview-seat {
    font-size: 11px;
    border-radius: 8px;
  }

  .zoom-btn {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }

  .zoom-label {
    min-width: 48px;
    height: 36px;
    font-size: 11px;
  }
}
</style>
