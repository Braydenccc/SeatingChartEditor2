import { ref, watch, type WatchStopHandle } from 'vue'
import { useWorkspace } from './useWorkspace'
import { useLogger } from './useLogger'
import { readStoredText, removeStoredText, writeStoredText } from '@/platform/nativeStorage'
import type { Workspace } from '@/types/models'

export interface AutoSaveBackup {
  data: Workspace
  time: Date | null
  timeIso: string
  size: number
}

const AUTO_SAVE_BACKUP_KEY = 'sce-autosave-backup'
const LEGACY_AUTO_SAVE_TIME_KEY = 'sce-autosave-time'
const LEGACY_AUTO_SAVE_HANDLED_TIME_KEY = 'sce-autosave-handled-time'
const AUTO_SAVE_RECORD_TYPE = 'sce-autosave'
const AUTO_SAVE_RECORD_VERSION = 1

let stopAutoSaveWatcher: WatchStopHandle | null = null
let autoSaveQueue: Promise<void> = Promise.resolve()
let lastSavedSignature: string | null = null
const isAutoSaveEnabled = ref(false)
const lastSaveTime = ref<Date | null>(null)
const autoSaveBackup = ref<AutoSaveBackup | null>(null)
const isAutoSaveBackupLoading = ref(false)

type WorkspacePreparer = (workspaceRaw: unknown) => Workspace

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

const buildBackupRecord = (
  storedBackup: string | null,
  prepareWorkspaceData: WorkspacePreparer,
  legacyTime: string | null = null
): AutoSaveBackup | null => {
  if (!storedBackup) return null

  const parsed: unknown = JSON.parse(storedBackup)
  const isCurrentRecord = isRecord(parsed) &&
    parsed.type === AUTO_SAVE_RECORD_TYPE &&
    Object.prototype.hasOwnProperty.call(parsed, 'workspace')
  const rawData: unknown = isCurrentRecord ? parsed.workspace : parsed
  const time = isCurrentRecord ? parsed.savedAt : legacyTime
  if (typeof time !== 'string' || !time) return null
  const data = prepareWorkspaceData(rawData)

  const parsedTime = new Date(time)
  const timeIso = Number.isFinite(parsedTime.getTime()) ? parsedTime.toISOString() : String(time)

  return {
    data,
    time: Number.isFinite(parsedTime.getTime()) ? parsedTime : null,
    timeIso,
    size: JSON.stringify(data).length
  }
}

const createStoredBackup = (json: string, savedAtIso: string) => JSON.stringify({
  type: AUTO_SAVE_RECORD_TYPE,
  version: AUTO_SAVE_RECORD_VERSION,
  savedAt: savedAtIso,
  workspace: JSON.parse(json)
})

const createAutoSaveSignature = (json: string) => {
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
  const {
    getWorkspaceJson,
    prepareWorkspaceData,
    applyWorkspaceData,
    saveLastWorkspace
  } = useWorkspace()
  const { error } = useLogger()

  const performAutoSave = (workspaceJson: string | null = null) => {
    const json = workspaceJson || getWorkspaceJson()
    if (!json) return Promise.resolve(false)

    const signature = createAutoSaveSignature(json)
    const saveOperation = async () => {
      if (lastSavedSignature !== null && signature === lastSavedSignature) return false

      try {
        const savedAt = new Date()
        const savedAtIso = savedAt.toISOString()
        const storedBackup = createStoredBackup(json, savedAtIso)
        const backupWritten = await writeStoredText(AUTO_SAVE_BACKUP_KEY, storedBackup)
        if (!backupWritten) {
          throw new Error('写入自动保存失败')
        }

        await removeStoredText(LEGACY_AUTO_SAVE_TIME_KEY)
        await removeStoredText(LEGACY_AUTO_SAVE_HANDLED_TIME_KEY)

        lastSavedSignature = signature
        lastSaveTime.value = savedAt
        autoSaveBackup.value = buildBackupRecord(storedBackup, prepareWorkspaceData)
        return true
      } catch (err) {
        error('自动保存失败: ' + (err instanceof Error ? err.message : String(err)))
        return false
      }
    }

    const queuedSave = autoSaveQueue.then(saveOperation, saveOperation)
    autoSaveQueue = queuedSave.then(() => undefined, () => undefined)
    return queuedSave
  }

  // 监听完整工作区签名；Vue 会将同一轮同步修改合并成一次逻辑变更。
  const startAutoSave = () => {
    if (stopAutoSaveWatcher) {
      stopAutoSaveWatcher()
    }

    stopAutoSaveWatcher = watch(
      () => {
        const json = getWorkspaceJson()
        return json ? createAutoSaveSignature(json) : null
      },
      (signature, previousSignature) => {
        if (!signature || signature === previousSignature) return
        void performAutoSave()
      }
    )

    isAutoSaveEnabled.value = true
  }

  const stopAutoSave = () => {
    if (stopAutoSaveWatcher) {
      stopAutoSaveWatcher()
      stopAutoSaveWatcher = null
    }
    isAutoSaveEnabled.value = false
  }

  const flushAutoSave = () => autoSaveQueue

  // 恢复自动保存的数据
  const getAutoSaveBackup = async () => {
    isAutoSaveBackupLoading.value = true
    try {
      const backup = await readStoredText(AUTO_SAVE_BACKUP_KEY)
      const legacyTime = await readStoredText(LEGACY_AUTO_SAVE_TIME_KEY)

      const record = buildBackupRecord(backup, prepareWorkspaceData, legacyTime)
      autoSaveBackup.value = record
      lastSavedSignature = record
        ? createAutoSaveSignature(JSON.stringify(record.data))
        : null
      return record
    } catch (error) {
      console.error('Failed to get auto save backup:', error)
      autoSaveBackup.value = null
    } finally {
      isAutoSaveBackupLoading.value = false
    }
    return null
  }

  const restoreAutoSaveBackup = async (backup: AutoSaveBackup | null = autoSaveBackup.value) => {
    if (!backup?.data) return false

    const isSuccess = await applyWorkspaceData(backup.data)
    if (!isSuccess) return false

    saveLastWorkspace({
      type: 'autosave',
      name: '自动保存',
      time: backup.timeIso
    })
    return true
  }

  const clearAutoSaveBackup = async () => {
    await flushAutoSave()
    await removeStoredText(AUTO_SAVE_BACKUP_KEY)
    await removeStoredText(LEGACY_AUTO_SAVE_TIME_KEY)
    await removeStoredText(LEGACY_AUTO_SAVE_HANDLED_TIME_KEY)
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
    flushAutoSave,
    getAutoSaveBackup,
    restoreAutoSaveBackup,
    clearAutoSaveBackup
  }
}
