<template>
  <div class="candidate-item" :class="{ dragging: isStudentDragging }"
    ref="itemRef" :draggable="canHtmlDrag()"
    @dragstart="handleDragStart" @dragend="handleDragEnd"
    @contextmenu.prevent @pointerdown="handlePointerDown">
    <div class="student-display" :class="{ 'bottom-tag-mode': tagDisplayMode === 'bottom' }">
      <div class="student-name">{{ student.name || '未命名' }}</div>
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
        {{ student.studentNumber || '-' }}
      </div>
      <div v-else class="student-number">{{ student.studentNumber || '-' }}</div>
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
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStudentDragging } from '@/composables/useStudentDragging'
import { useTagData } from '@/composables/useTagData'

const props = defineProps({
  student: {
    type: Object,
    required: true
  }
})

const itemRef = ref(null)
const { tags, showTagsInSeatChart, tagDisplayMode } = useTagData()

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

const {
  isStudentDragging,
  canHtmlDrag,
  handlePointerDown,
  handleDragStart,
  handleDragEnd
} = useStudentDragging(itemRef, computed(() => props.student))
</script>

<style scoped>
.candidate-item {
  width: 100%;
  aspect-ratio: 3 / 4;
  height: 80px;
  border: 2px solid var(--color-primary, #23587b);
  contain: layout style;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-selected, #e8f4f8);
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
  position: relative;
  overflow: hidden;
  user-select: none;
  -webkit-touch-callout: none;
  cursor: grab;
}

.candidate-item:hover {
  box-shadow: 0 4px 12px rgba(35, 88, 123, 0.2);
  transform: translateY(-2px);
}

.candidate-item:active {
  cursor: grabbing;
}

.candidate-item.dragging {
  background: transparent !important;
  border-color: #d0d7dc !important;
  transition: background 0.2s ease, border-color 0.2s ease;
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

.student-number {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary, #23587b);
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
  font-size: 10px;
  font-weight: 700;
  color: var(--color-primary, #23587b);
  background: white;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1.2;
  z-index: 1;
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

.student-tags-text {
  display: flex;
  gap: 3px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 2px;
}

.tag-text-item {
  font-size: 9px;
  font-weight: 700;
  color: white;
  padding: 2px 5px;
  border-radius: 3px;
  line-height: 1.2;
  white-space: nowrap;
}

.corner-tags {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  max-width: 50%;
  justify-content: flex-end;
  z-index: 1;
}

.corner-tag-item {
  font-size: 9px;
  font-weight: 700;
  color: white;
  padding: 2px 4px;
  border-radius: 3px;
  line-height: 1.2;
  white-space: nowrap;
}

@media (max-width: 1366px) and (min-width: 1025px) {
  .candidate-item { height: 68px; border-radius: 10px; }
  .student-display { gap: 3px; padding: 5px; }
  .student-name { font-size: 14px; line-height: 1.2; }
  .student-number { font-size: 11px; min-width: 34px; padding: 1px 8px; }
  .student-number-corner { font-size: 9px; padding: 1px 5px; top: 3px; right: 3px; }
  .tag-dot { width: 5px; height: 5px; }
  .tag-dot-hollow { border-width: 1.2px; }
  .tag-text-item { font-size: 8px; padding: 1px 4px; }
  .corner-tag-item { font-size: 8px; padding: 1px 3px; }
  .corner-tags { top: 3px; right: 3px; gap: 1px; }
}

@media (max-height: 820px) and (min-width: 1025px) {
  .candidate-item { height: 64px; border-radius: 9px; }
  .student-display { gap: 2px; padding: 4px; }
  .student-name { font-size: 13px; line-height: 1.2; }
  .student-number { font-size: 10px; min-width: 32px; padding: 1px 7px; }
  .student-number-corner { font-size: 8px; padding: 1px 4px; top: 2px; right: 2px; }
  .tag-dot { width: 4px; height: 4px; }
  .tag-dot-hollow { border-width: 1px; }
  .tag-text-item { font-size: 7px; padding: 1px 3px; }
  .corner-tag-item { font-size: 7px; padding: 1px 2px; }
  .corner-tags { top: 2px; right: 2px; gap: 1px; }
}

@media (max-width: 1200px) {
  .student-number { font-size: 14px; padding: 3px 8px; }
  .student-name { font-size: 13px; }
}

@media (max-width: 768px) {
  .candidate-item { height: 70px; }
  .student-name { font-size: 12px; }
  .student-number { font-size: 11px; padding: 2px 6px; }
  .student-number-corner { font-size: 9px; padding: 1px 5px; }
  .tag-dot { width: 4px; height: 4px; }
  .tag-dot-hollow { border-width: 1px; }
  .tag-text-item { font-size: 8px; padding: 1px 4px; }
  .corner-tag-item { font-size: 8px; padding: 1px 3px; }
}

@media (max-width: 480px) {
  .candidate-item { height: 55px; border-radius: 8px; }
  .student-display { gap: 3px; padding: 4px; }
  .student-name { font-size: 11px; }
  .student-number { font-size: 10px; padding: 1px 6px; min-width: 30px; }
  .student-number-corner { font-size: 8px; padding: 1px 4px; top: 2px; right: 2px; }
  .tag-dot { width: 3px; height: 3px; }
  .tag-dot-hollow { border-width: 0.8px; }
  .tag-text-item { font-size: 7px; padding: 1px 3px; }
  .corner-tag-item { font-size: 7px; padding: 1px 2px; }
  .corner-tags { top: 2px; right: 2px; }
}
</style>
