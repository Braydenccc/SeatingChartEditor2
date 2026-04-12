<template>
  <div
    class="zone-item"
    :class="{ selected: isSelected }"
    @click="handleSelect"
  >
    <div class="zone-header">
      <div class="zone-color-indicator" :style="{ background: zoneColor }"></div>
      <input
        v-if="isEditingName"
        v-model="editedName"
        type="text"
        class="zone-name-input"
        @blur="saveName"
        @keyup.enter="saveName"
        @click.stop
        ref="nameInput"
      />
      <span
        v-else
        class="zone-name"
        @dblclick="startEditName"
      >
        {{ zone.name }}
      </span>
      <label class="zone-visible-checkbox" @click.stop>
        <input
          type="checkbox"
          :checked="zone.visible"
          @change="toggleVisible"
        />
        <span>显示</span>
      </label>
    </div>

    <div class="zone-body">
      <div class="zone-tags">
        <span
          v-for="tagId in zone.tagIds"
          :key="tagId"
          class="zone-tag"
          :style="{ background: getTagColor(tagId) }"
        >
          {{ getTagName(tagId) }}
          <button class="remove-tag-btn" @click.stop="removeTag(tagId)">
            <X :size="10" stroke-width="2.5" />
          </button>
        </span>
        <button ref="addBtnRef" class="add-tag-btn" @click.stop="toggleTagPicker">
          <Plus :size="12" stroke-width="2.5" />
        </button>
      </div>

      <div class="zone-info">
        <span class="seat-count">{{ zone.seatIds.length }} 个座位</span>
      </div>
    </div>

    <button class="delete-zone-btn" :class="{ confirming: isDeletingZone.value }" @click.stop="handleDelete">
      {{ isDeletingZone.value ? '再次点击确认' : '删除' }}
    </button>

    <!-- 标签选择器 (teleport 到 body 避免被父容器裁剪) -->
    <teleport to="body">
      <div v-if="showTagPicker" class="tag-picker" ref="tagPickerRef" :style="tagPickerStyle" @click.stop>
        <div
          v-for="tag in availableTagsForZone"
          :key="tag.id"
          class="tag-option"
          @click="addTagToZone(tag.id)"
        >
          <span class="tag-dot" :style="{ background: tag.color }"></span>
          <span>{{ tag.name }}</span>
        </div>
        <div v-if="availableTagsForZone.length === 0" class="no-tags">
          暂无可添加的标签
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { X, Plus } from 'lucide-vue-next'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useLogger } from '@/composables/useLogger'

const props = defineProps({
  zone: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  availableTags: {
    type: Array,
    required: false,
    default: () => []
  },
  zoneColor: {
    type: String,
    required: true
  }
})

const emit = defineEmits([
  'select',
  'update-zone',
  'delete-zone',
  'add-tag',
  'remove-tag',
  'toggle-visible'
])

const { requestConfirm, isConfirming } = useConfirmAction()
const { warning, info, success } = useLogger()

const isEditingName = ref(false)
const editedName = ref('')
const nameInput = ref(null)
const showTagPicker = ref(false)
const tagPickerRef = ref(null)
const addBtnRef = ref(null)
const tagPickerStyle = ref({})

// 获取可添加的标签(排除已添加的)
const availableTagsForZone = computed(() => {
  return props.availableTags.filter(tag => !props.zone.tagIds.includes(tag.id))
})

const getTagName = (tagId) => {
  const tag = props.availableTags.find(t => t.id === tagId)
  return tag ? tag.name : ''
}

const getTagColor = (tagId) => {
  const tag = props.availableTags.find(t => t.id === tagId)
  return tag ? tag.color : '#999'
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


// 标签管理
const computeTagPickerPosition = () => {
  const btn = addBtnRef.value
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  const width = 200
  const margin = 8
  let left = rect.left + window.scrollX
  if (left + width + margin > window.innerWidth) {
    left = Math.max(margin, window.innerWidth - width - margin)
  }
  if (left < margin) left = margin
  tagPickerStyle.value = {
    position: 'absolute',
    top: `${rect.bottom + window.scrollY + 4}px`,
    left: `${left}px`,
    minWidth: `${width}px`,
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

const addTagToZone = (tagId) => {
  emit('add-tag', props.zone.id, tagId)
  showTagPicker.value = false
}

const removeTag = (tagId) => {
  emit('remove-tag', props.zone.id, tagId)
}

// 删除选区
const deleteKey = computed(() => `deleteZone-${props.zone.id}`)
const isDeletingZone = isConfirming(deleteKey.value)

const handleDelete = () => {
  if (!isDeletingZone.value) {
    info(`请再次点击删除按钮以确认删除选区"${props.zone.name}"`)
  }

  requestConfirm(
    deleteKey.value,
    () => {
      emit('delete-zone', props.zone.id)
      success(`已成功删除选区"${props.zone.name}"`)
    },
    `确定要删除选区"${props.zone.name}"吗？`
  )
}

// 点击外部关闭标签选择器
const handleClickOutside = (event) => {
  if (!showTagPicker.value) return

  const clickedInsidePicker = tagPickerRef.value && tagPickerRef.value.contains(event.target)
  const clickedAddBtn = event.target.closest && event.target.closest('.add-tag-btn')

  if (!clickedInsidePicker && !clickedAddBtn) {
    showTagPicker.value = false
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
</script>

<style scoped>
.zone-item {
  position: relative;
  padding: 12px;
  margin-bottom: 10px;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.zone-item:hover {
  border-color: #23587b;
  box-shadow: 0 2px 8px rgba(35, 88, 123, 0.15);
}

.zone-item.selected {
  border-color: #23587b;
  background: #e8f4f8;
  box-shadow: 0 2px 12px rgba(35, 88, 123, 0.25);
}

.zone-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.zone-color-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #ccc;
}

.zone-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.zone-name-input {
  flex: 1;
  padding: 4px 8px;
  font-size: 14px;
  font-weight: 600;
  border: 2px solid #23587b;
  border-radius: 4px;
  outline: none;
}

.zone-visible-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
}

.zone-visible-checkbox input[type="checkbox"] {
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
  padding: 3px 8px;
  border-radius: 12px;
  color: white;
  font-size: 11px;
  font-weight: 500;
}

.remove-tag-btn {
  background: rgba(255, 255, 255, 0.3);
  border: none;
  color: white;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  padding: 0;
  transition: background 0.2s;
}

.remove-tag-btn:hover {
  background: rgba(255, 255, 255, 0.5);
}

.add-tag-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #e0e0e0;
  border: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: #666;
  transition: all 0.2s;
}

.add-tag-btn:hover {
  background: #23587b;
  color: white;
}

.zone-info {
  font-size: 12px;
  color: #666;
}

.delete-zone-btn {
  width: 100%;
  padding: 6px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.delete-zone-btn:hover {
  background: #d32f2f;
}

.delete-zone-btn.confirming {
  background: #dc2626 !important;
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.2);
}

.tag-picker {
  position: absolute;
  margin-top: 4px;
  background: white;
  border: 2px solid #23587b;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
}

.tag-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 13px;
  color: #333;
}

.tag-option:hover {
  background: #e8f4f8;
}

.tag-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.no-tags {
  padding: 12px;
  text-align: center;
  color: #999;
  font-size: 12px;
}

/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .zone-item {
    padding: 10px;
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

  .delete-zone-btn {
    font-size: 11px;
    padding: 5px;
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
