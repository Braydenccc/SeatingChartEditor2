<template>
  <div v-if="visible" class="dialog-overlay" @click.self="emit('close')">
    <section class="workbench-dialog">
      <header class="dialog-header">
        <div>
          <h2>选区轮换</h2>
          <p>创建循环或互换组，在座位图上编辑选区后执行轮换</p>
        </div>
        <button class="icon-button" title="关闭" @click="emit('close')">
          <X :size="18" stroke-width="2" />
        </button>
      </header>

      <div class="dialog-body">
        <div v-if="editingZoneId" class="editing-banner">
          <span>正在编辑选区，请在座位图上点击座位以选入或取消</span>
          <button @click="stopEditing">完成</button>
        </div>

        <div class="toolbar-row">
          <button class="secondary-button" @click="addGroup('cycle')">
            <RefreshCcw :size="15" stroke-width="2" />
            <span>循环组</span>
          </button>
          <button class="secondary-button" @click="addGroup('swap')">
            <ArrowLeftRight :size="15" stroke-width="2" />
            <span>互换组</span>
          </button>
        </div>

        <div v-if="rotGroups.length === 0" class="empty-state">
          暂无轮换组，创建一个循环组或互换组开始配置
        </div>

        <article v-for="group in rotGroups" :key="group.id" class="rotation-group">
          <div class="group-header">
            <span class="type-badge" :class="group.type">{{ group.type === 'cycle' ? '循环' : '互换' }}</span>
            <input v-model="group.name" type="text" />
            <button class="icon-button small" title="删除轮换组" @click="deleteGroup(group.id)">
              <Trash2 :size="14" stroke-width="2" />
            </button>
          </div>

          <div class="zone-list">
            <div
              v-for="zone in group.zones"
              :key="zone.id"
              class="zone-row"
              :class="{ editing: editingZoneId === zone.id }"
            >
              <button
                class="zone-dot"
                :style="{ backgroundColor: getZoneColor(group.id, zone.id) }"
                :title="editingZoneId === zone.id ? '停止编辑此选区' : '编辑此选区'"
                @click="selectZone(group, zone)"
              ></button>
              <input v-model="zone.name" type="text" />
              <span class="seat-count">{{ zone.seatIds.length }}座</span>
              <button class="icon-button small" title="删除选区" @click="deleteZone(group.id, zone.id)">
                <X :size="14" stroke-width="2" />
              </button>
            </div>
          </div>

          <button class="add-zone-button" @click="addZone(group.id)">
            <Plus :size="14" stroke-width="2" />
            <span>添加选区</span>
          </button>

          <div v-if="getGroupError(group)" class="group-error">
            {{ getGroupError(group) }}
          </div>
        </article>
      </div>

      <footer class="dialog-footer">
        <button class="secondary-button" @click="stopEditing">退出编辑</button>
        <button class="primary-button" @click="applyRotation">
          <RefreshCcw :size="16" stroke-width="2" />
          <span>应用选区轮换</span>
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { ArrowLeftRight, Plus, RefreshCcw, Trash2, X } from 'lucide-vue-next'
import { useEditMode } from '@/composables/useEditMode'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'
import { useUndo } from '@/composables/useUndo'
import { useZoneData } from '@/composables/useZoneData'
import { useZoneRotation } from '@/composables/useZoneRotation'

defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])
const { seats } = useSeatChart()
const { createSnapshot, recordBatch } = useUndo()
const { success, warning } = useLogger()
const { setMode, EditMode } = useEditMode()
const { startZoneEditSession } = useEditorWorkbench()
const { clearZoneSelection } = useZoneData()
const {
  rotGroups,
  editingZoneId,
  addRotGroup,
  deleteRotGroup,
  addZoneToGroup,
  deleteZoneFromGroup,
  selectEditingZone,
  clearEditingZone,
  getZoneColor,
  validateGroup,
  applyZoneRotation
} = useZoneRotation()

const addGroup = (type) => addRotGroup(type)

const deleteGroup = (groupId) => {
  deleteRotGroup(groupId)
  if (editingZoneId.value === null) setMode(EditMode.NORMAL)
}

const startRotationZoneEdit = (group, zone) => {
  if (!group || !zone) return
  clearZoneSelection()
  setMode(EditMode.ZONE_EDIT)
  if (editingZoneId.value !== zone.id) {
    selectEditingZone(zone.id)
  }
  startZoneEditSession({
    kind: 'rotation',
    sourceDialog: 'zoneRotation',
    groupId: group.id,
    zoneId: zone.id,
    title: zone.name || `选区 ${zone.id}`,
    subtitle: '在座位表上点击座位，将其加入或移出当前轮换选区'
  })
}

const addZone = (groupId) => {
  const zone = addZoneToGroup(groupId)
  const group = rotGroups.value.find(item => item.id === groupId)
  startRotationZoneEdit(group, zone)
}

const deleteZone = (groupId, zoneId) => {
  deleteZoneFromGroup(groupId, zoneId)
  if (editingZoneId.value === null) setMode(EditMode.NORMAL)
}

const selectZone = (group, zone) => {
  startRotationZoneEdit(group, zone)
}

const stopEditing = () => {
  clearEditingZone()
  setMode(EditMode.NORMAL)
}

const getGroupError = (group) => {
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
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--color-bg-overlay);
}

.workbench-dialog {
  width: min(720px, 100%);
  max-height: min(760px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  background: var(--color-dialog-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.dialog-header,
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.dialog-footer {
  border-top: 1px solid var(--color-border);
  border-bottom: none;
}

.dialog-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--color-text-primary);
}

.dialog-header p {
  margin: 4px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.dialog-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.icon-button,
.secondary-button,
.primary-button,
.add-zone-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
}

.icon-button {
  width: 34px;
  padding: 0;
}

.icon-button.small {
  width: 28px;
  min-height: 28px;
}

.primary-button {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
  padding: 0 14px;
}

.secondary-button {
  padding: 0 12px;
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

.editing-banner button {
  border: none;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
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
  background: var(--color-accent);
}

.group-header input,
.zone-row input {
  min-width: 0;
  min-height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-input-bg);
  color: var(--color-text-primary);
  padding: 0 8px;
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
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-surface);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--color-border);
  cursor: pointer;
}

.seat-count {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.add-zone-button {
  width: 100%;
  margin-top: 10px;
  color: var(--color-primary);
}

.group-error {
  margin-top: 10px;
  padding: 8px;
  border-radius: 6px;
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
  font-size: 12px;
}

@media (max-width: 640px) {
  .dialog-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .workbench-dialog {
    width: 100%;
    max-height: 92vh;
    border-radius: 12px 12px 0 0;
  }
}
</style>
