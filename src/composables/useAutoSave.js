import { ref, watch } from 'vue'
import { useGlobalSettings } from './useGlobalSettings'
import { useWorkspace } from './useWorkspace'
import { useLogger } from './useLogger'
import { readStoredText, removeStoredText, writeStoredText } from '@/platform/nativeStorage'

const AUTO_SAVE_BACKUP_KEY = 'sce-autosave-backup'
const AUTO_SAVE_TIME_KEY = 'sce-autosave-time'
const AUTO_SAVE_HANDLED_TIME_KEY = 'sce-autosave-handled-time'

let autoSaveTimer = null
let lastSavedSignature = null
const isAutoSaveEnabled = ref(false)
const lastSaveTime = ref(null)
const autoSaveBackup = ref(null)
const isAutoSaveBackupLoading = ref(false)

const buildBackupRecord = (backup, time) => {
  if (!backup || !time) return null

  const data = JSON.parse(backup)
  if (!data || !Array.isArray(data.students) || !Array.isArray(data.tags)) {
    return null
  }

  const parsedTime = new Date(time)
  const timeIso = Number.isFinite(parsedTime.getTime()) ? parsedTime.toISOString() : String(time)

  return {
    data,
    time: Number.isFinite(parsedTime.getTime()) ? parsedTime : null,
    timeIso,
    size: backup.length
  }
}

const createAutoSaveSignature = (json) => {
  try {
    const data = JSON.parse(json)
    if (data?.meta) {
      delete data.meta.createdAt
    }
    return JSON.stringify(data)
  } catch (_error) {
    return json
  }
}

export function useAutoSave() {
  const { settings } = useGlobalSettings()
  const { getWorkspaceJson, applyWorkspaceData, saveLastWorkspace } = useWorkspace()
  const { error } = useLogger()

  const performAutoSave = async () => {
    try {
      const json = getWorkspaceJson()
      if (!json) return

      const signature = createAutoSaveSignature(json)
      if (lastSavedSignature !== null && signature === lastSavedSignature) return

      const savedAt = new Date()
      const savedAtIso = savedAt.toISOString()
      const backupWritten = await writeStoredText(AUTO_SAVE_BACKUP_KEY, json)
      const timeWritten = await writeStoredText(AUTO_SAVE_TIME_KEY, savedAtIso)
      if (!backupWritten || !timeWritten) {
        throw new Error('写入自动保存失败')
      }

      lastSavedSignature = signature
      lastSaveTime.value = savedAt
      autoSaveBackup.value = buildBackupRecord(json, savedAtIso)
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
  const getAutoSaveBackup = async () => {
    isAutoSaveBackupLoading.value = true
    try {
      const backup = await readStoredText(AUTO_SAVE_BACKUP_KEY)
      const time = await readStoredText(AUTO_SAVE_TIME_KEY)

      const record = buildBackupRecord(backup, time)
      autoSaveBackup.value = record
      return record
    } catch (error) {
      console.error('Failed to get auto save backup:', error)
      autoSaveBackup.value = null
    } finally {
      isAutoSaveBackupLoading.value = false
    }
    return null
  }

  const isAutoSavePromptDue = async (backup = autoSaveBackup.value) => {
    if (!backup?.timeIso) return false

    try {
      const handledTime = await readStoredText(AUTO_SAVE_HANDLED_TIME_KEY)
      return handledTime !== backup.timeIso
    } catch (error) {
      console.error('Failed to read auto save prompt state:', error)
      return true
    }
  }

  const markAutoSaveBackupHandled = async (backup = autoSaveBackup.value) => {
    if (!backup?.timeIso) return false
    return writeStoredText(AUTO_SAVE_HANDLED_TIME_KEY, backup.timeIso)
  }

  const markSaved = () => {
    const json = getWorkspaceJson()
    lastSavedSignature = json ? createAutoSaveSignature(json) : null
  }

  const restoreAutoSaveBackup = async (backup = autoSaveBackup.value) => {
    if (!backup?.data) return false

    const isSuccess = await applyWorkspaceData(backup.data)
    if (!isSuccess) return false

    saveLastWorkspace({
      type: 'autosave',
      name: '自动保存',
      time: backup.timeIso
    })
    markSaved()
    await markAutoSaveBackupHandled(backup)
    return true
  }

  const clearAutoSaveBackup = async () => {
    await removeStoredText(AUTO_SAVE_BACKUP_KEY)
    await removeStoredText(AUTO_SAVE_TIME_KEY)
    await removeStoredText(AUTO_SAVE_HANDLED_TIME_KEY)
    autoSaveBackup.value = null
    lastSavedSignature = null
  }

  return {
    isAutoSaveEnabled,
    lastSaveTime,
    autoSaveBackup,
    isAutoSaveBackupLoading,
    startAutoSave,
    stopAutoSave,
    performAutoSave,
    markSaved,
    getAutoSaveBackup,
    isAutoSavePromptDue,
    markAutoSaveBackupHandled,
    restoreAutoSaveBackup,
    clearAutoSaveBackup
  }
}
