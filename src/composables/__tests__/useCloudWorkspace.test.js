import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../useAuth')
vi.mock('../useWebDav')
vi.mock('@/platform/apiClient', () => ({
  apiFetch: vi.fn()
}))
vi.mock('../useLogger')

import { useCloudWorkspace } from '../useCloudWorkspace'
import { useAuth } from '../useAuth'
import { useWebDav } from '../useWebDav'
import { apiFetch } from '@/platform/apiClient'
import { useLogger } from '../useLogger'

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0))

const createDeferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useCloudWorkspace', () => {
  let mockListFiles
  let mockPutFile
  let mockGetFileText
  let mockDeleteFile
  let mockCurrentUser
  let mockToken
  let mockAuthType
  let mockWebdavConfig
  let mockBackupMode
  let mockLoggerError

  beforeEach(() => {
    const { ref } = require('vue')

    mockCurrentUser = ref({ username: 'tester' })
    mockToken = ref('token')
    mockAuthType = ref('retiehe')
    mockWebdavConfig = ref({ url: 'https://dav.example.com', username: 'u', password: 'p' })
    mockBackupMode = ref(false)

    mockListFiles = vi.fn()
    mockPutFile = vi.fn()
    mockGetFileText = vi.fn()
    mockDeleteFile = vi.fn()
    mockLoggerError = vi.fn()

    vi.mocked(useAuth).mockReturnValue({
      currentUser: mockCurrentUser,
      token: mockToken,
      authType: mockAuthType,
      webdavConfig: mockWebdavConfig,
      backupMode: mockBackupMode
    })

    vi.mocked(useWebDav).mockReturnValue({
      listFiles: mockListFiles,
      putFile: mockPutFile,
      getFileText: mockGetFileText,
      deleteFile: mockDeleteFile
    })

    vi.mocked(useLogger).mockReturnValue({
      error: mockLoggerError
    })

    vi.mocked(apiFetch).mockReset()
  })

  it('keeps isFetching true until overlapping WebDAV and API list calls both settle', async () => {
    const workspace = useCloudWorkspace()
    const webdavDeferred = createDeferred()
    const apiDeferred = createDeferred()

    mockListFiles.mockReturnValueOnce(webdavDeferred.promise)
    vi.mocked(apiFetch).mockReturnValueOnce(apiDeferred.promise)

    const listPromise = workspace.listWorkspaces()
    expect(workspace.isFetching.value).toBe(true)

    apiDeferred.resolve({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: [] })
    })
    await flushPromises()
    await flushPromises()
    expect(workspace.isFetching.value).toBe(true)

    webdavDeferred.resolve([])
    await listPromise
    expect(workspace.isFetching.value).toBe(false)
  })

  it('returns message on invalid JSON and stops save flow', async () => {
    const workspace = useCloudWorkspace()

    await expect(
      workspace.saveWorkspaceToCloud('invalid-json', '{invalid json')
    ).resolves.toEqual({
      success: false,
      message: '工作区数据格式错误',
      error: '工作区数据格式错误'
    })

    expect(mockLoggerError).toHaveBeenCalledWith('工作区数据格式错误')
    expect(apiFetch).not.toHaveBeenCalled()
    expect(mockPutFile).not.toHaveBeenCalled()
  })

  it('sends trimmed workspace name when renaming Retiehe workspace', async () => {
    const workspace = useCloudWorkspace()

    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          fileId: 'abc123',
          metadata: { name: '新名称' }
        }
      })
    })

    await expect(
      workspace.renameWorkspaceInCloud('abc123', '  新名称  ', 'retiehe')
    ).resolves.toEqual({
      success: true,
      data: {
        fileId: 'abc123',
        metadata: { name: '新名称' }
      }
    })

    const [, options] = vi.mocked(apiFetch).mock.calls[0]
    expect(JSON.parse(options.body)).toMatchObject({
      action: 'rename',
      fileId: 'abc123',
      name: '新名称'
    })
  })
})
