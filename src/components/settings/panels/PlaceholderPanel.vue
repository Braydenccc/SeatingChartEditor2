<template>
  <div class="placeholder-panel">
    <div class="placeholder-icon">⚙️</div>
    <div class="placeholder-title">{{ title }}</div>
    <div class="placeholder-text">此面板将在后续阶段实现</div>
  </div>
</template>

<script setup>
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
  min-height: 300px;
  gap: 16px;
}

.placeholder-icon {
  font-size: 48px;
  opacity: 0.5;
}

.placeholder-title {
  font-size: 18px;
  font-weight: 600;
  color: #334155;
}

.placeholder-text {
  font-size: 14px;
  color: #64748b;
  opacity: 0.7;
}
</style>
