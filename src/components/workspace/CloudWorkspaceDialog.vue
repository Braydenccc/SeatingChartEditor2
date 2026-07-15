<template>
  <ResponsiveOverlay
    :show="visible"
    :title="isSaveMode ? '保存工作区至云端' : '从云端加载工作区'"
    :busy="isFetching || isSaving"
    :desktop-width="720"
    @update:show="value => !value && close()"
  >
        <div class="dialog-body">
          
          <!-- Loading State -->
          <NSpin v-if="isFetching" class="loading-state" size="large" description="正在与云端同步..." />

          <!-- Mode: Save -->
          <div v-else-if="isSaveMode" class="save-section">
            <!-- 双云时显示目标选择器 -->
            <div class="form-group" v-if="hasWebdav && hasRetiehe">
              <label>保存到</label>
              <NRadioGroup v-model:value="targetService" class="save-target-selection" size="small">
                <NRadioButton v-if="hasRetiehe" value="retiehe">SCE 云服务</NRadioButton>
                <NRadioButton v-if="hasWebdav" value="webdav">WebDAV 网盘</NRadioButton>
              </NRadioGroup>
            </div>

            <!-- 单云时显示目标提示条 -->
            <div v-else class="save-target-banner">
              <Cloud v-if="hasRetiehe" :size="16" stroke-width="1.8" />
              <HardDrive v-else :size="16" stroke-width="1.8" />
              <span>保存至：<strong>{{ hasRetiehe ? 'SCE 云服务' : 'WebDAV 网盘' }}</strong></span>
              <span v-if="backupMode && hasWebdav !== false" class="backup-hint">
                <CheckCircle2 :size="14" stroke-width="2" />
                同时备份至 WebDAV
              </span>
            </div>

            <div class="form-group">
              <label>工作区名称</label>
              <NInput
                type="text"
                v-model:value="workspaceName"
                placeholder="例如：2026级二班座位表"
                maxlength="50"
                @keyup.enter="handleSave"
                autofocus
              />
            </div>
            
            <div v-if="targetWorkspaces.length > 0" class="existing-workspaces">
              <p class="section-title">点击覆盖已有工作区：</p>
              <div class="workspace-list small">
                <div 
                  v-for="ws in targetWorkspaces" 
                  :key="ws.fileId"
                  class="workspace-item"
                  @click="selectForOverwrite(ws)"
                  :class="{ selected: selectedOverwriteId === ws.fileId }"
                >
                  <div class="ws-info">
                    <span class="ws-name">{{ ws.metadata.name }}</span>
                    <span class="ws-time">{{ formatDate(ws.metadata.time) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
            
            <div class="dialog-actions">
              <NButton type="primary" block :loading="isSaving" @click="handleSave" :disabled="!workspaceName.trim()">
                {{ isSaving ? '保存中...' : (selectedOverwriteId ? '覆盖已有工作区' : '保存为新工作区') }}
              </NButton>
            </div>
          </div>

          <!-- Mode: Load -->
          <div v-else class="load-section">
            <!-- 双云时显示 Tab 切换 -->
            <NTabs v-if="hasWebdav && hasRetiehe" v-model:value="activeTab" class="cloud-tabs" type="segment" size="small">
              <NTabPane name="retiehe" tab="SCE 云服务" />
              <NTabPane name="webdav" tab="WebDAV 网盘" />
            </NTabs>

            <!-- 单云时显示来源提示条 -->
            <div v-else class="load-source-banner">
              <Cloud v-if="hasRetiehe" :size="16" stroke-width="1.8" />
              <HardDrive v-else :size="16" stroke-width="1.8" />
              <span>加载自：<strong>{{ hasRetiehe ? 'SCE 云服务' : 'WebDAV 网盘' }}</strong></span>
              <span v-if="backupMode && hasWebdav !== false" class="backup-hint">
                <CheckCircle2 :size="14" stroke-width="2" />
                备份模式
              </span>
            </div>
            
            <NEmpty
              v-if="!currentTabWorkspaces || currentTabWorkspaces.length === 0"
              class="empty-state"
              :description="`${activeTab === 'webdav' ? 'WebDAV 网盘' : 'SCE 云服务'}暂无工作区`"
            />
            <div v-else class="workspace-grid">
              <div 
                v-for="ws in currentTabWorkspaces" 
                :key="ws.fileId"
                class="workspace-card"
              >
                <div class="card-content" @click="handleLoad(ws.fileId, ws.source)">
                  <Folder :size="28" stroke-width="2" class="workspace-icon" />
                  <div class="card-details">
                    <h4 class="ws-name">{{ ws.metadata.name }}</h4>
                    <p class="ws-meta">
                      {{ formatDate(ws.metadata.time) }}
                      <span v-if="ws.metadata.size"> · {{ formatSize(ws.metadata.size) }}</span>
                    </p>
                  </div>
                </div>
                <div class="card-actions">
                  <NButton quaternary circle type="error" title="删除此工作区" @click.stop="confirmDelete(ws)">
                    <Trash2 :size="15" stroke-width="2" />
                  </NButton>
                </div>
              </div>
            </div>

            <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
          </div>
        </div>
  </ResponsiveOverlay>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { NButton, NEmpty, NInput, NRadioButton, NRadioGroup, NSpin, NTabPane, NTabs } from 'naive-ui'
import { CheckCircle2, Cloud, Folder, HardDrive, Trash2 } from 'lucide-vue-next'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { useCloudWorkspace } from '@/composables/useCloudWorkspace'
import { useWorkspace } from '@/composables/useWorkspace'
import { useLogger } from '@/composables/useLogger'
import { useAuth } from '@/composables/useAuth'
import type { CloudWorkspaceFile } from '@/composables/useCloudWorkspace'
import type { AuthType } from '@/types/models'

const props = withDefaults(defineProps<{
  visible?: boolean
  mode?: 'load' | 'save'
}>(), {
  visible: false,
  mode: 'load'
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

const { isFetching, listWorkspaces, saveWorkspaceToCloud, loadWorkspaceFromCloud, deleteWorkspaceFromCloud } = useCloudWorkspace()
const { getWorkspaceJson, applyWorkspaceData, saveLastWorkspace, getLastWorkspace, clearLastWorkspace } = useWorkspace()
const { success, error, confirm } = useLogger()
const { token, webdavConfig, authType, backupMode } = useAuth()

const isSaveMode = ref(false)
const workspaces = ref<CloudWorkspaceFile[]>([])
const workspaceName = ref('')
const selectedOverwriteId = ref<string | null>(null)
const errorMessage = ref('')
const isSaving = ref(false)

const hasRetiehe = computed(() => !!token.value)
const hasWebdav = computed(() => !!webdavConfig.value && !(backupMode.value && hasRetiehe.value))
const activeTab = ref<AuthType>('retiehe')
const targetService = ref<AuthType>('retiehe')

const webdavWorkspaces = computed(() => workspaces.value.filter(ws => ws.source === 'webdav'))
const retieheWorkspaces = computed(() => workspaces.value.filter(ws => ws.source === 'retiehe'))
const currentTabWorkspaces = computed(() => activeTab.value === 'webdav' ? webdavWorkspaces.value : retieheWorkspaces.value)
const targetWorkspaces = computed(() => targetService.value === 'webdav' ? webdavWorkspaces.value : retieheWorkspaces.value)

// 组件挂载时初始化
onMounted(async () => {
  isSaveMode.value = props.mode === 'save'
  workspaceName.value = ''
  selectedOverwriteId.value = null
  errorMessage.value = ''

  // Auto-select tab and target based on active authType setting
  if (authType.value === 'webdav' && hasWebdav.value) {
    activeTab.value = 'webdav'
    targetService.value = 'webdav'
  } else if (hasRetiehe.value) {
    activeTab.value = 'retiehe'
    targetService.value = 'retiehe'
  } else if (hasWebdav.value) {
    activeTab.value = 'webdav'
    targetService.value = 'webdav'
  }

  await fetchWorkspaces()
})

// 监听 mode 变化（用于弹窗已打开时切换模式）
watch(() => props.mode, (newMode) => {
  isSaveMode.value = newMode === 'save'
})

const fetchWorkspaces = async () => {
  const result = await listWorkspaces()
  if (result.success || (result.data?.length ?? 0) > 0) {
    workspaces.value = result.data || []
  }
  if (!result.success && result.message) {
    errorMessage.value = result.message
  }
}

const close = () => {
  if (isFetching.value || isSaving.value) return
  emit('update:visible', false)
}

const selectForOverwrite = (ws: CloudWorkspaceFile) => {
  if (selectedOverwriteId.value === ws.fileId) {
    selectedOverwriteId.value = null
    workspaceName.value = ''
  } else {
    selectedOverwriteId.value = ws.fileId
    workspaceName.value = ws.metadata.name
  }
}

const handleSave = async () => {
  const trimmedName = workspaceName.value.trim()
  if (!trimmedName) return
  
  errorMessage.value = ''
  isSaving.value = true
  
  try {
    // 检查是否重名，如果重名强制转为覆盖
    let targetFileId = selectedOverwriteId.value
    if (!targetFileId) {
       const existingWs = targetWorkspaces.value.find(ws => ws.metadata.name === trimmedName)
       if (existingWs) {
         targetFileId = existingWs.fileId
       }
    }

    const jsonContent = getWorkspaceJson()
    
    if (!jsonContent) {
      throw new Error('生成工作区数据失败')
    }

    const result = await saveWorkspaceToCloud(
      trimmedName, 
      jsonContent, 
      targetFileId,
      targetService.value
    )
    
    if (result.success) {
      success('工作区已保存至云端！')

      const savedFileId = targetFileId || result.data?.fileId
      if (savedFileId) {
        saveLastWorkspace({
          type: 'cloud',
          name: trimmedName,
          fileId: savedFileId,
          source: targetService.value
        })
      }

      emit('success')
      isSaving.value = false
      close()
      return
    } else {
      errorMessage.value = result.message ?? '保存失败'
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : '保存过程出错'
  } finally {
    isSaving.value = false
  }
}

const handleLoad = async (fileId: string, source: AuthType) => {
  if (isFetching.value) return
  
  errorMessage.value = ''
  
  try {
    const result = await loadWorkspaceFromCloud(fileId, source)
    if (result.success && result.data && result.data.content) {
      let workspaceData;
      if (typeof result.data.content === 'string') {
        try {
          workspaceData = JSON.parse(result.data.content)
        } catch (e) {
          throw new Error('云端该工作区数据已损坏或不支持 (由于早期保存格式问题导致)，请加载其他近期工作区。')
        }
      } else {
        workspaceData = result.data.content
      }
      
      const isSuccess = await applyWorkspaceData(workspaceData)
      
      if (isSuccess) {
        success('已从云端恢复工作区！')

        // 记录到 Cookie
        const currentWs = workspaces.value.find(w => w.fileId === fileId)
        saveLastWorkspace({ 
          type: 'cloud', 
          name: currentWs?.metadata?.name || '未命名云端工作区', 
          fileId, 
          source 
        })

        emit('success')
        close()
      } else {
         errorMessage.value = '解析工作区数据失败'
      }
    } else {
      errorMessage.value = result.message || '拉取数据失败'
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : '处理数据时出错'
  }
}

const confirmDelete = async (ws: CloudWorkspaceFile) => {
  const confirmed = await confirm({
    title: '删除云端工作区',
    content: `确认删除“${ws.metadata.name}”？此操作无法在应用内撤销。`,
    positiveText: '删除',
    type: 'error'
  })
  if (!confirmed) return
  const result = await deleteWorkspaceFromCloud(ws.fileId, ws.source)
  if (result.success) {
    const lastWorkspace = getLastWorkspace()
    if (lastWorkspace?.type === 'cloud' && lastWorkspace.fileId === ws.fileId) clearLastWorkspace()
    success(`工作区 ${ws.metadata.name} 已删除`)
    await fetchWorkspaces()
  } else {
    error(result.message || '删除失败')
  }
}

// Formatting helpers
const formatDate = (isoStr?: string) => {
  if (!isoStr) return '未知时间'
  const date = new Date(isoStr)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}

const formatSize = (bytes?: number) => {
  if (!bytes) return '0 B'
  const k = 1024
  if (bytes < k) return bytes + ' B'
  else if (bytes < k * k) return (bytes / k).toFixed(1) + ' KB'
  else return (bytes / (k * k)).toFixed(2) + ' MB'
}
</script>

<style scoped>
.save-target-selection {
  display: flex;
  gap: 16px;
  background: var(--color-bg-subtle);
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.save-target-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-info-bg);
  border: 1px solid var(--color-border);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-info);
  margin-bottom: 16px;
}

/* .save-target-banner icons use :size prop directly */

.backup-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-success);
  font-weight: 500;
}

/* .backup-hint icons use :size prop directly */

.cloud-tabs {
  margin-bottom: 16px;
}

.load-source-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-info-bg);
  border: 1px solid var(--color-border);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-info);
  margin-bottom: 16px;
}

.dialog-body {
  max-height: min(680px, calc(100dvh - 180px));
  overflow-y: auto;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: var(--color-text-muted);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
}

.section-title {
  font-size: 14px;
  color: var(--color-text-muted);
  margin-bottom: 10px;
  font-weight: 500;
}

.workspace-list.small {
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.workspace-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-bg-soft);
  cursor: pointer;
  transition: background 0.2s;
}

.workspace-item:last-child {
  border-bottom: none;
}

.workspace-item:hover {
  background: var(--color-bg-subtle);
}

.workspace-item.selected {
  background: var(--color-selection-bg);
  border-left: 3px solid var(--color-selection-border);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-selection-border) 18%, transparent);
}

.ws-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ws-name {
  font-weight: 500;
  color: var(--color-text-primary);
  font-size: 15px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ws-time {
  font-size: 12px;
  color: var(--color-text-muted);
}

.dialog-actions {
  margin-top: 24px;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.workspace-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s;
}

.workspace-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-border-strong);
}

.card-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  cursor: pointer;
}

.workspace-icon {
  color: var(--color-primary);
}

.ws-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.empty-state {
  text-align: center;
  padding: 32px 20px;
  color: var(--color-text-muted);
  background: var(--color-bg-subtle);
  border-radius: 8px;
  border: 1px dashed var(--color-border-strong);
}

.empty-state p {
  margin: 0 0 4px;
  font-size: 14px;
  color: var(--color-text-muted);
}

.error-message {
  color: var(--color-danger-text);
  font-size: 13px;
  background: var(--color-danger-bg);
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid var(--color-danger-text);
  margin-top: 16px;
}

</style>
