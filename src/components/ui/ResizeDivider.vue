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
      <div class="divider-line">
        <div class="divider-grip">
          <span class="grip-dot"></span>
          <span class="grip-dot"></span>
          <span class="grip-dot"></span>
        </div>
      </div>
    </div>

    <button
      class="collapse-toggle"
      :class="{ 'is-collapsed': isCollapsed }"
      @click="handleToggleClick"
      :aria-label="isCollapsed ? '展开候选栏' : '折叠候选栏'"
      :title="isCollapsed ? '展开候选栏' : '折叠候选栏'"
    >
      <ChevronDown v-if="!isCollapsed" :size="12" stroke-width="2.5" />
      <ChevronUp v-else :size="12" stroke-width="2.5" />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronUp, ChevronDown } from 'lucide-vue-next'
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
  height: 12px;
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
  top: -4px;
  left: 0;
  right: 0;
  height: 20px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

.divider-line {
  width: 100%;
  height: 1px;
  background: var(--color-border);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.divider-grip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 4px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  position: relative;
  z-index: 1;
  transition: all 0.2s ease;
  pointer-events: none;
}

.grip-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--color-text-disabled);
  transition: background 0.2s ease;
}

.divider-drag-area:hover .divider-line {
  background: var(--color-border-strong);
}

.divider-drag-area:hover .divider-grip {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.divider-drag-area:hover .grip-dot {
  background: var(--color-primary);
}

.resize-divider.is-dragging {
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
}

.resize-divider.is-dragging .divider-line {
  background: color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.resize-divider.is-dragging .divider-grip {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 15%, transparent);
  transform: scale(1.08);
}

.resize-divider.is-dragging .grip-dot {
  background: var(--color-primary);
}

.collapse-toggle {
  position: absolute;
  left: calc(50% + 30px);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 11;
  touch-action: manipulation;
}

.collapse-toggle:hover {
  background: var(--color-bg-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 10%, transparent);
  transform: translateY(-50%) scale(1.1);
}

.collapse-toggle:active {
  transform: translateY(-50%) scale(0.92);
}

.collapse-toggle.is-collapsed {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-surface);
}

.collapse-toggle.is-collapsed:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
  transform: translateY(-50%) scale(1.1);
}

.resize-divider.is-collapsed .divider-line {
  background: color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.resize-divider.is-collapsed .divider-grip {
  opacity: 0.4;
}

.resize-divider.is-collapsed .grip-dot {
  background: var(--color-primary);
}

@media (hover: none) and (pointer: coarse) {
  .divider-drag-area {
    height: 28px;
    top: -8px;
  }

  .divider-grip {
    padding: 5px 12px;
    gap: 4px;
  }

  .grip-dot {
    width: 4px;
    height: 4px;
  }

  .collapse-toggle {
    width: 28px;
    height: 28px;
    left: calc(50% + 34px);
  }

  .collapse-toggle:hover {
    transform: translateY(-50%);
  }

  .collapse-toggle:active {
    transform: translateY(-50%) scale(0.9);
  }
}

@media (hover: hover) and (pointer: coarse) {
  .divider-drag-area {
    height: 24px;
    top: -6px;
  }

  .divider-grip {
    padding: 5px 11px;
    gap: 3.5px;
  }

  .grip-dot {
    width: 3.5px;
    height: 3.5px;
  }

  .collapse-toggle {
    width: 24px;
    height: 24px;
    left: calc(50% + 32px);
  }
}

@media (max-width: 1024px) {
  .resize-divider {
    display: none;
  }
}
</style>
