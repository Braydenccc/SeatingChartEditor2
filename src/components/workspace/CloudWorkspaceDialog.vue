<template>
  <transition name="dialog-fade">
    <div v-show="visible" class="cloud-workspace-overlay" @mousedown.self="close">
      <div class="cloud-workspace-dialog">
        <div class="dialog-header">
          <h3>{{ isSaveMode ? '保存工作区至云端' : '从云端加载工作区' }}</h3>
          <button class="close-btn" @click="close" aria-label="关闭">
            <X :size="18" stroke-width="2" />
          </button>
        </div>

        <div class="dialog-body">
          
          <!-- Loading State -->
          <div v-if="isFetching" class="loading-state">
            <div class="spinner"></div>
            <p>正在与云端同步...</p>
          </div>

          <!-- Mode: Save -->
          <div v-else-if="isSaveMode" class="save-section">
            <!-- 双云时显示目标选择器 -->
            <div class="form-group" v-if="hasWebdav && hasRetiehe">
              <label>保存到</label>
              <div class="save-target-selection">
                <label class="radio-label" v-if="hasRetiehe">
                  <input type="radio" value="retiehe" v-model="targetService" />
                  <span>SCE 云服务</span>
                </label>
                <label class="radio-label" v-if="hasWebdav">
                  <input type="radio" value="webdav" v-model="targetService" />
                  <span>WebDAV 网盘</span>
                </label>
              </div>
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
              <input 
                type="text" 
                v-model="workspaceName" 
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
              <button class="btn-primary" @click="handleSave" :disabled="isSaving || !workspaceName.trim()">
                {{ isSaving ? '保存中...' : (selectedOverwriteId ? '覆盖已有工作区' : '保存为新工作区') }}
              </button>
            </div>
          </div>

          <!-- Mode: Load -->
          <div v-else class="load-section">
            <!-- 双云时显示 Tab 切换 -->
            <div class="cloud-tabs" v-if="hasWebdav && hasRetiehe">
              <button :class="{ active: activeTab === 'retiehe' }" @click="activeTab = 'retiehe'">SCE 云服务</button>
              <button :class="{ active: activeTab === 'webdav' }" @click="activeTab = 'webdav'">WebDAV 网盘</button>
            </div>
            <!-- 单云时显示来源说明 -->
            <div v-else class="cloud-source-label">
              <span>{{ hasRetiehe ? 'SCE 云服务' : 'WebDAV 网盘' }}</span>
              <span v-if="backupMode" class="backup-tag">备份模式</span>
            </div>
            
            <div v-if="!currentTabWorkspaces || currentTabWorkspaces.length === 0" class="empty-state mt-2">
              <Inbox :size="40" stroke-width="1.5" />
              <p>{{ activeTab === 'webdav' ? 'WebDAV 网盘上' : 'SCE 云端' }}暂无工作区</p>
              <p class="empty-hint">切换到「保存」模式将当前编辑内容上传到云端</p>
            </div>
            <div v-else class="workspace-grid mt-2">
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
                  <button class="icon-btn delete-btn" title="删除此工作区" @click.stop="confirmDelete(ws)">
                    <Trash2 :size="15" stroke-width="2" />
                  </button>
                </div>
              </div>
            </div>
            
            <div v-if="errorMessage" class="error-message mt-16">{{ errorMessage }}</div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { CheckCircle2, Cloud, Folder, HardDrive, Inbox, Trash2, X } from 'lucide-vue-next'
import { useCloudWorkspace } from '@/composables/useCloudWorkspace'
import { useWorkspace } from '@/composables/useWorkspace'
import { useLogger } from '@/composables/useLogger'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useAuth } from '@/composables/useAuth'

const props = defineProps({
  visible: Boolean,
  mode: {
    type: String,
    default: 'load' // 'load' or 'save'
  }
})

const emit = defineEmits(['update:visible', 'success'])

const { isFetching, listWorkspaces, saveWorkspaceToCloud, loadWorkspaceFromCloud, deleteWorkspaceFromCloud } = useCloudWorkspace()
const { getWorkspaceJson, applyWorkspaceData, saveLastWorkspace } = useWorkspace()
const { success, error } = useLogger()
const { requestConfirm } = useConfirmAction()
const { currentUser, webdavConfig, authType, backupMode } = useAuth()

const isSaveMode = ref(false)
const workspaces = ref([])
const workspaceName = ref('')
const selectedOverwriteId = ref(null)
const errorMessage = ref('')
const isSaving = ref(false)

const hasRetiehe = computed(() => !!currentUser.value)
const hasWebdav = computed(() => !!webdavConfig.value && !(backupMode.value && hasRetiehe.value))
const activeTab = ref('retiehe')
const targetService = ref('retiehe')

const webdavWorkspaces = computed(() => workspaces.value.filter(ws => ws.source === 'webdav'))
const retieheWorkspaces = computed(() => workspaces.value.filter(ws => ws.source === 'retiehe'))
const currentTabWorkspaces = computed(() => activeTab.value === 'webdav' ? webdavWorkspaces.value : retieheWorkspaces.value)
const targetWorkspaces = computed(() => targetService.value === 'webdav' ? webdavWorkspaces.value : retieheWorkspaces.value)

watch(() => props.visible, async (newVal) => {
  if (newVal) {
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
  }
})

const fetchWorkspaces = async () => {
  const result = await listWorkspaces()
  if (result.success || result.data?.length > 0) {
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

const selectForOverwrite = (ws) => {
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
      
      // 记录到 Cookie
      saveLastWorkspace({ 
        type: 'cloud', 
        name: trimmedName, 
        fileId: targetFileId || result.data?.fileId, 
        source: targetService.value 
      })

      emit('success')
      isSaving.value = false
      close()
      return
    } else {
      errorMessage.value = result.message
    }
  } catch (err) {
    errorMessage.value = err.message || '保存过程出错'
  } finally {
    isSaving.value = false
  }
}

const handleLoad = async (fileId, source) => {
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
    errorMessage.value = err.message || '处理数据时出错'
  }
}

const confirmDelete = (ws) => {
  if (requestConfirm(`delete_${ws.fileId}`, async () => {
    const result = await deleteWorkspaceFromCloud(ws.fileId, ws.source)
    if (result.success) {
      success(`文件 ${ws.metadata.name} 已删除`)
      await fetchWorkspaces()
    } else {
      error(result.message || '删除失败')
    }
  })) {
    // 第一次点击只提示
  } else {
    success(`再次点击以确认删除 "${ws.metadata.name}"`)
  }
}

// Formatting helpers
const formatDate = (isoStr) => {
  if (!isoStr) return '未知时间'
  const date = new Date(isoStr)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  if (bytes < k) return bytes + ' B'
  else if (bytes < k * k) return (bytes / k).toFixed(1) + ' KB'
  else return (bytes / (k * k)).toFixed(2) + ' MB'
}
</script>

<style scoped>
.cloud-workspace-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

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
  display: flex;
  background: var(--color-bg-soft);
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 4px;
}

.cloud-tabs button {
  flex: 1;
  padding: 8px 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.cloud-tabs button.active {
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.cloud-source-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
  padding: 6px 0;
  margin-bottom: 4px;
}

.backup-tag {
  background: var(--color-success-bg);
  color: var(--color-success);
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 600;
}

.mt-2 {
  margin-top: 8px;
}

.cloud-workspace-dialog {
  background: var(--color-surface);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
  border-radius: 12px 12px 0 0;
}

.dialog-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}
.close-btn:hover {
  color: var(--color-text-primary);
}

.dialog-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: var(--color-text-muted);
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(var(--color-primary-rgb), 0.1);
  border-radius: 50%;
  border-top-color: var(--color-primary);
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: 6px;
  font-size: 15px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
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
  background: var(--color-info-bg);
  border-left: 3px solid var(--color-info);
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

.btn-primary {
  width: 100%;
  padding: 12px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.card-icon {
  background: var(--color-bg-soft);
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
}

.ws-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.icon-btn {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--color-text-muted);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
}

.empty-state {
  text-align: center;
  padding: 32px 20px;
  color: var(--color-text-muted);
  background: var(--color-bg-subtle);
  border-radius: 8px;
  border: 1px dashed var(--color-border-strong);
}

.empty-state .empty-icon {
  margin-bottom: 8px;
}

.empty-state p {
  margin: 0 0 4px;
  font-size: 14px;
  color: var(--color-text-muted);
}

.empty-state .empty-hint {
  font-size: 12px;
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

.mt-16 {
  margin-top: 16px;
}

/* Transition styles */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-active .cloud-workspace-dialog {
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.dialog-fade-leave-active .cloud-workspace-dialog {
  transform: translateY(20px);
  opacity: 0;
  transition: all 0.3s ease;
}
</style>
