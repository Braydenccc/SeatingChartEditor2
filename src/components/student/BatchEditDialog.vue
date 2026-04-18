<template>
  <transition name="dialog-fade">
    <div v-if="visible" class="batch-edit-overlay" @mousedown.self="close">
      <div class="batch-edit-dialog">
        <div class="dialog-header">
          <h3>批量编辑</h3>
          <span class="selected-count">已选中 {{ selectedStudents.length }} 人</span>
          <button class="close-btn" @click="close">&times;</button>
        </div>

        <div class="dialog-body">
          <div class="student-list-section">
            <div class="section-header">
              <h4>学生信息</h4>
            </div>
            <div class="student-items">
              <div
                v-for="student in selectedStudents"
                :key="student.id"
                class="student-edit-item"
              >
                <div class="student-info">
                  <div class="input-wrapper name-wrapper">
                    <input
                      v-if="editData[student.id]"
                      class="info-input input-name"
                      v-model="editData[student.id].name"
                      @blur="handleSaveStudent(student.id)"
                      @keyup.enter="handleSaveStudent(student.id)"
                      placeholder="姓名"
                      title="学生姓名"
                    />
                    <div class="input-line"></div>
                  </div>
                  <div class="input-wrapper number-wrapper">
                    <span class="number-prefix">#</span>
                    <input
                      v-if="editData[student.id]"
                      class="info-input input-number"
                      v-model="editData[student.id].studentNumber"
                      @blur="handleSaveStudent(student.id)"
                      @keyup.enter="handleSaveStudent(student.id)"
                      placeholder="学号 (可选)"
                      title="学生学号"
                    />
                    <div class="input-line"></div>
                  </div>
                </div>
                <div class="student-tags-display">
                  <span
                    v-for="tagId in student.tags"
                    :key="tagId"
                    class="tag-badge"
                    :style="{ backgroundColor: getTagColor(tagId) }"
                  >
                    {{ getTagName(tagId) }}
                  </span>
                  <span v-if="!student.tags || student.tags.length === 0" class="no-tags-hint">
                    无标签
                  </span>
                </div>
              </div>
              <div v-if="selectedStudents.length === 0" class="empty-hint">
                未选中任何学生
              </div>
            </div>
          </div>

          <div class="tags-section">
            <div class="section-header">
              <h4>批量标签操作</h4>
              <span class="hint">点击标签为所有选中学生添加/移除</span>
            </div>
            <div class="tags-grid">
              <button
                v-for="tag in tags"
                :key="tag.id"
                class="tag-action-btn"
                :class="{ 'all-have': tagStatus[tag.id]?.allHave, 'some-have': tagStatus[tag.id]?.someHave }"
                :style="{ '--tag-color': tag.color }"
                @click="handleToggleTag(tag.id)"
              >
                <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
                <span class="tag-name">{{ tag.name }}</span>
                <span class="tag-status">
                  <template v-if="tagStatus[tag.id]?.allHave">
                    <Check :size="12" stroke-width="3" />
                  </template>
                  <template v-else-if="tagStatus[tag.id]?.someHave">
                    ({{ tagStatus[tag.id].count }}/{{ selectedStudents.length }})
                  </template>
                </span>
              </button>
              <div v-if="tags.length === 0" class="no-tags-available">
                暂无标签，请先在编辑名单中创建标签
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Check } from 'lucide-vue-next'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData, initializeTags } from '@/composables/useTagData'

const props = defineProps({
  visible: { type: Boolean, default: false },
  studentIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:visible'])

onMounted(() => {
  initializeTags()
})

const { students, updateStudent, addTagToStudents, removeTagFromStudent } = useStudentData()
const { tags } = useTagData()

const editData = ref({})
const updateKey = ref(0)

const selectedStudents = computed(() => {
  updateKey.value
  const studentIds = props.studentIds
  const allStudents = students.value
  return studentIds
    .map(id => allStudents.find(s => s.id === id))
    .filter(Boolean)
    .map(student => ({
      ...student,
      tags: [...(student.tags || [])]
    }))
})

const tagStatus = computed(() => {
  const status = {}
  const studentList = selectedStudents.value
  
  tags.value.forEach(tag => {
    const count = studentList.filter(s => s.tags && s.tags.includes(tag.id)).length
    status[tag.id] = {
      count,
      allHave: count === studentList.length && studentList.length > 0,
      someHave: count > 0 && count < studentList.length
    }
  })
  
  return status
})

watch(() => props.visible, (visible) => {
  if (visible) {
    initEditData()
  }
}, { immediate: true })

const initEditData = () => {
  editData.value = {}
  selectedStudents.value.forEach(student => {
    editData.value[student.id] = {
      name: student.name || '',
      studentNumber: student.studentNumber || ''
    }
  })
}

const handleSaveStudent = (studentId) => {
  const data = editData.value[studentId]
  if (!data) return
  
  const student = students.value.find(s => s.id === studentId)
  if (!student) return
  
  updateStudent(studentId, {
    name: data.name,
    studentNumber: data.studentNumber || null,
    tags: student.tags
  })
}

const handleToggleTag = (tagId) => {
  const status = tagStatus.value[tagId]
  const studentList = selectedStudents.value
  
  if (status.allHave) {
    studentList.forEach(student => {
      removeTagFromStudent(tagId, student.id)
    })
  } else {
    addTagToStudents(tagId, studentList.map(s => s.id))
  }
  updateKey.value++
}

const getTagName = (tagId) => {
  const tag = tags.value.find(t => t.id === tagId)
  return tag?.name || '未知'
}

const getTagColor = (tagId) => {
  const tag = tags.value.find(t => t.id === tagId)
  return tag?.color || '#999999'
}

const close = () => {
  emit('update:visible', false)
}
</script>

<style scoped>
.batch-edit-overlay {
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

.batch-edit-dialog {
  background: var(--color-surface, #ffffff);
  width: 90%;
  max-width: 560px;
  max-height: 85vh;
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
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--color-bg-subtle, #f8f9fa);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.dialog-header h3 {
  margin: 0;
  color: var(--color-primary, #23587b);
  font-size: 18px;
}

.selected-count {
  font-size: 13px;
  color: #666;
  background: #e8f4f8;
  padding: 2px 10px;
  border-radius: 12px;
}

.close-btn {
  margin-left: auto;
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

.student-list-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 120px;
  max-height: 280px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e8eef2;
}

.section-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #23587b;
}

.section-header .hint {
  font-size: 12px;
  color: #888;
}

.student-items {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.student-edit-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #ffffff;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 8px;
  border: 1px solid #eef2f5;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  transition: all 0.2s ease;
}

.student-edit-item:hover {
  box-shadow: 0 3px 10px rgba(35, 88, 123, 0.06);
  border-color: #d1e2ec;
}

.student-info {
  display: flex;
  gap: 10px;
  min-width: 200px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: #f7f9fa;
  border-radius: 6px;
  transition: background 0.3s ease;
}

.input-wrapper:hover,
.input-wrapper:focus-within {
  background: #f0f4f8;
}

.input-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background: #23587b;
  transition: width 0.3s ease, left 0.3s ease;
  border-radius: 2px;
}

.input-wrapper:focus-within .input-line {
  left: 0;
  width: 100%;
}

.info-input {
  border: none;
  background: transparent;
  padding: 7px 10px;
  font-size: 13px;
  color: #333;
  width: 100%;
  outline: none;
  font-family: inherit;
}

.info-input::placeholder {
  color: #a0aec0;
  font-weight: 400;
}

.name-wrapper {
  width: 90px;
}

.name-wrapper .info-input {
  font-weight: 600;
  color: #23587b;
}

.number-wrapper {
  width: 110px;
  padding-left: 8px;
}

.number-prefix {
  color: #a0aec0;
  font-size: 12px;
  font-weight: bold;
  user-select: none;
}

.number-wrapper .info-input {
  padding-left: 4px;
}

.student-tags-display {
  flex: 1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 22px;
}

.tag-badge {
  font-size: 10px;
  font-weight: 600;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
}

.no-tags-hint {
  font-size: 11px;
  color: #aaa;
}

.empty-hint {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 13px;
}

.tags-section {
  background: #fff;
  border-top: 1px solid #e8eef2;
}

.tags-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
}

.tag-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f8f9fa;
  border: 1px solid #e0e4e8;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  color: #444;
  transition: all 0.2s ease;
}

.tag-action-btn:hover {
  background: #f0f4f8;
  border-color: #c0c8d0;
}

.tag-action-btn.all-have {
  background: #e8f4f8;
  border-color: #23587b;
  color: #23587b;
}

.tag-action-btn.some-have {
  background: #fef9e7;
  border-color: #d4a947;
}

.tag-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-name {
  font-weight: 500;
}

.tag-status {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: #666;
}

.tag-action-btn.all-have .tag-status {
  color: #23587b;
}

.no-tags-available {
  width: 100%;
  text-align: center;
  padding: 12px;
  color: #999;
  font-size: 12px;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-active .batch-edit-dialog {
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.dialog-fade-leave-active .batch-edit-dialog {
  transform: translateY(20px);
  opacity: 0;
  transition: all 0.3s ease;
}
</style>
