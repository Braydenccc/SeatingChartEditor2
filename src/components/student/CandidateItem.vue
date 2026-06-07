<template>
  <div class="candidate-item" :class="{ dragging: isStudentDragging, selected: isSelected, compact: displayMode === 'compact' }"
    ref="itemRef" :draggable="canHtmlDrag()"
    @click="handleClick"
    @dragstart="handleDragStart" @dragend="handleDragEnd"
    @dblclick="handleDoubleClick"
    @contextmenu.prevent="handleContextMenu" @pointerdown="handlePointerDown" @touchstart.passive="handleTouchStart">
    <div class="student-display" :class="{ 'bottom-tag-mode': tagDisplayMode === 'bottom', 'name-hidden': !showStudentName, 'number-hidden': !showStudentNumber, 'large-name': largeNameMode, 'large-number': largeNumberMode }">
      <div v-if="showStudentName" class="student-name">{{ student.name || '未命名' }}</div>
      <!-- 颜色点模式：显示所有标签，用实心/空心区分 -->
      <div v-if="hasTags && tagDisplayMode === 'dot'" class="student-tags">
        <span v-for="tag in allVisibleTags" :key="tag.id"
          :class="['tag-dot', { 'tag-dot-hollow': !hasTag(tag.id) }]"
          :style="{ backgroundColor: hasTag(tag.id) ? tag.color : 'transparent', borderColor: tag.color }"
          :title="tag.name">
        </span>
      </div>
      <div v-if="hasNumericAttributes && tagDisplayMode === 'dot'" class="student-attributes-text">
        <span v-for="attribute in visibleStudentAttributes" :key="attribute.id"
          class="attribute-text-item"
          :title="attribute.title">
          {{ attribute.displayText }}
        </span>
      </div>
      <!-- 座位下部文字模式：学号绝对定位到右上角 -->
      <div v-if="showStudentNumber && tagDisplayMode === 'bottom'" class="student-number-corner">
        {{ student.studentNumber || '-' }}
      </div>
      <div v-else-if="showStudentNumber" class="student-number">{{ student.studentNumber || '-' }}</div>
      <!-- 座位下部文字模式：只显示学生拥有的标签 -->
      <div v-if="hasTags && tagDisplayMode === 'bottom'" class="student-tags-text">
        <span v-for="tag in studentTags" :key="tag.id"
          class="tag-text-item"
          :style="{ backgroundColor: tag.color }"
          :title="tag.name">
          {{ tag.name.substring(0, 2) }}
        </span>
      </div>
      <div v-if="hasNumericAttributes && tagDisplayMode === 'bottom'" class="student-attributes-text">
        <span v-for="attribute in visibleStudentAttributes" :key="attribute.id"
          class="attribute-text-item"
          :title="attribute.title">
          {{ attribute.displayText }}
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
    <div v-if="hasNumericAttributes && tagDisplayMode === 'corner'" class="corner-attributes">
      <span v-for="attribute in visibleStudentAttributes" :key="attribute.id"
        class="corner-attribute-item"
        :title="attribute.title">
        {{ attribute.displayText }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useStudentDragging } from '@/composables/useStudentDragging'
import { useTagData } from '@/composables/useTagData'
import { useSeatChart } from '@/composables/useSeatChart'
import { useStudentData } from '@/composables/useStudentData'
import { useEditMode } from '@/composables/useEditMode'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useLogger } from '@/composables/useLogger'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'

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
const { tags, showTagsInSeatChart, tagDisplayMode } = useTagData()
const { getEmptySeats, assignStudent } = useSeatChart()
const { selectedStudentId, selectStudent, clearSelection } = useStudentData()
const { currentMode, setMode, EditMode } = useEditMode()
const { settings } = useGlobalSettings()
const { success, warning } = useLogger()
const { enabledAttributeDefinitions, formatNumericValue, showNumericAttributesInEditor } = useStudentAttributes()
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

const showStudentName = computed(() => settings.value.ui.showStudentName !== false)
const showStudentNumber = computed(() => settings.value.ui.showStudentNumber !== false)
const hasHiddenElement = computed(() => !showStudentName.value || !showStudentNumber.value)
const largeNameMode = computed(() => showStudentName.value && hasHiddenElement.value && settings.value.ui.largeNameMode)
const largeNumberMode = computed(() => showStudentNumber.value && hasHiddenElement.value && settings.value.ui.largeNumberMode)

const allVisibleTags = computed(() => {
  if (!showTagsInSeatChart.value) return []
  return tags.value.filter(tag => tag.showInSeatChart !== false)
})

const hasTag = (tagId) => {
  if (!props.student || !props.student.tags) return false
  return props.student.tags.includes(tagId)
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

const visibleStudentAttributes = computed(() => {
  if (!showNumericAttributesInEditor.value) return []
  const numericAttributes = props.student.numericAttributes || {}
  return enabledAttributeDefinitions.value
    .filter(attribute => attribute.showInEditor !== false)
    .map(attribute => {
      const rawValue = numericAttributes[attribute.id]
      if (rawValue === null || rawValue === undefined || rawValue === '') return null
      const numberValue = Number(rawValue)
      if (!Number.isFinite(numberValue)) return null
      const formattedValue = formatNumericValue(numberValue, attribute.id)
      if (!formattedValue) return null
      const shortName = (attribute.name || '数值').substring(0, 2)
      return {
        id: attribute.id,
        displayText: `${shortName}${formattedValue}`,
        title: `${attribute.name}: ${formattedValue}`
      }
    })
    .filter(Boolean)
})

const hasNumericAttributes = computed(() => visibleStudentAttributes.value.length > 0)

const {
  isStudentDragging,
  canHtmlDrag,
  handlePointerDown,
  handleTouchStart,
  handleDragStart,
  handleDragEnd
} = useStudentDragging(itemRef, computed(() => props.student), {
  onStartDrag: () => suspendMobileDrawerForDrag('candidates'),
  onEndDrag: restoreMobileDrawerAfterDrag
})

const handleClick = () => {
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
  width: 120px;
  height: 80px;
  border: 1.5px solid var(--color-border);
  contain: layout style;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-card);
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
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
  height: 56px;
  border-width: 1px;
  border-radius: 8px;
}

.candidate-item.compact .student-display {
  align-items: flex-start;
  gap: 2px;
  padding: 6px 10px;
}

.candidate-item.compact .student-name {
  font-size: 15px;
  line-height: 1.2;
}

.candidate-item.compact .student-number {
  min-width: 0;
  font-size: 11px;
  padding: 1px 6px;
}

.student-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  width: 100%;
  position: relative;
}

.student-display.bottom-tag-mode {
  gap: 2px;
}

.student-display.name-hidden.number-hidden {
  justify-content: center;
}

.student-display.name-hidden:not(.number-hidden) .student-number {
  font-size: 14px;
}

.student-display.large-name .student-name {
  font-size: 20px;
}

.student-display.large-number .student-number {
  font-size: 16px;
  padding: 4px 14px;
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
  box-shadow: 0 1px 2px var(--shadow-lg);
}

.tag-dot-hollow {
  border: 1.5px solid;
  box-shadow: none;
}

.student-number {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary);
  background: var(--color-surface);
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
  background: color-mix(in srgb, var(--color-surface) 95%, var(--color-primary));
  padding: 1px 5px;
  border-radius: 3px;
  line-height: 1.2;
  z-index: 2;
}

.student-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
  word-break: break-all;
  line-height: 1.3;
  max-width: 100%;
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
  color: var(--color-text-inverse);
  padding: 1px 4px;
  border-radius: 3px;
  text-shadow: 0 1px 1px var(--shadow-lg);
  line-height: 1.2;
}

.student-attributes-text {
  display: flex;
  gap: 3px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 2px;
  max-width: 100%;
}

.attribute-text-item {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 8px;
  font-weight: 700;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border));
  padding: 1px 4px;
  border-radius: 3px;
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
  color: var(--color-text-inverse);
  padding: 1px 4px;
  border-radius: 3px;
  text-shadow: 0 1px 1px var(--shadow-lg);
  line-height: 1.2;
  white-space: nowrap;
}

.corner-attributes {
  position: absolute;
  left: 4px;
  bottom: 4px;
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  max-width: 82%;
  z-index: 1;
}

.corner-attribute-item {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 8px;
  font-weight: 700;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border));
  padding: 1px 4px;
  border-radius: 3px;
  line-height: 1.2;
}

@media (max-width: 1366px) and (min-width: 1025px) {
  .candidate-item { width: 102px; height: 68px; border-radius: 10px; }
  .student-display { gap: 3px; padding: 5px; }
  .student-name { font-size: 14px; line-height: 1.2; }
  .student-number { font-size: 11px; min-width: 34px; padding: 1px 8px; }
  .student-number-corner { font-size: 9px; padding: 1px 5px; top: 3px; right: 3px; }
  .tag-dot { width: 5px; height: 5px; }
  .tag-dot-hollow { border-width: 1.2px; }
  .tag-text-item { font-size: 8px; padding: 1px 4px; }
  .corner-tag-item { font-size: 8px; padding: 1px 3px; }
  .attribute-text-item,
  .corner-attribute-item { font-size: 7px; padding: 1px 3px; }
  .corner-tags { top: 3px; right: 3px; gap: 1px; }
  .corner-attributes { left: 3px; bottom: 3px; gap: 1px; }
}

@media (max-height: 820px) and (min-width: 1025px) {
  .candidate-item { width: 96px; height: 64px; border-radius: 9px; }
  .student-display { gap: 2px; padding: 4px; }
  .student-name { font-size: 13px; line-height: 1.2; }
  .student-number { font-size: 10px; min-width: 32px; padding: 1px 7px; }
  .student-number-corner { font-size: 8px; padding: 1px 4px; top: 2px; right: 2px; }
  .tag-dot { width: 4px; height: 4px; }
  .tag-dot-hollow { border-width: 1px; }
  .tag-text-item { font-size: 7px; padding: 1px 3px; }
  .corner-tag-item { font-size: 7px; padding: 1px 2px; }
  .attribute-text-item,
  .corner-attribute-item { font-size: 6px; padding: 1px 2px; }
  .corner-tags { top: 2px; right: 2px; gap: 1px; }
  .corner-attributes { left: 2px; bottom: 2px; gap: 1px; }
}

@media (max-width: 1200px) {
  .student-number { font-size: 14px; padding: 3px 8px; }
  .student-name { font-size: 13px; }
}

@media (max-width: 768px) {
  .candidate-item { width: 105px; height: 70px; }
  .student-name { font-size: 12px; }
  .student-number { font-size: 11px; padding: 2px 6px; }
  .student-number-corner { font-size: 9px; padding: 1px 5px; }
  .tag-dot { width: 4px; height: 4px; }
  .tag-dot-hollow { border-width: 1px; }
  .tag-text-item { font-size: 8px; padding: 1px 4px; }
  .corner-tag-item { font-size: 8px; padding: 1px 3px; }
  .attribute-text-item,
  .corner-attribute-item { font-size: 7px; padding: 1px 3px; }
}

@media (max-width: 480px) {
  .candidate-item { width: 82.5px; height: 55px; border-radius: 8px; }
  .student-display { gap: 3px; padding: 4px; }
  .student-name { font-size: 11px; }
  .student-number { font-size: 10px; padding: 1px 6px; min-width: 30px; }
  .student-number-corner { font-size: 8px; padding: 1px 4px; top: 2px; right: 2px; }
  .tag-dot { width: 3px; height: 3px; }
  .tag-dot-hollow { border-width: 0.8px; }
  .tag-text-item { font-size: 7px; padding: 1px 3px; }
  .corner-tag-item { font-size: 7px; padding: 1px 2px; }
  .attribute-text-item,
  .corner-attribute-item { font-size: 6px; padding: 0 2px; }
  .corner-tags { top: 2px; right: 2px; }
  .corner-attributes { left: 2px; bottom: 2px; }
}
</style>
