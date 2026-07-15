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

describe('useAutoSave', () => {
  beforeEach(async () => {
    const autoSave = useAutoSave()
    autoSave.stopAutoSave()
    mocks.storage.clear()
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
    expect(mocks.writeStoredText).not.toHaveBeenCalled()
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

  it('serializes overlapping writes so an older snapshot cannot overwrite the latest one', async () => {
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

    expect(mocks.writeStoredText).toHaveBeenCalledTimes(1)
    requireDefined(releaseFirstWrite)()
    await autoSave.flushAutoSave()

    const storedBackup = JSON.parse(mocks.storage.get('sce-autosave-backup'))
    expect(mocks.writeStoredText).toHaveBeenCalledTimes(2)
    expect(storedBackup.workspace.students[0].name).toBe('王五')
  })
})
