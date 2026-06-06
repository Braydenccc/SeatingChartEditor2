<template>
  <section class="zone-edit-panel">
    <header class="panel-header">
      <div>
        <h2>选区编辑</h2>
        <p>{{ headerText }}</p>
      </div>
      <button class="primary-action" type="button" @click="finishEditing">
        <Check :size="15" stroke-width="2.4" />
        <span>完成</span>
      </button>
    </header>

    <div class="panel-body">
      <div class="zone-card">
        <div class="zone-title-row">
          <span class="zone-color" :style="{ backgroundColor: activeColor }"></span>
          <div>
            <strong>{{ activeName }}</strong>
            <span>{{ sourceText }}</span>
          </div>
        </div>
        <div class="metric-grid">
          <div>
            <span>已选座位</span>
            <strong>{{ activeSeatCount }}</strong>
          </div>
          <div>
            <span>编辑方式</span>
            <strong>点击座位</strong>
          </div>
        </div>
      </div>

      <div class="context-section">
        <div class="section-title">选区操作</div>
        <div class="action-grid">
          <button type="button" :disabled="activeSeatCount === 0" @click="clearActiveZoneSeats">
            <Eraser :size="14" stroke-width="2.2" />
            <span>清空座位</span>
          </button>
          <button v-if="isAssignmentZone" type="button" @click="toggleActiveZoneVisible">
            <Eye :size="14" stroke-width="2.2" />
            <span>{{ activeGlobalZone?.visible ? '隐藏高亮' : '显示高亮' }}</span>
          </button>
          <button type="button" class="danger" @click="deleteActiveZone">
            <Trash2 :size="14" stroke-width="2.2" />
            <span>删除选区</span>
          </button>
        </div>
      </div>

      <div v-if="isAssignmentZone" class="context-section">
        <div class="section-title">规则标签</div>
        <div v-if="activeZoneTags.length > 0" class="tag-list">
          <span
            v-for="tag in activeZoneTags"
            :key="tag.id"
            class="tag-chip"
            :style="{ '--tag-color': tag.color }"
          >
            <span class="tag-dot"></span>
            <span>{{ tag.name || '未命名标签' }}</span>
          </span>
        </div>
        <p v-else class="empty-hint">此选区尚未绑定标签，可返回排位窗口继续配置。</p>
      </div>

      <div class="context-section">
        <div class="section-title">当前流程</div>
        <p class="flow-text">{{ flowText }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Check, Eraser, Eye, Trash2 } from 'lucide-vue-next'
import { useEditMode } from '@/composables/useEditMode'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useLogger } from '@/composables/useLogger'
import { useTagData } from '@/composables/useTagData'
import { useZoneData } from '@/composables/useZoneData'
import { useZoneRotation } from '@/composables/useZoneRotation'

const { setMode, EditMode } = useEditMode()
const { zoneEditSession, finishZoneEditSession } = useEditorWorkbench()
const { success, warning } = useLogger()
const { tags } = useTagData()
const {
  zones,
  updateZone,
  deleteZone,
  getZoneColor,
  clearZoneSelection,
  toggleZoneVisible
} = useZoneData()
const {
  rotGroups,
  deleteZoneFromGroup,
  clearEditingZone,
  buildZoneColorMap
} = useZoneRotation()

const isAssignmentZone = computed(() => zoneEditSession.value?.kind === 'assignment')

const activeGlobalZone = computed(() => {
  if (!isAssignmentZone.value || !zoneEditSession.value) return null
  return zones.value.find(zone => zone.id === zoneEditSession.value?.zoneId) || null
})

const activeRotationGroup = computed(() => {
  if (isAssignmentZone.value || !zoneEditSession.value) return null
  return rotGroups.value.find(group => group.id === zoneEditSession.value?.groupId) ||
    rotGroups.value.find(group => group.zones.some(zone => zone.id === zoneEditSession.value?.zoneId)) ||
    null
})

const activeRotationZone = computed(() => {
  if (!activeRotationGroup.value || !zoneEditSession.value) return null
  return activeRotationGroup.value.zones.find(zone => zone.id === zoneEditSession.value?.zoneId) || null
})

const activeName = computed(() => {
  return activeGlobalZone.value?.name ||
    activeRotationZone.value?.name ||
    zoneEditSession.value?.title ||
    '选区'
})

const activeSeatCount = computed(() => {
  const zone = activeGlobalZone.value || activeRotationZone.value
  return zone?.seatIds?.length || 0
})

const activeColor = computed(() => {
  if (activeGlobalZone.value) return getZoneColor(activeGlobalZone.value.id)
  if (activeRotationZone.value) {
    return buildZoneColorMap().get(activeRotationZone.value.id) || 'var(--color-border-strong)'
  }
  return 'var(--color-border-strong)'
})

const activeZoneTags = computed(() => {
  const tagIds = activeGlobalZone.value?.tagIds || []
  return tags.value.filter(tag => tagIds.includes(tag.id))
})

const sourceText = computed(() => {
  if (isAssignmentZone.value) return '智能排位选区'
  return activeRotationGroup.value?.name || '选区轮换'
})

const headerText = computed(() => {
  if (!zoneEditSession.value) return '从业务窗口选择一个选区后，在座位表上点选座位'
  return zoneEditSession.value.subtitle || '在座位表上点击座位以选入或取消'
})

const flowText = computed(() => {
  if (isAssignmentZone.value) {
    return '完成后会回到智能排位窗口，可继续配置规则、标签或执行预检查。'
  }
  return '完成后会回到选区轮换窗口，可继续添加选区或执行轮换。'
})

const finishEditing = () => {
  clearZoneSelection()
  clearEditingZone()
  setMode(EditMode.NORMAL)
  finishZoneEditSession()
  success('选区编辑已完成')
}

const clearActiveZoneSeats = () => {
  if (activeGlobalZone.value) {
    updateZone(activeGlobalZone.value.id, { seatIds: [] })
    success('已清空选区座位')
    return
  }
  if (activeRotationZone.value) {
    activeRotationZone.value.seatIds.splice(0)
    success('已清空选区座位')
  }
}

const toggleActiveZoneVisible = () => {
  if (!activeGlobalZone.value) return
  toggleZoneVisible(activeGlobalZone.value.id)
}

const deleteActiveZone = () => {
  if (activeGlobalZone.value) {
    deleteZone(activeGlobalZone.value.id)
    warning('已删除选区')
    finishEditing()
    return
  }
  if (activeRotationGroup.value && activeRotationZone.value) {
    deleteZoneFromGroup(activeRotationGroup.value.id, activeRotationZone.value.id)
    warning('已删除轮换选区')
    finishEditing()
  }
}
</script>

<style scoped>
.zone-edit-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.panel-header h2 {
  margin: 0;
  font-size: 15px;
  color: var(--color-text-primary);
}

.panel-header p {
  margin: 3px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
}

.primary-action,
.action-grid button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.primary-action {
  flex-shrink: 0;
  padding: 0 10px;
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.zone-card,
.context-section {
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  margin-bottom: 12px;
}

.zone-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.zone-title-row strong,
.zone-title-row span {
  display: block;
}

.zone-title-row strong {
  color: var(--color-text-primary);
  font-size: 14px;
}

.zone-title-row span {
  margin-top: 2px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.zone-color {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid var(--color-surface);
  box-shadow: 0 0 0 1px var(--color-border);
  flex-shrink: 0;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.metric-grid div {
  padding: 10px;
  border-radius: 6px;
  background: var(--color-surface);
}

.metric-grid span,
.metric-grid strong {
  display: block;
}

.metric-grid span {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.metric-grid strong {
  margin-top: 4px;
  color: var(--color-primary);
  font-size: 18px;
}

.section-title {
  margin-bottom: 10px;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 700;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.action-grid button {
  width: 100%;
}

.action-grid button:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.action-grid button.danger:hover:not(:disabled) {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.action-grid button:disabled {
  color: var(--color-text-disabled);
  cursor: not-allowed;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 12px;
}

.tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tag-color);
}

.empty-hint,
.flow-text {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}
</style>
