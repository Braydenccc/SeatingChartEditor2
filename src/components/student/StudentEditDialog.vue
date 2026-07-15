<template>
  <ResponsiveOverlay :show="visible" title="编辑学生信息" :busy="isCommitting" :desktop-width="560" @update:show="value => !value && requestClose()">
        <div class="dialog-body">
          <div class="form-group">
            <label class="form-label">姓名</label>
            <NInput
              v-model:value="localName"
              type="text"
              class="form-input"
              placeholder="请输入学生姓名"
              @keyup.enter="handleSave"
            />
          </div>

          <div class="form-group">
            <label class="form-label">学号</label>
            <NInput
              v-model:value="localNumber"
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
                <NInputNumber
                  :value="localNumericAttributes[attribute.id]"
                  :min="attribute.min ?? undefined"
                  :max="attribute.max ?? undefined"
                  :precision="attribute.precision ?? undefined"
                  class="form-input"
                  @update:value="value => updateLocalNumericAttribute(attribute, value)"
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

        <template #footer><div class="dialog-footer">
          <NButton class="dialog-action" secondary @click="requestClose">取消</NButton>
          <NButton class="dialog-action" type="primary" :loading="isCommitting" @click="handleSave">保存</NButton>
        </div></template>
  </ResponsiveOverlay>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NButton, NInput, NInputNumber } from 'naive-ui'
import { X } from 'lucide-vue-next'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useLogger } from '@/composables/useLogger'
import { normalizeNumberInput } from '@/utils/inputNormalization'
import type { NumericAttributeDefinition, Student } from '@/types/models'

const props = withDefaults(defineProps<{
  visible?: boolean
  studentId?: number | null
}>(), {
  visible: false,
  studentId: null
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const { students, updateStudent } = useStudentData()
const { tags } = useTagData()
const { enabledAttributeDefinitions } = useStudentAttributes()
const { success, confirm } = useLogger()

const localName = ref('')
const localNumber = ref('')
const localTags = ref<number[]>([])
const localNumericAttributes = ref<Record<string, number | null>>({})
const originalSnapshot = ref('')
const isCommitting = ref(false)
const getFormSnapshot = () => JSON.stringify({
  name: localName.value,
  number: localNumber.value,
  tags: localTags.value,
  numericAttributes: localNumericAttributes.value
})

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
    localNumber.value = currentStudent.value.studentNumber == null ? '' : String(currentStudent.value.studentNumber)
    localTags.value = currentStudent.value.tags ? [...currentStudent.value.tags] : []
    localNumericAttributes.value = { ...(currentStudent.value.numericAttributes || {}) }
    originalSnapshot.value = getFormSnapshot()
  }
}, { immediate: true })

// 监听对话框显示状态
watch(() => props.visible, (newVisible) => {
  if (newVisible && currentStudent.value) {
    localName.value = currentStudent.value.name || ''
    localNumber.value = currentStudent.value.studentNumber == null ? '' : String(currentStudent.value.studentNumber)
    localTags.value = currentStudent.value.tags ? [...currentStudent.value.tags] : []
    localNumericAttributes.value = { ...(currentStudent.value.numericAttributes || {}) }
    originalSnapshot.value = getFormSnapshot()
  }
})

const getTagName = (tagId: number) => {
  const tag = tags.value.find(t => t.id === tagId)
  return tag ? tag.name : '未知'
}

const getTagColor = (tagId: number) => {
  const tag = tags.value.find(t => t.id === tagId)
  return tag ? tag.color : 'var(--color-text-disabled)'
}

const addTag = (tagId: number) => {
  if (!localTags.value.includes(tagId)) {
    localTags.value.push(tagId)
  }
}

const removeTag = (tagId: number) => {
  localTags.value = localTags.value.filter(id => id !== tagId)
}

const updateLocalNumericAttribute = (
  attribute: NumericAttributeDefinition,
  value: number | null
) => {
  localNumericAttributes.value[attribute.id] = normalizeNumberInput(value, {
    min: attribute.min ?? undefined,
    max: attribute.max ?? undefined,
    precision: attribute.precision ?? 0
  })
}

const handleSave = () => {
  if (!props.studentId) return

  const numericAttributes: Student['numericAttributes'] = {}
  enabledAttributeDefinitions.value.forEach(attribute => {
    const value = localNumericAttributes.value[attribute.id]
    if (value === null || value === undefined) {
      numericAttributes[attribute.id] = null
      return
    }
    numericAttributes[attribute.id] = normalizeNumberInput(value, {
      min: attribute.min ?? undefined,
      max: attribute.max ?? undefined,
      precision: attribute.precision ?? 0
    })
  })

  updateStudent(props.studentId, {
    name: localName.value,
    studentNumber: localNumber.value.trim() === '' || !Number.isFinite(Number(localNumber.value))
      ? null
      : Number(localNumber.value),
    tags: localTags.value,
    numericAttributes
  })

  success('学生信息已更新')
  emit('saved')
  isCommitting.value = true
  close()
  isCommitting.value = false
}

const requestClose = async () => {
  if (!isCommitting.value && originalSnapshot.value && originalSnapshot.value !== getFormSnapshot()) {
    const discard = await confirm({
      title: '放弃学生信息修改',
      content: '当前修改尚未保存，确认放弃？',
      positiveText: '放弃修改',
      type: 'warning'
    })
    if (!discard) return
  }
  close()
}

const close = () => {
  emit('update:visible', false)
}
</script>

<style scoped>

.dialog-body {
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
  width: 100%;
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
  flex: 0 0 auto;
}

.dialog-action {
  min-width: 92px;
}


@media (max-width: 768px) {

  .dialog-action {
    min-height: 44px;
  }
}

@media (max-width: 520px) {
  .numeric-grid {
    grid-template-columns: 1fr;
  }

  .dialog-footer {
    gap: 10px;
  }

  .dialog-action {
    min-width: 0;
    flex: 1;
  }

  .tag-name {
    max-width: min(220px, 100%);
  }
}
</style>
