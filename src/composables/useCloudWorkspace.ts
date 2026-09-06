import { ref, computed } from 'vue'
import { useAuth } from './useAuth'
import { useWebDav, type WebDavFileEntry } from './useWebDav'
import { getOrCreateCsrfToken } from './useAuth'
import { useLogger } from './useLogger'
import { apiFetch } from '@/platform/apiClient'
import { buildWebDavWorkspacePath } from '@/utils/webdavPath'
import type { AuthType, WebDavConfig } from '@/types/models'

export interface CloudWorkspaceFile {
    fileId: string
    source: AuthType
    metadata: {
        name: string
        time?: string
        size?: number
        [key: string]: unknown
    }
    [key: string]: unknown
}

export interface CloudWorkspaceResult<TData = Record<string, unknown>> {
    success: boolean
    message?: string
    error?: string
    backupWarning?: string
    source?: AuthType
    data?: TData
}

export interface CloudWorkspaceSaveData extends Record<string, unknown> {
    fileId?: string
}

export interface CloudWorkspaceContentData {
    content: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isValidWorkspaceFileId = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)

const canonicalSceFileIdPattern = /^[a-f0-9]{32}$/i
const workspaceFileExtension = '.sce'

const buildWebDavMirrorFileId = (canonicalFileId: string) => (
    `${canonicalFileId}${workspaceFileExtension}`
)

const getCanonicalMirrorIdFromFileName = (fileName: string) => {
    if (canonicalSceFileIdPattern.test(fileName)) return fileName
    if (!fileName.toLowerCase().endsWith(workspaceFileExtension)) return null
    const baseName = fileName.slice(0, -workspaceFileExtension.length)
    return canonicalSceFileIdPattern.test(baseName) ? baseName : null
}

const selectVisibleWebDavWorkspaceFiles = (files: WebDavFileEntry[]) => {
    const selected = new Map<string, WebDavFileEntry>()

    files.forEach(file => {
        if (file.isCollection) return
        const canonicalMirrorId = getCanonicalMirrorIdFromFileName(file.name)
        if (!file.name.toLowerCase().endsWith(workspaceFileExtension) && !canonicalMirrorId) return

        const key = canonicalMirrorId
            ? `mirror:${canonicalMirrorId.toLowerCase()}`
            : `file:${file.name}`
        const current = selected.get(key)
        const isCurrentCanonicalFile = current?.name.toLowerCase().endsWith(workspaceFileExtension) === true
        const isNextCanonicalFile = file.name.toLowerCase().endsWith(workspaceFileExtension)
        if (!current || (!isCurrentCanonicalFile && isNextCanonicalFile)) {
            selected.set(key, file)
        }
    })

    return [...selected.values()]
}

const getDirectWebDavDeleteFileIds = (fileId: string) => {
    const canonicalMirrorId = getCanonicalMirrorIdFromFileName(fileId)
    if (!canonicalMirrorId) return [fileId]
    const pairedFileId = fileId.toLowerCase().endsWith(workspaceFileExtension)
        ? canonicalMirrorId
        : buildWebDavMirrorFileId(canonicalMirrorId)
    return [fileId, pairedFileId]
}

const parseWorkspaceFile = (value: unknown, source: AuthType): CloudWorkspaceFile | null => {
    if (!isRecord(value) || typeof value.fileId !== 'string' || !isRecord(value.metadata)) return null
    return {
        ...value,
        fileId: value.fileId,
        source,
        metadata: {
            ...value.metadata,
            name: typeof value.metadata.name === 'string' ? value.metadata.name : value.fileId,
            time: typeof value.metadata.time === 'string' ? value.metadata.time : undefined,
            size: typeof value.metadata.size === 'number' ? value.metadata.size : undefined
        }
    }
}

const parseCloudResult = (value: unknown): CloudWorkspaceResult<Record<string, unknown> | CloudWorkspaceFile[]> => {
    if (!isRecord(value)) return { success: false, message: '云端响应格式错误' }
    const data = Array.isArray(value.data)
        ? value.data.map(item => parseWorkspaceFile(item, 'retiehe')).filter((item): item is CloudWorkspaceFile => item !== null)
        : (isRecord(value.data) ? value.data : undefined)
    return {
        success: value.success === true,
        message: typeof value.message === 'string' ? value.message : undefined,
        data
    }
}

const getErrorMessage = (errorValue: unknown, fallback: string) =>
    errorValue instanceof Error ? errorValue.message : fallback

const workspaceFormatErrorMessage = '工作区数据格式错误'

const webDavMirrorQueues = new Map<string, Promise<void>>()

const enqueueWebDavMirror = async (
    config: WebDavConfig,
    fileId: string,
    operation: () => Promise<unknown>
) => {
    const queueKey = JSON.stringify([
        config.url.replace(/\/+$/, ''),
        config.username || '',
        fileId
    ])
    const previous = webDavMirrorQueues.get(queueKey) ?? Promise.resolve()
    const current = previous.catch(() => undefined).then(async () => {
        await operation()
    })
    webDavMirrorQueues.set(queueKey, current)

    try {
        await current
    } finally {
        if (webDavMirrorQueues.get(queueKey) === current) {
            webDavMirrorQueues.delete(queueKey)
        }
    }
}

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

    const saveCloudSettings = async (settingsObj: Record<string, unknown>) => {
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
    const callWorkspaceApi = async (
        action: string,
        payload: Record<string, unknown> = {}
    ): Promise<CloudWorkspaceResult<Record<string, unknown> | CloudWorkspaceFile[]>> => {
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
            }, 0)

            if (!response.ok) {
                let errorMsg = `HTTP Error: ${response.status}`
                try {
                    const errorData: unknown = await response.json()
                    if (isRecord(errorData) && typeof errorData.message === 'string') errorMsg = errorData.message
                } catch (e) { }
                throw new Error(errorMsg)
            }

            return parseCloudResult(await response.json())
        } catch (err) {
            console.error('Workspace API Error:', err)
            return { success: false, message: getErrorMessage(err, '网络请求失败') }
        } finally {
            endFetch()
        }
    }

    // List user workspaces
    const listWorkspaces = async (): Promise<CloudWorkspaceResult<CloudWorkspaceFile[]>> => {
        const tasks: Array<Promise<CloudWorkspaceResult<Record<string, unknown> | CloudWorkspaceFile[]>>> = []
        
        if (webdavConfig.value && !(backupMode.value && token.value)) {
            const config = webdavConfig.value
            tasks.push((async () => {
                startFetch()
                try {
                    const files = selectVisibleWebDavWorkspaceFiles(await listFiles(config, '/sce_data'))
                    return {
                        success: true,
                        source: 'webdav',
                        data: files.map(f => {
                            const nameWithoutExt = f.name.toLowerCase().endsWith(workspaceFileExtension)
                                ? f.name.substring(0, f.name.length - workspaceFileExtension.length)
                                : f.name
                            return {
                                fileId: f.name,
                                source: 'webdav' as const,
                                metadata: {
                                    name: nameWithoutExt,
                                    time: f.lastModified || new Date().toISOString(),
                                    size: f.size
                                }
                            }
                        })
                    }
                } catch (err) {
                    return { success: false, source: 'webdav', message: getErrorMessage(err, '获取WebDAV列表失败') }
                } finally {
                    endFetch()
                }
            })())
        }
        
        if (currentUser.value && token.value) {
            tasks.push((async () => {
                const res = await callWorkspaceApi('list')
                if (res.success && Array.isArray(res.data)) {
                    res.data.forEach(item => { item.source = 'retiehe' })
                }
                res.source = 'retiehe'
                return res
            })())
        }
        
        if (tasks.length === 0) return { success: false, message: '请先登录云端账户' }
        
        const results = await Promise.all(tasks)
        
        let allData: CloudWorkspaceFile[] = []
        const errors: string[] = []
        
        results.forEach(res => {
            if (res.success && Array.isArray(res.data)) {
                allData = allData.concat(res.data)
            } else if (!res.success) {
                if (res.message) errors.push(res.message)
            }
        })
        
        return { 
            success: allData.length > 0 || errors.length === 0, 
            data: allData, 
            message: errors.join('; ') 
        }
    }

    // Save a workspace
    const saveWorkspaceToCloud = async (
        name: string,
        content: unknown,
        fileId: string | null = null,
        target: AuthType = authType.value
    ): Promise<CloudWorkspaceResult<CloudWorkspaceSaveData>> => {
        let parsedContent: unknown
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
                await putFile(webdavConfig.value, buildWebDavWorkspacePath(targetFileId), jsonStr, 'application/json')
                return { success: true, data: { fileId: targetFileId } }
            } catch (err) {
                console.error(err)
                return { success: false, message: getErrorMessage(err, '保存失败') }
            } finally {
                endFetch()
            }
        }

        const primaryResult = await callWorkspaceApi('save', {
            name,
            content: parsedContent,
            ...(fileId ? { fileId } : {})
        })

        const primaryFileId = !Array.isArray(primaryResult.data) && isValidWorkspaceFileId(primaryResult.data?.fileId)
            ? primaryResult.data.fileId
            : null
        if (primaryResult.success && primaryFileId === null) {
            return {
                success: false,
                message: '云端响应缺少有效的工作区文件ID',
                error: '云端响应格式错误',
                source: primaryResult.source
            }
        }

        let backupWarning: string | undefined
        if (primaryResult.success && backupMode.value && webdavConfig.value) {
            const config = webdavConfig.value
            const targetFileId = primaryFileId ?? fileId ?? `${name}.sce`
            startFetch()
            try {
                await enqueueWebDavMirror(config, targetFileId, async () => {
                    await putFile(
                        config,
                        buildWebDavWorkspacePath(buildWebDavMirrorFileId(targetFileId)),
                        jsonStr,
                        'application/json'
                    )
                })
            } catch (e) {
                console.error('备份到 WebDAV 失败:', e)
                backupWarning = `SCE 云端已保存，但 WebDAV 备份失败：${getErrorMessage(e, '未知错误')}`
            } finally {
                endFetch()
            }
        }

        const primaryData = !Array.isArray(primaryResult.data) && isRecord(primaryResult.data)
            ? {
                ...primaryResult.data,
                fileId: primaryFileId ?? undefined
            }
            : undefined
        return {
            success: primaryResult.success,
            message: primaryResult.message,
            error: primaryResult.error,
            backupWarning,
            source: primaryResult.source,
            data: primaryData
        }
    }

    // Load a workspace by ID
    const loadWorkspaceFromCloud = async (
        fileId: string,
        source: AuthType = authType.value
    ): Promise<CloudWorkspaceResult<CloudWorkspaceContentData>> => {
        if (source === 'webdav') {
            if (!webdavConfig.value) return { success: false, message: '请先连接 WebDAV' }
            startFetch()
            try {
                const text = await getFileText(webdavConfig.value, buildWebDavWorkspacePath(fileId))
                if (!text) throw new Error('文件不存在')
                return {
                    success: true,
                    data: { content: text }
                }
            } catch (err) {
                console.error(err)
                return { success: false, message: getErrorMessage(err, '加载失败') }
            } finally {
                endFetch()
            }
        }
        const result = await callWorkspaceApi('load', { fileId })
        if (!result.success) return { success: false, message: result.message }
        if (Array.isArray(result.data) || !isRecord(result.data) || !('content' in result.data)) {
            return { success: false, message: '云端工作区内容格式错误' }
        }
        return { success: true, data: { content: result.data.content } }
    }

    // Delete a workspace
    const deleteWorkspaceFromCloud = async (
        fileId: string,
        source: AuthType = authType.value
    ): Promise<CloudWorkspaceResult<Record<string, unknown> | CloudWorkspaceFile[]>> => {
        if (source === 'webdav' && !(backupMode.value && token.value)) {
            if (!webdavConfig.value) return { success: false, message: '请先连接 WebDAV' }
            startFetch()
            try {
                for (const targetFileId of getDirectWebDavDeleteFileIds(fileId)) {
                    await deleteFile(webdavConfig.value, buildWebDavWorkspacePath(targetFileId))
                }
                return { success: true }
            } catch (err) {
                console.error(err)
                return { success: false, message: getErrorMessage(err, '删除失败') }
            } finally {
                endFetch()
            }
        }

        const primaryResult = await callWorkspaceApi('delete', { fileId })

        let backupWarning: string | undefined
        if (primaryResult.success && backupMode.value && webdavConfig.value) {
            const config = webdavConfig.value
            startFetch()
            try {
                await enqueueWebDavMirror(config, fileId, async () => {
                    await deleteFile(
                        config,
                        buildWebDavWorkspacePath(buildWebDavMirrorFileId(fileId))
                    )
                    await deleteFile(config, buildWebDavWorkspacePath(fileId))
                })
            } catch (e) {
                console.error('WebDAV 备份删除失败:', e)
                backupWarning = `SCE 云端已删除，但 WebDAV 备份删除失败：${getErrorMessage(e, '未知错误')}`
            } finally {
                endFetch()
            }
        }

        return {
            ...primaryResult,
            backupWarning
        }
    }

    const renameWorkspaceInCloud = async (fileId: string, name: string, source: AuthType = authType.value) => {
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
