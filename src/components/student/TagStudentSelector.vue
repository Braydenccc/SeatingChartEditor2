<template>
  <div class="tag-student-selector">
    <label class="selector-label" for="tag-student-search">分配学生</label>
    <div class="search-box">
      <NInput
        v-model:value="searchQuery"
        size="small"
        placeholder="搜索姓名或学号..."
        class="search-input"
        :input-props="{ id: 'tag-student-search' }"
      >
        <template #prefix><Search :size="14" /></template>
      </NInput>
    </div>
    <div class="student-list" v-if="filteredStudents.length > 0">
      <div
        v-for="student in filteredStudents"
        :key="student.id"
        class="student-row"
        :class="{ selected: isSelected(student.id) }"
        @click="updateStudentSelection(student.id, !isSelected(student.id))"
      >
        <NCheckbox
          class="checkbox-wrapper"
          :checked="isSelected(student.id)"
          :aria-labelledby="getStudentLabelId(student.id)"
          @click.stop
          @update:checked="checked => updateStudentSelection(student.id, checked)"
        />
        <span :id="getStudentLabelId(student.id)" class="student-name">{{ student.name || '未命名' }}</span>
        <span class="student-number" v-if="hasStudentNumber(student.studentNumber)">#{{ student.studentNumber }}</span>
      </div>
    </div>
    <div v-else class="empty-hint">
      {{ searchQuery ? '未找到匹配学生' : '暂无学生' }}
    </div>
    <div class="selector-footer" v-if="students.length > 0">
      已选择 {{ selectedIds.length }} / {{ students.length }} 人
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search } from 'lucide-vue-next'
import { NCheckbox, NInput } from 'naive-ui'
import type { Student } from '@/types/models'

const props = withDefaults(defineProps<{
  modelValue?: number[]
  students?: Student[]
}>(), {
  modelValue: () => [],
  students: () => []
})

const emit = defineEmits<{ 'update:modelValue': [value: number[]] }>()

const searchQuery = ref('')
const selectedIds = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const filteredStudents = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return props.students
  return props.students.filter(s => {
    const name = (s.name || '').toLowerCase()
    const number = s.studentNumber != null ? String(s.studentNumber) : ''
    return name.includes(query) || number.includes(query)
  })
})

const isSelected = (studentId: number) => selectedIds.value.includes(studentId)
const hasStudentNumber = (value: unknown) => value !== null && value !== undefined && value !== ''
const getStudentLabelId = (studentId: number) => `tag-student-label-${studentId}`

const updateStudentSelection = (studentId: number, checked: boolean) => {
  const current = [...selectedIds.value]
  const index = current.indexOf(studentId)
  if (!checked && index >= 0) {
    current.splice(index, 1)
  } else if (checked && index < 0) {
    current.push(studentId)
  }
  selectedIds.value = current
}
</script>

<style scoped>
.tag-student-selector {
  margin-bottom: 20px;
}

.selector-label {
  display: block;
  margin-bottom: 10px;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 500;
}

.search-box {
  margin-bottom: 8px;
}

.search-input {
  width: 100%;
}

.student-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
}

.student-list::-webkit-scrollbar {
  width: 5px;
}

.student-list::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 3px;
}

.student-list::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}

.student-list::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

.student-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s ease;
  border-bottom: 1px solid var(--color-bg-subtle);
}

.student-row:last-child {
  border-bottom: none;
}

.student-row:hover {
  background: var(--color-bg-subtle);
}

.student-row:focus-within {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.student-row.selected {
  background: var(--color-selection-bg);
  box-shadow: inset 3px 0 0 var(--color-selection-border);
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
}

.student-name {
  flex: 1;
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.student-number {
  font-size: 12px;
  color: var(--color-text-disabled);
  white-space: nowrap;
}

.empty-hint {
  text-align: center;
  color: var(--color-text-disabled);
  font-size: 13px;
  padding: 16px;
  border: 1px dashed var(--color-border);
  border-radius: 6px;
}

.selector-footer {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: right;
}
</style>
