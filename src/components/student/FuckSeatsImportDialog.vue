<template>
  <ResponsiveOverlay :show="visible" title="从不想排座位导入" :busy="isImporting" :desktop-width="620" @update:show="value => !value && close()">
        <p class="fs-dialog-subtitle">{{ headerText }}</p>
        <div class="fs-import-body">
          <div v-if="isLoading" class="fs-import-state">
            <Loader2 class="fs-spin" :size="24" />
            <strong>正在检测本地服务</strong>
            <span>会依次检查 23948 和 8000 端口</span>
          </div>

          <div v-else-if="errorText" class="fs-import-state">
            <ServerOff :size="24" />
            <strong>{{ errorText }}</strong>
            <span>请先启动不想排座位，再重新检测</span>
            <div class="fs-state-actions">
              <NButton secondary attr-type="button" @click="loadClassrooms">
                <RefreshCcw :size="15" />
                <span>重新检测</span>
              </NButton>
              <NButton v-if="showExcelFallback" type="primary" attr-type="button" @click="fallbackExcel">
                <FileInput :size="15" />
                <span>导入 Excel</span>
              </NButton>
            </div>
          </div>

          <div v-else-if="classrooms.length === 0" class="fs-import-state">
            <Server :size="24" />
            <strong>已连接本地服务</strong>
            <span>当前不想排座位没有可导入的班级</span>
            <NButton secondary attr-type="button" @click="loadClassrooms">
              <RefreshCcw :size="15" />
              <span>刷新</span>
            </NButton>
          </div>

          <div v-else class="fs-classroom-list">
            <NButton
              v-for="classroom in classrooms"
              :key="`${classroom.baseUrl}:${classroom.id}`"
              class="fs-classroom-item"
              size="large"
              secondary
              block
              :type="selectedKey === getClassroomKey(classroom) ? 'primary' : 'default'"
              attr-type="button"
              @click="selectedKey = getClassroomKey(classroom)"
            >
              <span class="fs-classroom-content">
                <span class="fs-classroom-main">
                  <span class="fs-classroom-name">{{ classroom.name }}</span>
                  <span class="fs-classroom-source">{{ formatBaseUrl(classroom.baseUrl) }}</span>
                </span>
                <span class="fs-classroom-meta">
                  <span>{{ classroom.gridLabel || '座位网格' }}</span>
                  <span>{{ formatCount(classroom.studentCount, '学生') }}</span>
                  <span>{{ formatCount(classroom.seatCount, '座位') }}</span>
                </span>
              </span>
            </NButton>
          </div>
        </div>

        <template #footer>
          <footer class="fs-import-footer">
          <NButton class="fs-footer-action" secondary attr-type="button" @click="close">取消</NButton>
          <NButton class="fs-footer-action" secondary attr-type="button" :disabled="isLoading || isImporting" @click="loadClassrooms">
            <RefreshCcw :size="15" />
            <span>刷新</span>
          </NButton>
          <NButton
            class="fs-footer-action"
            type="primary"
            attr-type="button"
            :disabled="!selectedClassroom || isLoading"
            :loading="isImporting"
            @click="handleImport"
          >
            <Download v-if="!isImporting" :size="15" />
            <span>{{ importButtonText }}</span>
          </NButton>
          </footer>
        </template>
  </ResponsiveOverlay>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton } from 'naive-ui'
import { Download, FileInput, Loader2, RefreshCcw, Server, ServerOff } from 'lucide-vue-next'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { useFuckSeatsImport } from '@/composables/useFuckSeatsImport'
import type { FuckSeatsClassroomSummary, FuckSeatsImportResult } from '@/composables/useFuckSeatsImport'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'
import { useSeatRules } from '@/composables/useSeatRules'
import { useExportSettings, normalizeExportSettings } from '@/composables/useExportSettings'
import { useStudentData } from '@/composables/useStudentData'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useTagData } from '@/composables/useTagData'
import { useZoneData } from '@/composables/useZoneData'
import type { NumericAttributeDefinition, SeatConfig } from '@/types/models'

const props = withDefaults(defineProps<{
  visible?: boolean
  showExcelFallback?: boolean
}>(), {
  visible: false,
  showExcelFallback: false
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'fallback-excel': []
  imported: [result: FuckSeatsImportResult]
}>()

const { discoverLocalFuckSeats, importClassroom } = useFuckSeatsImport()
const { success, warning, error, confirm } = useLogger()
const { seats, seatConfig } = useSeatChart()
const { rules } = useSeatRules()
const { exportSettings } = useExportSettings()
const { students } = useStudentData()
const { attributeDefinitions, showNumericAttributesInEditor } = useStudentAttributes()
const { tags } = useTagData()
const { zones } = useZoneData()

const isLoading = ref(false)
const isImporting = ref(false)
const errorText = ref('')
const serviceBaseUrl = ref('')
const classrooms = ref<FuckSeatsClassroomSummary[]>([])
const selectedKey = ref('')
let loadRequestId = 0

const getClassroomKey = (classroom: FuckSeatsClassroomSummary) => `${classroom.baseUrl}:${classroom.id}`

const selectedClassroom = computed(() => (
  classrooms.value.find(classroom => getClassroomKey(classroom) === selectedKey.value) || null
))

const headerText = computed(() => {
  if (isLoading.value) return '检测本机是否正在运行不想排座位'
  if (errorText.value) return '未检测到可读取的本地服务'
  if (!serviceBaseUrl.value) return '选择一个本地班级，从不想排座位导入'
  return `已连接 ${formatBaseUrl(serviceBaseUrl.value)}`
})

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

const toComparableSeatConfig = (config: Partial<SeatConfig>) => {
  const groups = Array.isArray(config?.groups) ? config.groups : []
  return {
    groupCount: Number(config?.groupCount ?? defaultSeatConfig.groupCount),
    columnsPerGroup: Number(config?.columnsPerGroup ?? defaultSeatConfig.columnsPerGroup),
    seatsPerColumn: Number(config?.seatsPerColumn ?? defaultSeatConfig.seatsPerColumn),
    groups: groups.map(group => ({
      columns: Number(group?.columns ?? defaultSeatConfig.columnsPerGroup),
      rows: Number(group?.rows ?? defaultSeatConfig.seatsPerColumn)
    })),
    shiftDistance: Number(config?.shiftDistance ?? defaultSeatConfig.shiftDistance),
    podiumPosition: config?.podiumPosition || defaultSeatConfig.podiumPosition,
    guardSeats: {
      ...defaultSeatConfig.guardSeats,
      ...(config?.guardSeats || {})
    }
  }
}

const toComparableAttributeDefinitions = (definitions: Array<Partial<NumericAttributeDefinition>>) => (
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

const hasCustomSeatConfig = computed(() => !isSameJson(
  toComparableSeatConfig(seatConfig.value),
  toComparableSeatConfig(defaultSeatConfig)
))

const hasCustomAttributeSettings = computed(() => (
  showNumericAttributesInEditor.value !== true ||
  !isSameJson(
    toComparableAttributeDefinitions(attributeDefinitions.value),
    toComparableAttributeDefinitions(defaultAttributeDefinitions)
  )
))

const hasCustomExportSettings = computed(() => !isSameJson(
  normalizeExportSettings(exportSettings.value),
  normalizeExportSettings()
))

const hasCurrentWorkspaceData = computed(() => (
  students.value.length > 0 ||
  tags.value.length > 0 ||
  seats.value.some(seat => seat.studentId != null || seat.isEmpty) ||
  hasCustomSeatConfig.value ||
  hasCustomAttributeSettings.value ||
  zones.value.length > 0 ||
  rules.value.length > 0 ||
  hasCustomExportSettings.value
))

const importButtonText = computed(() => {
  if (isImporting.value) return '正在从不想排座位导入'
  return '从不想排座位导入'
})

const formatBaseUrl = (value: string) => String(value || '').replace(/^https?:\/\//, '')

const formatCount = (value: number | null, label: string) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return label
  return `${value} ${label}`
}

const close = () => {
  loadRequestId += 1
  emit('update:visible', false)
}

const fallbackExcel = () => {
  close()
  emit('fallback-excel')
}

const loadClassrooms = async () => {
  const requestId = ++loadRequestId
  isLoading.value = true
  errorText.value = ''
  serviceBaseUrl.value = ''
  classrooms.value = []
  selectedKey.value = ''

  try {
    const result = await discoverLocalFuckSeats()
    if (requestId !== loadRequestId || !props.visible) return
    if (result.available === false) {
      const errors = Array.isArray(result.errors) ? result.errors : []
      errorText.value = errors[0]
        ? `未检测到本地不想排座位服务：${errors[0]}`
        : '未检测到本地不想排座位服务'
      if (errors.length > 0) {
        warning(`不想排座位探测失败：${errors.join('；')}`)
      }
      return
    }

    serviceBaseUrl.value = result.baseUrl
    classrooms.value = result.classrooms || []
    const firstClassroom = classrooms.value[0]
    if (firstClassroom) {
      selectedKey.value = getClassroomKey(firstClassroom)
    }
  } catch (err) {
    if (requestId !== loadRequestId || !props.visible) return
    errorText.value = err instanceof Error ? err.message : '检测本地服务失败'
  } finally {
    if (requestId === loadRequestId) {
      isLoading.value = false
    }
  }
}

const executeImport = async () => {
  if (!selectedClassroom.value || isImporting.value) return
  isImporting.value = true

  try {
    const result = await importClassroom(selectedClassroom.value)
    success(`从不想排座位导入完成：${selectedClassroom.value.name}，${result.students} 名学生，${result.assignedSeats} 个座位`)
    emit('imported', result)
    close()
  } catch (err) {
    error(err instanceof Error ? err.message : '从不想排座位导入失败')
  } finally {
    isImporting.value = false
  }
}

const handleImport = async () => {
  if (!selectedClassroom.value || isImporting.value) return

  if (hasCurrentWorkspaceData.value) {
    const confirmed = await confirm({
      title: '覆盖当前工作区',
      content: '从不想排座位导入会覆盖当前名单、标签、座位配置和座位分配，是否继续？',
      positiveText: '覆盖并导入',
      type: 'warning'
    })
    if (!confirmed) return
  }

  await executeImport()
}

watch(() => props.visible, (visible) => {
  if (visible) {
    loadClassrooms()
  } else {
    loadRequestId += 1
  }
})
</script>

<style scoped>

.fs-import-body {
  min-height: 260px;
  overflow: auto;
  padding: 14px;
  background: var(--color-bg-secondary);
}

.fs-import-state {
  min-height: 232px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  text-align: center;
  color: var(--color-text-secondary);
}

.fs-import-state strong {
  color: var(--color-text-primary);
  font-size: 15px;
}

.fs-import-state span {
  font-size: 13px;
}

.fs-state-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.fs-classroom-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fs-classroom-item {
  height: auto;
  min-height: 74px;
  justify-content: flex-start;
  text-align: left;
}

.fs-classroom-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  white-space: normal;
}

.fs-classroom-main,
.fs-classroom-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.fs-classroom-main {
  justify-content: space-between;
}

.fs-classroom-name {
  min-width: 0;
  color: var(--color-text-primary);
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fs-classroom-source {
  color: var(--color-text-muted);
  font-size: 12px;
  flex-shrink: 0;
}

.fs-classroom-meta {
  color: var(--color-text-secondary);
  font-size: 12px;
  flex-wrap: wrap;
}

.fs-classroom-meta span {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--color-bg-subtle);
}

.fs-import-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.fs-footer-action {
  white-space: nowrap;
}

.fs-spin {
  animation: fs-spin 0.9s linear infinite;
}


@keyframes fs-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {

  .fs-import-footer {
    justify-content: stretch;
    flex-wrap: wrap;
  }

  .fs-footer-action {
    flex: 1;
    min-height: 44px;
  }
}
</style>
