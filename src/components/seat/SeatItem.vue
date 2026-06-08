<template>
  <div class="seat-item" :class="{
    empty: seat.isEmpty,
    guard: isGuardSeat,
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
    'student-selected': isStudentSelected,
    'drag-ghost': isGhost
  }" :style="zoneHighlightStyle" :data-seat-id="seat.id" :draggable="isDraggable"
    @click="handleClick"
    @dblclick="handleDoubleClick"
    @dragstart="handleDragStart" @dragend="handleDragEnd" @dragover.prevent="handleDragOverSeat"
    @dragenter.prevent="handleDragEnter" @dragleave="handleDragLeave" @drop.prevent="handleDrop"
    @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel" @contextmenu.prevent.stop="handleContextMenuAction" @pointerdown="handlePointerDown">
    <div v-if="seat.isEmpty" class="empty-indicator">
      <span class="empty-text">空置</span>
    </div>
    <StudentCardFace
      v-else-if="hasStudent"
      :student="studentInfo"
      variant="seat"
      density="standard"
      fallback-name="未知"
    />
    <div v-else class="empty-seat">
      <span class="seat-placeholder">{{ isGuardSeat ? guardSeatLabel : '空位' }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onUnmounted, shallowRef, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useStudentData } from '@/composables/useStudentData'
import { useEditMode } from '@/composables/useEditMode'
import { useZoneData } from '@/composables/useZoneData'
import { useZoneRotation } from '@/composables/useZoneRotation'
import { useUndo } from '@/composables/useUndo'
import { useDragState } from '@/composables/useDragState'
import { useSelection } from '@/composables/useSelection'
import { useDragPreview } from '@/composables/useDragPreview'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useZoom } from '@/composables/useZoom'
import StudentCardFace from '@/components/student/StudentCardFace.vue'

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

const emit = defineEmits(['assign-student', 'toggle-empty', 'clear-seat', 'swap-seat', 'toggle-zone-seat', 'drag-start-seat', 'drag-enter-seat', 'drag-end-seat', 'edit-student'])

const { students, selectedStudentId } = useStudentData()
const { currentMode, firstSelectedSeat, EditMode } = useEditMode()
const { visibleZoneSeats, selectedZoneId, toggleSeatInZone } = useZoneData()
const { editingZoneId, getRotZoneHighlights, toggleSeatInEditingZone } = useZoneRotation()
const { isHighlighted } = useUndo()
const { dragCleanupVersion, startDragFromSeat, endDragFromSeat, startTouchDragFromSeat, endTouchDragFromSeat } = useDragState()
const {
  selectedSeatIds,
  selectedSeatsArray,
  isDraggingSelection,
  startDraggingSelection,
  endDraggingSelection,
  isSelectionMode,
  addSeatToSelection,
  toggleSeatInSelection,
  selectSingleSeat,
  clearSelection
} = useSelection()
const { startDragPreview, updateDragPreview, endDragPreview, isGhostSeat } = useDragPreview()
const { settings } = useGlobalSettings()
const { panX, panY, setPan } = useZoom()
const { setRightRailTab, openMobileDrawerForDrag, restoreMobileDrawerOpenedForDrag, isSeatFullscreen } = useEditorWorkbench()

const isDragOver = ref(false)
const isDragging = ref(false)
let dragEnterCount = 0
let transparentDragImageEl = null

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
let autoPanRafId = null
let autoPanPoint = null
let touchStartX = 0
let touchStartY = 0
let activeTouchDragData = null
let suppressNextClick = false
let suppressClickTimer = null
// 当前是否通过触摸交互（动态判断，解决触摸屏笔记本问题）
// 使用 shallowRef 让 isDraggable computed 能追踪其变化
const lastPointerWasTouch = shallowRef(false)

// ==================== 计算属性 ====================

const isGuardSeat = computed(() => props.seat.kind === 'guard')

const guardSeatLabel = computed(() => props.seat.guardSide === 'right' ? '右护法' : '左护法')

const hasStudent = computed(() => {
  return props.seat.studentId !== null && !props.seat.isEmpty
})

const studentInfo = computed(() => {
  if (!hasStudent.value) return null
  return students.value.find(s => s.id === props.seat.studentId) || { name: '未知', studentNumber: null, tags: [] }
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
  if (isMobile.value && isSelectionMode.value) return !isGuardSeat.value
  if (isSelectionMode.value) return !isGuardSeat.value

  if (currentMode.value === EditMode.NORMAL) {
    return selectedStudentId.value !== null && !props.seat.isEmpty
  }
  if (currentMode.value === EditMode.EMPTY_EDIT) return !isGuardSeat.value
  if (currentMode.value === EditMode.SWAP) return true
  if (currentMode.value === EditMode.CLEAR) return hasStudent.value
  if (currentMode.value === EditMode.ZONE_EDIT) return !isGuardSeat.value
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

const isStudentSelected = computed(() => {
  return hasStudent.value && selectedStudentId.value === props.seat.studentId
})

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
  if (isSelectionMode.value) return false
  if (isInSelection.value && hasStudent.value) return true
  return canTouchDrag.value
})

const shouldOpenCandidateDrawerForSeatDrag = computed(() => {
  return isMobile.value && isSeatFullscreen.value
})

const getDragSeatData = () => {
  const isSelection = isInSelection.value && selectedSeatsArray.value.length > 1
  return {
    isSelection,
    seatIds: isSelection ? selectedSeatsArray.value : [props.seat.id]
  }
}

const suppressUpcomingClick = () => {
  suppressNextClick = true
  if (suppressClickTimer) {
    clearTimeout(suppressClickTimer)
    suppressClickTimer = null
  }
  suppressClickTimer = setTimeout(() => {
    suppressNextClick = false
    suppressClickTimer = null
  }, 450)
}

const consumeSuppressedClick = () => {
  if (!suppressNextClick) return false
  suppressNextClick = false
  if (suppressClickTimer) {
    clearTimeout(suppressClickTimer)
    suppressClickTimer = null
  }
  return true
}

// 记录指针类型，用于判断是否为触摸操作
const handlePointerDown = (e) => {
  lastPointerWasTouch.value = e.pointerType === 'touch' || e.pointerType === 'pen'
}

// ==================== 点击处理 ====================

const handleClick = () => {
  if (consumeSuppressedClick()) return

  // 手机端选择模式：点击切换选中状态
  if (isMobile.value && isSelectionMode.value && !isGuardSeat.value) {
    toggleSeatInSelection(props.seat.id)
    return
  }

  if (isSelectionMode.value && !isGuardSeat.value) {
    addSeatToSelection(props.seat.id)
    setRightRailTab('selection')
    return
  }

  if (currentMode.value === EditMode.NORMAL && selectedStudentId.value && !props.seat.isEmpty) {
    emit('assign-student', props.seat.id, selectedStudentId.value)
    return
  }

  if (isMobile.value && currentMode.value === EditMode.NORMAL) {
    return
  }

  if (currentMode.value === EditMode.NORMAL && !isGuardSeat.value) {
    if (isInSelection.value) {
      clearSelection()
    } else {
      selectSingleSeat(props.seat.id)
      setRightRailTab('selection')
    }
    return
  }

  if (!isClickable.value) return

  switch (currentMode.value) {
    case EditMode.NORMAL:
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

const handleContextMenuAction = () => {
  if (lastPointerWasTouch.value || isMobile.value || isGuardSeat.value) return
  selectSingleSeat(props.seat.id)
  setRightRailTab('selection')
}

// 双击处理
const handleDoubleClick = () => {
  if (!hasStudent.value) return

  const doubleClickAction = settings.value.editor.doubleClickAction

  if (doubleClickAction === 'edit') {
    // 编辑学生信息
    emit('edit-student', studentInfo.value.id)
  } else if (doubleClickAction === 'random') {
    // 随机移出 - 将学生从座位移除到候选区
    emit('clear-seat', props.seat.id)
  }
}

// ==================== HTML5 拖拽 ====================

const handleDragStart = (e) => {
  if (!isDraggable.value) {
    e.preventDefault()
    return
  }
  isDragging.value = true
  if (!lastPointerWasTouch.value) {
    document.body?.classList.add('seat-dragging-from-chart')
  }
  if (shouldOpenCandidateDrawerForSeatDrag.value) openMobileDrawerForDrag('candidates')
  startDragFromSeat()
  e.dataTransfer.effectAllowed = 'move'

  const isSelection = !lastPointerWasTouch.value && isInSelection.value && selectedSeatsArray.value.length > 1
  const selectionData = isSelection ? selectedSeatsArray.value : [props.seat.id]

  if (isSelection) {
    startDraggingSelection()
  }

  emit('drag-start-seat', props.seat.id, isSelection)

  const dragData = JSON.stringify({
    type: 'seat',
    seatId: props.seat.id,
    studentId: props.seat.studentId,
    selectedSeatIds: selectionData
  })
  e.dataTransfer.setData('application/json', dragData)
  e.dataTransfer.setData('text/plain', dragData)

  e.dataTransfer.setDragImage(getTransparentDragImage(), 0, 0)

  startDragPreview(props.seat.id, selectionData, e.clientX, e.clientY)
}

const getTransparentDragImage = () => {
  if (transparentDragImageEl) return transparentDragImageEl

  const el = document.createElement('div')
  el.style.position = 'fixed'
  el.style.left = '-1px'
  el.style.top = '-1px'
  el.style.width = '1px'
  el.style.height = '1px'
  el.style.opacity = '0'
  el.style.pointerEvents = 'none'
  document.body.appendChild(el)
  transparentDragImageEl = el
  return el
}

const handleDragEnd = () => {
  isDragging.value = false
  document.body?.classList.remove('seat-dragging-from-chart')
  restoreMobileDrawerOpenedForDrag()
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

watch(dragCleanupVersion, () => {
  cleanupTouchDrag({ notifyGlobal: false, clearHighlights: false })
})

// ==================== 触摸拖拽模拟 ====================

const handleTouchStart = (e) => {
  lastPointerWasTouch.value = true
  if (e.touches.length !== 1) {
    cleanupTouchDrag()
    return
  }

  const touch = e.touches[0]
  const startX = touch.clientX
  const startY = touch.clientY
  touchStartX = startX
  touchStartY = startY

  if (!canTouchDrag.value) return

  touchDragTimer = setTimeout(() => {
    touchDragActive = true
    isDragging.value = true
    if (shouldOpenCandidateDrawerForSeatDrag.value) openMobileDrawerForDrag('candidates')
    startTouchDragFromSeat()
    if (navigator.vibrate) navigator.vibrate(50)

    activeTouchDragData = getDragSeatData()
    const selectionData = activeTouchDragData.seatIds

    if (activeTouchDragData.isSelection) {
      startDraggingSelection()
    }

    startDragPreview(props.seat.id, selectionData, startX, startY)
  }, 300)
}

const handleTouchMove = (e) => {
  if (e.touches.length !== 1) {
    cleanupTouchDrag()
    return
  }

  const touch = e.touches[0]
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY
  const moved = Math.abs(dx) > 5 || Math.abs(dy) > 5

  if (!isGuardSeat.value && isMobile.value && isSelectionMode.value && !touchDragActive && !touchSelectionActive && moved) {
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
    const clientX = touch.clientX
    const clientY = touch.clientY

    if (touchMoveRafId) {
      cancelAnimationFrame(touchMoveRafId)
    }

    touchMoveRafId = requestAnimationFrame(() => {
      touchMoveRafId = null
      const targetEl = document.elementFromPoint(clientX, clientY)
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
    })
    return
  }

  if (!touchDragActive) {
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      if (touchDragTimer) {
        clearTimeout(touchDragTimer)
        touchDragTimer = null
      }
    }
    return
  }

  e.preventDefault()

  const clientX = touch.clientX
  const clientY = touch.clientY
  const immediateTargetEl = document.elementFromPoint(clientX, clientY)
  const isOverDropOutZone = Boolean(immediateTargetEl && findParentByClass(immediateTargetEl, 'seat-touch-drop-out-zone'))

  updateDragPreview(clientX, clientY)
  if (!isOverDropOutZone) {
    autoPanNearEdge(clientX, clientY)
  } else {
    if (autoPanRafId) { cancelAnimationFrame(autoPanRafId); autoPanRafId = null }
    autoPanPoint = null
  }

  if (touchMoveRafId) {
    cancelAnimationFrame(touchMoveRafId)
  }

  touchMoveRafId = requestAnimationFrame(() => {
    touchMoveRafId = null

    const targetEl = document.elementFromPoint(clientX, clientY)
    clearAllTouchHighlights()
    if (targetEl) {
      const seatEl = findParentSeat(targetEl)
      if (seatEl && seatEl.dataset.seatId !== props.seat.id) {
        seatEl.classList.add('drag-over')
      } else {
        const dropOutEl = findParentByClass(targetEl, 'seat-touch-drop-out-zone')
        if (dropOutEl && props.seat.studentId != null) {
          dropOutEl.classList.add('is-touch-over')
          return
        }
        const studentListEl = findParentByClass(targetEl, 'student-items')
        if (studentListEl && props.seat.studentId != null) {
          studentListEl.classList.add('drag-over')
        }
      }
    }
  })
}

// 公共清理函数：取消定时器、移除预览、重置所有状态
const cleanupTouchDrag = ({ notifyGlobal = true, clearHighlights = true } = {}) => {
  if (touchDragTimer) { clearTimeout(touchDragTimer); touchDragTimer = null }
  if (touchMoveRafId) { cancelAnimationFrame(touchMoveRafId); touchMoveRafId = null }
  if (autoPanRafId) { cancelAnimationFrame(autoPanRafId); autoPanRafId = null }
  autoPanPoint = null
  if (clearHighlights) {
    clearAllTouchHighlights()
  }
  document.body?.classList.remove('seat-dragging-from-chart')
  isDragging.value = false
  isDragOver.value = false
  dragEnterCount = 0
  if (touchDragActive) {
    suppressUpcomingClick()
    if (notifyGlobal) {
      endTouchDragFromSeat()  // 重置全局触摸拖拽状态
    }
    restoreMobileDrawerOpenedForDrag()
    endDraggingSelection()
    endDragPreview()
  } else {
    endDraggingSelection()
  }
  touchDragActive = false
  activeTouchDragData = null
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
    suppressUpcomingClick()
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
  const dragData = activeTouchDragData || getDragSeatData()
  suppressUpcomingClick()

  // 获取 drop 目标
  const touch = e.changedTouches[0]
  const targetEl = document.elementFromPoint(touch.clientX, touch.clientY)

  clearAllTouchHighlights()
  document.body?.classList.remove('seat-dragging-from-chart')
  isDragging.value = false
  endTouchDragFromSeat()  // 重置全局触摸拖拽状态，隐藏覆盖层
  restoreMobileDrawerOpenedForDrag()
  endDraggingSelection()
  endDragPreview()
  touchDragActive = false
  activeTouchDragData = null

  if (!targetEl) return
  const seatEl = findParentSeat(targetEl)
  if (!seatEl || seatEl.dataset.seatId === props.seat.id) {
    // 检测是否拖到候选列表区域
    const dropOutEl = findParentByClass(targetEl, 'seat-touch-drop-out-zone')
    const studentListEl = findParentByClass(targetEl, 'student-items')
    const dropTargetEl = dropOutEl || studentListEl
    if (dropTargetEl && props.seat.studentId != null) {
      const event = new CustomEvent('touch-seat-to-list', {
        bubbles: true,
        detail: {
          seatId: props.seat.id,
          studentId: props.seat.studentId,
          isSelection: dragData.isSelection,
          selectedSeatIds: dragData.seatIds
        }
      })
      dropTargetEl.dispatchEvent(event)
    }
    return
  }

  const targetSeatId = seatEl.dataset.seatId

  // 触摸拖拽总是执行交换/分配
  // 通过自定义事件通知 SeatChart
  const event = new CustomEvent('touch-seat-drop', {
    bubbles: true,
    detail: {
      sourceSeatId: props.seat.id,
      targetSeatId: targetSeatId,
      studentId: props.seat.studentId,
      isSelection: dragData.isSelection,
      selectedSeatIds: dragData.seatIds
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
  document.querySelectorAll('.seat-touch-drop-out-zone.is-touch-over').forEach(el => {
    el.classList.remove('is-touch-over')
  })
}

const autoPanNearEdge = (clientX, clientY) => {
  autoPanPoint = { clientX, clientY }
  if (!autoPanRafId) {
    autoPanRafId = requestAnimationFrame(runAutoPanNearEdge)
  }
}

const runAutoPanNearEdge = () => {
  autoPanRafId = null
  if (!touchDragActive || !autoPanPoint) return

  const { clientX, clientY } = autoPanPoint
  const margin = 54
  const step = 12 * (settings.value.editor.dragSensitivity || 1)
  const width = window.innerWidth
  const height = window.innerHeight
  let nextX = panX.value
  let nextY = panY.value

  if (clientX < margin) nextX += step
  else if (clientX > width - margin) nextX -= step

  if (clientY < margin) nextY += step
  else if (clientY > height - margin) nextY -= step

  if (nextX === panX.value && nextY === panY.value) {
    autoPanPoint = null
    return
  }

  setPan(nextX, nextY)
  autoPanRafId = requestAnimationFrame(() => {
    runAutoPanNearEdge()
  })
}

onUnmounted(() => {
  cleanupTouchDrag()
  if (touchMoveRafId) {
    cancelAnimationFrame(touchMoveRafId)
    touchMoveRafId = null
  }
  if (suppressClickTimer) {
    clearTimeout(suppressClickTimer)
    suppressClickTimer = null
  }
})
</script>

<style scoped>
.seat-item {
  width: 100%;
  height: var(--seat-card-height);
  box-sizing: border-box;
  border: var(--seat-card-border-width) solid var(--color-border);
  contain: layout style;
  border-radius: var(--seat-card-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  transition: border-color var(--seat-card-transition), background var(--seat-card-transition), box-shadow var(--seat-card-transition), transform var(--seat-card-transition), opacity var(--seat-card-transition);
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

.seat-item:not(.dragging):hover {
  box-shadow: var(--seat-card-shadow-hover);
}

.seat-item.clickable:not(.selection-selected):hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.seat-item.selection-selected.clickable:hover {
  border-color: var(--color-selection-border);
  box-shadow: var(--shadow-selection-ring), var(--shadow-selection-card);
  transform: none;
}

@media (hover: none) and (pointer: coarse) {
  .seat-item:not(.dragging):hover,
  .seat-item.clickable:not(.selection-selected):hover {
    border-color: var(--color-border);
    box-shadow: none;
    transform: none;
  }

  .seat-item.occupied:hover,
  .seat-item.occupied.clickable:not(.selection-selected):hover {
    border-color: var(--color-primary);
  }

  .seat-item.selection-selected:hover,
  .seat-item.selection-selected.clickable:hover {
    border-color: var(--color-selection-border);
    box-shadow: var(--shadow-selection-ring), var(--shadow-selection-card);
  }

  .seat-item.student-selected:hover {
    border-color: var(--color-selection-border);
    box-shadow: var(--shadow-selection-ring);
  }

  .seat-item.drag-over:hover {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }
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
  border-color: var(--color-border) !important;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.seat-item.dragging.is-anchor {
  background: transparent !important;
  border-color: var(--color-border) !important;
}

.seat-item.selection-dragging {
  background: transparent !important;
  border-color: var(--color-border) !important;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.seat-item.drag-over {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
  animation: pulse-primary 1s infinite;
}

/* 空置座位样式 */
.seat-item.empty {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
}

.seat-item.empty .empty-indicator {
  background: var(--color-surface);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border-dark);
}

.empty-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

/* 已分配学生的座位 */
.seat-item.occupied {
  background: var(--color-bg-selected);
  border-color: var(--color-primary);
}

.seat-item.guard {
  border-style: dashed;
  background: var(--color-bg-secondary);
}

.seat-item.guard.occupied {
  border-style: solid;
  background: var(--color-bg-selected);
}

.seat-item.guard .seat-placeholder {
  color: var(--color-primary);
  font-weight: 600;
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
  color: var(--color-text-disabled);
  font-weight: 400;
}

/* 交换模式下第一个选中的座位 */
.seat-item.selected {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 30%, transparent);
  transform: scale(1.05);
  transition: all 0.2s ease;
  border-color: var(--color-warning);
  border-width: 3px;
}

/* 撤销/重做高亮效果 - 灰色显示 */
.seat-item.undo-highlighted {
  border-color: var(--color-border-dark);
  transition: all 0.3s ease;
  animation: undo-pulse 2s ease-in-out forwards;
}

.seat-item.undo-highlighted :deep(.student-name),
.seat-item.undo-highlighted :deep(.student-number) {
  animation: undo-text-fade 2s ease-in-out forwards;
}

@keyframes undo-pulse {
  0% {
    background: var(--color-bg-hover);
    border-color: var(--color-border-dark);
    transform: scale(1);
    opacity: 1;
  }
  15% {
    background: var(--color-bg-secondary);
    border-color: var(--color-border);
    transform: scale(0.98);
    opacity: 0.6;
  }
  100% {
    background: inherit;
    border-color: inherit;
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes undo-text-fade {
  0% {
    color: var(--color-text-secondary);
  }
  15% {
    color: var(--color-text-secondary);
  }
  100% {
    color: inherit;
  }
}

/* 选区高亮 */
.seat-item.zone-highlight {
  background: var(--zone-color, var(--color-border));
  border-color: var(--zone-color, var(--color-border));
  box-shadow: 0 0 8px color-mix(in srgb, var(--zone-color, var(--color-border)) 50%, transparent);
}

/* 选区选中 */
.seat-item.selection-selected {
  border-color: var(--color-selection-border);
  border-width: 2.5px;
  box-shadow: var(--shadow-selection-ring), var(--shadow-selection-card);
  background: var(--color-selection-bg);
  transform: scale(1.05);
  z-index: 10;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.seat-item.selection-selected.occupied {
  background: var(--color-selection-bg-strong);
}

.seat-item.student-selected {
  border-color: var(--color-selection-border);
  background: var(--color-selection-bg);
  box-shadow: var(--shadow-selection-ring);
}

/* 拖拽吸附幽灵 */
.seat-item.drag-ghost {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-info) 30%, transparent);
  background: color-mix(in srgb, var(--color-info) 8%, var(--color-bg-card));
  position: relative;
}

.seat-item.drag-ghost::before {
  content: '';
  position: absolute;
  inset: -3px;
  border: 2px dashed var(--color-info);
  border-radius: 10px;
  pointer-events: none;
}

.seat-item.zone-highlight.occupied {
  background: color-mix(in srgb, var(--zone-color, var(--color-border-strong)) 40%, var(--color-bg-selected));
}

@media (max-width: 1366px) and (min-width: 1025px) {
  .empty-text,
  .seat-placeholder {
    font-size: 11px;
  }
}

/* 小高度屏幕优化 */
@media (max-height: 820px) and (min-width: 1025px) {
  .empty-text,
  .seat-placeholder {
    font-size: 10px;
  }
}

@media (max-width: 768px) {
  .empty-text,
  .seat-placeholder {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .empty-text,
  .seat-placeholder {
    font-size: 10px;
  }
}
</style>
