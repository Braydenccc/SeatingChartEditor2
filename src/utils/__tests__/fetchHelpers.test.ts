import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWithRetry } from '../fetchHelpers'

describe('fetchWithRetry cancellation and timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses one timeout budget and does not retry after it expires', async () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => undefined))
    const request = fetchWithRetry('https://dav.example.test/file', {}, 3, 1000, {
      timeoutMs: 40_000,
      fetcher
    })
    const rejection = expect(request).rejects.toThrow('请求超时')

    await vi.advanceTimersByTimeAsync(40_000)

    await rejection
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('keeps the total timeout active while the response body is being read', async () => {
    const response = new Response('workspace')
    vi.spyOn(response, 'arrayBuffer').mockReturnValue(new Promise<ArrayBuffer>(() => undefined))
    const fetcher = vi.fn(async () => response)
    const request = fetchWithRetry('https://dav.example.test/file', {}, 2, 1000, {
      timeoutMs: 40_000,
      fetcher
    })
    const rejection = expect(request).rejects.toThrow('请求超时')

    await vi.advanceTimersByTimeAsync(40_000)

    await rejection
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('preserves caller cancellation and does not retry it', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn(() => new Promise<Response>(() => undefined))
    const request = fetchWithRetry('https://dav.example.test/file', {
      signal: controller.signal
    }, 3, 1000, {
      timeoutMs: 40_000,
      fetcher
    })
    const reason = new DOMException('用户取消', 'AbortError')

    controller.abort(reason)

    await expect(request).rejects.toBe(reason)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not start a request when the caller signal is already canceled', async () => {
    const controller = new AbortController()
    const reason = new DOMException('用户取消', 'AbortError')
    controller.abort(reason)
    const fetcher = vi.fn()

    await expect(fetchWithRetry('https://dav.example.test/file', {
      signal: controller.signal
    }, 3, 1000, {
      timeoutMs: 40_000,
      fetcher
    })).rejects.toBe(reason)

    expect(fetcher).not.toHaveBeenCalled()
  })

  it('interrupts retry delay when the caller cancels', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const request = fetchWithRetry('https://dav.example.test/file', {
      signal: controller.signal
    }, 3, 1000, {
      timeoutMs: 40_000,
      fetcher
    })
    await vi.advanceTimersByTimeAsync(0)
    const reason = new DOMException('用户取消', 'AbortError')

    controller.abort(reason)

    await expect(request).rejects.toBe(reason)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
