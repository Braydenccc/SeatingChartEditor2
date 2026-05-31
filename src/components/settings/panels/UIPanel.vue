<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">界面偏好</h3>
      <p class="section-desc">自定义界面外观和行为</p>

      <div class="setting-item">
        <div class="setting-row">
          <label class="setting-label">语言</label>
          <button
            class="reset-btn"
            :disabled="true"
            title="多语言功能即将推出"
          >
            <RotateCcw :size="16" />
          </button>
        </div>
        <select v-model="localSettings.language" class="setting-select" disabled>
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English（即将推出）</option>
        </select>
        <span class="hint-text">多语言功能即将推出</span>
      </div>

      <div class="setting-item">
        <div class="setting-row">
          <label class="setting-label">颜色模式</label>
          <button
            class="reset-btn"
            @click="resetColorMode"
            :disabled="isDefaultColorMode"
            title="恢复默认颜色模式"
          >
            <RotateCcw :size="16" />
          </button>
        </div>
        <div class="mode-tabs">
          <button
            class="mode-tab"
            :class="{ active: localSettings.colorMode === 'simple' }"
            @click="localSettings.colorMode = 'simple'"
          >
            简单模式
          </button>
          <button
            class="mode-tab"
            :class="{ active: localSettings.colorMode === 'custom' }"
            @click="localSettings.colorMode = 'custom'"
          >
            定制模式
          </button>
        </div>
      </div>

      <!-- 简单模式 -->
      <template v-if="localSettings.colorMode === 'simple'">
        <div class="setting-item">
          <div class="setting-row">
            <label class="setting-label">配色方案</label>
            <button
              class="reset-btn"
              @click="resetColorScheme"
              :disabled="isDefaultColorScheme"
              title="恢复默认配色方案"
            >
              <RotateCcw :size="16" />
            </button>
          </div>
          <div class="scheme-options">
            <label class="scheme-option">
              <input
                type="radio"
                v-model="localSettings.colorScheme"
                value="light"
                class="scheme-radio"
              />
              <div class="scheme-card">
                <Sun :size="20" />
                <span>浅色</span>
              </div>
            </label>
            <label class="scheme-option">
              <input
                type="radio"
                v-model="localSettings.colorScheme"
                value="dark"
                class="scheme-radio"
              />
              <div class="scheme-card">
                <Moon :size="20" />
                <span>深色</span>
              </div>
            </label>
            <label class="scheme-option">
              <input
                type="radio"
                v-model="localSettings.colorScheme"
                value="auto"
                class="scheme-radio"
              />
              <div class="scheme-card">
                <Monitor :size="20" />
                <span>跟随浏览器</span>
              </div>
            </label>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-row">
            <label class="setting-label">主题色</label>
            <button
              class="reset-btn"
              @click="resetThemeColor"
              :disabled="isDefaultThemeColor"
              title="恢复默认主题色"
            >
              <RotateCcw :size="16" />
            </button>
          </div>
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
      </template>

      <!-- 定制模式 -->
      <template v-else>
        <div class="custom-colors-section">
          <div class="color-category">
            <h4 class="category-title">主色调</h4>
            <div class="color-grid">
              <div class="color-item">
                <label class="color-label">主色</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.primary"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.primary"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
                <div v-if="contrastChecks.primary" class="contrast-hint">
                  <span
                    class="contrast-badge"
                    :style="{ backgroundColor: contrastChecks.primary.rating.color }"
                  >
                    {{ contrastChecks.primary.rating.label }}
                  </span>
                  <span class="contrast-ratio">对比度 {{ contrastChecks.primary.ratio }}</span>
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">主色（浅）</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.primaryLight"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.primaryLight"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">主色（深）</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.primaryDark"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.primaryDark"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">主色（悬停）</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.primaryHover"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.primaryHover"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="color-category">
            <h4 class="category-title">背景色</h4>
            <div class="color-grid">
              <div class="color-item">
                <label class="color-label">主背景</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.surface"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.surface"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">选中背景</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.bgSelected"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.bgSelected"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">卡片背景</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.bgCard"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.bgCard"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">微妙背景</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.bgSubtle"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.bgSubtle"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">柔和背景</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.bgSoft"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.bgSoft"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">悬停背景</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.bgHover"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.bgHover"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="color-category">
            <h4 class="category-title">文字颜色</h4>
            <div class="color-grid">
              <div class="color-item">
                <label class="color-label">主文字</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.textPrimary"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.textPrimary"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
                <div v-if="contrastChecks.textPrimary" class="contrast-hint">
                  <span
                    class="contrast-badge"
                    :style="{ backgroundColor: contrastChecks.textPrimary.rating.color }"
                  >
                    {{ contrastChecks.textPrimary.rating.label }}
                  </span>
                  <span class="contrast-ratio">对比度 {{ contrastChecks.textPrimary.ratio }}</span>
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">次要文字</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.textSecondary"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.textSecondary"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
                <div v-if="contrastChecks.textSecondary" class="contrast-hint">
                  <span
                    class="contrast-badge"
                    :style="{ backgroundColor: contrastChecks.textSecondary.rating.color }"
                  >
                    {{ contrastChecks.textSecondary.rating.label }}
                  </span>
                  <span class="contrast-ratio">对比度 {{ contrastChecks.textSecondary.ratio }}</span>
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">弱化文字</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.textMuted"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.textMuted"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">禁用文字</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.textDisabled"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.textDisabled"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="color-category">
            <h4 class="category-title">边框颜色</h4>
            <div class="color-grid">
              <div class="color-item">
                <label class="color-label">边框</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.border"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.border"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">强边框</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.borderStrong"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.borderStrong"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">边框（悬停）</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.borderHover"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.borderHover"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="color-category">
            <h4 class="category-title">状态颜色</h4>
            <div class="color-grid">
              <div class="color-item">
                <label class="color-label">危险</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.danger"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.danger"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">危险（悬停）</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.dangerHover"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.dangerHover"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">成功</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.success"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.success"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">成功（悬停）</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.successHover"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.successHover"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">警告</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.warning"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.warning"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">警告（悬停）</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.warningHover"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.warningHover"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">信息</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.info"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.info"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>

              <div class="color-item">
                <label class="color-label">信息（悬停）</label>
                <div class="color-input-group">
                  <input
                    v-model="localSettings.customColors.infoHover"
                    type="color"
                    class="color-picker-small"
                  />
                  <input
                    v-model="localSettings.customColors.infoHover"
                    type="text"
                    class="setting-input color-input-small"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="reset-custom-colors">
            <button class="reset-all-btn" @click="resetAllCustomColors">
              <RotateCcw :size="16" />
              重置所有颜色
            </button>
          </div>
        </div>
      </template>

      <div class="setting-item">
        <div class="setting-row">
          <label class="setting-label">默认缩放比例（%）</label>
          <button
            class="reset-btn"
            @click="resetDefaultZoom"
            :disabled="isDefaultZoom"
            title="恢复默认缩放比例"
          >
            <RotateCcw :size="16" />
          </button>
        </div>
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
        <div class="setting-row">
          <label class="setting-label">
            <input
              v-model="localSettings.enableAnimations"
              type="checkbox"
              class="setting-checkbox"
            />
            <span>启用动画效果</span>
          </label>
          <button
            class="reset-btn"
            @click="resetEnableAnimations"
            :disabled="isDefaultAnimations"
            title="恢复默认动画设置"
          >
            <RotateCcw :size="16" />
          </button>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-row">
          <label class="setting-label">标签显示模式</label>
        </div>
        <div class="tag-mode-options">
          <label class="tag-mode-option" :class="{ active: localTagDisplayMode === 'dot' }">
            <input type="radio" v-model="localTagDisplayMode" value="dot" />
            <span class="mode-icon dot-icon"></span>
            <span class="mode-text">颜色点</span>
          </label>
          <label class="tag-mode-option" :class="{ active: localTagDisplayMode === 'corner' }">
            <input type="radio" v-model="localTagDisplayMode" value="corner" />
            <span class="mode-icon corner-icon"></span>
            <span class="mode-text">右上角文字</span>
          </label>
          <label class="tag-mode-option" :class="{ active: localTagDisplayMode === 'bottom' }">
            <input type="radio" v-model="localTagDisplayMode" value="bottom" />
            <span class="mode-icon bottom-icon"></span>
            <span class="mode-text">座位下部文字</span>
          </label>
        </div>
        <span class="hint-text">控制标签在座位表中的显示方式</span>
      </div>

      <div class="setting-item">
        <div class="setting-row">
          <label class="setting-label">座位表元素显示</label>
        </div>
        <div class="element-toggles">
          <div class="element-toggle-group">
            <label class="toggle-item">
              <input
                v-model="localSettings.showStudentName"
                type="checkbox"
                class="setting-checkbox"
              />
              <span>姓名</span>
            </label>
            <label class="toggle-item sub-toggle" :class="{ disabled: !canEnableLargeName }">
              <input
                v-model="localSettings.largeNameMode"
                type="checkbox"
                class="setting-checkbox"
                :disabled="!canEnableLargeName"
              />
              <span>大字号</span>
            </label>
          </div>
          <div class="element-toggle-group">
            <label class="toggle-item">
              <input
                v-model="localSettings.showStudentNumber"
                type="checkbox"
                class="setting-checkbox"
              />
              <span>学号</span>
            </label>
            <label class="toggle-item sub-toggle" :class="{ disabled: !canEnableLargeNumber }">
              <input
                v-model="localSettings.largeNumberMode"
                type="checkbox"
                class="setting-checkbox"
                :disabled="!canEnableLargeNumber"
              />
              <span>大字号</span>
            </label>
          </div>
          <div class="element-toggle-group">
            <label class="toggle-item">
              <input
                v-model="localShowTags"
                type="checkbox"
                class="setting-checkbox"
              />
              <span>标签</span>
            </label>
          </div>
          <div class="element-toggle-group">
            <label class="toggle-item">
              <input
                v-model="localSettings.showEditorRowNumbers"
                type="checkbox"
                class="setting-checkbox"
              />
              <span>行号</span>
            </label>
          </div>
        </div>
        <span class="hint-text">行号会根据座位表配置中的讲台位置自动调整前后方向</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { RotateCcw, Sun, Moon, Monitor } from 'lucide-vue-next'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useTagData } from '@/composables/useTagData'
import { checkColorCombination } from '@/utils/colorContrast'

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:settings'])

const { defaultSettings, applyThemeColor, applyColorScheme } = useGlobalSettings()
const { tagDisplayMode, setTagDisplayMode, showTagsInSeatChart, setShowTagsInSeatChart } = useTagData()

const localSettings = computed({
  get: () => props.settings || {},
  set: (value) => emit('update:settings', value)
})

const localTagDisplayMode = computed({
  get: () => tagDisplayMode.value,
  set: (val) => setTagDisplayMode(val)
})
const localShowTags = computed({
  get: () => showTagsInSeatChart.value,
  set: (val) => setShowTagsInSeatChart(val)
})

const hasHiddenElement = computed(() => {
  return !localSettings.value.showStudentName || !localSettings.value.showStudentNumber || !localShowTags.value
})

const canEnableLargeName = computed(() => {
  return hasHiddenElement.value && localSettings.value.showStudentName
})

const canEnableLargeNumber = computed(() => {
  return hasHiddenElement.value && localSettings.value.showStudentNumber
})

watch(canEnableLargeName, (val) => {
  if (!val) localSettings.value.largeNameMode = false
})

watch(canEnableLargeNumber, (val) => {
  if (!val) localSettings.value.largeNumberMode = false
})

// 判断是否为默认值
const isDefaultColorMode = computed(() =>
  localSettings.value.colorMode === defaultSettings.ui.colorMode
)

const isDefaultColorScheme = computed(() =>
  localSettings.value.colorScheme === defaultSettings.ui.colorScheme
)

const isDefaultThemeColor = computed(() =>
  localSettings.value.themeColor === defaultSettings.ui.themeColor
)

const isDefaultZoom = computed(() =>
  localSettings.value.defaultZoom === defaultSettings.ui.defaultZoom
)

const isDefaultAnimations = computed(() =>
  localSettings.value.enableAnimations === defaultSettings.ui.enableAnimations
)

// 对比度检查
const contrastChecks = computed(() => {
  if (localSettings.value.colorMode !== 'custom') return {}

  const { customColors } = localSettings.value
  return {
    primary: checkColorCombination(customColors.primary, customColors.surface),
    textPrimary: checkColorCombination(customColors.textPrimary, customColors.surface),
    textSecondary: checkColorCombination(customColors.textSecondary, customColors.surface)
  }
})

// 重置单个设置项
const resetColorMode = () => {
  localSettings.value.colorMode = defaultSettings.ui.colorMode
}

const resetColorScheme = () => {
  localSettings.value.colorScheme = defaultSettings.ui.colorScheme
}

const resetThemeColor = () => {
  localSettings.value.themeColor = defaultSettings.ui.themeColor
}

const resetDefaultZoom = () => {
  localSettings.value.defaultZoom = defaultSettings.ui.defaultZoom
}

const resetEnableAnimations = () => {
  localSettings.value.enableAnimations = defaultSettings.ui.enableAnimations
}

const resetAllCustomColors = () => {
  localSettings.value.customColors = JSON.parse(JSON.stringify(defaultSettings.ui.customColors))
}

// 实时预览颜色（不保存）
watch(() => localSettings.value.colorMode, () => {
  applyColorScheme()
  applyThemeColor()
}, { immediate: true })

watch(() => localSettings.value.colorScheme, () => {
  applyColorScheme()
}, { immediate: true })

watch(() => localSettings.value.themeColor, () => {
  if (localSettings.value.colorMode === 'simple') {
    applyThemeColor()
  }
}, { immediate: true })

watch(() => localSettings.value.customColors, () => {
  if (localSettings.value.colorMode === 'custom') {
    applyThemeColor()
  }
}, { deep: true, immediate: true })
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
  background: var(--color-input-bg);
  color: var(--color-text-primary);
}

.setting-input:focus,
.setting-select:focus {
  outline: none;
  border-color: var(--color-primary);
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
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
}

.color-input {
  flex: 1;
}

.hint-text {
  display: block;
  font-size: 12px;
  color: var(--color-text-disabled);
  margin-top: 4px;
  font-style: italic;
}

.setting-select:disabled {
  background-color: var(--color-bg-soft);
  cursor: not-allowed;
  opacity: 0.6;
}

.mode-tabs {
  display: flex;
  gap: 8px;
}

.mode-tab {
  flex: 1;
  padding: 10px 16px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-muted);
  transition: all 0.2s;
}

.mode-tab:hover {
  background: var(--color-bg-soft);
  border-color: var(--color-border-strong);
}

.mode-tab.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.scheme-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.scheme-option {
  cursor: pointer;
}

.scheme-radio {
  display: none;
}

.scheme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: var(--color-bg-subtle);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  transition: all 0.2s;
  color: var(--color-text-muted);
}

.scheme-option:hover .scheme-card {
  background: var(--color-bg-soft);
  border-color: var(--color-border-strong);
}

.scheme-radio:checked + .scheme-card {
  background: var(--color-bg-selected);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.custom-colors-section {
  margin-top: 20px;
}

.color-category {
  margin-bottom: 24px;
}

.category-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0 0 12px 0;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.color-label {
  font-size: 13px;
  color: var(--color-text-muted);
}

.color-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-picker-small {
  width: 40px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
}

.color-input-small {
  flex: 1;
  padding: 6px 10px;
  font-size: 13px;
}

.contrast-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.contrast-badge {
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--color-text-inverse);
  font-weight: 500;
}

.contrast-ratio {
  color: var(--color-text-disabled);
}

.reset-custom-colors {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}

.reset-all-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 14px;
  transition: all 0.2s;
}

.reset-all-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.tag-mode-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag-mode-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tag-mode-option:hover {
  background: var(--color-bg-soft);
  border-color: var(--color-border-strong);
}

.tag-mode-option.active {
  background: var(--color-bg-selected);
  border-color: var(--color-primary);
}

.tag-mode-option input[type="radio"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.mode-icon {
  width: 48px;
  height: 36px;
  border-radius: 4px;
  position: relative;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mode-icon::before {
  content: '张三';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.bottom-icon::before {
  top: 40%;
}

.dot-icon::after {
  content: '';
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 4px;
  display: flex;
  gap: 2px;
  justify-content: center;
  background:
    radial-gradient(circle, var(--color-danger) 1.5px, transparent 1.5px) 0 0,
    radial-gradient(circle, var(--color-primary) 1.5px, transparent 1.5px) 6px 0,
    radial-gradient(circle, var(--color-warning) 1.5px, transparent 1.5px) 12px 0;
  background-size: 4px 4px, 4px 4px, 4px 4px;
  background-repeat: no-repeat;
}

.corner-icon::after {
  content: 'A';
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 9px;
  font-weight: 700;
  color: var(--color-surface);
  background: var(--color-danger);
  padding: 1px 4px;
  border-radius: 2px;
  line-height: 1.2;
}

.bottom-icon::after {
  content: 'A';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 8px;
  font-weight: 700;
  color: var(--color-surface);
  background: var(--color-danger);
  padding: 1px 5px;
  border-radius: 2px;
  line-height: 1.2;
}

.mode-text {
  font-size: 13px;
  color: var(--color-text-primary);
}

.element-toggles {
  display: flex;
  gap: 16px;
}

.element-toggle-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-primary);
}

.toggle-item.sub-toggle {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding-left: 4px;
  border-left: 1px solid var(--color-border);
}

.toggle-item.sub-toggle.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toggle-item .setting-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}
</style>
