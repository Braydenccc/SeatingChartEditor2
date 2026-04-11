<template>
  <div class="student-list-container" :class="{ 'all-assigned': unassignedStudents.length === 0 }">
    <div class="student-list-header">
      <div class="header-left">
        <template v-if="students.length === 0">
          <div class="status-block empty-state">
            <div class="status-indicator"></div>
            <span class="status-text">暂无学生数据</span>
          </div>
        </template>
        <template v-else>
          <div class="status-block">
            <div class="status-indicator" :class="`mode-${currentMode.toLowerCase()}`"></div>
            <span class="status-text">{{ modeLabel }}</span>
            <span class="candidate-count" v-if="unassignedStudents.length > 0">
              {{ unassignedStudents.length }}
            </span>
          </div>
          <div class="header-actions">
            <button v-if="currentMode !== EditMode.NORMAL" class="icon-btn btn-ghost" title="退出当前模式" @click="exitCurrentMode">
              <X :size="14" stroke-width="2.5" />
              <span>{{ currentMode === EditMode.ZONE_EDIT ? '完成' : '取消' }}</span>
            </button>
            <button v-else class="icon-btn btn-primary-light" title="开始导出" @click="showExportDialog = true">
              <FileOutput :size="14" stroke-width="2.5" />
              <span>导出</span>
            </button>
          </div>
        </template>
      </div>
      <div class="header-divider"></div>
      <div class="header-right">
        <button v-if="unassignedStudents.length > 0" class="icon-btn btn-primary" title="随机排位" @click="handleRandomAssign">
          <Shuffle :size="15" stroke-width="2.5" />
          <span>一键排入</span>
        </button>
        <button class="icon-btn" title="标签设置" @click="showTagSettingsDialog = true">
          <Tag :size="15" stroke-width="2.5" />
          <span>标签</span>
        </button>
        <button class="icon-btn" title="编辑名单" @click="showRosterDialog = true">
          <Users :size="15" stroke-width="2.5" />
          <span>名单</span>
        </button>
      </div>
    </div>

    <!-- 学生列表 / 空状态占位 -->
    <div ref="studentItemsRef" class="student-items" @dragover.prevent="handleDragOver" @drop.prevent="handleDrop" @dragleave="handleDragLeave"
      :class="{ 'drag-over': isDragOver, 'is-empty': unassignedStudents.length === 0, 'touch-dragging': isTouchDraggingFromSeat }">

      <!-- 有未分配学生时正常显示 -->
      <CandidateItem
        v-for="student in unassignedStudents"
        :key="student.id"
        :student="student"
      />

      <!-- 空状态占位：无学生数据 -->
      <div v-if="students.length === 0" class="empty-placeholder">
        <div class="empty-content-row">
          <div class="empty-icon">
            <Users :size="36" stroke-width="1.5" />
          </div>
          <div class="empty-text-group">
            <p class="empty-title">还没有学生数据</p>
            <p class="empty-hint">导入 Excel 或打开工作区开始使用</p>
          </div>
        </div>

        <!-- 操作按钮组 -->
        <div class="empty-actions">
          <input ref="excelInput" type="file" accept=".xlsx,.xls" style="display: none" @change="handleImportExcel" />
          <button class="empty-action-btn primary" @click="$refs.excelInput.click()">
            <FileInput :size="16" stroke-width="2" />
            <span>导入 Excel 名单</span>
          </button>
          <div class="empty-action-row">
            <input ref="workspaceInput" type="file" accept=".sce,.bydsce.json" style="display: none" @change="handleLoadWorkspace" />
            <button class="empty-action-btn outline" @click="$refs.workspaceInput.click()">
              <FolderOpen :size="14" stroke-width="2" />
              <span>本地工作区</span>
            </button>
            <button class="empty-action-btn outline" @click="handleCloudLoad">
              <CloudDownload :size="14" stroke-width="2" />
              <span>云端工作区</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态占位：全部已分配 -->
      <div v-else-if="unassignedStudents.length === 0 && students.length > 0" v-show="!isTouchDraggingFromSeat" class="empty-placeholder assigned-done">
        <div class="empty-content-row">
          <div class="empty-icon success">
            <CheckCircle :size="32" stroke-width="2" />
          </div>
          <div class="empty-text-group">
            <p class="empty-title">全部学生已入座</p>
            <p class="empty-hint">{{ students.length }} 名学生已安排到座位上</p>
          </div>
        </div>
      </div>

      <!-- 手机端触摸拖拽「移出」覆盖层：从座位长按拖拽时显示 -->
      <div
        v-if="isTouchDraggingFromSeat && students.length > 0"
        class="touch-drop-out-overlay"
        :class="{ 'touch-drop-over': isTouchDropOver }"
      >
        <LogOut :size="18" stroke-width="2" />
        <span>拖到此处移出</span>
      </div>
    </div>

    <StudentRosterDialog v-model:visible="showRosterDialog" />
    <TagSettingsDialog v-model:visible="showTagSettingsDialog" />
    
    <!-- 云端工作区弹窗 -->
    <CloudWorkspaceDialog
      v-if="showCloudDialog"
      :visible="showCloudDialog"
      :mode="cloudDialogMode"
      @update:visible="showCloudDialog = $event"
      @success="handleCloudSuccess"
    />
    
    <!-- 导出设置弹窗 -->
    <ExportDialog v-if="showExportDialog" :visible="showExportDialog" @close="showExportDialog = false" @exported="onExported" />
  </div>
</template>

<script setup>
import { computed, ref, defineAsyncComponent, onBeforeUnmount, onMounted, onUnmounted } from 'vue'
import { Shuffle, Users, Tag, X, FileInput, FolderOpen, CloudDownload, FileOutput, Settings2, Loader2, CheckCircle, LogOut } from 'lucide-vue-next'
import CandidateItem from './CandidateItem.vue'
// 修改为动态导入，避免阻塞主 chunk 进行加载
// import StudentRosterDialog from './StudentRosterDialog.vue'
// import TagSettingsDialog from './TagSettingsDialog.vue'
import { useTagData } from '@/composables/useTagData'
import { useStudentData } from '@/composables/useStudentData'
import { useSeatChart } from '@/composables/useSeatChart'
import { useLogger } from '@/composables/useLogger'
import { useEditMode } from '@/composables/useEditMode'
import { useWorkspace } from '@/composables/useWorkspace'
import { useAuth } from '@/composables/useAuth'
import { useExcelData } from '@/composables/useExcelData'
import { useExportSettings } from '@/composables/useExportSettings'
import { useImageExport } from '@/composables/useImageExport'
import { useDragState } from '@/composables/useDragState'
import { useUndo } from '@/composables/useUndo'

const CloudWorkspaceDialog = defineAsyncComponent(() => import('../workspace/CloudWorkspaceDialog.vue'))
const ExportDialog = defineAsyncComponent(() => import('../layout/ExportPreview.vue'))
const StudentRosterDialog = defineAsyncComponent(() => import('./StudentRosterDialog.vue'))
const TagSettingsDialog = defineAsyncComponent(() => import('./TagSettingsDialog.vue'))

const showRosterDialog = ref(false)
const showTagSettingsDialog = ref(false)
const showCloudDialog = ref(false)
const cloudDialogMode = ref('load')
const showExportDialog = ref(false)
const lastExportUrl = ref('')
const isExporting = ref(false)
let lastExportObjectUrl = ''

const { tags, addTag, clearAllTags } = useTagData()
const { students, updateStudent, deleteStudent, clearAllStudents, addStudent } = useStudentData()
const { findSeatByStudent, getEmptySeats, assignStudent, clearSeat } = useSeatChart()
const { success, warning, error } = useLogger()
const { currentMode, setMode, EditMode, clearFirstSelectedSeat } = useEditMode()
const { loadWorkspace, applyWorkspaceData, saveLastWorkspace } = useWorkspace()
const { isLoggedIn, isLoginDialogVisible } = useAuth()
const { importFromExcel, downloadTemplate } = useExcelData()
const { exportSettings } = useExportSettings()
const { exportToImage } = useImageExport()
const { isTouchDraggingFromSeat } = useDragState()
const { recordClear } = useUndo()

const excelInput = ref(null)
const workspaceInput = ref(null)

const modeLabel = computed(() => {
  switch (currentMode.value) {
    case EditMode.NORMAL:
      return '正常分配'
    case EditMode.SWAP:
      return '交换座位'
    case EditMode.CLEAR:
      return '清空座位'
    case EditMode.EMPTY_EDIT:
      return '空置座位'
    case EditMode.ZONE_EDIT:
      return '选区编辑'
    default:
      return '正常分配'
  }
})

const exitCurrentMode = () => {
  setMode(EditMode.NORMAL)
  clearFirstSelectedSeat()
}

const handleImportExcel = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const result = await importFromExcel(file)

    if (result.warning) {
      warning(result.warning + '，请减少数据量后重试')
      event.target.value = ''
      return
    }

    clearAllStudents()
    clearAllTags()
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788']
    const tagNameToId = {}

    result.tagNames.forEach((tagName, index) => {
      const color = colors[index % colors.length]
      const newTagId = addTag({ name: tagName, color })
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
        tags: studentTags
      })
    })

    success(`成功导入 ${result.students.length} 个学生，${result.tagNames.length} 个标签`)
    event.target.value = ''
  } catch (err) {
    error(`导入失败: ${err.message}`)
    event.target.value = ''
  }
}

const handleLoadWorkspace = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const workspace = await loadWorkspace(file)

    if (!workspace || !workspace.students || !workspace.tags) {
      error('工作区文件内容不完整或格式不正确')
      event.target.value = ''
      return
    }

    try {
      const isSuccess = await applyWorkspaceData(workspace)
      if (isSuccess) {
        success('工作区加载并恢复成功！')
        saveLastWorkspace({ type: 'local', name: file.name })
      }
    } catch (err) {
      error('恢复工作区时发生错误: ' + (err.message || err))
    }
  } catch (err) {
    error(`加载失败: ${err.message}`)
  } finally {
    event.target.value = ''
  }
}

const handleCloudLoad = () => {
  if (!isLoggedIn.value) {
    isLoginDialogVisible.value = true
    return
  }
  cloudDialogMode.value = 'load'
  showCloudDialog.value = true
}

const handleCloudSuccess = () => {
  success('云端工作区加载成功')
}

const onExported = (payload) => {
  if (!(payload instanceof Blob)) {
    if (lastExportObjectUrl) {
      URL.revokeObjectURL(lastExportObjectUrl)
      lastExportObjectUrl = ''
    }
    lastExportUrl.value = ''
    return
  }
  if (lastExportObjectUrl) {
    URL.revokeObjectURL(lastExportObjectUrl)
  }
  lastExportObjectUrl = URL.createObjectURL(payload)
  lastExportUrl.value = lastExportObjectUrl
}

onBeforeUnmount(() => {
  if (lastExportObjectUrl) {
    URL.revokeObjectURL(lastExportObjectUrl)
    lastExportObjectUrl = ''
  }
})

const isDragOver = ref(false)
const isTouchDropOver = ref(false)  // 触摸移出区域 hover 状态
const studentItemsRef = ref(null)   // .student-items 元素引用

// 未入座学生计算属性
const unassignedStudents = computed(() => {
  return students.value.filter(student => !findSeatByStudent(student.id))
})

// ==================== 触摸移出处理 ====================
// 监听全局触摸拖拽事件，判断手指是否在候选区上方
const handleGlobalTouchMove = (e) => {
  if (!isTouchDraggingFromSeat.value || !studentItemsRef.value) return
  const touch = e.touches[0]
  const rect = studentItemsRef.value.getBoundingClientRect()
  isTouchDropOver.value = (
    touch.clientX >= rect.left && touch.clientX <= rect.right &&
    touch.clientY >= rect.top && touch.clientY <= rect.bottom
  )
}

const handleGlobalTouchEnd = (e) => {
  if (!isTouchDropOver.value) {
    isTouchDropOver.value = false
    return
  }
  isTouchDropOver.value = false
  // 手指在候选区内抬起：通过 touch-seat-to-list 自定义事件处理，参见 SeatItem.vue handleTouchEnd
  // 此处不需要额外处理，SeatItem 已通过 student-items.classList.contains 自动搞定
}

onMounted(() => {
  document.addEventListener('touchmove', handleGlobalTouchMove, { passive: true })
  document.addEventListener('touchend', handleGlobalTouchEnd)
})

onUnmounted(() => {
  document.removeEventListener('touchmove', handleGlobalTouchMove)
  document.removeEventListener('touchend', handleGlobalTouchEnd)
})

// 随机排位功能
const handleRandomAssign = () => {
  if (unassignedStudents.value.length === 0) {
    warning('没有需要分配的学生候选')
    return
  }

  const emptySeats = getEmptySeats()
  if (emptySeats.length === 0) {
    warning('没有空余座位可用')
    return
  }

  // 待分配学生列表拷贝
  const candidates = [...unassignedStudents.value]
  
  // 座位列表打乱
  const shuffledSeats = [...emptySeats]
  for (let i = shuffledSeats.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledSeats[i], shuffledSeats[j]] = [shuffledSeats[j], shuffledSeats[i]]
  }

  // 开始分配，直到候选人分完或座位填满
  let assignedCount = 0
  for (let i = 0; i < candidates.length && i < shuffledSeats.length; i++) {
    assignStudent(shuffledSeats[i].id, candidates[i].id)
    assignedCount++
  }

  success(`已随机入座 ${assignedCount} 名学生！`)
}

const handleDragOver = (e) => {
  e.dataTransfer.dropEffect = 'move'
  isDragOver.value = true
}

const handleDragLeave = () => {
  isDragOver.value = false
}

const handleDrop = (e) => {
  isDragOver.value = false
  const raw = e.dataTransfer.getData('application/json')
  if (!raw) return

  try {
    const data = JSON.parse(raw)
    if (data.type === 'seat' && data.studentId != null) {
      clearSeat(data.seatId)
      success('已将学生移回候选列表')
    }
  } catch {
    // ignore
  }
}
</script>

<style scoped>
.student-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f5f5;
}

.student-list-container.all-assigned {
  height: auto;
}

.student-list-header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e8eef2;
  gap: 4px;
  min-height: 48px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.header-divider {
  width: 1px;
  height: 24px;
  background: #e0e0e0;
  flex-shrink: 0;
}

.status-block {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-block.empty-state .status-indicator {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: #bbb;
}

.status-indicator {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  background: #23587b;
  transition: background 0.2s ease;
}

.status-indicator.mode-swap { background: #f59e0b; }
.status-indicator.mode-clear { background: #ef4444; }
.status-indicator.mode-empty_edit { background: #8b5cf6; }
.status-indicator.mode-zone_edit { background: #06b6d4; }

.status-text {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}

.candidate-count {
  background: linear-gradient(135deg, #23587b, #2d6a94);
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
  line-height: 1.6;
  min-width: 18px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(35, 88, 123, 0.25);
}

.header-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
}

.quick-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-group {
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 6px 10px;
  background: #f3f4f6;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: default;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.btn-group-label {
  color: #6b7280;
  border-right: 1px solid #e5e7eb;
  padding-right: 8px;
  margin-right: 6px;
}

.btn-group-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 7px;
  background: transparent;
  color: #4b5563;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  transition: all 0.15s ease;
  white-space: nowrap;
  border-radius: 4px;
}

.btn-group-item:hover {
  background: #e5e7eb;
  color: #23587b;
}

.btn-group-item:active {
  background: #d1d5db;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: #f3f4f6;
  color: #4b5563;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
  line-height: 1;
}

.icon-btn:hover {
  background: #e5e7eb;
  color: #23587b;
  border-color: #d1d5db;
}

.icon-btn:active {
  transform: scale(0.97);
}

.icon-btn.btn-primary {
  background: linear-gradient(135deg, #23587b, #2d6a94);
  color: #ffffff;
  border-color: transparent;
  box-shadow: 0 1px 3px rgba(35, 88, 123, 0.2);
}

.icon-btn.btn-primary:hover {
  background: linear-gradient(135deg, #1e4a66, #265c82);
  box-shadow: 0 2px 6px rgba(35, 88, 123, 0.3);
  color: #ffffff;
  border-color: transparent;
  transform: translateY(-1px);
}

.icon-btn.btn-primary:active {
  transform: translateY(0) scale(0.97);
}

.icon-btn.btn-primary-light {
  background: rgba(35, 88, 123, 0.08);
  color: #23587b;
  border: 1px solid rgba(35, 88, 123, 0.15);
}

.icon-btn.btn-primary-light:hover {
  background: rgba(35, 88, 123, 0.15);
  border-color: rgba(35, 88, 123, 0.25);
  color: #1a4460;
}

.icon-btn.btn-ghost {
  background: transparent;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.icon-btn.btn-ghost:hover {
  background: #f9fafb;
  color: #374151;
  border-color: #d1d5db;
}

.student-items {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  transition: background 0.2s ease, border-color 0.2s ease, min-height 0.25s ease, padding 0.25s ease;
  border: 2px solid transparent;
  border-radius: 8px;
  min-height: 60px;
  display: grid;
  position: relative;  /* 覆盖层定位参照 */
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  grid-auto-rows: min-content;
  gap: 12px;
  align-content: start;
}

.student-items.drag-over {
  background: rgba(35, 88, 123, 0.06);
  border-color: var(--color-primary);
}

/* 手机端触摸拖拽「移出」覆盖层 */
.touch-drop-out-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(35, 88, 123, 0.07);
  border: 2px dashed rgba(35, 88, 123, 0.4);
  border-radius: 8px;
  color: #23587b;
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;  /* 不拦截触摸事件 */
  z-index: 10;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  animation: touch-overlay-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.touch-drop-out-overlay.touch-drop-over {
  background: rgba(35, 88, 123, 0.16);
  border-color: #23587b;
  border-style: solid;
  color: #1a4460;
}

@keyframes touch-overlay-in {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}

.student-items.is-empty {
  min-height: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  gap: 0;
  overflow: hidden;
  display: none;
}

/* 触摸拖拽激活时，即使全部入座也要显示移出目标 */
.student-items.is-empty.touch-dragging {
  display: grid;
  min-height: 80px;
  padding: 8px;
  position: relative;
}

.primary-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #23587b 0%, #2d6a94 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.primary-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.12);
}

.primary-btn:active {
  transform: translateY(1px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.student-items::-webkit-scrollbar {
  width: 8px;
}

.student-items::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.student-items::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 4px;
  transition: background 0.3s;
}

.student-items::-webkit-scrollbar-thumb:hover {
  background: #888;
}

@media (max-width: 1366px) and (min-width: 1025px) {
  .student-list-header {
    padding: 8px 12px;
    gap: 4px;
  }

  .header-divider {
    height: 20px;
  }

  .icon-btn {
    padding: 4px 8px;
    font-size: 11px;
  }

  .btn-group {
    padding: 4px 8px;
    font-size: 11px;
  }

  .status-text {
    font-size: 12px;
  }

  .student-items {
    padding: 8px;
  }
}

/* 小高度屏幕优化 */
@media (max-height: 820px) and (min-width: 1025px) {
  .student-list-header {
    padding: 7px 10px;
    gap: 3px;
  }

  .header-divider {
    height: 18px;
  }

  .icon-btn {
    padding: 4px 7px;
    font-size: 11px;
  }

  .btn-group {
    padding: 4px 7px;
    font-size: 11px;
  }

  .status-text {
    font-size: 11px;
  }

  .student-items {
    padding: 6px;
  }
}

@media (max-width: 768px) {
  .student-list-container {
    border-top: none;
  }

  .student-list-header {
    padding: 6px 10px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    flex-wrap: nowrap;
  }

  .student-list-header::-webkit-scrollbar {
    display: none;
  }

  .header-divider {
    display: none;
  }

  .header-left {
    flex-shrink: 1;
    min-width: 0;
    gap: 8px;
  }

  .header-actions {
    margin-left: auto;
  }

  .header-right {
    flex-shrink: 0;
    gap: 4px;
  }

  .icon-btn {
    padding: 5px 7px;
    font-size: 11px;
  }

  .btn-group {
    padding: 5px 7px;
    font-size: 11px;
  }

  .status-text {
    font-size: 12px;
  }

  .status-indicator,
  .status-block.empty-state .status-indicator {
    height: 12px;
  }

  .student-items {
    padding: 6px 8px;
    -webkit-overflow-scrolling: touch;
  }

  /* 移动端空状态：显示占位符 */
  .student-items.is-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  /* 空状态占位样式 - 水平布局 */
  .empty-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px 16px;
    text-align: left;
    gap: 12px;
  }

  .empty-content-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .empty-icon {
    width: 36px;
    height: 36px;
    min-width: 36px;
    opacity: 0.85;
    color: #6b7280;
  }

  .empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .empty-icon.success {
    width: 32px;
    height: 32px;
    min-width: 32px;
    color: #52B788;
  }

  .empty-text-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .empty-title {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .empty-hint {
    font-size: 12px;
    color: #9ca3af;
    margin: 0;
    line-height: 1.3;
  }

  /* 空状态操作按钮 */
  .empty-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 280px;
  }

  .empty-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 44px;
    border: none;
    width: 100%;
  }

  .empty-action-btn.primary {
    background: linear-gradient(135deg, #23587b, #2d6a94);
    color: white;
    box-shadow: 0 2px 8px rgba(35, 88, 123, 0.25);
  }

  .empty-action-btn.primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(35, 88, 123, 0.3);
  }

  .empty-action-btn.primary:active {
    transform: translateY(0);
  }

  .empty-action-btn.outline {
    background: #f8f9fa;
    color: #4b5563;
    border: 1px solid #e5e7eb;
  }

  .empty-action-btn.outline:hover {
    background: #f0f4f7;
    border-color: #23587b;
    color: #23587b;
  }

  .empty-action-row {
    display: flex;
    gap: 8px;
  }

  .empty-action-row .empty-action-btn {
    flex: 1;
    padding: 10px 12px;
    font-size: 13px;
  }
}
</style>
