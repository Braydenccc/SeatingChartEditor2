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

        <input ref="workspaceInput" type="file" accept=".sce,.bydsce.json" class="hidden-input" @change="handleLoadWorkspace" />
        <div class="action-grid">
          <button class="action-button danger-soft" type="button" @click="handleNewWorkspace">
            <FilePlus :size="18" stroke-width="2" />
            <span>{{ isConfirming('newWorkspace').value ? '再次点击确认新建' : '新建工作区' }}</span>
          </button>
          <button class="action-button" type="button" @click="workspaceInput?.click()">
            <FolderOpen :size="18" stroke-width="2" />
            <span>加载本地</span>
          </button>
          <button class="action-button" type="button" @click="handleSaveWorkspace">
            <Save :size="18" stroke-width="2" />
            <span>保存到本地</span>
          </button>
          <button class="action-button" type="button" @click="openCloudLoad">
            <CloudDownload :size="18" stroke-width="2" />
            <span>从云端加载</span>
          </button>
          <button class="action-button primary" type="button" @click="openCloudSave">
            <CloudUpload :size="18" stroke-width="2" />
            <span>保存至云端</span>
          </button>
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

        <input ref="excelInput" type="file" accept=".xlsx,.xls" class="hidden-input" @change="handleImportExcel" />
        <div class="action-grid">
          <button class="action-button primary" type="button" @click="router.push('/students')">
            <Users :size="18" stroke-width="2" />
            <span>名单与属性</span>
          </button>
          <button class="action-button" type="button" @click="handleDownloadTemplate">
            <Download :size="18" stroke-width="2" />
            <span>下载名单模板</span>
          </button>
          <button class="action-button" type="button" @click="excelInput?.click()">
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CloudDownload,
  CloudUpload,
  Download,
  FileInput,
  FileOutput,
  FilePlus,
  FolderOpen,
  Save,
  Users
} from 'lucide-vue-next'
import AppPageShell from '@/components/layout/AppPageShell.vue'
import { useAutoSave } from '@/composables/useAutoSave'
import { useCloudWorkspaceDialog } from '@/composables/useCloudWorkspaceDialog'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useExcelData } from '@/composables/useExcelData'
import { useLogger } from '@/composables/useLogger'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useWorkspace } from '@/composables/useWorkspace'

const router = useRouter()
const workspaceInput = ref(null)
const excelInput = ref(null)

const { requestConfirm, isConfirming } = useConfirmAction()
const { createNewWorkspace, saveWorkspace, loadWorkspace, applyWorkspaceData, saveLastWorkspace } = useWorkspace()
const { markSaved } = useAutoSave()
const { success, warning, error } = useLogger()
const { openCloudLoad, openCloudSave } = useCloudWorkspaceDialog()
const { downloadTemplate, importFromExcel, exportToExcel } = useExcelData()
const { students, addStudent, updateStudent, clearAllStudents } = useStudentData()
const { tags, addTag, clearAllTags } = useTagData()

const goEditorAfterSuccess = () => router.push('/editor')

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

const handleSaveWorkspace = () => {
  const isSuccess = saveWorkspace()
  if (isSuccess) {
    markSaved()
    success('工作区已成功保存到本地！')
  } else {
    error('工作区保存到本地失败，请查看控制台了解详情')
  }
}

const handleLoadWorkspace = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const workspace = await loadWorkspace(file)
    if (!workspace || !workspace.students || !workspace.tags) {
      error('工作区文件内容不完整或格式不正确')
      return
    }

    const isSuccess = await applyWorkspaceData(workspace)
    if (isSuccess) {
      success('工作区加载并恢复成功！')
      saveLastWorkspace({ type: 'local', name: file.name })
      goEditorAfterSuccess()
    }
  } catch (err) {
    error(`加载失败: ${err.message}`)
  } finally {
    event.target.value = ''
  }
}

const handleDownloadTemplate = () => {
  downloadTemplate()
}

const handleImportExcel = async (event) => {
  const file = event.target.files[0]
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
    event.target.value = ''
  }
}

const handleExportExcel = () => {
  try {
    exportToExcel(students.value, tags.value)
    success('Excel导出成功！')
  } catch (err) {
    error(`导出失败: ${err.message}`)
  }
}
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

.action-button.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.action-button.primary:hover {
  background: var(--color-primary-hover);
  color: var(--color-text-inverse);
}

.action-button.danger-soft {
  color: var(--color-danger);
}

@media (max-width: 900px) {
  .files-layout {
    grid-template-columns: 1fr;
    min-height: auto;
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
  .action-grid {
    grid-template-columns: 1fr;
  }
}
</style>
