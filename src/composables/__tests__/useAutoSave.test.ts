import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { requireDefined } from '@/test-utils/testHelpers'

const workspaceJson = ref('')

const mocks = vi.hoisted(() => ({
  storage: new Map(),
  getWorkspaceJson: vi.fn(),
  prepareWorkspaceData: vi.fn(),
  applyWorkspaceData: vi.fn(),
  saveLastWorkspace: vi.fn(),
  loggerError: vi.fn(),
  readStoredText: vi.fn(async (key) => mocks.storage.get(key) ?? null),
  writeStoredText: vi.fn(async (key, value) => {
    mocks.storage.set(key, value)
    return true
  }),
  removeStoredText: vi.fn(async (key) => {
    mocks.storage.delete(key)
    return true
  })
}))

vi.mock('@/platform/nativeStorage', () => ({
  readStoredText: mocks.readStoredText,
  writeStoredText: mocks.writeStoredText,
  removeStoredText: mocks.removeStoredText
}))

vi.mock('../useWorkspace', () => ({
  useWorkspace: () => ({
    getWorkspaceJson: mocks.getWorkspaceJson,
    prepareWorkspaceData: mocks.prepareWorkspaceData,
    applyWorkspaceData: mocks.applyWorkspaceData,
    saveLastWorkspace: mocks.saveLastWorkspace
  })
}))

vi.mock('../useLogger', () => ({
  useLogger: () => ({
    error: mocks.loggerError
  })
}))

import { useAutoSave } from '../useAutoSave'

const createWorkspaceJson = (
  createdAt = '2026-01-01T00:00:00.000Z',
  studentName = '张三'
) => JSON.stringify({
  meta: {
    version: '2.2',
    app: 'SeatingChartEditor',
    createdAt
  },
  students: [
    { id: 1, name: studentName, studentNumber: '1', tags: [] }
  ],
  tags: [],
  layout: {
    config: {},
    seats: [
      { id: 'seat-0-0-0', studentId: 1, empty: false }
    ]
  },
  zones: [],
  rules: [],
  exportSettings: {}
})

const deferredWrite = () => {
  let complete: (() => void) | undefined
  return {
    implementation: (key: string, value: string) => new Promise<boolean>((resolve) => {
      complete = () => {
        mocks.storage.set(key, value)
        resolve(true)
      }
    }),
    release: () => requireDefined(complete)()
  }
}

describe('useAutoSave', () => {
  beforeEach(async () => {
    const autoSave = useAutoSave()
    autoSave.stopAutoSave()
    mocks.storage.clear()
    mocks.readStoredText.mockReset()
    mocks.readStoredText.mockImplementation(async (key) => mocks.storage.get(key) ?? null)
    mocks.writeStoredText.mockReset()
    mocks.writeStoredText.mockImplementation(async (key, value) => {
      mocks.storage.set(key, value)
      return true
    })
    mocks.removeStoredText.mockReset()
    mocks.removeStoredText.mockImplementation(async (key) => {
      mocks.storage.delete(key)
      return true
    })
    workspaceJson.value = createWorkspaceJson()
    mocks.getWorkspaceJson.mockReset()
    mocks.getWorkspaceJson.mockImplementation(() => workspaceJson.value)
    mocks.prepareWorkspaceData.mockReset()
    mocks.prepareWorkspaceData.mockImplementation(value => value)
    mocks.applyWorkspaceData.mockReset()
    mocks.applyWorkspaceData.mockResolvedValue(true)
    mocks.saveLastWorkspace.mockReset()
    mocks.loggerError.mockReset()
    await autoSave.clearAutoSaveBackup()
    mocks.readStoredText.mockClear()
    mocks.writeStoredText.mockClear()
    mocks.removeStoredText.mockClear()
  })

  it('loads a legacy autosave backup on every startup check', async () => {
    const autoSave = useAutoSave()
    const time = '2026-07-05T08:00:00.000Z'
    mocks.storage.set('sce-autosave-backup', createWorkspaceJson())
    mocks.storage.set('sce-autosave-time', time)
    mocks.storage.set('sce-autosave-handled-time', time)

    const firstBackup = requireDefined(await autoSave.getAutoSaveBackup())
    const secondBackup = requireDefined(await autoSave.getAutoSaveBackup())

    expect(firstBackup.data.students).toHaveLength(1)
    expect(firstBackup.timeIso).toBe(time)
    expect(secondBackup.timeIso).toBe(time)
    expect(mocks.prepareWorkspaceData).toHaveBeenCalledWith(expect.objectContaining({
      layout: expect.any(Object)
    }))
  })

  it('protects a legacy current snapshot before autosave can advance the current slot', async () => {
    const autoSave = useAutoSave()
    const time = '2026-07-05T08:00:00.000Z'
    mocks.storage.set('sce-autosave-backup', createWorkspaceJson(time, '张三'))
    mocks.storage.set('sce-autosave-time', time)

    const protectedBackup = requireDefined(await autoSave.getAutoSaveBackup({
      preserveCurrentAsRecovery: true
    }))

    expect(protectedBackup.slot).toBe('recovery-pending')
    expect(protectedBackup.snapshotId).toBeTruthy()
    expect(JSON.parse(mocks.storage.get('sce-autosave-recovery-pending'))).toMatchObject({
      type: 'sce-autosave',
      version: 2,
      snapshotId: protectedBackup.snapshotId,
      workspace: {
        students: [{ name: '张三' }]
      }
    })

    expect(autoSave.startAutoSave()).toBe(true)
    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await nextTick()
    await autoSave.flushAutoSave()

    expect(JSON.parse(mocks.storage.get('sce-autosave-backup')).workspace.students[0].name).toBe('李四')
    expect(JSON.parse(mocks.storage.get('sce-autosave-recovery-pending')).workspace.students[0].name).toBe('张三')
    expect(autoSave.autoSaveBackup.value?.slot).toBe('recovery-pending')
    expect(autoSave.autoSaveBackup.value?.data.students[0]?.name).toBe('张三')
  })

  it('keeps the protected recovery slot intact when a later current write fails', async () => {
    const autoSave = useAutoSave()
    const time = '2026-07-05T08:00:00.000Z'
    mocks.storage.set('sce-autosave-backup', createWorkspaceJson(time, '张三'))
    mocks.storage.set('sce-autosave-time', time)
    await autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true })
    const protectedRecord = mocks.storage.get('sce-autosave-recovery-pending')

    mocks.writeStoredText.mockResolvedValueOnce(false)
    await expect(autoSave.performAutoSave(
      createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    )).resolves.toBe(false)

    expect(mocks.storage.get('sce-autosave-recovery-pending')).toBe(protectedRecord)
    expect(autoSave.autoSaveBackup.value?.data.students[0]?.name).toBe('张三')
  })

  it('blocks autosave when the startup snapshot cannot be copied into the protected slot', async () => {
    const autoSave = useAutoSave()
    const time = '2026-07-05T08:00:00.000Z'
    const legacySnapshot = createWorkspaceJson(time, '张三')
    mocks.storage.set('sce-autosave-backup', legacySnapshot)
    mocks.storage.set('sce-autosave-time', time)
    mocks.writeStoredText.mockResolvedValueOnce(false)

    await expect(autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true }))
      .rejects.toThrow('无法建立受保护的自动保存恢复副本')

    expect(autoSave.startAutoSave()).toBe(false)
    expect(mocks.storage.get('sce-autosave-backup')).toBe(legacySnapshot)
  })

  it('distinguishes storage read failures from a missing backup', async () => {
    const autoSave = useAutoSave()
    mocks.readStoredText.mockRejectedValueOnce(new Error('permission denied'))

    await expect(autoSave.getAutoSaveBackup())
      .rejects.toThrow('无法读取自动保存备份：permission denied')

    expect(autoSave.autoSaveBackup.value).toBeNull()
    expect(autoSave.isAutoSaveBackupLoading.value).toBe(false)
  })

  it('stops active autosave after a backup read failure', async () => {
    const autoSave = useAutoSave()
    autoSave.startAutoSave()
    mocks.readStoredText.mockRejectedValueOnce(new Error('permission denied'))

    await expect(autoSave.getAutoSaveBackup()).rejects.toThrow('permission denied')
    expect(autoSave.isAutoSaveEnabled.value).toBe(false)

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await nextTick()
    await autoSave.flushAutoSave()
    expect(mocks.writeStoredText).not.toHaveBeenCalled()
  })

  it('reports malformed backup records instead of treating them as absent', async () => {
    const autoSave = useAutoSave()
    mocks.storage.set('sce-autosave-backup', JSON.stringify({
      type: 'sce-autosave',
      version: 1,
      workspace: JSON.parse(createWorkspaceJson())
    }))

    await expect(autoSave.getAutoSaveBackup())
      .rejects.toThrow('自动保存备份缺少有效的保存时间')
  })

  it('reports an empty current slot instead of treating it as absent', async () => {
    const autoSave = useAutoSave()
    mocks.storage.set('sce-autosave-backup', '')

    await expect(autoSave.getAutoSaveBackup())
      .rejects.toThrow('自动保存备份内容为空')

    expect(autoSave.startAutoSave()).toBe(false)
  })

  it('serializes concurrent reads while preserving each request options and loading state', async () => {
    const autoSave = useAutoSave()
    const time = '2026-07-05T08:00:00.000Z'
    mocks.storage.set('sce-autosave-backup', createWorkspaceJson(time, '张三'))
    mocks.storage.set('sce-autosave-time', time)
    const releaseRecoveryReads: Array<() => void> = []
    mocks.readStoredText.mockImplementation(async (key: string) => {
      if (key === 'sce-autosave-recovery-pending') {
        await new Promise<void>(resolve => releaseRecoveryReads.push(resolve))
      }
      return mocks.storage.get(key) ?? null
    })

    const currentRead = autoSave.getAutoSaveBackup()
    const protectedRead = autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true })

    await vi.waitFor(() => expect(releaseRecoveryReads).toHaveLength(1))
    expect(autoSave.isAutoSaveBackupLoading.value).toBe(true)
    releaseRecoveryReads[0]?.()
    const current = requireDefined(await currentRead)

    await vi.waitFor(() => expect(releaseRecoveryReads).toHaveLength(2))
    expect(current.slot).toBe('current')
    expect(autoSave.isAutoSaveBackupLoading.value).toBe(true)
    releaseRecoveryReads[1]?.()
    const protectedBackup = requireDefined(await protectedRead)

    expect(protectedBackup.slot).toBe('recovery-pending')
    expect(autoSave.autoSaveBackup.value?.slot).toBe('recovery-pending')
    expect(autoSave.isAutoSaveBackupLoading.value).toBe(false)
  })

  it('uses a valid recovery slot when the current slot is malformed', async () => {
    const autoSave = useAutoSave()
    await autoSave.performAutoSave(createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三'))
    const validRecord = mocks.storage.get('sce-autosave-backup')
    mocks.storage.set('sce-autosave-recovery-pending', validRecord)
    mocks.storage.set('sce-autosave-backup', '{malformed-current')

    const loaded = requireDefined(await autoSave.getAutoSaveBackup({
      preserveCurrentAsRecovery: true
    }))

    expect(loaded.slot).toBe('recovery-pending')
    expect(loaded.data.students[0]?.name).toBe('张三')
    expect(autoSave.startAutoSave()).toBe(true)
  })

  it('keeps the only valid current snapshot write-protected when recovery is malformed', async () => {
    const autoSave = useAutoSave()
    await autoSave.performAutoSave(createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三'))
    const currentRecord = mocks.storage.get('sce-autosave-backup')
    const malformedRecovery = '{malformed-recovery'
    mocks.storage.set('sce-autosave-recovery-pending', malformedRecovery)
    mocks.writeStoredText.mockClear()

    const loaded = requireDefined(await autoSave.getAutoSaveBackup({
      preserveCurrentAsRecovery: true
    }))

    expect(loaded.slot).toBe('current')
    expect(loaded.data.students[0]?.name).toBe('张三')
    expect(mocks.storage.get('sce-autosave-recovery-pending')).toBe(malformedRecovery)
    expect(mocks.writeStoredText).not.toHaveBeenCalled()
    await autoSave.getAutoSaveBackup()
    expect(autoSave.startAutoSave()).toBe(false)

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await nextTick()
    await autoSave.flushAutoSave()

    expect(mocks.storage.get('sce-autosave-backup')).toBe(currentRecord)
  })

  it('keeps the only valid current snapshot write-protected when recovery is empty', async () => {
    const autoSave = useAutoSave()
    await autoSave.performAutoSave(createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三'))
    const currentRecord = mocks.storage.get('sce-autosave-backup')
    mocks.storage.set('sce-autosave-recovery-pending', '')
    mocks.writeStoredText.mockClear()

    const loaded = requireDefined(await autoSave.getAutoSaveBackup({
      preserveCurrentAsRecovery: true
    }))

    expect(loaded.slot).toBe('current')
    expect(loaded.data.students[0]?.name).toBe('张三')
    expect(mocks.storage.get('sce-autosave-recovery-pending')).toBe('')
    expect(mocks.writeStoredText).not.toHaveBeenCalled()
    expect(autoSave.startAutoSave()).toBe(false)

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await nextTick()
    await autoSave.flushAutoSave()

    expect(mocks.storage.get('sce-autosave-backup')).toBe(currentRecord)
  })

  it('keeps the only valid current snapshot write-protected when recovery cannot be read', async () => {
    const autoSave = useAutoSave()
    await autoSave.performAutoSave(createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三'))
    const currentRecord = mocks.storage.get('sce-autosave-backup')
    mocks.readStoredText.mockImplementation(async (key: string) => {
      if (key === 'sce-autosave-recovery-pending') throw new Error('recovery permission denied')
      return mocks.storage.get(key) ?? null
    })

    const loaded = requireDefined(await autoSave.getAutoSaveBackup({
      preserveCurrentAsRecovery: true
    }))

    expect(loaded.slot).toBe('current')
    expect(autoSave.startAutoSave()).toBe(false)
    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await nextTick()
    await autoSave.flushAutoSave()
    expect(mocks.storage.get('sce-autosave-backup')).toBe(currentRecord)
  })

  it('repairs a malformed recovery slot after explicit restore before unlocking autosave', async () => {
    const autoSave = useAutoSave()
    await autoSave.performAutoSave(createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三'))
    mocks.storage.set('sce-autosave-recovery-pending', '{malformed-recovery')
    const loaded = requireDefined(await autoSave.getAutoSaveBackup({
      preserveCurrentAsRecovery: true
    }))

    expect(autoSave.startAutoSave()).toBe(false)
    await expect(autoSave.restoreAutoSaveBackup(loaded)).resolves.toBe(true)

    expect(autoSave.autoSaveBackup.value).toBeNull()
    expect(mocks.storage.has('sce-autosave-recovery-pending')).toBe(false)
    expect(JSON.parse(mocks.storage.get('sce-autosave-handled-time'))).toMatchObject({
      snapshotId: loaded.snapshotId
    })
    expect(autoSave.isAutoSaveEnabled.value).toBe(true)
  })

  it('explicitly ignores a protected current and removes its damaged recovery slot before unlocking', async () => {
    const autoSave = useAutoSave()
    await autoSave.performAutoSave(createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三'))
    mocks.storage.set('sce-autosave-recovery-pending', '{malformed-recovery')
    await autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true })

    expect(autoSave.startAutoSave()).toBe(false)
    await expect(autoSave.discardAutoSaveRecovery()).resolves.toBe(true)

    expect(mocks.storage.has('sce-autosave-recovery-pending')).toBe(false)
    expect(autoSave.autoSaveBackup.value).toBeNull()
    expect(autoSave.isAutoSaveEnabled.value).toBe(true)
  })

  it('repairs a malformed current before explicitly ignoring the only valid recovery', async () => {
    const autoSave = useAutoSave()
    await autoSave.performAutoSave(createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三'))
    const recoveryRecord = mocks.storage.get('sce-autosave-backup')
    mocks.storage.set('sce-autosave-recovery-pending', recoveryRecord)
    mocks.storage.set('sce-autosave-backup', '{malformed-current')
    const recovery = requireDefined(await autoSave.getAutoSaveBackup({
      preserveCurrentAsRecovery: true
    }))

    await expect(autoSave.discardAutoSaveRecovery()).resolves.toBe(true)

    expect(mocks.storage.has('sce-autosave-recovery-pending')).toBe(false)
    expect(JSON.parse(mocks.storage.get('sce-autosave-backup'))).toMatchObject({
      snapshotId: recovery.snapshotId,
      workspace: {
        students: [{ name: '张三' }]
      }
    })
    await expect(autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true }))
      .resolves.toBeNull()
  })

  it('keeps the only valid recovery when malformed current repair fails during ignore', async () => {
    const autoSave = useAutoSave()
    await autoSave.performAutoSave(createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三'))
    const recoveryRecord = mocks.storage.get('sce-autosave-backup')
    mocks.storage.set('sce-autosave-recovery-pending', recoveryRecord)
    mocks.storage.set('sce-autosave-backup', '{malformed-current')
    await autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true })
    mocks.writeStoredText.mockResolvedValueOnce(false)

    await expect(autoSave.discardAutoSaveRecovery()).resolves.toBe(false)

    expect(mocks.storage.get('sce-autosave-recovery-pending')).toBe(recoveryRecord)
    expect(mocks.storage.get('sce-autosave-backup')).toBe('{malformed-current')
  })

  it('restores a backup and records it as the last autosave workspace', async () => {
    const autoSave = useAutoSave()
    const time = '2026-07-05T08:00:00.000Z'
    mocks.storage.set('sce-autosave-backup', createWorkspaceJson())
    mocks.storage.set('sce-autosave-time', time)

    const backup = requireDefined(await autoSave.getAutoSaveBackup())
    const result = await autoSave.restoreAutoSaveBackup(backup)

    expect(result).toBe(true)
    expect(mocks.applyWorkspaceData).toHaveBeenCalledWith(backup.data)
    expect(mocks.saveLastWorkspace).toHaveBeenCalledWith({
      type: 'autosave',
      name: '自动保存',
      time
    })
    expect(mocks.writeStoredText).toHaveBeenCalledWith(
      'sce-autosave-handled-time',
      expect.stringContaining(backup.snapshotId)
    )
    await expect(autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true }))
      .resolves.toBeNull()
  })

  it('consumes a protected candidate only after its workspace restores successfully', async () => {
    const autoSave = useAutoSave()
    const time = '2026-07-05T08:00:00.000Z'
    mocks.storage.set('sce-autosave-backup', createWorkspaceJson(time, '张三'))
    mocks.storage.set('sce-autosave-time', time)
    const backup = requireDefined(await autoSave.getAutoSaveBackup({
      preserveCurrentAsRecovery: true
    }))

    mocks.applyWorkspaceData.mockResolvedValueOnce(false)
    await expect(autoSave.restoreAutoSaveBackup(backup)).resolves.toBe(false)
    expect(mocks.storage.has('sce-autosave-recovery-pending')).toBe(true)

    mocks.applyWorkspaceData.mockResolvedValueOnce(true)
    await expect(autoSave.restoreAutoSaveBackup(backup)).resolves.toBe(true)
    expect(mocks.storage.has('sce-autosave-recovery-pending')).toBe(false)
    expect(mocks.storage.has('sce-autosave-backup')).toBe(true)
    expect(autoSave.autoSaveBackup.value).toBeNull()
    await expect(autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true }))
      .resolves.toBeNull()
  })

  it('explicitly discards only the protected recovery candidate', async () => {
    const autoSave = useAutoSave()
    const time = '2026-07-05T08:00:00.000Z'
    mocks.storage.set('sce-autosave-backup', createWorkspaceJson(time, '张三'))
    mocks.storage.set('sce-autosave-time', time)
    await autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true })

    await expect(autoSave.discardAutoSaveRecovery()).resolves.toBe(true)

    expect(mocks.storage.has('sce-autosave-recovery-pending')).toBe(false)
    expect(mocks.storage.has('sce-autosave-backup')).toBe(true)
  })

  it('keeps recovery until a deferred restored-current write succeeds and reads back', async () => {
    const autoSave = useAutoSave()
    const restoredJson = createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三')
    const newerJson = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await autoSave.performAutoSave(restoredJson)
    const recovery = requireDefined(await autoSave.getAutoSaveBackup({
      preserveCurrentAsRecovery: true
    }))
    await autoSave.performAutoSave(newerJson)
    mocks.applyWorkspaceData.mockImplementationOnce(async () => {
      workspaceJson.value = restoredJson
      return true
    })
    const deferred = deferredWrite()
    mocks.writeStoredText.mockImplementationOnce(deferred.implementation)

    const restorePromise = autoSave.restoreAutoSaveBackup(recovery)
    await vi.waitFor(() => expect(mocks.writeStoredText).toHaveBeenCalledTimes(4))
    expect(mocks.storage.has('sce-autosave-recovery-pending')).toBe(true)

    deferred.release()
    await expect(restorePromise).resolves.toBe(true)

    expect(JSON.parse(mocks.storage.get('sce-autosave-backup')).workspace.students[0].name).toBe('张三')
    expect(mocks.storage.has('sce-autosave-recovery-pending')).toBe(false)
  })

  it('retains recovery when the restored-current write fails and readback is stale', async () => {
    const autoSave = useAutoSave()
    const restoredJson = createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三')
    const newerJson = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await autoSave.performAutoSave(restoredJson)
    const recovery = requireDefined(await autoSave.getAutoSaveBackup({
      preserveCurrentAsRecovery: true
    }))
    await autoSave.performAutoSave(newerJson)
    mocks.applyWorkspaceData.mockImplementationOnce(async () => {
      workspaceJson.value = restoredJson
      return true
    })
    mocks.writeStoredText.mockResolvedValueOnce(false)

    await expect(autoSave.restoreAutoSaveBackup(recovery)).resolves.toBe(true)

    expect(JSON.parse(mocks.storage.get('sce-autosave-backup')).workspace.students[0].name).toBe('李四')
    expect(mocks.storage.has('sce-autosave-recovery-pending')).toBe(true)
    expect(mocks.loggerError).toHaveBeenCalledWith(
      '自动保存恢复成功，但读回的当前快照与恢复结果不一致'
    )
  })

  it('does not consume a newer recovery record through a stale backup object', async () => {
    const autoSave = useAutoSave()
    const firstJson = createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三')
    const secondJson = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await autoSave.performAutoSave(firstJson)
    const staleRecovery = requireDefined(await autoSave.getAutoSaveBackup({
      preserveCurrentAsRecovery: true
    }))
    await autoSave.performAutoSave(secondJson)
    const newerRecoveryRecord = mocks.storage.get('sce-autosave-backup')
    mocks.storage.set('sce-autosave-recovery-pending', newerRecoveryRecord)
    mocks.applyWorkspaceData.mockImplementationOnce(async () => {
      workspaceJson.value = firstJson
      return true
    })

    await expect(autoSave.restoreAutoSaveBackup(staleRecovery)).resolves.toBe(true)

    expect(JSON.parse(mocks.storage.get('sce-autosave-recovery-pending')).workspace.students[0].name).toBe('李四')
    expect(mocks.loggerError).toHaveBeenCalledWith(
      '自动保存已恢复，但受保护的恢复副本未能消费并将继续保留'
    )
  })

  it('does not re-prompt an explicitly ignored snapshot after a no-edit restart', async () => {
    const autoSave = useAutoSave()
    const snapshot = createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三')
    await autoSave.performAutoSave(snapshot)
    await autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true })

    await expect(autoSave.discardAutoSaveRecovery()).resolves.toBe(true)
    const handledMarker = JSON.parse(mocks.storage.get('sce-autosave-handled-time'))
    expect(handledMarker).toMatchObject({
      type: 'sce-autosave-handled',
      version: 1
    })

    await expect(autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true }))
      .resolves.toBeNull()
    expect(mocks.storage.has('sce-autosave-recovery-pending')).toBe(false)
    expect(autoSave.autoSaveBackup.value?.slot).toBe('current')
  })

  it('keeps legacy ISO handled markers compatible with protected startup reads', async () => {
    const autoSave = useAutoSave()
    const time = '2026-07-05T08:00:00.000Z'
    mocks.storage.set('sce-autosave-backup', createWorkspaceJson(time, '张三'))
    mocks.storage.set('sce-autosave-time', time)
    mocks.storage.set('sce-autosave-handled-time', time)

    await expect(autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true }))
      .resolves.toBeNull()

    expect(mocks.storage.has('sce-autosave-recovery-pending')).toBe(false)
    expect(mocks.writeStoredText).not.toHaveBeenCalled()
    expect(autoSave.autoSaveBackup.value?.slot).toBe('current')
  })

  it('keeps an updated current snapshot when ignoring an older recovery candidate', async () => {
    const autoSave = useAutoSave()
    const oldJson = createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三')
    const updatedJson = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await autoSave.performAutoSave(oldJson)
    await autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true })
    await autoSave.performAutoSave(updatedJson)

    await expect(autoSave.discardAutoSaveRecovery()).resolves.toBe(true)

    expect(JSON.parse(mocks.storage.get('sce-autosave-backup')).workspace.students[0].name).toBe('李四')
    const nextRecovery = requireDefined(await autoSave.getAutoSaveBackup({
      preserveCurrentAsRecovery: true
    }))
    expect(nextRecovery.slot).toBe('recovery-pending')
    expect(nextRecovery.data.students[0]?.name).toBe('李四')
  })

  it('does not write a new backup when only the generated meta timestamp changes', async () => {
    const autoSave = useAutoSave()

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:00:00.000Z')
    await autoSave.performAutoSave()

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z')
    await autoSave.performAutoSave()

    expect(mocks.writeStoredText).toHaveBeenCalledTimes(1)
  })

  it('saves once after each reactive workspace change and keeps one latest record', async () => {
    const autoSave = useAutoSave()
    autoSave.startAutoSave()

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await nextTick()
    await autoSave.flushAutoSave()

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:02:00.000Z', '王五')
    await nextTick()
    await autoSave.flushAutoSave()

    const storedBackup = JSON.parse(mocks.storage.get('sce-autosave-backup'))
    expect(mocks.writeStoredText).toHaveBeenCalledTimes(2)
    expect(storedBackup.type).toBe('sce-autosave')
    expect(storedBackup.workspace.students[0].name).toBe('王五')
    expect(mocks.storage.has('sce-autosave-time')).toBe(false)
    expect(mocks.storage.has('sce-autosave-handled-time')).toBe(false)
  })

  it('serializes the workspace only once for each watched change', async () => {
    const autoSave = useAutoSave()
    autoSave.startAutoSave()
    mocks.getWorkspaceJson.mockClear()

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await nextTick()
    expect(mocks.getWorkspaceJson).toHaveBeenCalledTimes(1)

    await autoSave.flushAutoSave()

    // flush 会额外同步抓取一次最新状态，但签名去重不会产生第二次写入。
    expect(mocks.getWorkspaceJson).toHaveBeenCalledTimes(2)
    expect(mocks.writeStoredText).toHaveBeenCalledTimes(1)
  })

  it('coalesces overlapping writes so only the first and latest snapshots are persisted', async () => {
    const autoSave = useAutoSave()
    let releaseFirstWrite: (() => void) | undefined

    mocks.writeStoredText.mockImplementationOnce((key, value) => new Promise((resolve) => {
      releaseFirstWrite = () => {
        mocks.storage.set(key, value)
        resolve(true)
      }
    }))

    autoSave.startAutoSave()
    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await nextTick()
    workspaceJson.value = createWorkspaceJson('2026-07-05T08:02:00.000Z', '王五')
    await nextTick()
    workspaceJson.value = createWorkspaceJson('2026-07-05T08:03:00.000Z', '赵六')
    await nextTick()

    expect(mocks.writeStoredText).toHaveBeenCalledTimes(1)
    requireDefined(releaseFirstWrite)()
    await autoSave.flushAutoSave()

    const storedBackup = JSON.parse(mocks.storage.get('sce-autosave-backup'))
    expect(mocks.writeStoredText).toHaveBeenCalledTimes(2)
    expect(storedBackup.workspace.students[0].name).toBe('赵六')
  })

  it('persists a trailing A when the workspace changes from saved A to in-flight B and back to A', async () => {
    const autoSave = useAutoSave()
    const snapshotA = createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三')
    const snapshotB = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await autoSave.performAutoSave(snapshotA)

    const bWrite = deferredWrite()
    mocks.writeStoredText.mockImplementationOnce(bWrite.implementation)
    const saveB = autoSave.performAutoSave(snapshotB)
    await vi.waitFor(() => expect(mocks.writeStoredText).toHaveBeenCalledTimes(2))
    const saveTrailingA = autoSave.performAutoSave(snapshotA)

    bWrite.release()
    await Promise.all([saveB, saveTrailingA])
    await autoSave.flushAutoSave()

    expect(mocks.writeStoredText).toHaveBeenCalledTimes(3)
    expect(JSON.parse(mocks.storage.get('sce-autosave-backup')).workspace.students[0].name).toBe('张三')
  })

  it('does not let a concurrent read of old A replace the active B signature', async () => {
    const autoSave = useAutoSave()
    const snapshotA = createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三')
    const snapshotB = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await autoSave.performAutoSave(snapshotA)

    const bWrite = deferredWrite()
    mocks.writeStoredText.mockImplementationOnce(bWrite.implementation)
    const saveB = autoSave.performAutoSave(snapshotB)
    await vi.waitFor(() => expect(mocks.writeStoredText).toHaveBeenCalledTimes(2))

    const loadedWhileBIsActive = await autoSave.getAutoSaveBackup()
    expect(loadedWhileBIsActive?.data.students[0]?.name).toBe('张三')
    await expect(autoSave.performAutoSave(snapshotB)).resolves.toBe(false)

    bWrite.release()
    await saveB
    await autoSave.flushAutoSave()
    expect(mocks.writeStoredText).toHaveBeenCalledTimes(2)
    expect(JSON.parse(mocks.storage.get('sce-autosave-backup')).workspace.students[0].name).toBe('李四')
  })

  it('flushes through the latest pending write', async () => {
    const autoSave = useAutoSave()
    const firstWrite = deferredWrite()
    const latestWrite = deferredWrite()
    mocks.writeStoredText
      .mockImplementationOnce(firstWrite.implementation)
      .mockImplementationOnce(latestWrite.implementation)

    autoSave.startAutoSave()
    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await nextTick()
    workspaceJson.value = createWorkspaceJson('2026-07-05T08:02:00.000Z', '王五')
    await nextTick()

    let flushed = false
    const flushPromise = autoSave.flushAutoSave().then(() => {
      flushed = true
    })
    firstWrite.release()
    await vi.waitFor(() => expect(mocks.writeStoredText).toHaveBeenCalledTimes(2))
    expect(flushed).toBe(false)

    latestWrite.release()
    await flushPromise
    expect(flushed).toBe(true)
    expect(JSON.parse(mocks.storage.get('sce-autosave-backup')).workspace.students[0].name).toBe('王五')
  })

  it('captures a same-tick workspace change before waiting for the writer queue', async () => {
    const autoSave = useAutoSave()
    autoSave.startAutoSave()

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await autoSave.flushAutoSave()

    const storedBackup = JSON.parse(mocks.storage.get('sce-autosave-backup'))
    expect(storedBackup.workspace.students[0].name).toBe('李四')
  })

  it('does not let a watcher scheduled before clear recreate the removed backup', async () => {
    const autoSave = useAutoSave()
    autoSave.startAutoSave()

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await expect(autoSave.clearAutoSaveBackup()).resolves.toBe(true)
    await nextTick()

    expect(mocks.storage.has('sce-autosave-backup')).toBe(false)

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:02:00.000Z', '王五')
    await nextTick()
    await autoSave.flushAutoSave()
    expect(JSON.parse(mocks.storage.get('sce-autosave-backup')).workspace.students[0].name).toBe('王五')
  })

  it('replays the latest workspace change after asynchronous backup removal finishes', async () => {
    const autoSave = useAutoSave()
    const pendingRemovals: Array<{ key: string; resolve: (removed: boolean) => void }> = []
    mocks.removeStoredText.mockImplementation((key: string) => new Promise<boolean>((resolve) => {
      pendingRemovals.push({ key, resolve })
    }))
    autoSave.startAutoSave()

    const clearPromise = autoSave.clearAutoSaveBackup()
    await vi.waitFor(() => expect(pendingRemovals).toHaveLength(1))

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await nextTick()
    expect(mocks.writeStoredText).not.toHaveBeenCalled()

    mocks.removeStoredText.mockImplementation(async (key: string) => {
      mocks.storage.delete(key)
      return true
    })
    pendingRemovals.forEach(({ key, resolve }) => {
      mocks.storage.delete(key)
      resolve(true)
    })

    await expect(clearPromise).resolves.toBe(true)
    expect(JSON.parse(mocks.storage.get('sce-autosave-backup')).workspace.students[0].name).toBe('李四')
  })

  it('makes a concurrent flush wait for clear removal and replay', async () => {
    const autoSave = useAutoSave()
    const pendingRemovals: Array<{ key: string; resolve: (removed: boolean) => void }> = []
    mocks.removeStoredText.mockImplementation((key: string) => new Promise<boolean>((resolve) => {
      pendingRemovals.push({ key, resolve })
    }))
    autoSave.startAutoSave()

    const clearPromise = autoSave.clearAutoSaveBackup()
    await vi.waitFor(() => expect(pendingRemovals).toHaveLength(1))

    workspaceJson.value = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    await nextTick()
    let flushed = false
    const flushPromise = autoSave.flushAutoSave().then(() => {
      flushed = true
    })
    await Promise.resolve()
    expect(flushed).toBe(false)

    mocks.removeStoredText.mockImplementation(async (key: string) => {
      mocks.storage.delete(key)
      return true
    })
    pendingRemovals.forEach(({ key, resolve }) => {
      mocks.storage.delete(key)
      resolve(true)
    })

    await expect(clearPromise).resolves.toBe(true)
    await flushPromise
    expect(flushed).toBe(true)
    expect(JSON.parse(mocks.storage.get('sce-autosave-backup')).workspace.students[0].name).toBe('李四')
  })

  it('treats legacy marker deletion failures as non-fatal after the main backup is removed', async () => {
    const autoSave = useAutoSave()
    await autoSave.performAutoSave()
    mocks.removeStoredText.mockImplementation(async (key: string) => {
      if (key === 'sce-autosave-backup' || key === 'sce-autosave-recovery-pending') {
        mocks.storage.delete(key)
        return true
      }
      return false
    })

    await expect(autoSave.clearAutoSaveBackup()).resolves.toBe(true)

    expect(autoSave.autoSaveBackup.value).toBeNull()
    expect(mocks.storage.has('sce-autosave-backup')).toBe(false)
    expect(mocks.loggerError).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith('自动保存备份已清理，但旧版时间或已处理标记清理失败')

    mocks.removeStoredText.mockResolvedValue(true)
    await expect(autoSave.performAutoSave()).resolves.toBe(true)
    expect(mocks.writeStoredText).toHaveBeenCalledTimes(2)
  })

  it('does not touch recovery when removing the current backup fails', async () => {
    const autoSave = useAutoSave()
    await autoSave.performAutoSave(
      createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三')
    )
    await autoSave.getAutoSaveBackup({ preserveCurrentAsRecovery: true })
    const protectedRecord = mocks.storage.get('sce-autosave-recovery-pending')
    mocks.removeStoredText.mockClear()
    mocks.removeStoredText.mockResolvedValue(false)

    await expect(autoSave.clearAutoSaveBackup()).resolves.toBe(false)

    expect(mocks.removeStoredText).toHaveBeenCalledTimes(1)
    expect(mocks.removeStoredText).toHaveBeenCalledWith('sce-autosave-backup')
    expect(mocks.storage.get('sce-autosave-recovery-pending')).toBe(protectedRecord)
  })

  it('clears autosave storage in current, legacy and recovery order', async () => {
    const autoSave = useAutoSave()
    mocks.storage.set('sce-autosave-backup', 'current')
    mocks.storage.set('sce-autosave-time', 'legacy-time')
    mocks.storage.set('sce-autosave-handled-time', 'handled')
    mocks.storage.set('sce-autosave-recovery-pending', 'recovery')

    await expect(autoSave.clearAutoSaveBackup()).resolves.toBe(true)

    expect(mocks.removeStoredText.mock.calls.map(([key]) => key)).toEqual([
      'sce-autosave-backup',
      'sce-autosave-time',
      'sce-autosave-handled-time',
      'sce-autosave-recovery-pending'
    ])
  })

  it('keeps a successful backup when legacy marker cleanup fails', async () => {
    const autoSave = useAutoSave()
    mocks.removeStoredText.mockResolvedValue(false)

    await expect(autoSave.performAutoSave()).resolves.toBe(true)

    expect(mocks.storage.has('sce-autosave-backup')).toBe(true)
    expect(mocks.loggerError).not.toHaveBeenCalled()
  })

  it('reports failure when an autosave backup cannot be removed', async () => {
    const autoSave = useAutoSave()
    await autoSave.performAutoSave()
    mocks.removeStoredText.mockResolvedValue(false)

    await expect(autoSave.clearAutoSaveBackup()).resolves.toBe(false)

    expect(mocks.loggerError).toHaveBeenCalledWith('清理自动保存失败，请检查应用数据目录是否可写')
  })

  it('persists a same-tick workspace change when backup removal fails', async () => {
    const autoSave = useAutoSave()
    const snapshotA = createWorkspaceJson('2026-07-05T08:00:00.000Z', '张三')
    const snapshotB = createWorkspaceJson('2026-07-05T08:01:00.000Z', '李四')
    workspaceJson.value = snapshotA
    autoSave.startAutoSave()
    await autoSave.performAutoSave(snapshotA)
    mocks.removeStoredText.mockResolvedValue(false)

    workspaceJson.value = snapshotB
    await expect(autoSave.clearAutoSaveBackup()).resolves.toBe(false)
    await autoSave.flushAutoSave()

    expect(mocks.writeStoredText).toHaveBeenCalledTimes(2)
    expect(JSON.parse(mocks.storage.get('sce-autosave-backup')).workspace.students[0].name).toBe('李四')
  })
})
