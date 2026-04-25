import { ref } from 'vue'

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
    themeColor: '#23587b',
    defaultZoom: 100,
    enableAnimations: true,
    compactMode: false
  },
  editor: {
    autoSaveInterval: 60000, // 1分钟
    defaultFileFormat: '.sce',
    undoHistorySize: 50,
    dragSensitivity: 1.0,
    doubleClickAction: 'edit' // 'edit' 或 'assign'
  }
}

// 全局单例状态
const settings = ref(JSON.parse(JSON.stringify(defaultSettings)))

const STORAGE_KEY = 'sce-global-settings'

/**
 * 安全读取 localStorage
 * @param {string} key - 存储键
 * @returns {string|null} 存储的值或 null
 */
const safeStorageGet = (key) => {
  try {
    return localStorage.getItem(key)
  } catch (error) {
    console.warn(`Failed to read localStorage key "${key}":`, error)
    return null
  }
}

/**
 * 安全写入 localStorage
 * @param {string} key - 存储键
 * @param {string} value - 要存储的值
 * @returns {boolean} 是否成功写入
 */
const safeStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    console.warn(`Failed to write localStorage key "${key}":`, error)
    return false
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

// 模块初始化时自动加载设置
loadFromLocalStorage()

export function useGlobalSettings() {
  return {
    settings,
    loadFromLocalStorage,
    saveToLocalStorage,
    updateSetting,
    resetSettings
  }
}
