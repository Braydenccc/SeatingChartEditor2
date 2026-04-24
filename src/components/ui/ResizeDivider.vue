<template>
  <div
    class="resize-divider"
    :class="{ 'is-dragging': isDragging, 'is-collapsed': isCollapsed }"
    role="separator"
    aria-orientation="horizontal"
    aria-label="调整候选栏高度"
  >
    <div
      class="divider-drag-area"
      @mousedown="handleMouseDown"
      @touchstart.prevent="handleTouchStart"
    >
      <div class="divider-handle">
        <GripHorizontal :size="16" stroke-width="2" />
      </div>
    </div>

    <button
      class="collapse-toggle"
      :class="{ 'is-collapsed': isCollapsed }"
      @click="handleToggleClick"
      :aria-label="isCollapsed ? '展开候选栏' : '折叠候选栏'"
      :title="isCollapsed ? '展开候选栏' : '折叠候选栏'"
    >
      <ChevronDown v-if="!isCollapsed" :size="14" />
      <ChevronUp v-else :size="14" />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { GripHorizontal, ChevronUp, ChevronDown } from 'lucide-vue-next'
import { useResizablePanel } from '@/composables/useResizablePanel'

const props = defineProps({
  unassignedCount: {
    type: Number,
    required: true
  }
})

const {
  isDragging,
  userHeight,
  getEffectiveHeight,
  startResize,
  updateResize,
  endResize,
  toggleCollapse
} = useResizablePanel()

const isCollapsed = computed(() => userHeight.value === 0)

const handleMouseDown = (e) => {
  e.preventDefault()
  e.stopPropagation()
  const currentHeight = getEffectiveHeight(props.unassignedCount)
  startResize(e.clientY, currentHeight)

  const handleMouseMove = (e) => {
    updateResize(e.clientY, props.unassignedCount)
  }

  const handleMouseUp = () => {
    endResize()
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleTouchStart = (e) => {
  e.stopPropagation()
  const touch = e.touches[0]
  const currentHeight = getEffectiveHeight(props.unassignedCount)
  startResize(touch.clientY, currentHeight)

  const handleTouchMove = (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    updateResize(touch.clientY, props.unassignedCount)
  }

  const handleTouchEnd = () => {
    endResize()
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleTouchEnd)
  }

  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd)
}

const handleToggleClick = (e) => {
  e.preventDefault()
  e.stopPropagation()
  toggleCollapse(props.unassignedCount)
}
</script>

<style scoped>
.resize-divider {
  position: relative;
  height: 6px;
  background: #e8eef2;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  z-index: 10;
  transition: background 0.2s ease;
}

.divider-drag-area {
  position: absolute;
  top: -8px;
  left: 0;
  right: 0;
  height: 22px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

.divider-drag-area:hover {
  background: rgba(35, 88, 123, 0.05);
}

.resize-divider.is-dragging {
  background: rgba(35, 88, 123, 0.2);
}

.resize-divider.is-dragging .divider-drag-area {
  background: rgba(35, 88, 123, 0.1);
}

.divider-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 20px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #9ca3af;
  opacity: 1;
  transition: all 0.2s ease;
  pointer-events: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.divider-drag-area:hover .divider-handle {
  border-color: #23587b;
  color: #23587b;
  box-shadow: 0 2px 4px rgba(35, 88, 123, 0.15);
}

.resize-divider.is-dragging .divider-handle {
  border-color: #1a4460;
  color: #1a4460;
  box-shadow: 0 2px 6px rgba(35, 88, 123, 0.25);
  transform: scale(1.05);
}

.collapse-toggle {
  position: absolute;
  left: calc(50% + 32px);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 11;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  touch-action: manipulation;
}

.collapse-toggle:hover {
  background: #f9fafb;
  border-color: #23587b;
  color: #23587b;
  box-shadow: 0 2px 4px rgba(35, 88, 123, 0.15);
  transform: translateY(-50%) scale(1.1);
}

.collapse-toggle:active {
  transform: translateY(-50%) scale(0.95);
}

.collapse-toggle.is-collapsed {
  background: #23587b;
  border-color: #23587b;
  color: white;
  box-shadow: 0 2px 4px rgba(35, 88, 123, 0.25);
}

.collapse-toggle.is-collapsed:hover {
  background: #1a4460;
  border-color: #1a4460;
  box-shadow: 0 2px 6px rgba(35, 88, 123, 0.35);
}

.resize-divider.is-collapsed {
  background: rgba(35, 88, 123, 0.15);
}

.resize-divider.is-collapsed .divider-handle {
  opacity: 0.5;
}

/* 触摸屏优化 */
@media (hover: none) and (pointer: coarse) {
  .divider-drag-area {
    height: 32px;
    top: -13px;
  }

  .divider-handle {
    width: 56px;
    height: 24px;
  }

  .collapse-toggle {
    width: 32px;
    height: 32px;
    left: calc(50% + 36px);
  }

  .collapse-toggle:hover {
    transform: translateY(-50%);
  }

  .collapse-toggle:active {
    transform: translateY(-50%) scale(0.9);
    background: #e5e7eb;
  }

  .collapse-toggle.is-collapsed:active {
    background: #1a4460;
  }
}

/* 桌面触摸屏优化（如 Surface） */
@media (hover: hover) and (pointer: coarse) {
  .divider-drag-area {
    height: 28px;
    top: -11px;
  }

  .divider-handle {
    width: 52px;
    height: 22px;
  }

  .collapse-toggle {
    width: 28px;
    height: 28px;
    left: calc(50% + 34px);
  }
}

@media (max-width: 1024px) {
  .resize-divider {
    display: none;
  }
}
</style>
