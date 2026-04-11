<template>
  <div class="student-list-container">
    <div class="student-list-header">
      <div class="header-left">
        <h3>学生候选</h3>
        <span class="candidate-count" v-if="unassignedStudents.length > 0">
          {{ unassignedStudents.length }}
        </span>
      </div>
      <div class="header-right">
        <button class="icon-btn" title="随机排位" @click="handleRandomAssign">
          <Shuffle :size="16" stroke-width="2.5" />
        </button>
        <button class="icon-btn" title="编辑名单" @click="showRosterDialog = true">
          <Users :size="16" stroke-width="2.5" />
        </button>
      </div>
    </div>
    <div class="student-items">
      <StudentItem
        v-for="student in unassignedStudents"
        :key="student.id"
        :student="student"
        :available-tags="tags"
        @update-student="handleUpdateStudent"
        @delete-student="handleDeleteStudent"
      />
      <EmptyState
        v-if="unassignedStudents.length === 0"
        type="student"
        message="暂无候选学生"
        hint="所有学生都已入座，或点击右上角管理人员名单"
      />
    </div>
    
    <StudentRosterDialog v-model:visible="showRosterDialog" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Shuffle, Users } from 'lucide-vue-next'
import StudentItem from './StudentItem.vue'
import EmptyState from '../ui/EmptyState.vue'
import StudentRosterDialog from './StudentRosterDialog.vue'
import { useTagData } from '@/composables/useTagData'
import { useStudentData } from '@/composables/useStudentData'
import { useSeatChart } from '@/composables/useSeatChart'
import { useLogger } from '@/composables/useLogger'

const showRosterDialog = ref(false)

const { tags } = useTagData()
const { students, updateStudent, deleteStudent } = useStudentData()
const { findSeatByStudent, getEmptySeats, assignStudent } = useSeatChart()
const { success, warning } = useLogger()

// 未入座学生计算属性
const unassignedStudents = computed(() => {
  return students.value.filter(student => !findSeatByStudent(student.id))
})

const handleUpdateStudent = (studentId, studentData) => {
  updateStudent(studentId, studentData)
}

const handleDeleteStudent = (studentId) => {
  deleteStudent(studentId)
}

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
</script>

<style scoped>
.student-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f5f5;
  border-top: 2px solid #23587b;
}

.student-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-left h3 {
  margin: 0;
  color: #23587b;
  font-size: 16px;
  font-weight: 600;
}

.candidate-count {
  background: var(--color-danger, #f44336);
  color: white;
  font-size: 12px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
  line-height: 1;
}

.header-right {
  display: flex;
  gap: 8px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: #f0f0f0;
  color: #555;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: #e0e0e0;
  color: #23587b;
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
    padding: 10px 12px;
  }
  
  .header-left h3 {
    font-size: 15px;
  }
  
  .icon-btn {
    padding: 6px;
  }
  
  .student-items {
    padding: 8px;
  }
}

/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .student-list-container {
    border-top: none;
  }

  .student-list-header {
    padding: 10px 12px;
  }

  .student-items {
    padding: 6px 8px;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
