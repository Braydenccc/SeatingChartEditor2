import { fetchWithRetry } from '@/utils/fetchHelpers'
import { getOrCreateCsrfToken, useAuth } from './useAuth'

export function useWebDav() {
  const bytesToBinaryString = (bytes) => {
    const chunkSize = 0x8000
    let result = ''
    for (let i = 0; i < bytes.length; i += chunkSize) {
      result += String.fromCodePoint(...bytes.subarray(i, i + chunkSize))
    }
    return result
  }

  const getAuthHeader = (username, password) => {
    const credentials = `${username}:${password}`
    // Support UTF-8 encoding for base64
    const bytes = new TextEncoder().encode(credentials)
    const binString = bytesToBinaryString(bytes)
    return 'Basic ' + btoa(binString)
  }

  const normalizeUrl = (url) => {
    return url.endsWith('/') ? url.slice(0, -1) : url
  }

  const buildDirectUrl = (config, path) => {
    const baseUrl = normalizeUrl(config.url)
    return path.startsWith('http') ? path : baseUrl + (path.startsWith('/') ? path : '/' + path)
  }

  const buildHeaders = (config, options = {}) => {
    const username = config.username || ''
    const password = config.password || ''
    const headers = {
      ...options.headers
    }

    if (username || password) {
      headers['Authorization'] = getAuthHeader(username, password)
    }

    return headers
  }

  const isNetworkOrCorsError = (error) => {
    return error?.name === 'TypeError' || error?.message?.includes('Failed to fetch')
  }

  const describeProxyFallback = () => {
    return 'WebDAV 服务器连接失败或不允许浏览器跨域访问。可登录 SCE 账号后启用安全中转，或使用桌面版/支持 CORS 的 WebDAV 服务。'
  }

  /**
   * 发起 WebDAV 请求
   */
  const request = async (config, path, options = {}, requestOptions = {}) => {
    if (!config || !config.url) throw new Error('WebDAV配置无效')

    const { noThrowStatuses = [] } = requestOptions
    const directUrl = buildDirectUrl(config, path)

    const handleResponse = (response) => {
      if (response.ok || noThrowStatuses.includes(response.status)) {
        return response
      }
      if (response.status === 401) {
        const authError = new Error('WebDAV 认证失败，请检查用户名和密码')
        authError.status = response.status
        throw authError
      }
      if (response.status === 403) {
        const permissionError = new Error('WebDAV 权限不足，请检查账户权限')
        permissionError.status = response.status
        throw permissionError
      }
      const requestError = new Error(`WebDAV 请求失败 (${response.status})`)
      requestError.status = response.status
      throw requestError
    }

    const fetchDirect = async () => {
      const response = await fetchWithRetry(directUrl, {
        ...options,
        headers: buildHeaders(config, options)
      }, 2)

      return handleResponse(response)
    }

    const fetchViaProxy = async () => {
      const { token } = useAuth()
      if (!token.value) {
        throw new Error(describeProxyFallback())
      }

      const csrfToken = getOrCreateCsrfToken()
      const response = await fetchWithRetry('/api/dav-proxy.php', {
        ...options,
        credentials: 'same-origin',
        headers: {
          ...buildHeaders(config, options),
          'x-dav-base-url': normalizeUrl(config.url),
          'x-dav-path': path.startsWith('http') ? `${new URL(path).pathname}${new URL(path).search}` : path,
          'X-CSRF-Token': csrfToken
        }
      }, 2)

      return handleResponse(response)
    }

    try {
      if (config.useProxy) {
        return await fetchViaProxy()
      }

      try {
        return await fetchDirect()
      } catch (error) {
        if (!isNetworkOrCorsError(error)) {
          throw error
        }
        return await fetchViaProxy()
      }
    } catch (error) {
      if (isNetworkOrCorsError(error)) {
        throw new Error(describeProxyFallback())
      }
      throw error
    }
  }

  // 创建文件夹 (MKCOL)
  const mkcol = async (config, path) => {
    const collPath = path.endsWith('/') ? path : path + '/'
    await request(config, collPath, { method: 'MKCOL' }, { noThrowStatuses: [405, 409] })
    return true
  }

  // 上传文件 (PUT)
  const putFile = async (config, path, content, contentType = 'text/plain') => {
    await request(config, path, {
      method: 'PUT',
      body: content,
      headers: {
        'Content-Type': contentType
      }
    })
    return true
  }

  // 下载文件 (GET)
  const getFileText = async (config, path) => {
    const response = await request(config, path, { method: 'GET' }, { noThrowStatuses: [404] })
    if (response.status === 404) {
      return null
    }
    return await response.text()
  }

  // 删除文件 (DELETE)
  const deleteFile = async (config, path) => {
    await request(config, path, { method: 'DELETE' }, { noThrowStatuses: [404] })
    return true
  }

  // 获取目录内容 (PROPFIND)
  const listFiles = async (config, path) => {
    const collPath = path.endsWith('/') ? path : path + '/'
    const response = await request(config, collPath, {
      method: 'PROPFIND',
      headers: {
        'Depth': '1'
      }
    }, { noThrowStatuses: [404] })

    if (response.status === 404) {
       return []
    }

    if (!response.ok) {
      throw new Error(`列出目录失败 (${response.status})`)
    }

    const text = await response.text()
    // 简单解析 XML，提取 href，不用 DOMParser 以防兼容性，或者使用 DOMParser
    // 浏览器环境可放心使用 DOMParser
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(text, 'text/xml')
    const responses = xmlDoc.getElementsByTagNameNS('*', 'response')
    const files = []

    for (let i = 0; i < responses.length; i++) {
        const hrefEl = responses[i].getElementsByTagNameNS('*', 'href')[0]
        if (!hrefEl) continue

        let href = decodeURIComponent(hrefEl.textContent)
        // 去除尾部斜杠比较
        const baseHref = href.endsWith('/') ? href.slice(0, -1) : href
        const targetPath = collPath.endsWith('/') ? collPath.slice(0, -1) : collPath

        // 排除当前目录本身
        if (!baseHref.endsWith(targetPath)) {
            // 只提取最后的文件名
            const parts = baseHref.split('/')
            let filename = parts[parts.length - 1]
            if (filename) {
                const propstat = responses[i].getElementsByTagNameNS('*', 'propstat')[0]
                const isCollection = propstat && propstat.textContent.includes('collection')
                
                let lastModified = ''
                let size = 0
                const lastModifiedEl = responses[i].getElementsByTagNameNS('*', 'getlastmodified')[0]
                const sizeEl = responses[i].getElementsByTagNameNS('*', 'getcontentlength')[0]
                
                if (lastModifiedEl) lastModified = lastModifiedEl.textContent
                if (sizeEl) size = parseInt(sizeEl.textContent) || 0

                files.push({
                    name: filename,
                    isCollection: href.endsWith('/') || isCollection,
                    href: href,
                    lastModified,
                    size
                })
            }
        }
    }
    return files
  }

  return {
    mkcol,
    putFile,
    getFileText,
    deleteFile,
    listFiles
  }
}
