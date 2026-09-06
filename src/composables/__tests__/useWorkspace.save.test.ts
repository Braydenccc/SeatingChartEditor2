import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  saveTextFile: vi.fn(),
  writeTextFilePath: vi.fn()
}))

vi.mock('@/platform/runtime', () => ({
  isTauriRuntime: () => true
}))

vi.mock('@/platform/files', () => ({
  openTextFile: vi.fn(),
  saveTextFile: mocks.saveTextFile,
  workspaceFileFilters: [],
  writeTextFilePath: mocks.writeTextFilePath
}))

import { useWorkspace } from '../useWorkspace'

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0))

const workspaceDocument = {
  meta: {
    version: '2.2',
    app: 'SeatingChartEditor',
    createdAt: '2026-07-24T00:00:00.000Z'
  },
  students: [],
  studentAttributeDefinitions: [],
  studentAttributeSettings: { showNumericAttributesInEditor: true },
  tags: [],
  tagSettings: { showTagsInSeatChart: true, tagDisplayMode: 'dot' },
  layout: {
    config: {
      groupCount: 1,
      columnsPerGroup: 1,
      seatsPerColumn: 1,
      groups: [{ columns: 1, rows: 1 }],
      shiftDistance: 1,
      podiumPosition: 'bottom'
    },
    seats: []
  },
  zones: [],
  rules: [],
  rotationGroups: [],
  exportSettings: {}
}

describe('workspace local save queue', () => {
  beforeEach(() => {
    mocks.saveTextFile.mockReset()
    mocks.writeTextFilePath.mockReset()
  })

  it('serializes local path writes and keeps the shared busy state until the queue drains', async () => {
    const workspace = useWorkspace()
    await expect(workspace.applyWorkspaceData(workspaceDocument, {
      localPath: 'C:\\workspace.sce'
    })).resolves.toBe(true)
    const firstWrite = createDeferred<{ success: boolean; canceled: boolean; path: string }>()
    const secondWrite = createDeferred<{ success: boolean; canceled: boolean; path: string }>()
    mocks.writeTextFilePath
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise)

    const firstSave = workspace.saveWorkspace()
    const secondSave = workspace.saveWorkspace()
    expect(workspace.isSavingWorkspace.value).toBe(true)
    await flushPromises()
    expect(mocks.writeTextFilePath).toHaveBeenCalledTimes(1)

    firstWrite.resolve({ success: true, canceled: false, path: 'C:\\workspace.sce' })
    await expect(firstSave).resolves.toEqual({ success: true, canceled: false })
    await flushPromises()
    expect(mocks.writeTextFilePath).toHaveBeenCalledTimes(2)
    expect(workspace.isSavingWorkspace.value).toBe(true)

    secondWrite.resolve({ success: true, canceled: false, path: 'C:\\workspace.sce' })
    await expect(secondSave).resolves.toEqual({ success: true, canceled: false })
    expect(workspace.isSavingWorkspace.value).toBe(false)
  })

  it('continues the save queue after the first save is canceled', async () => {
    const workspace = useWorkspace()
    const firstWrite = createDeferred<{ success: boolean; canceled: boolean; path: string | null }>()
    const secondWrite = createDeferred<{ success: boolean; canceled: boolean; path: string | null }>()
    mocks.saveTextFile
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise)

    const firstSave = workspace.saveWorkspaceAs()
    const secondSave = workspace.saveWorkspaceAs()
    expect(workspace.isSavingWorkspace.value).toBe(true)
    await flushPromises()
    expect(mocks.saveTextFile).toHaveBeenCalledTimes(1)

    firstWrite.resolve({ success: false, canceled: true, path: null })
    await expect(firstSave).resolves.toEqual({ success: false, canceled: true })
    await flushPromises()
    expect(mocks.saveTextFile).toHaveBeenCalledTimes(2)
    expect(workspace.isSavingWorkspace.value).toBe(true)

    secondWrite.resolve({ success: true, canceled: false, path: 'C:\\second.sce' })
    await expect(secondSave).resolves.toEqual({ success: true, canceled: false })
    expect(workspace.isSavingWorkspace.value).toBe(false)
  })

  it('continues the save queue after the first save throws an error', async () => {
    const workspace = useWorkspace()
    const firstWrite = createDeferred<{ success: boolean; canceled: boolean; path: string | null }>()
    const secondWrite = createDeferred<{ success: boolean; canceled: boolean; path: string | null }>()
    mocks.saveTextFile
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise)

    const firstSave = workspace.saveWorkspaceAs()
    const secondSave = workspace.saveWorkspaceAs()
    expect(workspace.isSavingWorkspace.value).toBe(true)
    await flushPromises()
    expect(mocks.saveTextFile).toHaveBeenCalledTimes(1)

    firstWrite.reject(new Error('磁盘写入失败'))
    await expect(firstSave).resolves.toEqual({
      success: false,
      canceled: false,
      error: '磁盘写入失败'
    })
    await flushPromises()
    expect(mocks.saveTextFile).toHaveBeenCalledTimes(2)
    expect(workspace.isSavingWorkspace.value).toBe(true)

    secondWrite.resolve({ success: true, canceled: false, path: 'C:\\second.sce' })
    await expect(secondSave).resolves.toEqual({ success: true, canceled: false })
    expect(workspace.isSavingWorkspace.value).toBe(false)
  })
})
