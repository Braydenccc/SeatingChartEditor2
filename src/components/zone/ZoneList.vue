<template>
  <div class="zone-list-container">
    <div class="zone-list-header">
      <h4>选区列表</h4>
      <NButton size="small" type="primary" secondary @click="handleAddZone"><Plus :size="11" stroke-width="2" /> 添加选区</NButton>
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

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { Plus } from 'lucide-vue-next'
import { useZoneData } from '@/composables/useZoneData'
import { useTagData } from '@/composables/useTagData'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useEditorCommands } from '@/composables/useEditorCommands'
import type { Zone } from '@/types/models'

const {
  zones,
  selectedZoneId,
  addZone,
  updateZone,
  deleteZone,
  addTagToZone,
  removeTagFromZone,
  getZoneColor,
  toggleZoneVisible
} = useZoneData()

const { tags } = useTagData()
const { activeWorkbenchDialog } = useEditorWorkbench()
const { finishZoneEditing, startGlobalZoneEditing } = useEditorCommands()

const startGlobalZoneEdit = (zoneId: number) => {
  const zone = zones.value.find(item => item.id === zoneId)
  const session = activeWorkbenchDialog.value === 'assignment'
    ? {
        kind: 'assignment' as const,
        sourceDialog: 'assignment' as const,
        zoneId,
        title: zone?.name || `选区 ${zoneId}`,
        subtitle: '在座位表上点击座位，将其加入或移出当前排位选区'
      }
    : undefined
  startGlobalZoneEditing(zoneId, session)
}

// 添加选区
const handleAddZone = () => {
  const newZoneId = addZone()
  startGlobalZoneEdit(newZoneId)
}

// 选择选区
const handleSelectZone = (zoneId: number) => {
  if (selectedZoneId.value === zoneId) {
    // 取消选中,退出选区编辑模式
    finishZoneEditing()
  } else {
    startGlobalZoneEdit(zoneId)
  }
}

// 更新选区
const handleUpdateZone = (zoneId: number, updates: Partial<Zone>) => {
  updateZone(zoneId, updates)
}

// 删除选区
const handleDeleteZone = (zoneId: number) => {
  const wasSelected = selectedZoneId.value === zoneId
  deleteZone(zoneId)
  // 如果删除的是当前选中的选区,退出选区编辑模式
  if (wasSelected) {
    finishZoneEditing()
  }
}

// 为选区添加标签
const handleAddTag = (zoneId: number, tagId: number) => {
  addTagToZone(zoneId, tagId)
}

// 从选区移除标签
const handleRemoveTag = (zoneId: number, tagId: number) => {
  removeTagFromZone(zoneId, tagId)
}

// 切换选区可见性
const handleToggleVisible = (zoneId: number) => {
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

}
</style>
