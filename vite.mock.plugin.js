import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { isAllowedFuckSeatsProxyTarget } = require('./fuckseatsProxyHelper.cjs')

export function authMockPlugin() {
    return {
        name: 'auth-mock-plugin',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url === '/api/auth.php' && req.method === 'POST') {
                    handleRequestWithTimeout(req, res, handleAuthRequest)
                    return
                }
                
                if (req.url === '/api/workspace.php' && req.method === 'POST') {
                    handleRequestWithTimeout(req, res, handleWorkspaceRequest)
                    return
                }
                
                if (req.url.startsWith('/api/dav-proxy')) {
                    handleDavProxy(req, res)
                    return
                }

                if (req.url.startsWith('/api/fuckseats-proxy')) {
                    handleFuckSeatsProxy(req, res)
                    return
                }
                
                next()
            })
        }
    }
}

function parseCookies(req) {
    const header = req.headers.cookie || ''
    return Object.fromEntries(header.split(';').map(part => {
        const [name, ...rest] = part.trim().split('=')
        return [name, decodeURIComponent(rest.join('=') || '')]
    }).filter(([name]) => name))
}

function setAuthCookies(res, username, token) {
    res.setHeader('Set-Cookie', [
        `sce_username=${encodeURIComponent(username)}; Path=/; SameSite=Lax; HttpOnly`,
        `sce_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax; HttpOnly`
    ])
}

function clearAuthCookies(res) {
    res.setHeader('Set-Cookie', [
        'sce_username=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; HttpOnly',
        'sce_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; HttpOnly'
    ])
}

function getMockAuth(req) {
    const cookies = parseCookies(req)
    const username = cookies.sce_username || ''
    const token = cookies.sce_token || ''
    if (!username || !token) return null

    try {
        const decodedToken = Buffer.from(token, 'base64').toString('utf8')
        if (!decodedToken.startsWith(username + ':')) return null
        return { username, token }
    } catch (e) {
        return null
    }
}

function handleRequestWithTimeout(req, res, handler) {
    let body = ''
    let bodyComplete = false
    
    req.on('data', chunk => body += chunk.toString())
    req.on('end', async () => {
        bodyComplete = true
        await handler(req, res, body)
    })
    
    // 超时保护：如果 2 秒内没有收到 end 事件，就用空 body 处理
    setTimeout(async () => {
        if (!bodyComplete) {
            bodyComplete = true
            await handler(req, res, body)
        }
    }, 2000)
}

async function handleAuthRequest(req, res, body) {
    res.setHeader('Content-Type', 'application/json')
    
    try {
        // CSRF double-submit cookie validation (mirrors auth.php logic)
        const csrfHeader = req.headers['x-csrf-token'] || ''
        const cookieHeader = req.headers['cookie'] || ''
        const csrfCookieMatch = cookieHeader.match(/(?:^|;\s*)sce_csrf=([^;]+)/)
        const csrfCookie = csrfCookieMatch ? decodeURIComponent(csrfCookieMatch[1]) : null
        let csrfBodyToken = null
        try { csrfBodyToken = body ? JSON.parse(body)._csrf || null : null } catch(e) {}
        const csrfMatched = csrfHeader !== '' && csrfBodyToken && csrfCookie && csrfHeader === csrfBodyToken && csrfHeader === csrfCookie
        
        if (!csrfMatched) {
            res.statusCode = 403
            return res.end(JSON.stringify({ success: false, message: 'CSRF验证失败' }))
        }

        const input = body ? JSON.parse(body) : {}
        const fs = await import('fs/promises')
        const path = await import('path')
        const bcrypt = await import('bcryptjs')

        const dbPath = path.resolve('.local-users.json')
        let db = {}
        try {
            const data = await fs.readFile(dbPath, 'utf8')
            db = JSON.parse(data)
        } catch (e) {
            // file not exists, use empty db
        }

        const { action, username, password } = input

        if (action === 'register') {
            if (!username || !password) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ success: false, message: '用户名和密码不能为空' }))
            }
            if (db[username]) {
                return res.end(JSON.stringify({ success: false, message: '该用户名已被注册' }))
            }
            const hash = await bcrypt.hash(password, 10)
            db[username] = hash
            await fs.writeFile(dbPath, JSON.stringify(db, null, 2))

            const token = Buffer.from(`${username}:${Date.now()}`).toString('base64')
            setAuthCookies(res, username, token)
            return res.end(JSON.stringify({
                success: true,
                message: '注册成功',
                data: { username }
            }))
        } else if (action === 'login') {
            if (!username || !password) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ success: false, message: '用户名和密码不能为空' }))
            }
            const existingHash = db[username]
            if (!existingHash) {
                return res.end(JSON.stringify({ success: false, message: '用户名或密码不正确' }))
            }

            const isValid = await bcrypt.compare(password, existingHash)
            if (isValid) {
                const token = Buffer.from(`${username}:${Date.now()}`).toString('base64')
                setAuthCookies(res, username, token)
                return res.end(JSON.stringify({
                    success: true,
                    message: '登录成功',
                    data: { username }
                }))
            } else {
                return res.end(JSON.stringify({ success: false, message: '用户名或密码不正确' }))
            }
        } else if (action === 'verify') {
            const auth = getMockAuth(req)
            if (!auth) {
                res.statusCode = 401
                return res.end(JSON.stringify({ success: false, message: '未登录' }))
            }
            return res.end(JSON.stringify({ success: true, data: { username: auth.username } }))
        } else if (action === 'logout') {
            clearAuthCookies(res)
            return res.end(JSON.stringify({ success: true, message: '登出成功' }))
        } else if (action === 'set_settings' || action === 'get_settings') {
            const auth = getMockAuth(req)
            if (!auth) {
                res.statusCode = 401;
                return res.end(JSON.stringify({ success: false, message: '未授权的访问' }))
            }
            const settingsUsername = auth.username

            const settingsDbPath = path.resolve('.local-users-settings.json')
            let settingsDb = {}
            try {
                const data = await fs.readFile(settingsDbPath, 'utf8')
                settingsDb = JSON.parse(data)
            } catch (e) {
                // file not exists, use empty db
            }

            if (action === 'set_settings') {
                const settings = input.settings || {}
                if (settings.webdav) {
                    delete settings.webdav.password
                }
                settingsDb[settingsUsername] = settings
                await fs.writeFile(settingsDbPath, JSON.stringify(settingsDb, null, 2))
                return res.end(JSON.stringify({ success: true, message: '设置已保存' }))
            } else {
                return res.end(JSON.stringify({ success: true, data: settingsDb[settingsUsername] || null }))
            }
        } else {
            return res.end(JSON.stringify({ success: false, message: 'Unknown action' }))
        }
    } catch (err) {
        console.error('[Auth Mock Error]', err.message, err.stack)
        res.statusCode = 500
        return res.end(JSON.stringify({ success: false, message: 'Internal Server Error: ' + err.message }))
    }
}

async function handleWorkspaceRequest(req, res, body) {
    res.setHeader('Content-Type', 'application/json')
    try {
        const input = body ? JSON.parse(body) : {}
        const fs = await import('fs/promises')
        const path = await import('path')

        // DB for users (user files list)
        const usersDbPath = path.resolve('.local-users.json')
        let usersDb = {}
        try {
            const data = await fs.readFile(usersDbPath, 'utf8')
            usersDb = JSON.parse(data)
        } catch (e) {
            // Ignore
        }

        // DB for scefiles (actual file content)
        const filesDbPath = path.resolve('.local-scefiles.json')
        let filesDb = {}
        try {
            const data = await fs.readFile(filesDbPath, 'utf8')
            filesDb = JSON.parse(data)
        } catch (e) {
            // Ignore
        }

        const auth = getMockAuth(req)
        if (!auth) {
            res.statusCode = 401;
            return res.end(JSON.stringify({ success: false, message: '未授权的访问' }))
        }
        const { action } = input
        const username = auth.username

        const userFilesKey = username + '_files'

        if (action === 'save') {
            const name = input.name || '未命名工作区'
            const content = input.content
            if (!content) {
                return res.end(JSON.stringify({ success: false, message: '工作区内容不能为空' }))
            }

            const fileId = input.fileId || 'ws_' + Date.now() + Math.random().toString(36).substring(7)

            const metadata = {
                author: username,
                name: name,
                time: new Date().toISOString(),
                size: content.length
            }

            filesDb[fileId] = JSON.stringify({ metadata, content })
            await fs.writeFile(filesDbPath, JSON.stringify(filesDb, null, 2))

            if (!usersDb[userFilesKey]) {
                usersDb[userFilesKey] = []
            }
            if (!usersDb[userFilesKey].includes(fileId)) {
                usersDb[userFilesKey].push(fileId)
                await fs.writeFile(usersDbPath, JSON.stringify(usersDb, null, 2))
            }

            return res.end(JSON.stringify({
                success: true,
                message: '保存成功',
                data: { fileId, metadata }
            }))

        } else if (action === 'list') {
            const fileIds = usersDb[userFilesKey] || []
            const list = []

            for (const fileId of fileIds) {
                if (filesDb[fileId]) {
                    const fileData = JSON.parse(filesDb[fileId])
                    if (fileData && fileData.metadata && fileData.metadata.author === username) {
                        list.push({
                            fileId,
                            metadata: fileData.metadata
                        })
                    }
                }
            }

            list.sort((a, b) => new Date(b.metadata.time) - new Date(a.metadata.time))

            return res.end(JSON.stringify({ success: true, data: list }))

        } else if (action === 'load') {
            const fileId = input.fileId
            if (!fileId) return res.end(JSON.stringify({ success: false, message: '缺少 fileId' }))

            if (!filesDb[fileId]) {
                return res.end(JSON.stringify({ success: false, message: '文件不存在或已被删除' }))
            }

            const fileData = JSON.parse(filesDb[fileId])
            if (fileData.metadata.author !== username) {
                return res.end(JSON.stringify({ success: false, message: '无权访问该文件' }))
            }

            return res.end(JSON.stringify({ success: true, data: fileData }))

        } else if (action === 'delete') {
            const fileId = input.fileId
            if (!fileId) return res.end(JSON.stringify({ success: false, message: '缺少 fileId' }))

            if (filesDb[fileId]) {
                const fileData = JSON.parse(filesDb[fileId])
                if (fileData.metadata.author === username) {
                    delete filesDb[fileId]
                    await fs.writeFile(filesDbPath, JSON.stringify(filesDb, null, 2))

                    if (usersDb[userFilesKey]) {
                        usersDb[userFilesKey] = usersDb[userFilesKey].filter(id => id !== fileId)
                        await fs.writeFile(usersDbPath, JSON.stringify(usersDb, null, 2))
                    }

                    return res.end(JSON.stringify({ success: true, message: '文件已删除' }))
                } else {
                    return res.end(JSON.stringify({ success: false, message: '无权删除该文件或文件损坏' }))
                }
            } else {
                if (usersDb[userFilesKey]) {
                    usersDb[userFilesKey] = usersDb[userFilesKey].filter(id => id !== fileId)
                    await fs.writeFile(usersDbPath, JSON.stringify(usersDb, null, 2))
                }
                return res.end(JSON.stringify({ success: true, message: '文件已被移除' }))
            }
        } else {
            return res.end(JSON.stringify({ success: false, message: 'Unknown action' }))
        }

    } catch (err) {
        console.error('[Auth Mock Error]', err.message, err.stack)
        res.statusCode = 500
        return res.end(JSON.stringify({ success: false, message: 'Internal Server Error: ' + err.message }))
    }
}

async function handleDavProxy(req, res) {
    const auth = getMockAuth(req)
    const cookies = parseCookies(req)
    if (!auth) {
        res.statusCode = 401
        return res.end(JSON.stringify({ success: false, message: '未授权的访问' }))
    }
    if (!req.headers['x-csrf-token'] || req.headers['x-csrf-token'] !== cookies.sce_csrf) {
        res.statusCode = 403
        return res.end(JSON.stringify({ success: false, message: 'CSRF 校验失败' }))
    }

    const davBaseUrl = req.headers['x-dav-base-url']
    const davPath = req.headers['x-dav-path']
    if (!davBaseUrl || !davPath) {
        res.statusCode = 400
        return res.end('Missing WebDAV proxy headers')
    }
    try {
        const targetUrl = new URL(String(davPath).replace(/^\/?/, '/'), String(davBaseUrl).replace(/\/+$/, '') + '/')
        if (targetUrl.protocol !== 'https:') {
            res.statusCode = 400
            return res.end('Only HTTPS WebDAV URLs are allowed')
        }
        const options = {
            hostname: targetUrl.hostname,
            port: targetUrl.port,
            path: targetUrl.pathname + targetUrl.search,
            method: req.method,
            headers: { ...req.headers }
        }
        delete options.headers['host']
        delete options.headers['x-dav-base-url']
        delete options.headers['x-dav-path']
        delete options.headers['x-csrf-token']
        delete options.headers['connection']
        delete options.headers['origin']
        delete options.headers['referer']
        delete options.headers['cookie']

        const https = await import('https')

        const proxyReq = https.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers)
            proxyRes.pipe(res, { end: true })
        })
        proxyReq.on('error', (err) => {
            console.error('WebDAV Proxy Error:', err)
            res.statusCode = 502
            res.end('Proxy error: ' + err.message)
        })
        req.pipe(proxyReq, { end: true })
    } catch (err) {
        console.error('Invalid URL:', err)
        res.statusCode = 400
        res.end('Invalid URL')
    }
}

async function handleFuckSeatsProxy(req, res) {
    if (req.method !== 'GET') {
        res.statusCode = 405
        return res.end('Method Not Allowed')
    }

    try {
        const currentUrl = new URL(req.url, 'http://127.0.0.1')
        const target = currentUrl.searchParams.get('target') || ''
        const targetUrl = new URL(target)

        if (!isAllowedFuckSeatsProxyTarget(targetUrl)) {
            res.statusCode = 400
            return res.end('Invalid local target')
        }

        const http = await import('http')
        const proxyReq = http.request({
            hostname: targetUrl.hostname,
            port: targetUrl.port,
            path: targetUrl.pathname + targetUrl.search,
            method: 'GET',
            headers: {
                Accept: req.headers.accept || 'application/json, text/plain, */*',
                'User-Agent': 'SeatingChartEditor-local-import'
            }
        }, (proxyRes) => {
            res.statusCode = proxyRes.statusCode || 502
            res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/plain; charset=utf-8')
            proxyRes.pipe(res, { end: true })
        })

        proxyReq.setTimeout(3500, () => {
            proxyReq.destroy(new Error('Local proxy timeout'))
        })
        proxyReq.on('error', (err) => {
            if (res.headersSent) return
            res.statusCode = 502
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('Proxy error: ' + err.message)
        })
        proxyReq.end()
    } catch (err) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end('Invalid local proxy request')
    }
}
