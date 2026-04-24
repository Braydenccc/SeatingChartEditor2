<template>
  <div class="student-list-container" :class="{ 'all-assigned': unassignedStudents.length === 0, 'is-collapsed': isCollapsed }">
    <!-- 学生列表 / 空状态占位 -->
    <div ref="studentItemsRef" class="student-items" @dragover.prevent="handleDragOver" @drop.prevent="handleDrop" @dragleave="handleDragLeave"
      :class="{ 'drag-over': isDragOver, 'is-empty': unassignedStudents.length === 0, 'has-placeholder': showEmptyPlaceholder, 'touch-dragging': isTouchDraggingFromSeat }">

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

        <!-- 操作按钮组 - 仅在高度足够时显示 -->
        <div v-if="!isHeightConstrained" class="empty-actions">
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
            <button class="empty-action-btn outline" @click="openCloudLoad">
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

    <StudentRosterDialog v-if="showRosterDialog" v-model:visible="showRosterDialog" />
    <TagSettingsDialog v-if="showTagSettingsDialog" v-model:visible="showTagSettingsDialog" />

    <!-- 导出设置弹窗 -->
    <ExportDialog v-if="showExportDialog" :visible="showExportDialog" @close="showExportDialog = false" @exported="onExported" />
  </div>
</template>

<script setup>
import { computed, ref, defineAsyncComponent, onBeforeUnmount, onMounted, onUnmounted } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { Users, FileInput, FolderOpen, CloudDownload, CheckCircle, LogOut } from 'lucide-vue-next'
import CandidateItem from './CandidateItem.vue'
// 修改为动态导入，避免阻塞主 chunk 进行加载
// import StudentRosterDialog from './StudentRosterDialog.vue'
// import TagSettingsDialog from './TagSettingsDialog.vue'
import { useTagData } from '@/composables/useTagData'
import { useStudentData } from '@/composables/useStudentData'
import { useSeatChart } from '@/composables/useSeatChart'
import { useLogger } from '@/composables/useLogger'
import { useWorkspace } from '@/composables/useWorkspace'
import { useAuth } from '@/composables/useAuth'
import { useExcelData } from '@/composables/useExcelData'
import { useDragState } from '@/composables/useDragState'
import { useUndo } from '@/composables/useUndo'
import { useCloudWorkspaceDialog } from '@/composables/useCloudWorkspaceDialog'
import { useResizablePanel } from '@/composables/useResizablePanel'

const StudentRosterDialog = defineAsyncComponent(() => import('./StudentRosterDialog.vue'))
const TagSettingsDialog = defineAsyncComponent(() => import('./TagSettingsDialog.vue'))

const showRosterDialog = ref(false)
const showTagSettingsDialog = ref(false)

const { tags, addTag, clearAllTags } = useTagData()
const { students, updateStudent, deleteStudent, clearAllStudents, addStudent } = useStudentData()
const { findSeatByStudent, getEmptySeats, assignStudent, clearSeat, getStudentAtSeat } = useSeatChart()
const { success, warning, error } = useLogger()
const { loadWorkspace, applyWorkspaceData, saveLastWorkspace } = useWorkspace()
const { isLoggedIn, isLoginDialogVisible } = useAuth()
const { importFromExcel, downloadTemplate } = useExcelData()
const { isTouchDraggingFromSeat } = useDragState()
const { recordClear } = useUndo()
const { width: windowWidth } = useWindowSize()
const { openCloudLoad } = useCloudWorkspaceDialog()
const { userHeight, getEffectiveHeight } = useResizablePanel()

const isMobile = computed(() => windowWidth.value < 1024)

// 折叠状态检测
const isCollapsed = computed(() => userHeight.value === 0)

// 检测高度是否受限（用于简化空状态占位符）
const isHeightConstrained = computed(() => {
  const effectiveHeight = getEffectiveHeight(unassignedStudents.value.length)
  return effectiveHeight < 200 // 高度小于 200px 时隐藏操作按钮
})

const excelInput = ref(null)
const workspaceInput = ref(null)

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

const isDragOver = ref(false)
const isTouchDropOver = ref(false)  // 触摸移出区域 hover 状态
const studentItemsRef = ref(null)   // .student-items 元素引用

// 未入座学生计算属性
const unassignedStudents = computed(() => {
  return students.value.filter(student => !findSeatByStudent(student.id))
})

const showEmptyPlaceholder = computed(() => {
  return students.value.length === 0 || (unassignedStudents.value.length === 0 && students.value.length > 0)
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
      // 检查是否是选区批量移出
      if (data.selectedSeatIds && data.selectedSeatIds.length > 1) {
        // 批量移出选中的座位
        data.selectedSeatIds.forEach(seatId => {
          const studentId = getStudentAtSeat(seatId)
          if (studentId !== null) {
            recordClear(seatId, studentId)
            clearSeat(seatId)
          }
        })
        success(`已将 ${data.selectedSeatIds.length} 名学生移回候选列表`)
      } else {
        // 单个座位移出
        recordClear(data.seatId, data.studentId)
        clearSeat(data.seatId)
        success('已将学生移回候选列表')
      }
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
  min-height: 0;
  height: 100%;
  background: #f5f5f5;
}

/* 折叠时隐藏整个容器 */
.student-list-container.is-collapsed {
  display: none;
}

.student-list-container.all-assigned {
  height: auto;
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
  grid-template-columns: repeat(auto-fill, 120px);
  grid-auto-rows: 80px;
  gap: 12px;
  align-content: start;
  justify-content: start;
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
  background: rgba(35, 88, 123, 0.18);
  border: 2px dashed rgba(35, 88, 123, 0.6);
  border-radius: 8px;
  color: #23587b;
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
  z-index: 10;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  animation: touch-overlay-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.touch-drop-out-overlay.touch-drop-over {
  background: rgba(35, 88, 123, 0.28);
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

/* 有空状态占位时仍需显示 */
.student-items.is-empty.has-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
  text-align: left;
  gap: 16px;
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
  background: #23587b;
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

/* 触摸拖拽激活时，即使全部入座也要显示移出目标 */
.student-items.is-empty.touch-dragging {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: stretch;
  min-height: 120px;
  padding: 15px;
  position: relative;
  border: 2px solid transparent;
  border-radius: 8px;
}

.primary-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #23587b;
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
  .student-items {
    padding: 8px;
    grid-template-columns: repeat(auto-fill, 102px);
    grid-auto-rows: 68px;
  }
}

/* 小高度屏幕优化 */
@media (max-height: 820px) and (min-width: 1025px) {
  .student-items {
    padding: 6px;
    grid-template-columns: repeat(auto-fill, 96px);
    grid-auto-rows: 64px;
  }
}

@media (max-width: 768px) {
  .student-list-container {
    border-top: none;
  }

  .student-items {
    padding: 6px 8px;
    -webkit-overflow-scrolling: touch;
    grid-template-columns: repeat(auto-fill, 105px);
    grid-auto-rows: 70px;
  }

  /* 移动端空状态：显示占位符 */
  .student-items.is-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .empty-placeholder {
    padding: 16px 16px;
    gap: 12px;
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

@media (max-width: 480px) {
  .student-items {
    grid-template-columns: repeat(auto-fill, 82.5px);
    grid-auto-rows: 55px;
  }
}
</style>
