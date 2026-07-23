import { computed, ref } from 'vue'
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'

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

const jsonResponse = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
})

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type AuthApi = ReturnType<typeof useAuth>
type WebDavApi = ReturnType<typeof useWebDav>
type LoggerApi = ReturnType<typeof useLogger>

const createAuthMock = (overrides: Partial<AuthApi> = {}): AuthApi => ({
  currentUser: ref({ username: 'tester' }),
  isLoggedIn: computed(() => true),
  token: ref('token'),
  authType: ref('retiehe'),
  webdavConfig: ref({ url: 'https://dav.example.com', username: 'u', password: 'p' }),
  backupMode: ref(false),
  isLoginDialogVisible: ref(false),
  login: vi.fn(),
  register: vi.fn(),
  changePassword: vi.fn(),
  setWebdavLogin: vi.fn(),
  updateSyncSettings: vi.fn(),
  setAuthType: vi.fn(),
  logout: vi.fn(),
  initAuth: vi.fn(),
  ...overrides
})

const createWebDavMock = (overrides: Partial<WebDavApi> = {}): WebDavApi => ({
  mkcol: vi.fn(),
  putFile: vi.fn(),
  getFileText: vi.fn(),
  deleteFile: vi.fn(),
  listFiles: vi.fn(),
  ...overrides
})

const createLoggerMock = (overrides: Partial<LoggerApi> = {}): LoggerApi => ({
  logs: ref([]),
  addLog: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  confirm: vi.fn(),
  beginTask: vi.fn(() => vi.fn()),
  clearLogs: vi.fn(),
  removeLog: vi.fn(),
  ...overrides
})

describe('useCloudWorkspace', () => {
  let mockListFiles: MockedFunction<WebDavApi['listFiles']>
  let mockPutFile: MockedFunction<WebDavApi['putFile']>
  let mockGetFileText: MockedFunction<WebDavApi['getFileText']>
  let mockDeleteFile: MockedFunction<WebDavApi['deleteFile']>
  let mockLoggerError: MockedFunction<LoggerApi['error']>

  beforeEach(() => {
    mockListFiles = vi.fn<WebDavApi['listFiles']>()
    mockPutFile = vi.fn<WebDavApi['putFile']>()
    mockGetFileText = vi.fn<WebDavApi['getFileText']>()
    mockDeleteFile = vi.fn<WebDavApi['deleteFile']>()
    mockLoggerError = vi.fn<LoggerApi['error']>()

    vi.mocked(useAuth).mockReturnValue(createAuthMock())

    vi.mocked(useWebDav).mockReturnValue(createWebDavMock({
      listFiles: mockListFiles,
      putFile: mockPutFile,
      getFileText: mockGetFileText,
      deleteFile: mockDeleteFile
    }))

    vi.mocked(useLogger).mockReturnValue(createLoggerMock({
      error: mockLoggerError
    }))

    vi.mocked(apiFetch).mockReset()
  })

  it('keeps isFetching true until overlapping WebDAV and API list calls both settle', async () => {
    const workspace = useCloudWorkspace()
    const webdavDeferred = createDeferred<Awaited<ReturnType<WebDavApi['listFiles']>>>()
    const apiDeferred = createDeferred<Response>()

    mockListFiles.mockReturnValueOnce(webdavDeferred.promise)
    vi.mocked(apiFetch).mockReturnValueOnce(apiDeferred.promise)

    const listPromise = workspace.listWorkspaces()
    expect(workspace.isFetching.value).toBe(true)

    apiDeferred.resolve(jsonResponse({ success: true, data: [] }))
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

  it('generates one stable legal file id before a new SCE workspace request', async () => {
    const workspace = useCloudWorkspace()
    vi.mocked(apiFetch).mockImplementationOnce(async (_url, options) => {
      if (typeof options?.body !== 'string') throw new Error('Expected a JSON request body')
      const requestBody = JSON.parse(options.body) as { fileId: string }
      return jsonResponse({
        success: true,
        data: {
          fileId: requestBody.fileId,
          metadata: { name: '测试工作区' }
        }
      })
    })

    await workspace.saveWorkspaceToCloud('测试工作区', {
      students: [],
      tags: [],
      layout: { seats: [], config: {} }
    })

    const [, options] = vi.mocked(apiFetch).mock.calls[0]
    if (typeof options?.body !== 'string') throw new Error('Expected a JSON request body')
    const requestBody = JSON.parse(options.body) as { fileId: string }
    expect(requestBody.fileId).toMatch(/^[a-f0-9]{32}$/)
    expect(new Headers(options.headers).get('Idempotency-Key')).toBeNull()
    expect(vi.mocked(apiFetch).mock.calls[0][2]).toBe(0)
  })

  it('sends trimmed workspace name when renaming Retiehe workspace', async () => {
    const workspace = useCloudWorkspace()

    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          fileId: 'abc123',
          metadata: { name: '新名称' }
        }
    }))

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
    if (typeof options?.body !== 'string') throw new Error('Expected a JSON request body')
    expect(JSON.parse(options.body)).toMatchObject({
      action: 'rename',
      fileId: 'abc123',
      name: '新名称'
    })
  })
})
