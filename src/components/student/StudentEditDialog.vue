<template>
  <transition name="dialog-fade">
    <div v-if="visible" class="student-edit-overlay" @mousedown.self="close">
      <div class="student-edit-dialog">
        <div class="dialog-header">
          <h3>编辑学生信息</h3>
          <button class="close-btn" @click="close" title="关闭">
            <X :size="20" />
          </button>
        </div>

        <div class="dialog-body">
          <div class="form-group">
            <label class="form-label">姓名</label>
            <input
              v-model="localName"
              type="text"
              class="form-input"
              placeholder="请输入学生姓名"
              @keyup.enter="handleSave"
            />
          </div>

          <div class="form-group">
            <label class="form-label">学号</label>
            <input
              v-model="localNumber"
              type="text"
              class="form-input"
              placeholder="请输入学号（可选）"
              @keyup.enter="handleSave"
            />
          </div>

          <div class="form-group">
            <label class="form-label">标签</label>
            <div class="tags-container">
              <div v-if="localTags.length > 0" class="selected-tags">
                <span
                  v-for="tagId in localTags"
                  :key="tagId"
                  class="tag-item"
                  :style="{ backgroundColor: getTagColor(tagId) }"
                  @click="removeTag(tagId)"
                >
                  {{ getTagName(tagId) }}
                  <X :size="12" />
                </span>
              </div>
              <div class="available-tags">
                <span
                  v-for="tag in availableTags"
                  :key="tag.id"
                  class="tag-option"
                  :style="{ borderColor: tag.color, color: tag.color }"
                  @click="addTag(tag.id)"
                >
                  {{ tag.name }}
                </span>
                <span v-if="availableTags.length === 0" class="no-tags">暂无可用标签</span>
              </div>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="close">取消</button>
          <button class="btn btn-primary" @click="handleSave">保存</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useLogger } from '@/composables/useLogger'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  studentId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:visible', 'saved'])

const { students, updateStudent } = useStudentData()
const { tags } = useTagData()
const { success } = useLogger()

const localName = ref('')
const localNumber = ref('')
const localTags = ref([])

// 当前学生信息
const currentStudent = computed(() => {
  if (!props.studentId) return null
  return students.value.find(s => s.id === props.studentId)
})

// 可用标签（未选中的标签）
const availableTags = computed(() => {
  return tags.value.filter(tag => !localTags.value.includes(tag.id))
})

// 监听学生ID变化，加载学生信息
watch(() => props.studentId, (newId) => {
  if (newId && currentStudent.value) {
    localName.value = currentStudent.value.name || ''
    localNumber.value = currentStudent.value.studentNumber || ''
    localTags.value = currentStudent.value.tags ? [...currentStudent.value.tags] : []
  }
}, { immediate: true })

// 监听对话框显示状态
watch(() => props.visible, (newVisible) => {
  if (newVisible && currentStudent.value) {
    localName.value = currentStudent.value.name || ''
    localNumber.value = currentStudent.value.studentNumber || ''
    localTags.value = currentStudent.value.tags ? [...currentStudent.value.tags] : []
  }
})

const getTagName = (tagId) => {
  const tag = tags.value.find(t => t.id === tagId)
  return tag ? tag.name : '未知'
}

const getTagColor = (tagId) => {
  const tag = tags.value.find(t => t.id === tagId)
  return tag ? tag.color : '#999999'
}

const addTag = (tagId) => {
  if (!localTags.value.includes(tagId)) {
    localTags.value.push(tagId)
  }
}

const removeTag = (tagId) => {
  localTags.value = localTags.value.filter(id => id !== tagId)
}

const handleSave = () => {
  if (!props.studentId) return

  updateStudent(props.studentId, {
    name: localName.value,
    studentNumber: localNumber.value,
    tags: localTags.value
  })

  success('学生信息已更新')
  emit('saved')
  close()
}

const close = () => {
  emit('update:visible', false)
}
</script>

<style scoped>
.student-edit-overlay {
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
  backdrop-filter: blur(4px);
}

.student-edit-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.close-btn {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #64748b;
  border-radius: 6px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #f1f5f9;
  color: #334155;
}

.dialog-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary, #23587b);
  box-shadow: 0 0 0 3px rgba(35, 88, 123, 0.1);
}

.form-input::placeholder {
  color: #94a3b8;
}

.tags-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-item:hover {
  opacity: 0.8;
  transform: scale(0.95);
}

.available-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-option {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border: 1.5px solid;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-option:hover {
  background: currentColor;
  color: white !important;
}

.no-tags {
  font-size: 13px;
  color: #94a3b8;
  font-style: italic;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.btn-primary {
  background: var(--color-primary, #23587b);
  color: white;
}

.btn-primary:hover {
  background: #1a4460;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-active .student-edit-dialog,
.dialog-fade-leave-active .student-edit-dialog {
  transition: transform 0.2s;
}

.dialog-fade-enter-from .student-edit-dialog,
.dialog-fade-leave-to .student-edit-dialog {
  transform: scale(0.95);
}

@media (max-width: 768px) {
  .student-edit-dialog {
    width: 95%;
    max-width: none;
  }

  .dialog-header {
    padding: 16px 20px;
  }

  .dialog-body {
    padding: 20px;
  }

  .dialog-footer {
    padding: 12px 20px;
  }
}
</style>
