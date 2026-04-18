<template>
  <div v-if="visible" class="dialog-overlay" @mousedown.self="close">
    <div class="dialog">
      <h3>标签设置</h3>
      
      <div class="global-setting">
        <label class="checkbox-label">
          <input type="checkbox" v-model="localShowTagsInSeatChart" />
          <span class="checkbox-text">在座位表中显示标签</span>
        </label>
        <div class="display-mode-section" :class="{ disabled: !localShowTagsInSeatChart }">
          <label class="mode-label">显示模式:</label>
          <div class="mode-options">
            <label class="mode-option" :class="{ active: localTagDisplayMode === 'dot' }">
              <input type="radio" v-model="localTagDisplayMode" value="dot" :disabled="!localShowTagsInSeatChart" />
              <span class="mode-icon dot-icon"></span>
              <span class="mode-text">颜色点</span>
            </label>
            <label class="mode-option" :class="{ active: localTagDisplayMode === 'corner' }">
              <input type="radio" v-model="localTagDisplayMode" value="corner" :disabled="!localShowTagsInSeatChart" />
              <span class="mode-icon corner-icon"></span>
              <span class="mode-text">右上角文字</span>
            </label>
            <label class="mode-option" :class="{ active: localTagDisplayMode === 'bottom' }">
              <input type="radio" v-model="localTagDisplayMode" value="bottom" :disabled="!localShowTagsInSeatChart" />
              <span class="mode-icon bottom-icon"></span>
              <span class="mode-text">座位下部文字</span>
            </label>
          </div>
        </div>
      </div>
      
      <div class="tags-section">
        <div class="tags-header">
          <h4>标签列表</h4>
          <button class="add-tag-btn" @click="showAddDialog">
            <Plus :size="14" stroke-width="2.5" />
            新建标签
          </button>
        </div>
        <div class="tag-list">
          <div v-if="tags.length === 0" class="empty-hint">暂无标签</div>
          <div v-for="tag in tags" :key="tag.id" class="tag-item" :style="{ '--tag-color': tag.color }">
            <span class="tag-color-bar" :style="{ background: tag.color }"></span>
            <span class="tag-name">{{ tag.name }}</span>
            <span class="tag-count">{{ getTagStudentCount(tag.id) }}人</span>
            <div class="tag-options">
              <label class="show-option-label">
                <input type="checkbox" v-model="tag.showInSeatChart" @change="updateTag(tag)" />
                <span>显示</span>
              </label>
              <button class="tag-action-btn edit" @click="editTagHandler(tag)" title="编辑">
                <Pencil :size="11" stroke-width="2" />
              </button>
              <button class="tag-action-btn delete" :class="{ confirming: isDeletingTag(tag.id) }"
                @click="deleteTagHandler(tag.id, tag.name)"
                :title="isDeletingTag(tag.id) ? '再次点击确认' : '删除'">
                <X :size="12" stroke-width="2.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="dialog-actions">
        <button class="btn-cancel" @click="close" @keyup.enter="close">关闭</button>
      </div>
    </div>
    
    <!-- 添加/编辑标签子对话框 -->
    <div v-if="tagDialogVisible" class="dialog-overlay" @mousedown.self="closeTagDialog">
      <div class="dialog small-dialog">
        <h3>{{ isEditing ? '编辑标签' : '新建标签' }}</h3>
        <div class="form-group">
          <label>标签名称:</label>
          <input v-model="currentTag.name" type="text" placeholder="请输入标签名称" @keyup.enter="saveTag"
            ref="nameInputRef" />
        </div>
        <div class="form-group">
          <label>标签颜色:</label>
          <div class="color-picker">
            <input v-model="currentTag.color" type="color" />
            <span class="color-value">{{ currentTag.color }}</span>
          </div>
        </div>
        <TagStudentSelector
          v-model="selectedStudentIds"
          :students="students"
        />
        <div class="dialog-actions">
          <button class="btn-cancel" @click="closeTagDialog" @keyup.enter="closeTagDialog">取消</button>
          <button class="btn-confirm" @click="saveTag" @keyup.enter="saveTag">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { Pencil, X, Plus } from 'lucide-vue-next'
import TagStudentSelector from './TagStudentSelector.vue'
import { getNextColor } from '@/constants/tagColors'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useLogger } from '@/composables/useLogger'
import { useTagData } from '@/composables/useTagData'
import { useStudentData } from '@/composables/useStudentData'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible'])

const { tags, showTagsInSeatChart, tagDisplayMode, addTag, editTag, deleteTag, setShowTagsInSeatChart, setTagDisplayMode } = useTagData()
const { students, addTagToStudents, removeTagFromStudent, removeTagFromStudents } = useStudentData()
const { requestConfirm, isPending } = useConfirmAction()
const { warning, info, success } = useLogger()

const getTagStudentCount = (tagId) => {
  return students.value.filter(s => s.tags.includes(tagId)).length
}

const localShowTagsInSeatChart = ref(true)
const localTagDisplayMode = ref('dot')
const tagDialogVisible = ref(false)
const isEditing = ref(false)
const currentTag = ref({ id: null, name: '', color: '#23587b' })
const nameInputRef = ref(null)
const selectedStudentIds = ref([])

watch(() => props.visible, (val) => {
  if (val) {
    localShowTagsInSeatChart.value = showTagsInSeatChart.value
    localTagDisplayMode.value = tagDisplayMode.value
  }
})

watch(localShowTagsInSeatChart, (val) => {
  setShowTagsInSeatChart(val)
})

watch(localTagDisplayMode, (val) => {
  setTagDisplayMode(val)
})

const close = () => {
  emit('update:visible', false)
}

const showAddDialog = () => {
  isEditing.value = false
  const nextColor = getNextColor(tags.length)
  currentTag.value = { id: null, name: '', color: nextColor }
  selectedStudentIds.value = []
  tagDialogVisible.value = true
  nextTick(() => {
    nameInputRef.value?.focus()
  })
}

const editTagHandler = (tag) => {
  isEditing.value = true
  currentTag.value = { ...tag }
  selectedStudentIds.value = students.value
    .filter(s => s.tags.includes(tag.id))
    .map(s => s.id)
  tagDialogVisible.value = true
  nextTick(() => {
    nameInputRef.value?.focus()
  })
}

const closeTagDialog = () => {
  tagDialogVisible.value = false
  currentTag.value = { id: null, name: '', color: '#23587b' }
  selectedStudentIds.value = []
}

const saveTag = () => {
  if (!currentTag.value.name.trim()) {
    warning('请输入标签名称')
    return
  }

  if (isEditing.value) {
    editTag(currentTag.value.id, {
      name: currentTag.value.name,
      color: currentTag.value.color,
      showInSeatChart: currentTag.value.showInSeatChart
    })

    const newStudentIds = [...selectedStudentIds.value]
    const oldStudentIds = students.value
      .filter(s => s.tags.includes(currentTag.value.id))
      .map(s => s.id)

    const addedIds = newStudentIds.filter(id => !oldStudentIds.includes(id))
    const removedIds = oldStudentIds.filter(id => !newStudentIds.includes(id))

    if (addedIds.length > 0) {
      addTagToStudents(currentTag.value.id, addedIds)
    }
    removedIds.forEach(studentId => {
      removeTagFromStudent(currentTag.value.id, studentId)
    })
  } else {
    const newTagId = addTag({
      name: currentTag.value.name,
      color: currentTag.value.color,
      showInSeatChart: true
    })
    if (selectedStudentIds.value.length > 0) {
      addTagToStudents(newTagId, selectedStudentIds.value)
    }
  }
  closeTagDialog()
}

const updateTag = (tag) => {
  editTag(tag.id, {
    name: tag.name,
    color: tag.color,
    showInSeatChart: tag.showInSeatChart
  })
}

const getDeletingKey = (tagId) => `deleteTag-${tagId}`
const isDeletingTag = (tagId) => isPending(getDeletingKey(tagId))

const deleteTagHandler = (tagId, tagName) => {
  if (!isDeletingTag(tagId)) {
    info(`请再次点击删除按钮以确认删除标签"${tagName}"`)
  }

  requestConfirm(
    getDeletingKey(tagId),
    () => {
      removeTagFromStudents(tagId)
      deleteTag(tagId)
      success(`已成功删除标签"${tagName}"`)
    },
    `确定要删除标签"${tagName}"吗？将从所有学生中移除`
  )
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.dialog {
  background: white;
  padding: 28px;
  border-radius: 12px;
  width: 90%;
  max-width: 520px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
}

.small-dialog {
  max-width: 420px;
  max-height: 80vh;
  overflow-y: auto;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.dialog h3 {
  margin: 0 0 20px 0;
  color: #23587b;
  font-size: 20px;
  font-weight: 600;
}

.global-setting {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e8eef2;
}

.display-mode-section {
  margin-top: 16px;
  padding-left: 26px;
}

.display-mode-section.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.mode-label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-option:hover {
  background: #f0f4f8;
  border-color: #c0d0e0;
}

.mode-option.active {
  background: #e8f4f8;
  border-color: #23587b;
}

.mode-option input[type="radio"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.mode-icon {
  width: 48px;
  height: 36px;
  border-radius: 4px;
  position: relative;
  background: #f5f5f5;
  border: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mode-icon::before {
  content: '张三';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  color: #666;
  font-weight: 500;
}

.bottom-icon::before {
  top: 40%;
}

.dot-icon::after {
  content: '';
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 4px;
  display: flex;
  gap: 2px;
  justify-content: center;
}

.dot-icon::after {
  background:
    radial-gradient(circle, #e74c3c 1.5px, transparent 1.5px) 0 0,
    radial-gradient(circle, #3498db 1.5px, transparent 1.5px) 6px 0,
    radial-gradient(circle, #f39c12 1.5px, transparent 1.5px) 12px 0;
  background-size: 4px 4px, 4px 4px, 4px 4px;
  background-repeat: no-repeat;
}

.corner-icon::after {
  content: 'A';
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  background: #e74c3c;
  padding: 1px 4px;
  border-radius: 2px;
  line-height: 1.2;
}

.bottom-icon::after {
  content: 'A';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 8px;
  font-weight: 700;
  color: #fff;
  background: #e74c3c;
  padding: 1px 5px;
  border-radius: 2px;
  line-height: 1.2;
}

.mode-text {
  font-size: 13px;
  color: #333;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.tags-section {
  margin-bottom: 20px;
}

.tags-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tags-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #555;
}

.add-tag-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #f0f7f0;
  color: #4CAF50;
  border: 1px solid #4CAF50;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.add-tag-btn:hover {
  background: #4CAF50;
  color: white;
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.empty-hint {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 20px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 0;
  background: color-mix(in srgb, var(--tag-color) 12%, #fff);
  border: 1px solid color-mix(in srgb, var(--tag-color) 30%, transparent);
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.15s ease;
  overflow: hidden;
  height: 36px;
  line-height: 36px;
}

.tag-item:hover {
  background: color-mix(in srgb, var(--tag-color) 20%, #fff);
  border-color: color-mix(in srgb, var(--tag-color) 50%, transparent);
  box-shadow: 0 1px 4px color-mix(in srgb, var(--tag-color) 20%, transparent);
}

.tag-color-bar {
  width: 4px;
  height: 100%;
  flex-shrink: 0;
}

.tag-name {
  color: color-mix(in srgb, var(--tag-color) 80%, #1a1a1a);
  font-weight: 600;
  font-size: 13px;
  padding: 0 10px;
  white-space: nowrap;
  letter-spacing: 0.3px;
  flex: 1;
}

.tag-count {
  color: color-mix(in srgb, var(--tag-color) 85%, #1a1a1a);
  font-size: 12px;
  font-weight: 700;
  padding: 0 7px;
  border-radius: 12px;
  margin-right: 8px;
  min-width: 20px;
  text-align: center;
}

.tag-options {
  display: flex;
  align-items: center;
  gap: 0;
  height: 100%;
  border-left: 1px solid color-mix(in srgb, var(--tag-color) 20%, transparent);
}

.show-option-label {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
}

.show-option-label input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.tag-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 100%;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s ease;
  color: color-mix(in srgb, var(--tag-color) 60%, #666);
  line-height: 1;
}

.tag-action-btn.edit {
  font-size: 13px;
  border-right: 1px solid color-mix(in srgb, var(--tag-color) 15%, transparent);
}

.tag-action-btn:hover {
  background: color-mix(in srgb, var(--tag-color) 25%, transparent);
  color: color-mix(in srgb, var(--tag-color) 90%, #000);
}

.tag-action-btn.delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

.tag-action-btn.delete.confirming {
  background: #dc2626 !important;
  color: white !important;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 10px;
  color: #555;
  font-size: 14px;
  font-weight: 500;
}

.form-group input[type="text"] {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

.form-group input[type="text"]:focus {
  outline: none;
  border-color: #23587b;
}

.color-picker {
  display: flex;
  align-items: center;
  gap: 14px;
}

.color-picker input[type="color"] {
  width: 70px;
  height: 40px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.3s;
}

.color-picker input[type="color"]:hover {
  border-color: #23587b;
}

.color-value {
  color: #666;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: 500;
  text-transform: uppercase;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.btn-cancel,
.btn-confirm {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-cancel {
  background: #e0e0e0;
  color: #333;
}

.btn-cancel:hover {
  background: #d0d0d0;
}

.btn-confirm {
  background: #23587b;
  color: white;
  box-shadow: 0 2px 6px rgba(35, 88, 123, 0.2);
}

.btn-confirm:hover {
  background: #1a4460;
  box-shadow: 0 4px 10px rgba(35, 88, 123, 0.3);
  transform: translateY(-1px);
}

.btn-confirm:active {
  transform: translateY(0);
}

.tag-list::-webkit-scrollbar {
  width: 6px;
}

.tag-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.tag-list::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.tag-list::-webkit-scrollbar-thumb:hover {
  background: #999;
}

@media (max-width: 768px) {
  .dialog {
    padding: 20px;
    max-width: 90%;
  }

  .dialog h3 {
    font-size: 18px;
    margin-bottom: 18px;
  }

  .dialog-actions {
    margin-top: 20px;
  }
}

@media (max-width: 480px) {
  .dialog {
    padding: 16px;
    width: 95%;
  }

  .dialog h3 {
    font-size: 16px;
  }

  .btn-cancel,
  .btn-confirm {
    padding: 10px 18px;
    font-size: 13px;
  }

  .tag-item {
    height: 32px;
    line-height: 32px;
  }

  .tag-name {
    font-size: 12px;
    padding: 0 8px;
  }

  .tag-action-btn {
    width: 28px;
  }

  .show-option-label {
    padding: 0 6px;
    font-size: 11px;
  }
}
</style>
