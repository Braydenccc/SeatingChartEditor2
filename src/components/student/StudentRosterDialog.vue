<template>
  <transition name="dialog-fade">
    <div v-if="visible" class="student-roster-overlay" @mousedown.self="close">
      <div class="student-roster-dialog">
        <div class="dialog-header">
          <h3>编辑名单</h3>
          <button class="close-btn" @click="close">&times;</button>
        </div>

        <div class="dialog-body">
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
      </div>
    </div>
  </transition>
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

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['update:visible'])

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
  if (exportSettings.value.tagSettings) {
    delete exportSettings.value.tagSettings[tagId]
  }
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

const close = () => {
  emit('update:visible', false)
}
</script>

<style scoped>
.student-roster-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.student-roster-dialog {
  background: var(--color-surface, #ffffff);
  width: 90%;
  max-width: 600px;
  height: 85vh;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  overflow: hidden;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--color-bg-subtle, #f8f9fa);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.dialog-header h3 {
  margin: 0;
  color: var(--color-primary, #23587b);
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--color-text-muted, #999);
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  color: var(--color-text-primary, #333);
}

.dialog-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  background: #f5f5f5;
}

/* 原始 StudentList 样式适配过来 */
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
  font-size: 16px;
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
  padding: 15px;
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

/* Transition styles */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-active .student-roster-dialog {
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.dialog-fade-leave-active .student-roster-dialog {
  transform: translateY(20px);
  opacity: 0;
  transition: all 0.3s ease;
}
</style>
