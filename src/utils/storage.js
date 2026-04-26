/**
 * 安全的浏览器存储工具函数
 * 提供统一的 localStorage 和 sessionStorage 访问接口
 */

/**
 * 安全读取存储
 * @param {string} key - 存储键
 * @param {boolean} preferSession - 是否优先使用 sessionStorage（默认 false）
 * @returns {string|null} 存储的值或 null
 */
export function safeStorageGet(key, preferSession = false) {
  try {
    if (preferSession) {
      const sessionValue = sessionStorage.getItem(key)
      if (sessionValue !== null) {
        return sessionValue
      }
    }
    return localStorage.getItem(key)
  } catch (error) {
    console.warn(`Failed to read storage key "${key}":`, error)
    return null
  }
}

/**
 * 安全写入存储
 * @param {string} key - 存储键
 * @param {string} value - 要存储的值
 * @param {boolean} useSession - 是否使用 sessionStorage（默认 false）
 * @returns {boolean} 是否成功写入
 */
export function safeStorageSet(key, value, useSession = false) {
  try {
    if (useSession) {
      sessionStorage.setItem(key, value)
      // 清除 localStorage 中的旧数据
      try {
        localStorage.removeItem(key)
      } catch (e) {
        // 忽略清除失败
      }
    } else {
      localStorage.setItem(key, value)
    }
    return true
  } catch (error) {
    console.warn(`Failed to write storage key "${key}":`, error)
    return false
  }
}

/**
 * 安全删除存储
 * @param {string} key - 存储键
 * @param {boolean} clearBoth - 是否同时清除 sessionStorage 和 localStorage（默认 false）
 * @returns {boolean} 是否成功删除
 */
export function safeStorageRemove(key, clearBoth = false) {
  try {
    if (clearBoth) {
      sessionStorage.removeItem(key)
    }
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.warn(`Failed to remove storage key "${key}":`, error)
    return false
  }
}
