<template>
  <div class="candidate-item" :class="{ dragging: isStudentDragging, selected: isSelected, compact: displayMode === 'compact' }"
    ref="itemRef" :draggable="canHtmlDrag()"
    @click="handleClick"
    @dragstart="handleDragStart" @dragend="handleDragEnd"
    @dblclick="handleDoubleClick"
    @contextmenu.prevent="handleContextMenu" @pointerdown="handlePointerDown" @touchstart.passive="handleTouchStart">
    <StudentCardFace
      :student="student"
      variant="candidate"
      :density="displayMode === 'compact' ? 'compact' : 'standard'"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useStudentDragging } from '@/composables/useStudentDragging'
import { useSeatChart } from '@/composables/useSeatChart'
import { useStudentData } from '@/composables/useStudentData'
import { useEditMode } from '@/composables/useEditMode'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useLogger } from '@/composables/useLogger'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import StudentCardFace from './StudentCardFace.vue'

const props = defineProps({
  student: {
    type: Object,
    required: true
  },
  displayMode: {
    type: String,
    default: 'grid'
  }
})

const emit = defineEmits(['edit-student'])

const itemRef = ref(null)
const { getEmptySeats, assignStudent } = useSeatChart()
const { selectedStudentId, selectStudent, clearSelection } = useStudentData()
const { currentMode, setMode, EditMode } = useEditMode()
const { settings } = useGlobalSettings()
const { success, warning } = useLogger()
const {
  setRightRailTab,
  showMobileSheet,
  closeMobileSheet,
  suspendMobileDrawerForDrag,
  restoreMobileDrawerAfterDrag,
  isSeatFullscreen
} = useEditorWorkbench()
const isMobileWorkbench = useMediaQuery('(max-width: 1024px)')
const isLandscape = useMediaQuery('(orientation: landscape)')
const isFullscreenLandscape = computed(() => isSeatFullscreen.value && isMobileWorkbench.value && isLandscape.value)

const isSelected = computed(() => selectedStudentId.value === props.student.id)

const {
  isStudentDragging,
  lastPointerWasTouch,
  canHtmlDrag,
  consumeSuppressedClick,
  handlePointerDown,
  handleTouchStart,
  handleDragStart,
  handleDragEnd
} = useStudentDragging(itemRef, computed(() => props.student), {
  onStartDrag: () => suspendMobileDrawerForDrag('candidates'),
  onEndDrag: restoreMobileDrawerAfterDrag
})

const isCoarsePointerContextMenu = () => {
  return window.matchMedia?.('(hover: none) and (pointer: coarse)').matches
}

const handleClick = () => {
  if (consumeSuppressedClick()) return

  if (isSelected.value) {
    clearSelection()
    return
  }
  if (currentMode.value !== EditMode.NORMAL) {
    setMode(EditMode.NORMAL)
  }
  selectStudent(props.student.id)
  setRightRailTab('selection')
  if (isMobileWorkbench.value && !isFullscreenLandscape.value) {
    closeMobileSheet()
  }
}

const handleContextMenu = () => {
  if (isStudentDragging.value || lastPointerWasTouch.value || isCoarsePointerContextMenu()) return

  selectStudent(props.student.id)
  setRightRailTab('selection')
  if (window.matchMedia('(max-width: 768px)').matches) {
    showMobileSheet('context')
  }
}

// 双击处理
const handleDoubleClick = () => {
  const doubleClickAction = settings.value.editor.doubleClickAction

  if (doubleClickAction === 'edit') {
    // 编辑学生信息 - 触发编辑事件
    emit('edit-student', props.student.id)
  } else if (doubleClickAction === 'random') {
    // 随机移入 - 将学生随机分配到空座位
    const emptySeats = getEmptySeats()
    if (emptySeats.length === 0) {
      warning('没有可用的空座位')
      return
    }

    // 随机选择一个空座位
    const randomIndex = Math.floor(Math.random() * emptySeats.length)
    const randomSeat = emptySeats[randomIndex]

    // 分配学生到该座位
    const success_result = assignStudent(randomSeat.id, props.student.id)
    if (success_result) {
      success(`${props.student.name} 已随机分配到座位`)
    }
  }
}
</script>

<style scoped>
.candidate-item {
  width: var(--seat-card-width);
  height: var(--seat-card-height);
  border: 1.5px solid var(--color-border);
  contain: layout style;
  border-radius: var(--seat-card-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-card);
  transition: border-color var(--seat-card-transition), background var(--seat-card-transition), box-shadow var(--seat-card-transition), transform var(--seat-card-transition), opacity var(--seat-card-transition);
  position: relative;
  overflow: hidden;
  user-select: none;
  -webkit-touch-callout: none;
  cursor: grab;
}

.candidate-item:hover {
  border-color: var(--color-selection-border);
  background: var(--color-selection-bg);
  box-shadow: var(--shadow-selection-card);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (hover: none) and (pointer: coarse) {
  .candidate-item:hover {
    border-color: var(--color-border);
    background: var(--color-bg-card);
    box-shadow: none;
    transform: none;
  }

  .candidate-item.selected:hover {
    border-color: var(--color-selection-border);
    background: var(--color-selection-bg-strong);
    box-shadow: var(--shadow-selection-ring), var(--shadow-selection-card);
  }

  .candidate-item.dragging:hover {
    background: transparent;
    border-color: var(--color-border);
  }
}

.candidate-item:active {
  cursor: grabbing;
  transform: scale(0.98);
}

.candidate-item.dragging {
  opacity: 0.5;
  transform: scale(0.98);
  background: transparent !important;
  border-color: var(--color-border) !important;
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.candidate-item.selected {
  border-color: var(--color-selection-border);
  background: var(--color-selection-bg-strong);
  box-shadow: var(--shadow-selection-ring), var(--shadow-selection-card);
}

.candidate-item.selected::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--color-selection-border);
  pointer-events: none;
}

.candidate-item.compact {
  width: 100%;
  height: var(--candidate-card-height);
  border-width: 1px;
  border-radius: var(--candidate-card-radius);
}

@media (max-width: 1366px) and (min-width: 1025px) {
  .candidate-item { width: var(--seat-card-width); height: var(--seat-card-height); border-radius: var(--seat-card-radius); }
}

@media (max-height: 820px) and (min-width: 1025px) {
  .candidate-item { width: var(--seat-card-width); height: var(--seat-card-height); border-radius: var(--seat-card-radius); }
}

@media (max-width: 768px) {
  .candidate-item { width: var(--seat-card-width); height: var(--seat-card-height); border-radius: var(--seat-card-radius); }
}

@media (max-width: 480px) {
  .candidate-item { width: var(--seat-card-width); height: var(--seat-card-height); border-radius: var(--seat-card-radius); }
}
</style>
