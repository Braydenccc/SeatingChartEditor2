import { fetchWithRetry } from '@/utils/fetchHelpers'
import { isTauriRuntime } from './runtime'

export const WEBDAV_REQUEST_TIMEOUT_MS = 40_000

export const isAllowedTauriHttpUrl = (url: string) => {
  const parsed = new URL(url)
  if (parsed.protocol === 'https:') return true
  if (parsed.protocol !== 'http:') return false
  return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
}

export async function webdavFetch(url: string, options: RequestInit, retries = 2): Promise<Response> {
  if (isTauriRuntime()) {
    if (!isAllowedTauriHttpUrl(url)) {
      throw new Error('桌面版 WebDAV 默认仅允许 HTTPS 地址，HTTP 仅允许 localhost/127.0.0.1')
    }
    const { fetch } = await import('@tauri-apps/plugin-http')
    return await fetchWithRetry(url, options, retries, 1000, {
      timeoutMs: WEBDAV_REQUEST_TIMEOUT_MS,
      fetcher: fetch
    })
  }

  return await fetchWithRetry(url, options, retries, 1000, {
    timeoutMs: WEBDAV_REQUEST_TIMEOUT_MS
  })
}
