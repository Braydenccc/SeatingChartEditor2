import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/utils/fetchHelpers')
vi.mock('../useAuth')

import { fetchWithRetry } from '@/utils/fetchHelpers'
import { useAuth, getOrCreateCsrfToken } from '../useAuth'
import { useWebDav } from '../useWebDav'

describe('useWebDav', () => {
  const config = {
    url: 'https://dav.example.com/root',
    username: 'teacher',
    password: 'secret'
  }

  beforeEach(() => {
    vi.mocked(fetchWithRetry).mockReset()
    vi.mocked(getOrCreateCsrfToken).mockReturnValue('csrf-token')
    vi.mocked(useAuth).mockReturnValue({
      token: ref(null)
    })
  })

  it('uses direct WebDAV requests by default', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValueOnce({
      ok: true,
      status: 200
    })

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
    vi.mocked(fetchWithRetry).mockResolvedValueOnce({
      ok: true,
      status: 200
    })

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
    vi.mocked(fetchWithRetry).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const { getFileText } = useWebDav()

    await expect(getFileText(config, '/sce_data/a.sce')).rejects.toThrow('可登录 SCE 账号后启用安全中转')
    expect(fetchWithRetry).toHaveBeenCalledTimes(1)
    expect(fetchWithRetry.mock.calls[0][0]).toBe('https://dav.example.com/root/sce_data/a.sce')
  })

  it('falls back to the controlled proxy after direct CORS failure when SCE login exists', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: ref('cookie-session')
    })
    vi.mocked(fetchWithRetry)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('workspace')
      })

    const { getFileText } = useWebDav()
    await expect(getFileText(config, '/sce_data/a.sce')).resolves.toBe('workspace')

    expect(fetchWithRetry).toHaveBeenCalledTimes(2)
    expect(fetchWithRetry.mock.calls[1][0]).toBe('/api/dav-proxy.php')
    expect(fetchWithRetry.mock.calls[1][1]).toEqual(expect.objectContaining({
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
})
