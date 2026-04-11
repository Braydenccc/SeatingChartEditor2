<template>
  <div class="candidate-item" :class="{ dragging: isStudentDragging }"
    ref="itemRef" :draggable="canHtmlDrag()" 
    @dragstart="handleDragStart" @dragend="handleDragEnd"
    @contextmenu.prevent @pointerdown="handlePointerDown">
    <div class="student-display">
      <div class="student-name">{{ student.name || '未命名' }}</div>
      <div class="student-number">{{ student.studentNumber || '-' }}</div>
      <div v-if="hasTags" class="student-tags">
        <span v-for="tag in studentTags" :key="tag.id" 
          :class="['tag-dot', { 'tag-dot-hollow': !hasTag(tag.id) }]"
          :style="{ backgroundColor: hasTag(tag.id) ? tag.color : 'transparent', borderColor: tag.color }"
          :title="tag.name">
        </span>
      </div>
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
const { tags, showTagsInSeatChart } = useTagData()

const studentTags = computed(() => {
  if (!showTagsInSeatChart.value) return []
  return tags.value.filter(tag => tag.showInSeatChart !== false)
})

const hasTag = (tagId) => {
  if (!props.student || !props.student.tags) return false
  return props.student.tags.includes(tagId)
}

const hasTags = computed(() => studentTags.value.length > 0)

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
  opacity: 0.35;
  transform: scale(0.92);
  border-style: dashed;
  border-color: #90a4ae;
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

.student-name {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  text-align: center;
  word-break: break-all;
  line-height: 1.3;
  max-width: 100%;
}

@media (max-width: 1366px) and (min-width: 1025px) {
  .candidate-item { height: 68px; border-radius: 10px; }
  .student-display { gap: 3px; padding: 5px; }
  .student-name { font-size: 14px; line-height: 1.2; }
  .student-number { font-size: 11px; min-width: 34px; padding: 1px 8px; }
  .tag-dot { width: 5px; height: 5px; }
  .tag-dot-hollow { border-width: 1.2px; }
}

/* 小高度屏幕优化 */
@media (max-height: 820px) and (min-width: 1025px) {
  .candidate-item { height: 64px; border-radius: 9px; }
  .student-display { gap: 2px; padding: 4px; }
  .student-name { font-size: 13px; line-height: 1.2; }
  .student-number { font-size: 10px; min-width: 32px; padding: 1px 7px; }
  .tag-dot { width: 4px; height: 4px; }
  .tag-dot-hollow { border-width: 1px; }
}

@media (max-width: 1200px) {
  .student-number { font-size: 14px; padding: 3px 8px; }
  .student-name { font-size: 13px; }
}

@media (max-width: 768px) {
  .candidate-item { height: 70px; }
  .student-name { font-size: 12px; }
  .student-number { font-size: 11px; padding: 2px 6px; }
  .tag-dot { width: 4px; height: 4px; }
  .tag-dot-hollow { border-width: 1px; }
}

@media (max-width: 480px) {
  .candidate-item { height: 55px; border-radius: 8px; }
  .student-display { gap: 3px; padding: 4px; }
  .student-name { font-size: 11px; }
  .student-number { font-size: 10px; padding: 1px 6px; min-width: 30px; }
  .tag-dot { width: 3px; height: 3px; }
  .tag-dot-hollow { border-width: 0.8px; }
}
</style>
