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
  height: 40%;
  min-height: 300px;
  overflow: hidden;
}

/* 响应式设计 - 中等屏幕 */
@media (max-width: 1400px) {
  .editor-panel {
    width: 75%;
  }
}

/* 低分辨率桌面优化 */
@media (max-width: 1366px) and (min-width: 1025px), (max-height: 820px) and (min-width: 1025px) {
  .editor {
    min-height: 55%;
  }

  .student-list-area {
    min-height: 240px;
  }
}

/* 响应式设计 - 平板 */
@media (max-width: 1024px) {
  .editor-panel {
    width: 100%;
    flex: 1;
  }

  .editor {
    flex: 3;
    min-height: 300px;
  }

  .student-list-area {
    flex: 2;
    min-height: 250px;
    height: auto;
  }
}

/* 响应式设计 - 移动设备
   可用高度 = 100vh - 48px(header) - 56px(tab bar) = 100vh - 104px
   座位图 50%，学生列表 50%，直接用 calc 算出像素值，不依赖任何链 */
@media (max-width: 768px) {
  .editor-panel {
    width: 100%;
    overflow: hidden;
  }

  .editor {
    flex: none;
    height: calc((100vh - 104px) * 0.5);
    min-height: unset;
    background: #ffffff;
    overflow: hidden;
    border-bottom: 1px solid #e0e0e0;
  }

  .student-list-area {
    flex: none;
    height: calc((100vh - 104px) * 0.5);
    min-height: unset;
    overflow: hidden;
  }
}
</style>
