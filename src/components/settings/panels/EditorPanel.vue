<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">编辑器行为</h3>
      <p class="section-desc">配置编辑器的默认行为</p>

      <div class="setting-item">
        <label class="setting-label">自动保存间隔（秒）</label>
        <input
          v-model.number="autoSaveSeconds"
          type="number"
          class="setting-input"
          min="10"
          max="600"
          step="10"
          @input="validateAutoSave"
        />
        <span v-if="autoSaveSeconds < 10" class="hint-text error">最小值为 10 秒</span>
      </div>

      <div class="setting-item">
        <label class="setting-label">撤销历史大小</label>
        <input
          v-model.number="localSettings.undoHistorySize"
          type="number"
          class="setting-input"
          min="10"
          max="100"
          step="5"
        />
      </div>

      <div class="setting-item">
        <label class="setting-label">拖拽灵敏度</label>
        <input
          v-model.number="localSettings.dragSensitivity"
          type="range"
          class="setting-range"
          min="0.5"
          max="2"
          step="0.1"
        />
        <span class="range-value">{{ localSettings.dragSensitivity.toFixed(1) }}x</span>
      </div>

      <div class="setting-item">
        <label class="setting-label">双击座位行为</label>
        <select v-model="localSettings.doubleClickAction" class="setting-select">
          <option value="edit">编辑学生信息</option>
          <option value="assign">快速分配</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:settings'])

const localSettings = computed({
  get: () => props.settings,
  set: (value) => emit('update:settings', value)
})

const autoSaveSeconds = computed({
  get: () => Math.round(localSettings.value.autoSaveInterval / 1000),
  set: (value) => {
    localSettings.value.autoSaveInterval = value * 1000
  }
})

const validateAutoSave = () => {
  if (autoSaveSeconds.value < 10) {
    autoSaveSeconds.value = 10
  } else if (autoSaveSeconds.value > 600) {
    autoSaveSeconds.value = 600
  }
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
  color: #1e293b;
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 20px 0;
}

.setting-item {
  margin-bottom: 20px;
}

.setting-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #334155;
  margin-bottom: 8px;
}

.setting-input,
.setting-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.setting-input:focus,
.setting-select:focus {
  outline: none;
  border-color: #23587b;
}

.setting-range {
  width: calc(100% - 60px);
  margin-right: 12px;
}

.range-value {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

.hint-text {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.hint-text.error {
  color: #ef4444;
}
</style>
