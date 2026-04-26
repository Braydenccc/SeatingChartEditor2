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
  background: var(--color-border-light);
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
  background: color-mix(in srgb, var(--color-primary) 5%, transparent);
}

.resize-divider.is-dragging {
  background: color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.resize-divider.is-dragging .divider-drag-area {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.divider-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: 8px;
  color: var(--color-text-disabled);
  opacity: 1;
  transition: all 0.2s ease;
  pointer-events: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.divider-drag-area:hover .divider-handle {
  border-color: var(--color-primary);
  color: var(--color-primary);
  box-shadow: 0 2px 4px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.resize-divider.is-dragging .divider-handle {
  border-color: var(--color-primary-hover);
  color: var(--color-primary-hover);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--color-primary) 25%, transparent);
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
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 11;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  touch-action: manipulation;
}

.collapse-toggle:hover {
  background: var(--color-bg-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
  box-shadow: 0 2px 4px color-mix(in srgb, var(--color-primary) 15%, transparent);
  transform: translateY(-50%) scale(1.1);
}

.collapse-toggle:active {
  transform: translateY(-50%) scale(0.95);
}

.collapse-toggle.is-collapsed {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-surface);
  box-shadow: 0 2px 4px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.collapse-toggle.is-collapsed:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--color-primary) 35%, transparent);
}

.resize-divider.is-collapsed {
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
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
    background: var(--color-bg-secondary);
  }

  .collapse-toggle.is-collapsed:active {
    background: var(--color-primary-hover);
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
