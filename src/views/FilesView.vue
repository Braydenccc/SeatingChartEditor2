<template>
  <AppPageShell title="文件" eyebrow="工作区与名单导入导出">
    <div class="files-layout">
      <section class="panel-section">
        <div class="section-header">
          <FolderOpen :size="20" stroke-width="2" />
          <div>
            <h2>工作区管理</h2>
            <p>新建、加载和保存完整座位表工作区。</p>
          </div>
        </div>

        <div class="cloud-summary">
          <div class="cloud-summary-main">
            <CloudDownload :size="18" stroke-width="2" />
            <div>
              <strong>SCE 云端工作区</strong>
              <span v-if="token">{{ workspaceCount }} 个，{{ totalSizeText }}，最近：{{ recentWorkspaceName }}</span>
              <span v-else>登录 SCE 账号后显示云端摘要</span>
            </div>
          </div>
          <div class="cloud-summary-actions">
            <button class="compact-button" type="button" :disabled="!token || isRefreshing" @click="refresh">
              <RefreshCw :size="16" stroke-width="2" />
              <span>{{ isRefreshing ? '刷新中' : '刷新' }}</span>
            </button>
            <button class="compact-button" type="button" @click="openCloudLoad">
              <CloudDownload :size="16" stroke-width="2" />
              <span>加载</span>
            </button>
            <button class="compact-button" type="button" @click="openCloudSave">
              <CloudUpload :size="16" stroke-width="2" />
              <span>保存</span>
            </button>
          </div>
        </div>
        <p v-if="errorMessage" class="cloud-error">{{ errorMessage }}</p>
        <div class="action-grid">
          <button class="action-button danger-soft" type="button" @click="handleNewWorkspace">
            <FilePlus :size="18" stroke-width="2" />
            <span>{{ isConfirming('newWorkspace').value ? '再次点击确认新建' : '新建工作区' }}</span>
          </button>
          <button class="action-button" type="button" @click="handleLoadWorkspace">
            <FolderOpen :size="18" stroke-width="2" />
            <span>加载本地</span>
          </button>
          <button class="action-button" type="button" @click="handleSaveWorkspace">
            <Save :size="18" stroke-width="2" />
            <span>保存到本地</span>
          </button>
          <button class="action-button" type="button" @click="handleSaveWorkspaceAs">
            <Save :size="18" stroke-width="2" />
            <span>另存为</span>
          </button>
          <button class="action-button" type="button" @click="openCloudLoad">
            <CloudDownload :size="18" stroke-width="2" />
            <span>从云端加载</span>
          </button>
          <button class="action-button" type="button" @click="openCloudSave">
            <CloudUpload :size="18" stroke-width="2" />
            <span>保存至云端</span>
          </button>
        </div>

        <div v-if="token" class="workspace-manager">
          <div class="manager-toolbar">
            <input
              v-model="newCloudWorkspaceName"
              class="manager-name-input"
              type="text"
              placeholder="云端工作区名称"
              maxlength="50"
              @keyup.enter="handleCreateCloudWorkspace"
            />
            <button
              class="compact-button primary"
              type="button"
              :disabled="isCloudActionBusy || !newCloudWorkspaceName.trim()"
              @click="handleCreateCloudWorkspace"
            >
              <Plus :size="16" stroke-width="2" />
              <span>新增</span>
            </button>
          </div>

          <div v-if="cloudWorkspaces.length === 0" class="workspace-empty-row">
            <Inbox :size="22" stroke-width="1.8" />
            <span>暂无云端工作区</span>
          </div>
          <div v-else class="workspace-manager-list">
            <article v-for="ws in cloudWorkspaces" :key="ws.fileId" class="workspace-row">
              <div class="workspace-row-main">
                <CloudDownload :size="18" stroke-width="2" />
                <div v-if="editingWorkspaceId === ws.fileId" class="workspace-edit">
                  <input
                    v-model="editingWorkspaceName"
                    class="workspace-edit-input"
                    type="text"
                    maxlength="50"
                    @keyup.enter="handleRenameWorkspace(ws)"
                    @keyup.esc="handleCancelRename"
                  />
                </div>
                <div v-else class="workspace-info">
                  <strong>{{ getWorkspaceName(ws) }}</strong>
                  <span>{{ formatWorkspaceDate(ws.metadata?.time) }} · {{ formatWorkspaceSize(ws.metadata?.size) }}</span>
                </div>
              </div>

              <div class="workspace-row-actions">
                <button
                  class="icon-button"
                  type="button"
                  title="加载工作区"
                  :disabled="isCloudActionBusy"
                  @click="handleLoadCloudWorkspace(ws)"
                >
                  <CloudDownload :size="15" stroke-width="2" />
                </button>
                <template v-if="editingWorkspaceId === ws.fileId">
                  <button
                    class="icon-button success"
                    type="button"
                    title="保存名称"
                    :disabled="isCloudActionBusy || !editingWorkspaceName.trim()"
                    @click="handleRenameWorkspace(ws)"
                  >
                    <Check :size="15" stroke-width="2" />
                  </button>
                  <button class="icon-button" type="button" title="取消改名" :disabled="isCloudActionBusy" @click="handleCancelRename">
                    <X :size="15" stroke-width="2" />
                  </button>
                </template>
                <template v-else>
                  <button
                    class="icon-button"
                    type="button"
                    title="修改名称"
                    :disabled="isCloudActionBusy"
                    @click="handleStartRename(ws)"
                  >
                    <Pencil :size="15" stroke-width="2" />
                  </button>
                  <button
                    class="icon-button danger"
                    type="button"
                    title="删除工作区"
                    :disabled="isCloudActionBusy"
                    @click="handleRemoveCloudWorkspace(ws)"
                  >
                    <Trash2 :size="15" stroke-width="2" />
                  </button>
                </template>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="panel-section">
        <div class="section-header">
          <Users :size="20" stroke-width="2" />
          <div>
            <h2>名单管理</h2>
            <p>维护学生、标签、数值属性，并处理 Excel 文件。</p>
          </div>
        </div>

        <div class="action-grid">
          <button class="action-button" type="button" @click="router.push('/students')">
            <Users :size="18" stroke-width="2" />
            <span>名单与属性</span>
          </button>
          <button class="action-button" type="button" @click="handleDownloadTemplate">
            <Download :size="18" stroke-width="2" />
            <span>下载名单模板</span>
          </button>
          <button class="action-button" type="button" @click="handleImportExcel">
            <FileInput :size="18" stroke-width="2" />
            <span>从 Excel 导入名单</span>
          </button>
          <button class="action-button" type="button" @click="handleExportExcel">
            <FileOutput :size="18" stroke-width="2" />
            <span>导出名单到 Excel</span>
          </button>
        </div>
      </section>
    </div>
  </AppPageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Check,
  CloudDownload,
  CloudUpload,
  Download,
  FileInput,
  FileOutput,
  FilePlus,
  FolderOpen,
  Inbox,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
  Users
} from 'lucide-vue-next'
import AppPageShell from '@/components/layout/AppPageShell.vue'
import { useAuth } from '@/composables/useAuth'
import { useAutoSave } from '@/composables/useAutoSave'
import { useCloudWorkspace } from '@/composables/useCloudWorkspace'
import { useCloudWorkspaceDialog } from '@/composables/useCloudWorkspaceDialog'
import { useCloudWorkspaceStats } from '@/composables/useCloudWorkspaceStats'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useExcelData } from '@/composables/useExcelData'
import { useLogger } from '@/composables/useLogger'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useWorkspace } from '@/composables/useWorkspace'
import { excelFileFilters, openBinaryFile } from '@/platform/files'

const router = useRouter()
const newCloudWorkspaceName = ref('')
const editingWorkspaceId = ref(null)
const editingWorkspaceName = ref('')

const { requestConfirm, isConfirming } = useConfirmAction()
const {
  createNewWorkspace,
  saveWorkspace,
  saveWorkspaceAs,
  loadWorkspace,
  applyWorkspaceData,
  saveLastWorkspace,
  getLastWorkspace,
  clearLastWorkspace,
  getWorkspaceJson
} = useWorkspace()
const { markSaved } = useAutoSave()
const { success, warning, error } = useLogger()
const { token } = useAuth()
const { openCloudLoad, openCloudSave } = useCloudWorkspaceDialog()
const {
  isFetching: isManagingCloud,
  saveWorkspaceToCloud,
  loadWorkspaceFromCloud,
  deleteWorkspaceFromCloud,
  renameWorkspaceInCloud
} = useCloudWorkspace()
const {
  workspaces,
  workspaceCount,
  totalSizeText,
  recentWorkspaceName,
  isRefreshing,
  errorMessage,
  refresh
} = useCloudWorkspaceStats({ source: 'retiehe' })
const { downloadTemplate, importFromExcel, exportToExcel } = useExcelData()
const { students, addStudent, updateStudent, clearAllStudents } = useStudentData()
const { tags, addTag, clearAllTags } = useTagData()

const cloudWorkspaces = computed(() => workspaces.value || [])
const isCloudActionBusy = computed(() => isRefreshing.value || isManagingCloud.value)
const goEditorAfterSuccess = () => router.push('/editor')

const getWorkspaceName = (workspace) => workspace.metadata?.name || '未命名工作区'

const formatWorkspaceDate = (value) => {
  if (!value) return '未知时间'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

const formatWorkspaceSize = (bytes) => {
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

const handleNewWorkspace = () => {
  const confirmed = requestConfirm('newWorkspace', () => {
    const isSuccess = createNewWorkspace()
    if (isSuccess) {
      markSaved()
      goEditorAfterSuccess()
    }
  }, '再次点击确认新建')

  if (!confirmed) {
    warning('再次点击"新建工作区"按钮以确认清空当前工作区')
  }
}

const handleSaveWorkspace = async () => {
  const isSuccess = await saveWorkspace()
  if (isSuccess) {
    markSaved()
    success('工作区已成功保存到本地！')
  } else {
    error('工作区保存到本地失败，请查看控制台了解详情')
  }
}

const handleSaveWorkspaceAs = async () => {
  const isSuccess = await saveWorkspaceAs()
  if (isSuccess) {
    markSaved()
    success('工作区已成功另存到本地！')
  } else {
    error('工作区另存到本地失败，请查看控制台了解详情')
  }
}

const handleLoadWorkspace = async (event = null) => {
  const file = event?.target?.files?.[0] || null

  try {
    const workspace = await loadWorkspace(file)
    if (!workspace) return
    if (!workspace || !workspace.students || !workspace.tags) {
      error('工作区文件内容不完整或格式不正确')
      return
    }

    const isSuccess = await applyWorkspaceData(workspace)
    if (isSuccess) {
      success('工作区加载并恢复成功！')
      saveLastWorkspace({ type: 'local', name: file?.name || '本地工作区' })
      goEditorAfterSuccess()
    }
  } catch (err) {
    error(`加载失败: ${err.message}`)
  } finally {
    if (event?.target) {
      event.target.value = ''
    }
  }
}

const handleCreateCloudWorkspace = async () => {
  const trimmedName = newCloudWorkspaceName.value.trim()
  if (!trimmedName) return

  try {
    const jsonContent = getWorkspaceJson()
    if (!jsonContent) {
      throw new Error('生成工作区数据失败')
    }

    const result = await saveWorkspaceToCloud(trimmedName, jsonContent, null, 'retiehe')
    if (!result.success) {
      error(result.message || '新增云端工作区失败')
      return
    }

    markSaved()
    newCloudWorkspaceName.value = ''
    saveLastWorkspace({
      type: 'cloud',
      name: trimmedName,
      fileId: result.data?.fileId,
      source: 'retiehe'
    })
    success('云端工作区已新增')
    await refresh()
  } catch (err) {
    error(`新增失败: ${err.message || err}`)
  }
}

const handleLoadCloudWorkspace = async (workspace) => {
  try {
    const result = await loadWorkspaceFromCloud(workspace.fileId, 'retiehe')
    if (!result.success || !result.data?.content) {
      error(result.message || '加载云端工作区失败')
      return
    }

    const workspaceData = typeof result.data.content === 'string'
      ? JSON.parse(result.data.content)
      : result.data.content
    const isSuccess = await applyWorkspaceData(workspaceData)
    if (isSuccess) {
      saveLastWorkspace({
        type: 'cloud',
        name: getWorkspaceName(workspace),
        fileId: workspace.fileId,
        source: 'retiehe'
      })
      success('云端工作区加载并恢复成功！')
      goEditorAfterSuccess()
    }
  } catch (err) {
    error(`加载失败: ${err.message || err}`)
  }
}

const handleStartRename = (workspace) => {
  editingWorkspaceId.value = workspace.fileId
  editingWorkspaceName.value = getWorkspaceName(workspace)
}

const handleCancelRename = () => {
  editingWorkspaceId.value = null
  editingWorkspaceName.value = ''
}

const handleRenameWorkspace = async (workspace) => {
  const trimmedName = editingWorkspaceName.value.trim()
  if (!trimmedName) return

  try {
    const result = await renameWorkspaceInCloud(workspace.fileId, trimmedName, 'retiehe')
    if (!result.success) {
      error(result.message || '修改工作区名称失败')
      return
    }

    handleCancelRename()
    success('工作区名称已更新')
    await refresh()
  } catch (err) {
    error(`改名失败: ${err.message || err}`)
  }
}

const handleRemoveCloudWorkspace = (workspace) => {
  const name = getWorkspaceName(workspace)
  const confirmed = requestConfirm(`removeCloudWorkspace_${workspace.fileId}`, async () => {
    const result = await deleteWorkspaceFromCloud(workspace.fileId, 'retiehe')
    if (!result.success) {
      error(result.message || '移除工作区失败')
      return
    }

    if (editingWorkspaceId.value === workspace.fileId) {
      handleCancelRename()
    }

    const lastWorkspace = getLastWorkspace()
    if (lastWorkspace?.type === 'cloud' && lastWorkspace.fileId === workspace.fileId) {
      clearLastWorkspace()
    }

    success(`已标记删除 "${name}"`)
    await refresh()
  }, '再次点击确认移除')

  if (!confirmed) {
    warning(`再次点击以标记删除 "${name}"`)
  }
}

const handleDownloadTemplate = async () => {
  await downloadTemplate()
}

const handleImportExcel = async (event = null) => {
  const file = event?.target?.files?.[0] || await openBinaryFile({
    title: '导入学生名单',
    accept: '.xlsx,.xls',
    filters: excelFileFilters
  })
  if (!file) return

  try {
    const result = await importFromExcel(file)
    if (result.warning) {
      warning(result.warning + '，请减少数据量后重试')
      return
    }

    clearAllStudents()
    clearAllTags()
    const colors = [
      'var(--tag-color-1)',
      'var(--tag-color-2)',
      'var(--tag-color-3)',
      'var(--tag-color-4)',
      'var(--tag-color-5)',
      'var(--tag-color-6)',
      'var(--tag-color-7)',
      'var(--tag-color-8)',
      'var(--tag-color-9)',
      'var(--tag-color-10)'
    ]
    const tagNameToId = {}

    result.tagNames.forEach((tagName, index) => {
      const newTagId = addTag({ name: tagName, color: colors[index % colors.length] })
      tagNameToId[tagName] = newTagId
    })

    result.students.forEach(studentData => {
      const studentTags = studentData.tagNames
        .map(tagName => tagNameToId[tagName])
        .filter(id => id != null)
      const newStudentId = addStudent()
      updateStudent(newStudentId, {
        name: studentData.name,
        studentNumber: studentData.studentNumber,
        tags: studentTags,
        numericAttributes: studentData.numericAttributes || {}
      })
    })

    success(`成功导入 ${result.students.length} 个学生，${result.tagNames.length} 个标签`)
    router.push('/students')
  } catch (err) {
    error(`导入失败: ${err.message}`)
  } finally {
    if (event?.target) {
      event.target.value = ''
    }
  }
}

const handleExportExcel = async () => {
  try {
    await exportToExcel(students.value, tags.value)
    success('Excel导出成功！')
  } catch (err) {
    error(`导出失败: ${err.message}`)
  }
}

onMounted(() => {
  if (token.value) refresh()
})
</script>

<style scoped>
.files-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  min-height: 100%;
  background: var(--color-surface);
}

.panel-section {
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  padding: 22px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel-section:last-child {
  border-right: none;
}

.section-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  color: var(--color-primary);
  margin-bottom: 16px;
}

.section-header h2 {
  margin: 0 0 4px;
  font-size: 17px;
  color: var(--color-text-primary);
}

.section-header p {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.hidden-input {
  display: none;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.cloud-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 58px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
}

.cloud-summary-main {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-primary);
  min-width: 0;
}

.cloud-summary-main div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.cloud-summary-main strong {
  color: var(--color-text-primary);
  font-size: 13px;
}

.cloud-summary-main span {
  color: var(--color-text-secondary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cloud-summary-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.compact-button {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.compact-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.compact-button.primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.compact-button.primary:hover {
  background: var(--color-primary-hover);
  color: var(--color-text-inverse);
}

.compact-button:disabled {
  cursor: not-allowed;
  color: var(--color-text-disabled);
  background: var(--color-bg-soft);
}

.cloud-error {
  margin: -6px 0 12px;
  color: var(--color-danger);
  font-size: 12px;
}

.action-button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.action-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-surface);
}

.action-button.danger-soft {
  color: var(--color-danger);
}

.workspace-manager {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.manager-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.manager-name-input,
.workspace-edit-input {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 13px;
  outline: none;
}

.manager-name-input {
  min-height: 36px;
  padding: 0 10px;
}

.workspace-edit-input {
  min-height: 34px;
  padding: 0 9px;
}

.manager-name-input:focus,
.workspace-edit-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.workspace-empty-row {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed var(--color-border-strong);
  border-radius: 8px;
  background: var(--color-bg-subtle);
  color: var(--color-text-muted);
  font-size: 13px;
}

.workspace-manager-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 340px;
  overflow: auto;
}

.workspace-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 58px;
  padding: 9px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
}

.workspace-row-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-primary);
}

.workspace-info,
.workspace-edit {
  min-width: 0;
  flex: 1;
}

.workspace-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.workspace-info strong,
.workspace-info span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-info strong {
  color: var(--color-text-primary);
  font-size: 13px;
}

.workspace-info span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.workspace-row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-button {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.icon-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.icon-button.success:hover {
  border-color: var(--color-success);
  color: var(--color-success);
}

.icon-button.danger:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
  background: var(--color-danger-bg);
}

.icon-button:disabled {
  cursor: not-allowed;
  color: var(--color-text-disabled);
  background: var(--color-bg-soft);
}

@media (max-width: 900px) {
  .files-layout {
    grid-template-columns: 1fr;
    min-height: auto;
    overflow: auto;
  }

  .panel-section {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    padding: 16px;
  }

  .panel-section:last-child {
    border-bottom: none;
  }
}

@media (max-width: 560px) {
  .panel-section {
    padding: 14px 12px;
  }

  .section-header {
    gap: 10px;
    margin-bottom: 12px;
  }

  .section-header h2 {
    font-size: 16px;
  }

  .section-header p {
    font-size: 12px;
    line-height: 1.5;
  }

  .action-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .cloud-summary {
    align-items: stretch;
    flex-direction: column;
  }

  .cloud-summary-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .manager-toolbar,
  .workspace-row {
    grid-template-columns: 1fr;
  }

  .workspace-row-actions {
    justify-content: flex-end;
  }

  .action-button {
    min-height: 44px;
    justify-content: flex-start;
    padding: 0 14px;
  }
}
</style>
