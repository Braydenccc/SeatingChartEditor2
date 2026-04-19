<template>
  <div class="editor-panel">
    <div class="editor">
      <SeatChart />
    </div>
    <div class="student-list-area">
      <StudentList />
    </div>
  </div>
</template>

<script setup>
import StudentList from '../student/StudentList.vue'
import SeatChart from '../seat/SeatChart.vue'
</script>

<style scoped>
.editor-panel {
  width: 80%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.editor {
  flex: 1;
  min-height: 60%;
  background: #ffffff;
  border-bottom: 2px solid #e0e0e0;
  overflow: hidden;
}

.student-list-area {
  flex: 0 1 auto;
  max-height: 40%;
  min-height: 0;
  overflow: hidden;
  transition: min-height 0.25s ease;
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
    height: calc(100% - 56px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .editor {
    flex: 1;
    min-height: 0;
    background: #ffffff;
    overflow: hidden;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
  }

  .student-list-area {
    flex: 0 0 35%;
    min-height: 0;
    overflow: hidden;
  }
}

/* 响应式设计 - 移动设备
   布局从上到下：座位图 → 学生列表 → 底部Tab栏(56px)
   可用高度 = 100vh - 48px(header) - 56px(tab bar) = 100vh - 104px */
@media (max-width: 768px) {
  .editor-panel {
    width: 100%;
    height: calc(100% - 56px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .editor {
    flex: 1;
    min-height: 0;
    background: #ffffff;
    overflow: hidden;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
  }

  .student-list-area {
    flex: 0 0 35%;
    min-height: 0;
    overflow: hidden;
  }
}
</style>
