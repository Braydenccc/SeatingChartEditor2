<template>
  <div class="placeholder-panel">
    <div class="placeholder-icon">
      <Settings :size="48" stroke-width="1.5" />
    </div>
    <h3 class="placeholder-title">{{ title }}</h3>
    <p class="placeholder-text">此面板将在后续阶段实现</p>
  </div>
</template>

<script setup>
import { Settings } from 'lucide-vue-next'

defineProps({
  title: {
    type: String,
    default: '设置面板'
  }
})
</script>

<style scoped>
.placeholder-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  color: var(--color-text-secondary);
}

.placeholder-icon {
  margin-bottom: 16px;
  opacity: 0.5;
  color: var(--color-text-secondary);
}

.placeholder-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--color-text-primary);
}

.placeholder-text {
  font-size: 14px;
  margin: 0;
  opacity: 0.7;
}
</style>
