import { ref } from 'vue'
import { safeStorageGet, safeStorageSet } from '@/utils/storage'

// 默认设置结构
const defaultSettings = {
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
    enableAnimations: true
  },
  editor: {
    autoSaveInterval: 60000, // 1分钟
    undoHistorySize: 50,
    dragSensitivity: 1.0,
    doubleClickAction: 'edit' // 'edit' | 'random'
  }
}

// 全局单例状态
const settings = ref(JSON.parse(JSON.stringify(defaultSettings)))

const STORAGE_KEY = 'sce-global-settings'

/**
 * 从 localStorage 加载设置
 * @returns {boolean} 是否成功加载
 */
const loadFromLocalStorage = () => {
  try {
    const stored = safeStorageGet(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // 合并策略：先展开默认值，再展开加载的值，保留新字段
      settings.value = {
        sync: { ...defaultSettings.sync, ...parsed.sync },
        ui: { ...defaultSettings.ui, ...parsed.ui },
        editor: { ...defaultSettings.editor, ...parsed.editor }
      }
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

/**
 * 更新单个设置项
 * @param {string} path - 点号分隔的路径，如 'ui.themeColor'
 * @param {any} value - 新值
 * @returns {boolean} 是否成功更新
 */
const updateSetting = (path, value) => {
  try {
    const parts = path.split('.')
    if (parts.length !== 2) {
      console.error('Invalid setting path:', path)
      return false
    }

    const [category, key] = parts

    // 验证分类是否存在
    if (!settings.value[category]) {
      console.error('Invalid setting category:', category)
      return false
    }

    // 验证键是否存在于默认设置中
    if (!(key in defaultSettings[category])) {
      console.error('Invalid setting key:', key)
      return false
    }

    // 更新值
    settings.value[category][key] = value

    // 自动保存到 localStorage
    return saveToLocalStorage()
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
const resetSettings = (category) => {
  try {
    if (category) {
      // 重置指定分类
      if (!defaultSettings[category]) {
        console.error('Invalid setting category:', category)
        return false
      }
      settings.value[category] = JSON.parse(JSON.stringify(defaultSettings[category]))
    } else {
      // 重置全部
      settings.value = JSON.parse(JSON.stringify(defaultSettings))
    }

    // 保存到 localStorage
    return saveToLocalStorage()
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
    // 简单模式：应用深浅色方案
    if (colorScheme === 'auto') {
      // 跟随浏览器
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
}

// 应用主题色到 CSS 变量
const applyThemeColor = () => {
  const { colorMode, themeColor, customColors } = settings.value.ui
  const root = document.documentElement

  if (colorMode === 'simple') {
    // 简单模式：只应用主题色
    if (themeColor) {
      root.style.setProperty('--color-primary', themeColor)
      root.style.setProperty('--color-primary-rgb', hexToRgb(themeColor))
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

  // 强制触发重绘，确保 CSS 变量立即生效
  void root.offsetHeight
}

// 辅助函数：hex 转 rgb
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 255'
}

/**
 * 获取单个设置项的默认值
 * @param {string} path - 点号分隔的路径，如 'ui.themeColor'
 * @returns {any} 默认值
 */
const getDefaultValue = (path) => {
  const parts = path.split('.')
  if (parts.length !== 2) return undefined

  const [category, key] = parts
  return defaultSettings[category]?.[key]
}

/**
 * 重置单个设置项到默认值
 * @param {string} path - 点号分隔的路径，如 'ui.themeColor'
 * @returns {boolean} 是否成功重置
 */
const resetSetting = (path) => {
  const defaultValue = getDefaultValue(path)
  if (defaultValue === undefined) return false

  return updateSetting(path, defaultValue)
}

// 模块初始化时自动加载设置
loadFromLocalStorage()
applyColorScheme()
applyThemeColor()

export function useGlobalSettings() {
  return {
    settings,
    defaultSettings,
    loadFromLocalStorage,
    saveToLocalStorage,
    updateSetting,
    resetSettings,
    resetSetting,
    getDefaultValue,
    applyThemeColor,
    applyColorScheme
  }
}
