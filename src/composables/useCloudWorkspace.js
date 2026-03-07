import { ref } from 'vue'
import { useAuth } from './useAuth'

export function useCloudWorkspace() {
    const { currentUser, token } = useAuth()
    const isFetching = ref(false)

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
                    'Content-Type': 'application/json'
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
        return await callWorkspaceApi('list')
    }

    // Save a workspace
    const saveWorkspaceToCloud = async (name, content, fileId = null) => {
        return await callWorkspaceApi('save', {
            name,
            content,
            fileId
        })
    }

    // Load a workspace by ID
    const loadWorkspaceFromCloud = async (fileId) => {
        return await callWorkspaceApi('load', { fileId })
    }

    // Delete a workspace
    const deleteWorkspaceFromCloud = async (fileId) => {
        return await callWorkspaceApi('delete', { fileId })
    }

    return {
        isFetching,
        listWorkspaces,
        saveWorkspaceToCloud,
        loadWorkspaceFromCloud,
        deleteWorkspaceFromCloud
    }
}
