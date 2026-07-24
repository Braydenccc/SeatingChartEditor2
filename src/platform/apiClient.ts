import { safeStorageGet, safeStorageSet } from '@/utils/storage'
import { isTauriRuntime } from './runtime'

const RETIEHE_API_BASE_KEY = 'sce-retiehe-api-base'
export const DEFAULT_RETIEHE_API_BASE = 'https://sce.jbyc.cc'
export const DEFAULT_API_TIMEOUT_MS = 20_000

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number
}

const cookieJars = new Map<string, Map<string, string>>()

const isAllowedLocalHttpHost = (hostname: string) => {
  const normalized = hostname.toLowerCase()
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}

export const normalizeRetieheApiBase = (baseUrl: string) => {
  const rawBase = String(baseUrl || '').trim()
  if (!rawBase) return ''

  let parsed: URL
  try {
    parsed = new URL(rawBase)
  } catch {
    throw new Error('SCE 云服务地址格式无效')
  }

  const isHttps = parsed.protocol === 'https:'
  const isAllowedLocalHttp = parsed.protocol === 'http:' && isAllowedLocalHttpHost(parsed.hostname)
  if (!isHttps && !isAllowedLocalHttp) {
    throw new Error('SCE 云服务地址必须使用 HTTPS；本机开发仅允许 localhost、127.0.0.1 或 ::1 使用 HTTP')
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('SCE 云服务地址不能包含凭据、查询参数或片段')
  }

  const pathname = parsed.pathname.replace(/\/+$/, '')
  return `${parsed.origin}${pathname === '/' ? '' : pathname}`
}

export const getRetieheApiBase = () => {
  const envBase = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_RETIEHE_API_BASE
  const storedBase = safeStorageGet(RETIEHE_API_BASE_KEY)
  try {
    return normalizeRetieheApiBase(String(storedBase || envBase || DEFAULT_RETIEHE_API_BASE))
  } catch {
    return ''
  }
}

export const setRetieheApiBase = (baseUrl: string) => {
  return safeStorageSet(RETIEHE_API_BASE_KEY, normalizeRetieheApiBase(baseUrl))
}

export const isRetieheApiReady = () => {
  return !isTauriRuntime() || !!getRetieheApiBase()
}

const resolveApiUrl = (path: string) => {
  if (!isTauriRuntime()) return path

  const base = getRetieheApiBase()
  if (!base) {
    throw new Error('桌面版尚未配置 SCE 云服务地址，请先在同步设置中填写 Retinbox API 地址')
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

const getCookieJar = (origin: string) => {
  let jar = cookieJars.get(origin)
  if (!jar) {
    jar = new Map<string, string>()
    cookieJars.set(origin, jar)
  }
  return jar
}

const splitSetCookieHeader = (value: string) => {
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]+)/g).map(item => item.trim()).filter(Boolean)
}

const storeSetCookieHeader = (origin: string, value: string | null) => {
  if (!value) return

  const cookieJar = getCookieJar(origin)

  splitSetCookieHeader(value).forEach(cookie => {
    const [pair, ...attrs] = cookie.split(';').map(part => part.trim())
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex <= 0) return

    const name = pair.slice(0, separatorIndex)
    const pairValue = pair.slice(separatorIndex + 1)
    const shouldDelete = attrs.some(attr => {
      const lower = attr.toLowerCase()
      return lower === 'max-age=0' || lower.startsWith('expires=thu, 01 jan 1970')
    })

    if (shouldDelete || pairValue === '') {
      cookieJar.delete(name)
    } else {
      cookieJar.set(name, pairValue)
    }
  })
}

const getHeaderValue = (headers: HeadersInit | undefined, name: string) => {
  if (!headers) return ''
  const lowerName = name.toLowerCase()
  if (headers instanceof Headers) return headers.get(name) || ''
  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key.toLowerCase() === lowerName)
    return match?.[1] || ''
  }
  const record = headers as Record<string, string>
  const key = Object.keys(record).find(item => item.toLowerCase() === lowerName)
  return key ? record[key] : ''
}

const toHeaders = (headers: HeadersInit | undefined) => {
  return new Headers(headers || {})
}

const buildCookieHeader = (origin: string, headers: Headers) => {
  const cookies: string[] = []
  const cookieJar = getCookieJar(origin)
  cookieJar.forEach((value, name) => {
    cookies.push(`${name}=${value}`)
  })

  const csrfToken = headers.get('X-CSRF-Token')
  if (csrfToken) {
    cookies.push(`sce_csrf=${csrfToken}`)
  }

  const existingCookie = headers.get('Cookie')
  if (existingCookie) {
    cookies.push(existingCookie)
  }

  return cookies.join('; ')
}

export const clearRetieheSessionCookies = () => {
  cookieJars.clear()
}

const isRetryableStatus = (status: number) => {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

const canRetryRequest = (method: string, headers: Headers) => {
  if (['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].includes(method)) return true
  return headers.has('Idempotency-Key') || headers.has('X-Idempotency-Key')
}

const getAbortReason = (signal: AbortSignal) => (
  signal.reason ?? new DOMException('请求已取消', 'AbortError')
)

const waitForRetry = (delay: number, callerSignal: AbortSignal | null | undefined): Promise<void> => {
  if (!callerSignal) {
    return new Promise(resolve => setTimeout(resolve, delay))
  }
  if (callerSignal.aborted) {
    return Promise.reject(getAbortReason(callerSignal))
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      callerSignal.removeEventListener('abort', abortFromCaller)
      resolve()
    }, delay)
    const abortFromCaller = () => {
      clearTimeout(timeoutId)
      callerSignal.removeEventListener('abort', abortFromCaller)
      reject(getAbortReason(callerSignal))
    }
    callerSignal.addEventListener('abort', abortFromCaller, { once: true })
  })
}

const createAttemptSignal = (callerSignal: AbortSignal | null | undefined, timeoutMs: number) => {
  const controller = new AbortController()
  let timedOut = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const abortFromCaller = () => controller.abort(callerSignal?.reason)
  if (callerSignal?.aborted) {
    abortFromCaller()
  } else if (callerSignal) {
    callerSignal.addEventListener('abort', abortFromCaller, { once: true })
  }

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort(new Error('请求超时'))
    }, timeoutMs)
  }

  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    cleanup: () => {
      if (timeoutId !== null) clearTimeout(timeoutId)
      callerSignal?.removeEventListener('abort', abortFromCaller)
    }
  }
}

const materializeResponse = async (response: Response, method: string) => {
  const statusHasNoBody = method === 'HEAD' || [101, 103, 204, 205, 304].includes(response.status)
  if (!statusHasNoBody) {
    await response.clone().arrayBuffer()
  }
  return response
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}, retries = 3, delay = 1000): Promise<Response> {
  const url = resolveApiUrl(path)
  const isTauri = isTauriRuntime()
  const headers = toHeaders(options.headers)
  const method = String(options.method || 'GET').toUpperCase()
  const maxRetries = canRetryRequest(method, headers) ? Math.max(0, retries) : 0
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(0, Number(options.timeoutMs))
    : DEFAULT_API_TIMEOUT_MS
  const { timeoutMs: _timeoutMs, signal: callerSignal, ...fetchOptions } = options
  const apiOrigin = isTauri ? new URL(url).origin : ''

  if (isTauri) {
    const cookieHeader = buildCookieHeader(apiOrigin, headers)
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader)
    }
  }

  const requestOptions: RequestInit = {
    ...fetchOptions,
    credentials: isTauri ? 'include' : (options.credentials || 'same-origin'),
    headers: isTauri ? headers : options.headers
  }

  for (let i = 0; i <= maxRetries; i++) {
    const attemptSignal = createAttemptSignal(callerSignal, timeoutMs)
    try {
      const fetcher = isTauri
        ? (await import('@tauri-apps/plugin-http')).fetch
        : globalThis.fetch.bind(globalThis)
      const response = await fetcher(url, { ...requestOptions, signal: attemptSignal.signal })
      if (isRetryableStatus(response.status) && i < maxRetries) {
        try {
          await response.body?.cancel()
        } catch {
          // The response is being discarded before retrying; abort/cancel errors are non-fatal here.
        }
        attemptSignal.cleanup()
        await waitForRetry(delay, callerSignal)
        continue
      }

      const setCookieHeader = isTauri
        ? response.headers.get('set-cookie') || response.headers.get('Set-Cookie')
        : null
      const materializedResponse = await materializeResponse(response, method)
      attemptSignal.cleanup()
      if (isTauri) {
        storeSetCookieHeader(apiOrigin, setCookieHeader)
      }
      return materializedResponse
    } catch (error) {
      const timedOut = attemptSignal.didTimeOut()
      attemptSignal.cleanup()
      if (callerSignal?.aborted) throw error
      if (i === maxRetries) {
        if (timedOut) throw new Error('请求超时')
        throw error
      }
      await waitForRetry(delay, callerSignal)
    }
  }

  throw new Error('网络请求失败')
}

export const hasCsrfHeader = (headers: HeadersInit | undefined) => {
  return !!getHeaderValue(headers, 'X-CSRF-Token')
}
