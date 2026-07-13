<template>
  <transition name="sdes-import-fade">
    <div v-if="visible" class="sdes-import-overlay" @mousedown.self="close">
      <section class="sdes-import-dialog" role="dialog" aria-modal="true" aria-labelledby="sdes-import-title">
        <header class="sdes-import-header">
          <div>
            <h3 id="sdes-import-title">导入 SDES</h3>
            <p>{{ fileName || '选择要导入的班级和座位表' }}</p>
          </div>
          <button class="sdes-icon-btn" type="button" aria-label="关闭" @click="close">
            <X :size="18" />
          </button>
        </header>

        <div class="sdes-import-body">
          <div v-if="targets.length === 0" class="sdes-import-state">
            <FileWarning :size="24" />
            <strong>没有可导入的座位表</strong>
            <span>当前仅支持 SDES v1 的 grid 和 groupedColumns 座位表。</span>
          </div>

          <div v-else class="sdes-target-list">
            <button
              v-for="target in targets"
              :key="target.id"
              class="sdes-target-item"
              :class="{ active: selectedId === target.id }"
              type="button"
              @click="selectedId = target.id"
            >
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
            </button>
          </div>
        </div>

        <footer class="sdes-import-footer">
          <button class="sdes-secondary-btn" type="button" :disabled="isImporting" @click="close">取消</button>
          <button
            class="sdes-primary-btn"
            :class="{ confirming: isImportConfirming }"
            type="button"
            :disabled="!selectedTarget || isImporting"
            @click="handleImport"
          >
            <Loader2 v-if="isImporting" class="sdes-spin" :size="15" />
            <Download v-else :size="15" />
            <span>{{ importButtonText }}</span>
          </button>
        </footer>
      </section>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { AlertTriangle, Download, FileWarning, Loader2, X } from 'lucide-vue-next'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useExportSettings, normalizeExportSettings } from '@/composables/useExportSettings'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'
import { useSeatRules } from '@/composables/useSeatRules'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useZoneData } from '@/composables/useZoneData'

const props = defineProps({
  visible: Boolean,
  fileName: {
    type: String,
    default: ''
  },
  targets: {
    type: Array,
    default: () => []
  },
  isImporting: Boolean
})

const emit = defineEmits(['update:visible', 'import'])

const selectedId = ref('')
const importConfirmKey = 'sdesImportOverwrite'
const { requestConfirm, isConfirming, cancelConfirm } = useConfirmAction()
const { warning } = useLogger()
const { students } = useStudentData()
const { tags } = useTagData()
const { seats, seatConfig } = useSeatChart()
const { zones } = useZoneData()
const { rules } = useSeatRules()
const { exportSettings } = useExportSettings()
const { attributeDefinitions, showNumericAttributesInEditor } = useStudentAttributes()
const isImportConfirming = isConfirming(importConfirmKey)

const defaultSeatConfig = {
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

const defaultAttributeDefinitions = [
  { id: 'height', name: '身高', unit: 'cm', min: 80, max: 220, precision: 0, enabled: true, showInEditor: true },
  { id: 'score', name: '成绩', unit: '分', min: 0, max: 150, precision: 1, enabled: true, showInEditor: true }
]

const selectedTarget = computed(() => (
  props.targets.find(target => target.id === selectedId.value) || null
))

const toComparableSeatConfig = (config) => ({
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

const toComparableAttributeDefinitions = (definitions) => (
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

const isSameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right)

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
  if (isImportConfirming.value) return '再次点击确认覆盖'
  return '导入所选'
})

const formatLayout = (layoutModel) => (
  layoutModel === 'groupedColumns' ? '大组列行' : '网格'
)

const close = () => {
  cancelConfirm(importConfirmKey)
  emit('update:visible', false)
}

const handleImport = () => {
  if (!selectedTarget.value || props.isImporting) return

  if (hasCurrentWorkspaceData.value) {
    const confirmed = requestConfirm(
      importConfirmKey,
      null,
      'SDES 导入会覆盖当前工作区'
    )
    if (!confirmed) {
      warning('SDES 导入会覆盖当前名单、座位配置和座位分配，请再次点击导入确认')
      return
    }
  }

  emit('import', selectedTarget.value)
}

watch(() => props.visible, (visible) => {
  if (visible) {
    selectedId.value = props.targets[0]?.id || ''
  } else {
    cancelConfirm(importConfirmKey)
  }
})

watch(() => props.targets, (targets) => {
  if (!targets.some(target => target.id === selectedId.value)) {
    selectedId.value = targets[0]?.id || ''
  }
})
</script>

<style scoped>
.sdes-import-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: var(--color-bg-overlay);
}

.sdes-import-dialog {
  width: min(620px, 100%);
  max-height: min(720px, 92vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: 0 18px 45px var(--shadow-lg);
}

.sdes-import-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-subtle);
}

.sdes-import-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 18px;
  line-height: 1.35;
}

.sdes-import-header p {
  margin: 5px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.sdes-icon-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.sdes-icon-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

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
  width: 100%;
  min-height: 82px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sdes-target-item:hover,
.sdes-target-item.active {
  border-color: var(--color-primary);
  background: var(--color-bg-selected);
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
  padding: 12px 14px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.sdes-primary-btn,
.sdes-secondary-btn {
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  white-space: nowrap;
}

.sdes-primary-btn {
  border: none;
  background: var(--color-primary);
  color: var(--color-surface);
}

.sdes-secondary-btn {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.sdes-primary-btn:disabled,
.sdes-secondary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.sdes-primary-btn:not(:disabled):hover {
  background: var(--color-primary-hover);
}

.sdes-primary-btn.confirming {
  background: var(--color-warning);
  color: var(--color-surface);
}

.sdes-secondary-btn:not(:disabled):hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.sdes-spin {
  animation: sdes-spin 0.9s linear infinite;
}

.sdes-import-fade-enter-active,
.sdes-import-fade-leave-active {
  transition: opacity 0.16s ease;
}

.sdes-import-fade-enter-from,
.sdes-import-fade-leave-to {
  opacity: 0;
}

@keyframes sdes-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .sdes-import-overlay {
    align-items: stretch;
    padding: 10px;
  }

  .sdes-import-dialog {
    max-height: none;
  }

  .sdes-import-footer {
    justify-content: stretch;
    flex-wrap: wrap;
  }

  .sdes-primary-btn,
  .sdes-secondary-btn {
    flex: 1;
  }
}
</style>
