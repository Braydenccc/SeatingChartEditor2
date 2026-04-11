<template>
  <div class="student-list-container">
    <div class="student-list">
      <div class="student-list-header">
        <h3>学生候选区</h3>
        <span class="student-count-badge">{{ students.length }} 人</span>
      </div>
      <div class="student-items">
        <StudentItem
          v-for="student in students"
          :key="student.id"
          :student="student"
          :available-tags="tags"
          @update-student="handleUpdateStudent"
          @delete-student="handleDeleteStudent"
        />
        <EmptyState
          v-if="students.length === 0"
          type="student"
          message="暂无学生"
          hint="在侧边栏「文件 - 名单管理」中添加学生"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import StudentItem from './StudentItem.vue'
import EmptyState from '../ui/EmptyState.vue'
import { useTagData, initializeTags } from '@/composables/useTagData'
import { useStudentData } from '@/composables/useStudentData'

// 初始化数据
onMounted(() => {
  initializeTags()
})

// 使用composables
const { tags } = useTagData()
const { students, updateStudent, deleteStudent } = useStudentData()

// 学生管理
const handleUpdateStudent = (studentId, studentData) => {
  updateStudent(studentId, studentData)
}

const handleDeleteStudent = (studentId) => {
  deleteStudent(studentId)
}
</script>

<style scoped>
.student-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f5f5;
  border-top: 2px solid #23587b;
}

.student-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.student-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
}

.student-list-header h3 {
  margin: 0;
  color: #23587b;
  font-size: 16px;
  font-weight: 600;
}

.student-count-badge {
  font-size: 13px;
  color: #666;
  background: #f0f0f0;
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
}

.student-items {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
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

@media (max-width: 1366px) and (min-width: 1025px), (max-height: 820px) and (min-width: 1025px) {
  .student-list-header {
    padding: 8px 12px;
  }

  .student-list-header h3 {
    font-size: 14px;
  }

  .student-count-badge {
    font-size: 12px;
  }

  .student-items {
    padding: 8px;
  }
}

/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .student-list-container {
    border-top: none;
    height: 100%;
    overflow: hidden;
  }

  .student-list {
    min-height: 0;
    overflow: hidden;
  }

  .student-list-header {
    padding: 8px 12px;
    flex-shrink: 0;
  }

  .student-list-header h3 {
    font-size: 14px;
  }

  .student-items {
    padding: 6px 8px;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
