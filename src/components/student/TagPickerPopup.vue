<template>
  <teleport to="body">
    <div v-if="show" class="tag-picker-popup" ref="popupRef" :style="popupStyle" @click.stop>
      <div v-for="tag in availableTags" :key="tag.id" class="tag-option" @click="$emit('add', tag.id)">
        <span class="tag-dot" :style="{ background: tag.color }"></span>
        <span>{{ tag.name }}</span>
      </div>
      <div v-if="availableTags.length === 0" class="no-tags">
        暂无可添加的标签
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onClickOutside, useElementBounding, useWindowSize } from '@vueuse/core'

const props = defineProps({
  show: Boolean,
  availableTags: {
    type: Array,
    default: () => []
  },
  triggerEl: Object // HTML Element ref from parent (e.g. template ref)
})

const emit = defineEmits(['add', 'close'])

const popupRef = ref(null)

// 使用 VueUse 优雅地处理点击外部关闭，忽略触发按钮本身
onClickOutside(popupRef, () => {
  if (props.show) {
    emit('close')
  }
}, { 
  ignore: [computed(() => props.triggerEl)] 
})

// 纯响应式的屏幕和元素尺寸监测
const { width: windowWidth, height: windowHeight } = useWindowSize()
const triggerBounds = useElementBounding(computed(() => props.triggerEl))

const popupStyle = computed(() => {
  if (!props.show || !props.triggerEl) return { display: 'none' }

  const width = 220
  const maxHeight = 240
  const margin = 8

  let left = triggerBounds.left.value

  if (left + width + margin > windowWidth.value) {
    left = Math.max(margin, windowWidth.value - width - margin)
  }
  if (left < margin) left = margin

  const spaceBelow = windowHeight.value - triggerBounds.bottom.value - margin
  const spaceAbove = triggerBounds.top.value - margin
  let top
  let adjustedMaxHeight = maxHeight

  if (spaceBelow >= Math.min(maxHeight, 80) || spaceBelow >= spaceAbove) {
    top = triggerBounds.bottom.value + 6
    if (top + adjustedMaxHeight > windowHeight.value - margin) {
      adjustedMaxHeight = Math.max(windowHeight.value - top - margin, 80)
    }
  } else {
    top = triggerBounds.top.value - Math.min(maxHeight, spaceAbove) - 6
    if (top < margin) {
      top = margin
      adjustedMaxHeight = Math.min(maxHeight, spaceAbove)
    }
  }

  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${width}px`,
    maxHeight: `${adjustedMaxHeight}px`,
    zIndex: 9999
  }
})
</script>

<style scoped>
.tag-picker-popup {
  background: white;
  border: 2px solid var(--color-primary, #23587b);
  border-radius: 8px;
  box-shadow: var(--shadow-lg, 0 6px 20px rgba(0, 0, 0, 0.25));
  min-width: 220px;
  overflow-y: auto;
}

.tag-picker-popup::-webkit-scrollbar {
  width: 6px;
}
.tag-picker-popup::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}
.tag-picker-popup::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 3px;
}
.tag-picker-popup::-webkit-scrollbar-thumb:hover {
  background: #888;
}

.tag-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
  color: #333;
  font-size: 15px;
  font-weight: 500;
}
.tag-option:hover {
  background: var(--color-bg-selected, #e8f4f8);
}
.tag-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}
.no-tags {
  padding: 16px;
  text-align: center;
  color: #999;
  font-size: 14px;
}
</style>
