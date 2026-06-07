import { safeStorageGet, safeStorageSet } from '@/utils/storage'
import { isTauriRuntime } from './runtime'

const RETIEHE_API_BASE_KEY = 'sce-retiehe-api-base'
const cookieJar = new Map<string, string>()

export const getRetieheApiBase = () => {
  const envBase = import.meta.env.VITE_RETIEHE_API_BASE
  const storedBase = safeStorageGet(RETIEHE_API_BASE_KEY)
  return String(envBase || storedBase || '').trim().replace(/\/+$/, '')
}

export const setRetieheApiBase = (baseUrl: string) => {
  return safeStorageSet(RETIEHE_API_BASE_KEY, String(baseUrl || '').trim().replace(/\/+$/, ''))
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

const splitSetCookieHeader = (value: string) => {
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]+)/g).map(item => item.trim()).filter(Boolean)
}

const storeSetCookieHeader = (value: string | null) => {
  if (!value) return

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

const buildCookieHeader = (headers: Headers) => {
  const cookies: string[] = []
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
  cookieJar.clear()
}

export async function apiFetch(path: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<Response> {
  const url = resolveApiUrl(path)
  const isTauri = isTauriRuntime()
  const headers = toHeaders(options.headers)

  if (isTauri) {
    const cookieHeader = buildCookieHeader(headers)
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader)
    }
  }

  const requestOptions: RequestInit = {
    ...options,
    credentials: isTauri ? 'include' : (options.credentials || 'same-origin'),
    headers: isTauri ? headers : options.headers
  }

  for (let i = 0; i <= retries; i++) {
    try {
      const fetcher = isTauri
        ? (await import('@tauri-apps/plugin-http')).fetch
        : globalThis.fetch.bind(globalThis)
      const response = await fetcher(url, requestOptions)
      if (isTauri) {
        storeSetCookieHeader(response.headers.get('set-cookie') || response.headers.get('Set-Cookie'))
      }
      if (!response.ok && i < retries) {
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      return response
    } catch (error) {
      if (i === retries) throw error
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('网络请求失败')
}

export const hasCsrfHeader = (headers: HeadersInit | undefined) => {
  return !!getHeaderValue(headers, 'X-CSRF-Token')
}
