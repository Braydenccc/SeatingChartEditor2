import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useCloudWorkspace } from '../useCloudWorkspace'

const {
  mockCurrentUser,
  mockToken,
  mockAuthType,
  mockWebdavConfig,
  mockBackupMode,
  mockListFiles,
  mockPutFile,
  mockGetFileText,
  mockDeleteFile,
  mockFetchWithRetry
} = vi.hoisted(() => ({
  mockCurrentUser: ref({ username: 'tester' }),
  mockToken: ref('token'),
  mockAuthType: ref('retiehe'),
  mockWebdavConfig: ref({ url: 'https://dav.example.com', username: 'u', password: 'p' }),
  mockBackupMode: ref(false),
  mockListFiles: vi.fn(),
  mockPutFile: vi.fn(),
  mockGetFileText: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockFetchWithRetry: vi.fn()
}))

vi.mock('../useAuth', () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
    token: mockToken,
    authType: mockAuthType,
    webdavConfig: mockWebdavConfig,
    backupMode: mockBackupMode
  }),
  getOrCreateCsrfToken: () => 'csrf-token'
}))

vi.mock('../useWebDav', () => ({
  useWebDav: () => ({
    listFiles: mockListFiles,
    putFile: mockPutFile,
    getFileText: mockGetFileText,
    deleteFile: mockDeleteFile
  })
}))

vi.mock('@/utils/fetchHelpers', () => ({
  fetchWithRetry: mockFetchWithRetry
}))

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
  beforeEach(() => {
    mockCurrentUser.value = { username: 'tester' }
    mockToken.value = 'token'
    mockAuthType.value = 'retiehe'
    mockWebdavConfig.value = { url: 'https://dav.example.com', username: 'u', password: 'p' }
    mockBackupMode.value = false
    mockListFiles.mockReset()
    mockPutFile.mockReset()
    mockGetFileText.mockReset()
    mockDeleteFile.mockReset()
    mockFetchWithRetry.mockReset()
  })

  it('keeps isFetching true until overlapping WebDAV and API list calls both settle', async () => {
    const workspace = useCloudWorkspace()
    const webdavDeferred = createDeferred()
    const apiDeferred = createDeferred()

    mockListFiles.mockReturnValueOnce(webdavDeferred.promise)
    mockFetchWithRetry.mockReturnValueOnce(apiDeferred.promise)

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
})
