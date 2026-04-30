import { ref, watch } from 'vue'
import { useGlobalSettings } from './useGlobalSettings'
import { useWorkspace } from './useWorkspace'
import { useLogger } from './useLogger'

let autoSaveTimer = null
let lastSavedJson = null

export function useAutoSave() {
  const { settings } = useGlobalSettings()
  const { getWorkspaceJson } = useWorkspace()
  const { error } = useLogger()

  const isAutoSaveEnabled = ref(false)
  const lastSaveTime = ref(null)

  const performAutoSave = () => {
    try {
      const json = getWorkspaceJson()
      if (!json) return

      if (lastSavedJson !== null && json === lastSavedJson) return

      localStorage.setItem('sce-autosave-backup', json)
      localStorage.setItem('sce-autosave-time', new Date().toISOString())

      lastSavedJson = json
      lastSaveTime.value = new Date()
    } catch (err) {
      error('自动保存失败: ' + (err.message || err))
    }
  }

  // 启动自动保存
  const startAutoSave = () => {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer)
    }

    const interval = settings.value.editor.autoSaveInterval || 60000

    autoSaveTimer = setInterval(() => {
      performAutoSave()
    }, interval)

    isAutoSaveEnabled.value = true
  }

  // 停止自动保存
  const stopAutoSave = () => {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer)
      autoSaveTimer = null
    }
    isAutoSaveEnabled.value = false
  }

  // 监听自动保存间隔变化
  watch(() => settings.value.editor.autoSaveInterval, (newInterval) => {
    if (isAutoSaveEnabled.value && newInterval) {
      startAutoSave()
    }
  })

  // 恢复自动保存的数据
  const getAutoSaveBackup = () => {
    try {
      const backup = localStorage.getItem('sce-autosave-backup')
      const time = localStorage.getItem('sce-autosave-time')

      if (backup && time) {
        return {
          data: JSON.parse(backup),
          time: new Date(time)
        }
      }
    } catch (error) {
      console.error('Failed to get auto save backup:', error)
    }
    return null
  }

  const markSaved = () => {
    lastSavedJson = getWorkspaceJson()
  }

  const clearAutoSaveBackup = () => {
    localStorage.removeItem('sce-autosave-backup')
    localStorage.removeItem('sce-autosave-time')
  }

  return {
    isAutoSaveEnabled,
    lastSaveTime,
    startAutoSave,
    stopAutoSave,
    performAutoSave,
    markSaved,
    getAutoSaveBackup,
    clearAutoSaveBackup
  }
}
