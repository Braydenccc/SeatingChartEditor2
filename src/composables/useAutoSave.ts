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
let autoSaveWriterPromise: Promise<void> | null = null
let lastSavedSignature: string | null = null
let activeAutoSaveSignature: string | null = null
let suppressedAutoSaveSignature: string | null = null
let autoSavePersistRevision = 0
let isAutoSaveBlockedByReadError = false
let isAutoSaveClearInProgress = false
let clearBaselineSignature: string | null = null
let pendingAutoSaveAfterClear: PreparedAutoSave | null = null
let autoSaveClearPromise: Promise<boolean> | null = null
const isAutoSaveEnabled = ref(false)
const lastSaveTime = ref<Date | null>(null)
const autoSaveBackup = ref<AutoSaveBackup | null>(null)
const isAutoSaveBackupLoading = ref(false)

type WorkspacePreparer = (workspaceRaw: unknown) => Workspace

interface PreparedAutoSave {
  json: string
  signature: string
  workspace: Workspace
}

interface PendingAutoSave {
  payload: PreparedAutoSave
  persist: (payload: PreparedAutoSave) => Promise<boolean>
  waiters: Array<(saved: boolean) => void>
}

let pendingAutoSave: PendingAutoSave | null = null

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
  if (typeof time !== 'string' || !time) {
    throw new Error('自动保存备份缺少有效的保存时间')
  }
  const data = prepareWorkspaceData(rawData)

  const parsedTime = new Date(time)
  if (!Number.isFinite(parsedTime.getTime())) {
    throw new Error('自动保存备份的保存时间格式无效')
  }
  const timeIso = parsedTime.toISOString()

  return {
    data,
    time: parsedTime,
    timeIso,
    size: JSON.stringify(data).length
  }
}

const createStoredBackup = (workspace: Workspace, savedAtIso: string) => JSON.stringify({
  type: AUTO_SAVE_RECORD_TYPE,
  version: AUTO_SAVE_RECORD_VERSION,
  savedAt: savedAtIso,
  workspace
})

const prepareAutoSave = (json: string): PreparedAutoSave => {
  const parsed: unknown = JSON.parse(json)
  if (!isRecord(parsed)) {
    throw new Error('工作区自动保存数据必须是对象')
  }

  const workspace = parsed as unknown as Workspace
  const signatureSource: Record<string, unknown> = { ...parsed }
  if (isRecord(parsed.meta)) {
    const meta = { ...parsed.meta }
    delete meta.createdAt
    signatureSource.meta = meta
  }

  return {
    json,
    signature: JSON.stringify(signatureSource),
    workspace
  }
}

const runAutoSaveWriter = () => {
  if (autoSaveWriterPromise) return autoSaveWriterPromise

  autoSaveWriterPromise = (async () => {
    while (pendingAutoSave) {
      const request = pendingAutoSave
      pendingAutoSave = null
      activeAutoSaveSignature = request.payload.signature
      let saved = false
      try {
        saved = await request.persist(request.payload)
      } catch {
        saved = false
      } finally {
        activeAutoSaveSignature = null
      }
      request.waiters.forEach(resolve => resolve(saved))
    }
  })().finally(() => {
    autoSaveWriterPromise = null
    if (pendingAutoSave) void runAutoSaveWriter()
  })

  return autoSaveWriterPromise
}

const enqueueAutoSave = (
  payload: PreparedAutoSave,
  persist: PendingAutoSave['persist']
) => new Promise<boolean>(resolve => {
  const supersededWaiters = pendingAutoSave?.waiters || []
  pendingAutoSave = {
    payload,
    persist,
    waiters: [...supersededWaiters, resolve]
  }
  void runAutoSaveWriter()
})

const queueAutoSave = (
  payload: PreparedAutoSave,
  persist: PendingAutoSave['persist']
) => {
  if (isAutoSaveBlockedByReadError) return Promise.resolve(false)

  if (isAutoSaveClearInProgress) {
    pendingAutoSaveAfterClear = payload.signature === clearBaselineSignature ? null : payload
    return Promise.resolve(false)
  }

  if (
    payload.signature === suppressedAutoSaveSignature &&
    !activeAutoSaveSignature &&
    !pendingAutoSave
  ) {
    return Promise.resolve(false)
  }
  if (payload.signature !== suppressedAutoSaveSignature) suppressedAutoSaveSignature = null

  if (payload.signature === pendingAutoSave?.payload.signature) return Promise.resolve(false)
  if (payload.signature === activeAutoSaveSignature && !pendingAutoSave) return Promise.resolve(false)

  // 队列稳定时可跳过已落盘快照；但若 B 正在写入，即使用户撤回到已保存的 A，
  // 也必须把尾部 A 入队，否则 B 会最终覆盖磁盘上的 A。
  if (!activeAutoSaveSignature && !pendingAutoSave && payload.signature === lastSavedSignature) {
    return Promise.resolve(false)
  }

  return enqueueAutoSave(payload, persist)
}

const flushPendingAutoSave = async () => {
  while (autoSaveWriterPromise) {
    await autoSaveWriterPromise
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

  const persistAutoSave = async (payload: PreparedAutoSave) => {
    if (isAutoSaveBlockedByReadError) return false
    if (lastSavedSignature !== null && payload.signature === lastSavedSignature) return false

    try {
      const savedAt = new Date()
      const savedAtIso = savedAt.toISOString()
      const storedBackup = createStoredBackup(payload.workspace, savedAtIso)
      const backupWritten = await writeStoredText(AUTO_SAVE_BACKUP_KEY, storedBackup)
      if (!backupWritten) {
        throw new Error('写入自动保存失败')
      }

      const legacyCleanupResults = await Promise.all([
        removeStoredText(LEGACY_AUTO_SAVE_TIME_KEY),
        removeStoredText(LEGACY_AUTO_SAVE_HANDLED_TIME_KEY)
      ])
      if (legacyCleanupResults.some(result => !result)) {
        console.warn('自动保存已完成，但旧版自动保存标记清理失败')
      }

      lastSavedSignature = payload.signature
      autoSavePersistRevision += 1
      lastSaveTime.value = savedAt
      autoSaveBackup.value = {
        data: payload.workspace,
        time: savedAt,
        timeIso: savedAtIso,
        size: payload.json.length
      }
      return true
    } catch (err) {
      error('自动保存失败: ' + (err instanceof Error ? err.message : String(err)))
      return false
    }
  }

  const performAutoSave = (workspaceJson: string | null = null) => {
    try {
      const json = workspaceJson || getWorkspaceJson()
      if (!json) return Promise.resolve(false)
      return queueAutoSave(prepareAutoSave(json), persistAutoSave)
    } catch (err) {
      error('自动保存失败: ' + (err instanceof Error ? err.message : String(err)))
      return Promise.resolve(false)
    }
  }

  // 监听完整工作区签名；Vue 会将同一轮同步修改合并成一次逻辑变更。
  const startAutoSave = () => {
    if (stopAutoSaveWatcher) {
      stopAutoSaveWatcher()
    }

    if (isAutoSaveBlockedByReadError) {
      stopAutoSaveWatcher = null
      isAutoSaveEnabled.value = false
      return false
    }

    stopAutoSaveWatcher = watch(
      () => {
        const json = getWorkspaceJson()
        if (!json) return null
        try {
          return prepareAutoSave(json)
        } catch (err) {
          error('自动保存失败: ' + (err instanceof Error ? err.message : String(err)))
          return null
        }
      },
      (payload, previousPayload) => {
        if (!payload || payload.signature === previousPayload?.signature) return
        void queueAutoSave(payload, persistAutoSave)
      }
    )

    isAutoSaveEnabled.value = true
    return true
  }

  const stopAutoSave = () => {
    if (stopAutoSaveWatcher) {
      stopAutoSaveWatcher()
      stopAutoSaveWatcher = null
    }
    isAutoSaveEnabled.value = false
  }

  const flushAutoSave = async () => {
    // 外部 pagehide/visibilitychange 在 clear 删除阶段触发时，必须等待
    // clear 及其删除后重放完成。clear 内部只调用 flushPendingAutoSave，避免自等待。
    const clearPromise = autoSaveClearPromise
    if (clearPromise) await clearPromise

    // pagehide/visibilitychange 可能早于 Vue 默认 watcher 的异步回调。
    // 先在当前调用栈抓取并入队最新工作区，再等待写入队列稳定。
    if (isAutoSaveEnabled.value) {
      try {
        const json = getWorkspaceJson()
        if (json) void queueAutoSave(prepareAutoSave(json), persistAutoSave)
      } catch (err) {
        error('自动保存失败: ' + (err instanceof Error ? err.message : String(err)))
      }
    }
    await flushPendingAutoSave()
  }

  // 恢复自动保存的数据
  const getAutoSaveBackup = async () => {
    const readStartRevision = autoSavePersistRevision
    const hadWriteInFlightAtStart = Boolean(activeAutoSaveSignature || pendingAutoSave || autoSaveWriterPromise)
    isAutoSaveBackupLoading.value = true
    try {
      const backup = await readStoredText(AUTO_SAVE_BACKUP_KEY)
      const legacyTime = await readStoredText(LEGACY_AUTO_SAVE_TIME_KEY)

      const record = buildBackupRecord(backup, prepareWorkspaceData, legacyTime)
      const loadedSignature = record
        ? prepareAutoSave(JSON.stringify(record.data)).signature
        : null
      const writeCompletedDuringRead = autoSavePersistRevision !== readStartRevision
      const hasWriteInFlightNow = Boolean(activeAutoSaveSignature || pendingAutoSave || autoSaveWriterPromise)

      if (!writeCompletedDuringRead) autoSaveBackup.value = record
      if (!hadWriteInFlightAtStart && !hasWriteInFlightNow && !writeCompletedDuringRead) {
        lastSavedSignature = loadedSignature
      }
      isAutoSaveBlockedByReadError = false
      return writeCompletedDuringRead ? autoSaveBackup.value : record
    } catch (cause) {
      isAutoSaveBlockedByReadError = true
      stopAutoSave()
      if (pendingAutoSave) {
        pendingAutoSave.waiters.forEach(resolve => resolve(false))
        pendingAutoSave = null
      }
      autoSaveBackup.value = null
      const detail = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`无法读取自动保存备份：${detail}`)
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

  const runClearAutoSaveBackup = async () => {
    let baseline: PreparedAutoSave | null = null
    try {
      const json = getWorkspaceJson()
      if (json) baseline = prepareAutoSave(json)
    } catch (err) {
      error('自动保存失败: ' + (err instanceof Error ? err.message : String(err)))
    }

    isAutoSaveClearInProgress = true
    clearBaselineSignature = baseline?.signature || null
    pendingAutoSaveAfterClear = null

    let removed = false
    try {
      // 先等待 clear 前已入队的 writer，再执行删除。clear 期间的新快照由
      // queueAutoSave 暂存，不允许与 remove 并发写入。
      await flushPendingAutoSave()
      const [backupRemoved, legacyTimeRemoved, legacyHandledTimeRemoved] = await Promise.all([
        removeStoredText(AUTO_SAVE_BACKUP_KEY),
        removeStoredText(LEGACY_AUTO_SAVE_TIME_KEY),
        removeStoredText(LEGACY_AUTO_SAVE_HANDLED_TIME_KEY)
      ])
      removed = backupRemoved
      if (!backupRemoved) {
        error('清理自动保存失败，请检查应用数据目录是否可写')
      } else {
        autoSaveBackup.value = null
        lastSavedSignature = null
        autoSavePersistRevision += 1
        isAutoSaveBlockedByReadError = false
        if (!legacyTimeRemoved || !legacyHandledTimeRemoved) {
          console.warn('自动保存备份已清理，但旧版自动保存标记清理失败')
        }
      }

      // watcher 可能还没有回调，因此在 remove 后再同步捕获一次当前工作区。
      // 只有相对 clear 起点真正发生了变化，才在删除后重放最新快照。
      try {
        const currentJson = getWorkspaceJson()
        if (currentJson) {
          const current = prepareAutoSave(currentJson)
          pendingAutoSaveAfterClear = current.signature === clearBaselineSignature ? null : current
        }
      } catch (err) {
        error('自动保存失败: ' + (err instanceof Error ? err.message : String(err)))
      }
    } finally {
      // 删除失败时磁盘仍保留旧快照，不能像成功清理一样抑制
      // clear 起点状态。即使 watcher 尚未回调，也要重新入队当前基线。
      const replay = pendingAutoSaveAfterClear || (!removed ? baseline : null)
      pendingAutoSaveAfterClear = null
      isAutoSaveClearInProgress = false
      suppressedAutoSaveSignature = removed && isAutoSaveEnabled.value
        ? clearBaselineSignature
        : null
      clearBaselineSignature = null

      if (replay && isAutoSaveEnabled.value) {
        await queueAutoSave(replay, persistAutoSave)
        await flushPendingAutoSave()
      }
    }

    return removed
  }

  const clearAutoSaveBackup = () => {
    if (autoSaveClearPromise) return autoSaveClearPromise
    autoSaveClearPromise = runClearAutoSaveBackup().finally(() => {
      autoSaveClearPromise = null
    })
    return autoSaveClearPromise
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
