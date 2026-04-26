<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">编辑器行为</h3>
      <p class="section-desc">配置编辑器的默认行为</p>

      <div class="setting-item">
        <div class="setting-row">
          <label class="setting-label">自动保存间隔（秒）</label>
          <button
            class="reset-btn"
            @click="resetAutoSaveInterval"
            :disabled="isDefaultAutoSaveInterval"
            title="恢复默认自动保存间隔"
          >
            <RotateCcw :size="16" />
          </button>
        </div>
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
        <div class="setting-row">
          <label class="setting-label">撤销历史大小</label>
          <button
            class="reset-btn"
            @click="resetUndoHistorySize"
            :disabled="isDefaultUndoHistorySize"
            title="恢复默认撤销历史大小"
          >
            <RotateCcw :size="16" />
          </button>
        </div>
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
        <div class="setting-row">
          <label class="setting-label">拖拽灵敏度</label>
          <button
            class="reset-btn"
            @click="resetDragSensitivity"
            :disabled="isDefaultDragSensitivity"
            title="恢复默认拖拽灵敏度"
          >
            <RotateCcw :size="16" />
          </button>
        </div>
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
        <div class="setting-row">
          <label class="setting-label">双击学生行为</label>
          <button
            class="reset-btn"
            @click="resetDoubleClickAction"
            :disabled="isDefaultDoubleClickAction"
            title="恢复默认双击行为"
          >
            <RotateCcw :size="16" />
          </button>
        </div>
        <select v-model="localSettings.doubleClickAction" class="setting-select">
          <option value="edit">编辑该学生信息</option>
          <option value="random">随机移入/移出</option>
        </select>
        <span class="hint-text">对座位表和学生候选区均有效</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import { useGlobalSettings } from '@/composables/useGlobalSettings'

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:settings'])

const { defaultSettings } = useGlobalSettings()

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

// 判断是否为默认值
const isDefaultAutoSaveInterval = computed(() =>
  localSettings.value.autoSaveInterval === defaultSettings.editor.autoSaveInterval
)

const isDefaultUndoHistorySize = computed(() =>
  localSettings.value.undoHistorySize === defaultSettings.editor.undoHistorySize
)

const isDefaultDragSensitivity = computed(() =>
  localSettings.value.dragSensitivity === defaultSettings.editor.dragSensitivity
)

const isDefaultDoubleClickAction = computed(() =>
  localSettings.value.doubleClickAction === defaultSettings.editor.doubleClickAction
)

// 重置单个设置项
const resetAutoSaveInterval = () => {
  localSettings.value.autoSaveInterval = defaultSettings.editor.autoSaveInterval
}

const resetUndoHistorySize = () => {
  localSettings.value.undoHistorySize = defaultSettings.editor.undoHistorySize
}

const resetDragSensitivity = () => {
  localSettings.value.dragSensitivity = defaultSettings.editor.dragSensitivity
}

const resetDoubleClickAction = () => {
  localSettings.value.doubleClickAction = defaultSettings.editor.doubleClickAction
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
  color: var(--color-text-muted);
  margin: 0 0 20px 0;
}

.setting-item {
  margin-bottom: 20px;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.setting-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 0;
}

.reset-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reset-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.reset-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.setting-input,
.setting-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.setting-input:focus,
.setting-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.setting-range {
  width: calc(100% - 60px);
  margin-right: 12px;
}

.range-value {
  font-size: 14px;
  color: var(--color-text-muted);
  font-weight: 500;
}

.hint-text {
  display: block;
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.hint-text.error {
  color: var(--color-danger);
}
</style>
