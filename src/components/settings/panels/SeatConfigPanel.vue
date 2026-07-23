<template>
  <div class="settings-panel">
    <section class="setting-section">
      <h3 class="section-title">座位表配置</h3>
      <p class="section-desc">调整座位表的基本布局参数，修改会先保留在草稿中。</p>

      <NForm label-placement="top" size="medium">
        <NGrid cols="1 560:2" :x-gap="16" :y-gap="4">
          <NGridItem>
            <NFormItem label="大组数量" :show-feedback="false">
              <NInputNumber
                :value="draft.groupCount"
                :min="1"
                :max="maxSeatGroupCount"
                :precision="0"
                @update:value="updateGroupCount"
              />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="每组列数" :show-feedback="false">
              <NInputNumber
                :value="draft.columnsPerGroup"
                :min="1"
                :max="5"
                :precision="0"
                @update:value="updateUniformColumns"
              />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="每列座位数" :show-feedback="false">
              <NInputNumber
                :value="draft.seatsPerColumn"
                :min="1"
                :max="12"
                :precision="0"
                @update:value="updateUniformRows"
              />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="错位距离" :show-feedback="false">
              <NInputNumber
                :value="draft.shiftDistance"
                :min="0"
                :max="10"
                :precision="0"
                @update:value="updateShiftDistance"
              />
            </NFormItem>
          </NGridItem>
        </NGrid>

        <NFormItem class="setting-item" label="讲台位置" :show-feedback="false">
          <NRadioGroup v-model:value="draft.podiumPosition" size="small">
            <NRadioButton value="bottom">底部（默认）</NRadioButton>
            <NRadioButton value="top">顶部</NRadioButton>
          </NRadioGroup>
        </NFormItem>

        <NFormItem class="setting-item" label="左右护法" :show-feedback="false">
          <div class="guard-options">
            <div class="switch-row">
              <NSwitch v-model:value="draft.guardSeats.enabled" aria-label="启用左右护法" />
              <span>启用左右护法</span>
            </div>
            <div v-if="draft.guardSeats.enabled" class="guard-sub-options">
              <div class="switch-row"><NSwitch v-model:value="draft.guardSeats.leftEnabled" aria-label="启用左护法" /><span>左护法</span></div>
              <div class="switch-row"><NSwitch v-model:value="draft.guardSeats.rightEnabled" aria-label="启用右护法" /><span>右护法</span></div>
              <div class="switch-row"><NSwitch v-model:value="draft.guardSeats.includeInAutoAssignment" aria-label="护法参与智能排位" /><span>参与智能排位</span></div>
              <div class="switch-row"><NSwitch v-model:value="draft.guardSeats.hideEmptyOnExport" aria-label="导出时隐藏空护法位" /><span>导出时隐藏空护法位</span></div>
            </div>
          </div>
        </NFormItem>
      </NForm>

      <NAlert class="warning-box" type="warning" :show-icon="true">
        应用配置后会重新协调座位布局；不兼容座位上的学生会回到候选区。当前修改不会在点击“应用配置”前生效。
      </NAlert>

      <div class="config-actions">
        <NButton secondary :disabled="!hasChanges || pending" @click="resetDraft">放弃更改</NButton>
        <NButton type="primary" :disabled="!hasChanges" :loading="pending" @click="applyDraft">应用配置</NButton>
      </div>

      <NDivider />

      <h3 class="section-title">高级配置</h3>
      <p class="section-desc">为每个大组单独设置列数和行数。</p>
      <NButton class="advanced-button" secondary @click="openAdvancedConfig">
        <template #icon><Settings :size="18" /></template>
        <span class="button-content">
          <span class="button-title">打开高级配置</span>
          <span class="button-desc">在编辑器工作台中进行详细配置</span>
        </span>
      </NButton>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NDivider,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSwitch
} from 'naive-ui'
import { useRouter } from 'vue-router'
import { Settings } from 'lucide-vue-next'
import { useSeatChart } from '@/composables/useSeatChart'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useUiFeedback } from '@/composables/useLogger'
import { maxSeatGroupCount } from '@/constants/seatConfig'
import { normalizeRequiredNumberInput } from '@/utils/inputNormalization'
import type { GroupConfig, GuardSeatsConfig, SeatConfig } from '@/types/models'

const emit = defineEmits<{ 'update:visible': [value: boolean] }>()
const router = useRouter()
const { seatConfig, seats, updateConfig, normalizeGuardSeatsConfig } = useSeatChart()
const { openDialog } = useEditorWorkbench()
const { confirm, success } = useUiFeedback()

interface SeatConfigDraft {
  groupCount: number
  columnsPerGroup: number
  seatsPerColumn: number
  groups: GroupConfig[]
  shiftDistance: number
  podiumPosition: SeatConfig['podiumPosition']
  guardSeats: GuardSeatsConfig
}

const createDraft = (): SeatConfigDraft => {
  const config = seatConfig.value
  const groups = Array.from({ length: config.groupCount }, (_, index) => {
    const group = config.groups?.[index]
    return {
      columns: group?.columns ?? config.columnsPerGroup,
      rows: group?.rows ?? config.seatsPerColumn
    }
  })
  return {
    groupCount: config.groupCount,
    columnsPerGroup: config.columnsPerGroup,
    seatsPerColumn: config.seatsPerColumn,
    groups,
    shiftDistance: config.shiftDistance,
    podiumPosition: config.podiumPosition,
    guardSeats: normalizeGuardSeatsConfig(config.guardSeats)
  }
}

const draft = ref<SeatConfigDraft>(createDraft())
const pending = ref(false)

const comparableConfig = (config: SeatConfigDraft) => JSON.stringify({
  groupCount: config.groupCount,
  columnsPerGroup: config.columnsPerGroup,
  seatsPerColumn: config.seatsPerColumn,
  groups: config.groups,
  shiftDistance: config.shiftDistance,
  podiumPosition: config.podiumPosition,
  guardSeats: config.guardSeats
})

const hasChanges = computed(() => comparableConfig(draft.value) !== comparableConfig(createDraft()))
const assignedSeatCount = computed(() => seats.value.filter(seat => seat.studentId != null).length)

const resetDraft = () => {
  draft.value = createDraft()
}

watch(seatConfig, resetDraft, { deep: true })

const updateGroupCount = (value: number | null) => {
  const nextCount = normalizeRequiredNumberInput(value, draft.value.groupCount, { min: 1, max: maxSeatGroupCount, precision: 0 })
  draft.value.groupCount = nextCount
  while (draft.value.groups.length < nextCount) {
    draft.value.groups.push({
      columns: draft.value.columnsPerGroup,
      rows: draft.value.seatsPerColumn
    })
  }
  draft.value.groups.splice(nextCount)
}

const updateUniformColumns = (value: number | null) => {
  const columns = normalizeRequiredNumberInput(value, draft.value.columnsPerGroup, { min: 1, max: 5, precision: 0 })
  draft.value.columnsPerGroup = columns
  draft.value.groups.forEach(group => { group.columns = columns })
}

const updateUniformRows = (value: number | null) => {
  const rows = normalizeRequiredNumberInput(value, draft.value.seatsPerColumn, { min: 1, max: 12, precision: 0 })
  draft.value.seatsPerColumn = rows
  draft.value.groups.forEach(group => { group.rows = rows })
}

const updateShiftDistance = (value: number | null) => {
  draft.value.shiftDistance = normalizeRequiredNumberInput(value, draft.value.shiftDistance, { min: 0, max: 10, precision: 0 })
}

const createDraftConfig = (): SeatConfig => ({
  groupCount: draft.value.groupCount,
  columnsPerGroup: draft.value.columnsPerGroup,
  seatsPerColumn: draft.value.seatsPerColumn,
  groups: draft.value.groups.map(group => ({ ...group })),
  shiftDistance: draft.value.shiftDistance,
  podiumPosition: draft.value.podiumPosition,
  guardSeats: { ...draft.value.guardSeats }
})

const applyDraft = async () => {
  if (!hasChanges.value || pending.value) return
  pending.value = true
  try {
    const accepted = await confirm({
      title: '应用座位表配置',
      content: assignedSeatCount.value > 0
        ? `当前有 ${assignedSeatCount.value} 个已分配座位。应用后，不兼容座位上的学生会回到候选区，确认继续吗？`
        : '应用后将按草稿重新协调座位布局，确认继续吗？',
      positiveText: '应用配置',
      negativeText: '取消',
      type: 'warning'
    })
    if (!accepted) return
    updateConfig(createDraftConfig())
    success('座位表配置已应用')
  } finally {
    pending.value = false
  }
}

const openAdvancedConfig = async () => {
  const initialConfig = createDraftConfig()
  await router.push('/editor')
  openDialog('seatConfig', { seatConfig: initialConfig })
  emit('update:visible', false)
}
</script>

<style scoped>
.settings-panel {
  max-width: 920px;
}

.setting-section {
  margin-bottom: 32px;
}

.section-title {
  margin: 0 0 8px;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
}

.section-desc {
  margin: 0 0 20px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.setting-item {
  margin-top: 20px;
}

.guard-options,
.guard-sub-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.guard-sub-options {
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-primary);
  font-size: 13px;
}

.warning-box {
  margin-top: 20px;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}

.advanced-button {
  width: 100%;
  height: auto;
  min-height: 66px;
  justify-content: flex-start;
  text-align: left;
}

.button-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.button-title {
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
}

.button-desc {
  color: var(--color-text-secondary);
  font-size: 12px;
}

@media (max-width: 820px) {
  .config-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .config-actions > * {
    min-height: 44px;
  }

  .advanced-button {
    min-height: 66px;
  }
}
</style>
