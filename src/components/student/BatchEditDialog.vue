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
  background: var(--color-bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.batch-edit-dialog {
  background: var(--color-surface);
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
  background: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
}

.dialog-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 18px;
}

.selected-count {
  font-size: 13px;
  color: var(--color-text-secondary);
  background: var(--color-bg-selected);
  padding: 2px 10px;
  border-radius: 12px;
}

.close-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 24px;
  color: var(--color-text-disabled);
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.dialog-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  background: var(--color-bg-secondary);
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
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.section-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

.section-header .hint {
  font-size: 12px;
  color: var(--color-text-muted);
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
  background: var(--color-surface);
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 8px;
  border: 1px solid var(--color-border-light);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  transition: all 0.2s ease;
}

.student-edit-item:hover {
  box-shadow: 0 3px 10px color-mix(in srgb, var(--color-primary) 6%, transparent);
  border-color: var(--color-border);
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
  background: var(--color-bg-secondary);
  border-radius: 6px;
  transition: background 0.3s ease;
}

.input-wrapper:hover,
.input-wrapper:focus-within {
  background: var(--color-bg-subtle);
}

.input-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background: var(--color-primary);
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
  color: var(--color-text-primary);
  width: 100%;
  outline: none;
  font-family: inherit;
}

.info-input::placeholder {
  color: var(--color-text-disabled);
  font-weight: 400;
}

.name-wrapper {
  width: 90px;
}

.name-wrapper .info-input {
  font-weight: 600;
  color: var(--color-primary);
}

.number-wrapper {
  width: 110px;
  padding-left: 8px;
}

.number-prefix {
  color: var(--color-text-disabled);
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
  color: var(--color-text-inverse);
  padding: 2px 6px;
  border-radius: 4px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
}

.no-tags-hint {
  font-size: 11px;
  color: var(--color-text-disabled);
}

.empty-hint {
  text-align: center;
  padding: 20px;
  color: var(--color-text-disabled);
  font-size: 13px;
}

.tags-section {
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
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
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  color: var(--color-text-primary);
  transition: all 0.2s ease;
}

.tag-action-btn:hover {
  background: var(--color-bg-subtle);
  border-color: var(--color-border-strong);
}

.tag-action-btn.all-have {
  background: var(--color-bg-selected);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.tag-action-btn.some-have {
  background: var(--color-warning-bg-light);
  border-color: var(--color-warning);
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
  color: var(--color-text-secondary);
}

.tag-action-btn.all-have .tag-status {
  color: var(--color-primary);
}

.no-tags-available {
  width: 100%;
  text-align: center;
  padding: 12px;
  color: var(--color-text-disabled);
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
