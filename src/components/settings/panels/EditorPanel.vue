<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">编辑器行为</h3>
      <p class="section-desc">配置编辑器的默认行为</p>

      <div class="setting-item">
        <div class="setting-row">
          <label class="setting-label">撤销历史大小</label>
          <NButton
            class="reset-btn"
            size="small"
            quaternary
            circle
            @click="resetUndoHistorySize"
            :disabled="isDefaultUndoHistorySize"
            title="恢复默认撤销历史大小"
          >
            <RotateCcw :size="16" />
          </NButton>
        </div>
        <NInputNumber
          :value="localSettings.undoHistorySize"
          class="setting-input"
          :min="10"
          :max="100"
          :step="5"
          @update:value="updateUndoHistorySize"
        />
      </div>

      <div class="setting-item">
        <div class="setting-row">
          <label class="setting-label">拖拽灵敏度</label>
          <NButton
            class="reset-btn"
            size="small"
            quaternary
            circle
            @click="resetDragSensitivity"
            :disabled="isDefaultDragSensitivity"
            title="恢复默认拖拽灵敏度"
          >
            <RotateCcw :size="16" />
          </NButton>
        </div>
        <NSlider
          :value="localSettings.dragSensitivity"
          class="setting-range"
          :min="0.5"
          :max="2"
          :step="0.1"
          @update:value="value => updateSetting('editor.dragSensitivity', value)"
        />
        <span class="range-value">{{ localSettings.dragSensitivity.toFixed(1) }}x</span>
      </div>

      <div class="setting-item">
        <div class="setting-row">
          <label class="setting-label">双击学生行为</label>
          <NButton
            class="reset-btn"
            size="small"
            quaternary
            circle
            @click="resetDoubleClickAction"
            :disabled="isDefaultDoubleClickAction"
            title="恢复默认双击行为"
          >
            <RotateCcw :size="16" />
          </NButton>
        </div>
        <NSelect :value="localSettings.doubleClickAction" class="setting-select" :options="doubleClickOptions" @update:value="updateDoubleClickAction" />
        <span class="hint-text">对座位表和学生候选区均有效</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInputNumber, NSelect, NSlider } from 'naive-ui'
import { computed } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { normalizeRequiredNumberInput } from '@/utils/inputNormalization'
import type { EditorSettings } from '@/types/settings'

const props = defineProps<{ settings: EditorSettings }>()

const { defaultSettings, updateSetting, resetSetting } = useGlobalSettings()
const doubleClickOptions = [
  { label: '编辑该学生信息', value: 'edit' },
  { label: '随机移入/移出', value: 'random' }
]

const localSettings = computed(() => props.settings)

// 判断是否为默认值
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
const resetUndoHistorySize = () => {
  resetSetting('editor.undoHistorySize')
}

const resetDragSensitivity = () => {
  resetSetting('editor.dragSensitivity')
}

const resetDoubleClickAction = () => {
  resetSetting('editor.doubleClickAction')
}

const updateUndoHistorySize = (value: number | null) => {
  updateSetting('editor.undoHistorySize', normalizeRequiredNumberInput(
    value,
    localSettings.value.undoHistorySize,
    { min: 10, max: 100, precision: 0 }
  ))
}

const updateDoubleClickAction = (value: string | number | null) => {
  if (value !== 'edit' && value !== 'random') return
  updateSetting('editor.doubleClickAction', value, { immediate: true })
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
  flex: 0 0 auto;
}

.setting-input,
.setting-select {
  width: 100%;
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
