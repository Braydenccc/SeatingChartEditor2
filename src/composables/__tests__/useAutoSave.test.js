import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  storage: new Map(),
  workspaceJson: '',
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

vi.mock('../useGlobalSettings', () => ({
  useGlobalSettings: () => ({
    settings: {
      value: {
        editor: {
          autoSaveInterval: 60000
        }
      }
    }
  })
}))

vi.mock('../useWorkspace', () => ({
  useWorkspace: () => ({
    getWorkspaceJson: () => mocks.workspaceJson,
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

const createWorkspaceJson = (createdAt = '2026-01-01T00:00:00.000Z') => JSON.stringify({
  meta: {
    version: '2.2',
    app: 'SeatingChartEditor',
    createdAt
  },
  students: [
    { id: 1, name: '张三', studentNumber: '1', tags: [] }
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

describe('useAutoSave', () => {
  beforeEach(async () => {
    const autoSave = useAutoSave()
    autoSave.stopAutoSave()
    mocks.storage.clear()
    mocks.workspaceJson = createWorkspaceJson()
    mocks.applyWorkspaceData.mockReset()
    mocks.applyWorkspaceData.mockResolvedValue(true)
    mocks.saveLastWorkspace.mockReset()
    mocks.loggerError.mockReset()
    await autoSave.clearAutoSaveBackup()
    mocks.readStoredText.mockClear()
    mocks.writeStoredText.mockClear()
    mocks.removeStoredText.mockClear()
  })

  it('loads an autosave backup and suppresses prompts after it is handled', async () => {
    const autoSave = useAutoSave()
    const time = '2026-07-05T08:00:00.000Z'
    mocks.storage.set('sce-autosave-backup', createWorkspaceJson())
    mocks.storage.set('sce-autosave-time', time)

    const backup = await autoSave.getAutoSaveBackup()

    expect(backup.data.students).toHaveLength(1)
    expect(backup.timeIso).toBe(time)
    await expect(autoSave.isAutoSavePromptDue(backup)).resolves.toBe(true)

    await autoSave.markAutoSaveBackupHandled(backup)

    await expect(autoSave.isAutoSavePromptDue(backup)).resolves.toBe(false)
  })

  it('restores a backup and records it as the last autosave workspace', async () => {
    const autoSave = useAutoSave()
    const time = '2026-07-05T08:00:00.000Z'
    mocks.storage.set('sce-autosave-backup', createWorkspaceJson())
    mocks.storage.set('sce-autosave-time', time)

    const backup = await autoSave.getAutoSaveBackup()
    const result = await autoSave.restoreAutoSaveBackup(backup)

    expect(result).toBe(true)
    expect(mocks.applyWorkspaceData).toHaveBeenCalledWith(backup.data)
    expect(mocks.saveLastWorkspace).toHaveBeenCalledWith({
      type: 'autosave',
      name: '自动保存',
      time
    })
    expect(mocks.storage.get('sce-autosave-handled-time')).toBe(time)
  })

  it('does not write a new backup when only the generated meta timestamp changes', async () => {
    const autoSave = useAutoSave()

    mocks.workspaceJson = createWorkspaceJson('2026-07-05T08:00:00.000Z')
    await autoSave.performAutoSave()

    mocks.workspaceJson = createWorkspaceJson('2026-07-05T08:01:00.000Z')
    await autoSave.performAutoSave()

    expect(mocks.writeStoredText).toHaveBeenCalledTimes(2)
  })
})
