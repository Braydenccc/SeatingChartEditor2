import { ref } from 'vue'
import { useAuth } from './useAuth'
import { useWebDav } from './useWebDav'
import { getOrCreateCsrfToken } from './useAuth'

export function useCloudWorkspace() {
    const { currentUser, token, authType, webdavConfig, backupMode } = useAuth()
    const { listFiles, putFile, getFileText, deleteFile } = useWebDav()
    const isFetching = ref(false)

    // 获取与更新 WebDAV 设置 (例如导出路径)
    const loadCloudSettings = async () => {
        if (authType.value === 'webdav' && webdavConfig.value) {
            try {
                const text = await getFileText(webdavConfig.value, '/sce_data/settings.json')
                if (text) {
                    return JSON.parse(text)
                }
            } catch (err) {
                // Not found or error, return empty object implicitly below
            }
        }
        return {}
    }

    const saveCloudSettings = async (settingsObj) => {
        if (authType.value === 'webdav' && webdavConfig.value) {
            try {
                await putFile(webdavConfig.value, '/sce_data/settings.json', JSON.stringify(settingsObj, null, 2), 'application/json')
                return { success: true }
            } catch (err) {
                console.error(err)
                return { success: false, message: '保存设置失败' }
            }
        }
        return { success: false, message: '仅WebDAV支持同步设置' }
    }

    // Helper to call the workspace api
    const callWorkspaceApi = async (action, payload = {}) => {
        if (!currentUser.value || !token.value) {
            return { success: false, message: '请先登录' }
        }

        try {
            isFetching.value = true
            const response = await fetch('/api/workspace.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getOrCreateCsrfToken()
                },
                body: JSON.stringify({
                    action,
                    username: currentUser.value.username,
                    token: token.value,
                    ...payload
                })
            })

            if (!response.ok) {
                let errorMsg = `HTTP Error: ${response.status}`
                try {
                    const errorData = await response.json()
                    errorMsg = errorData.message || errorMsg
                } catch (e) { }
                throw new Error(errorMsg)
            }

            const result = await response.json()
            return result
        } catch (err) {
            console.error('Workspace API Error:', err)
            return { success: false, message: err.message || '网络请求失败' }
        } finally {
            isFetching.value = false
        }
    }

    // List user workspaces
    const listWorkspaces = async () => {
        const tasks = []
        
        if (webdavConfig.value && !(backupMode.value && currentUser.value)) {
            tasks.push((async () => {
                try {
                    const files = await listFiles(webdavConfig.value, '/sce_data')
                    return {
                        success: true,
                        source: 'webdav',
                        data: files.filter(f => !f.isCollection && f.name.endsWith('.sce')).map(f => {
                            const nameWithoutExt = f.name.substring(0, f.name.length - 4)
                            return {
                                fileId: f.name,
                                source: 'webdav',
                                metadata: {
                                    name: nameWithoutExt,
                                    time: f.lastModified || new Date().toISOString(),
                                    size: f.size
                                }
                            }
                        })
                    }
                } catch (err) {
                    return { success: false, source: 'webdav', message: err.message || '获取WebDAV列表失败' }
                }
            })())
        }
        
        if (currentUser.value && token.value) {
            tasks.push((async () => {
                const res = await callWorkspaceApi('list')
                if (res.success && res.data) {
                    res.data.forEach(item => item.source = 'retiehe')
                }
                res.source = 'retiehe'
                return res
            })())
        }
        
        if (tasks.length === 0) return { success: false, message: '请先登录云端账户' }
        
        // 不在这里操作 isFetching，避免和 callWorkspaceApi 内部的竞态。
        // isFetching 由 callWorkspaceApi 统一管理其 SCE 路径；WebDAV 不需要这个全局状态。
        const results = await Promise.all(tasks)
        
        let allData = []
        let errors = []
        
        results.forEach(res => {
            if (res.success && res.data) {
                allData = allData.concat(res.data)
            } else if (!res.success) {
                errors.push(res.message)
            }
        })
        
        return { 
            success: allData.length > 0 || errors.length === 0, 
            data: allData, 
            message: errors.join('; ') 
        }
    }

    // Save a workspace
    const saveWorkspaceToCloud = async (name, content, fileId = null, target = authType.value) => {
        const parsedContent = typeof content === 'string' ? JSON.parse(content) : content
        const jsonStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
        
        if (target === 'webdav' && !(backupMode.value && currentUser.value)) {
            if (!webdavConfig.value) return { success: false, message: '请先连接 WebDAV' }
            isFetching.value = true
            try {
                const targetFileId = fileId || `${name}.sce`
                await putFile(webdavConfig.value, `/sce_data/${targetFileId}`, jsonStr, 'application/json')
                return { success: true }
            } catch (err) {
                console.error(err)
                return { success: false, message: err.message || '保存失败' }
            } finally {
                isFetching.value = false
            }
        }

        const primaryResult = await callWorkspaceApi('save', {
            name,
            content: parsedContent,
            fileId
        })

        if (primaryResult.success && backupMode.value && webdavConfig.value) {
            const targetFileId = primaryResult.data?.fileId || fileId || `${name}.sce`
            putFile(webdavConfig.value, `/sce_data/${targetFileId}`, jsonStr, 'application/json').catch(e => {
                console.error('静默备份到WebDAV失败:', e)
            })
        }

        return primaryResult
    }

    // Load a workspace by ID
    const loadWorkspaceFromCloud = async (fileId, source = authType.value) => {
        if (source === 'webdav') {
            if (!webdavConfig.value) return { success: false, message: '请先连接 WebDAV' }
            isFetching.value = true
            try {
                const text = await getFileText(webdavConfig.value, `/sce_data/${fileId}`)
                if (!text) throw new Error('文件不存在')
                return {
                    success: true,
                    data: { content: text }
                }
            } catch (err) {
                console.error(err)
                return { success: false, message: err.message || '加载失败' }
            } finally {
                isFetching.value = false
            }
        }
        return await callWorkspaceApi('load', { fileId })
    }

    // Delete a workspace
    const deleteWorkspaceFromCloud = async (fileId, source = authType.value) => {
        if (source === 'webdav' && !(backupMode.value && currentUser.value)) {
            if (!webdavConfig.value) return { success: false, message: '请先连接 WebDAV' }
            isFetching.value = true
            try {
                await deleteFile(webdavConfig.value, `/sce_data/${fileId}`)
                return { success: true }
            } catch (err) {
                console.error(err)
                return { success: false, message: err.message || '删除失败' }
            } finally {
                isFetching.value = false
            }
        }
        
        const primaryResult = await callWorkspaceApi('delete', { fileId })
        
        if (primaryResult.success && backupMode.value && webdavConfig.value) {
            deleteFile(webdavConfig.value, `/sce_data/${fileId}`).catch(e => {
                console.log('WebDAV静默删除文件失败:', e)
            })
        }
        
        return primaryResult
    }

    return {
        isFetching,
        listWorkspaces,
        saveWorkspaceToCloud,
        loadWorkspaceFromCloud,
        deleteWorkspaceFromCloud,
        loadCloudSettings,
        saveCloudSettings
    }
}
