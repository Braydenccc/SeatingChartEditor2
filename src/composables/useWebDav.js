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
  const request = async (config, path, options = {}) => {
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

    try {
      const response = await fetchWithRetry('/api/dav-proxy', {
        ...options,
        headers
      }, 2)

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('WebDAV 认证失败，请检查用户名和密码')
        }
        if (response.status === 403) {
          throw new Error('WebDAV 权限不足，请检查账户权限')
        }
        throw new Error(`WebDAV 请求失败 (${response.status})`)
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
    try {
      const response = await request(config, collPath, { method: 'MKCOL' })
      // 201 Created or 405 Method Not Allowed (Already exists)
      if (!response.ok && response.status !== 405 && response.status !== 409) {
        throw new Error(`创建文件夹失败 (${response.status})`)
      }
      return true
    } catch (e) {
      if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
        throw new Error('网络请求失败 (Failed to fetch)。请检查：1.URL是否正确；2.WebDAV服务器是否开启了CORS支持；3.路径重定向问题。')
      }
      throw e
    }
  }

  // 上传文件 (PUT)
  const putFile = async (config, path, content, contentType = 'text/plain') => {
    const response = await request(config, path, {
      method: 'PUT',
      body: content,
      headers: {
        'Content-Type': contentType
      }
    })
    
    if (!response.ok && response.status !== 201 && response.status !== 204) {
      throw new Error(`上传失败 (${response.status})`)
    }
    return true
  }

  // 下载文件 (GET)
  const getFileText = async (config, path) => {
    const response = await request(config, path, { method: 'GET' })
    if (response.status === 404) {
      return null
    }
    if (!response.ok) {
      throw new Error(`获取文件失败 (${response.status})`)
    }
    return await response.text()
  }

  // 删除文件 (DELETE)
  const deleteFile = async (config, path) => {
    const response = await request(config, path, { method: 'DELETE' })
    if (!response.ok && response.status !== 404) {
      throw new Error(`删除失败 (${response.status})`)
    }
    return true
  }

  // 获取目录内容 (PROPFIND)
  const listFiles = async (config, path) => {
    const collPath = path.endsWith('/') ? path : path + '/'
    let response
    try {
      response = await request(config, collPath, {
        method: 'PROPFIND',
        headers: {
          'Depth': '1'
        }
      })
    } catch (e) {
      if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
        throw new Error('请求失败(跨域/没有网络/协议不匹配等)。服务端需支持CORS。')
      }
      throw e
    }

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
