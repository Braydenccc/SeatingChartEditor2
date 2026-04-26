<template>
  <div class="student-list-container" :class="{ 'all-assigned': unassignedStudents.length === 0, 'is-collapsed': isCollapsed }">
    <!-- 学生列表 / 空状态占位 -->
    <div ref="studentItemsRef" class="student-items" @dragover.prevent="handleDragOver" @drop.prevent="handleDrop" @dragleave="handleDragLeave"
      :class="{ 'drag-over': isDragOver, 'is-empty': unassignedStudents.length === 0, 'has-placeholder': showEmptyPlaceholder, 'touch-dragging': isTouchDraggingFromSeat }">

      <!-- 有未分配学生时正常显示 -->
      <TransitionGroup name="list" tag="div" class="candidates-grid">
        <CandidateItem
          v-for="student in unassignedStudents"
          :key="student.id"
          :student="student"
          @edit-student="handleEditStudent"
        />
      </TransitionGroup>

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

    <!-- 学生编辑弹窗 -->
    <StudentEditDialog v-if="showStudentEditDialog" v-model:visible="showStudentEditDialog" :studentId="editingStudentId" />
  </div>
</template>

<script setup>
import { computed, ref, defineAsyncComponent, onBeforeUnmount, onMounted, onUnmounted, watch } from 'vue'
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
const StudentEditDialog = defineAsyncComponent(() => import('./StudentEditDialog.vue'))

const props = defineProps({
  showRoster: {
    type: Boolean,
    default: false
  },
  showTagSettings: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:show-roster', 'update:show-tag-settings'])

const showRosterDialog = ref(false)
const showTagSettingsDialog = ref(false)
const showStudentEditDialog = ref(false)
const editingStudentId = ref(null)

// 监听 props 变化，同步到本地状态
watch(() => props.showRoster, (val) => {
  showRosterDialog.value = val
})

watch(() => props.showTagSettings, (val) => {
  showTagSettingsDialog.value = val
})

// 监听本地状态变化，同步回父组件
watch(showRosterDialog, (val) => {
  emit('update:show-roster', val)
})

watch(showTagSettingsDialog, (val) => {
  emit('update:show-tag-settings', val)
})

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

const isMobile = computed(() => windowWidth.value <= 1024)

// 折叠状态检测
const isCollapsed = computed(() => userHeight.value === 0)

// 检测高度是否受限（用于简化空状态占位符）
const isHeightConstrained = computed(() => {
  const effectiveHeight = getEffectiveHeight(unassignedStudents.value.length)
  return effectiveHeight < 200 // 高度小于 200px 时隐藏操作按钮
})

// 处理双击编辑学生
const handleEditStudent = (studentId) => {
  editingStudentId.value = studentId
  showStudentEditDialog.value = true
}

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
    const colors = [
      'var(--tag-color-1)', 'var(--tag-color-2)', 'var(--tag-color-3)',
      'var(--tag-color-4)', 'var(--tag-color-5)', 'var(--tag-color-6)',
      'var(--tag-color-7)', 'var(--tag-color-8)', 'var(--tag-color-9)',
      'var(--tag-color-10)'
    ]
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
  background: var(--color-bg-secondary);
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

/* 候选区网格容器 */
.candidates-grid {
  display: contents;
}

/* 列表动画 */
.list-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.list-leave-active {
  transition: all 0.2s ease;
  position: absolute;
}

.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.list-move {
  transition: transform 0.3s ease;
}

.student-items.drag-over {
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
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
  background: color-mix(in srgb, var(--color-primary) 18%, transparent);
  border: 2px dashed color-mix(in srgb, var(--color-primary) 60%, transparent);
  border-radius: 8px;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
  z-index: 10;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  animation: touch-overlay-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.touch-drop-out-overlay.touch-drop-over {
  background: color-mix(in srgb, var(--color-primary) 28%, transparent);
  border-color: var(--color-primary);
  border-style: solid;
  color: var(--color-primary-hover);
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
  padding: 40px 20px;
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
  width: 48px;
  height: 48px;
  min-width: 48px;
  opacity: 0.5;
  color: var(--color-text-muted, #9ca3af);
  animation: float 3s ease-in-out infinite;
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-icon.success {
  width: 32px;
  height: 32px;
  min-width: 32px;
  color: var(--color-success);
  animation: none;
}

.empty-text-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-muted, #6b7280);
  margin: 0;
  line-height: 1.6;
}

.empty-hint {
  font-size: 12px;
  color: var(--color-text-muted, #9ca3af);
  opacity: 0.7;
  margin: 0;
  line-height: 1.6;
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
  background: var(--color-primary);
  color: var(--color-text-inverse);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.empty-action-btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.empty-action-btn.primary:active {
  transform: translateY(0);
}

.empty-action-btn.outline {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.empty-action-btn.outline:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
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
  background: var(--color-primary);
  color: var(--color-text-inverse);
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
  background: var(--scrollbar-track);
  border-radius: 4px;
}

.student-items::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
  transition: background 0.3s;
}

.student-items::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
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
