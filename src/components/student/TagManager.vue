<template>
  <div class="tag-manager">
    <div class="tag-list">
      <EmptyState v-if="tags.length === 0" type="tag" message="暂无标签" hint="点击 + 添加标签" />
      <div v-for="tag in tags" :key="tag.id" class="tag-item" :style="{ '--tag-color': tag.color }">
        <span class="tag-color-bar" :style="{ background: tag.color }"></span>
        <span class="tag-name">{{ tag.name }}</span>
        <span class="tag-count">{{ getTagStudentCount(tag.id) }}人</span>
        <div class="tag-actions">
          <button class="tag-action-btn edit" @click="editTagHandler(tag)" title="编辑">
            <Pencil :size="11" stroke-width="2" />
          </button>
          <button class="tag-action-btn delete" :class="{ confirming: isDeletingTag(tag.id).value }"
            @click="deleteTagHandler(tag.id, tag.name)"
            :title="isDeletingTag(tag.id).value ? '再次点击确认' : '删除'">
            <X :size="12" stroke-width="2.5" />
          </button>
        </div>
      </div>
      <button class="add-tag-btn" @click="showAddDialog" title="新建标签">
        <Plus :size="14" stroke-width="2.5" />
      </button>
    </div>

    <!-- 添加/编辑标签对话框 -->
    <div v-if="dialogVisible" class="dialog-overlay" @mousedown.self="closeDialog">
      <div class="dialog">
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
          <button class="btn-cancel" @click="closeDialog">取消</button>
          <button class="btn-confirm" @click="saveTag">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, computed } from 'vue'
import { Pencil, X, Plus } from 'lucide-vue-next'
import EmptyState from '../ui/EmptyState.vue'
import TagStudentSelector from './TagStudentSelector.vue'
import { getNextColor } from '@/constants/tagColors'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useLogger } from '@/composables/useLogger'
import { useStudentData } from '@/composables/useStudentData'

const props = defineProps({
  tags: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['add-tag', 'edit-tag', 'delete-tag', 'assign-tag-students'])

const { requestConfirm, isConfirming } = useConfirmAction()
const { warning } = useLogger()
const { students } = useStudentData()

const getTagStudentCount = (tagId) => {
  return students.value.filter(s => s.tags.includes(tagId)).length
}

const dialogVisible = ref(false)
const isEditing = ref(false)
const currentTag = ref({ id: null, name: '', color: '#23587b' })
const nameInputRef = ref(null)
const selectedStudentIds = ref([])

const showAddDialog = () => {
  isEditing.value = false
  const nextColor = getNextColor(props.tags.length)
  currentTag.value = { id: null, name: '', color: nextColor }
  selectedStudentIds.value = []
  dialogVisible.value = true

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
  dialogVisible.value = true

  nextTick(() => {
    nameInputRef.value?.focus()
  })
}

const closeDialog = () => {
  dialogVisible.value = false
  currentTag.value = { id: null, name: '', color: '#23587b' }
  selectedStudentIds.value = []
}

const saveTag = () => {
  if (!currentTag.value.name.trim()) {
    alert('请输入标签名称')
    return
  }

  if (isEditing.value) {
    emit('edit-tag', currentTag.value.id, {
      name: currentTag.value.name,
      color: currentTag.value.color,
      studentIds: [...selectedStudentIds.value]
    })
  } else {
    emit('add-tag', {
      name: currentTag.value.name,
      color: currentTag.value.color,
      studentIds: [...selectedStudentIds.value]
    })
  }
  closeDialog()
}

// 删除标签确认状态
const getDeletingKey = (tagId) => `deleteTag-${tagId}`
const isDeletingTag = (tagId) => isConfirming(getDeletingKey(tagId))

const deleteTagHandler = (tagId, tagName) => {
  const confirmed = requestConfirm(
    getDeletingKey(tagId),
    () => emit('delete-tag', tagId),
    `确定要删除标签"${tagName}"吗？将从所有学生中移除`
  )

  if (!confirmed) {
    warning(`请再次点击删除按钮以确认删除标签"${tagName}"`)
  }
}
</script>

<style scoped>
.tag-manager {
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
}

.tag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.tag-header h4 {
  margin: 0;
  color: #23587b;
  font-size: 16px;
  font-weight: 600;
}

.add-tag-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  color: #999;
  border: 1px dashed #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.add-tag-btn:hover {
  background: #f0f7f0;
  color: #4CAF50;
  border-color: #4CAF50;
}

.add-tag-btn:active {
  transform: scale(0.95);
}

.tag-list {
  padding: 10px 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 44px;
  max-height: 140px;
  overflow-y: auto;
}

.tag-list::-webkit-scrollbar {
  height: 4px;
}

.tag-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 2px;
}

.tag-list::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 2px;
}

.tag-list::-webkit-scrollbar-thumb:hover {
  background: #888;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 0;
  background: color-mix(in srgb, var(--tag-color) 12%, #fff);
  border: 1px solid color-mix(in srgb, var(--tag-color) 30%, transparent);
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.15s ease;
  overflow: hidden;
  height: 28px;
  line-height: 28px;
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
  font-size: 12px;
  padding: 0 8px;
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.tag-count {
  color: color-mix(in srgb, var(--tag-color) 85%, #1a1a1a);
  font-size: 11px;
  font-weight: 700;
  padding: 0 6px;
  margin-right: 6px;
  min-width: 18px;
  text-align: center;
}

.tag-actions {
  display: flex;
  align-items: center;
  gap: 0;
  height: 100%;
  border-left: 1px solid color-mix(in srgb, var(--tag-color) 20%, transparent);
}

.tag-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
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
  background: #fff7ed !important;
  color: #ea580c !important;
  animation: pulse-icon 0.8s ease-in-out infinite;
}

@keyframes pulse-icon {

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.2);
  }
}

@keyframes pulse {

  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.2);
  }

  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 4px rgba(255, 152, 0, 0.3);
  }
}

/* 对话框样式 */
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
  min-width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
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
  margin: 0 0 24px 0;
  color: #23587b;
  font-size: 20px;
  font-weight: 600;
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
  margin-top: 28px;
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

@media (max-width: 1366px) and (min-width: 1025px) {
  .tag-list {
    padding: 8px 12px;
    gap: 6px;
    max-height: 112px;
  }

  .tag-item {
    height: 24px;
    line-height: 24px;
    font-size: 12px;
  }

  .tag-name {
    font-size: 11px;
    padding: 0 6px;
  }

  .tag-action-btn {
    width: 22px;
    font-size: 12px;
  }

  .add-tag-btn {
    width: 24px;
    height: 24px;
    font-size: 16px;
  }
}

/* 小高度屏幕优化 */
@media (max-height: 820px) and (min-width: 1025px) {
  .tag-list {
    padding: 7px 10px;
    gap: 5px;
    max-height: 100px;
  }

  .tag-item {
    height: 22px;
    line-height: 22px;
    font-size: 11px;
  }

  .tag-name {
    font-size: 10px;
    padding: 0 5px;
  }

  .tag-action-btn {
    width: 20px;
    font-size: 11px;
  }

  .add-tag-btn {
    width: 22px;
    height: 22px;
    font-size: 14px;
  }
}

/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .tag-manager {
    border-bottom: none;
  }

  .dialog {
    min-width: auto;
    width: 90%;
    max-width: 420px;
    padding: 20px;
  }

  .dialog h3 {
    font-size: 18px;
    margin-bottom: 18px;
  }

  .dialog-actions {
    margin-top: 20px;
  }

  .tag-list {
    padding: 6px 12px;
    min-height: 36px;
    max-height: 80px;
    gap: 6px;
  }

  .add-tag-btn {
    width: 26px;
    height: 26px;
    font-size: 16px;
  }

  .tag-item {
    height: 26px;
    line-height: 26px;
    font-size: 12px;
  }

  .tag-name {
    font-size: 11px;
    padding: 0 6px;
  }

  .tag-action-btn {
    width: 24px;
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .dialog {
    width: 95%;
    padding: 16px;
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
    height: 24px;
    line-height: 24px;
  }

  .tag-name {
    font-size: 11px;
    padding: 0 5px;
  }

  .tag-action-btn {
    width: 22px;
    font-size: 12px;
  }

  .tag-color-bar {
    width: 3px;
  }

  .tag-list {
    max-height: 100px;
    gap: 6px;
  }
}
</style>
