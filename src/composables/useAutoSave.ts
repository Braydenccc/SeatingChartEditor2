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
  slot: AutoSaveBackupSlot
  snapshotId: string
}

export type AutoSaveBackupSlot = 'current' | 'recovery-pending'

export interface GetAutoSaveBackupOptions {
  preserveCurrentAsRecovery?: boolean
}

const AUTO_SAVE_BACKUP_KEY = 'sce-autosave-backup'
const AUTO_SAVE_RECOVERY_KEY = 'sce-autosave-recovery-pending'
const LEGACY_AUTO_SAVE_TIME_KEY = 'sce-autosave-time'
const LEGACY_AUTO_SAVE_HANDLED_TIME_KEY = 'sce-autosave-handled-time'
const AUTO_SAVE_RECORD_TYPE = 'sce-autosave'
const AUTO_SAVE_RECORD_VERSION = 2
const AUTO_SAVE_HANDLED_RECORD_TYPE = 'sce-autosave-handled'
const AUTO_SAVE_HANDLED_RECORD_VERSION = 1

let autoSaveSnapshotSequence = 0

let stopAutoSaveWatcher: WatchStopHandle | null = null
let autoSaveWriterPromise: Promise<void> | null = null
let lastSavedSignature: string | null = null
let activeAutoSaveSignature: string | null = null
let suppressedAutoSaveSignature: string | null = null
let autoSavePersistRevision = 0
let isAutoSaveBlockedByReadError = false
let autoSaveWriteBlockReason: 'read-error' | 'recovery-protection' | null = null
let isAutoSaveClearInProgress = false
let clearBaselineSignature: string | null = null
let pendingAutoSaveAfterClear: PreparedAutoSave | null = null
let autoSaveClearPromise: Promise<boolean> | null = null
let autoSaveStorageOperationTail: Promise<void> = Promise.resolve()
let autoSaveBackupLoadingCount = 0
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

interface StoredTextReadResult {
  value: string | null
  error: unknown | null
}

interface ParsedBackupSlot {
  record: AutoSaveBackup | null
  error: unknown | null
  exists: boolean
}

let pendingAutoSave: PendingAutoSave | null = null

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

const enqueueAutoSaveStorageOperation = <T>(operation: () => Promise<T>) => {
  const result = autoSaveStorageOperationTail.then(operation, operation)
  autoSaveStorageOperationTail = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

const enqueueAutoSaveRead = <T>(operation: () => Promise<T>) => {
  autoSaveBackupLoadingCount += 1
  isAutoSaveBackupLoading.value = true
  return enqueueAutoSaveStorageOperation(operation).finally(() => {
    autoSaveBackupLoadingCount = Math.max(0, autoSaveBackupLoadingCount - 1)
    isAutoSaveBackupLoading.value = autoSaveBackupLoadingCount > 0
  })
}

const readStoredTextResult = async (key: string): Promise<StoredTextReadResult> => {
  try {
    return { value: await readStoredText(key), error: null }
  } catch (error) {
    return { value: null, error }
  }
}

const buildBackupRecord = (
  storedBackup: string | null,
  prepareWorkspaceData: WorkspacePreparer,
  slot: AutoSaveBackupSlot,
  legacyTime: string | null = null
): AutoSaveBackup | null => {
  if (storedBackup === null) return null
  if (storedBackup.length === 0) {
    throw new Error('自动保存备份内容为空')
  }

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
  const snapshotId = isCurrentRecord && typeof parsed.snapshotId === 'string' && parsed.snapshotId
    ? parsed.snapshotId
    : `legacy-${timeIso}-${storedBackup.length}`

  return {
    data,
    time: parsedTime,
    timeIso,
    size: JSON.stringify(data).length,
    slot,
    snapshotId
  }
}

const parseBackupSlot = (
  stored: StoredTextReadResult,
  prepareWorkspaceData: WorkspacePreparer,
  slot: AutoSaveBackupSlot,
  legacyTime: string | null = null
): ParsedBackupSlot => {
  if (stored.error) {
    return { record: null, error: stored.error, exists: true }
  }
  if (stored.value === null) {
    return { record: null, error: null, exists: false }
  }

  try {
    return {
      record: buildBackupRecord(stored.value, prepareWorkspaceData, slot, legacyTime),
      error: null,
      exists: true
    }
  } catch (error) {
    return { record: null, error, exists: true }
  }
}

const getErrorDetail = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)

const createSnapshotId = (savedAtIso: string) => {
  autoSaveSnapshotSequence += 1
  return `${savedAtIso}-${autoSaveSnapshotSequence.toString(36)}`
}

const createStoredBackup = (
  workspace: Workspace,
  savedAtIso: string,
  snapshotId: string
) => JSON.stringify({
  type: AUTO_SAVE_RECORD_TYPE,
  version: AUTO_SAVE_RECORD_VERSION,
  snapshotId,
  savedAt: savedAtIso,
  workspace
})

const createStoredHandledMarker = (backup: AutoSaveBackup) => JSON.stringify({
  type: AUTO_SAVE_HANDLED_RECORD_TYPE,
  version: AUTO_SAVE_HANDLED_RECORD_VERSION,
  snapshotId: backup.snapshotId,
  handledAt: new Date().toISOString()
})

const isHandledMarkerForBackup = (storedMarker: string | null, backup: AutoSaveBackup) => {
  if (!storedMarker) return false

  try {
    const parsed: unknown = JSON.parse(storedMarker)
    if (
      isRecord(parsed) &&
      parsed.type === AUTO_SAVE_HANDLED_RECORD_TYPE &&
      typeof parsed.snapshotId === 'string'
    ) {
      return parsed.snapshotId === backup.snapshotId
    }
  } catch {
    // 旧版标记是未包裹 JSON 的 ISO 时间字符串。
  }

  const legacyHandledTime = new Date(storedMarker)
  return Number.isFinite(legacyHandledTime.getTime()) &&
    legacyHandledTime.toISOString() === backup.timeIso
}

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
      const snapshotId = createSnapshotId(savedAtIso)
      const storedBackup = createStoredBackup(payload.workspace, savedAtIso, snapshotId)
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
      const currentBackup: AutoSaveBackup = {
        data: payload.workspace,
        time: savedAt,
        timeIso: savedAtIso,
        size: payload.json.length,
        slot: 'current',
        snapshotId
      }
      if (autoSaveBackup.value?.slot !== 'recovery-pending') {
        autoSaveBackup.value = currentBackup
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

  const blockAutoSaveWrites = (
    reason: 'read-error' | 'recovery-protection' = 'read-error'
  ) => {
    isAutoSaveBlockedByReadError = true
    autoSaveWriteBlockReason = reason
    stopAutoSave()
    if (pendingAutoSave) {
      pendingAutoSave.waiters.forEach(resolve => resolve(false))
      pendingAutoSave = null
    }
  }

  const unlockAutoSaveWrites = () => {
    isAutoSaveBlockedByReadError = false
    autoSaveWriteBlockReason = null
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

  const readAutoSaveBackup = async (options: GetAutoSaveBackupOptions) => {
    const readStartRevision = autoSavePersistRevision
    const hadWriteInFlightAtStart = Boolean(activeAutoSaveSignature || pendingAutoSave || autoSaveWriterPromise)
    try {
      const [recoveryStored, currentStored, legacyTimeStored, handledStored] = await Promise.all([
        readStoredTextResult(AUTO_SAVE_RECOVERY_KEY),
        readStoredTextResult(AUTO_SAVE_BACKUP_KEY),
        readStoredTextResult(LEGACY_AUTO_SAVE_TIME_KEY),
        readStoredTextResult(LEGACY_AUTO_SAVE_HANDLED_TIME_KEY)
      ])

      const recoverySlot = parseBackupSlot(
        recoveryStored,
        prepareWorkspaceData,
        'recovery-pending'
      )
      const currentSlot = parseBackupSlot(
        currentStored,
        prepareWorkspaceData,
        'current',
        legacyTimeStored.value
      )
      let recoveryRecord = recoverySlot.record
      const currentRecord = currentSlot.record

      if (!recoveryRecord && !currentRecord) {
        const slotErrors = [recoverySlot.error, currentSlot.error].filter(Boolean)
        if (slotErrors.length > 0) {
          throw new Error(slotErrors.map(getErrorDetail).join('；'))
        }
      }

      if (recoverySlot.error && currentRecord) {
        console.warn(`受保护的自动保存恢复副本不可用，已保留并回退到当前快照：${getErrorDetail(recoverySlot.error)}`)
      }
      if (currentSlot.error && recoveryRecord) {
        console.warn(`当前自动保存快照不可用，已回退到受保护副本：${getErrorDetail(currentSlot.error)}`)
      }

      const currentWasHandled = Boolean(
        currentRecord && isHandledMarkerForBackup(handledStored.value, currentRecord)
      )

      if (
        options.preserveCurrentAsRecovery &&
        !recoveryRecord &&
        currentRecord &&
        !recoverySlot.exists &&
        !currentWasHandled
      ) {
        const protectedRecord = createStoredBackup(
          currentRecord.data,
          currentRecord.timeIso,
          currentRecord.snapshotId
        )
        const protectedWritten = await writeStoredText(AUTO_SAVE_RECOVERY_KEY, protectedRecord)
        if (!protectedWritten) {
          throw new Error('无法建立受保护的自动保存恢复副本')
        }
        recoveryRecord = {
          ...currentRecord,
          slot: 'recovery-pending'
        }
      }

      const record = recoveryRecord || currentRecord
      const mustKeepCurrentProtected = Boolean(
        options.preserveCurrentAsRecovery &&
        currentRecord &&
        !recoveryRecord &&
        recoverySlot.error
      )
      const loadedCurrentSignature = currentRecord
        ? prepareAutoSave(JSON.stringify(currentRecord.data)).signature
        : null
      const writeCompletedDuringRead = autoSavePersistRevision !== readStartRevision
      const hasWriteInFlightNow = Boolean(activeAutoSaveSignature || pendingAutoSave || autoSaveWriterPromise)

      if (!writeCompletedDuringRead || record?.slot === 'recovery-pending') {
        autoSaveBackup.value = record
      }
      if (!hadWriteInFlightAtStart && !hasWriteInFlightNow && !writeCompletedDuringRead) {
        lastSavedSignature = loadedCurrentSignature
      }
      if (mustKeepCurrentProtected) {
        // recovery 槽存在但不可读/不可解析时，current 是唯一可确认有效的快照。
        // 保留它供用户恢复，但在用户显式恢复/忽略损坏槽之前禁止自动保存覆盖 current。
        blockAutoSaveWrites('recovery-protection')
      } else if (
        autoSaveWriteBlockReason !== 'recovery-protection' ||
        (options.preserveCurrentAsRecovery && Boolean(recoveryRecord))
      ) {
        // 普通文件页读取不能绕过启动阶段的 recovery 保护锁；只有一次新的
        // 保护性读取已确认 recovery 有效，或显式处理流程完成后才允许解锁。
        unlockAutoSaveWrites()
      }
      if (
        options.preserveCurrentAsRecovery &&
        !recoveryRecord &&
        currentWasHandled &&
        !mustKeepCurrentProtected
      ) {
        return null
      }
      return writeCompletedDuringRead && record?.slot !== 'recovery-pending'
        ? autoSaveBackup.value
        : record
    } catch (cause) {
      blockAutoSaveWrites()
      autoSaveBackup.value = null
      const detail = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`无法读取自动保存备份：${detail}`)
    }
  }

  // 每个调用都保留自己的 options，并依次读取/迁移存储槽位，避免 App 与 Files
  // 启动钩子相互覆盖共享的恢复候选。
  const getAutoSaveBackup = (
    options: GetAutoSaveBackupOptions = {}
  ) => enqueueAutoSaveRead(() => readAutoSaveBackup(options))

  const consumeRecoveryCandidateUnsafe = async (backup: AutoSaveBackup) => {
    if (backup.slot !== 'recovery-pending') return true

    try {
      const storedRecovery = await readStoredTextResult(AUTO_SAVE_RECOVERY_KEY)
      const recoverySlot = parseBackupSlot(
        storedRecovery,
        prepareWorkspaceData,
        'recovery-pending'
      )
      if (recoverySlot.error) {
        error('清理自动保存恢复副本失败: ' + getErrorDetail(recoverySlot.error))
        return false
      }
      const currentRecovery = recoverySlot.record
      if (!currentRecovery) {
        if (autoSaveBackup.value?.snapshotId === backup.snapshotId) {
          autoSaveBackup.value = null
        }
        return true
      }
      if (currentRecovery.snapshotId !== backup.snapshotId) return false

      const removed = await removeStoredText(AUTO_SAVE_RECOVERY_KEY)
      if (!removed) {
        error('受保护的自动保存恢复副本未能清理')
        return false
      }
      if (
        autoSaveBackup.value?.slot === 'recovery-pending' &&
        autoSaveBackup.value.snapshotId === backup.snapshotId
      ) {
        autoSaveBackup.value = null
      }
      return true
    } catch (err) {
      error('清理自动保存恢复副本失败: ' + (err instanceof Error ? err.message : String(err)))
      return false
    }
  }

  const consumeRecoveryCandidate = (backup: AutoSaveBackup) => (
    enqueueAutoSaveStorageOperation(() => consumeRecoveryCandidateUnsafe(backup))
  )

  const establishRecoveryProtectionUnsafe = async (backup: AutoSaveBackup) => {
    const [storedCurrent, legacyTime] = await Promise.all([
      readStoredTextResult(AUTO_SAVE_BACKUP_KEY),
      readStoredTextResult(LEGACY_AUTO_SAVE_TIME_KEY)
    ])
    const currentSlot = parseBackupSlot(
      storedCurrent,
      prepareWorkspaceData,
      'current',
      legacyTime.value
    )
    if (currentSlot.error) throw currentSlot.error
    if (currentSlot.record?.snapshotId !== backup.snapshotId) {
      throw new Error('当前自动保存快照已变化，无法建立受保护副本')
    }

    const protectedWritten = await writeStoredText(
      AUTO_SAVE_RECOVERY_KEY,
      createStoredBackup(backup.data, backup.timeIso, backup.snapshotId)
    )
    if (!protectedWritten) throw new Error('无法建立受保护的自动保存恢复副本')

    const protectedBackup: AutoSaveBackup = {
      ...backup,
      slot: 'recovery-pending'
    }
    autoSaveBackup.value = protectedBackup
    unlockAutoSaveWrites()
    startAutoSave()
    return protectedBackup
  }

  const establishRecoveryProtection = (backup: AutoSaveBackup) => (
    enqueueAutoSaveStorageOperation(() => establishRecoveryProtectionUnsafe(backup))
  )

  const persistAndVerifyRestoredCurrent = async (): Promise<AutoSaveBackup | null> => {
    try {
      const json = getWorkspaceJson()
      if (!json) throw new Error('恢复后的工作区无法序列化')
      const restored = prepareAutoSave(json)

      if (autoSaveClearPromise) await autoSaveClearPromise
      await queueAutoSave(restored, persistAutoSave)
      await flushPendingAutoSave()

      return await enqueueAutoSaveStorageOperation(async () => {
        const [storedCurrent, legacyTime] = await Promise.all([
          readStoredTextResult(AUTO_SAVE_BACKUP_KEY),
          readStoredTextResult(LEGACY_AUTO_SAVE_TIME_KEY)
        ])
        const currentSlot = parseBackupSlot(
          storedCurrent,
          prepareWorkspaceData,
          'current',
          legacyTime.value
        )
        if (!currentSlot.record) {
          if (currentSlot.error) {
            throw currentSlot.error
          }
          throw new Error('恢复后的当前快照不存在')
        }

        const persistedSignature = prepareAutoSave(
          JSON.stringify(currentSlot.record.data)
        ).signature
        if (persistedSignature !== restored.signature) {
          error('自动保存恢复成功，但读回的当前快照与恢复结果不一致')
          return null
        }
        return currentSlot.record
      })
    } catch (cause) {
      error('自动保存恢复成功，但恢复后的当前快照未能持久化并校验: ' + getErrorDetail(cause))
      return null
    }
  }

  const markBackupHandled = (backup: AutoSaveBackup) => (
    enqueueAutoSaveStorageOperation(async () => {
      const markerWritten = await writeStoredText(
        LEGACY_AUTO_SAVE_HANDLED_TIME_KEY,
        createStoredHandledMarker(backup)
      )
      if (!markerWritten) {
        error('无法记录已处理的自动保存快照')
      }
      return markerWritten
    })
  )

  const ensureValidCurrentBeforeRecoveryDiscardUnsafe = async (backup: AutoSaveBackup) => {
    const [storedCurrent, legacyTime] = await Promise.all([
      readStoredTextResult(AUTO_SAVE_BACKUP_KEY),
      readStoredTextResult(LEGACY_AUTO_SAVE_TIME_KEY)
    ])
    if (storedCurrent.error) throw storedCurrent.error

    const currentSlot = parseBackupSlot(
      storedCurrent,
      prepareWorkspaceData,
      'current',
      legacyTime.value
    )
    if (currentSlot.record) return currentSlot.record

    const currentWritten = await writeStoredText(
      AUTO_SAVE_BACKUP_KEY,
      createStoredBackup(backup.data, backup.timeIso, backup.snapshotId)
    )
    if (!currentWritten) throw new Error('无法用有效恢复副本修复当前自动保存快照')

    const verifiedCurrent = await readStoredTextResult(AUTO_SAVE_BACKUP_KEY)
    const verifiedSlot = parseBackupSlot(
      verifiedCurrent,
      prepareWorkspaceData,
      'current',
      legacyTime.value
    )
    if (verifiedSlot.error) throw verifiedSlot.error
    if (verifiedSlot.record?.snapshotId !== backup.snapshotId) {
      throw new Error('修复后的当前自动保存快照校验失败')
    }

    lastSavedSignature = prepareAutoSave(JSON.stringify(backup.data)).signature
    autoSavePersistRevision += 1
    lastSaveTime.value = backup.time
    return verifiedSlot.record
  }

  const restoreAutoSaveBackup = async (backup: AutoSaveBackup | null = autoSaveBackup.value) => {
    if (!backup?.data) return false
    const requiresProtectionRepair = backup.slot === 'current' &&
      autoSaveWriteBlockReason === 'recovery-protection'

    const isSuccess = await applyWorkspaceData(backup.data)
    if (!isSuccess) return false

    saveLastWorkspace({
      type: 'autosave',
      name: '自动保存',
      time: backup.timeIso
    })

    if (requiresProtectionRepair) {
      try {
        const protectedBackup = await establishRecoveryProtection(backup)
        const markerWritten = await markBackupHandled(backup)
        if (!markerWritten) {
          error('已保留受保护的自动保存恢复副本')
          return true
        }
        const consumed = await consumeRecoveryCandidate(protectedBackup)
        if (!consumed) {
          error('自动保存已恢复，但受保护的恢复副本未能消费并将继续保留')
        }
      } catch (cause) {
        error('自动保存已恢复，但损坏的受保护槽仍未处理，自动保存继续暂停: ' + getErrorDetail(cause))
      }
    } else if (backup.slot === 'current') {
      const persistedCurrent = await persistAndVerifyRestoredCurrent()
      if (!persistedCurrent) {
        error('自动保存已恢复，但当前快照未能确认，后续启动仍会提示')
        return true
      }
      await markBackupHandled(persistedCurrent)
    }

    if (backup.slot === 'recovery-pending') {
      const persistedCurrent = await persistAndVerifyRestoredCurrent()
      if (!persistedCurrent) {
        error('已保留受保护的自动保存恢复副本')
        return true
      }

      const markerWritten = await markBackupHandled(persistedCurrent)
      if (!markerWritten) {
        error('已保留受保护的自动保存恢复副本')
        return true
      }

      const consumed = await consumeRecoveryCandidate(backup)
      if (!consumed) {
        error('自动保存已恢复，但受保护的恢复副本未能消费并将继续保留')
      }
    }
    return true
  }

  const discardAutoSaveRecovery = async () => {
    const backup = autoSaveBackup.value
    if (!backup) return true

    await flushPendingAutoSave()
    return enqueueAutoSaveStorageOperation(async () => {
      if (backup.slot === 'current' && autoSaveWriteBlockReason === 'recovery-protection') {
        const [storedRecovery, storedCurrent, legacyTime] = await Promise.all([
          readStoredTextResult(AUTO_SAVE_RECOVERY_KEY),
          readStoredTextResult(AUTO_SAVE_BACKUP_KEY),
          readStoredTextResult(LEGACY_AUTO_SAVE_TIME_KEY)
        ])
        const currentSlot = parseBackupSlot(
          storedCurrent,
          prepareWorkspaceData,
          'current',
          legacyTime.value
        )
        if (currentSlot.error) {
          error('忽略自动保存失败: ' + getErrorDetail(currentSlot.error))
          return false
        }
        if (currentSlot.record?.snapshotId !== backup.snapshotId) return false

        const recoverySlot = parseBackupSlot(
          storedRecovery,
          prepareWorkspaceData,
          'recovery-pending'
        )
        if (
          recoverySlot.record &&
          recoverySlot.record.snapshotId !== backup.snapshotId
        ) return false

        const markerWritten = await writeStoredText(
          LEGACY_AUTO_SAVE_HANDLED_TIME_KEY,
          createStoredHandledMarker(backup)
        )
        if (!markerWritten) {
          error('无法记录已忽略的自动保存快照')
          return false
        }
        const recoveryRemoved = await removeStoredText(AUTO_SAVE_RECOVERY_KEY)
        if (!recoveryRemoved) {
          error('损坏的受保护自动保存槽未能清理')
          return false
        }

        autoSaveBackup.value = null
        unlockAutoSaveWrites()
        startAutoSave()
        return true
      }

      if (backup.slot !== 'recovery-pending') return true

      const storedRecovery = await readStoredTextResult(AUTO_SAVE_RECOVERY_KEY)
      const recoverySlot = parseBackupSlot(
        storedRecovery,
        prepareWorkspaceData,
        'recovery-pending'
      )
      if (recoverySlot.error) {
        error('忽略自动保存恢复副本失败: ' + getErrorDetail(recoverySlot.error))
        return false
      }
      if (recoverySlot.record?.snapshotId !== backup.snapshotId) {
        if (recoverySlot.record) return false
      }

      try {
        await ensureValidCurrentBeforeRecoveryDiscardUnsafe(backup)
      } catch (cause) {
        error('忽略自动保存失败，已保留唯一有效的恢复副本: ' + getErrorDetail(cause))
        return false
      }

      const markerWritten = await writeStoredText(
        LEGACY_AUTO_SAVE_HANDLED_TIME_KEY,
        createStoredHandledMarker(backup)
      )
      if (!markerWritten) {
        error('无法记录已忽略的自动保存恢复副本')
        return false
      }

      return consumeRecoveryCandidateUnsafe(backup)
    })
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
      await enqueueAutoSaveStorageOperation(async () => {
        const backupRemoved = await removeStoredText(AUTO_SAVE_BACKUP_KEY)
        if (!backupRemoved) {
          error('清理自动保存失败，请检查应用数据目录是否可写')
          return
        }

        // current 已删除后必须允许失败重放；不能继续沿用旧的落盘签名。
        lastSavedSignature = null
        autoSavePersistRevision += 1

        const legacyTimeRemoved = await removeStoredText(LEGACY_AUTO_SAVE_TIME_KEY)
        const handledMarkerRemoved = await removeStoredText(LEGACY_AUTO_SAVE_HANDLED_TIME_KEY)
        if (!legacyTimeRemoved || !handledMarkerRemoved) {
          console.warn('自动保存备份已清理，但旧版时间或已处理标记清理失败')
        }

        // recovery 必须最后删除；current 删除失败时绝不能触碰它。
        const recoveryRemoved = await removeStoredText(AUTO_SAVE_RECOVERY_KEY)
        if (!recoveryRemoved) {
          error('清理自动保存失败，受保护的恢复副本仍会保留')
          return
        }

        removed = true
        autoSaveBackup.value = null
        unlockAutoSaveWrites()
      })

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
    } catch (cause) {
      error('清理自动保存失败: ' + getErrorDetail(cause))
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
    discardAutoSaveRecovery,
    clearAutoSaveBackup
  }
}
