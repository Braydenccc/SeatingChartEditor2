import { describe, it, expect, beforeEach, vi } from 'vitest'
import { computed, ref } from 'vue'

vi.mock('@/utils/fetchHelpers')
vi.mock('../useAuth')

import { fetchWithRetry } from '@/utils/fetchHelpers'
import { useAuth, getOrCreateCsrfToken } from '../useAuth'
import { useWebDav } from '../useWebDav'
import { buildWebDavWorkspacePath } from '@/utils/webdavPath'

type AuthApi = ReturnType<typeof useAuth>

const createAuthMock = (token: string | null): AuthApi => ({
  currentUser: ref(token ? { username: 'teacher' } : null),
  isLoggedIn: computed(() => Boolean(token)),
  token: ref(token),
  authType: ref('retiehe'),
  webdavConfig: ref(null),
  backupMode: ref(false),
  isLoginDialogVisible: ref(false),
  login: vi.fn(),
  register: vi.fn(),
  changePassword: vi.fn(),
  setWebdavLogin: vi.fn(),
  updateSyncSettings: vi.fn(),
  setAuthType: vi.fn(),
  logout: vi.fn(),
  initAuth: vi.fn()
})

describe('useWebDav', () => {
  const mockedFetchWithRetry = vi.mocked(fetchWithRetry)
  const config = {
    url: 'https://dav.example.com/root',
    username: 'teacher',
    password: 'secret'
  }

  beforeEach(() => {
    mockedFetchWithRetry.mockReset()
    vi.mocked(getOrCreateCsrfToken).mockReturnValue('csrf-token')
    vi.mocked(useAuth).mockReturnValue(createAuthMock(null))
  })

  it('uses direct WebDAV requests by default', async () => {
    mockedFetchWithRetry.mockResolvedValueOnce(new Response(null, { status: 200 }))

    const { putFile } = useWebDav()
    await putFile(config, '/sce_data/a.sce', 'content', 'application/json')

    expect(fetchWithRetry).toHaveBeenCalledTimes(1)
    expect(fetchWithRetry).toHaveBeenCalledWith(
      'https://dav.example.com/root/sce_data/a.sce',
      expect.objectContaining({
        method: 'PUT',
        body: 'content',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
          'Content-Type': 'application/json'
        })
      }),
      2
    )
  })

  it('encodes long Basic auth credentials without overflowing the call stack', async () => {
    mockedFetchWithRetry.mockResolvedValueOnce(new Response(null, { status: 200 }))

    const { putFile } = useWebDav()
    await putFile({
      ...config,
      password: 'x'.repeat(200000)
    }, '/sce_data/a.sce', 'content')

    expect(fetchWithRetry).toHaveBeenCalledWith(
      'https://dav.example.com/root/sce_data/a.sce',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /)
        })
      }),
      2
    )
  })

  it('does not use the proxy when direct WebDAV fails without SCE login', async () => {
    mockedFetchWithRetry.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const { getFileText } = useWebDav()

    await expect(getFileText(config, '/sce_data/a.sce')).rejects.toThrow('可登录 SCE 账号后启用安全中转')
    expect(fetchWithRetry).toHaveBeenCalledTimes(1)
    expect(mockedFetchWithRetry.mock.calls[0][0]).toBe('https://dav.example.com/root/sce_data/a.sce')
  })

  it('falls back to the controlled proxy after direct CORS failure when SCE login exists', async () => {
    vi.mocked(useAuth).mockReturnValue(createAuthMock('cookie-session'))
    mockedFetchWithRetry
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('workspace', { status: 200 }))

    const { getFileText } = useWebDav()
    await expect(getFileText(config, '/sce_data/a.sce')).resolves.toBe('workspace')

    expect(fetchWithRetry).toHaveBeenCalledTimes(2)
    expect(mockedFetchWithRetry.mock.calls[1][0]).toBe('/api/dav-proxy.php')
    expect(mockedFetchWithRetry.mock.calls[1][1]).toEqual(expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
      headers: expect.objectContaining({
        'x-dav-base-url': 'https://dav.example.com/root',
        'x-dav-path': '/sce_data/a.sce',
        'X-CSRF-Token': 'csrf-token',
        Authorization: expect.stringMatching(/^Basic /)
      })
    }))
  })

  it('preserves the same encoded workspace path for direct and proxy requests', async () => {
    vi.mocked(useAuth).mockReturnValue(createAuthMock('cookie-session'))
    mockedFetchWithRetry
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('workspace', { status: 200 }))
    const encodedPath = buildWebDavWorkspacePath('班级 #1%.sce')

    await expect(useWebDav().getFileText(config, encodedPath)).resolves.toBe('workspace')

    expect(mockedFetchWithRetry.mock.calls[0][0]).toBe(`https://dav.example.com/root${encodedPath}`)
    expect(new Headers(mockedFetchWithRetry.mock.calls[1][1]?.headers).get('x-dav-path')).toBe(encodedPath)
  })

})
