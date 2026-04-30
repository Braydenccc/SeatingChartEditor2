<template>
  <div class="editor-panel">
    <div class="editor">
      <SeatChart />
    </div>

    <!-- 学生列表工具栏 - 桌面端固定在候选栏外部，移动端在候选栏内部 -->
    <StudentListHeader
      v-if="!isMobile"
      :unassigned-count="unassignedCount"
      @open-tag-settings="showTagSettingsDialog = true"
      @open-roster="showRosterDialog = true"
    />

    <!-- 桌面端：添加可拖动分隔条 -->
    <ResizeDivider v-if="!isMobile" :unassigned-count="unassignedCount" />

    <div class="student-list-area" :style="candidatePanelStyle">
      <!-- 移动端：工具栏在候选栏内部 -->
      <StudentListHeader
        v-if="isMobile"
        :unassigned-count="unassignedCount"
        @open-tag-settings="showTagSettingsDialog = true"
        @open-roster="showRosterDialog = true"
      />

      <StudentList
        :show-tag-settings="showTagSettingsDialog"
        :show-roster="showRosterDialog"
        @update:show-tag-settings="showTagSettingsDialog = $event"
        @update:show-roster="showRosterDialog = $event"
      />
    </div>

    <!-- 桌面端快捷键提示栏 - 从 StudentList 移出，固定在底部 -->
    <div v-if="!isMobile" class="shortcuts-hint-bar">
      <div class="hint-group">
        <span class="hint-label">快捷键:</span>
        <span class="hint-item"><kbd>Ctrl+Z</kbd> 撤销</span>
        <span class="hint-item"><kbd>Ctrl+Y</kbd> 重做</span>
        <span class="hint-item"><kbd>Esc</kbd> 清除选择</span>
      </div>
      <div class="hint-divider"></div>
      <div class="hint-group">
        <span class="hint-label">鼠标:</span>
        <span class="hint-item">左键 分配/操作座位</span>
        <span class="hint-item">右键拖拽 多选座位</span>
        <span class="hint-item">滚轮 平移</span>
        <span class="hint-item"><kbd>Ctrl</kbd>+滚轮 缩放</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useWindowSize } from '@vueuse/core'
import StudentList from '../student/StudentList.vue'
import StudentListHeader from '../student/StudentListHeader.vue'
import SeatChart from '../seat/SeatChart.vue'
import ResizeDivider from '../ui/ResizeDivider.vue'
import { useResizablePanel } from '@/composables/useResizablePanel'
import { useStudentData } from '@/composables/useStudentData'
import { useSeatChart } from '@/composables/useSeatChart'

const { students } = useStudentData()
const { findSeatByStudent } = useSeatChart()
const { getEffectiveHeight } = useResizablePanel()
const { width: windowWidth } = useWindowSize()

const isMobile = computed(() => windowWidth.value <= 1024)
const showTagSettingsDialog = ref(false)
const showRosterDialog = ref(false)

const unassignedCount = computed(() => {
  return students.value.reduce((count, s) =>
    !findSeatByStudent(s.id) ? count + 1 : count, 0)
})

const candidatePanelStyle = computed(() => {
  if (isMobile.value) {
    return {}
  }
  const height = getEffectiveHeight(unassignedCount.value)
  return {
    height: `${height}px`,
    minHeight: `${height}px`,
    maxHeight: `${height}px`,
    flex: 'none'
  }
})
</script>

<style scoped>
.editor-panel {
  width: 80%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-bg-secondary);
}

.editor {
  flex: 1;
  min-height: 0;
  background: var(--color-surface);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.student-list-area {
  flex: 0 0 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: height 0.1s ease;
}

/* 桌面端快捷键提示栏 - 固定在底部 */
.shortcuts-hint-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 16px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  font-size: 11px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  min-height: 28px;
}

/* 移动端隐藏快捷键提示栏 */
@media (max-width: 768px) {
  .shortcuts-hint-bar {
    display: none;
  }
}

.hint-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hint-label {
  font-weight: 600;
  color: var(--color-text-primary);
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.hint-item kbd {
  display: inline-block;
  padding: 1px 5px;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 500;
  line-height: 1.4;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-shadow: inset 0 -1px 0 var(--color-border);
}

.hint-divider {
  width: 1px;
  height: 14px;
  background: var(--color-border-light);
}

/* 响应式设计 - 中等屏幕 */
@media (max-width: 1400px) {
  .editor-panel {
    width: 75%;
  }
}

/* 低分辨率桌面优化（仅基于宽度） */
@media (max-width: 1366px) and (min-width: 1025px) {
  .editor {
    min-height: 55%;
  }

  .student-list-area {
    max-height: 45%;
  }
}

/* 小高度屏幕优化 */
@media (max-height: 820px) and (min-width: 1025px) {
  .editor {
    min-height: 50%;
  }

  .student-list-area {
    max-height: 50%;
  }
}

/* 响应式设计 - 平板和移动设备（SidebarPanel 固定底部） */
@media (max-width: 1024px) {
  .editor-panel {
    width: 100%;
    height: 100%;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* 为底部固定的 Tab 栏留出空间 */
    padding-bottom: 56px;
    box-sizing: border-box;
  }

  .editor {
    flex: 1 1 auto;
    min-height: 0;
    background: var(--color-surface);
    overflow: hidden;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
  }

  .student-list-area {
    flex: 0 0 35% !important;
    min-height: 0;
    max-height: 40%;
    overflow: hidden;
    height: auto !important;
  }
}

/* 响应式设计 - 移动设备
   布局从上到下：座位图 → 学生列表 → 底部Tab栏(56px)
   可用高度 = 100vh - 48px(header) - 56px(tab bar) = 100vh - 104px */
@media (max-width: 768px) {
  .editor-panel {
    width: 100%;
    height: 100%;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    /* 为底部固定的 Tab 栏留出空间 */
    padding-bottom: 56px;
    box-sizing: border-box;
  }

  .editor {
    flex: 1 1 auto;
    min-height: 0;
    background: var(--color-surface);
    overflow: hidden;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
  }

  .student-list-area {
    flex: 0 0 35% !important;
    min-height: 0;
    max-height: 40%;
    overflow: hidden;
    height: auto !important;
  }
}
</style>
