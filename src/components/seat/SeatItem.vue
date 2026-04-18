<template>
  <div class="seat-item" :class="{
    empty: seat.isEmpty,
    occupied: hasStudent,
    selected: isFirstSelected,
    clickable: isClickable,
    'zone-highlight': zoneHighlight,
    'drag-over': isDragOver || isDropTarget,
    dragging: isDragging,
    'is-anchor': isDragAnchor,
    'selection-dragging': isSelectionDragging,
    'undo-highlighted': undoHighlighted,
    'selection-selected': isInSelection,
    'drag-ghost': isGhost
  }" :style="zoneHighlightStyle" :data-seat-id="seat.id" :draggable="isDraggable" @click="handleClick"
    @dragstart="handleDragStart" @dragend="handleDragEnd" @dragover.prevent="handleDragOverSeat"
    @dragenter.prevent="handleDragEnter" @dragleave="handleDragLeave" @drop.prevent="handleDrop"
    @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel" @contextmenu.prevent @pointerdown="handlePointerDown">
    <div v-if="seat.isEmpty" class="empty-indicator">
      <span class="empty-text">空置</span>
    </div>
    <template v-else-if="hasStudent">
      <div class="student-display" :class="{ 'bottom-tag-mode': tagDisplayMode === 'bottom' }">
        <div class="student-name">{{ studentInfo.name || '未命名' }}</div>
        <!-- 颜色点模式：显示所有标签，用实心/空心区分 -->
        <div v-if="hasTags && tagDisplayMode === 'dot'" class="student-tags">
          <span v-for="tag in allVisibleTags" :key="tag.id"
            :class="['tag-dot', { 'tag-dot-hollow': !hasTag(tag.id) }]"
            :style="{ backgroundColor: hasTag(tag.id) ? tag.color : 'transparent', borderColor: tag.color }"
            :title="tag.name">
          </span>
        </div>
        <!-- 座位下部文字模式：学号绝对定位到右上角 -->
        <div v-if="tagDisplayMode === 'bottom'" class="student-number-corner">
          {{ studentInfo.studentNumber || '-' }}
        </div>
        <div v-else class="student-number">{{ studentInfo.studentNumber || '-' }}</div>
        <!-- 座位下部文字模式：只显示学生拥有的标签 -->
        <div v-if="hasTags && tagDisplayMode === 'bottom'" class="student-tags-text">
          <span v-for="tag in studentTags" :key="tag.id"
            class="tag-text-item"
            :style="{ backgroundColor: tag.color }"
            :title="tag.name">
            {{ tag.name.substring(0, 2) }}
          </span>
        </div>
      </div>
      <!-- 右上角文字模式：只显示学生拥有的标签 -->
      <div v-if="hasTags && tagDisplayMode === 'corner'" class="corner-tags">
        <span v-for="tag in studentTags" :key="tag.id"
          class="corner-tag-item"
          :style="{ backgroundColor: tag.color }"
          :title="tag.name">
          {{ tag.name.substring(0, 2) }}
        </span>
      </div>
    </template>
    <div v-else class="empty-seat">
      <span class="seat-placeholder">空位</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onUnmounted, shallowRef } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useStudentData } from '@/composables/useStudentData'
import { useEditMode } from '@/composables/useEditMode'
import { useZoneData } from '@/composables/useZoneData'
import { useZoneRotation } from '@/composables/useZoneRotation'
import { useTagData } from '@/composables/useTagData'
import { useUndo } from '@/composables/useUndo'
import { useDragState } from '@/composables/useDragState'
import { useSelection } from '@/composables/useSelection'
import { useDragPreview } from '@/composables/useDragPreview'

const props = defineProps({
  seat: {
    type: Object,
    required: true
  },
  isDropTarget: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['assign-student', 'toggle-empty', 'clear-seat', 'swap-seat', 'toggle-zone-seat', 'drag-start-seat', 'drag-enter-seat', 'drag-end-seat'])

const { students, selectedStudentId } = useStudentData()
const { currentMode, firstSelectedSeat, EditMode } = useEditMode()
const { visibleZoneSeats, selectedZoneId, toggleSeatInZone } = useZoneData()
const { editingZoneId, getRotZoneHighlights, toggleSeatInEditingZone } = useZoneRotation()
const { tags, showTagsInSeatChart, tagDisplayMode } = useTagData()
const { isHighlighted } = useUndo()
const { startDragFromSeat, endDragFromSeat, startTouchDragFromSeat, endTouchDragFromSeat } = useDragState()
const { selectedSeatIds, selectedSeatsArray, isDraggingSelection, startDraggingSelection, endDraggingSelection, isSelectionMode, toggleSeatInSelection } = useSelection()
const { startDragPreview, updateDragPreview, endDragPreview, isGhostSeat } = useDragPreview()

const isDragOver = ref(false)
const isDragging = ref(false)
let dragEnterCount = 0

// 响应式断点检测
const isMobile = useMediaQuery('(max-width: 768px)')

// 触摸拖拽状态
let touchDragTimer = null
const TOUCH_SELECTION_MODE = {
  ADD: 'add',
  REMOVE: 'remove'
}

let touchDragActive = false
let touchSelectionActive = false
let touchSelectionMode = null
let touchSelectionVisited = new Set()
let touchMoveRafId = null
let touchStartX = 0
let touchStartY = 0
// 当前是否通过触摸交互（动态判断，解决触摸屏笔记本问题）
// 使用 shallowRef 让 isDraggable computed 能追踪其变化
const lastPointerWasTouch = shallowRef(false)

// ==================== 计算属性 ====================

const hasStudent = computed(() => {
  return props.seat.studentId !== null && !props.seat.isEmpty
})

const studentInfo = computed(() => {
  if (!hasStudent.value) return null
  return students.value.find(s => s.id === props.seat.studentId) || { name: '未知', studentNumber: null, tags: [] }
})

const allVisibleTags = computed(() => {
  if (!showTagsInSeatChart.value || !studentInfo.value) return []
  return tags.value.filter(tag => tag.showInSeatChart !== false)
})

const hasTag = (tagId) => {
  if (!studentInfo.value || !studentInfo.value.tags) return false
  return studentInfo.value.tags.includes(tagId)
}

const studentTags = computed(() => {
  return allVisibleTags.value.filter(tag => hasTag(tag.id))
})

const hasTags = computed(() => {
  if (tagDisplayMode.value === 'dot') {
    return allVisibleTags.value.length > 0
  }
  return studentTags.value.length > 0
})

const isFirstSelected = computed(() => {
  return currentMode.value === EditMode.SWAP && firstSelectedSeat.value === props.seat.id
})

const rotZoneHighlights = computed(() => getRotZoneHighlights())

const zoneHighlight = computed(() => {
  return visibleZoneSeats.value.has(props.seat.id) ||
    rotZoneHighlights.value.has(props.seat.id)
})

const zoneHighlightStyle = computed(() => {
  if (!zoneHighlight.value) return {}
  const color = visibleZoneSeats.value.get(props.seat.id) ||
    rotZoneHighlights.value.get(props.seat.id)
  return { '--zone-color': color }
})

const isClickable = computed(() => {
  // 手机端选择模式：所有座位都可点击
  if (isMobile.value && isSelectionMode.value) return true

  if (currentMode.value === EditMode.NORMAL) {
    return selectedStudentId.value !== null && !props.seat.isEmpty
  }
  if (currentMode.value === EditMode.EMPTY_EDIT) return true
  if (currentMode.value === EditMode.SWAP) return true
  if (currentMode.value === EditMode.CLEAR) return hasStudent.value
  if (currentMode.value === EditMode.ZONE_EDIT) return true
  return false
})

const undoHighlighted = computed(() => isHighlighted(props.seat.id))

// 选区选中状态 - 直接访问 selectedSeatIds 以确保响应式追踪
const isInSelection = computed(() => selectedSeatIds.value.has(props.seat.id))

// 选区整体拖拽中（非发起者的其他选中座位）
const isSelectionDragging = computed(() => {
  return isInSelection.value && isDraggingSelection.value && !isDragging.value
})

// 拖拽吸附幽灵
const isGhost = computed(() => isGhostSeat(props.seat.id))

// 多选拖拽发起者
const isDragAnchor = computed(() => {
  return isDragging.value &&
         isInSelection.value &&
         selectedSeatsArray.value.length > 1
})

// 触摸拖拽激活条件
const canTouchDrag = computed(() => {
  return hasStudent.value &&
    (currentMode.value === EditMode.NORMAL || currentMode.value === EditMode.SWAP)
})

// HTML5 draggable 属性：通过触摸交互时禁用，防止幽灵拖拽图
// 使用动态 lastPointerWasTouch 而非静态 maxTouchPoints，避免触摸屏笔记本问题
const isDraggable = computed(() => {
  if (lastPointerWasTouch.value) return false
  if (isInSelection.value && hasStudent.value) return true
  return canTouchDrag.value
})

// 记录指针类型，用于判断是否为触摸操作
const handlePointerDown = (e) => {
  lastPointerWasTouch.value = e.pointerType === 'touch'
}

// ==================== 点击处理 ====================

const handleClick = () => {
  if (!isClickable.value) return

  // 手机端选择模式：点击切换选中状态
  if (isMobile.value && isSelectionMode.value) {
    toggleSeatInSelection(props.seat.id)
    return
  }

  switch (currentMode.value) {
    case EditMode.NORMAL:
      if (selectedStudentId.value && !props.seat.isEmpty) {
        emit('assign-student', props.seat.id, selectedStudentId.value)
      }
      break
    case EditMode.EMPTY_EDIT:
      emit('toggle-empty', props.seat.id)
      break
    case EditMode.SWAP:
      emit('swap-seat', props.seat.id)
      break
    case EditMode.CLEAR:
      if (hasStudent.value) {
        emit('clear-seat', props.seat.id)
      }
      break
    case EditMode.ZONE_EDIT:
      if (selectedZoneId.value) {
        toggleSeatInZone(selectedZoneId.value, props.seat.id)
      } else if (editingZoneId.value) {
        toggleSeatInEditingZone(props.seat.id)
      }
      break
  }
}

// ==================== HTML5 拖拽 ====================

const handleDragStart = (e) => {
  if (!isDraggable.value) {
    e.preventDefault()
    return
  }
  isDragging.value = true
  startDragFromSeat()
  e.dataTransfer.effectAllowed = 'move'

  const isSelection = isInSelection.value && selectedSeatsArray.value.length > 1
  const selectionData = isSelection ? selectedSeatsArray.value : [props.seat.id]

  if (isSelection) {
    startDraggingSelection()
  }

  emit('drag-start-seat', props.seat.id, isSelection)

  e.dataTransfer.setData('application/json', JSON.stringify({
    type: 'seat',
    seatId: props.seat.id,
    studentId: props.seat.studentId,
    selectedSeatIds: selectionData
  }))

  const emptyImg = new Image()
  emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  e.dataTransfer.setDragImage(emptyImg, 0, 0)

  startDragPreview(props.seat.id, selectionData, e.clientX, e.clientY)
}

const handleDragEnd = () => {
  isDragging.value = false
  endDragFromSeat()
  endDraggingSelection()
  endDragPreview()
  dragEnterCount = 0
  emit('drag-end-seat')
}

const handleDragOverSeat = (e) => {
  e.dataTransfer.dropEffect = 'move'
}

const handleDragEnter = () => {
  dragEnterCount++
  isDragOver.value = true
  emit('drag-enter-seat', props.seat.id)
}

const handleDragLeave = () => {
  dragEnterCount--
  if (dragEnterCount <= 0) {
    dragEnterCount = 0
    isDragOver.value = false
  }
}

const handleDrop = () => {
  isDragOver.value = false
  dragEnterCount = 0
}

// ==================== 触摸拖拽模拟 ====================

const handleTouchStart = (e) => {
  if (e.touches.length !== 1 || !canTouchDrag.value) return

  const touch = e.touches[0]
  const startX = touch.clientX
  const startY = touch.clientY
  touchStartX = startX
  touchStartY = startY

  touchDragTimer = setTimeout(() => {
    touchDragActive = true
    isDragging.value = true
    startTouchDragFromSeat()  // 通知候选区显示触摸移出目标
    if (navigator.vibrate) navigator.vibrate(40)  // 震动反馈

    // 使用统一的拖拽预览系统
    const isSelection = isInSelection.value && selectedSeatsArray.value.length > 1
    const selectionData = isSelection ? selectedSeatsArray.value : [props.seat.id]

    if (isSelection) {
      startDraggingSelection()
    }

    startDragPreview(props.seat.id, selectionData, startX, startY)
  }, 300)
}

const handleTouchMove = (e) => {
  if (e.touches.length !== 1) return

  const touch = e.touches[0]
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY
  const moved = Math.abs(dx) > 5 || Math.abs(dy) > 5

  // 手机端选择模式：检测移动后取消长按，进入涂抹选择
  if (isMobile.value && isSelectionMode.value && !touchDragActive && !touchSelectionActive && moved) {
    // 取消长按定时器
    if (touchDragTimer) {
      clearTimeout(touchDragTimer)
      touchDragTimer = null
    }
    touchSelectionActive = true
    touchSelectionMode = isInSelection.value ? TOUCH_SELECTION_MODE.REMOVE : TOUCH_SELECTION_MODE.ADD
    touchSelectionVisited.clear()

    touchSelectionVisited.add(props.seat.id)
    toggleSeatInSelection(props.seat.id)
  }

  if (touchSelectionActive) {
    e.preventDefault()
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY)
    if (targetEl) {
      const seatEl = findParentSeat(targetEl)
      if (seatEl && seatEl.dataset.seatId) {
        const seatId = seatEl.dataset.seatId

        if (touchSelectionVisited.has(seatId)) return
        touchSelectionVisited.add(seatId)

        const isSelected = selectedSeatIds.value.has(seatId)

        if (touchSelectionMode === TOUCH_SELECTION_MODE.ADD && !isSelected) {
          toggleSeatInSelection(seatId)
        } else if (touchSelectionMode === TOUCH_SELECTION_MODE.REMOVE && isSelected) {
          toggleSeatInSelection(seatId)
        }
      }
    }
    return
  }

  if (!touchDragActive) {
    // 判断手指移动距离，超过阈值才认为是滑动（取消长按）
    // 小幅抖动（≤ 8px）不取消定时器，让长按继续激活拖拽
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      if (touchDragTimer) {
        clearTimeout(touchDragTimer)
        touchDragTimer = null
      }
    }
    return
  }

  // 拖拽激活：阻止页面滚动
  e.preventDefault()

  // 使用统一的拖拽预览更新
  updateDragPreview(touch.clientX, touch.clientY)

  // 高亮目标座位
  const targetEl = document.elementFromPoint(touch.clientX, touch.clientY)
  clearAllTouchHighlights()
  if (targetEl) {
    const seatEl = findParentSeat(targetEl)
    if (seatEl && seatEl.dataset.seatId !== props.seat.id) {
      seatEl.classList.add('drag-over')
    } else {
      const studentListEl = findParentByClass(targetEl, 'student-items')
      if (studentListEl && props.seat.studentId != null) {
        studentListEl.classList.add('drag-over')
      }
    }
  }
}

// 公共清理函数：取消定时器、移除预览、重置所有状态
const cleanupTouchDrag = () => {
  if (touchDragTimer) { clearTimeout(touchDragTimer); touchDragTimer = null }
  if (touchMoveRafId) { cancelAnimationFrame(touchMoveRafId); touchMoveRafId = null }
  clearAllTouchHighlights()
  isDragging.value = false
  if (touchDragActive) {
    endTouchDragFromSeat()  // 重置全局触摸拖拽状态
    endDraggingSelection()
    endDragPreview()
  }
  touchDragActive = false
  touchSelectionActive = false
  touchSelectionMode = null
  touchSelectionVisited.clear()
}

// touchcancel：OS 中断触摸（弹出菜单、通知等），直接清理所有状态
const handleTouchCancel = () => {
  cleanupTouchDrag()
}

const handleTouchEnd = (e) => {
  // 涂抹选择模式结束
  if (touchSelectionActive) {
    touchSelectionActive = false
    touchSelectionMode = null
    touchSelectionVisited.clear()
    if (touchDragTimer) {
      clearTimeout(touchDragTimer)
      touchDragTimer = null
    }
    return
  }

  // 先清理定时器和视觉状态，防止方框残留
  if (touchDragTimer) {
    clearTimeout(touchDragTimer)
    touchDragTimer = null
  }
  if (touchMoveRafId) { cancelAnimationFrame(touchMoveRafId); touchMoveRafId = null }
  isDragging.value = false

  const wasActive = touchDragActive
  if (!wasActive) return

  // 获取 drop 目标
  const touch = e.changedTouches[0]
  const targetEl = document.elementFromPoint(touch.clientX, touch.clientY)

  clearAllTouchHighlights()
  isDragging.value = false
  endTouchDragFromSeat()  // 重置全局触摸拖拽状态，隐藏覆盖层
  endDraggingSelection()
  endDragPreview()
  touchDragActive = false

  if (!targetEl) return
  const seatEl = findParentSeat(targetEl)
  if (!seatEl || seatEl.dataset.seatId === props.seat.id) {
    // 检测是否拖到候选列表区域
    const studentListEl = findParentByClass(targetEl, 'student-items')
    if (studentListEl && props.seat.studentId != null) {
      const isSelection = isInSelection.value && selectedSeatsArray.value.length > 1
      const event = new CustomEvent('touch-seat-to-list', {
        bubbles: true,
        detail: {
          seatId: props.seat.id,
          studentId: props.seat.studentId,
          isSelection: isSelection,
          selectedSeatIds: isSelection ? selectedSeatsArray.value : [props.seat.id]
        }
      })
      studentListEl.dispatchEvent(event)
    }
    return
  }

  const targetSeatId = seatEl.dataset.seatId

  // 检查是否是选区拖拽
  const isSelection = isInSelection.value && selectedSeatsArray.value.length > 1

  // 触摸拖拽总是执行交换/分配
  // 通过自定义事件通知 SeatChart
  const event = new CustomEvent('touch-seat-drop', {
    bubbles: true,
    detail: {
      sourceSeatId: props.seat.id,
      targetSeatId: targetSeatId,
      studentId: props.seat.studentId,
      isSelection: isSelection,
      selectedSeatIds: isSelection ? selectedSeatsArray.value : [props.seat.id]
    }
  })
  seatEl.dispatchEvent(event)
}

const findParentSeat = (el) => {
  let current = el
  while (current && !current.dataset?.seatId) {
    current = current.parentElement
  }
  return current
}

const findParentByClass = (el, className) => {
  let current = el
  while (current) {
    if (current.classList?.contains(className)) return current
    current = current.parentElement
  }
  return null
}

const clearAllTouchHighlights = () => {
  document.querySelectorAll('.seat-item.drag-over').forEach(el => {
    el.classList.remove('drag-over')
  })
  document.querySelectorAll('.student-items.drag-over').forEach(el => {
    el.classList.remove('drag-over')
  })
}

onUnmounted(() => {
  cleanupTouchDrag()
})
</script>

<style scoped>
.seat-item {
  width: 100%;
  height: 80px;
  aspect-ratio: 3 / 4;
  border: 2px solid #d0d7dc;
  contain: layout style;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
  position: relative;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-user-drag: none;
}

.seat-item.clickable {
  cursor: pointer;
}

.seat-item.clickable:not(.selection-selected):hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(35, 88, 123, 0.2);
  transform: translateY(-2px);
}

.seat-item.selection-selected.clickable:hover {
  border-color: #0ea5e9;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.2);
  transform: none;
}

/* 拖拽相关样式 */
.seat-item[draggable="true"] {
  cursor: grab;
  -webkit-user-drag: element;
}

.seat-item[draggable="true"]:active {
  cursor: grabbing;
}

.seat-item.dragging {
  background: transparent !important;
  border-color: #d0d7dc !important;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.seat-item.dragging.is-anchor {
  background: transparent !important;
  border-color: #d0d7dc !important;
}

.seat-item.selection-dragging {
  background: transparent !important;
  border-color: #d0d7dc !important;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.seat-item.drag-over {
  border-color: #0ea5e9;
  border-width: 3px;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.3);
  background: rgba(14, 165, 233, 0.08);
}

/* 空置座位样式 */
.seat-item.empty {
  background: #f5f5f5;
  border-color: #bbb;
}

.seat-item.empty .empty-indicator {
  background: rgba(255, 255, 255, 0.9);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #999;
}

.empty-text {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

/* 已分配学生的座位 */
.seat-item.occupied {
  background: var(--color-bg-selected);
  border-color: var(--color-primary);
}

.student-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  width: 100%;
}

.student-tags {
  display: flex;
  gap: 3px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 2px;
}

.tag-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.tag-dot-hollow {
  border: 1.5px solid;
  box-shadow: none;
}

.student-tags-text {
  display: flex;
  gap: 3px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 3px;
}

.tag-text-item {
  font-size: 9px;
  font-weight: 600;
  color: white;
  padding: 1px 4px;
  border-radius: 3px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
  line-height: 1.2;
}

.corner-tags {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  max-width: 80%;
  justify-content: flex-end;
  z-index: 1;
}

.corner-tag-item {
  font-size: 8px;
  font-weight: 600;
  color: white;
  padding: 1px 4px;
  border-radius: 3px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
  line-height: 1.2;
  white-space: nowrap;
}

.student-number {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary);
  background: white;
  padding: 2px 10px;
  border-radius: 6px;
  min-width: 40px;
  text-align: center;
}

.student-number-corner {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 9px;
  font-weight: 600;
  color: var(--color-primary);
  background: rgba(255, 255, 255, 0.95);
  padding: 1px 5px;
  border-radius: 3px;
  line-height: 1.2;
  z-index: 2;
}

.student-name {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  text-align: center;
  word-break: break-all;
  line-height: 1.3;
  max-width: 100%;
}

/* 空座位 */
.empty-seat {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.seat-placeholder {
  font-size: 13px;
  color: #999;
  font-weight: 400;
}

/* 交换模式下第一个选中的座位 */
.seat-item.selected {
  border-color: #ff9800;
  border-width: 3px;
  box-shadow: 0 0 12px rgba(255, 152, 0, 0.4);
}

/* 撤销/重做高亮效果 - 灰色显示 */
.seat-item.undo-highlighted {
  background: #f0f0f0 !important;
  border-color: #999 !important;
  opacity: 0.6;
  transition: all 0.3s ease;
  animation: undo-pulse 2s ease-in-out forwards;
}

.seat-item.undo-highlighted .student-name,
.seat-item.undo-highlighted .student-number {
  color: #666 !important;
}

@keyframes undo-pulse {
  0% {
    background: #e8e8e8;
    border-color: #999;
    transform: scale(1);
  }
  50% {
    background: #f5f5f5;
    border-color: #bbb;
    transform: scale(0.98);
  }
  100% {
    background: inherit;
    border-color: inherit;
    transform: scale(1);
    opacity: 1;
  }
}

/* 选区高亮 */
.seat-item.zone-highlight {
  background: var(--zone-color, #E0E0E0);
  border-color: var(--zone-color, #E0E0E0);
  box-shadow: 0 0 8px color-mix(in srgb, var(--zone-color, #E0E0E0) 50%, transparent);
}

/* 选区选中 */
.seat-item.selection-selected {
  border-color: #0ea5e9;
  border-width: 2.5px;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.2);
  background: rgba(14, 165, 233, 0.06);
}

.seat-item.selection-selected.occupied {
  background: color-mix(in srgb, rgba(14, 165, 233, 0.12) 50%, var(--color-bg-selected));
}

/* 拖拽吸附幽灵 */
.seat-item.drag-ghost {
  box-shadow: inset 0 0 0 2px rgba(14, 165, 233, 0.3);
  background: rgba(14, 165, 233, 0.08);
  position: relative;
}

.seat-item.drag-ghost::before {
  content: '';
  position: absolute;
  inset: -3px;
  border: 2px dashed #0ea5e9;
  border-radius: 10px;
  pointer-events: none;
}

.seat-item.zone-highlight.occupied {
  background: color-mix(in srgb, var(--zone-color, #E0E0E0) 40%, var(--color-bg-selected));
}

@media (max-width: 1366px) and (min-width: 1025px) {
  .seat-item {
    height: 68px;
    border-radius: 10px;
  }

  .student-display {
    gap: 3px;
    padding: 5px;
  }

  .student-name {
    font-size: 14px;
    line-height: 1.2;
  }

  .student-number {
    font-size: 11px;
    min-width: 34px;
    padding: 1px 8px;
  }

  .student-number-corner {
    font-size: 8px;
    padding: 1px 4px;
  }

  .tag-dot {
    width: 5px;
    height: 5px;
  }

  .tag-dot-hollow {
    border-width: 1.2px;
  }

  .tag-text-item {
    font-size: 8px;
    padding: 1px 3px;
  }

  .corner-tag-item {
    font-size: 7px;
    padding: 1px 3px;
  }

  .empty-text,
  .seat-placeholder {
    font-size: 11px;
  }
}

/* 小高度屏幕优化 */
@media (max-height: 820px) and (min-width: 1025px) {
  .seat-item {
    height: 64px;
    border-radius: 9px;
  }

  .student-display {
    gap: 2px;
    padding: 4px;
  }

  .student-name {
    font-size: 13px;
    line-height: 1.2;
  }

  .student-number {
    font-size: 10px;
    min-width: 32px;
    padding: 1px 7px;
  }

  .student-number-corner {
    font-size: 7px;
    padding: 1px 3px;
  }

  .tag-dot {
    width: 4px;
    height: 4px;
  }

  .tag-dot-hollow {
    border-width: 1px;
  }

  .tag-text-item {
    font-size: 7px;
    padding: 1px 2px;
  }

  .corner-tag-item {
    font-size: 6px;
    padding: 1px 2px;
  }

  .empty-text,
  .seat-placeholder {
    font-size: 10px;
  }
}

/* 响应式调整 */
@media (max-width: 1200px) {
  .student-number {
    font-size: 14px;
    padding: 3px 8px;
  }

  .student-number-corner {
    font-size: 8px;
  }

  .student-name {
    font-size: 13px;
  }
}

@media (max-width: 768px) {
  .seat-item {
    height: 70px;
  }

  .student-name {
    font-size: 12px;
  }

  .student-number {
    font-size: 11px;
    padding: 2px 6px;
  }

  .student-number-corner {
    font-size: 8px;
    padding: 1px 4px;
  }

  .tag-dot {
    width: 4px;
    height: 4px;
  }

  .tag-dot-hollow {
    border-width: 1px;
  }

  .tag-text-item {
    font-size: 7px;
    padding: 1px 3px;
  }

  .corner-tag-item {
    font-size: 6px;
    padding: 1px 3px;
  }

  .empty-text,
  .seat-placeholder {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .seat-item {
    height: 55px;
    border-radius: 8px;
  }

  .student-display {
    gap: 3px;
    padding: 4px;
  }

  .student-name {
    font-size: 11px;
  }

  .student-number {
    font-size: 10px;
    padding: 1px 6px;
    min-width: 30px;
  }

  .student-number-corner {
    font-size: 7px;
    padding: 1px 3px;
  }

  .tag-dot {
    width: 3px;
    height: 3px;
  }

  .tag-dot-hollow {
    border-width: 0.8px;
  }

  .tag-text-item {
    font-size: 6px;
    padding: 0 2px;
  }

  .corner-tag-item {
    font-size: 5px;
    padding: 0 2px;
  }

  .empty-text,
  .seat-placeholder {
    font-size: 10px;
  }
}
</style>
