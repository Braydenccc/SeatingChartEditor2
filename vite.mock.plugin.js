export function authMockPlugin() {
    return {
        name: 'auth-mock-plugin',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url === '/api/auth.php' && req.method === 'POST') {
                    let body = ''
                    req.on('data', chunk => body += chunk.toString())
                    req.on('end', async () => {
                        res.setHeader('Content-Type', 'application/json')
                        try {
                            const input = JSON.parse(body)
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

                            if (!username || !password) {
                                res.statusCode = 400;
                                return res.end(JSON.stringify({ success: false, message: '用户名和密码不能为空' }))
                            }

                            if (action === 'register') {
                                if (db[username]) {
                                    return res.end(JSON.stringify({ success: false, message: '该用户名已被注册' }))
                                }
                                const hash = await bcrypt.hash(password, 10)
                                db[username] = hash
                                await fs.writeFile(dbPath, JSON.stringify(db, null, 2))

                                const token = Buffer.from(`${username}:${Date.now()}`).toString('base64')
                                return res.end(JSON.stringify({
                                    success: true,
                                    message: '注册成功',
                                    data: { username, token }
                                }))
                            } else if (action === 'login') {
                                const existingHash = db[username]
                                if (!existingHash) {
                                    return res.end(JSON.stringify({ success: false, message: '用户名或密码不正确' }))
                                }

                                const isValid = await bcrypt.compare(password, existingHash)
                                if (isValid) {
                                    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64')
                                    return res.end(JSON.stringify({
                                        success: true,
                                        message: '登录成功',
                                        data: { username, token }
                                    }))
                                } else {
                                    return res.end(JSON.stringify({ success: false, message: '用户名或密码不正确' }))
                                }
                            } else {
                                return res.end(JSON.stringify({ success: false, message: 'Unknown action' }))
                            }
                        } catch (err) {
                            console.error(err)
                            res.statusCode = 500
                            return res.end(JSON.stringify({ success: false, message: 'Internal Server Error' }))
                        }
                    })
                    return
                }

                if (req.url === '/api/workspace.php' && req.method === 'POST') {
                    let body = ''
                    req.on('data', chunk => body += chunk.toString())
                    req.on('end', async () => {
                        res.setHeader('Content-Type', 'application/json')
                        try {
                            const input = JSON.parse(body)
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

                            const { action, username, token } = input
                            if (!username || !token) {
                                res.statusCode = 401;
                                return res.end(JSON.stringify({ success: false, message: '未授权的访问' }))
                            }

                            // Simple token validation (matching backend logic)
                            const expectedPrefix = username + ':'
                            const decodedToken = Buffer.from(token, 'base64').toString('utf8')
                            if (!decodedToken.startsWith(expectedPrefix)) {
                                res.statusCode = 401;
                                return res.end(JSON.stringify({ success: false, message: 'Token无效或已过期' }))
                            }

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
                            console.error(err)
                            res.statusCode = 500
                            return res.end(JSON.stringify({ success: false, message: 'Internal Server Error' }))
                        }
                    })
                    return
                }

                next()
            })
        }
    }
}
