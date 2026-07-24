// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tauriFetchMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: tauriFetchMock
}))

describe('apiClient', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    tauriFetchMock.mockReset()
    delete window.__TAURI_INTERNALS__
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('uses the bundled SCE cloud address by default', async () => {
    const { DEFAULT_RETIEHE_API_BASE, getRetieheApiBase } = await import('../apiClient')

    expect(getRetieheApiBase()).toBe(DEFAULT_RETIEHE_API_BASE)
  })

  it('allows a saved desktop address to override the bundled default', async () => {
    const { getRetieheApiBase, setRetieheApiBase } = await import('../apiClient')

    setRetieheApiBase('https://custom.example.com/')

    expect(getRetieheApiBase()).toBe('https://custom.example.com')
  })

  it('rejects insecure remote API addresses but allows localhost development', async () => {
    const { getRetieheApiBase, setRetieheApiBase } = await import('../apiClient')

    expect(() => setRetieheApiBase('http://api.example.com')).toThrow('必须使用 HTTPS')
    expect(() => setRetieheApiBase('https://user:pass@example.com')).toThrow('不能包含凭据')

    setRetieheApiBase('http://localhost:5173/')
    expect(getRetieheApiBase()).toBe('http://localhost:5173')
  })

  it('keeps Tauri session cookies isolated by normalized API origin', async () => {
    window.__TAURI_INTERNALS__ = {}
    const { apiFetch, setRetieheApiBase } = await import('../apiClient')
    const cookieResponse = new Response('{}', { status: 200 })
    const getCookieResponseHeader = cookieResponse.headers.get.bind(cookieResponse.headers)
    vi.spyOn(cookieResponse.headers, 'get').mockImplementation(name => name.toLowerCase() === 'set-cookie'
      ? 'sce_username=alice; Path=/; HttpOnly, sce_token=official-secret; Path=/; HttpOnly'
      : getCookieResponseHeader(name))
    tauriFetchMock
      .mockResolvedValueOnce(cookieResponse)
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    setRetieheApiBase('https://sce.example.com/api')
    await apiFetch('/api/auth.php', { method: 'POST' }, 0)

    setRetieheApiBase('https://attacker.example.com')
    await apiFetch('/api/auth.php', { method: 'POST' }, 0)
    const attackerHeaders = tauriFetchMock.mock.calls[1][1]?.headers as Headers
    expect(attackerHeaders.get('Cookie')).toBeNull()

    setRetieheApiBase('https://sce.example.com/other-path')
    await apiFetch('/api/auth.php', { method: 'POST' }, 0)
    const originalOriginHeaders = tauriFetchMock.mock.calls[2][1]?.headers as Headers
    expect(originalOriginHeaders.get('Cookie')).toContain('sce_token=official-secret')
  })

  it('only retries retryable POST responses when an idempotency key is present', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { apiFetch } = await import('../apiClient')

    const withoutKey = await apiFetch('/api/workspace.php', { method: 'POST' }, 3, 0)
    expect(withoutKey.status).toBe(503)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockReset()
    const retryResponse = new Response('{}', { status: 503 })
    const cancelRetryBody = vi.spyOn(retryResponse.body!, 'cancel')
    fetchMock
      .mockResolvedValueOnce(retryResponse)
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const withKey = await apiFetch('/api/workspace.php', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'stable-operation' }
    }, 3, 0)
    expect(withKey.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(cancelRetryBody).toHaveBeenCalledOnce()
  })

  it('interrupts response retry delay when the caller cancels', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const { apiFetch } = await import('../apiClient')
    const request = apiFetch('/api/workspace.php', { signal: controller.signal }, 3, 1000)
    await vi.advanceTimersByTimeAsync(0)
    const reason = new DOMException('用户取消', 'AbortError')
    const assertion = expect(request).rejects.toBe(reason)

    controller.abort(reason)

    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('interrupts failure retry delay when the caller cancels', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)
    const { apiFetch } = await import('../apiClient')
    const request = apiFetch('/api/workspace.php', { signal: controller.signal }, 3, 1000)
    await vi.advanceTimersByTimeAsync(0)
    const reason = new DOMException('用户取消', 'AbortError')
    const assertion = expect(request).rejects.toBe(reason)

    controller.abort(reason)

    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('composes the caller signal with a finite request timeout', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: string, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { apiFetch } = await import('../apiClient')

    const request = apiFetch('/api/slow.php', { timeoutMs: 25 }, 0)
    const assertion = expect(request).rejects.toThrow('请求超时')
    await vi.advanceTimersByTimeAsync(25)
    await assertion
  })

  it('keeps the timeout active while materializing a slow response body', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: string, options?: RequestInit) => Promise.resolve(new Response(new ReadableStream({
      start(controller) {
        options?.signal?.addEventListener('abort', () => controller.error(options.signal?.reason), { once: true })
      }
    }))))
    vi.stubGlobal('fetch', fetchMock)
    const { apiFetch } = await import('../apiClient')

    const request = apiFetch('/api/slow-body.php', { timeoutMs: 25 }, 0)
    const assertion = expect(request).rejects.toThrow('请求超时')
    await vi.advanceTimersByTimeAsync(25)
    await assertion
  })
})
