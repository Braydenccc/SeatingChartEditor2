<template>
  <div class="student-item" :class="{ selected: isSelected, dragging: isStudentDragging }" :data-student-id="student.id"
    ref="itemRef" :draggable="canHtmlDrag()" @click="handleSelectStudent" @dragstart="handleDragStart" @dragend="handleDragEnd"
    @contextmenu.prevent @pointerdown="handlePointerDown">
    <div class="student-info">
      <div class="student-number-section">
        <input v-if="isEditingNumber" v-model.number="editStudentNumber" type="number" min="1"
          class="student-number-input" @blur="saveStudentNumber" @keyup.enter="saveStudentNumber" ref="numberInput"
          placeholder="学号" />
        <span v-else class="student-number" :class="{ empty: !student.studentNumber }" @dblclick="startEditNumber">
          {{ student.studentNumber || '未设置' }}
        </span>
      </div>

      <div class="student-name-section">
        <input v-if="isEditingName" v-model="editName" type="text" class="student-name-input" @blur="saveName"
          @keyup.enter="saveName" ref="nameInput" placeholder="姓名" />
        <span v-else class="student-name" :class="{ empty: !student.name }" @dblclick="startEditName">
          {{ student.name || '未命名' }}
        </span>
      </div>

      <div class="student-tags" aria-label="可横向滚动查看更多标签">
        <span v-for="tagId in student.tags" :key="tagId" class="student-tag"
          :style="{ background: getTagColor(tagId) }">
          {{ getTagName(tagId) }}
          <button class="remove-tag-btn" :aria-label="`移除标签 ${getTagName(tagId)}`" @click="removeTag(tagId)">×</button>
        </span>
        <button ref="addBtnRef" class="add-tag-to-student-btn" aria-label="添加标签" @click.stop="toggleTagPicker">+</button>
      </div>
    </div>

    <div class="student-actions">
      <button class="delete-student-btn" :class="{ confirming: isDeleting.value }" @click="deleteHandler">
        {{ isDeleting.value ? '再次点击确认' : '删除' }}
      </button>
    </div>

    <!-- 标签选择器独立组件 -->
    <TagPickerPopup 
      :show="showTagPicker" 
      :availableTags="availableTagsForStudent"
      :triggerEl="addBtnRef"
      @add="addTagToStudent"
      @close="showTagPicker = false" 
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useStudentData } from '@/composables/useStudentData'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useLogger } from '@/composables/useLogger'

import TagPickerPopup from './TagPickerPopup.vue'
import { useStudentDragging } from '@/composables/useStudentDragging'

const props = defineProps({
  student: {
    type: Object,
    required: true
  },
  availableTags: {
    type: Array,
    required: false,
    default: () => []
  }
})

const emit = defineEmits(['update-student', 'delete-student'])

const { selectedStudentId, selectStudent } = useStudentData()
const { requestConfirm, isConfirming } = useConfirmAction()
const { warning } = useLogger()
const itemRef = ref(null)

// 拖拽逻辑抽离（VueUse onLongPress 等）
const { 
  isStudentDragging, 
  canHtmlDrag, 
  handlePointerDown, 
  handleDragStart, 
  handleDragEnd 
} = useStudentDragging(itemRef, computed(() => props.student))

const isEditingName = ref(false)
const isEditingNumber = ref(false)
const editName = ref('')
const editStudentNumber = ref(null)
const nameInput = ref(null)
const numberInput = ref(null)
const showTagPicker = ref(false)
const addBtnRef = ref(null)

// 获取可以添加的标签(排除已添加的)
const availableTagsForStudent = computed(() => {
  return props.availableTags.filter(tag => !props.student.tags.includes(tag.id))
})

const getTagName = (tagId) => {
  const tag = props.availableTags.find(t => t.id === tagId)
  return tag ? tag.name : ''
}

const getTagColor = (tagId) => {
  const tag = props.availableTags.find(t => t.id === tagId)
  return tag ? tag.color : '#999'
}

// 是否为当前选中的学生
const isSelected = computed(() => {
  return selectedStudentId.value === props.student.id
})

// 点击学生项进行选中
const handleSelectStudent = (event) => {
  // 如果点击的是按钮或输入框,不触发选中
  const target = event.target
  if (target.closest('button') || target.tagName === 'INPUT') {
    return
  }

  // 切换选中状态
  if (isSelected.value) {
    selectStudent(null)
  } else {
    selectStudent(props.student.id)
  }
}



// 学号编辑
const startEditNumber = () => {
  isEditingNumber.value = true
  editStudentNumber.value = props.student.studentNumber
  nextTick(() => {
    numberInput.value?.focus()
  })
}

const saveStudentNumber = () => {
  if (editStudentNumber.value !== props.student.studentNumber) {
    emit('update-student', props.student.id, {
      name: props.student.name,
      studentNumber: editStudentNumber.value || null,
      tags: props.student.tags
    })
  }
  isEditingNumber.value = false
}

// 姓名编辑
const startEditName = () => {
  isEditingName.value = true
  editName.value = props.student.name
  nextTick(() => {
    nameInput.value?.focus()
  })
}

const saveName = () => {
  if (editName.value !== props.student.name) {
    emit('update-student', props.student.id, {
      name: editName.value,
      studentNumber: props.student.studentNumber,
      tags: props.student.tags
    })
  }
  isEditingName.value = false
}

const toggleTagPicker = () => {
  showTagPicker.value = !showTagPicker.value
}

const addTagToStudent = (tagId) => {
  const newTags = [...props.student.tags, tagId]
  emit('update-student', props.student.id, {
    name: props.student.name,
    studentNumber: props.student.studentNumber,
    tags: newTags
  })
  showTagPicker.value = false
}

const removeTag = (tagId) => {
  const newTags = props.student.tags.filter(tid => tid !== tagId)
  emit('update-student', props.student.id, {
    name: props.student.name,
    studentNumber: props.student.studentNumber,
    tags: newTags
  })
}

// 删除确认状态
const deleteKey = computed(() => `deleteStudent-${props.student.id}`)
const isDeleting = isConfirming(deleteKey.value)

const deleteHandler = () => {
  const displayName = props.student.name || '未命名学生'
  const confirmed = requestConfirm(
    deleteKey.value,
    () => emit('delete-student', props.student.id),
    `确定要删除"${displayName}"吗？`
  )

  if (!confirmed) {
    warning(`请再次点击删除按钮以确认删除"${displayName}"`)
  }
}
</script>

<style scoped>
.student-item {
  --student-item-bg: var(--color-surface);
  /* 使用负 inset 扩展命中区域：绝对定位伪元素会向四周外扩 */
  --touch-target-outset: -8px;
  /* 移动端为姓名/删除按钮保留空间，标签区采用保守基准宽度 */
  --mobile-tags-flex-basis: 42%;
  --scroll-cue-divider: rgba(var(--color-primary-rgb), 0.25);
  contain: layout style;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  margin-bottom: 10px;
  background: var(--student-item-bg);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
  position: relative;
  border: 1px solid #f0f0f0;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-user-drag: none;
}

/* 移动端减少间距 */
@media (max-width: 768px) {
  .student-item {
    margin-bottom: 4px;
  }
}

.student-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateY(-1px);
  border-color: #e0e0e0;
}

.student-item.selected {
  background: var(--color-bg-selected);
  border-color: var(--color-primary);
  box-shadow: 0 4px 16px rgba(35, 88, 123, 0.25), 0 0 0 1px var(--color-primary) inset;
  transform: translateY(-2px);
}

.student-item.selected:hover {
  box-shadow: 0 6px 20px rgba(35, 88, 123, 0.3);
}

.student-info {
  flex: 1;
  display: flex;
  gap: 12px;
  align-items: center;
}

.student-number-section {
  min-width: 80px;
  flex-shrink: 0;
}

.student-number {
  display: inline-block;
  padding: 6px 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--color-bg-selected);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 60px;
  text-align: center;
}

.student-number:hover {
  background: #d0e9f2;
}

.student-number.empty {
  color: #999;
  background: #f5f5f5;
  font-weight: 400;
  font-size: 13px;
}

.student-number-input {
  width: 80px;
  padding: 6px 12px;
  font-size: 15px;
  font-weight: 600;
  border: 2px solid var(--color-primary);
  border-radius: 6px;
  outline: none;
  text-align: center;
  user-select: text;
  -webkit-user-select: text;
}

.student-number-input::-webkit-inner-spin-button,
.student-number-input::-webkit-outer-spin-button {
  opacity: 1;
}

.student-name-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.student-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
  min-height: 28px;
  display: flex;
  align-items: center;
}

.student-name:hover {
  background: #f0f0f0;
}

.student-name.empty {
  color: #999;
  font-style: italic;
}

.student-name-input {
  padding: 4px 8px;
  font-size: 16px;
  font-weight: 500;
  border: 2px solid var(--color-primary);
  border-radius: 4px;
  outline: none;
  user-select: text;
  -webkit-user-select: text;
}

.student-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: flex-start;
}

.student-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  color: white;
  font-size: 12px;
}

.remove-tag-btn {
  background: rgba(255, 255, 255, 0.3);
  border: none;
  color: white;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  transition: background 0.2s;
}

.remove-tag-btn:hover {
  background: rgba(255, 255, 255, 0.5);
}

.add-tag-to-student-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #e0e0e0;
  border: none;
  cursor: pointer;
  font-size: 16px;
  line-height: 0;
  color: #666;
  transition: all 0.2s;
  padding: 0;
}

.add-tag-to-student-btn:hover {
  background: var(--color-primary);
  color: white;
}

.student-actions {
  margin-left: 12px;
}

.delete-student-btn {
  padding: 7px 14px;
  background: var(--color-danger);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(244, 67, 54, 0.2);
}

.delete-student-btn:hover {
  background: var(--color-danger-hover);
  box-shadow: 0 4px 8px rgba(244, 67, 54, 0.3);
  transform: translateY(-1px);
}

.delete-student-btn:active {
  transform: translateY(0);
}

.delete-student-btn.confirming {
  background: #FF9800 !important;
  animation: pulse 0.8s ease-in-out infinite;
  box-shadow: 0 0 0 3px rgba(255, 152, 0, 0.2);
}

@media (max-width: 1366px) and (min-width: 1025px), (max-height: 820px) and (min-width: 1025px) {
  .student-item {
    padding: 10px 12px;
    margin-bottom: 8px;
  }

  .student-info {
    gap: 8px;
  }

  .student-number {
    min-width: 52px;
    padding: 4px 8px;
    font-size: 13px;
  }

  .student-name {
    font-size: 14px;
    padding: 3px 6px;
    min-height: 24px;
  }

  .student-tag {
    font-size: 11px;
    padding: 3px 6px;
  }

  .delete-student-btn {
    padding: 6px 10px;
    font-size: 12px;
  }
}

@keyframes pulse {

  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 3px rgba(255, 152, 0, 0.2);
  }

  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 6px rgba(255, 152, 0, 0.3);
  }
}



/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .student-item {
    flex-direction: row;
    gap: 8px;
    padding: 6px 10px;
    margin-bottom: 6px;
    align-items: center;
  }

  .student-info {
    width: auto;
    flex: 1;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .student-number-section {
    width: auto;
    flex-shrink: 0;
  }

  .student-number {
    min-height: 28px;
    padding: 4px 8px;
    font-size: 13px;
    min-width: 40px;
  }

  .student-number-input {
    min-height: 32px;
    font-size: 14px;
    width: 60px;
  }

  .student-name-section {
    width: auto;
    flex: 1 1 auto;
    min-width: 0;
  }

  .student-name {
    min-height: 28px;
    font-size: 14px;
    padding: 4px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .student-name-input {
    min-height: 32px;
    font-size: 14px;
  }

  /* 移动端保留标签编辑能力 */
  .student-tags {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
    flex: 0 1 var(--mobile-tags-flex-basis);
    min-width: 90px;
    max-width: none;
    position: relative;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .student-tags::after {
    content: '';
    position: sticky;
    right: 0;
    width: 16px;
    flex: 0 0 16px;
    align-self: stretch;
    /* 渐变需与卡片背景一致，便于表达“可横向滚动”的边缘提示 */
    background: linear-gradient(to left, var(--student-item-bg), rgba(var(--color-surface-rgb), 0));
    border-left: 1px solid var(--scroll-cue-divider);
    pointer-events: none;
  }

  .student-tag {
    flex-shrink: 0;
    font-size: 11px;
    padding: 3px 6px;
  }

  .remove-tag-btn {
    width: 16px;
    height: 16px;
    font-size: 11px;
    position: relative;
  }

  .remove-tag-btn::before {
    content: '';
    position: absolute;
    inset: var(--touch-target-outset);
  }

  .add-tag-to-student-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    font-size: 14px;
    position: relative;
  }

  .add-tag-to-student-btn::before {
    content: '';
    position: absolute;
    inset: var(--touch-target-outset);
  }

  .tag-option {
    min-height: 44px;
    padding: 12px 16px;
  }

  .student-actions {
    width: auto;
    margin-left: 0;
    flex-shrink: 0;
  }

  .delete-student-btn {
    width: auto;
    padding: 6px 12px;
    min-height: 32px;
    font-size: 12px;
  }

  .student-item:hover {
    transform: none;
  }
}

@media (max-width: 480px) {
  .student-number {
    font-size: 14px;
    padding: 5px 10px;
  }

  .student-name {
    font-size: 15px;
  }

  .student-tag {
    font-size: 11px;
    padding: 3px 7px;
  }
}

/* 拖拽样式 */
.student-item[draggable="true"] {
  cursor: grab;
  -webkit-user-drag: element;
}

.student-item[draggable="true"]:active {
  cursor: grabbing;
}

.student-item.dragging {
  opacity: 0.35;
  transform: scale(0.95);
  border-style: dashed;
  border-color: #90a4ae;
  transition: opacity 0.25s ease, transform 0.25s ease;
}
</style>
