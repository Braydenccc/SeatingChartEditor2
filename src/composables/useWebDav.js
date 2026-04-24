import { ref } from 'vue'
import { fetchWithRetry } from '@/utils/fetchHelpers'

const WEBDAV_CONFIG_KEY = 'sce_webdav_config'

export function useWebDav() {
  const getAuthHeader = (username, password) => {
    const credentials = `${username}:${password}`
    // Support UTF-8 encoding for base64
    const bytes = new TextEncoder().encode(credentials)
    const binString = String.fromCodePoint(...bytes)
    return 'Basic ' + btoa(binString)
  }

  const normalizeUrl = (url) => {
    return url.endsWith('/') ? url.slice(0, -1) : url
  }

  /**
   * 发起 WebDAV 请求
   */
  const request = async (config, path, options = {}, requestOptions = {}) => {
    if (!config || !config.url) throw new Error('WebDAV配置无效')

    const baseUrl = normalizeUrl(config.url)
    const fullUrl = path.startsWith('http') ? path : baseUrl + (path.startsWith('/') ? path : '/' + path)
    const username = config.username || ''
    const password = config.password || ''

    const headers = {
      ...options.headers,
      'x-dav-url': fullUrl
    }

    if (username || password) {
      headers['Authorization'] = getAuthHeader(username, password)
    }

    const { noThrowStatuses = [] } = requestOptions

    try {
      const response = await fetchWithRetry('/api/dav-proxy', {
        ...options,
        headers
      }, 2)

      if (!response.ok) {
        if (noThrowStatuses.includes(response.status)) {
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

      return response
    } catch (error) {
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        throw new Error('WebDAV 服务器连接失败，请检查网络或 CORS 配置')
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
