<template>
  <ResponsiveOverlay :show="visible" title="选区轮换" :desktop-width="760" @update:show="value => !value && emit('close')">
      <p class="dialog-description">创建循环或互换组，在座位图上编辑选区后执行轮换</p>
      <div class="dialog-body">
        <div v-if="editingZoneId" class="editing-banner">
          <span>正在编辑选区，请在座位图上点击座位以选入或取消</span>
          <NButton size="small" type="primary" secondary @click="stopEditing">完成</NButton>
        </div>

        <div class="toolbar-row">
          <NButton size="small" secondary @click="addGroup('cycle')">
            <RefreshCcw :size="15" stroke-width="2" />
            <span>循环组</span>
          </NButton>
          <NButton size="small" secondary @click="addGroup('swap')">
            <ArrowLeftRight :size="15" stroke-width="2" />
            <span>互换组</span>
          </NButton>
        </div>

        <div v-if="rotGroups.length === 0" class="empty-state">
          暂无轮换组，创建一个循环组或互换组开始配置
        </div>

        <article v-for="group in rotGroups" :key="group.id" class="rotation-group">
          <div class="group-header">
            <span class="type-badge" :class="group.type">{{ group.type === 'cycle' ? '循环' : '互换' }}</span>
            <NInput v-model:value="group.name" class="name-input" size="small" />
            <NButton size="small" quaternary circle type="error" title="删除轮换组" @click="deleteGroup(group.id)">
              <Trash2 :size="14" stroke-width="2" />
            </NButton>
          </div>

          <div class="zone-list">
            <div
              v-for="zone in group.zones"
              :key="zone.id"
              class="zone-row"
              :class="{ editing: editingZoneId === zone.id }"
            >
              <NButton
                class="zone-dot"
                size="tiny"
                circle
                :color="getZoneColor(group.id, zone.id)"
                :title="editingZoneId === zone.id ? '停止编辑此选区' : '编辑此选区'"
                @click="selectZone(group, zone)"
              ></NButton>
              <NInput v-model:value="zone.name" class="name-input" size="small" />
              <span class="seat-count">{{ zone.seatIds.length }}座</span>
              <NButton size="small" quaternary circle type="error" title="删除选区" @click="deleteZone(group.id, zone.id)">
                <X :size="14" stroke-width="2" />
              </NButton>
            </div>
          </div>

          <NButton class="add-zone-button" size="small" secondary block @click="addZone(group.id)">
            <Plus :size="14" stroke-width="2" />
            <span>添加选区</span>
          </NButton>

          <div v-if="getGroupError(group)" class="group-error">
            {{ getGroupError(group) }}
          </div>
        </article>
      </div>

      <template #footer><footer class="dialog-footer">
        <NButton secondary @click="stopEditing">退出编辑</NButton>
        <NButton type="primary" @click="applyRotation">
          <RefreshCcw :size="16" stroke-width="2" />
          <span>应用选区轮换</span>
        </NButton>
      </footer></template>
  </ResponsiveOverlay>
</template>

<script setup lang="ts">
import { NButton, NInput } from 'naive-ui'
import { ArrowLeftRight, Plus, RefreshCcw, Trash2, X } from 'lucide-vue-next'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { useEditorCommands } from '@/composables/useEditorCommands'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'
import { useUndo } from '@/composables/useUndo'
import { useZoneRotation } from '@/composables/useZoneRotation'
import type { RotationGroup, RotationZone } from '@/types/models'

withDefaults(defineProps<{ visible?: boolean }>(), { visible: false })

const emit = defineEmits<{ close: [] }>()
const { seats } = useSeatChart()
const { createSnapshot, recordBatch } = useUndo()
const { success, warning } = useLogger()
const { finishZoneEditing, startRotationZoneEditing } = useEditorCommands()
const {
  rotGroups,
  editingZoneId,
  addRotGroup,
  deleteRotGroup,
  addZoneToGroup,
  deleteZoneFromGroup,
  getZoneColor,
  validateGroup,
  applyZoneRotation
} = useZoneRotation()

const addGroup = (type: RotationGroup['type']) => addRotGroup(type)

const deleteGroup = (groupId: number) => {
  deleteRotGroup(groupId)
  if (editingZoneId.value === null) finishZoneEditing()
}

const startRotationZoneEdit = (
  group: RotationGroup | null | undefined,
  zone: RotationZone | null | undefined
) => {
  if (!group || !zone) return
  startRotationZoneEditing(zone.id, {
    kind: 'rotation',
    sourceDialog: 'zoneRotation',
    groupId: group.id,
    zoneId: zone.id,
    title: zone.name || `选区 ${zone.id}`,
    subtitle: '在座位表上点击座位，将其加入或移出当前轮换选区'
  })
}

const addZone = (groupId: number) => {
  const zone = addZoneToGroup(groupId)
  const group = rotGroups.value.find(item => item.id === groupId)
  startRotationZoneEdit(group, zone)
}

const deleteZone = (groupId: number, zoneId: number) => {
  deleteZoneFromGroup(groupId, zoneId)
  if (editingZoneId.value === null) finishZoneEditing()
}

const selectZone = (group: RotationGroup, zone: RotationZone) => {
  startRotationZoneEdit(group, zone)
}

const stopEditing = () => {
  finishZoneEditing()
}

const getGroupError = (group: RotationGroup) => {
  const { valid, error } = validateGroup(group)
  return valid ? '' : error
}

const applyRotation = () => {
  if (rotGroups.value.length === 0) {
    warning('请先创建轮换组')
    return
  }
  const before = createSnapshot()
  const seatMapArg = new Map(seats.value.map(seat => [seat.id, seat]))
  const { moved, errors } = applyZoneRotation(seatMapArg)
  const after = createSnapshot()
  if (moved > 0) recordBatch(before, after)
  errors.forEach(item => warning(item))
  if (moved > 0) {
    success(`选区轮换完成，已移动 ${moved} 个座位的学生`)
    emit('close')
  } else if (errors.length === 0) {
    warning('没有学生被移动，请检查选区是否包含学生')
  }
}
</script>

<style scoped>

.dialog-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.toolbar-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.editing-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid var(--color-info);
  border-radius: 6px;
  background: var(--color-info-bg);
  color: var(--color-info-text);
  font-size: 13px;
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
  border-radius: 8px;
}

.rotation-group {
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  margin-bottom: 12px;
}

.group-header,
.zone-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.group-header {
  grid-template-columns: auto minmax(0, 1fr) auto;
  margin-bottom: 10px;
}

.type-badge {
  padding: 3px 8px;
  border-radius: 999px;
  color: var(--color-text-inverse);
  background: var(--color-primary);
  font-size: 12px;
}

.type-badge.swap {
  background: var(--color-mode-swap);
}

.name-input {
  min-width: 0;
}

.zone-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zone-row {
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
}

.zone-row.editing {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
}

.zone-dot {
  flex: 0 0 auto;
}

.seat-count {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.add-zone-button {
  margin-top: 10px;
}

.group-error {
  margin-top: 10px;
  padding: 8px;
  border-radius: 6px;
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
  font-size: 12px;
}

</style>
