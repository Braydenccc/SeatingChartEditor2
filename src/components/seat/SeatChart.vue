<template>
  <div class="seat-chart-container">
    <!-- 顶部功能栏 -->
    <div class="seat-toolbar"
      @dragover.prevent="handleToolbarDragOver" @dragleave="handleToolbarDragLeave" @drop.prevent="handleToolbarDrop">
      <div class="toolbar-info">
        <span class="info-item">{{ seatConfig.groupCount }} 大组</span>
        <span class="info-separator">·</span>
        <span class="info-item">每组 {{ seatConfig.columnsPerGroup }} 列</span>
        <span class="info-separator">·</span>
        <span class="info-item">每列 {{ seatConfig.seatsPerColumn }} 座</span>
        <span class="info-separator">·</span>
        <span class="info-item">共 {{ totalSeats }} 个座位</span>
        <span class="info-separator">·</span>
        <span class="info-item">讲台位置: {{ seatConfig.podiumPosition === 'bottom' ? '底部' : '顶部' }}</span>
      </div>
      <div class="toolbar-right">
        <button
          v-if="isMobile"
          @click="undo"
          :disabled="!canUndo()"
          class="mobile-undo-btn"
          title="撤销"
        >
          <Undo2 :size="16" stroke-width="2" />
        </button>
        <button
          v-if="isMobile"
          @click="redo"
          :disabled="!canRedo()"
          class="mobile-redo-btn"
          title="重做"
        >
          <Redo2 :size="16" stroke-width="2" />
        </button>
        <button
          v-if="isMobile"
          @click="toggleSelectionMode"
          :class="['mobile-select-btn', { active: isSelectionMode }]"
        >
          {{ isSelectionMode ? '关闭' : '选择' }}
        </button>
        <div class="zoom-controls">
          <button class="zoom-btn" @click.stop="zoomOut" :disabled="scale <= MIN_SCALE" title="缩小">
            <Minus :size="16" stroke-width="2.5" />
          </button>
          <button class="zoom-label" @click.stop="fitToViewport" title="自适应大小">
            {{ Math.round(scale * 100) }}%
          </button>
          <button class="zoom-btn" @click.stop="zoomIn" :disabled="scale >= MAX_SCALE" title="放大">
            <Plus :size="16" stroke-width="2.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- 手机端固定选区工具栏 -->
    <div v-if="isMobile && isSelectionMode" class="mobile-selection-toolbar-fixed">
      <div class="selection-info">
        <template v-if="selectedCount > 0">已选 {{ selectedCount }} 个座位</template>
        <template v-else>请点击或滑动选择座位</template>
      </div>
      <div class="selection-actions">
        <button @click="handleSelEdit" title="编辑" :disabled="selectedCount === 0">
          <Edit2 :size="16" />
        </button>
        <button @click="handleSelClear" title="移出" :disabled="selectedCount === 0">
          <UserMinus :size="16" />
        </button>
        <button v-if="selectedCount === 2" @click="handleSelShuffle" title="交换" :disabled="selectedCount < 2">
          <ArrowLeftRight :size="16" />
        </button>
        <button v-else @click="handleSelShuffle" title="打乱" :disabled="selectedCount < 2">
          <Shuffle :size="16" />
        </button>
        <button @click="handleSelAssign" title="排入" :disabled="selectedCount === 0">
          <UserPlus :size="16" />
        </button>
        <button @click="clearSeatSelection" title="取消" class="cancel-btn">
          <X :size="16" />
        </button>
      </div>
    </div>

    <div ref="viewportRef" class="seat-chart-viewport" :class="{ 'is-panning': isPanning }" @wheel.prevent="handleWheel"
      @mousedown="handleMouseDown" @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp"
      @touchstart="handleTouchStart" @touchmove.prevent="handleTouchMove" @touchend="handleTouchEnd"
      @dragover.prevent="handleDragOver" @drop.prevent="handleDrop" @contextmenu.prevent>
      <div ref="chartRef" class="seat-chart" :class="seatConfig.seatAlignment === 'top' ? 'align-top' : 'align-bottom'" :style="chartTransformStyle">
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
                @drag-end-seat="handleDragEndSeat" />
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

      <!-- 选区操作工具栏 -->
      <SelectionToolbar
        v-if="!isMobile"
        :visible="showSelToolbar"
        :anchorX="selToolbarAnchor.x"
        :anchorY="selToolbarAnchor.y"
        :isFull="isSelectionFull"
        :hasStudent="isSelectionHasStudent"
        :canShuffle="selectedCount >= 2"
        :isExactlyTwo="selectedCount === 2"
        @edit="handleSelEdit"
        @clear="handleSelClear"
        @shuffle="handleSelShuffle"
        @assign="handleSelAssign"
        @cancel="clearSeatSelection"
      />
    </div>

    <!-- 批量编辑弹窗 -->
    <BatchEditDialog
      v-model:visible="showBatchEditDialog"
      :studentIds="batchEditStudentIds"
    />

    <!-- 浮动拖拽预览 -->
    <Teleport to="body">
      <div v-show="dragPreviewState.isActive" ref="dragPreviewRef" class="drag-preview-overlay">
        <div v-for="item in previewItems" :key="item.seatId"
          class="drag-preview-seat" :class="{ 'is-anchor': item.isAnchor }" :style="item.style">
          {{ item.studentName }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { Minus, Plus, Edit2, UserMinus, Shuffle, UserPlus, X, ArrowLeftRight, Undo2, Redo2 } from 'lucide-vue-next'
import SeatItem from './SeatItem.vue'
import SelectionToolbar from './SelectionToolbar.vue'
import BatchEditDialog from '@/components/student/BatchEditDialog.vue'
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

// 透明拖拽图片常量
const TRANSPARENT_DRAG_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

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
  initializeSeats,
  assignStudent,
  toggleEmpty,
  clearSeat,
  swapSeats,
  moveSelection,
  findSeatByStudent,
  getStudentAtSeat,
  parseSeatId,
  generateSeatId,
  toGlobalCol,
  fromGlobalCol
} = useSeatChart()

const { firstSelectedSeat, setFirstSelectedSeat, clearFirstSelectedSeat } = useEditMode()
const { clearSelection: clearStudentSelection, students } = useStudentData()
const { scale, panX, panY, zoomIn, zoomOut, setScale, setPan, MIN_SCALE, MAX_SCALE, registerViewport, fitToViewport } = useZoom()
const { recordAssign, recordClear, recordSwap, recordToggleEmpty, recordBatch, createSnapshot, canUndo, canRedo, undo, redo } = useUndo()
const { isDraggingFromSeat: globalIsDraggingFromSeat } = useDragState()
const {
  clearSelection: clearSeatSelection,
  selectedSeatsArray,
  selectedCount,
  setSelection,
  startSelection,
  updateSelection,
  endSelection,
  toggleSeatInSelection,
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

const dragPreviewRef = ref(null)
const viewportRef = ref(null)
const chartRef = ref(null)
const isPanning = ref(false)

// 多选拖拽落点高亮
const currentDragAnchorSeatId = ref(null)
const currentDragTargetSeatId = ref(null)
const dropTargetSeatIds = computed(() => {
  if (!currentDragTargetSeatId.value || !currentDragAnchorSeatId.value || selectedCount.value <= 1) return new Set()

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

// 矩形框选状态
const isRectSelecting = ref(false)
const rectSelectStart = ref({ x: 0, y: 0 })
const rectSelectEnd = ref({ x: 0, y: 0 })

const handleMouseDown = (e) => {
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

  // 不拦截对座位等可交互元素的点击
  // 只在空白区域或按住中键时启动拖拽
  if (e.button === 1 || (e.button === 0 && !isInteractiveTarget(e.target))) {
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

  if (rightMouseDown) {
    const dx = e.clientX - rightStartX
    const dy = e.clientY - rightStartY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      mouseMoved = true
    }
    const seatEl = findSeatElement(e.target)
    if (seatEl && seatEl.dataset.seatId) {
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

const handleMouseUp = () => {
  // 完成矩形框选
  if (isRectSelecting.value) {
    selectSeatsInRect()
    isRectSelecting.value = false
    return
  }

  if (rightMouseDown) {
    if (!mouseMoved && rightStartSeatId) {
      toggleSeatInSelection(rightStartSeatId)
    }
    endSelection()
    rightMouseDown = false
    rightStartSeatId = null
    return
  }

  if (mouseDown && mouseMoved) {
    flushPan(pendingPanX, pendingPanY)
  }
  mouseDown = false
  isPanning.value = false
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
  } else if (e.touches.length === 1 && !isInteractiveTarget(e.target)) {
    // 单指拖拽平移（仅空白区域）
    touchMode = 'pan'
    touchPanStartX = e.touches[0].clientX
    touchPanStartY = e.touches[0].clientY
    touchStartPanX = panX.value
    touchStartPanY = panY.value
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
    isPanning.value = true
    schedulePanUpdate(pendingPanX, pendingPanY)
  }
}

const handleTouchEnd = () => {
  if (touchMode === 'pan') {
    flushPan(pendingPanX, pendingPanY)
  }
  if (touchRafId) { cancelAnimationFrame(touchRafId); touchRafId = null }
  touchMode = ''
  lastTouchDistance = 0
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
  const raw = e.dataTransfer.getData('application/json')
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
      endDragPreview([targetSeatId])
    } else if (data.type === 'seat') {
      if (data.selectedSeatIds && data.selectedSeatIds.length > 1) {
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
        recordSwap(data.seatId, targetSeatId)
        swapSeats(data.seatId, targetSeatId)
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
  const raw = e.dataTransfer.getData('application/json')
  if (!raw) return

  try {
    const data = JSON.parse(raw)
    if (data.type === 'seat' && data.seatId) {
      const studentId = getStudentAtSeat(data.seatId)
      recordClear(data.seatId, studentId)
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
    // 单个座位交换
    recordSwap(sourceSeatId, targetSeatId)
    swapSeats(sourceSeatId, targetSeatId)
  }
}

const handleTouchStudentDrop = (e) => {
  const { studentId, targetSeatId } = e.detail
  handleAssignStudent(targetSeatId, studentId)
}

const handleTouchSeatToList = (e) => {
  const { seatId, isSelection, selectedSeatIds } = e.detail

  if (isSelection && selectedSeatIds && selectedSeatIds.length > 1) {
    // 选区整体移出
    selectedSeatIds.forEach(sid => {
      const studentId = getStudentAtSeat(sid)
      if (studentId !== null) {
        recordClear(sid, studentId)
        clearSeat(sid)
      }
    })
    clearSeatSelection()
  } else {
    // 单个座位移出
    const studentId = getStudentAtSeat(seatId)
    recordClear(seatId, studentId)
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
  const seat = organizedSeats.value.flat(Infinity).find(s => s.id === seatId)
  if (seat && seat.studentId !== null && !seat.isEmpty) {
    globalIsDraggingFromSeat.value = true
  }
}

const handleGlobalDragEnd = () => {
  globalIsDraggingFromSeat.value = false
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

// ==================== 选区工具栏 ====================
const selToolbarAnchor = ref({ x: 0, y: 0 })
const showSelToolbar = computed(() => selectedCount.value >= 1 && !dragPreviewState.isActive)

// 批量编辑弹窗
const showBatchEditDialog = ref(false)
const batchEditStudentIds = ref([])

// 判断选区是否已满（所有选中的座位都有学生）
const isSelectionFull = computed(() => {
  if (selectedCount.value === 0) return false
  return selectedSeatsArray.value.every(seatId => getStudentAtSeat(seatId))
})

// 判断选区是否有学生（至少有一个座位有学生）
const isSelectionHasStudent = computed(() => {
  if (selectedCount.value === 0) return false
  return selectedSeatsArray.value.some(seatId => getStudentAtSeat(seatId))
})

const updateSelToolbarPosition = () => {
  if (!viewportRef.value || selectedCount.value < 1) return
  const vpRect = viewportRef.value.getBoundingClientRect()
  const ids = selectedSeatsArray.value
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const id of ids) {
    const el = viewportRef.value.querySelector(`[data-seat-id="${id}"]`)
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (r.left < minX) minX = r.left
    if (r.top < minY) minY = r.top
    if (r.right > maxX) maxX = r.right
    if (r.bottom > maxY) maxY = r.bottom
  }
  if (minX === Infinity) return
  selToolbarAnchor.value = {
    x: (minX + maxX) / 2 - vpRect.left,
    y: maxY - vpRect.top + 10
  }
}

watch([selectedSeatsArray, scale, panX, panY], () => {
  nextTick(updateSelToolbarPosition)
}, { deep: true })

const handleSelClear = () => {
  for (const seatId of selectedSeatsArray.value) {
    const studentId = getStudentAtSeat(seatId)
    if (studentId) {
      recordClear(seatId, studentId)
      clearSeat(seatId)
    }
  }
  clearSeatSelection()
}

const handleSelShuffle = () => {
  const ids = selectedSeatsArray.value
  const studentIds = ids.map(id => getStudentAtSeat(id)).filter(Boolean)
  if (studentIds.length < 2) return

  if (ids.length === 2) {
    const [seatA, seatB] = ids
    const studentA = getStudentAtSeat(seatA)
    const studentB = getStudentAtSeat(seatB)
    if (studentA && studentB) {
      recordSwap(seatA, seatB)
      swapSeats(seatA, seatB)
    } else if (studentA || studentB) {
      const fromSeat = studentA ? seatA : seatB
      const toSeat = studentA ? seatB : seatA
      const studentId = studentA || studentB
      clearSeat(fromSeat)
      assignStudent(toSeat, studentId)
    }
    return
  }

  for (let i = studentIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [studentIds[i], studentIds[j]] = [studentIds[j], studentIds[i]]
  }
  const occupiedIds = ids.filter(id => getStudentAtSeat(id))
  for (const seatId of occupiedIds) {
    clearSeat(seatId)
  }
  for (let i = 0; i < occupiedIds.length; i++) {
    assignStudent(occupiedIds[i], studentIds[i])
  }
}

const handleSelAssign = () => {
  const ids = selectedSeatsArray.value
  const emptyIds = ids.filter(id => !getStudentAtSeat(id))
  const unassigned = students.value.filter(s => !findSeatByStudent(s.id))
  if (emptyIds.length === 0 || unassigned.length === 0) return
  const shuffled = [...unassigned].sort(() => Math.random() - 0.5)
  const count = Math.min(emptyIds.length, shuffled.length)
  for (let i = 0; i < count; i++) {
    assignStudent(emptyIds[i], shuffled[i].id)
    recordAssign(emptyIds[i], shuffled[i].id, null)
  }
  clearSeatSelection()
}

const handleSelEdit = () => {
  const ids = selectedSeatsArray.value
  const studentIds = ids.map(id => getStudentAtSeat(id)).filter(Boolean)
  if (studentIds.length === 0) return
  batchEditStudentIds.value = studentIds
  showBatchEditDialog.value = true
}

// ==================== 初始化 ====================
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
  () => [seatConfig.value.groupCount, seatConfig.value.columnsPerGroup, seatConfig.value.seatsPerColumn],
  () => {
    nextTick(() => {
      setTimeout(fitToViewport, 100)
    })
  }
)

// 窗口大小变化时重新自适应
let resizeObserver = null
onMounted(() => {
  if (viewportRef.value) {
    resizeObserver = new ResizeObserver(() => {
      fitToViewport()
    })
    resizeObserver.observe(viewportRef.value)
  }
})
onUnmounted(() => {
  resizeObserver?.disconnect()
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
    clearSeat(existingSeat.id)
  }
  assignStudent(seatId, studentId)
  clearStudentSelection()
  recordAssign(seatId, studentId, previousSeatId)
}

// 处理切换空置状态
const handleToggleEmpty = (seatId) => {
  recordToggleEmpty(seatId)
  toggleEmpty(seatId)
}

// 处理清空座位
const handleClearSeat = (seatId) => {
  const studentId = getStudentAtSeat(seatId)
  recordClear(seatId, studentId)
  clearSeat(seatId)
}

// 处理交换座位
const handleSwapSeat = (seatId, sourceSeatId = null) => {
  if (sourceSeatId) {
    // 拖拽交换模式：直接交换两个座位
    recordSwap(sourceSeatId, seatId)
    swapSeats(sourceSeatId, seatId)
  } else {
    // 点击交换模式：依次选择两个座位
    if (!firstSelectedSeat.value) {
      setFirstSelectedSeat(seatId)
    } else if (firstSelectedSeat.value === seatId) {
      clearFirstSelectedSeat()
    } else {
      recordSwap(firstSelectedSeat.value, seatId)
      swapSeats(firstSelectedSeat.value, seatId)
      clearFirstSelectedSeat()
    }
  }
}

// ==================== 选区轮换 SVG 箭头 ====================
const { rotGroups, editingZoneId, getZoneColor, parseSeatPos, PALETTE } = useZoneRotation()
const { LAYOUT: L } = useLayoutConstants()

const getSeatCenter = (seatId) => {
  const { g, c, r } = parseSeatPos(seatId)
  const cpg = seatConfig.value.columnsPerGroup
  const groupW = cpg * L.SEAT_W + (cpg - 1) * L.COL_GAP
  return {
    x: L.PAD_L + g * (groupW + L.GROUP_GAP) + c * (L.SEAT_W + L.COL_GAP) + L.SEAT_W / 2,
    y: L.PAD_T + L.LABEL_H + r * (L.SEAT_H + L.ROW_GAP) + L.SEAT_H / 2
  }
}

const getZoneCentroid = (zone) => {
  if (!zone.seatIds.length) return null
  let sx = 0, sy = 0
  zone.seatIds.forEach(sid => { const p = getSeatCenter(sid); sx += p.x; sy += p.y })
  return { x: sx / zone.seatIds.length, y: sy / zone.seatIds.length }
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
        arrows.push({ ...adj, color: '#6366f1', markerId: `sw-${group.id}-${idx}` })
      })
    } else {
      // cycle arrows: 0→1→2→...→n-1→0
      for (let i = 0; i < centroids.length; i++) {
        const from = centroids[i]
        const to = centroids[(i + 1) % centroids.length]
        const adj = adjustLine(from, to, 24, 6)
        arrows.push({ ...adj, color: '#23587b', markerId: `cy-${group.id}-${i}` })
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
  border: 2px solid var(--color-primary, #23587b);
  border-radius: 12px;
  background: var(--color-bg-selected, #e8f4f8);
  color: #333;
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  padding: 8px;
  box-shadow: 0 8px 24px rgba(35, 88, 123, 0.35);
  opacity: 0.95;
}

.drag-preview-seat.is-anchor {
  border-width: 3px;
  box-shadow: 0 12px 32px rgba(35, 88, 123, 0.45);
  z-index: 10;
}

.rect-select-overlay {
  position: fixed;
  background: rgba(14, 165, 233, 0.15);
  border: 2px solid #0ea5e9;
  border-radius: 4px;
  pointer-events: none;
  z-index: 1000;
}

.seat-chart-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  overflow: hidden;
}

/* ==================== 顶部功能栏 ==================== */
.seat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e8eef2;
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
  color: #666;
}

.info-item {
  font-weight: 500;
  color: #888;
}

.info-separator {
  color: #ccc;
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
  display: inline-flex;
  justify-content: center;
  align-items: flex-start;
  gap: 40px;
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
  align-items: flex-start;
}

.seat-chart.align-bottom {
  align-items: flex-end;
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
  color: #23587b;
  padding: 0px 0px;
  order: 1;
}

.group-content {
  display: flex;
  gap: 16px;
  order: 0;
}

.seat-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 120px;
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
  color: #23587b;
  transition: all 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.zoom-btn:hover:not(:disabled) {
  background: #e8f4f8;
}

.zoom-btn:active:not(:disabled) {
  background: #d0e9f2;
  transform: scale(0.92);
}

.zoom-btn:disabled {
  color: #bbb;
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
  color: #555;
  transition: all 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.zoom-label:hover {
  background: #f0f0f0;
  color: #23587b;
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
    gap: 26px;
    padding: 22px 14px;
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

  .seat-column {
    width: 104px;
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
    gap: 24px;
    padding: 18px 12px;
  }

  .seat-group {
    gap: 8px;
  }

  .group-content {
    gap: 10px;
  }

  .seat-column {
    width: 100px;
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
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
    border-radius: 4px;
    background: white;
    color: #23587b;
    border: 1px solid #23587b;
    transition: all 0.2s;
    cursor: pointer;
  }

  .mobile-select-btn.active {
    background: #23587b;
    color: white;
  }

  .mobile-undo-btn,
  .mobile-redo-btn {
    height: 28px;
    width: 28px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: white;
    color: #23587b;
    border: 1px solid #d0d7dc;
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
    background: #f0f4f7;
  }

  .mobile-selection-toolbar-fixed {
    position: sticky;
    top: 36px;
    z-index: 10;
    background: #f5f5f5;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    border-bottom: 1px solid #e0e0e0;
    flex-shrink: 0;
  }

  .selection-info {
    font-size: 12px;
    color: #666;
    font-weight: 500;
  }

  .selection-actions {
    display: flex;
    gap: 8px;
  }

  .selection-actions button {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 4px;
    background: white;
    border: 1px solid #ddd;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .selection-actions button:active {
    transform: scale(0.95);
  }

  .selection-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .selection-actions button.cancel-btn {
    background: #ff4444;
    color: white;
    border-color: #ff4444;
  }

  .toolbar-info {
    flex-wrap: wrap;
    justify-content: center;
    font-size: 10px;
    gap: 3px;
  }

  .info-item {
    color: #23587b;
    font-weight: 500;
  }

  .seat-chart-viewport {
    flex: 1;
    min-height: 0;
  }

  .seat-chart {
    gap: 20px;
    padding: 20px 12px;
  }

  .group-label {
    font-size: 13px;
    padding: 6px 10px;
  }

  .group-content {
    gap: 10px;
  }

  .seat-column {
    width: 100px;
    gap: 8px;
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
    gap: 12px;
    padding: 14px 8px;
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

  .seat-column {
    width: 90px;
    gap: 6px;
  }

  .drag-preview-seat {
    font-size: 11px;
    border-radius: 8px;
  }

  .zoom-btn {
    width: 28px;
    height: 28px;
    font-size: 16px;
  }

  .zoom-label {
    min-width: 44px;
    height: 28px;
    font-size: 11px;
  }
}
</style>
