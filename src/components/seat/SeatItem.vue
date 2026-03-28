<template>
  <div class="seat-item" :class="{
    empty: seat.isEmpty,
    occupied: hasStudent,
    selected: isFirstSelected,
    clickable: isClickable,
    'zone-highlight': zoneHighlight,
    'drag-over': isDragOver,
    dragging: isDragging
  }" :style="zoneHighlightStyle" :data-seat-id="seat.id" :draggable="isDraggable" @click="handleClick"
    @dragstart="handleDragStart" @dragend="handleDragEnd" @dragover.prevent="handleDragOverSeat"
    @dragenter.prevent="handleDragEnter" @dragleave="handleDragLeave" @drop.prevent.stop="handleDrop"
    @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel" @contextmenu.prevent @pointerdown="handlePointerDown">
    <div v-if="seat.isEmpty" class="empty-indicator">
      <span class="empty-text">空置</span>
    </div>
    <div v-else-if="hasStudent" class="student-display">
      <div class="student-name">{{ studentInfo.name || '未命名' }}</div>
      <div class="student-number">{{ studentInfo.studentNumber || '-' }}</div>
    </div>
    <div v-else class="empty-seat">
      <span class="seat-placeholder">空位</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onUnmounted, shallowRef } from 'vue'
import { useStudentData } from '@/composables/useStudentData'
import { useEditMode } from '@/composables/useEditMode'
import { useZoneData } from '@/composables/useZoneData'
import { useZoneRotation } from '@/composables/useZoneRotation'

const props = defineProps({
  seat: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['assign-student', 'toggle-empty', 'clear-seat', 'swap-seat', 'toggle-zone-seat'])

const { students, selectedStudentId } = useStudentData()
const { currentMode, firstSelectedSeat, EditMode } = useEditMode()
const { visibleZoneSeats, selectedZoneId, toggleSeatInZone } = useZoneData()
const { editingZoneId, getRotZoneHighlights, toggleSeatInEditingZone } = useZoneRotation()

const isDragOver = ref(false)
const isDragging = ref(false)
let dragEnterCount = 0

// 触摸拖拽状态
let touchDragTimer = null
let touchDragActive = false
let touchPreviewEl = null
let touchMoveRafId = null
let previewW = 0
let previewH = 0
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
  return students.value.find(s => s.id === props.seat.studentId) || { name: '未知', studentNumber: null }
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
  if (currentMode.value === EditMode.NORMAL) {
    return selectedStudentId.value !== null && !props.seat.isEmpty
  }
  if (currentMode.value === EditMode.EMPTY_EDIT) return true
  if (currentMode.value === EditMode.SWAP) return true
  if (currentMode.value === EditMode.CLEAR) return hasStudent.value
  if (currentMode.value === EditMode.ZONE_EDIT) return true
  return false
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
  return canTouchDrag.value
})

// 记录指针类型，用于判断是否为触摸操作
const handlePointerDown = (e) => {
  lastPointerWasTouch.value = e.pointerType === 'touch'
}

// ==================== 点击处理 ====================

const handleClick = () => {
  if (!isClickable.value) return

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
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('application/json', JSON.stringify({
    type: 'seat',
    seatId: props.seat.id,
    studentId: props.seat.studentId
  }))
}

const handleDragEnd = () => {
  isDragging.value = false
  dragEnterCount = 0
}

const handleDragOverSeat = (e) => {
  e.dataTransfer.dropEffect = 'move'
}

const handleDragEnter = () => {
  dragEnterCount++
  if (!props.seat.isEmpty) {
    isDragOver.value = true
  }
}

const handleDragLeave = () => {
  dragEnterCount--
  if (dragEnterCount <= 0) {
    dragEnterCount = 0
    isDragOver.value = false
  }
}

const handleDrop = (e) => {
  isDragOver.value = false
  dragEnterCount = 0
  const raw = e.dataTransfer.getData('application/json')
  if (!raw) return

  try {
    const data = JSON.parse(raw)
    if (data.type === 'student' && !props.seat.isEmpty) {
      emit('assign-student', props.seat.id, data.studentId)
    } else if (data.type === 'seat' && data.seatId !== props.seat.id) {
      // 通过冒泡的自定义事件通知 SeatChart 做交换
      const event = new CustomEvent('touch-seat-drop', {
        bubbles: true,
        detail: {
          sourceSeatId: data.seatId,
          targetSeatId: props.seat.id
        }
      })
      e.target.dispatchEvent(event)
    }
  } catch {
    // ignore
  }
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

    const rect = e.currentTarget.getBoundingClientRect()
    touchPreviewEl = document.createElement('div')
    touchPreviewEl.className = 'touch-drag-preview'
    touchPreviewEl.textContent = studentInfo.value?.name || '未命名'
    touchPreviewEl.style.cssText = `
      position: fixed;
      left: ${startX - rect.width / 2}px;
      top: ${startY - rect.height / 2}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: rgba(35, 88, 123, 0.92);
      color: white;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      pointer-events: none;
      z-index: 9999;
      box-shadow: 0 6px 20px rgba(0,0,0,0.25);
      transform: scale(0.85);
      opacity: 0;
      will-change: transform, left, top;
      transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), opacity 0.15s ease;
    `
    previewW = rect.width
    previewH = rect.height
    document.body.appendChild(touchPreviewEl)
    requestAnimationFrame(() => {
      if (touchPreviewEl) {
        touchPreviewEl.style.transform = 'scale(1)'
        touchPreviewEl.style.opacity = '1'
      }
    })

    if (navigator.vibrate) navigator.vibrate(30)
  }, 300)
}

const handleTouchMove = (e) => {
  if (e.touches.length !== 1) return

  if (!touchDragActive) {
    // 判断手指移动距离，超过阈值才认为是滑动（取消长按）
    // 小幅抖动（≤ 8px）不取消定时器，让长按继续激活拖拽
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartX
    const dy = touch.clientY - touchStartY
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      if (touchDragTimer) {
        clearTimeout(touchDragTimer)
        touchDragTimer = null
      }
    }
    return
  }

  const touch = e.touches[0]
  const cx = touch.clientX
  const cy = touch.clientY

  // rAF 节流
  if (touchMoveRafId) cancelAnimationFrame(touchMoveRafId)
  touchMoveRafId = requestAnimationFrame(() => {
    touchMoveRafId = null
    if (touchPreviewEl) {
      touchPreviewEl.style.transition = 'none'
      touchPreviewEl.style.left = `${cx - previewW / 2}px`
      touchPreviewEl.style.top = `${cy - previewH / 2}px`
    }

    // 高亮目标座位
    const targetEl = document.elementFromPoint(cx, cy)
    clearAllTouchHighlights()
    if (targetEl) {
      const seatEl = findParentSeat(targetEl)
      if (seatEl && seatEl.dataset.seatId !== props.seat.id) {
        seatEl.classList.add('drag-over')
      }
    }
  })
}

// 公共清理函数：取消定时器、移除预览、重置所有状态
const cleanupTouchDrag = () => {
  if (touchDragTimer) { clearTimeout(touchDragTimer); touchDragTimer = null }
  if (touchMoveRafId) { cancelAnimationFrame(touchMoveRafId); touchMoveRafId = null }
  if (touchPreviewEl) { touchPreviewEl.remove(); touchPreviewEl = null }
  clearAllTouchHighlights()
  isDragging.value = false
  touchDragActive = false
}

// touchcancel：OS 中断触摸（弹出菜单、通知等），直接清理所有状态
const handleTouchCancel = () => {
  cleanupTouchDrag()
}

const handleTouchEnd = (e) => {
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
  // 先暂时隐藏预览以便 elementFromPoint 找到下方元素
  if (touchPreviewEl) touchPreviewEl.style.display = 'none'
  const targetEl = document.elementFromPoint(touch.clientX, touch.clientY)
  if (touchPreviewEl) {
    touchPreviewEl.remove()
    touchPreviewEl = null
  }

  clearAllTouchHighlights()
  isDragging.value = false
  touchDragActive = false

  if (!targetEl) return
  const seatEl = findParentSeat(targetEl)
  if (!seatEl || seatEl.dataset.seatId === props.seat.id) return

  const targetSeatId = seatEl.dataset.seatId
  // 触摸拖拽总是执行交换/分配
  // 通过自定义事件通知 SeatChart
  const event = new CustomEvent('touch-seat-drop', {
    bubbles: true,
    detail: {
      sourceSeatId: props.seat.id,
      targetSeatId: targetSeatId,
      studentId: props.seat.studentId
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

const clearAllTouchHighlights = () => {
  document.querySelectorAll('.seat-item.drag-over').forEach(el => {
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

.seat-item.clickable:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(35, 88, 123, 0.2);
  transform: translateY(-2px);
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
  opacity: 0.35;
  transform: scale(0.92);
  border-style: dashed;
  border-color: #90a4ae;
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.seat-item.drag-over {
  border-color: var(--color-primary);
  border-width: 2.5px;
  background: rgba(35, 88, 123, 0.08);
  outline: 3px solid rgba(35, 88, 123, 0.18);
  outline-offset: 1px;
  transform: scale(1.04);
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
  animation: drag-over-pulse 1.2s ease-in-out infinite;
}

@keyframes drag-over-pulse {
  0%, 100% {
    outline-width: 3px;
    outline-color: rgba(35, 88, 123, 0.18);
  }
  50% {
    outline-width: 5px;
    outline-color: rgba(35, 88, 123, 0.28);
  }
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
  gap: 8px;
  padding: 8px;
  width: 100%;
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

/* 选区高亮 */
.seat-item.zone-highlight {
  background: var(--zone-color, #E0E0E0);
  border-color: var(--zone-color, #E0E0E0);
  box-shadow: 0 0 8px color-mix(in srgb, var(--zone-color, #E0E0E0) 50%, transparent);
}

.seat-item.zone-highlight.occupied {
  background: color-mix(in srgb, var(--zone-color, #E0E0E0) 40%, var(--color-bg-selected));
}

/* 响应式调整 */
@media (max-width: 1200px) {
  .student-number {
    font-size: 14px;
    padding: 3px 8px;
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
    gap: 4px;
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

  .empty-text,
  .seat-placeholder {
    font-size: 10px;
  }
}
</style>
