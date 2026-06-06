<template>
  <div class="zone-list-container">
    <div class="zone-list-header">
      <h4>选区列表</h4>
      <button class="add-zone-btn" @click="handleAddZone">添加选区</button>
    </div>

    <div class="zone-list-content">
      <ZoneItem
        v-for="zone in zones"
        :key="zone.id"
        :zone="zone"
        :is-selected="selectedZoneId === zone.id"
        :available-tags="tags"
        :zone-color="getZoneColor(zone.id)"
        @select="handleSelectZone"
        @update-zone="handleUpdateZone"
        @delete-zone="handleDeleteZone"
        @add-tag="handleAddTag"
        @remove-tag="handleRemoveTag"
        @toggle-visible="handleToggleVisible"
      />
      <div v-if="zones.length === 0" class="empty-zone-list">
        <p>暂无选区</p>
        <p class="hint">点击"添加选区"按钮创建新选区</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import ZoneItem from './ZoneItem.vue'
import { useZoneData } from '@/composables/useZoneData'
import { useTagData } from '@/composables/useTagData'
import { useEditMode, EditMode } from '@/composables/useEditMode'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useZoneRotation } from '@/composables/useZoneRotation'

const {
  zones,
  selectedZoneId,
  addZone,
  updateZone,
  deleteZone,
  addTagToZone,
  removeTagFromZone,
  getZoneColor,
  selectZone,
  clearZoneSelection,
  toggleZoneVisible
} = useZoneData()

const { tags } = useTagData()
const { setMode } = useEditMode()
const { activeWorkbenchDialog, startZoneEditSession } = useEditorWorkbench()
const { clearEditingZone } = useZoneRotation()

const startGlobalZoneEdit = (zoneId) => {
  const zone = zones.value.find(item => item.id === zoneId)
  clearEditingZone()
  selectZone(zoneId)
  setMode(EditMode.ZONE_EDIT)
  if (activeWorkbenchDialog.value !== 'assignment') return
  startZoneEditSession({
    kind: 'assignment',
    sourceDialog: 'assignment',
    zoneId,
    title: zone?.name || `选区 ${zoneId}`,
    subtitle: '在座位表上点击座位，将其加入或移出当前排位选区'
  })
}

// 添加选区
const handleAddZone = () => {
  const newZoneId = addZone()
  startGlobalZoneEdit(newZoneId)
}

// 选择选区
const handleSelectZone = (zoneId) => {
  if (selectedZoneId.value === zoneId) {
    // 取消选中,退出选区编辑模式
    clearZoneSelection()
    setMode(EditMode.NORMAL)
  } else {
    startGlobalZoneEdit(zoneId)
  }
}

// 更新选区
const handleUpdateZone = (zoneId, updates) => {
  updateZone(zoneId, updates)
}

// 删除选区
const handleDeleteZone = (zoneId) => {
  const wasSelected = selectedZoneId.value === zoneId
  deleteZone(zoneId)
  // 如果删除的是当前选中的选区,退出选区编辑模式
  if (wasSelected) {
    setMode(EditMode.NORMAL)
  }
}

// 为选区添加标签
const handleAddTag = (zoneId, tagId) => {
  addTagToZone(zoneId, tagId)
}

// 从选区移除标签
const handleRemoveTag = (zoneId, tagId) => {
  removeTagFromZone(zoneId, tagId)
}

// 切换选区可见性
const handleToggleVisible = (zoneId) => {
  toggleZoneVisible(zoneId)
}
</script>

<style scoped>
.zone-list-container {
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}

.zone-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.zone-list-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-primary);
}

.add-zone-btn {
  padding: 6px 12px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.add-zone-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-bg-secondary);
}

.zone-list-content {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
}

.zone-list-content::-webkit-scrollbar {
  width: 6px;
}

.zone-list-content::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 3px;
}

.zone-list-content::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}

.zone-list-content::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

.empty-zone-list {
  text-align: center;
  padding: 30px 20px;
  color: var(--color-text-disabled);
}

.empty-zone-list p {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.empty-zone-list .hint {
  font-size: 12px;
  color: var(--color-text-disabled);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .zone-list-content {
    max-height: 250px;
  }

  .zone-list-header h4 {
    font-size: 14px;
  }

  .add-zone-btn {
    font-size: 11px;
    padding: 5px 10px;
  }
}
</style>
