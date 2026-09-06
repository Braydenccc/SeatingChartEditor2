import { ref } from 'vue'
import { safeStorageGet, safeStorageSet } from '@/utils/storage'
import { getContrastRatio, hexToRgb as utilHexToRgb } from '@/utils/colorContrast'
import type {
  CustomThemeColors,
  EditorSettings,
  GlobalSettingsV2,
  SettingsCategory,
  SyncSettings,
  UiSettings
} from '@/types/settings'

export type SettingPath =
  | `sync.${keyof SyncSettings}`
  | `editor.${keyof EditorSettings}`
  | `ui.${Exclude<keyof UiSettings, 'customColors'>}`
  | `ui.customColors.${keyof CustomThemeColors}`

export type SettingValue<Path extends SettingPath> =
  Path extends `sync.${infer Key extends keyof SyncSettings}` ? SyncSettings[Key] :
    Path extends `editor.${infer Key extends keyof EditorSettings}` ? EditorSettings[Key] :
      Path extends `ui.customColors.${infer Key extends keyof CustomThemeColors}` ? CustomThemeColors[Key] :
        Path extends `ui.${infer Key extends Exclude<keyof UiSettings, 'customColors'>}` ? UiSettings[Key] : never

interface UpdateSettingOptions {
  immediate?: boolean
}

interface RgbColor {
  r: number
  g: number
  b: number
}

// 默认设置结构
const defaultSettings: GlobalSettingsV2 = {
  schemaVersion: 2,
  sync: {
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    autoSync: true,
    syncInterval: 300000 // 5分钟
  },
  ui: {
    language: 'zh-CN',
    colorMode: 'simple', // 'simple' | 'custom'
    colorScheme: 'light', // 'light' | 'dark' | 'auto'
    customBaseScheme: 'light', // 'light' | 'dark'
    themeColor: '#23587b',
    customColors: {
      // 主色调
      primary: '#23587b',
      primaryLight: '#2d6a94',
      primaryDark: '#1a4460',
      primaryHover: '#1d4763',
      // 背景色
      surface: '#ffffff',
      bgSelected: '#e8f4f8',
      bgCard: '#fafbfc',
      bgSubtle: '#f8fafc',
      bgSoft: '#f1f5f9',
      bgHover: '#f8f9fa',
      // 文字颜色
      textPrimary: '#334155',
      textSecondary: '#475569',
      textMuted: '#64748b',
      textDisabled: '#94a3b8',
      // 边框颜色
      border: '#e2e8f0',
      borderStrong: '#cbd5e1',
      borderHover: '#cbd5e1',
      // 状态颜色
      danger: '#f44336',
      dangerHover: '#d32f2f',
      success: '#059669',
      successHover: '#047857',
      warning: '#f59e0b',
      warningHover: '#d97706',
      info: '#1d4ed8',
      infoHover: '#1e40af'
    },
    defaultZoom: 100,
    enableAnimations: true,
    showStudentName: true,
    showStudentNumber: true,
    showEditorRowNumbers: true,
    largeNameMode: false,
    largeNumberMode: false
  },
  editor: {
    undoHistorySize: 50,
    dragSensitivity: 1.0,
    doubleClickAction: 'edit' // 'edit' | 'random'
  }
}

// 全局单例状态
const cloneSettings = <Value>(value: Value): Value => structuredClone(value)
const settings = ref<GlobalSettingsV2>(cloneSettings(defaultSettings))
const themeRevision = ref(0)

const STORAGE_KEY = 'sce-global-settings'
const SAVE_DEBOUNCE = 200
let saveTimer: ReturnType<typeof setTimeout> | null = null
const WHITE_RGB = { r: 255, g: 255, b: 255 }
const BLACK_RGB = { r: 0, g: 0, b: 0 }
const DARK_SURFACE_RGB = { r: 30, g: 41, b: 59 }
const CUSTOM_ONLY_COLOR_PROPERTIES = [
  '--color-surface',
  '--color-surface-rgb',
  '--color-bg-selected',
  '--color-bg-card',
  '--color-bg-subtle',
  '--color-bg-soft',
  '--color-bg-hover',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-muted',
  '--color-text-disabled',
  '--color-border',
  '--color-border-strong',
  '--color-border-hover',
  '--color-danger',
  '--color-danger-hover',
  '--color-success',
  '--color-success-hover',
  '--color-warning',
  '--color-warning-hover',
  '--color-info',
  '--color-info-hover'
]

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

const readString = (value: unknown, fallback: string) => typeof value === 'string' ? value : fallback
const readBoolean = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback
const readEnum = <Value extends string>(value: unknown, allowed: readonly Value[], fallback: Value): Value => (
  typeof value === 'string' && allowed.includes(value as Value) ? value as Value : fallback
)
const readNumber = (value: unknown, fallback: number, min: number, max: number, integer = false) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const limited = Math.min(max, Math.max(min, parsed))
  return integer ? Math.round(limited) : limited
}
const readHexColor = (value: unknown, fallback: string) => (
  typeof value === 'string' && /^#[\da-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback
)

export const migrateGlobalSettings = (input: unknown): GlobalSettingsV2 => {
  const root = isRecord(input) ? input : {}
  const sync = isRecord(root.sync) ? root.sync : {}
  const ui = isRecord(root.ui) ? root.ui : {}
  const editor = isRecord(root.editor) ? root.editor : {}
  const customColors = isRecord(ui.customColors) ? ui.customColors : {}
  const migratedColors = Object.fromEntries(
    (Object.keys(defaultSettings.ui.customColors) as Array<keyof CustomThemeColors>).map(key => [
      key,
      readHexColor(customColors[key], defaultSettings.ui.customColors[key])
    ])
  ) as unknown as CustomThemeColors

  return {
    schemaVersion: 2,
    sync: {
      webdavUrl: readString(sync.webdavUrl, defaultSettings.sync.webdavUrl),
      webdavUsername: readString(sync.webdavUsername, defaultSettings.sync.webdavUsername),
      webdavPassword: readString(sync.webdavPassword, defaultSettings.sync.webdavPassword),
      autoSync: readBoolean(sync.autoSync, defaultSettings.sync.autoSync),
      syncInterval: readNumber(sync.syncInterval, defaultSettings.sync.syncInterval, 10_000, 3_600_000, true)
    },
    ui: {
      language: readEnum(ui.language, ['zh-CN', 'en-US'], defaultSettings.ui.language),
      colorMode: readEnum(ui.colorMode, ['simple', 'custom'], defaultSettings.ui.colorMode),
      colorScheme: readEnum(ui.colorScheme, ['light', 'dark', 'auto'], defaultSettings.ui.colorScheme),
      customBaseScheme: readEnum(
        ui.customBaseScheme,
        ['light', 'dark'],
        ui.colorScheme === 'dark' ? 'dark' : defaultSettings.ui.customBaseScheme
      ),
      themeColor: readHexColor(ui.themeColor, defaultSettings.ui.themeColor),
      customColors: migratedColors,
      defaultZoom: readNumber(ui.defaultZoom, defaultSettings.ui.defaultZoom, 50, 200, true),
      enableAnimations: readBoolean(ui.enableAnimations, defaultSettings.ui.enableAnimations),
      showStudentName: readBoolean(ui.showStudentName, defaultSettings.ui.showStudentName),
      showStudentNumber: readBoolean(ui.showStudentNumber, defaultSettings.ui.showStudentNumber),
      showEditorRowNumbers: readBoolean(ui.showEditorRowNumbers, defaultSettings.ui.showEditorRowNumbers),
      largeNameMode: readBoolean(ui.largeNameMode, defaultSettings.ui.largeNameMode),
      largeNumberMode: readBoolean(ui.largeNumberMode, defaultSettings.ui.largeNumberMode)
    },
    editor: {
      undoHistorySize: readNumber(editor.undoHistorySize, defaultSettings.editor.undoHistorySize, 10, 100, true),
      dragSensitivity: readNumber(editor.dragSensitivity, defaultSettings.editor.dragSensitivity, 0.5, 2),
      doubleClickAction: readEnum(editor.doubleClickAction, ['edit', 'random'], defaultSettings.editor.doubleClickAction)
    }
  }
}

/**
 * 从 localStorage 加载设置
 * @returns {boolean} 是否成功加载
 */
const loadFromLocalStorage = () => {
  try {
    const stored = safeStorageGet(STORAGE_KEY)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      settings.value = migrateGlobalSettings(parsed)
      safeStorageSet(STORAGE_KEY, JSON.stringify(settings.value))
      return true
    }
    return false
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error)
    return false
  }
}

/**
 * 保存设置到 localStorage
 * @returns {boolean} 是否成功保存
 */
const saveToLocalStorage = () => {
  try {
    return safeStorageSet(STORAGE_KEY, JSON.stringify(settings.value))
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error)
    return false
  }
}

const flushPendingSave = () => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  return saveToLocalStorage()
}

const scheduleSave = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveToLocalStorage()
  }, SAVE_DEBOUNCE)
}

/**
 * 更新单个设置项
 * @param {string} path - 点号分隔的路径，如 'ui.themeColor'
 * @param {any} value - 新值
 * @returns {boolean} 是否成功更新
 */
const updateSetting = <Path extends SettingPath>(
  path: Path,
  value: SettingValue<Path>,
  options: UpdateSettingOptions = {}
) => {
  try {
    const parts = path.split('.')
    if (parts.length < 2) {
      console.error('Invalid setting path:', path)
      return false
    }

    const [category] = parts as [SettingsCategory]

    // 验证分类是否存在
    if (!settings.value[category]) {
      console.error('Invalid setting category:', category)
      return false
    }

    let target: Record<string, unknown> = settings.value as unknown as Record<string, unknown>
    let defaultsTarget: Record<string, unknown> = defaultSettings as unknown as Record<string, unknown>
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index]
      if (!isRecord(target[key]) || !isRecord(defaultsTarget[key])) {
        console.error('Invalid setting path:', path)
        return false
      }
      target = target[key]
      defaultsTarget = defaultsTarget[key]
    }
    const key = parts[parts.length - 1]
    if (!(key in defaultsTarget)) {
      console.error('Invalid setting key:', key)
      return false
    }
    target[key] = value
    if (category === 'ui') {
      applyColorScheme()
      applyThemeColor()
    }
    if (options.immediate) return flushPendingSave()
    scheduleSave()
    return true
  } catch (error) {
    console.error('Failed to update setting:', error)
    return false
  }
}

/**
 * 重置设置
 * @param {string} [category] - 可选，指定要重置的分类。不传则重置全部
 * @returns {boolean} 是否成功重置
 */
const resetSettings = (category?: SettingsCategory) => {
  try {
    if (category) {
      // 重置指定分类
      if (!defaultSettings[category]) {
        console.error('Invalid setting category:', category)
        return false
      }
      if (category === 'sync') settings.value.sync = cloneSettings(defaultSettings.sync)
      if (category === 'ui') settings.value.ui = cloneSettings(defaultSettings.ui)
      if (category === 'editor') settings.value.editor = cloneSettings(defaultSettings.editor)
    } else {
      // 重置全部
      settings.value = cloneSettings(defaultSettings)
    }

    if (!category || category === 'ui') {
      applyColorScheme()
      applyThemeColor()
    }

    // 保存到 localStorage
    return flushPendingSave()
  } catch (error) {
    console.error('Failed to reset settings:', error)
    return false
  }
}

// 应用颜色方案（深浅色模式）
const applyColorScheme = () => {
  const { colorMode, colorScheme } = settings.value.ui
  const root = document.documentElement

  if (colorMode === 'simple') {
    if (colorScheme === 'auto') {
      // 跟随浏览器：移除 data-theme，让 CSS @media (prefers-color-scheme) 生效
      root.removeAttribute('data-theme')
    } else {
      // 强制深色或浅色
      root.setAttribute('data-theme', colorScheme)
    }
  } else {
    // 定制模式：应用自定义颜色
    root.setAttribute('data-theme', 'custom')
  }

  // 强制触发重绘，确保 CSS 变量立即生效
  void root.offsetHeight
  themeRevision.value += 1
}

const rgbToHex = ({ r, g, b }: RgbColor) => {
  const toHex = (value: number) => Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const mixRgb = (color: RgbColor, target: RgbColor, weight: number): RgbColor => ({
  r: color.r + (target.r - color.r) * weight,
  g: color.g + (target.g - color.g) * weight,
  b: color.b + (target.b - color.b) * weight
})

const mixHex = (color: string, target: RgbColor, weight: number) => {
  const rgb = utilHexToRgb(color)
  if (!rgb || !target) return color
  return rgbToHex(mixRgb(rgb, target, weight))
}

const isDarkSimpleScheme = () => {
  const { colorScheme } = settings.value.ui
  if (colorScheme === 'dark') return true
  if (colorScheme !== 'auto') return false

  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
}

const getReadableDarkPrimary = (color: string) => {
  const rgb = utilHexToRgb(color)
  if (!rgb || getContrastRatio(rgb, DARK_SURFACE_RGB) >= 4.5) return color

  for (let weight = 0.1; weight <= 0.8; weight += 0.1) {
    const candidateRgb = mixRgb(rgb, WHITE_RGB, weight)
    if (getContrastRatio(candidateRgb, DARK_SURFACE_RGB) >= 4.5) {
      const candidate = rgbToHex(candidateRgb)
      return candidate
    }
  }

  return rgbToHex(mixRgb(rgb, WHITE_RGB, 0.8))
}

// 应用主题色到 CSS 变量
const applyThemeColor = () => {
  const { colorMode, themeColor, customBaseScheme, customColors } = settings.value.ui
  const root = document.documentElement

  if (colorMode === 'simple') {
    // 退出定制模式时移除内联覆盖，让浅色/深色方案重新接管这些变量
    CUSTOM_ONLY_COLOR_PROPERTIES.forEach(property => root.style.removeProperty(property))

    // 简单模式：只应用主题色
    if (themeColor) {
      const isDark = isDarkSimpleScheme()
      const primary = isDark ? getReadableDarkPrimary(themeColor) : themeColor

      root.style.setProperty('--color-primary', primary)
      root.style.setProperty('--color-primary-rgb', hexToRgb(primary))
      root.style.setProperty('--color-primary-light', mixHex(primary, WHITE_RGB, 0.18))
      root.style.setProperty('--color-primary-dark', mixHex(primary, BLACK_RGB, isDark ? 0.08 : 0.24))
      root.style.setProperty('--color-primary-hover', mixHex(primary, isDark ? WHITE_RGB : BLACK_RGB, isDark ? 0.12 : 0.18))
    }
  } else {
    // 定制模式：应用所有自定义颜色
    // 主色调
    root.style.setProperty('--color-primary', customColors.primary)
    root.style.setProperty('--color-primary-rgb', hexToRgb(customColors.primary))
    root.style.setProperty('--color-primary-light', customColors.primaryLight)
    root.style.setProperty('--color-primary-dark', customColors.primaryDark)
    root.style.setProperty('--color-primary-hover', customColors.primaryHover)

    // 背景色
    root.style.setProperty('--color-surface', customColors.surface)
    root.style.setProperty('--color-surface-rgb', hexToRgb(customColors.surface))
    root.style.setProperty('--color-bg-selected', customColors.bgSelected)
    root.style.setProperty('--color-bg-card', customColors.bgCard)
    root.style.setProperty('--color-bg-subtle', customColors.bgSubtle)
    root.style.setProperty('--color-bg-soft', customColors.bgSoft)
    root.style.setProperty('--color-bg-hover', customColors.bgHover)

    // 文字颜色
    root.style.setProperty('--color-text-primary', customColors.textPrimary)
    root.style.setProperty('--color-text-secondary', customColors.textSecondary)
    root.style.setProperty('--color-text-muted', customColors.textMuted)
    root.style.setProperty('--color-text-disabled', customColors.textDisabled)

    // 边框颜色
    root.style.setProperty('--color-border', customColors.border)
    root.style.setProperty('--color-border-strong', customColors.borderStrong)
    root.style.setProperty('--color-border-hover', customColors.borderHover)

    // 状态颜色
    root.style.setProperty('--color-danger', customColors.danger)
    root.style.setProperty('--color-danger-hover', customColors.dangerHover)
    root.style.setProperty('--color-success', customColors.success)
    root.style.setProperty('--color-success-hover', customColors.successHover)
    root.style.setProperty('--color-warning', customColors.warning)
    root.style.setProperty('--color-warning-hover', customColors.warningHover)
    root.style.setProperty('--color-info', customColors.info)
    root.style.setProperty('--color-info-hover', customColors.infoHover)
  }

  const usesDarkBase = colorMode === 'custom'
    ? customBaseScheme === 'dark'
    : isDarkSimpleScheme()
  root.style.setProperty(
    '--color-header-accent-bg',
    usesDarkBase
      ? 'color-mix(in srgb, var(--color-primary-dark) 64%, var(--color-bg-card))'
      : 'var(--color-primary)'
  )

  // 强制触发重绘，确保 CSS 变量立即生效
  void root.offsetHeight
}

// 辅助函数：hex 转 rgb（使用工具函数）
const hexToRgb = (hex: string) => {
  const rgb = utilHexToRgb(hex)
  return rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '255, 255, 255'
}

/**
 * 获取单个设置项的默认值
 * @param {string} path - 点号分隔的路径，如 'ui.themeColor'
 * @returns {any} 默认值
 */
const readSettingPath = (source: GlobalSettingsV2, path: SettingPath): unknown => {
  let value: unknown = source
  for (const key of path.split('.')) {
    if (!isRecord(value)) return undefined
    value = value[key]
  }
  return value
}

const getDefaultValue = <Path extends SettingPath>(path: Path): SettingValue<Path> => (
  readSettingPath(defaultSettings, path) as SettingValue<Path>
)

/**
 * 重置单个设置项到默认值
 * @param {string} path - 点号分隔的路径，如 'ui.themeColor'
 * @returns {boolean} 是否成功重置
 */
const resetSetting = <Path extends SettingPath>(path: Path) => {
  const defaultValue = getDefaultValue(path)
  if (defaultValue === undefined) return false

  return updateSetting(path, defaultValue, { immediate: true })
}

const getSetting = <Path extends SettingPath>(path: Path): SettingValue<Path> => (
  readSettingPath(settings.value, path) as SettingValue<Path>
)
const resetCategory = (category: SettingsCategory) => resetSettings(category)

// 模块初始化时自动加载设置
loadFromLocalStorage()
applyColorScheme()
applyThemeColor()

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSave()
  })
}
if (typeof window !== 'undefined') {
  window.addEventListener('blur', flushPendingSave)
  window.addEventListener('pagehide', flushPendingSave)
  if (typeof window.matchMedia === 'function') {
    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemThemeQuery.addEventListener('change', () => {
      if (settings.value.ui.colorMode !== 'simple' || settings.value.ui.colorScheme !== 'auto') return
      applyColorScheme()
      applyThemeColor()
    })
  }
}

export function useGlobalSettings() {
  return {
    settings,
    themeRevision,
    defaultSettings,
    loadFromLocalStorage,
    saveToLocalStorage,
    updateSetting,
    getSetting,
    resetSettings,
    resetSetting,
    resetCategory,
    getDefaultValue,
    applyThemeColor,
    applyColorScheme,
    scheduleSave,
    flushPendingSave
  }
}
