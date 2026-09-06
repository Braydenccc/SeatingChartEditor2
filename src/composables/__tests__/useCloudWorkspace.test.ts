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
const canonicalFileId = '0123456789abcdef0123456789abcdef'
const legacyCanonicalFileId = 'fedcba9876543210fedcba9876543210'

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
  alert: vi.fn(() => Promise.resolve()),
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

  it('discovers legacy extensionless mirrors and prefers the canonical .sce file without duplicates', async () => {
    vi.mocked(useAuth).mockReturnValue(createAuthMock({
      currentUser: ref(null),
      isLoggedIn: computed(() => false),
      token: ref(null),
      authType: ref('webdav')
    }))
    mockListFiles.mockResolvedValueOnce([
      { name: canonicalFileId, isCollection: false, href: canonicalFileId, lastModified: 'old', size: 10 },
      { name: `${canonicalFileId}.sce`, isCollection: false, href: `${canonicalFileId}.sce`, lastModified: 'new', size: 20 },
      { name: legacyCanonicalFileId, isCollection: false, href: legacyCanonicalFileId, lastModified: 'legacy', size: 30 },
      { name: '普通工作区.sce', isCollection: false, href: '普通工作区.sce', lastModified: 'normal', size: 40 },
      { name: 'settings.json', isCollection: false, href: 'settings.json', lastModified: 'ignored', size: 50 }
    ])

    const result = await useCloudWorkspace().listWorkspaces()

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(3)
    expect(result.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fileId: `${canonicalFileId}.sce`,
        metadata: expect.objectContaining({ name: canonicalFileId, size: 20 })
      }),
      expect.objectContaining({
        fileId: legacyCanonicalFileId,
        metadata: expect.objectContaining({ name: legacyCanonicalFileId, size: 30 })
      }),
      expect.objectContaining({ fileId: '普通工作区.sce' })
    ]))
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

  it('encodes WebDAV workspace names as one path segment for save, load and delete', async () => {
    const workspace = useCloudWorkspace()
    const fileId = '班级 #1%.sce'
    const encodedPath = '/sce_data/%E7%8F%AD%E7%BA%A7%20%231%25.sce'
    mockGetFileText.mockResolvedValueOnce('{}')

    await expect(workspace.saveWorkspaceToCloud('班级 #1%', {}, null, 'webdav'))
      .resolves.toEqual({ success: true, data: { fileId } })
    await expect(workspace.loadWorkspaceFromCloud(fileId, 'webdav'))
      .resolves.toMatchObject({ success: true })
    await expect(workspace.deleteWorkspaceFromCloud(fileId, 'webdav'))
      .resolves.toEqual({ success: true })

    expect(mockPutFile).toHaveBeenCalledWith(expect.anything(), encodedPath, expect.any(String), 'application/json')
    expect(mockGetFileText).toHaveBeenCalledWith(expect.anything(), encodedPath)
    expect(mockDeleteFile).toHaveBeenCalledWith(expect.anything(), encodedPath)
  })

  it('rejects WebDAV file IDs that would escape the workspace directory', async () => {
    const workspace = useCloudWorkspace()

    await expect(workspace.loadWorkspaceFromCloud('../escape.sce', 'webdav'))
      .resolves.toMatchObject({ success: false, message: expect.stringMatching(/单个有效路径段/) })
    await expect(workspace.deleteWorkspaceFromCloud('folder\\escape.sce', 'webdav'))
      .resolves.toMatchObject({ success: false, message: expect.stringMatching(/单个有效路径段/) })

    expect(mockGetFileText).not.toHaveBeenCalled()
    expect(mockDeleteFile).not.toHaveBeenCalled()
  })

  it('lets the server assign the file id for a new SCE workspace', async () => {
    const workspace = useCloudWorkspace()
    vi.mocked(apiFetch).mockImplementationOnce(async (_url, options) => {
      if (typeof options?.body !== 'string') throw new Error('Expected a JSON request body')
      const requestBody = JSON.parse(options.body) as Record<string, unknown>
      expect(requestBody).not.toHaveProperty('fileId')
      return jsonResponse({
        success: true,
        data: {
          fileId: 'server-generated-id',
          metadata: { name: '测试工作区' }
        }
      })
    })

    await expect(workspace.saveWorkspaceToCloud('测试工作区', {
      students: [],
      tags: [],
      layout: { seats: [], config: {} }
    })).resolves.toMatchObject({
      success: true,
      data: { fileId: 'server-generated-id' }
    })

    const [, options] = vi.mocked(apiFetch).mock.calls[0]
    if (typeof options?.body !== 'string') throw new Error('Expected a JSON request body')
    expect(JSON.parse(options.body)).not.toHaveProperty('fileId')
    expect(new Headers(options.headers).get('Idempotency-Key')).toBeNull()
    expect(vi.mocked(apiFetch).mock.calls[0][2]).toBe(0)
  })

  it('keeps sending the server file id when overwriting an existing workspace', async () => {
    const workspace = useCloudWorkspace()
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      data: { fileId: 'existing-id', metadata: { name: '测试工作区' } }
    }))

    await workspace.saveWorkspaceToCloud('测试工作区', {
      students: [],
      tags: [],
      layout: { seats: [], config: {} }
    }, 'existing-id')

    const [, options] = vi.mocked(apiFetch).mock.calls[0]
    if (typeof options?.body !== 'string') throw new Error('Expected a JSON request body')
    expect(JSON.parse(options.body)).toMatchObject({ fileId: 'existing-id' })
  })

  it('returns the canonical server id when a requested workspace no longer exists', async () => {
    const workspace = useCloudWorkspace()
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      data: { fileId: 'replacement-id', metadata: { name: '测试工作区' } }
    }))

    await expect(workspace.saveWorkspaceToCloud('测试工作区', {
      students: [],
      tags: [],
      layout: { seats: [], config: {} }
    }, 'stale-id')).resolves.toMatchObject({
      success: true,
      data: { fileId: 'replacement-id' }
    })

    const [, options] = vi.mocked(apiFetch).mock.calls[0]
    if (typeof options?.body !== 'string') throw new Error('Expected a JSON request body')
    expect(JSON.parse(options.body)).toMatchObject({ fileId: 'stale-id' })
  })

  it('waits for the WebDAV mirror before reporting an SCE save as complete', async () => {
    vi.mocked(useAuth).mockReturnValue(createAuthMock({ backupMode: ref(true) }))
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      data: { fileId: 'mirrored-id' }
    }))
    const mirrorDeferred = createDeferred<boolean>()
    mockPutFile.mockReturnValueOnce(mirrorDeferred.promise)
    const workspace = useCloudWorkspace()

    let settled = false
    const savePromise = workspace.saveWorkspaceToCloud('镜像工作区', {}).then(result => {
      settled = true
      return result
    })
    await flushPromises()

    expect(mockPutFile).toHaveBeenCalledTimes(1)
    expect(mockPutFile).toHaveBeenCalledWith(
      expect.anything(),
      '/sce_data/mirrored-id.sce',
      expect.any(String),
      'application/json'
    )
    expect(settled).toBe(false)
    expect(workspace.isFetching.value).toBe(true)

    mirrorDeferred.resolve(true)
    await expect(savePromise).resolves.toMatchObject({ success: true, data: { fileId: 'mirrored-id' } })
    expect(workspace.isFetching.value).toBe(false)
  })

  it('keeps the SCE save successful and returns a visible warning when its WebDAV mirror fails', async () => {
    vi.mocked(useAuth).mockReturnValue(createAuthMock({ backupMode: ref(true) }))
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      data: { fileId: 'mirrored-id' }
    }))
    mockPutFile.mockRejectedValueOnce(new Error('配额已满'))
    const workspace = useCloudWorkspace()

    await expect(workspace.saveWorkspaceToCloud('镜像工作区', {})).resolves.toMatchObject({
      success: true,
      backupWarning: 'SCE 云端已保存，但 WebDAV 备份失败：配额已满'
    })
  })

  it('serializes save and delete mirrors for the same WebDAV file id', async () => {
    vi.mocked(useAuth).mockReturnValue(createAuthMock({ backupMode: ref(true) }))
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { fileId: 'same-id' } }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
    const saveDeferred = createDeferred<boolean>()
    const deleteDeferred = createDeferred<boolean>()
    mockPutFile.mockReturnValueOnce(saveDeferred.promise)
    mockDeleteFile.mockImplementation((_config, path) => (
      path === '/sce_data/same-id.sce' ? deleteDeferred.promise : Promise.resolve(true)
    ))
    const workspace = useCloudWorkspace()

    const savePromise = workspace.saveWorkspaceToCloud('同一工作区', {})
    await flushPromises()
    const deletePromise = workspace.deleteWorkspaceFromCloud('same-id', 'retiehe')
    await flushPromises()

    expect(mockPutFile).toHaveBeenCalledTimes(1)
    expect(mockDeleteFile).not.toHaveBeenCalled()

    saveDeferred.resolve(true)
    await savePromise
    await flushPromises()
    expect(mockDeleteFile).toHaveBeenNthCalledWith(1, expect.anything(), '/sce_data/same-id.sce')

    deleteDeferred.resolve(true)
    await expect(deletePromise).resolves.toMatchObject({ success: true })
    expect(mockDeleteFile).toHaveBeenNthCalledWith(2, expect.anything(), '/sce_data/same-id')
  })

  it('deletes both canonical and legacy WebDAV mirror names for an SCE workspace', async () => {
    vi.mocked(useAuth).mockReturnValue(createAuthMock({ backupMode: ref(true) }))
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse({ success: true }))

    await expect(useCloudWorkspace().deleteWorkspaceFromCloud(canonicalFileId, 'retiehe'))
      .resolves.toMatchObject({ success: true })

    expect(mockDeleteFile.mock.calls.map(([, path]) => path)).toEqual([
      `/sce_data/${canonicalFileId}.sce`,
      `/sce_data/${canonicalFileId}`
    ])
  })

  it('rejects a successful SCE save response without a valid file id', async () => {
    const workspace = useCloudWorkspace()
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      data: { metadata: { name: '测试工作区' } }
    }))

    await expect(workspace.saveWorkspaceToCloud('测试工作区', {
      students: [],
      tags: [],
      layout: { seats: [], config: {} }
    })).resolves.toEqual({
      success: false,
      message: '云端响应缺少有效的工作区文件ID',
      error: '云端响应格式错误',
      source: undefined
    })
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
