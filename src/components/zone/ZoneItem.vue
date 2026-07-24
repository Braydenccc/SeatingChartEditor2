<template>
  <div
    class="zone-item"
    :class="{ selected: isSelected }"
    role="listitem"
    :aria-label="`选区 ${zone.name}`"
    @click="handleSelect"
  >
    <div class="zone-header">
      <div class="zone-color-indicator" :style="{ background: zoneColor }"></div>
      <NInput
        v-if="isEditingName"
        v-model:value="editedName"
        class="zone-name-input"
        size="small"
        :input-props="{ 'aria-label': `修改选区 ${zone.name} 的名称` }"
        @blur="saveName"
        @keyup.enter="saveName"
        @click.stop
        ref="nameInput"
      />
      <span
        v-else
        class="zone-name"
        @click.stop
        @dblclick.stop="startEditName"
      >
        {{ zone.name }}
      </span>
      <NButton
        v-if="!isEditingName"
        class="rename-zone-btn"
        size="tiny"
        quaternary
        circle
        :aria-label="`重命名选区 ${zone.name}`"
        @click.stop="startEditName"
      >
        <Pencil :size="12" stroke-width="2.2" />
      </NButton>
      <NCheckbox
        class="zone-visible-checkbox"
        :checked="zone.visible"
        :aria-label="`${zone.name} 显示状态`"
        @click.stop
        @update:checked="toggleVisible"
      >显示</NCheckbox>
    </div>

    <div class="zone-body">
      <div class="zone-tags">
        <span
          v-for="tagId in zone.tagIds"
          :key="tagId"
          class="zone-tag"
          :style="{ background: getTagColor(tagId) }"
        >
          <span class="zone-tag-name">{{ getTagName(tagId) }}</span>
          <NButton
            class="remove-tag-btn"
            size="tiny"
            text
            circle
            :aria-label="`从 ${zone.name} 移除标签 ${getTagName(tagId)}`"
            @click.stop="removeTag(tagId)"
          >
            <X :size="10" stroke-width="2.5" />
          </NButton>
        </span>
        <NPopover
          v-model:show="showTagPicker"
          trigger="click"
          placement="bottom-start"
          :show-arrow="false"
          :width="200"
        >
          <template #trigger>
            <NButton size="tiny" quaternary circle type="primary" title="添加标签" :aria-label="`为 ${zone.name} 添加标签`" @click.stop>
              <Plus :size="12" stroke-width="2.5" />
            </NButton>
          </template>
          <NScrollbar class="tag-picker-scroll">
            <div v-if="availableTagsForZone.length > 0" class="tag-picker-options">
              <NButton
                v-for="tag in availableTagsForZone"
                :key="tag.id"
                class="tag-option"
                text
                block
                @click.stop="addTagToZone(tag.id)"
              >
                <span class="tag-option-content">
                  <span class="tag-dot" :style="{ background: tag.color }"></span>
                  <span>{{ tag.name }}</span>
                </span>
              </NButton>
            </div>
            <NEmpty v-else size="small" description="暂无可添加的标签" />
          </NScrollbar>
        </NPopover>
      </div>

      <div class="zone-info">
        <span class="seat-count">{{ zone.seatIds.length }} 个座位</span>
      </div>
    </div>

    <div class="zone-actions">
      <NButton
        size="small"
        secondary
        block
        :type="isSelected ? 'primary' : 'default'"
        :aria-pressed="isSelected"
        :aria-label="isSelected ? `退出编辑选区 ${zone.name}` : `编辑选区 ${zone.name} 的座位`"
        @click.stop="handleSelect"
      >
        {{ isSelected ? '退出编辑' : '编辑座位' }}
      </NButton>
      <NPopconfirm positive-text="删除" negative-text="取消" @positive-click="handleDelete">
        <template #trigger><NButton size="small" type="error" secondary block @click.stop>删除</NButton></template>
        确认删除选区“{{ zone.name }}”？
      </NPopconfirm>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { NButton, NCheckbox, NEmpty, NInput, NPopover, NPopconfirm, NScrollbar } from 'naive-ui'
import { Pencil, Plus, X } from 'lucide-vue-next'
import type { Tag, Zone } from '@/types/models'

const props = withDefaults(defineProps<{
  zone: Zone
  isSelected?: boolean
  availableTags?: Tag[]
  zoneColor: string
}>(), {
  isSelected: false,
  availableTags: () => []
})

const emit = defineEmits<{
  select: [zoneId: number]
  'update-zone': [zoneId: number, updates: Partial<Zone>]
  'delete-zone': [zoneId: number]
  'add-tag': [zoneId: number, tagId: number]
  'remove-tag': [zoneId: number, tagId: number]
  'toggle-visible': [zoneId: number]
}>()

const isEditingName = ref(false)
const editedName = ref('')
const nameInput = ref<{ focus: () => void } | null>(null)
const showTagPicker = ref(false)

// 获取可添加的标签(排除已添加的)
const availableTagsForZone = computed(() => {
  return props.availableTags.filter(tag => !props.zone.tagIds.includes(tag.id))
})

const getTagName = (tagId: number) => {
  const tag = props.availableTags.find(t => t.id === tagId)
  return tag ? tag.name : ''
}

const getTagColor = (tagId: number) => {
  const tag = props.availableTags.find(t => t.id === tagId)
  return tag ? tag.color : 'var(--color-text-disabled)'
}

// 选中选区
const handleSelect = () => {
  emit('select', props.zone.id)
}

// 编辑选区名称
const startEditName = () => {
  isEditingName.value = true
  editedName.value = props.zone.name
  nextTick(() => {
    nameInput.value?.focus()
  })
}

const saveName = () => {
  if (editedName.value !== props.zone.name) {
    emit('update-zone', props.zone.id, { name: editedName.value })
  }
  isEditingName.value = false
}

// 切换可见性
const toggleVisible = () => {
  emit('toggle-visible', props.zone.id)
}


const addTagToZone = (tagId: number) => {
  emit('add-tag', props.zone.id, tagId)
  showTagPicker.value = false
}

const removeTag = (tagId: number) => {
  emit('remove-tag', props.zone.id, tagId)
}

// 删除选区
const handleDelete = () => {
  emit('delete-zone', props.zone.id)
}

</script>

<style scoped>
.zone-item {
  position: relative;
  padding: 12px;
  margin-bottom: 10px;
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.zone-item:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.zone-item.selected {
  border-color: var(--color-selection-border);
  background: var(--color-selection-bg);
  box-shadow: var(--shadow-selection-ring), var(--shadow-selection-card);
}

.zone-item.selected::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--color-selection-border);
  pointer-events: none;
}

.zone-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  min-width: 0;
}

.zone-color-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid var(--color-surface);
  box-shadow: 0 0 0 1px var(--color-text-disabled);
}

.zone-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.zone-name-input {
  flex: 1;
  min-width: 0;
}

.rename-zone-btn {
  flex-shrink: 0;
}

.zone-visible-checkbox {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.zone-body {
  margin-bottom: 8px;
}

.zone-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.zone-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  padding: 3px 8px;
  border-radius: 12px;
  color: var(--color-text-inverse);
  font-size: 11px;
  font-weight: 500;
}

.zone-tag-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-tag-btn {
  flex-shrink: 0;
  color: var(--color-text-inverse);
}

.zone-info {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.zone-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.tag-picker-scroll {
  max-height: 200px;
}

.tag-option {
  min-height: 36px;
  justify-content: flex-start;
}

.tag-option-content {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-primary);
  font-size: 13px;
}

.tag-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .zone-item {
    padding: 10px;
  }

  .rename-zone-btn {
    min-width: 44px;
    min-height: 44px;
  }

  .zone-name {
    font-size: 13px;
  }

  .zone-tag {
    font-size: 10px;
    padding: 2px 6px;
  }

  .zone-info {
    font-size: 11px;
  }

}

@media (max-width: 480px) {
  .zone-item {
    padding: 8px;
    margin-bottom: 8px;
  }

  .zone-header {
    gap: 6px;
    margin-bottom: 6px;
  }

  .zone-color-indicator {
    width: 12px;
    height: 12px;
  }

  .zone-visible-checkbox {
    font-size: 11px;
  }
}
</style>
