<template>
  <ResponsiveOverlay
    v-model:show="isShown"
    title="批量编辑"
    :desktop-width="560"
    :mobile-height="'min(88dvh, 760px)'"
  >
        <span class="selected-count">已选中 {{ selectedStudents.length }} 人</span>
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
                    <NInput
                      v-if="editData[student.id]"
                      class="info-input input-name"
                      size="small"
                      v-model:value="editData[student.id].name"
                      @blur="handleSaveStudent(student.id)"
                      @keyup.enter="handleSaveStudent(student.id)"
                      placeholder="姓名"
                      title="学生姓名"
                    />
                  </div>
                  <div class="input-wrapper number-wrapper">
                    <NInput
                      v-if="editData[student.id]"
                      class="info-input input-number"
                      size="small"
                      v-model:value="editData[student.id].studentNumber"
                      @blur="handleSaveStudent(student.id)"
                      @keyup.enter="handleSaveStudent(student.id)"
                      placeholder="学号 (可选)"
                      title="学生学号"
                    >
                      <template #prefix>#</template>
                    </NInput>
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
              <NButton
                v-for="tag in tags"
                :key="tag.id"
                class="tag-action-btn"
                :class="{ 'all-have': tagStatus[tag.id]?.allHave, 'some-have': tagStatus[tag.id]?.someHave }"
                size="small"
                secondary
                :type="tagStatus[tag.id]?.allHave ? 'primary' : (tagStatus[tag.id]?.someHave ? 'warning' : 'default')"
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
              </NButton>
              <div v-if="tags.length === 0" class="no-tags-available">
                暂无标签，请先在名单与属性中创建标签
              </div>
            </div>
          </div>
        </div>
  </ResponsiveOverlay>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NButton, NInput } from 'naive-ui'
import { Check } from 'lucide-vue-next'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'

const props = withDefaults(defineProps<{
  visible?: boolean
  studentIds?: number[]
}>(), {
  visible: false,
  studentIds: () => []
})

const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const isShown = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const { students, updateStudent, addTagToStudents, removeTagFromStudent } = useStudentData()
const { tags } = useTagData()

interface StudentEditDraft {
  name: string
  studentNumber: string
}

interface TagStatus {
  count: number
  allHave: boolean
  someHave: boolean
}

const editData = ref<Record<number, StudentEditDraft>>({})
const updateKey = ref(0)

const selectedStudents = computed(() => {
  updateKey.value
  const studentIds = props.studentIds
  const allStudents = students.value
  return studentIds
    .map(id => allStudents.find(s => s.id === id))
    .filter((student): student is NonNullable<typeof student> => student !== undefined)
    .map(student => ({
      ...student,
      tags: [...(student.tags || [])]
    }))
})

const tagStatus = computed(() => {
  const status: Record<number, TagStatus> = {}
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
      studentNumber: student.studentNumber?.toString() ?? ''
    }
  })
}

const handleSaveStudent = (studentId: number) => {
  const data = editData.value[studentId]
  if (!data) return
  
  const student = students.value.find(s => s.id === studentId)
  if (!student) return
  
  updateStudent(studentId, {
    name: data.name,
    studentNumber: data.studentNumber.trim() && Number.isFinite(Number(data.studentNumber))
      ? Number(data.studentNumber)
      : null,
    tags: student.tags
  })
}

const handleToggleTag = (tagId: number) => {
  const status = tagStatus.value[tagId]
  if (!status) return
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

const getTagName = (tagId: number) => {
  const tag = tags.value.find(t => t.id === tagId)
  return tag?.name || '未知'
}

const getTagColor = (tagId: number) => {
  const tag = tags.value.find(t => t.id === tagId)
  return tag?.color || 'var(--color-text-disabled)'
}

const close = () => {
  emit('update:visible', false)
}
</script>

<style scoped>
.selected-count {
  font-size: 13px;
  color: var(--color-text-secondary);
  background: var(--color-bg-selected);
  padding: 2px 10px;
  border-radius: 12px;
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
  box-shadow: 0 2px 6px var(--shadow-sm);
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
  display: flex;
  align-items: center;
}

.info-input {
  width: 100%;
}

.name-wrapper {
  width: 90px;
}

.number-wrapper {
  width: 110px;
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
  text-shadow: 0 1px 1px var(--shadow-md);
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
  max-width: 100%;
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

.no-tags-available {
  width: 100%;
  text-align: center;
  padding: 12px;
  color: var(--color-text-disabled);
  font-size: 12px;
}

</style>
