<template>
  <div
    class="resizable-divider"
    :class="{ 'is-dragging': isDragging }"
    @mousedown="handleMouseDown"
    @touchstart="handleTouchStart"
  ></div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'

const emit = defineEmits(['resize'])

const isDragging = ref(false)
const startY = ref(0)
const lastY = ref(0)

const handleMouseDown = (e) => {
  isDragging.value = true
  startY.value = e.clientY
  lastY.value = e.clientY

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ns-resize'
}

const handleMouseMove = (e) => {
  if (!isDragging.value) return

  const deltaY = e.clientY - lastY.value
  lastY.value = e.clientY

  emit('resize', deltaY)
}

const handleMouseUp = () => {
  isDragging.value = false

  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

const handleTouchStart = (e) => {
  const touch = e.touches[0]
  isDragging.value = true
  startY.value = touch.clientY
  lastY.value = touch.clientY

  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd)
}

const handleTouchMove = (e) => {
  if (!isDragging.value) return

  e.preventDefault()
  const touch = e.touches[0]
  const deltaY = touch.clientY - lastY.value
  lastY.value = touch.clientY

  emit('resize', deltaY)
}

const handleTouchEnd = () => {
  isDragging.value = false

  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
})
</script>

<style scoped>
.resizable-divider {
  height: 2px;
  background: #e0e0e0;
  cursor: ns-resize;
  transition: all 0.2s ease;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.resizable-divider:hover,
.resizable-divider.is-dragging {
  height: 6px;
  background: #23587b;
  box-shadow: 0 0 8px rgba(35, 88, 123, 0.3);
}
</style>
