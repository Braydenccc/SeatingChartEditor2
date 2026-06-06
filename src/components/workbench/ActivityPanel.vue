<template>
  <section class="activity-panel">
    <header class="panel-header">
      <div>
        <h2>状态</h2>
        <p>{{ logs.length > 0 ? '最近操作与提示' : '暂无操作记录' }}</p>
      </div>
      <button v-if="logs.length > 0" class="text-action" @click="clearLogs">清空</button>
    </header>

    <div class="activity-list">
      <div v-for="log in logs" :key="log.id" class="activity-item" :class="`type-${log.type}`">
        <span class="activity-time">{{ formatLogTime(log.timestamp) }}</span>
        <span class="activity-message">{{ log.message }}</span>
      </div>
      <div v-if="logs.length === 0" class="activity-empty">所有状态正常</div>
    </div>
  </section>
</template>

<script setup>
import { useLogger } from '@/composables/useLogger'

const { logs, clearLogs } = useLogger()

const formatLogTime = (timestamp) => {
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}
</script>

<style scoped>
.activity-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.panel-header h2 {
  margin: 0;
  font-size: 15px;
  color: var(--color-text-primary);
}

.panel-header p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.text-action {
  border: none;
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
}

.activity-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
}

.activity-item {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 8px;
  padding: 8px;
  border-left: 3px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 8px;
}

.activity-item.type-success {
  border-left-color: var(--color-success);
}

.activity-item.type-warning {
  border-left-color: var(--color-warning);
}

.activity-item.type-error {
  border-left-color: var(--color-danger);
}

.activity-time {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.activity-message {
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
}

.activity-empty {
  padding: 28px 12px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}
</style>
