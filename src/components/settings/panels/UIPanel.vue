<template>
  <div class="settings-panel">
    <NForm label-placement="top" size="medium">
      <section class="setting-section">
        <h3>界面主题</h3>
        <p>主题调整会立即预览并自动保存。</p>

        <NFormItem label="颜色模式">
          <NRadioGroup v-model:value="colorModeModel" size="small">
            <NRadioButton value="simple">简单模式</NRadioButton>
            <NRadioButton value="custom">高级定制</NRadioButton>
          </NRadioGroup>
        </NFormItem>

        <template v-if="localSettings.colorMode === 'simple'">
          <NFormItem label="配色方案">
            <NRadioGroup v-model:value="colorSchemeModel" size="small">
              <NRadioButton value="light">浅色</NRadioButton>
              <NRadioButton value="dark">深色</NRadioButton>
              <NRadioButton value="auto">跟随浏览器（当前{{ prefersDarkMode ? '深色' : '浅色' }}）</NRadioButton>
            </NRadioGroup>
          </NFormItem>
          <NFormItem label="主题色">
            <div class="color-row">
              <NColorPicker v-model:value="themeColorModel" :show-alpha="false" :modes="['hex']" />
              <NButton secondary :disabled="localSettings.themeColor === defaultSettings.ui.themeColor" @click="resetUiSetting('themeColor')">
                <template #icon><RotateCcw :size="15" /></template>恢复默认
              </NButton>
            </div>
          </NFormItem>
        </template>

        <template v-else>
          <NFormItem label="定制主题基底">
            <NRadioGroup v-model:value="customBaseSchemeModel" size="small">
              <NRadioButton value="light">浅色组件基底</NRadioButton>
              <NRadioButton value="dark">深色组件基底</NRadioButton>
            </NRadioGroup>
          </NFormItem>

          <NCard v-for="group in customColorGroups" :key="group.title" size="small" :title="group.title" class="color-group">
            <NGrid cols="1 520:2" :x-gap="14" :y-gap="12">
              <NGridItem v-for="field in group.fields" :key="field.key">
                <NFormItem :label="field.label" :show-feedback="false">
                  <NColorPicker :value="localSettings.customColors[field.key]" :show-alpha="false" :modes="['hex']" @update:value="value => updateCustomColor(field.key, value)" />
                </NFormItem>
              </NGridItem>
            </NGrid>
          </NCard>

          <NAlert v-if="hasContrastWarning" type="warning" :show-icon="true">
            当前部分文字或主色与背景的对比度未达到 WCAG AA，建议继续调整。
          </NAlert>
          <NButton secondary @click="resetCustomColors"><template #icon><RotateCcw :size="15" /></template>重置全部定制颜色</NButton>
        </template>
      </section>

      <section class="setting-section">
        <h3>显示与交互</h3>
        <p>调整默认缩放、动画和座位卡信息密度。</p>

        <NFormItem label="默认缩放">
          <div class="slider-row">
            <NSlider v-model:value="defaultZoomModel" :min="50" :max="200" :step="10" />
            <NInputNumber class="zoom-number-input" :value="localSettings.defaultZoom" :min="50" :max="200" :step="10" @update:value="updateDefaultZoom" />
          </div>
        </NFormItem>

        <NFormItem label="界面动画">
          <NSwitch v-model:value="enableAnimationsModel" />
        </NFormItem>

        <NFormItem label="标签显示模式">
          <NRadioGroup v-model:value="localTagDisplayMode" size="small">
            <NRadioButton value="dot">颜色点</NRadioButton>
            <NRadioButton value="corner">右上角文字</NRadioButton>
            <NRadioButton value="bottom">座位下部文字</NRadioButton>
          </NRadioGroup>
        </NFormItem>

        <NGrid cols="1 620:2" :x-gap="18" :y-gap="12">
          <NGridItem><NFormItem label="显示姓名"><NSwitch v-model:value="showStudentNameModel" /></NFormItem></NGridItem>
          <NGridItem><NFormItem label="姓名大字号"><NSwitch v-model:value="largeNameModeModel" :disabled="!canEnableLargeName" /></NFormItem></NGridItem>
          <NGridItem><NFormItem label="显示学号"><NSwitch v-model:value="showStudentNumberModel" /></NFormItem></NGridItem>
          <NGridItem><NFormItem label="学号大字号"><NSwitch v-model:value="largeNumberModeModel" :disabled="!canEnableLargeNumber" /></NFormItem></NGridItem>
          <NGridItem><NFormItem label="显示标签"><NSwitch v-model:value="localShowTags" /></NFormItem></NGridItem>
          <NGridItem><NFormItem label="显示数值属性"><NSwitch v-model:value="localShowNumericAttributes" /></NFormItem></NGridItem>
          <NGridItem><NFormItem label="显示行号"><NSwitch v-model:value="showEditorRowNumbersModel" /></NFormItem></NGridItem>
        </NGrid>
      </section>
    </NForm>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NColorPicker,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSlider,
  NSwitch
} from 'naive-ui'
import { RotateCcw } from 'lucide-vue-next'
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
.settings-panel { max-width: 920px; }
.setting-section { display: grid; gap: 16px; margin-bottom: 30px; }
.setting-section h3 { margin: 0; color: var(--color-text-primary); font-size: 16px; }
.setting-section > p { margin: -10px 0 0; color: var(--color-text-secondary); font-size: 13px; }
.color-row, .slider-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; width: 100%; align-items: center; }
.color-group { background: var(--color-bg-subtle); }
.zoom-number-input { width: 112px; }
@media (max-width: 620px) {
  .color-row, .slider-row { grid-template-columns: 1fr; }
  .zoom-number-input { width: 100%; }
}
</style>
