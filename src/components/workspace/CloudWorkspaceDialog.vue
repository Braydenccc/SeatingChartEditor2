<template>
  <div v-if="visible" class="cloud-workspace-overlay" @click.self="close">
    <div class="cloud-workspace-dialog">
      <div class="dialog-header">
        <h3>{{ isSaveMode ? '保存工作区至云端' : '从云端加载工作区' }}</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>

      <div class="dialog-body">
        
        <!-- Loading State -->
        <div v-if="isFetching" class="loading-state">
          <div class="spinner"></div>
          <p>正在与云端同步...</p>
        </div>

        <!-- Mode: Save -->
        <div v-else-if="isSaveMode" class="save-section">
          <div class="form-group">
            <label>工作区名称</label>
            <input 
              type="text" 
              v-model="workspaceName" 
              placeholder="例如：2026级二班座位表" 
              maxlength="50"
              @keyup.enter="handleSave"
            />
          </div>
          
          <div v-if="workspaces.length > 0" class="existing-workspaces">
            <p class="section-title">或覆盖现有工作区：</p>
            <div class="workspace-list small">
              <div 
                v-for="ws in workspaces" 
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
              {{ isSaving ? '保存中...' : (selectedOverwriteId ? '覆盖保存' : '新建保存') }}
            </button>
          </div>
        </div>

        <!-- Mode: Load -->
        <div v-else class="load-section">
          <div v-if="workspaces.length === 0" class="empty-state">
            云端暂无保存的工作区
          </div>
          <div v-else class="workspace-grid">
            <div 
              v-for="ws in workspaces" 
              :key="ws.fileId"
              class="workspace-card"
            >
              <div class="card-content" @click="handleLoad(ws.fileId)">
                <div class="card-icon">📁</div>
                <div class="card-details">
                  <h4 class="ws-name">{{ ws.metadata.name }}</h4>
                  <p class="ws-meta">
                    {{ formatDate(ws.metadata.time) }}<br/>
                    大小: {{ formatSize(ws.metadata.size) }}
                  </p>
                </div>
              </div>
              <div class="card-actions">
                <button class="icon-btn delete-btn" title="删除" @click.stop="confirmDelete(ws)">🗑️</button>
              </div>
            </div>
          </div>
          
          <div v-if="errorMessage" class="error-message mt-16">{{ errorMessage }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useCloudWorkspace } from '@/composables/useCloudWorkspace'
import { useWorkspace } from '@/composables/useWorkspace'
import { useLogger } from '@/composables/useLogger'
import { useConfirmAction } from '@/composables/useConfirmAction'

const props = defineProps({
  visible: Boolean,
  mode: {
    type: String,
    default: 'load' // 'load' or 'save'
  }
})

const emit = defineEmits(['update:visible', 'success'])

const { isFetching, listWorkspaces, saveWorkspaceToCloud, loadWorkspaceFromCloud, deleteWorkspaceFromCloud } = useCloudWorkspace()
const { getWorkspaceJson, applyWorkspaceData } = useWorkspace() // We need to modify useWorkspace to export these
const { success, error } = useLogger()
const { requestConfirm } = useConfirmAction()

const isSaveMode = ref(false)
const workspaces = ref([])
const workspaceName = ref('')
const selectedOverwriteId = ref(null)
const errorMessage = ref('')
const isSaving = ref(false)

watch(() => props.visible, async (newVal) => {
  if (newVal) {
    isSaveMode.value = props.mode === 'save'
    workspaceName.value = ''
    selectedOverwriteId.value = null
    errorMessage.value = ''
    await fetchWorkspaces()
  }
})

const fetchWorkspaces = async () => {
  const result = await listWorkspaces()
  if (result.success) {
    workspaces.value = result.data || []
  } else {
    errorMessage.value = result.message || '获取云文件列表失败'
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
       const existingWs = workspaces.value.find(ws => ws.metadata.name === trimmedName)
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
      targetFileId
    )
    
    if (result.success) {
      success('工作区已保存至云端！')
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

const handleLoad = async (fileId) => {
  if (isFetching.value) return
  
  errorMessage.value = ''
  
  try {
    const result = await loadWorkspaceFromCloud(fileId)
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
    const result = await deleteWorkspaceFromCloud(ws.fileId)
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

.cloud-workspace-dialog {
  background: white;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
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
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  border-radius: 12px 12px 0 0;
}

.dialog-header h3 {
  margin: 0;
  color: #23587b;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  line-height: 1;
  padding: 0;
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
  color: #64748b;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(35, 88, 123, 0.1);
  border-radius: 50%;
  border-top-color: #23587b;
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
  color: #475569;
  font-size: 14px;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 15px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #23587b;
  box-shadow: 0 0 0 3px rgba(35, 88, 123, 0.1);
}

.section-title {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 10px;
  font-weight: 500;
}

.workspace-list.small {
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.workspace-item {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.2s;
}

.workspace-item:last-child {
  border-bottom: none;
}

.workspace-item:hover {
  background: #f8fafc;
}

.workspace-item.selected {
  background: #eff6ff;
  border-left: 3px solid #3b82f6;
}

.ws-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ws-name {
  font-weight: 500;
  color: #334155;
  font-size: 15px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ws-time {
  font-size: 12px;
  color: #94a3b8;
}

.dialog-actions {
  margin-top: 24px;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #23587b 0%, #2d6a94 100%);
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
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s;
}

.workspace-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border-color: #cbd5e1;
}

.card-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  cursor: pointer;
}

.card-icon {
  font-size: 24px;
  background: #f1f5f9;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.ws-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.icon-btn {
  background: none;
  border: none;
  font-size: 16px;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  color: #94a3b8;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
}

.error-message {
  color: #ef4444;
  font-size: 13px;
  background: #fef2f2;
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid #ef4444;
  margin-top: 16px;
}

.mt-16 {
  margin-top: 16px;
}
</style>
