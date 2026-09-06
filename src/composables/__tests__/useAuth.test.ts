// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const jsonResponse = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
})

const parseRequestBody = (init?: RequestInit) => {
  if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body')
  return JSON.parse(init.body) as Record<string, unknown>
}

const getRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object`)
  }
  return value as Record<string, unknown>
}

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
    vi.doUnmock('@/utils/crypto')
    vi.clearAllMocks()
    clearCookies()
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('persists encrypted WebDAV credentials for account sync without sending plaintext passwords', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      data: { username: 'teacher' }
    }))

    const { useAuth } = await import('../useAuth')
    const auth = useAuth()
    await auth.initAuth()

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: true }))

    await auth.updateSyncSettings({
      url: 'https://dav.example.com/root',
      username: 'dav-user',
      password: 'dav-secret'
    }, true)

    const requestBody = parseRequestBody(vi.mocked(fetch).mock.calls[1][1])
    const settings = getRecord(requestBody.settings, 'settings')
    const webdav = getRecord(settings.webdav, 'settings.webdav')
    expect(webdav).toMatchObject({
      url: 'https://dav.example.com/root',
      username: 'dav-user'
    })
    expect(webdav.password).toBeUndefined()
    expect(webdav.encryptedPassword).toEqual(expect.any(String))
  })

  it('sends change_password with csrf tokens and returns the api result', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      data: { username: 'teacher' }
    }))

    const { useAuth } = await import('../useAuth')
    const auth = useAuth()
    await auth.initAuth()

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: true, message: '密码已修改' }))

    const result = await auth.changePassword('OldPass123', 'NewPass123')

    expect(result).toEqual({ success: true, message: '密码已修改' })
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/auth.php')
    const request = vi.mocked(fetch).mock.calls[1][1]
    const requestBody = parseRequestBody(request)
    const csrfToken = new Headers(request?.headers).get('X-CSRF-Token')
    expect(csrfToken).toEqual(expect.any(String))
    expect(requestBody).toMatchObject({
      action: 'change_password',
      _csrf: csrfToken
    })
    expect(requestBody.currentPassword).toBeUndefined()
    expect(requestBody.newPassword).toBeUndefined()
    expect(requestBody.encryptedCurrentPassword).toEqual(expect.any(String))
    expect(requestBody.encryptedNewPassword).toEqual(expect.any(String))
  })

  it('falls back to plaintext password fields when transport encryption is unavailable', async () => {
    vi.doMock('@/utils/crypto', async () => {
      const actual = await vi.importActual<typeof import('@/utils/crypto')>('@/utils/crypto')
      return {
        ...actual,
        encryptPasswordForTransport: vi.fn().mockResolvedValue(null)
      }
    })

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      data: { username: 'teacher' }
    }))

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: true, data: {} }))

    const { useAuth } = await import('../useAuth')
    const auth = useAuth()
    const result = await auth.login('teacher', 'Pass1234')

    expect(result.success).toBe(true)
    const requestBody = parseRequestBody(vi.mocked(fetch).mock.calls[0][1])
    expect(requestBody).toMatchObject({
      action: 'login',
      username: 'teacher',
      password: 'Pass1234'
    })
    expect(requestBody.encryptedPassword).toBeUndefined()
  })

  it('rejects an invalid login username without making a request', async () => {
    const { useAuth } = await import('../useAuth')
    const result = await useAuth().login('非法 用户', 'Password1')

    expect(result).toEqual({ success: false, message: '用户名或密码不正确' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects an invalid registration username without making a request', async () => {
    const { useAuth } = await import('../useAuth')
    const result = await useAuth().register('非法 用户', 'Password1')

    expect(result).toEqual({ success: false, message: '用户名格式无效' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('passes through change_password failure responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      data: { username: 'teacher' }
    }))

    const { useAuth } = await import('../useAuth')
    const auth = useAuth()
    await auth.initAuth()

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: false, message: '当前密码不正确' }))

    await expect(auth.changePassword('WrongPass123', 'NewPass123')).resolves.toEqual({
      success: false,
      message: '当前密码不正确'
    })
  })

  it('keeps deferred sync from consuming fetch mocks created after initAuth', async () => {
    vi.useFakeTimers()

    const firstFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { username: 'teacher' }
      }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {} }))

    globalThis.fetch = firstFetch
    const firstModule = await import('../useAuth')
    const firstAuth = firstModule.useAuth()
    await firstAuth.initAuth()

    vi.resetModules()

    const secondFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { username: 'teacher' }
      }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: '密码已修改' }))

    globalThis.fetch = secondFetch
    await vi.advanceTimersByTimeAsync(100)

    const secondModule = await import('../useAuth')
    const secondAuth = secondModule.useAuth()
    await secondAuth.initAuth()
    const result = await secondAuth.changePassword('OldPass123', 'NewPass123')

    expect(result).toEqual({ success: true, message: '密码已修改' })
    expect(parseRequestBody(secondFetch.mock.calls[0][1]).action).toBe('verify')
    expect(parseRequestBody(secondFetch.mock.calls[1][1]).action).toBe('change_password')
  })
})
