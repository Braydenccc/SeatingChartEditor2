<template>
  <div class="settings-panel">
    <NForm label-placement="top" size="medium">
      <section class="setting-section">
        <h3 class="section-title">界面偏好</h3>
        <p class="section-desc">自定义界面外观和行为，修改会立即预览并自动保存。</p>

        <NFormItem class="setting-item" label="语言" :show-feedback="false">
          <div class="field-stack">
            <NSelect :value="localSettings.language" :options="languageOptions" disabled />
            <span class="hint-text">多语言功能即将推出</span>
          </div>
        </NFormItem>

        <NFormItem class="setting-item" label="颜色模式" :show-feedback="false">
          <NRadioGroup v-model:value="colorModeModel" class="mode-tabs" size="small">
            <NRadioButton class="mode-tab" value="simple">简单模式</NRadioButton>
            <NRadioButton class="mode-tab" value="custom">定制模式</NRadioButton>
          </NRadioGroup>
        </NFormItem>

        <template v-if="localSettings.colorMode === 'simple'">
          <NFormItem class="setting-item" label="配色方案" :show-feedback="false">
            <NRadioGroup v-model:value="colorSchemeModel" class="scheme-options" size="small">
              <NRadioButton class="scheme-button" value="light">
                <span class="scheme-button-content"><Sun :size="18" /><span>浅色</span></span>
              </NRadioButton>
              <NRadioButton class="scheme-button" value="dark">
                <span class="scheme-button-content"><Moon :size="18" /><span>深色</span></span>
              </NRadioButton>
              <NRadioButton class="scheme-button" value="auto">
                <span class="scheme-button-content">
                  <span class="scheme-icon">
                    <component :is="autoSchemeIcon" :size="18" />
                    <span class="scheme-auto-mark">A</span>
                  </span>
                  <span>跟随浏览器</span>
                </span>
              </NRadioButton>
            </NRadioGroup>
          </NFormItem>
          <NFormItem class="setting-item" label="主题色" :show-feedback="false">
            <div class="color-row">
              <NColorPicker class="theme-color-picker" v-model:value="themeColorModel" :show-alpha="false" :modes="['hex']" />
              <NButton secondary :disabled="localSettings.themeColor === defaultSettings.ui.themeColor" @click="resetUiSetting('themeColor')">
                <template #icon><RotateCcw :size="15" /></template>恢复默认
              </NButton>
            </div>
          </NFormItem>
        </template>

        <template v-else>
          <NFormItem class="setting-item" label="定制主题基底" :show-feedback="false">
            <NRadioGroup v-model:value="customBaseSchemeModel" size="small">
              <NRadioButton value="light">浅色组件基底</NRadioButton>
              <NRadioButton value="dark">深色组件基底</NRadioButton>
            </NRadioGroup>
          </NFormItem>

          <div v-for="group in customColorGroups" :key="group.title" class="color-category">
            <h4 class="category-title">{{ group.title }}</h4>
            <NGrid cols="1 520:2" :x-gap="14" :y-gap="12">
              <NGridItem v-for="field in group.fields" :key="field.key">
                <NFormItem :label="field.label" :show-feedback="false">
                  <NColorPicker :value="localSettings.customColors[field.key]" :show-alpha="false" :modes="['hex']" @update:value="value => updateCustomColor(field.key, value)" />
                </NFormItem>
              </NGridItem>
            </NGrid>
          </div>

          <NAlert v-if="hasContrastWarning" class="contrast-alert" type="warning" :show-icon="true">
            当前部分文字或主色与背景的对比度未达到 WCAG AA，建议继续调整。
          </NAlert>
          <NButton secondary @click="resetCustomColors"><template #icon><RotateCcw :size="15" /></template>重置全部定制颜色</NButton>
        </template>
      </section>

      <section class="setting-section">
        <h3 class="section-title">显示与交互</h3>
        <p class="section-desc">调整默认缩放、动画和座位卡信息密度。</p>

        <NFormItem class="setting-item" label="默认缩放比例（%）" :show-feedback="false">
          <div class="field-stack">
            <div class="slider-row">
              <NSlider v-model:value="defaultZoomModel" :min="50" :max="200" :step="10" />
              <NInputNumber class="zoom-number-input" :value="localSettings.defaultZoom" :min="50" :max="200" :step="10" @update:value="updateDefaultZoom" />
            </div>
            <span class="hint-text">打开工作区时的初始缩放比例（50-200%）</span>
          </div>
        </NFormItem>

        <NFormItem class="setting-item" label="启用动画效果" :show-feedback="false">
          <NSwitch v-model:value="enableAnimationsModel" />
        </NFormItem>

        <NFormItem class="setting-item" label="标签显示模式" :show-feedback="false">
          <div class="field-stack">
            <NRadioGroup v-model:value="localTagDisplayMode" class="tag-mode-options">
              <NRadio class="tag-mode-option" :class="{ active: localTagDisplayMode === 'dot' }" value="dot">
                <span class="mode-icon dot-icon"></span><span class="mode-text">颜色点</span>
              </NRadio>
              <NRadio class="tag-mode-option" :class="{ active: localTagDisplayMode === 'corner' }" value="corner">
                <span class="mode-icon corner-icon"></span><span class="mode-text">右上角文字</span>
              </NRadio>
              <NRadio class="tag-mode-option" :class="{ active: localTagDisplayMode === 'bottom' }" value="bottom">
                <span class="mode-icon bottom-icon"></span><span class="mode-text">座位下部文字</span>
              </NRadio>
            </NRadioGroup>
            <span class="hint-text">控制标签在座位表中的显示方式</span>
          </div>
        </NFormItem>

        <NFormItem class="setting-item" label="座位表元素显示" :show-feedback="false">
          <div class="field-stack">
            <div class="element-toggles">
              <div class="element-toggle-group">
                <div class="toggle-item"><span class="toggle-label">姓名</span><NSwitch v-model:value="showStudentNameModel" aria-label="显示姓名" /></div>
                <div class="toggle-item sub-toggle" :class="{ disabled: !canEnableLargeName }"><span class="toggle-label">姓名大字号</span><NSwitch v-model:value="largeNameModeModel" :disabled="!canEnableLargeName" aria-label="姓名大字号" /></div>
              </div>
              <div class="element-toggle-group">
                <div class="toggle-item"><span class="toggle-label">学号</span><NSwitch v-model:value="showStudentNumberModel" aria-label="显示学号" /></div>
                <div class="toggle-item sub-toggle" :class="{ disabled: !canEnableLargeNumber }"><span class="toggle-label">学号大字号</span><NSwitch v-model:value="largeNumberModeModel" :disabled="!canEnableLargeNumber" aria-label="学号大字号" /></div>
              </div>
              <div class="toggle-item single-toggle"><span class="toggle-label">标签</span><NSwitch v-model:value="localShowTags" aria-label="显示标签" /></div>
              <div class="toggle-item single-toggle"><span class="toggle-label">数值</span><NSwitch v-model:value="localShowNumericAttributes" aria-label="显示数值属性" /></div>
              <div class="toggle-item single-toggle"><span class="toggle-label">行号</span><NSwitch v-model:value="showEditorRowNumbersModel" aria-label="显示行号" /></div>
            </div>
            <span class="hint-text">行号会根据座位表配置中的讲台位置自动调整前后方向</span>
          </div>
        </NFormItem>
      </section>
    </NForm>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NColorPicker,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInputNumber,
  NRadio,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  NSwitch
} from 'naive-ui'
import { Moon, RotateCcw, Sun } from 'lucide-vue-next'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useTagData } from '@/composables/useTagData'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { checkColorCombination } from '@/utils/colorContrast'
import { normalizeRequiredNumberInput } from '@/utils/inputNormalization'
import type { CustomThemeColors, UiSettings } from '@/types/settings'

const props = defineProps<{ settings: UiSettings }>()
const {
  defaultSettings,
  updateSetting,
  resetSetting,
  flushPendingSave
} = useGlobalSettings()
const { tagDisplayMode, setTagDisplayMode, showTagsInSeatChart, setShowTagsInSeatChart } = useTagData()
const { showNumericAttributesInEditor, setShowNumericAttributesInEditor } = useStudentAttributes()

const localSettings = computed(() => props.settings)
const languageOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English（即将推出）', value: 'en-US' }
]
const colorModeModel = computed({
  get: () => localSettings.value.colorMode,
  set: value => updateSetting('ui.colorMode', value, { immediate: true })
})
const colorSchemeModel = computed({
  get: () => localSettings.value.colorScheme,
  set: value => updateSetting('ui.colorScheme', value, { immediate: true })
})
const customBaseSchemeModel = computed({
  get: () => localSettings.value.customBaseScheme,
  set: value => updateSetting('ui.customBaseScheme', value, { immediate: true })
})
const themeColorModel = computed({
  get: () => localSettings.value.themeColor,
  set: value => { if (value) updateSetting('ui.themeColor', value) }
})
const defaultZoomModel = computed({
  get: () => localSettings.value.defaultZoom,
  set: value => updateSetting('ui.defaultZoom', value)
})
const enableAnimationsModel = computed({
  get: () => localSettings.value.enableAnimations,
  set: value => updateSetting('ui.enableAnimations', value, { immediate: true })
})
const showStudentNameModel = computed({
  get: () => localSettings.value.showStudentName,
  set: value => updateSetting('ui.showStudentName', value, { immediate: true })
})
const showStudentNumberModel = computed({
  get: () => localSettings.value.showStudentNumber,
  set: value => updateSetting('ui.showStudentNumber', value, { immediate: true })
})
const showEditorRowNumbersModel = computed({
  get: () => localSettings.value.showEditorRowNumbers,
  set: value => updateSetting('ui.showEditorRowNumbers', value, { immediate: true })
})
const largeNameModeModel = computed({
  get: () => localSettings.value.largeNameMode,
  set: value => updateSetting('ui.largeNameMode', value, { immediate: true })
})
const largeNumberModeModel = computed({
  get: () => localSettings.value.largeNumberMode,
  set: value => updateSetting('ui.largeNumberMode', value, { immediate: true })
})
const localTagDisplayMode = computed({ get: () => tagDisplayMode.value, set: setTagDisplayMode })
const localShowTags = computed({ get: () => showTagsInSeatChart.value, set: setShowTagsInSeatChart })
const localShowNumericAttributes = computed({ get: () => showNumericAttributesInEditor.value, set: setShowNumericAttributesInEditor })

type CustomColorKey = keyof CustomThemeColors
interface ColorField { key: CustomColorKey; label: string }
const customColorGroups: Array<{ title: string; fields: ColorField[] }> = [
  { title: '主色', fields: [
    { key: 'primary', label: '主色' }, { key: 'primaryLight', label: '浅主色' },
    { key: 'primaryDark', label: '深主色' }, { key: 'primaryHover', label: '悬停主色' }
  ] },
  { title: '背景', fields: [
    { key: 'surface', label: '主背景' }, { key: 'bgCard', label: '卡片背景' },
    { key: 'bgSubtle', label: '次级背景' }, { key: 'bgSoft', label: '柔和背景' },
    { key: 'bgSelected', label: '选中背景' }, { key: 'bgHover', label: '悬停背景' }
  ] },
  { title: '文字与边框', fields: [
    { key: 'textPrimary', label: '主要文字' }, { key: 'textSecondary', label: '次要文字' },
    { key: 'textMuted', label: '弱化文字' }, { key: 'textDisabled', label: '禁用文字' },
    { key: 'border', label: '边框' }, { key: 'borderStrong', label: '强调边框' },
    { key: 'borderHover', label: '悬停边框' }
  ] },
  { title: '状态', fields: [
    { key: 'danger', label: '危险' }, { key: 'dangerHover', label: '危险悬停' },
    { key: 'success', label: '成功' }, { key: 'successHover', label: '成功悬停' },
    { key: 'warning', label: '警告' }, { key: 'warningHover', label: '警告悬停' },
    { key: 'info', label: '信息' }, { key: 'infoHover', label: '信息悬停' }
  ] }
]

const prefersDarkMode = ref(false)
let prefersDarkQuery: MediaQueryList | null = null
const updatePrefersDarkMode = () => { prefersDarkMode.value = Boolean(prefersDarkQuery?.matches) }
const autoSchemeIcon = computed(() => prefersDarkMode.value ? Moon : Sun)

const hasHiddenElement = computed(() => !localSettings.value.showStudentName ||
  !localSettings.value.showStudentNumber || !localShowTags.value || !localShowNumericAttributes.value)
const canEnableLargeName = computed(() => hasHiddenElement.value && localSettings.value.showStudentName)
const canEnableLargeNumber = computed(() => hasHiddenElement.value && localSettings.value.showStudentNumber)

watch(canEnableLargeName, value => { if (!value && localSettings.value.largeNameMode) updateSetting('ui.largeNameMode', false, { immediate: true }) })
watch(canEnableLargeNumber, value => { if (!value && localSettings.value.largeNumberMode) updateSetting('ui.largeNumberMode', false, { immediate: true }) })
watch(() => localSettings.value.enableAnimations, value => {
  document.documentElement.classList.toggle('disable-animations', !value)
}, { immediate: true })

const hasContrastWarning = computed(() => {
  if (localSettings.value.colorMode !== 'custom') return false
  const colors = localSettings.value.customColors
  return [colors.primary, colors.textPrimary, colors.textSecondary]
    .some(color => !checkColorCombination(color, colors.surface).meetsAA)
})

const resetUiSetting = (key: Exclude<keyof UiSettings, 'customColors'>) => {
  resetSetting(`ui.${key}`)
}
const resetCustomColors = () => {
  for (const key of Object.keys(defaultSettings.ui.customColors) as CustomColorKey[]) {
    updateSetting(`ui.customColors.${key}`, defaultSettings.ui.customColors[key])
  }
  flushPendingSave()
}

const updateCustomColor = (key: CustomColorKey, value: string | null) => {
  if (!value) return
  updateSetting(`ui.customColors.${key}`, value)
}

const updateDefaultZoom = (value: number | null) => {
  updateSetting('ui.defaultZoom', normalizeRequiredNumberInput(
    value,
    localSettings.value.defaultZoom,
    { min: 50, max: 200, precision: 0 }
  ))
}

onMounted(() => {
  if (typeof window.matchMedia !== 'function') return
  prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)')
  updatePrefersDarkMode()
  prefersDarkQuery.addEventListener('change', updatePrefersDarkMode)
})
onBeforeUnmount(() => {
  prefersDarkQuery?.removeEventListener('change', updatePrefersDarkMode)
  flushPendingSave()
})
</script>

<style scoped>
.settings-panel {
  max-width: 920px;
}

.setting-section {
  margin-bottom: 32px;
}

.section-title {
  margin: 0 0 8px;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
}

.section-desc {
  margin: 0 0 20px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.setting-item {
  margin-bottom: 20px;
}

.field-stack {
  display: grid;
  gap: 4px;
  width: 100%;
}

.hint-text {
  color: var(--color-text-disabled);
  font-size: 12px;
  font-style: italic;
}

.mode-tabs {
  display: flex;
  width: 100%;
}

.mode-tab {
  flex: 1;
}

.scheme-options {
  display: flex;
  width: 100%;
}

.scheme-button {
  flex: 1;
  min-width: 0;
  width: auto;
  height: 64px;
}

.scheme-button-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.scheme-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.scheme-auto-mark {
  position: absolute;
  right: -4px;
  bottom: -3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 11px;
  height: 11px;
  border: 1px solid var(--color-primary-light);
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
}

.color-row,
.slider-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  width: 100%;
  align-items: center;
}

.theme-color-picker {
  min-width: 0;
}

.zoom-number-input {
  width: 112px;
}

.color-category {
  margin-bottom: 24px;
}

.category-title {
  margin: 0 0 12px;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.contrast-alert {
  margin-bottom: 14px;
}

.tag-mode-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.tag-mode-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 54px;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-subtle);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.tag-mode-option:hover {
  border-color: var(--color-border-strong);
  background: var(--color-bg-soft);
}

.tag-mode-option.active {
  border-color: var(--color-primary);
  background: var(--color-bg-selected);
}

.mode-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 36px;
  flex: 0 0 48px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-secondary);
}

.mode-icon::before {
  content: '张三';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--color-text-secondary);
  font-size: 11px;
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
  width: 16px;
  height: 4px;
  transform: translateX(-50%);
  background:
    radial-gradient(circle, var(--color-danger) 1.5px, transparent 1.5px) 0 0,
    radial-gradient(circle, var(--color-primary) 1.5px, transparent 1.5px) 6px 0,
    radial-gradient(circle, var(--color-warning) 1.5px, transparent 1.5px) 12px 0;
  background-repeat: no-repeat;
  background-size: 4px 4px, 4px 4px, 4px 4px;
}

.corner-icon::after,
.bottom-icon::after {
  content: 'A';
  position: absolute;
  padding: 1px 4px;
  border-radius: 2px;
  background: var(--color-danger);
  color: var(--color-text-inverse);
  font-size: 8px;
  font-weight: 700;
  line-height: 1.2;
}

.corner-icon::after {
  top: 2px;
  right: 2px;
}

.bottom-icon::after {
  bottom: 2px;
  left: 50%;
  padding-inline: 5px;
  transform: translateX(-50%);
}

.mode-text {
  color: var(--color-text-primary);
  font-size: 13px;
}

.element-toggles {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px 16px;
}

.element-toggle-group,
.toggle-item {
  display: flex;
  align-items: center;
}

.element-toggle-group {
  gap: 10px;
}

.element-toggle-group,
.single-toggle {
  min-height: 42px;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
}

.toggle-item {
  gap: 7px;
  color: var(--color-text-primary);
  font-size: 14px;
}

.toggle-item.sub-toggle {
  padding-left: 10px;
  border-left: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 12px;
}

.toggle-label {
  white-space: nowrap;
}

.toggle-item.disabled {
  opacity: 0.5;
}

@media (max-width: 620px) {
  .scheme-button {
    height: 56px;
  }

  .color-row,
  .slider-row {
    grid-template-columns: 1fr;
  }

  .zoom-number-input {
    width: 100%;
  }

  .element-toggles {
    align-items: flex-start;
    flex-direction: column;
  }

  .element-toggle-group,
  .single-toggle {
    width: 100%;
  }
}
</style>
