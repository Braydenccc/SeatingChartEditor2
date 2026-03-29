<template>
  <div class="student-list-container">
    <TagManager
      :tags="tags"
      @add-tag="handleAddTag"
      @edit-tag="handleEditTag"
      @delete-tag="handleDeleteTag"
    />
    <div class="student-list">
      <div class="student-list-header">
        <h3>学生名单</h3>
        <div class="student-count-control">
          <label>共</label>
          <input
            v-model.number="targetStudentCount"
            type="number"
            min="0"
            class="student-count-input"
            :class="{ error: isCountError }"
            @blur="handleStudentCountChange"
            @keyup.enter="handleStudentCountChange"
          />
          <label>人</label>
        </div>
        <button class="add-student-btn" @click="handleAddStudent">添加学生</button>
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
          hint="点击上方按钮添加学生"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import TagManager from './TagManager.vue'
import StudentItem from './StudentItem.vue'
import EmptyState from '../ui/EmptyState.vue'
import { useTagData, initializeTags } from '@/composables/useTagData'
import { useStudentData } from '@/composables/useStudentData'
import { useZoneData } from '@/composables/useZoneData'
import { useExportSettings } from '@/composables/useExportSettings'

// 初始化数据
onMounted(() => {
  initializeTags()
})

// 使用composables
const { tags, addTag, editTag, deleteTag } = useTagData()
const { students, addStudent, setStudentCount, updateStudent, deleteStudent, removeTagFromStudents } = useStudentData()
const { removeTagFromAllZones } = useZoneData()
const { exportSettings } = useExportSettings()

// 学生人数控制
const targetStudentCount = ref(0)
const isCountError = ref(false)

// 监听学生列表变化，同步人数输入框
watch(students, (newStudents) => {
  if (!isCountError.value) {
    targetStudentCount.value = newStudents.length
  }
}, { immediate: true })

// 处理人数变化
const handleStudentCountChange = () => {
  if (!targetStudentCount.value || targetStudentCount.value < 0) {
    targetStudentCount.value = students.value.length
    isCountError.value = false
    return
  }

  const success = setStudentCount(targetStudentCount.value)

  if (!success) {
    // 无法满足要求，标红提示
    isCountError.value = true
  } else {
    isCountError.value = false
  }
}

// 标签管理
const handleAddTag = (tagData) => {
  addTag(tagData)
}

const handleEditTag = (tagId, tagData) => {
  editTag(tagId, tagData)
}

const handleDeleteTag = (tagId) => {
  // 先从所有学生中移除该标签
  removeTagFromStudents(tagId)
  // 从所有选区中移除该标签
  removeTagFromAllZones(tagId)
  // 清理导出设置中的残留条目
  delete exportSettings.value.tagSettings[tagId]
  // 再删除标签
  deleteTag(tagId)
}

// 学生管理
const handleAddStudent = () => {
  addStudent()
  isCountError.value = false
}

const handleUpdateStudent = (studentId, studentData) => {
  updateStudent(studentId, studentData)
}

const handleDeleteStudent = (studentId) => {
  deleteStudent(studentId)
  isCountError.value = false
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
  padding: 15px 20px;
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
}

.student-list-header h3 {
  margin: 0;
  color: #23587b;
  font-size: 18px;
  font-weight: 600;
}

.student-count-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.student-count-control label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.student-count-input {
  width: 70px;
  padding: 6px 10px;
  border: 2px solid #e0e0e0;
  border-radius: 4px;
  font-size: 14px;
  text-align: center;
  transition: all 0.3s ease;
}

.student-count-input:focus {
  outline: none;
  border-color: #23587b;
}

.student-count-input.error {
  border-color: #f44336;
  background-color: #ffebee;
  color: #f44336;
}

.student-count-input::-webkit-inner-spin-button,
.student-count-input::-webkit-outer-spin-button {
  opacity: 1;
}

.add-student-btn {
  padding: 8px 16px;
  background: #23587b;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(35, 88, 123, 0.2);
}

.add-student-btn:hover {
  background: #1a4460;
  box-shadow: 0 4px 8px rgba(35, 88, 123, 0.3);
  transform: translateY(-1px);
}

.add-student-btn:active {
  transform: translateY(0);
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
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px 12px;
    flex-shrink: 0;
  }

  .student-list-header h3 {
    font-size: 16px;
  }

  .student-count-input {
    width: 60px;
  }

  .add-student-btn {
    font-size: 13px;
    padding: 7px 14px;
  }

  .student-items {
    padding: 6px 8px;
    -webkit-overflow-scrolling: touch;
  }
}

@media (max-width: 480px) {
  .student-list-header {
    padding: 10px 12px;
  }

  .student-list-header h3 {
    font-size: 15px;
    width: 100%;
  }

  .student-count-control label {
    font-size: 13px;
  }

  .add-student-btn {
    flex: 1;
  }
}
</style>
