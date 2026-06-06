// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const clearCookies = () => {
  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0]?.trim()
    if (name) {
      document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    }
  })
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    clearCookies()
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('persists encrypted WebDAV credentials for account sync without sending plaintext passwords', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: { username: 'teacher' }
      })
    })

    const { useAuth } = await import('../useAuth')
    const auth = useAuth()
    await auth.initAuth()

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true })
    })

    await auth.updateSyncSettings({
      url: 'https://dav.example.com/root',
      username: 'dav-user',
      password: 'dav-secret'
    }, true)

    const requestBody = JSON.parse(vi.mocked(fetch).mock.calls[1][1].body)
    expect(requestBody.settings.webdav).toMatchObject({
      url: 'https://dav.example.com/root',
      username: 'dav-user'
    })
    expect(requestBody.settings.webdav.password).toBeUndefined()
    expect(requestBody.settings.webdav.encryptedPassword).toEqual(expect.any(String))
  })

  it('sends change_password with csrf tokens and returns the api result', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: { username: 'teacher' }
      })
    })

    const { useAuth } = await import('../useAuth')
    const auth = useAuth()
    await auth.initAuth()

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, message: '密码已修改' })
    })

    const result = await auth.changePassword('OldPass123', 'NewPass123')

    expect(result).toEqual({ success: true, message: '密码已修改' })
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/auth.php')
    const request = vi.mocked(fetch).mock.calls[1][1]
    const requestBody = JSON.parse(request.body)
    expect(request.headers['X-CSRF-Token']).toEqual(expect.any(String))
    expect(requestBody).toMatchObject({
      action: 'change_password',
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      _csrf: request.headers['X-CSRF-Token']
    })
  })

  it('passes through change_password failure responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: { username: 'teacher' }
      })
    })

    const { useAuth } = await import('../useAuth')
    const auth = useAuth()
    await auth.initAuth()

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: false, message: '当前密码不正确' })
    })

    await expect(auth.changePassword('WrongPass123', 'NewPass123')).resolves.toEqual({
      success: false,
      message: '当前密码不正确'
    })
  })

  it('keeps deferred sync from consuming fetch mocks created after initAuth', async () => {
    vi.useFakeTimers()

    const firstFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { username: 'teacher' }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: {} })
      })

    globalThis.fetch = firstFetch
    const firstModule = await import('../useAuth')
    const firstAuth = firstModule.useAuth()
    await firstAuth.initAuth()

    vi.resetModules()

    const secondFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { username: 'teacher' }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, message: '密码已修改' })
      })

    globalThis.fetch = secondFetch
    await vi.advanceTimersByTimeAsync(100)

    const secondModule = await import('../useAuth')
    const secondAuth = secondModule.useAuth()
    await secondAuth.initAuth()
    const result = await secondAuth.changePassword('OldPass123', 'NewPass123')

    expect(result).toEqual({ success: true, message: '密码已修改' })
    expect(JSON.parse(secondFetch.mock.calls[0][1].body).action).toBe('verify')
    expect(JSON.parse(secondFetch.mock.calls[1][1].body).action).toBe('change_password')
  })
})
