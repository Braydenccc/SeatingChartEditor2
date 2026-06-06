import { computed, ref } from 'vue'
import { useCloudWorkspace } from './useCloudWorkspace'

type WorkspaceSource = 'retiehe' | 'webdav'

interface CloudWorkspaceItem {
  fileId: string
  source?: WorkspaceSource
  metadata?: {
    name?: string
    time?: string
    size?: number
  }
}

interface UseCloudWorkspaceStatsOptions {
  source?: WorkspaceSource
}

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const toTimestamp = (value?: string): number => {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

const formatDateTime = (value?: string): string => {
  const timestamp = toTimestamp(value)
  if (!timestamp) return '暂无记录'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

export function useCloudWorkspaceStats(options: UseCloudWorkspaceStatsOptions = {}) {
  const { listWorkspaces } = useCloudWorkspace()
  const workspaces = ref<CloudWorkspaceItem[]>([])
  const isRefreshing = ref(false)
  const errorMessage = ref('')

  const filteredWorkspaces = computed(() => {
    if (!options.source) return workspaces.value
    return workspaces.value.filter(workspace => workspace.source === options.source)
  })

  const workspaceCount = computed(() => filteredWorkspaces.value.length)

  const totalSize = computed(() =>
    filteredWorkspaces.value.reduce((sum, workspace) => sum + (workspace.metadata?.size || 0), 0)
  )

  const recentWorkspace = computed(() =>
    [...filteredWorkspaces.value].sort((a, b) =>
      toTimestamp(b.metadata?.time) - toTimestamp(a.metadata?.time)
    )[0] || null
  )

  const totalSizeText = computed(() => formatBytes(totalSize.value))
  const recentWorkspaceName = computed(() => recentWorkspace.value?.metadata?.name || '暂无工作区')
  const recentWorkspaceTimeText = computed(() => formatDateTime(recentWorkspace.value?.metadata?.time))

  const refresh = async () => {
    isRefreshing.value = true
    errorMessage.value = ''
    try {
      const result = await listWorkspaces()
      if (result.success) {
        const nextWorkspaces = Array.isArray(result.data) ? result.data : []
        const nextFiltered = options.source
          ? nextWorkspaces.filter(workspace => workspace.source === options.source)
          : nextWorkspaces
        workspaces.value = nextWorkspaces
        if (result.message && nextFiltered.length === 0) {
          errorMessage.value = result.message
        }
        return true
      }
      workspaces.value = []
      errorMessage.value = result.message || '工作区统计获取失败'
      return false
    } catch (err) {
      workspaces.value = []
      errorMessage.value = err instanceof Error ? err.message : '工作区统计获取失败'
      return false
    } finally {
      isRefreshing.value = false
    }
  }

  return {
    workspaces: filteredWorkspaces,
    workspaceCount,
    totalSize,
    totalSizeText,
    recentWorkspace,
    recentWorkspaceName,
    recentWorkspaceTimeText,
    isRefreshing,
    errorMessage,
    refresh
  }
}
