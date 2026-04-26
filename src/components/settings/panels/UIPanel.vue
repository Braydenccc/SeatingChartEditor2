<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">界面偏好</h3>
      <p class="section-desc">自定义界面外观和行为</p>

      <div class="setting-item">
        <label class="setting-label">语言</label>
        <select v-model="localSettings.language" class="setting-select" disabled>
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English（即将推出）</option>
        </select>
        <span class="hint-text">多语言功能即将推出</span>
      </div>

      <div class="setting-item">
        <label class="setting-label">主题色</label>
        <div class="color-picker-wrapper">
          <input
            v-model="localSettings.themeColor"
            type="color"
            class="color-picker"
          />
          <input
            v-model="localSettings.themeColor"
            type="text"
            class="setting-input color-input"
            placeholder="#23587b"
          />
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">默认缩放比例（%）</label>
        <input
          v-model.number="localSettings.defaultZoom"
          type="number"
          class="setting-input"
          min="50"
          max="200"
          step="10"
        />
        <span class="hint-text">打开工作区时的初始缩放比例（50-200%）</span>
      </div>

      <div class="setting-item">
        <label class="setting-label">
          <input
            v-model="localSettings.enableAnimations"
            type="checkbox"
            class="setting-checkbox"
          />
          <span>启用动画效果</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useZoom } from '@/composables/useZoom'

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:settings'])

const { setScale } = useZoom()

const localSettings = computed({
  get: () => props.settings,
  set: (value) => emit('update:settings', value)
})

// 实时预览主题色（不保存）
watch(() => localSettings.value.themeColor, (newColor) => {
  if (newColor) {
    document.documentElement.style.setProperty('--color-primary', newColor)
  }
}, { immediate: true })
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

.setting-checkbox {
  margin-right: 8px;
  cursor: pointer;
}

.setting-label:has(.setting-checkbox) {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.color-picker-wrapper {
  display: flex;
  gap: 12px;
  align-items: center;
}

.color-picker {
  width: 60px;
  height: 40px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
}

.color-input {
  flex: 1;
}

.hint-text {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
  font-style: italic;
}

.setting-select:disabled {
  background-color: #f1f5f9;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
