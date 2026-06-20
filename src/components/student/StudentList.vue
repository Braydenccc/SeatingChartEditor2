<template>
  <div
    class="student-list-container"
    :class="{
      'all-assigned': visibleStudents.length === 0,
      'display-compact': displayMode === 'compact'
    }"
  >
    <!-- 学生列表 / 空状态占位 -->
    <div ref="studentItemsRef" class="student-items" @dragover.prevent="handleDragOver" @drop.prevent="handleDrop" @dragleave="handleDragLeave"
      :class="{ 'drag-over': isDragOver, 'is-empty': visibleStudents.length === 0, 'has-placeholder': showEmptyPlaceholder, 'touch-dragging': isTouchDraggingFromSeat }">

      <!-- 有未分配学生时正常显示 -->
      <TransitionGroup name="list" tag="div" class="candidates-grid">
        <CandidateItem
          v-for="student in visibleStudents"
          :key="student.id"
          :student="student"
          :display-mode="displayMode"
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
            <p class="empty-hint">导入文件或打开工作区以开始使用</p>
          </div>
        </div>

        <!-- 操作按钮组 -->
        <div class="empty-actions">
          <button class="empty-action-btn outline" type="button" @click="goFilesView">
            <FolderOpen :size="16" stroke-width="2" />
            <span>到文件页导入</span>
          </button>
          <div class="empty-action-row">
            <button class="empty-action-btn outline" @click="handleLoadWorkspace">
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

      <!-- 空状态占位：全部已入座 -->
      <div v-else-if="isAllAssignedEmpty" v-show="!isTouchDraggingFromSeat" class="empty-placeholder assigned-done">
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

      <!-- 空状态占位：未找到学生 -->
      <div v-else-if="visibleStudents.length === 0 && students.length > 0" v-show="!isTouchDraggingFromSeat" class="empty-placeholder no-results">
        <div class="empty-content-row">
          <div class="empty-icon search-empty">
            <SearchX :size="32" stroke-width="2" />
          </div>
          <div class="empty-text-group">
            <p class="empty-title">未找到学生</p>
            <p class="empty-hint">请调整搜索关键词或筛选条件</p>
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

    <!-- 学生编辑弹窗 -->
    <StudentEditDialog v-if="showStudentEditDialog" v-model:visible="showStudentEditDialog" :studentId="editingStudentId" />
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { computed, ref, defineAsyncComponent, onMounted, onUnmounted, watch } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { Users, FolderOpen, CloudDownload, CheckCircle, SearchX, LogOut } from 'lucide-vue-next'
import CandidateItem from './CandidateItem.vue'
import { useStudentData } from '@/composables/useStudentData'
import { useSeatChart } from '@/composables/useSeatChart'
import { useLogger } from '@/composables/useLogger'
import { useWorkspace } from '@/composables/useWorkspace'
import { useDragState } from '@/composables/useDragState'
import { useUndo } from '@/composables/useUndo'
import { useCloudWorkspaceDialog } from '@/composables/useCloudWorkspaceDialog'

const StudentEditDialog = defineAsyncComponent(() => import('./StudentEditDialog.vue'))
const props = defineProps({
  displayMode: {
    type: String,
    default: 'grid'
  },
  filterMode: {
    type: String,
    default: 'unassigned'
  },
  searchText: {
    type: String,
    default: ''
  },
  activeTagIds: {
    type: Array,
    default: () => []
  }
})
const showStudentEditDialog = ref(false)
const editingStudentId = ref(null)

const { students, selectedStudentId, selectStudent } = useStudentData()
const { findSeatByStudent, clearSeat, getStudentAtSeat } = useSeatChart()
const { success, error } = useLogger()
const { loadWorkspace, applyWorkspaceData, saveLastWorkspace } = useWorkspace()
const { isTouchDraggingFromSeat, endDragFromSeat } = useDragState()
const { recordBatch, createSnapshot } = useUndo()
const { width: windowWidth } = useWindowSize()
const { openCloudLoad } = useCloudWorkspaceDialog()
const router = useRouter()

const isMobile = computed(() => windowWidth.value <= 1024)

const goFilesView = () => {
  router.push('/files')
}

// 处理双击编辑学生
const handleEditStudent = (studentId) => {
  editingStudentId.value = studentId
  showStudentEditDialog.value = true
}

const handleLoadWorkspace = async (event = null) => {
  const file = event?.target?.files?.[0] || null
  try {
    const workspace = await loadWorkspace(file)
    if (!workspace) return

    if (!workspace || !workspace.students || !workspace.tags) {
      error('工作区文件内容不完整或格式不正确')
      if (event?.target) event.target.value = ''
      return
    }

    try {
      const isSuccess = await applyWorkspaceData(workspace)
      if (isSuccess) {
        success('工作区加载并恢复成功！')
        saveLastWorkspace({ type: 'local', name: file?.name || '本地工作区' })
      }
    } catch (err) {
      error('恢复工作区时发生错误: ' + (err.message || err))
    }
  } catch (err) {
    error(`加载失败: ${err.message}`)
  } finally {
    if (event?.target) event.target.value = ''
  }
}

const isDragOver = ref(false)
const isTouchDropOver = ref(false)  // 触摸移出区域 hover 状态
const studentItemsRef = ref(null)   // .student-items 元素引用

// 未入座学生计算属性
const unassignedStudents = computed(() => {
  return students.value.filter(student => !findSeatByStudent(student.id))
})

const visibleStudents = computed(() => {
  const search = props.searchText.trim().toLowerCase()
  const activeTags = props.activeTagIds || []
  return students.value.filter(student => {
    const seat = findSeatByStudent(student.id)
    if (props.filterMode === 'unassigned' && seat) return false
    if (props.filterMode === 'assigned' && !seat) return false
    if (activeTags.length > 0 && !activeTags.every(tagId => (student.tags || []).includes(tagId))) return false
    if (!search) return true
    const name = String(student.name || '').toLowerCase()
    const number = String(student.studentNumber || '').toLowerCase()
    return name.includes(search) || number.includes(search)
  })
})

const isAllAssignedEmpty = computed(() => {
  const hasSearch = props.searchText.trim().length > 0
  const hasTagFilter = (props.activeTagIds || []).length > 0
  return props.filterMode === 'unassigned' &&
    !hasSearch &&
    !hasTagFilter &&
    students.value.length > 0 &&
    unassignedStudents.value.length === 0
})

const showEmptyPlaceholder = computed(() => {
  return students.value.length === 0 || (visibleStudents.value.length === 0 && students.value.length > 0)
})

const hasFocusedFilter = computed(() => (
  props.searchText.trim().length > 0 ||
  (props.activeTagIds || []).length > 0 ||
  props.filterMode !== 'unassigned'
))

watch(visibleStudents, (items) => {
  if (!isMobile.value || props.displayMode !== 'compact') return
  if (!hasFocusedFilter.value || items.length !== 1) return
  if (selectedStudentId.value === items[0].id) return
  selectStudent(items[0].id)
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
  const raw = getDragData(e)
  if (!raw) return

  try {
    const data = JSON.parse(raw)
    if (data.type === 'seat' && data.studentId != null) {
      if (data.selectedSeatIds && data.selectedSeatIds.length > 1) {
        const beforeSnapshot = createSnapshot()
        data.selectedSeatIds.forEach(seatId => {
          const studentId = getStudentAtSeat(seatId)
          if (studentId !== null) {
            clearSeat(seatId, false)
          }
        })
        const afterSnapshot = createSnapshot()
        recordBatch(beforeSnapshot, afterSnapshot)
        success(`已将 ${data.selectedSeatIds.length} 名学生移回候选列表`)
      } else {
        clearSeat(data.seatId)
        success('已将学生移回候选列表')
      }
    }
  } catch {
    // ignore
  } finally {
    endDragFromSeat()
  }
}

const getDragData = (e) => {
  return e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain')
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
  grid-template-columns: repeat(auto-fill, var(--seat-card-width));
  grid-auto-rows: var(--seat-card-height);
  gap: 12px;
  align-content: start;
  justify-content: start;
}

/* 候选区网格容器 */
.candidates-grid {
  display: contents;
}

.student-list-container.display-compact .student-items {
  padding: 10px;
  grid-template-columns: 1fr;
  grid-auto-rows: var(--candidate-card-height);
  gap: 8px;
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
  color: var(--color-text-muted);
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

.empty-icon.search-empty {
  width: 32px;
  height: 32px;
  min-width: 32px;
  color: var(--color-text-muted);
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
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.6;
}

.empty-hint {
  font-size: 12px;
  color: var(--color-text-muted);
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

.hidden-input {
  display: none;
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
    grid-template-columns: repeat(auto-fill, var(--seat-card-width));
    grid-auto-rows: var(--seat-card-height);
  }
}

/* 小高度屏幕优化 */
@media (max-height: 820px) and (min-width: 1025px) {
  .student-items {
    padding: 6px;
    grid-template-columns: repeat(auto-fill, var(--seat-card-width));
    grid-auto-rows: var(--seat-card-height);
  }
}

@media (max-width: 768px) {
  .student-list-container {
    border-top: none;
  }

  .student-items {
    padding: 6px 8px;
    -webkit-overflow-scrolling: touch;
    grid-template-columns: repeat(auto-fill, var(--seat-card-width));
    grid-auto-rows: var(--seat-card-height);
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

@media (max-width: 1024px) and (orientation: landscape) and (max-height: 540px) {
  .student-items {
    padding: 6px 8px;
    -webkit-overflow-scrolling: touch;
  }

  .student-list-container.display-compact .student-items {
    --candidate-card-height: 60px;
    padding: 6px 8px;
    grid-template-columns: 1fr;
    grid-auto-rows: var(--candidate-card-height);
    gap: 6px;
  }

  .empty-placeholder {
    padding: 12px;
    gap: 10px;
  }

  .empty-icon {
    width: 34px;
    height: 34px;
    min-width: 34px;
  }

  .empty-title {
    font-size: 13px;
  }

  .empty-hint {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .student-items {
    grid-template-columns: repeat(auto-fill, var(--seat-card-width));
    grid-auto-rows: var(--seat-card-height);
  }
}
</style>
