<template>
  <div class="tag-student-selector">
    <label class="selector-label">分配学生:</label>
    <div class="search-box">
      <Search :size="14" class="search-icon" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索姓名或学号..."
        class="search-input"
      />
    </div>
    <div class="student-list" v-if="filteredStudents.length > 0">
      <div
        v-for="student in filteredStudents"
        :key="student.id"
        class="student-row"
        :class="{ selected: isSelected(student.id) }"
        @click="toggleStudent(student.id)"
      >
        <label class="checkbox-wrapper" @click.stop>
          <input
            type="checkbox"
            :checked="isSelected(student.id)"
            @change="toggleStudent(student.id)"
          />
          <span class="checkmark"></span>
        </label>
        <span class="student-name">{{ student.name || '未命名' }}</span>
        <span class="student-number" v-if="student.studentNumber">#{{ student.studentNumber }}</span>
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

<script setup>
import { ref, computed } from 'vue'
import { Search } from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  students: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

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

const isSelected = (studentId) => selectedIds.value.includes(studentId)

const toggleStudent = (studentId) => {
  const current = [...selectedIds.value]
  const index = current.indexOf(studentId)
  if (index >= 0) {
    current.splice(index, 1)
  } else {
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
  color: #555;
  font-size: 14px;
  font-weight: 500;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f7f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  margin-bottom: 8px;
  transition: border-color 0.3s;
}

.search-box:focus-within {
  border-color: #23587b;
}

.search-icon {
  color: #94a3b8;
  flex-shrink: 0;
}

.search-input {
  border: none;
  background: transparent;
  font-size: 13px;
  color: #333;
  outline: none;
  width: 100%;
  font-family: inherit;
}

.search-input::placeholder {
  color: #a0aec0;
}

.student-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e8eef2;
  border-radius: 6px;
  background: #fff;
}

.student-list::-webkit-scrollbar {
  width: 5px;
}

.student-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.student-list::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.student-list::-webkit-scrollbar-thumb:hover {
  background: #999;
}

.student-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s ease;
  border-bottom: 1px solid #f1f5f9;
}

.student-row:last-child {
  border-bottom: none;
}

.student-row:hover {
  background: #f8fafc;
}

.student-row.selected {
  background: #f0f7fb;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
}

.checkbox-wrapper input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #23587b;
}

.student-name {
  flex: 1;
  font-size: 13px;
  color: #334155;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.student-number {
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
}

.empty-hint {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  padding: 16px;
  border: 1px dashed #e2e8f0;
  border-radius: 6px;
}

.selector-footer {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
  text-align: right;
}
</style>
