<template>
  <ResponsiveOverlay :show="visible" title="导入 SDES" :busy="isImporting" :desktop-width="680" @update:show="value => !value && close()">
        <p class="sdes-dialog-subtitle">{{ fileName || '选择要导入的班级和座位表' }}</p>
        <div class="sdes-import-body">
          <div v-if="targets.length === 0" class="sdes-import-state">
            <FileWarning :size="24" />
            <strong>没有可导入的座位表</strong>
            <span>当前仅支持 SDES v1 的 grid 和 groupedColumns 座位表。</span>
          </div>

          <div v-else class="sdes-target-list">
            <NButton
              v-for="target in targets"
              :key="target.id"
              class="sdes-target-item"
              size="large"
              secondary
              block
              :type="selectedId === target.id ? 'primary' : 'default'"
              attr-type="button"
              @click="selectedId = target.id"
            >
              <span class="sdes-target-content">
                <span class="sdes-target-main">
                  <span class="sdes-target-name">{{ target.className }} / {{ target.chartName }}</span>
                  <span class="sdes-target-layout">{{ formatLayout(target.layoutModel) }}</span>
                </span>
                <span class="sdes-target-meta">
                  <span>{{ target.studentCount }} 名学生</span>
                  <span>{{ target.seatCount }} 个座位项</span>
                  <span>{{ target.assignmentCount }} 个分配</span>
                </span>
                <span v-if="target.warnings.length > 0" class="sdes-target-warnings">
                  <AlertTriangle :size="14" />
                  <span>{{ target.warnings.join('；') }}</span>
                </span>
              </span>
            </NButton>
          </div>
        </div>

        <template #footer>
          <footer class="sdes-import-footer">
          <NButton class="sdes-footer-action" secondary attr-type="button" :disabled="isImporting" @click="close">取消</NButton>
          <NButton
            class="sdes-footer-action"
            type="primary"
            attr-type="button"
            aria-label="导入所选座位表"
            :disabled="!selectedTarget"
            :loading="isImporting"
            @click="handleImport"
          >
            <template #icon><Download v-if="!isImporting" :size="15" /></template>
            <span>{{ importButtonText }}</span>
          </NButton>
          </footer>
        </template>
  </ResponsiveOverlay>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton } from 'naive-ui'
import { AlertTriangle, Download, FileWarning } from 'lucide-vue-next'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { useExportSettings, normalizeExportSettings } from '@/composables/useExportSettings'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'
import { useSeatRules } from '@/composables/useSeatRules'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useZoneData } from '@/composables/useZoneData'
import type { SdesImportTarget } from '@/composables/useSdesExchange'
import type { NumericAttributeDefinition, SeatConfig } from '@/types/models'

const props = withDefaults(defineProps<{
  visible?: boolean
  fileName?: string
  targets?: SdesImportTarget[]
  isImporting?: boolean
}>(), {
  visible: false,
  fileName: '',
  targets: () => [],
  isImporting: false
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  import: [target: SdesImportTarget]
}>()

const selectedId = ref('')
const { confirm } = useLogger()
const { students } = useStudentData()
const { tags } = useTagData()
const { seats, seatConfig } = useSeatChart()
const { zones } = useZoneData()
const { rules } = useSeatRules()
const { exportSettings } = useExportSettings()
const { attributeDefinitions, showNumericAttributesInEditor } = useStudentAttributes()

const defaultSeatConfig: SeatConfig = {
  groupCount: 4,
  columnsPerGroup: 2,
  seatsPerColumn: 7,
  groups: [
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 },
    { columns: 2, rows: 7 }
  ],
  shiftDistance: 4,
  podiumPosition: 'bottom',
  guardSeats: {
    enabled: true,
    leftEnabled: true,
    rightEnabled: true,
    includeInAutoAssignment: false,
    hideEmptyOnExport: true
  }
}

const defaultAttributeDefinitions: NumericAttributeDefinition[] = [
  { id: 'height', name: '身高', unit: 'cm', min: 80, max: 220, precision: 0, enabled: true, showInEditor: true },
  { id: 'score', name: '成绩', unit: '分', min: 0, max: 150, precision: 1, enabled: true, showInEditor: true }
]

const selectedTarget = computed(() => (
  props.targets.find(target => target.id === selectedId.value) || null
))

const toComparableSeatConfig = (config: Partial<SeatConfig>) => ({
  groupCount: Number(config?.groupCount ?? defaultSeatConfig.groupCount),
  columnsPerGroup: Number(config?.columnsPerGroup ?? defaultSeatConfig.columnsPerGroup),
  seatsPerColumn: Number(config?.seatsPerColumn ?? defaultSeatConfig.seatsPerColumn),
  groups: (Array.isArray(config?.groups) ? config.groups : []).map(group => ({
    columns: Number(group?.columns ?? defaultSeatConfig.columnsPerGroup),
    rows: Number(group?.rows ?? defaultSeatConfig.seatsPerColumn)
  })),
  shiftDistance: Number(config?.shiftDistance ?? defaultSeatConfig.shiftDistance),
  podiumPosition: config?.podiumPosition || defaultSeatConfig.podiumPosition,
  guardSeats: {
    ...defaultSeatConfig.guardSeats,
    ...(config?.guardSeats || {})
  }
})

const toComparableAttributeDefinitions = (definitions: NumericAttributeDefinition[]) => (
  (definitions || []).map(def => ({
    id: def.id,
    name: def.name,
    unit: def.unit || '',
    min: def.min ?? null,
    max: def.max ?? null,
    precision: Number(def.precision ?? 0),
    enabled: def.enabled !== false,
    showInEditor: def.showInEditor !== false
  }))
)

const isSameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

const hasCurrentWorkspaceData = computed(() => (
  students.value.length > 0 ||
  tags.value.length > 0 ||
  seats.value.some(seat => seat.studentId != null || seat.isEmpty) ||
  !isSameJson(toComparableSeatConfig(seatConfig.value), toComparableSeatConfig(defaultSeatConfig)) ||
  showNumericAttributesInEditor.value !== true ||
  !isSameJson(
    toComparableAttributeDefinitions(attributeDefinitions.value),
    toComparableAttributeDefinitions(defaultAttributeDefinitions)
  ) ||
  zones.value.length > 0 ||
  rules.value.length > 0 ||
  !isSameJson(normalizeExportSettings(exportSettings.value), normalizeExportSettings())
))

const importButtonText = computed(() => {
  if (props.isImporting) return '正在导入 SDES'
  return '导入所选'
})

const formatLayout = (layoutModel: SdesImportTarget['layoutModel']) => (
  layoutModel === 'groupedColumns' ? '大组列行' : '网格'
)

const close = () => {
  emit('update:visible', false)
}

const handleImport = async () => {
  if (!selectedTarget.value || props.isImporting) return

  if (hasCurrentWorkspaceData.value) {
    const confirmed = await confirm({
      title: '覆盖当前工作区',
      content: 'SDES 导入会覆盖当前名单、座位配置和座位分配，是否继续？',
      positiveText: '覆盖并导入',
      type: 'warning'
    })
    if (!confirmed) return
  }

  emit('import', selectedTarget.value)
}

watch(() => props.visible, (visible) => {
  if (visible) {
    selectedId.value = props.targets[0]?.id || ''
  }
})

watch(() => props.targets, (targets) => {
  if (!targets.some(target => target.id === selectedId.value)) {
    selectedId.value = targets[0]?.id || ''
  }
})
</script>

<style scoped>

.sdes-import-body {
  min-height: 280px;
  overflow: auto;
  padding: 14px;
  background: var(--color-bg-secondary);
}

.sdes-import-state {
  min-height: 252px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  text-align: center;
  color: var(--color-text-secondary);
}

.sdes-import-state strong {
  color: var(--color-text-primary);
  font-size: 15px;
}

.sdes-import-state span {
  font-size: 13px;
}

.sdes-target-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sdes-target-item {
  height: auto;
  min-height: 82px;
  justify-content: flex-start;
  text-align: left;
}

.sdes-target-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  white-space: normal;
}

.sdes-target-main,
.sdes-target-meta,
.sdes-target-warnings {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.sdes-target-main {
  justify-content: space-between;
}

.sdes-target-name {
  min-width: 0;
  color: var(--color-text-primary);
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sdes-target-layout {
  color: var(--color-text-muted);
  font-size: 12px;
  flex-shrink: 0;
}

.sdes-target-meta {
  color: var(--color-text-secondary);
  font-size: 12px;
  flex-wrap: wrap;
}

.sdes-target-meta span {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--color-bg-subtle);
}

.sdes-target-warnings {
  color: var(--color-warning);
  font-size: 12px;
}

.sdes-target-warnings span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sdes-import-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.sdes-footer-action {
  white-space: nowrap;
}


@media (max-width: 640px) {

  .sdes-import-footer {
    justify-content: stretch;
    flex-wrap: wrap;
  }

  .sdes-footer-action {
    flex: 1;
    min-height: 44px;
  }
}
</style>
