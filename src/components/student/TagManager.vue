<template>
  <div class="tag-manager">
    <div class="tag-list">
      <NEmpty v-if="tags.length === 0" description="暂无标签">
        <template #extra>点击添加标签开始分类学生</template>
      </NEmpty>
      <div v-for="tag in tags" :key="tag.id" class="tag-item" :style="{ '--tag-color': tag.color }">
        <span class="tag-color-bar" :style="{ background: tag.color }"></span>
        <span class="tag-name">{{ tag.name }}</span>
        <span class="tag-count">{{ getTagStudentCount(tag.id) }}人</span>
        <div class="tag-actions">
          <NButton class="tag-action-btn" size="tiny" quaternary circle @click="editTagHandler(tag)" title="编辑">
            <Pencil :size="11" stroke-width="2" />
          </NButton>
          <NPopconfirm positive-text="删除" negative-text="取消" @positive-click="deleteTagHandler(tag.id)">
            <template #trigger>
              <NButton class="tag-action-btn" size="tiny" quaternary circle type="error" title="删除"><X :size="12" stroke-width="2.5" /></NButton>
            </template>
            删除标签“{{ tag.name }}”并从所有学生中移除？
          </NPopconfirm>
        </div>
      </div>
      <NButton class="add-tag-btn" size="tiny" quaternary circle type="primary" @click="showAddDialog" title="新建标签">
        <Plus :size="14" stroke-width="2.5" />
      </NButton>
    </div>

    <!-- 添加/编辑标签对话框 -->
    <ResponsiveOverlay :show="dialogVisible" :title="isEditing ? '编辑标签' : '新建标签'" :desktop-width="520" @update:show="value => !value && closeDialog()">
        <div class="form-group">
          <label>标签名称:</label>
          <NInput v-model:value="currentTag.name" placeholder="请输入标签名称" @keyup.enter="saveTag"
            ref="nameInputRef" />
        </div>
        <div class="form-group">
          <label>标签颜色:</label>
          <div class="color-picker">
            <NColorPicker v-model:value="currentTag.color" :show-alpha="false" />
            <span class="color-value">{{ currentTag.color }}</span>
          </div>
        </div>
        <TagStudentSelector
          v-model="selectedStudentIds"
          :students="students"
        />
        <template #footer><div class="dialog-actions">
          <NButton class="dialog-action" secondary @click="closeDialog">取消</NButton>
          <NButton class="dialog-action" type="primary" @click="saveTag">确定</NButton>
        </div></template>
    </ResponsiveOverlay>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { NButton, NColorPicker, NEmpty, NInput, NPopconfirm } from 'naive-ui'
import { Pencil, X, Plus } from 'lucide-vue-next'
import TagStudentSelector from './TagStudentSelector.vue'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { getNextColor } from '@/constants/tagColors'
import { useLogger } from '@/composables/useLogger'
import { useStudentData } from '@/composables/useStudentData'
import type { Tag } from '@/types/models'

const props = defineProps<{ tags: Tag[] }>()

const emit = defineEmits<{
  'add-tag': [tag: Pick<Tag, 'name' | 'color'> & { studentIds: number[] }]
  'edit-tag': [tagId: number, tag: Pick<Tag, 'name' | 'color'> & { studentIds: number[] }]
  'delete-tag': [tagId: number]
  'assign-tag-students': [tagId: number, studentIds: number[]]
}>()

const { warning } = useLogger()
const { students } = useStudentData()

const getTagStudentCount = (tagId: number) => {
  return students.value.filter(s => s.tags.includes(tagId)).length
}

const dialogVisible = ref(false)
const isEditing = ref(false)
const currentTag = ref<{ id: number | null; name: string; color: string }>({
  id: null,
  name: '',
  color: getNextColor(0)
})
const nameInputRef = ref<{ focus: () => void } | null>(null)
const selectedStudentIds = ref<number[]>([])

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

const editTagHandler = (tag: Tag) => {
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
  currentTag.value = { id: null, name: '', color: getNextColor(0) }
  selectedStudentIds.value = []
}

const saveTag = () => {
  if (!currentTag.value.name.trim()) {
    warning('请输入标签名称')
    return
  }

  if (isEditing.value) {
    const tagId = currentTag.value.id
    if (tagId === null) return
    emit('edit-tag', tagId, {
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

const deleteTagHandler = (tagId: number) => emit('delete-tag', tagId)
</script>

<style scoped>
.tag-manager {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.add-tag-btn {
  flex-shrink: 0;
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
  background: var(--scrollbar-track);
  border-radius: 2px;
}

.tag-list::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 2px;
}

.tag-list::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 0;
  background: color-mix(in srgb, var(--tag-color) 12%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--tag-color) 30%, transparent);
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.15s ease;
  overflow: hidden;
  height: 28px;
  line-height: 28px;
}

.tag-item:hover {
  background: color-mix(in srgb, var(--tag-color) 20%, var(--color-surface));
  border-color: color-mix(in srgb, var(--tag-color) 50%, transparent);
  box-shadow: 0 1px 4px color-mix(in srgb, var(--tag-color) 20%, transparent);
}

.tag-color-bar {
  width: 4px;
  height: 100%;
  flex-shrink: 0;
}

.tag-name {
  color: color-mix(in srgb, var(--tag-color) 80%, var(--color-text-primary));
  font-weight: 600;
  font-size: 12px;
  padding: 0 8px;
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.tag-count {
  color: color-mix(in srgb, var(--tag-color) 85%, var(--color-text-primary));
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
  flex: 0 0 auto;
}


.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 10px;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 500;
}

.color-picker {
  display: flex;
  align-items: center;
  gap: 14px;
}


.color-value {
  color: var(--color-text-secondary);
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: 500;
  text-transform: uppercase;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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

}

/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .tag-manager {
    border-bottom: none;
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

  .tag-item {
    height: 44px;
    line-height: 44px;
    font-size: 12px;
  }

  .tag-name {
    font-size: 11px;
    padding: 0 6px;
  }

  .tag-action-btn {
    min-width: 44px;
    min-height: 44px;
  }

  .add-tag-btn,
  .dialog-action {
    min-width: 44px;
    min-height: 44px;
  }
}

@media (max-width: 480px) {
  .tag-item {
    height: 24px;
    line-height: 24px;
  }

  .tag-name {
    font-size: 11px;
    padding: 0 5px;
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
