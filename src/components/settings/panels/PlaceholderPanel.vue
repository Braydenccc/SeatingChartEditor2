<template>
  <div class="placeholder-panel">
    <div class="placeholder-icon">⚙️</div>
    <h3 class="placeholder-title">{{ title }}</h3>
    <p class="placeholder-text">此面板将在后续阶段实现</p>
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
  height: 100%;
  min-height: 300px;
  color: #64748b;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.placeholder-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #334155;
}

.placeholder-text {
  font-size: 14px;
  margin: 0;
  opacity: 0.7;
}
</style>
