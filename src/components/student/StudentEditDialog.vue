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

          <div v-if="enabledAttributeDefinitions.length > 0" class="form-group">
            <label class="form-label">数值属性</label>
            <div class="numeric-grid">
              <label
                v-for="attribute in enabledAttributeDefinitions"
                :key="attribute.id"
                class="numeric-field"
              >
                <span>{{ attribute.unit ? `${attribute.name}（${attribute.unit}）` : attribute.name }}</span>
                <input
                  v-model="localNumericAttributes[attribute.id]"
                  type="number"
                  :min="attribute.min ?? undefined"
                  :max="attribute.max ?? undefined"
                  class="form-input"
                  @keyup.enter="handleSave"
                />
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">标签</label>
            <div class="tags-container">
              <div v-if="localTags.length > 0" class="selected-tags">
                <span
                  v-for="tagId in localTags"
                  :key="tagId"
                  class="tag-item"
                  :style="{ '--tag-color': getTagColor(tagId) }"
                  :title="getTagName(tagId)"
                  @click="removeTag(tagId)"
                >
                  <span class="tag-name">{{ getTagName(tagId) }}</span>
                  <X :size="12" />
                </span>
              </div>
              <div class="available-tags">
                <span
                  v-for="tag in availableTags"
                  :key="tag.id"
                  class="tag-option"
                  :style="{ '--tag-color': tag.color }"
                  :title="tag.name"
                  @click="addTag(tag.id)"
                >
                  <span class="tag-name">{{ tag.name }}</span>
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
import { useStudentAttributes } from '@/composables/useStudentAttributes'
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
const { enabledAttributeDefinitions } = useStudentAttributes()
const { success } = useLogger()

const localName = ref('')
const localNumber = ref('')
const localTags = ref([])
const localNumericAttributes = ref({})

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
    localNumericAttributes.value = { ...(currentStudent.value.numericAttributes || {}) }
  }
}, { immediate: true })

// 监听对话框显示状态
watch(() => props.visible, (newVisible) => {
  if (newVisible && currentStudent.value) {
    localName.value = currentStudent.value.name || ''
    localNumber.value = currentStudent.value.studentNumber || ''
    localTags.value = currentStudent.value.tags ? [...currentStudent.value.tags] : []
    localNumericAttributes.value = { ...(currentStudent.value.numericAttributes || {}) }
  }
})

const getTagName = (tagId) => {
  const tag = tags.value.find(t => t.id === tagId)
  return tag ? tag.name : '未知'
}

const getTagColor = (tagId) => {
  const tag = tags.value.find(t => t.id === tagId)
  return tag ? tag.color : 'var(--color-text-disabled)'
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

  const numericAttributes = {}
  enabledAttributeDefinitions.value.forEach(attribute => {
    const value = localNumericAttributes.value[attribute.id]
    if (value === '' || value === null || value === undefined) {
      numericAttributes[attribute.id] = null
      return
    }
    const parsed = Number(value)
    numericAttributes[attribute.id] = Number.isFinite(parsed) ? parsed : null
  })

  updateStudent(props.studentId, {
    name: localName.value,
    studentNumber: localNumber.value,
    tags: localTags.value,
    numericAttributes
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
  inset: 0;
  background: var(--color-bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 9999;
}

.student-edit-dialog {
  background: var(--color-surface);
  border-radius: 12px;
  border: 1px solid var(--color-border);
  box-shadow: 0 18px 48px color-mix(in srgb, var(--color-text-primary) 18%, transparent);
  width: min(560px, calc(100vw - 32px));
  max-height: min(90dvh, 760px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px;
  border-bottom: 1px solid var(--color-border);
  flex: 0 0 auto;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.close-btn {
  background: transparent;
  border: none;
  width: 36px;
  height: 36px;
  padding: 0;
  cursor: pointer;
  color: var(--color-text-muted);
  border-radius: 8px;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.close-btn:hover,
.close-btn:focus-visible {
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
}

.close-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.dialog-body {
  padding: 22px 24px;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
}

.form-group {
  margin-bottom: 18px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 10px;
}

.form-input {
  box-sizing: border-box;
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--color-text-primary);
  background: var(--color-input-bg);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.form-input::placeholder {
  color: var(--color-text-disabled);
}

.tags-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.numeric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.numeric-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.numeric-field span {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.35;
  min-width: 0;
  overflow-wrap: anywhere;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--tag-color) 42%, transparent);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  color: var(--tag-color);
  background: color-mix(in srgb, var(--tag-color) 14%, var(--color-surface));
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.2s;
}

.tag-item:hover {
  background: color-mix(in srgb, var(--tag-color) 20%, var(--color-surface));
  border-color: color-mix(in srgb, var(--tag-color) 60%, transparent);
  transform: translateY(-1px);
}

.available-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.tag-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--tag-color) 72%, var(--color-border));
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  background: var(--color-surface);
  color: var(--tag-color);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.2s;
}

.tag-option:hover {
  background: color-mix(in srgb, var(--tag-color) 12%, var(--color-surface));
  border-color: var(--tag-color);
  transform: translateY(-1px);
}

.tag-name {
  min-width: 0;
  max-width: min(180px, 100%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-tags {
  font-size: 13px;
  color: var(--color-text-disabled);
  font-style: italic;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 24px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-subtle);
  flex: 0 0 auto;
}

.btn {
  min-width: 92px;
  height: 44px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s;
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-strong);
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-surface);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent);
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
    width: min(560px, calc(100vw - 24px));
    max-height: calc(100dvh - 24px);
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

@media (max-width: 520px) {
  .numeric-grid {
    grid-template-columns: 1fr;
  }

  .dialog-footer {
    gap: 10px;
  }

  .btn {
    min-width: 0;
    flex: 1;
  }

  .tag-name {
    max-width: min(220px, 100%);
  }
}
</style>
