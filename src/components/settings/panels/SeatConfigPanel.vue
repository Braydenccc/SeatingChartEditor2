<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">座位表配置</h3>
      <p class="section-desc">调整座位表的基本布局参数</p>

      <div class="config-grid">
        <div class="config-item">
          <label class="config-label">大组数量</label>
          <input
            v-model.number="localConfig.groupCount"
            type="number"
            class="config-input"
            min="1"
            max="8"
            @change="handleGroupCountChange"
          />
        </div>

        <div class="config-item">
          <label class="config-label">每组列数</label>
          <input
            v-model.number="localConfig.columnsPerGroup"
            type="number"
            class="config-input"
            min="1"
            max="5"
          />
        </div>

        <div class="config-item">
          <label class="config-label">每列座位数</label>
          <input
            v-model.number="localConfig.seatsPerColumn"
            type="number"
            class="config-input"
            min="1"
            max="12"
          />
        </div>

        <div class="config-item">
          <label class="config-label">错位距离</label>
          <input
            v-model.number="localConfig.shiftDistance"
            type="number"
            class="config-input"
            min="0"
            max="10"
          />
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">讲台位置</label>
        <div class="button-group">
          <button
            :class="['option-btn', { active: localConfig.podiumPosition === 'bottom' }]"
            @click="localConfig.podiumPosition = 'bottom'"
          >
            底部（默认）
          </button>
          <button
            :class="['option-btn', { active: localConfig.podiumPosition === 'top' }]"
            @click="localConfig.podiumPosition = 'top'"
          >
            顶部
          </button>
        </div>
      </div>

      <div class="warning-box">
        <AlertCircle :size="16" />
        <span>修改配置后需要点击底部"保存"按钮才会生效</span>
      </div>

      <div class="section-divider"></div>

      <h3 class="section-title">高级配置</h3>
      <p class="section-desc">为每个大组单独设置列数和行数</p>

      <button class="action-button" @click="openAdvancedConfig">
        <Settings :size="18" />
        <div class="button-content">
          <span class="button-title">打开高级配置</span>
          <span class="button-desc">在侧边栏中进行详细配置</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { AlertCircle, Settings } from 'lucide-vue-next'
import { useSeatChart } from '@/composables/useSeatChart'
import { useSidebar } from '@/composables/useSidebar'

const emit = defineEmits(['update:visible'])

const { seatConfig, regenerateSeats } = useSeatChart()
const { setActiveTab } = useSidebar()

const localConfig = computed(() => seatConfig.value)

// 监听配置变化，自动初始化 groups 数组
watch(() => localConfig.value.groupCount, (newCount) => {
  if (!localConfig.value.groups) {
    localConfig.value.groups = []
  }

  while (localConfig.value.groups.length < newCount) {
    localConfig.value.groups.push({
      columns: localConfig.value.columnsPerGroup || 2,
      rows: localConfig.value.seatsPerColumn || 7
    })
  }

  while (localConfig.value.groups.length > newCount) {
    localConfig.value.groups.pop()
  }
}, { immediate: true })

const handleGroupCountChange = () => {
  const config = localConfig.value
  if (!config.groups) config.groups = []

  while (config.groups.length < config.groupCount) {
    config.groups.push({
      columns: config.columnsPerGroup || 2,
      rows: config.seatsPerColumn || 7
    })
  }

  while (config.groups.length > config.groupCount) {
    config.groups.pop()
  }
}

const openAdvancedConfig = () => {
  setActiveTab(2) // 切换到侧边栏的"编辑"标签
  emit('update:visible', false) // 关闭设置对话框
}
</script>

<style scoped>
.settings-panel {
  padding: 0;
}

.setting-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 20px 0;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.config-input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.config-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.setting-item {
  margin-bottom: 20px;
}

.setting-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.button-group {
  display: flex;
  gap: 8px;
}

.option-btn {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.option-btn:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-secondary);
}

.option-btn.active {
  border-color: var(--color-primary);
  background: var(--color-info-bg);
  color: var(--color-primary);
  font-weight: 500;
}

.warning-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  border-radius: 6px;
  color: var(--color-warning);
  font-size: 13px;
  margin-top: 20px;
}

.section-divider {
  height: 1px;
  background: var(--color-border);
  margin: 32px 0;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  color: var(--color-primary);
  width: 100%;
}

.action-button:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-secondary);
  transform: translateX(4px);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.button-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.button-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.button-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
