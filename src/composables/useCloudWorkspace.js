import { ref, computed } from 'vue'
import { useAuth } from './useAuth'
import { useWebDav } from './useWebDav'
import { getOrCreateCsrfToken } from './useAuth'
import { useLogger } from './useLogger'
import { apiFetch } from '@/platform/apiClient'

const workspaceFormatErrorMessage = '工作区数据格式错误'

export function useCloudWorkspace() {
    const { currentUser, token, authType, webdavConfig, backupMode } = useAuth()
    const { listFiles, putFile, getFileText, deleteFile } = useWebDav()
    const { error } = useLogger()
    const fetchingCount = ref(0)
    const isFetching = computed(() => fetchingCount.value > 0)

    const startFetch = () => fetchingCount.value++
    const endFetch = () => {
        if (fetchingCount.value > 0) fetchingCount.value--
    }

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
            startFetch()
            const csrfToken = getOrCreateCsrfToken()
            const response = await apiFetch('/api/workspace.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    action,
                    _csrf: csrfToken,
                    ...payload
                })
            }, 3)

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
            endFetch()
        }
    }

    // List user workspaces
    const listWorkspaces = async () => {
        const tasks = []
        
        if (webdavConfig.value && !(backupMode.value && token.value)) {
            tasks.push((async () => {
                startFetch()
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
                } finally {
                    endFetch()
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
        let parsedContent
        try {
            parsedContent = typeof content === 'string' ? JSON.parse(content) : content
        } catch (e) {
            console.error('Failed to parse workspace content:', e)
            error(workspaceFormatErrorMessage)
            return { success: false, message: workspaceFormatErrorMessage, error: workspaceFormatErrorMessage }
        }
        const jsonStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2)

        if (target === 'webdav' && !(backupMode.value && token.value)) {
            if (!webdavConfig.value) return { success: false, message: '请先连接 WebDAV' }
            startFetch()
            try {
                const targetFileId = fileId || `${name}.sce`
                await putFile(webdavConfig.value, `/sce_data/${targetFileId}`, jsonStr, 'application/json')
                return { success: true }
            } catch (err) {
                console.error(err)
                return { success: false, message: err.message || '保存失败' }
            } finally {
                endFetch()
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
            startFetch()
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
                endFetch()
            }
        }
        return await callWorkspaceApi('load', { fileId })
    }

    // Delete a workspace
    const deleteWorkspaceFromCloud = async (fileId, source = authType.value) => {
        if (source === 'webdav' && !(backupMode.value && token.value)) {
            if (!webdavConfig.value) return { success: false, message: '请先连接 WebDAV' }
            startFetch()
            try {
                await deleteFile(webdavConfig.value, `/sce_data/${fileId}`)
                return { success: true }
            } catch (err) {
                console.error(err)
                return { success: false, message: err.message || '删除失败' }
            } finally {
                endFetch()
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

    const renameWorkspaceInCloud = async (fileId, name, source = authType.value) => {
        const trimmedName = String(name || '').trim()
        if (!trimmedName) {
            return { success: false, message: '工作区名称不能为空' }
        }

        if (source === 'webdav') {
            return { success: false, message: 'WebDAV 工作区请通过保存为新名称管理' }
        }

        return await callWorkspaceApi('rename', {
            fileId,
            name: trimmedName
        })
    }

    return {
        isFetching,
        listWorkspaces,
        saveWorkspaceToCloud,
        loadWorkspaceFromCloud,
        deleteWorkspaceFromCloud,
        renameWorkspaceInCloud,
        loadCloudSettings,
        saveCloudSettings
    }
}
