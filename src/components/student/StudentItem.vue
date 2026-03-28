<template>
  <div class="student-item" :class="{ selected: isSelected, dragging: isStudentDragging }" :data-student-id="student.id"
    :draggable="canDrag" @click="handleSelectStudent" @dragstart="handleDragStart" @dragend="handleDragEnd"
    @touchstart="handleTouchDragStart" @touchmove="handleTouchDragMove" @touchend="handleTouchDragEnd"
    @touchcancel="handleTouchDragCancel" @contextmenu.prevent @pointerdown="handleStudentPointerDown">
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

      <div class="student-tags">
        <span v-for="tagId in student.tags" :key="tagId" class="student-tag"
          :style="{ background: getTagColor(tagId) }">
          {{ getTagName(tagId) }}
          <button class="remove-tag-btn" @click="removeTag(tagId)">×</button>
        </span>
        <button ref="addBtnRef" class="add-tag-to-student-btn" @click.stop="toggleTagPicker">+</button>
      </div>
    </div>

    <div class="student-actions">
      <button class="delete-student-btn" :class="{ confirming: isDeleting.value }" @click="deleteHandler">
        {{ isDeleting.value ? '再次点击确认' : '删除' }}
      </button>
    </div>

    <!-- 标签选择器 (teleport 到 body 避免被父容器裁剪) -->
    <teleport to="body">
      <div v-if="showTagPicker" class="tag-picker" ref="tagPickerRef" :style="tagPickerStyle" @click.stop>
        <div v-for="tag in availableTagsForStudent" :key="tag.id" class="tag-option" @click="addTagToStudent(tag.id)">
          <span class="tag-dot" :style="{ background: tag.color }"></span>
          <span>{{ tag.name }}</span>
        </div>
        <div v-if="availableTagsForStudent.length === 0" class="no-tags">
          暂无可添加的标签
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, shallowRef } from 'vue'
import { useStudentData } from '@/composables/useStudentData'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useLogger } from '@/composables/useLogger'
import { useEditMode } from '@/composables/useEditMode'

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
const { currentMode, EditMode } = useEditMode()

// ==================== 拖拽功能 ====================
const isStudentDragging = ref(false)
let touchDragTimer = null
let touchDragActive = false
let touchPreviewEl = null
let touchMoveRafId = null
let touchStartX = 0
let touchStartY = 0
// 当前是否通过触摸交互（动态判断，解决触摸屏笔记本问题）
// 使用 shallowRef 让 canDrag computed 能追踪其变化
const lastPointerWasTouch = shallowRef(false)

// 触摸拖拽激活条件
const canTouchDrag = computed(() => currentMode.value === EditMode.NORMAL)

// HTML5 draggable 属性：触摸操作时禁用，防止幽灵图
const canDrag = computed(() => {
  if (lastPointerWasTouch.value) return false
  return canTouchDrag.value
})

// 记录指针类型，用于判断是否为触摸操作
const handleStudentPointerDown = (e) => {
  lastPointerWasTouch.value = e.pointerType === 'touch'
}

const handleDragStart = (e) => {
  if (!canDrag.value) {
    e.preventDefault()
    return
  }
  isStudentDragging.value = true
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('application/json', JSON.stringify({
    type: 'student',
    studentId: props.student.id
  }))
}

const handleDragEnd = () => {
  isStudentDragging.value = false
}

// 触摸拖拽
const handleTouchDragStart = (e) => {
  if (e.touches.length !== 1 || !canTouchDrag.value) return
  const touch = e.touches[0]
  const startX = touch.clientX
  const startY = touch.clientY
  touchStartX = startX
  touchStartY = startY

  touchDragTimer = setTimeout(() => {
    touchDragActive = true
    isStudentDragging.value = true

    touchPreviewEl = document.createElement('div')
    touchPreviewEl.className = 'touch-drag-preview'
    touchPreviewEl.textContent = props.student.name || '未命名'
    touchPreviewEl.style.cssText = `
      position: fixed;
      left: ${startX - 40}px;
      top: ${startY - 25}px;
      min-width: 80px;
      padding: 8px 16px;
      background: rgba(35, 88, 123, 0.92);
      color: white;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      pointer-events: none;
      z-index: 9999;
      box-shadow: 0 6px 20px rgba(0,0,0,0.25);
      transform: scale(0.8);
      opacity: 0;
      will-change: transform, left, top;
      transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), opacity 0.15s ease;
    `
    document.body.appendChild(touchPreviewEl)
    // 触发入场动画
    requestAnimationFrame(() => {
      if (touchPreviewEl) {
        touchPreviewEl.style.transform = 'scale(1)'
        touchPreviewEl.style.opacity = '1'
      }
    })
    if (navigator.vibrate) navigator.vibrate(30)
  }, 300)
}

const handleTouchDragMove = (e) => {
  if (e.touches.length !== 1) return

  if (!touchDragActive) {
    // 小幅抖动（≤ 8px）允许长按继续激活拖拽，大幅移动才视为滑动并取消定时器
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartX
    const dy = touch.clientY - touchStartY
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      if (touchDragTimer) { clearTimeout(touchDragTimer); touchDragTimer = null }
    }
    return
  }
  e.preventDefault()
  const touch = e.touches[0]
  const cx = touch.clientX
  const cy = touch.clientY

  // rAF 节流：每帧最多更新一次
  if (touchMoveRafId) cancelAnimationFrame(touchMoveRafId)
  touchMoveRafId = requestAnimationFrame(() => {
    touchMoveRafId = null
    if (touchPreviewEl) {
      touchPreviewEl.style.transition = 'none'
      touchPreviewEl.style.left = `${cx - 40}px`
      touchPreviewEl.style.top = `${cy - 25}px`
    }
    // 高亮目标座位
    const el = document.elementFromPoint(cx, cy)
    document.querySelectorAll('.seat-item.drag-over').forEach(s => s.classList.remove('drag-over'))
    if (el) {
      let cur = el
      while (cur && !cur.dataset?.seatId) cur = cur.parentElement
      if (cur) cur.classList.add('drag-over')
    }
  })
}

// 公共清理：取消定时器、移除预览、重置所有状态
const cleanupStudentTouchDrag = () => {
  if (touchDragTimer) { clearTimeout(touchDragTimer); touchDragTimer = null }
  if (touchMoveRafId) { cancelAnimationFrame(touchMoveRafId); touchMoveRafId = null }
  if (touchPreviewEl) { touchPreviewEl.remove(); touchPreviewEl = null }
  document.querySelectorAll('.seat-item.drag-over').forEach(s => s.classList.remove('drag-over'))
  isStudentDragging.value = false
  touchDragActive = false
}

// touchcancel：OS 中断触摸（长按弹出系统菜单等），直接清理
const handleTouchDragCancel = () => {
  cleanupStudentTouchDrag()
}

const handleTouchDragEnd = (e) => {
  // 无论如何先清理定时器和视觉状态，防止残留
  if (touchDragTimer) { clearTimeout(touchDragTimer); touchDragTimer = null }
  if (touchMoveRafId) { cancelAnimationFrame(touchMoveRafId); touchMoveRafId = null }
  isStudentDragging.value = false

  const wasActive = touchDragActive
  if (!wasActive) return

  const touch = e.changedTouches[0]
  if (touchPreviewEl) touchPreviewEl.style.display = 'none'
  const targetEl = document.elementFromPoint(touch.clientX, touch.clientY)
  if (touchPreviewEl) { touchPreviewEl.remove(); touchPreviewEl = null }

  document.querySelectorAll('.seat-item.drag-over').forEach(s => s.classList.remove('drag-over'))
  isStudentDragging.value = false
  touchDragActive = false

  if (!targetEl) return
  let cur = targetEl
  while (cur && !cur.dataset?.seatId) cur = cur.parentElement
  if (!cur) return

  const event = new CustomEvent('touch-student-drop', {
    bubbles: true,
    detail: { studentId: props.student.id, targetSeatId: cur.dataset.seatId }
  })
  cur.dispatchEvent(event)
}

const isEditingName = ref(false)
const isEditingNumber = ref(false)
const editName = ref('')
const editStudentNumber = ref(null)
const nameInput = ref(null)
const numberInput = ref(null)
const showTagPicker = ref(false)
const tagPickerRef = ref(null)
const addBtnRef = ref(null)
const tagPickerStyle = ref({})

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

// 点击外部关闭标签选择器
const handleClickOutside = (event) => {
  if (!showTagPicker.value) return

  const clickedInsidePicker = tagPickerRef.value && tagPickerRef.value.contains(event.target)
  const clickedAddBtn = event.target.closest && event.target.closest('.add-tag-to-student-btn')

  if (!clickedInsidePicker && !clickedAddBtn) {
    showTagPicker.value = false
    window.removeEventListener('resize', onWindowChange)
    window.removeEventListener('scroll', onWindowChange, true)
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('scroll', onWindowChange, true)
})

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

const computeTagPickerPosition = () => {
  const btn = addBtnRef.value
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  const width = 220
  const maxHeight = 240
  const margin = 8

  // 水平方向：防止溢出右侧
  let left = rect.left
  if (left + width + margin > window.innerWidth) {
    left = Math.max(margin, window.innerWidth - width - margin)
  }
  if (left < margin) left = margin

  // 垂直方向：优先显示在按钮下方，空间不足时改为上方
  const spaceBelow = window.innerHeight - rect.bottom - margin
  const spaceAbove = rect.top - margin
  let top
  if (spaceBelow >= Math.min(maxHeight, 80) || spaceBelow >= spaceAbove) {
    top = rect.bottom + 6
  } else {
    // 在按钮上方显示
    top = rect.top - Math.min(maxHeight, spaceAbove) - 6
  }

  tagPickerStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${width}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: 9999
  }
}

const onWindowChange = () => {
  computeTagPickerPosition()
}

const toggleTagPicker = async () => {
  showTagPicker.value = !showTagPicker.value
  if (showTagPicker.value) {
    await nextTick()
    computeTagPickerPosition()
    window.addEventListener('resize', onWindowChange)
    window.addEventListener('scroll', onWindowChange, true)
  } else {
    window.removeEventListener('resize', onWindowChange)
    window.removeEventListener('scroll', onWindowChange, true)
  }
}

const addTagToStudent = (tagId) => {
  const newTags = [...props.student.tags, tagId]
  emit('update-student', props.student.id, {
    name: props.student.name,
    studentNumber: props.student.studentNumber,
    tags: newTags
  })
  // 关闭 picker 并清理监听器
  showTagPicker.value = false
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('scroll', onWindowChange, true)
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
  contain: layout style;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  margin-bottom: 10px;
  background: white;
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
  background: #e8f4f8;
  border: 2px solid #23587b;
  box-shadow: 0 4px 16px rgba(35, 88, 123, 0.25);
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
  color: #23587b;
  background: #e8f4f8;
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
  border: 2px solid #23587b;
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
  border: 2px solid #23587b;
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
  background: #23587b;
  color: white;
}

.student-actions {
  margin-left: 12px;
}

.delete-student-btn {
  padding: 7px 14px;
  background: #f44336;
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
  background: #d32f2f;
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

.tag-picker {
  /* position/top/left/zIndex 由 JS tagPickerStyle 动态设置（fixed 定位） */
  background: white;
  border: 2px solid #23587b;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  min-width: 220px;
  overflow-y: auto;
}

.tag-picker::-webkit-scrollbar {
  width: 6px;
}

.tag-picker::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.tag-picker::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 3px;
}

.tag-picker::-webkit-scrollbar-thumb:hover {
  background: #888;
}

.tag-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
  color: #333;
  font-size: 15px;
  font-weight: 500;
}

.tag-option:hover {
  background: #e8f4f8;
}

.tag-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}

.no-tags {
  padding: 16px;
  text-align: center;
  color: #999;
  font-size: 14px;
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
    flex: 1;
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

  /* 移动端隐藏标签以节省空间 */
  .student-tags {
    display: none;
  }

  .add-tag-to-student-btn {
    display: none;
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
