<template>
  <AppPageShell title="文件" eyebrow="工作区与名单导入导出">
    <div class="files-layout">
      <NCard class="panel-section" :bordered="false" content-style="padding: 0">
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
            <NButton size="small" secondary attr-type="button" :loading="isRefreshing" :disabled="!token || isRefreshing" @click="refresh">
              <template #icon><RefreshCw :size="16" stroke-width="2" /></template>
              <span>{{ isRefreshing ? '刷新中' : '刷新' }}</span>
            </NButton>
            <NButton size="small" secondary attr-type="button" :title="cloudLoadTitle" @click="openCloudLoad">
              <template #icon><CloudDownload :size="16" stroke-width="2" /></template>
              <span>{{ cloudLoadShortLabel }}</span>
            </NButton>
            <NButton size="small" secondary attr-type="button" :title="cloudSaveTitle" @click="openCloudSave">
              <template #icon><CloudUpload :size="16" stroke-width="2" /></template>
              <span>{{ cloudSaveShortLabel }}</span>
            </NButton>
          </div>
        </div>
        <p v-if="errorMessage" class="cloud-error">{{ errorMessage }}</p>
        <div class="action-grid">
          <NButton class="action-button" type="error" secondary attr-type="button" @click="handleNewWorkspace">
            <template #icon><FilePlus :size="18" stroke-width="2" /></template>
            <span>新建工作区</span>
          </NButton>
          <NButton class="action-button" secondary attr-type="button" @click="handleLoadWorkspace">
            <template #icon><FolderOpen :size="18" stroke-width="2" /></template>
            <span>加载本地</span>
          </NButton>
          <NButton class="action-button" secondary attr-type="button" @click="handleSaveWorkspace">
            <template #icon><Save :size="18" stroke-width="2" /></template>
            <span>保存到本地</span>
          </NButton>
          <NButton class="action-button" secondary attr-type="button" @click="handleSaveWorkspaceAs">
            <template #icon><Save :size="18" stroke-width="2" /></template>
            <span>另存为</span>
          </NButton>
          <NButton class="action-button" secondary attr-type="button" :title="cloudLoadTitle" @click="openCloudLoad">
            <template #icon><CloudDownload :size="18" stroke-width="2" /></template>
            <span>{{ cloudLoadLabel }}</span>
          </NButton>
          <NButton class="action-button" secondary attr-type="button" :title="cloudSaveTitle" @click="openCloudSave">
            <template #icon><CloudUpload :size="18" stroke-width="2" /></template>
            <span>{{ cloudSaveLabel }}</span>
          </NButton>
        </div>

        <div v-if="showWorkspaceManager" class="workspace-manager">
          <div v-if="token" class="manager-toolbar">
            <NInput
              v-model:value="newCloudWorkspaceName"
              class="manager-name-input"
              size="small"
              type="text"
              placeholder="云端工作区名称"
              maxlength="50"
              @keyup.enter="handleCreateCloudWorkspace"
            />
            <NButton
              size="small"
              type="primary"
              attr-type="button"
              :disabled="isCloudActionBusy || !newCloudWorkspaceName.trim()"
              @click="handleCreateCloudWorkspace"
            >
              <template #icon><Plus :size="16" stroke-width="2" /></template>
              <span>新增</span>
            </NButton>
          </div>

          <div class="workspace-manager-list">
            <article v-if="autoSaveBackup" class="workspace-row autosave-row">
              <div class="workspace-row-main">
                <History :size="18" stroke-width="2" />
                <div class="workspace-info">
                  <strong>自动保存</strong>
                  <span>{{ autoSaveSummary }}</span>
                </div>
              </div>

              <div class="workspace-row-actions">
                <NButton
                  size="small"
                  quaternary
                  circle
                  type="primary"
                  attr-type="button"
                  title="恢复自动保存"
                  :disabled="isRestoringAutoSave"
                  @click="handleRestoreAutoSave"
                >
                  <RotateCcw :size="15" stroke-width="2" />
                </NButton>
              </div>
            </article>

            <template v-if="token">
              <div v-if="cloudWorkspaces.length === 0" class="workspace-empty-row">
                <Inbox :size="22" stroke-width="1.8" />
                <span>暂无云端工作区</span>
              </div>
              <template v-else>
                <article v-for="ws in cloudWorkspaces" :key="ws.fileId" class="workspace-row">
                  <div class="workspace-row-main">
                    <CloudDownload :size="18" stroke-width="2" />
                    <div v-if="editingWorkspaceId === ws.fileId" class="workspace-edit">
                      <NInput
                        v-model:value="editingWorkspaceName"
                        class="workspace-edit-input"
                        size="small"
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
                    <NButton
                      size="small"
                      quaternary
                      circle
                      attr-type="button"
                      title="加载工作区"
                      :disabled="isCloudActionBusy"
                      @click="handleLoadCloudWorkspace(ws)"
                    >
                      <CloudDownload :size="15" stroke-width="2" />
                    </NButton>
                    <template v-if="editingWorkspaceId === ws.fileId">
                      <NButton
                        size="small"
                        quaternary
                        circle
                        type="success"
                        attr-type="button"
                        title="保存名称"
                        :disabled="isCloudActionBusy || !editingWorkspaceName.trim()"
                        @click="handleRenameWorkspace(ws)"
                      >
                        <Check :size="15" stroke-width="2" />
                      </NButton>
                      <NButton size="small" quaternary circle attr-type="button" title="取消改名" :disabled="isCloudActionBusy" @click="handleCancelRename">
                        <X :size="15" stroke-width="2" />
                      </NButton>
                    </template>
                    <template v-else>
                      <NButton
                        size="small"
                        quaternary
                        circle
                        attr-type="button"
                        title="修改名称"
                        :disabled="isCloudActionBusy"
                        @click="handleStartRename(ws)"
                      >
                        <Pencil :size="15" stroke-width="2" />
                      </NButton>
                      <NButton
                        size="small"
                        quaternary
                        circle
                        type="error"
                        attr-type="button"
                        title="删除工作区"
                        :disabled="isCloudActionBusy"
                        @click="handleRemoveCloudWorkspace(ws)"
                      >
                        <Trash2 :size="15" stroke-width="2" />
                      </NButton>
                    </template>
                  </div>
                </article>
              </template>
            </template>
          </div>
        </div>
      </NCard>

      <NCard class="panel-section" :bordered="false" content-style="padding: 0">
        <div class="section-header">
          <Users :size="20" stroke-width="2" />
          <div>
            <h2>名单管理</h2>
            <p>维护学生、标签、数值属性，并处理 Excel 和 SDES 文件。</p>
          </div>
        </div>

        <div class="action-grid">
          <NButton class="action-button" secondary attr-type="button" @click="router.push('/students')">
            <template #icon><Users :size="18" stroke-width="2" /></template>
            <span>名单与属性</span>
          </NButton>
          <NButton class="action-button" secondary attr-type="button" @click="handleDownloadTemplate">
            <template #icon><Download :size="18" stroke-width="2" /></template>
            <span>下载名单模板</span>
          </NButton>
          <NButton class="action-button" secondary attr-type="button" @click="handleImportExcel">
            <template #icon><FileInput :size="18" stroke-width="2" /></template>
            <span>从 Excel 导入名单</span>
          </NButton>
          <NButton class="action-button" secondary attr-type="button" @click="openFuckSeatsImport">
            <template #icon><FileInput :size="18" stroke-width="2" /></template>
            <span>从不想排座位导入</span>
          </NButton>
          <NButton class="action-button" secondary attr-type="button" @click="handleExportExcel">
            <template #icon><FileOutput :size="18" stroke-width="2" /></template>
            <span>导出名单到 Excel</span>
          </NButton>
          <NButton class="action-button" secondary attr-type="button" @click="handleImportSdes">
            <template #icon><FileInput :size="18" stroke-width="2" /></template>
            <span>导入 SDES</span>
          </NButton>
          <NButton class="action-button" secondary attr-type="button" @click="handleExportSdes">
            <template #icon><FileOutput :size="18" stroke-width="2" /></template>
            <span>导出 SDES</span>
          </NButton>
        </div>
      </NCard>
    </div>
    <FuckSeatsImportDialog
      v-model:visible="showFuckSeatsImportDialog"
      @imported="handleFuckSeatsImported"
    />
    <SdesImportDialog
      v-model:visible="showSdesImportDialog"
      :file-name="sdesFileName"
      :targets="sdesTargets"
      :is-importing="isImportingSdes"
      @import="handleConfirmSdesImport"
    />
  </AppPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NButton, NCard, NInput } from 'naive-ui'
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
  History,
  Inbox,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
  Users
} from 'lucide-vue-next'
import AppPageShell from '@/components/layout/AppPageShell.vue'
import FuckSeatsImportDialog from '@/components/student/FuckSeatsImportDialog.vue'
import SdesImportDialog from '@/components/workspace/SdesImportDialog.vue'
import { useAuth } from '@/composables/useAuth'
import { useAutoSave } from '@/composables/useAutoSave'
import { useCloudWorkspace } from '@/composables/useCloudWorkspace'
import type { CloudWorkspaceFile } from '@/composables/useCloudWorkspace'
import { useCloudWorkspaceDialog } from '@/composables/useCloudWorkspaceDialog'
import { useCloudWorkspaceStats } from '@/composables/useCloudWorkspaceStats'
import { useExcelData } from '@/composables/useExcelData'
import { useLogger } from '@/composables/useLogger'
import { useRosterExcelImport } from '@/composables/useRosterExcelImport'
import { formatSdesReportSummary, useSdesExchange } from '@/composables/useSdesExchange'
import type { SdesDocument, SdesImportTarget } from '@/composables/useSdesExchange'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useWorkspace } from '@/composables/useWorkspace'
import { excelFileFilters, openBinaryFile, openTextFile, sdesFileFilters } from '@/platform/files'

const router = useRouter()
const newCloudWorkspaceName = ref('')
const editingWorkspaceId = ref<string | null>(null)
const editingWorkspaceName = ref('')
const showFuckSeatsImportDialog = ref(false)
const showSdesImportDialog = ref(false)
const sdesDocument = ref<SdesDocument | null>(null)
const sdesTargets = ref<SdesImportTarget[]>([])
const sdesFileName = ref('')
const isImportingSdes = ref(false)
const isRestoringAutoSave = ref(false)

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
const {
  autoSaveBackup,
  getAutoSaveBackup,
  restoreAutoSaveBackup
} = useAutoSave()
const { success, warning, error, confirm } = useLogger()
const { token, isLoggedIn } = useAuth()
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
const { downloadTemplate, exportToExcel } = useExcelData()
const {
  parseSdesText,
  getSdesImportTargets,
  importSdesTarget,
  exportCurrentSdes
} = useSdesExchange()
const { students } = useStudentData()
const { tags } = useTagData()
const { beginExcelRosterImport } = useRosterExcelImport()

const cloudWorkspaces = computed(() => workspaces.value || [])
const isCloudActionBusy = computed(() => isRefreshing.value || isManagingCloud.value)
const showWorkspaceManager = computed(() => !!token.value || !!autoSaveBackup.value)
const goEditorAfterSuccess = () => router.push('/editor')
const cloudLoadLabel = computed(() => isLoggedIn.value ? '从云端加载' : '登录后从云端加载')
const cloudSaveLabel = computed(() => isLoggedIn.value ? '保存至云端' : '登录后保存至云端')
const cloudLoadShortLabel = computed(() => isLoggedIn.value ? '加载' : '登录后加载')
const cloudSaveShortLabel = computed(() => isLoggedIn.value ? '保存' : '登录后保存')
const cloudLoadTitle = computed(() => isLoggedIn.value ? '从云端加载工作区' : '需要先登录或配置 WebDAV')
const cloudSaveTitle = computed(() => isLoggedIn.value ? '保存当前工作区至云端' : '需要先登录或配置 WebDAV')

const getWorkspaceName = (workspace: CloudWorkspaceFile) => workspace.metadata.name || '未命名工作区'

const formatWorkspaceDate = (value?: string) => {
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

const formatWorkspaceSize = (bytes?: number) => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex] ?? 'B'}`
}

const autoSaveSummary = computed(() => {
  const backup = autoSaveBackup.value
  if (!backup) return ''

  const studentCount = Array.isArray(backup.data?.students) ? backup.data.students.length : 0
  const assignedCount = Array.isArray(backup.data?.layout?.seats)
    ? backup.data.layout.seats.filter(seat => seat.studentId != null).length
    : 0
  const backupSize = formatWorkspaceSize(backup.size)

  return `${formatWorkspaceDate(backup.timeIso)} · ${studentCount} 名学生 · ${assignedCount} 个已排座位 · ${backupSize}`
})

const handleNewWorkspace = async () => {
  const confirmed = await confirm({
    title: '新建工作区',
    content: '新建工作区会清空当前未另行保存的编辑内容，是否继续？',
    positiveText: '新建',
    type: 'warning'
  })
  if (!confirmed) return
  const isSuccess = createNewWorkspace()
  if (isSuccess) goEditorAfterSuccess()
}

const handleSaveWorkspace = async () => {
  const isSuccess = await saveWorkspace()
  if (isSuccess) {
    success('工作区已成功保存到本地！')
  } else {
    error('工作区保存到本地失败，请查看控制台了解详情')
  }
}

const handleSaveWorkspaceAs = async () => {
  const isSuccess = await saveWorkspaceAs()
  if (isSuccess) {
    success('工作区已成功另存到本地！')
  } else {
    error('工作区另存到本地失败，请查看控制台了解详情')
  }
}

const getFileInput = (event: Event | null): HTMLInputElement | null => (
  event?.target instanceof HTMLInputElement ? event.target : null
)

const getErrorMessage = (value: unknown) => value instanceof Error ? value.message : String(value)

const handleLoadWorkspace = async (event: Event | null = null) => {
  const input = getFileInput(event)
  const file = input?.files?.[0] || null

  try {
    const loadedWorkspace = await loadWorkspace(file)
    if (!loadedWorkspace) return

    const isSuccess = await applyWorkspaceData(loadedWorkspace.data, {
      localPath: loadedWorkspace.path
    })
    if (isSuccess) {
      success('工作区加载并恢复成功！')
      saveLastWorkspace({ type: 'local', name: loadedWorkspace.name || '本地工作区' })
      goEditorAfterSuccess()
    }
  } catch (err) {
    error(`加载失败: ${getErrorMessage(err)}`)
  } finally {
    if (input) input.value = ''
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

    newCloudWorkspaceName.value = ''
    if (result.data?.fileId) {
      saveLastWorkspace({
        type: 'cloud',
        name: trimmedName,
        fileId: result.data.fileId,
        source: 'retiehe'
      })
    }
    success('云端工作区已新增')
    await refresh()
  } catch (err) {
    error(`新增失败: ${getErrorMessage(err)}`)
  }
}

const handleLoadCloudWorkspace = async (workspace: CloudWorkspaceFile) => {
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
    error(`加载失败: ${getErrorMessage(err)}`)
  }
}

const handleRestoreAutoSave = async () => {
  if (isRestoringAutoSave.value) return

  isRestoringAutoSave.value = true
  try {
    const isSuccess = await restoreAutoSaveBackup(autoSaveBackup.value)
    if (!isSuccess) {
      error('自动保存恢复失败，请稍后重试或手动加载工作区')
      return
    }

    success('已恢复自动保存的工作区')
    goEditorAfterSuccess()
  } catch (err) {
    error(`自动保存恢复失败: ${getErrorMessage(err)}`)
  } finally {
    isRestoringAutoSave.value = false
  }
}

const handleStartRename = (workspace: CloudWorkspaceFile) => {
  editingWorkspaceId.value = workspace.fileId
  editingWorkspaceName.value = getWorkspaceName(workspace)
}

const handleCancelRename = () => {
  editingWorkspaceId.value = null
  editingWorkspaceName.value = ''
}

const handleRenameWorkspace = async (workspace: CloudWorkspaceFile) => {
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
    error(`改名失败: ${getErrorMessage(err)}`)
  }
}

const handleRemoveCloudWorkspace = async (workspace: CloudWorkspaceFile) => {
  const name = getWorkspaceName(workspace)
  const confirmed = await confirm({
    title: '删除云端工作区',
    content: `确认删除“${name}”？此操作无法在应用内撤销。`,
    positiveText: '删除',
    type: 'error'
  })
  if (!confirmed) return
  const result = await deleteWorkspaceFromCloud(workspace.fileId, 'retiehe')
  if (!result.success) {
    error(result.message || '移除工作区失败')
    return
  }
  if (editingWorkspaceId.value === workspace.fileId) handleCancelRename()
  const lastWorkspace = getLastWorkspace()
  if (lastWorkspace?.type === 'cloud' && lastWorkspace.fileId === workspace.fileId) clearLastWorkspace()
  success(`已删除“${name}”`)
  await refresh()
}

const handleDownloadTemplate = async () => {
  await downloadTemplate()
}

const openFuckSeatsImport = () => {
  showFuckSeatsImportDialog.value = true
}

const handleFuckSeatsImported = () => {
  goEditorAfterSuccess()
}

const handleImportExcel = async (event: Event | null = null) => {
  const input = getFileInput(event)
  const file = input?.files?.[0] || await openBinaryFile({
    title: '导入学生名单',
    accept: '.xlsx,.xls',
    filters: excelFileFilters
  })
  if (!file) return

  try {
    await beginExcelRosterImport(file)
  } catch (err) {
    error(`导入失败: ${getErrorMessage(err)}`)
  } finally {
    if (input) input.value = ''
  }
}

const handleExportExcel = async () => {
  try {
    await exportToExcel(students.value, tags.value)
    success('Excel导出成功！')
  } catch (err) {
    error(`导出失败: ${getErrorMessage(err)}`)
  }
}

const handleImportSdes = async () => {
  try {
    const selected = await openTextFile({
      title: '导入 SDES',
      accept: '.sdes.json,.json,application/json',
      filters: sdesFileFilters
    })
    if (!selected) return

    const document = parseSdesText(selected.text)
    const targets = getSdesImportTargets(document)
    if (targets.length === 0) {
      error('SDES 文件中没有当前可导入的座位表')
      return
    }

    sdesDocument.value = document
    sdesTargets.value = targets
    sdesFileName.value = selected.name
    showSdesImportDialog.value = true
  } catch (err) {
    error(`SDES 导入失败: ${getErrorMessage(err)}`)
  }
}

const handleConfirmSdesImport = async (target: SdesImportTarget) => {
  if (!sdesDocument.value || !target || isImportingSdes.value) return

  isImportingSdes.value = true
  try {
    const report = await importSdesTarget(sdesDocument.value, target)
    const summary = formatSdesReportSummary(report)
    success(`SDES 导入完成：${target.className} / ${target.chartName}`)
    if (report.warnings.length > 0) {
      warning(`SDES 兼容性提示：${summary}`)
    }
    showSdesImportDialog.value = false
    goEditorAfterSuccess()
  } catch (err) {
    error(`SDES 导入失败: ${getErrorMessage(err)}`)
  } finally {
    isImportingSdes.value = false
  }
}

const handleExportSdes = async () => {
  try {
    const result = await exportCurrentSdes()
    if (result.success) {
      success('SDES 导出成功！')
    } else if (!result.canceled) {
      error('SDES 导出失败，请查看控制台了解详情')
    }
  } catch (err) {
    error(`SDES 导出失败: ${getErrorMessage(err)}`)
  }
}

onMounted(() => {
  void getAutoSaveBackup().catch((autoSaveError) => {
    error(`读取自动保存备份失败：${getErrorMessage(autoSaveError)}`)
  })
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

.cloud-error {
  margin: -6px 0 12px;
  color: var(--color-danger);
  font-size: 12px;
}

.action-button {
  min-height: 44px;
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

.workspace-row.autosave-row {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-subtle));
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
  }
}
</style>
