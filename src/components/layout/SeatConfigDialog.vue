<template>
  <ResponsiveOverlay :show="visible" title="座位表配置" :desktop-width="920" @update:show="value => !value && handleCancel()">
      <div class="dialog-body">
        <div class="info-tip">
          <p>点击下方按钮来调整每大组的列数和行数</p>
        </div>

        <div class="preview-container">
          <div class="preview-seat-chart" :class="localConfig.podiumPosition === 'top' ? 'align-top' : 'align-bottom'">
            <div v-for="(group, gIndex) in previewGroups" :key="gIndex" class="preview-group">
              <div class="preview-group-content">
                <div v-for="cIndex in group.columns" :key="cIndex" class="preview-column">
                  <div
                    v-for="rIndex in group.rows"
                    :key="rIndex"
                    class="preview-seat"
                    :class="{ 'first-row': (localConfig.podiumPosition === 'bottom' && rIndex === group.rows) || (localConfig.podiumPosition === 'top' && rIndex === 1) }"
                  ></div>
                </div>
              </div>

              <div class="group-controls">
                <div class="group-label">第 {{ gIndex + 1 }} 组</div>
                <div class="control-row">
                  <div class="control-item">
                    <span class="control-label">列数</span>
                    <div class="button-group">
                      <NButton class="control-btn" size="tiny" quaternary circle :aria-label="`减少第 ${gIndex + 1} 组列数`" @click="removeColumn(gIndex)" :disabled="group.columns <= 1">
                        <Minus :size="14" />
                      </NButton>
                      <span class="control-value">{{ group.columns }}</span>
                      <NButton class="control-btn" size="tiny" quaternary circle :aria-label="`增加第 ${gIndex + 1} 组列数`" @click="addColumn(gIndex)" :disabled="group.columns >= 5">
                        <Plus :size="14" />
                      </NButton>
                    </div>
                  </div>
                  <div class="control-item">
                    <span class="control-label">行数</span>
                    <div class="button-group">
                      <NButton class="control-btn" size="tiny" quaternary circle :aria-label="`减少第 ${gIndex + 1} 组行数`" @click="removeRow(gIndex)" :disabled="group.rows <= 1">
                        <Minus :size="14" />
                      </NButton>
                      <span class="control-value">{{ group.rows }}</span>
                      <NButton class="control-btn" size="tiny" quaternary circle :aria-label="`增加第 ${gIndex + 1} 组行数`" @click="addRow(gIndex)" :disabled="group.rows >= 10">
                        <Plus :size="14" />
                      </NButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="global-actions">
          <div class="global-controls">
            <div class="input-group">
              <span id="seat-group-count-label">大组数量</span>
              <div class="input-with-buttons" role="group" aria-labelledby="seat-group-count-label">
                <NButton class="control-btn" size="tiny" quaternary circle aria-label="减少大组数量" @click="removeGroup" :disabled="localConfig.groupCount <= 1">
                  <Minus :size="14" />
                </NButton>
                <span class="group-count-display">{{ localConfig.groupCount }}</span>
                <NButton class="control-btn" size="tiny" quaternary circle aria-label="增加大组数量" @click="addGroup" :disabled="localConfig.groupCount >= maxSeatGroupCount">
                  <Plus :size="14" />
                </NButton>
              </div>
            </div>
            <div class="input-group">
              <span id="podium-position-label">讲台位置</span>
              <div class="alignment-buttons" role="group" aria-labelledby="podium-position-label">
                <NButton
                  class="alignment-btn" 
                  size="small"
                  :type="localConfig.podiumPosition === 'bottom' ? 'primary' : 'default'"
                  :secondary="localConfig.podiumPosition !== 'bottom'"
                  :aria-pressed="localConfig.podiumPosition === 'bottom'"
                  @click="localConfig.podiumPosition = 'bottom'"
                >
                  底部
                </NButton>
                <NButton
                  class="alignment-btn" 
                  size="small"
                  :type="localConfig.podiumPosition === 'top' ? 'primary' : 'default'"
                  :secondary="localConfig.podiumPosition !== 'top'"
                  :aria-pressed="localConfig.podiumPosition === 'top'"
                  @click="localConfig.podiumPosition = 'top'"
                >
                  顶部
                </NButton>
              </div>
            </div>
          </div>
          <div class="quick-actions">
            <NButton size="small" type="primary" secondary @click="applyAllColumns">统一列数</NButton>
            <NButton size="small" type="primary" secondary @click="applyAllRows">统一行数</NButton>
            <NButton size="small" secondary @click="resetConfig">重置</NButton>
          </div>
        </div>

        <div class="total-stats">
          <span>总计：<strong>{{ totalSeats }}</strong> 个座位</span>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <NButton secondary @click="handleCancel">取消</NButton>
          <NButton type="primary" @click="handleConfirm">应用配置</NButton>
        </div>
      </template>
  </ResponsiveOverlay>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NButton } from 'naive-ui'
import { Plus, Minus } from 'lucide-vue-next'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { useSeatChart } from '@/composables/useSeatChart'
import { maxSeatGroupCount } from '@/constants/seatConfig'
import type { GroupConfig, SeatConfig } from '@/types/models'

const props = withDefaults(defineProps<{
  visible?: boolean
  initialConfig?: Partial<SeatConfig> | null
}>(), {
  visible: false,
  initialConfig: null
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: [config: Partial<SeatConfig>]
}>()

const { seatConfig } = useSeatChart()

const localConfig = ref<{
  groupCount: number
  groups: GroupConfig[]
  podiumPosition: SeatConfig['podiumPosition']
}>({
  groupCount: 4,
  groups: [],
  podiumPosition: 'bottom'
})

const uniformValue = ref({
  columns: 2,
  rows: 7
})

watch(() => props.visible, (newVal) => {
  if (newVal) {
    initLocalConfig()
  }
})

// 组件挂载时也初始化一次，确保数据正确
initLocalConfig()

function initLocalConfig() {
  const config: SeatConfig = {
    ...seatConfig.value,
    ...props.initialConfig,
    groups: props.initialConfig?.groups ?? seatConfig.value.groups,
    guardSeats: props.initialConfig?.guardSeats ?? seatConfig.value.guardSeats
  }
  localConfig.value.groupCount = config.groupCount
  localConfig.value.podiumPosition = config.podiumPosition || 'bottom'

  // 重新创建 groups 数组以确保响应式更新
  const newGroups = []
  for (let i = 0; i < config.groupCount; i++) {
    const groupConfig = config.groups && config.groups[i]
      ? { columns: config.groups[i].columns || config.columnsPerGroup, rows: config.groups[i].rows || config.seatsPerColumn }
      : { columns: config.columnsPerGroup, rows: config.seatsPerColumn }
    newGroups.push({ ...groupConfig })
  }
  localConfig.value.groups = newGroups

  if (localConfig.value.groups.length > 0) {
    uniformValue.value.columns = localConfig.value.groups[0].columns
    uniformValue.value.rows = localConfig.value.groups[0].rows
  }
}

const previewGroups = computed(() => {
  // 如果 groups 为空，返回空数组（避免渲染错误）
  if (!localConfig.value.groups || localConfig.value.groups.length === 0) {
    return []
  }

  return localConfig.value.groups.map((group, index) => ({
    ...group,
    index
  }))
})

const totalSeats = computed(() => {
  return localConfig.value.groups.reduce((total, group) => {
    return total + group.columns * group.rows
  }, 0)
})

function addGroup() {
  if (localConfig.value.groupCount >= maxSeatGroupCount) return
  localConfig.value.groupCount++

  // 确保 groups 数组长度与 groupCount 匹配
  while (localConfig.value.groups.length < localConfig.value.groupCount) {
    localConfig.value.groups.push({
      columns: uniformValue.value.columns,
      rows: uniformValue.value.rows
    })
  }
}

function removeGroup() {
  if (localConfig.value.groupCount <= 1) return
  localConfig.value.groupCount--
  localConfig.value.groups.pop()
}

function addColumn(groupIndex: number) {
  const group = localConfig.value.groups[groupIndex]
  if (group && group.columns < 5) {
    group.columns++
  }
}

function removeColumn(groupIndex: number) {
  const group = localConfig.value.groups[groupIndex]
  if (group && group.columns > 1) {
    group.columns--
  }
}

function addRow(groupIndex: number) {
  const group = localConfig.value.groups[groupIndex]
  if (group && group.rows < 10) {
    group.rows++
  }
}

function removeRow(groupIndex: number) {
  const group = localConfig.value.groups[groupIndex]
  if (group && group.rows > 1) {
    group.rows--
  }
}

function applyAllColumns() {
  const firstGroupColumns = localConfig.value.groups[0]?.columns || 2
  localConfig.value.groups.forEach(g => {
    g.columns = firstGroupColumns
  })
}

function applyAllRows() {
  const firstGroupRows = localConfig.value.groups[0]?.rows || 7
  localConfig.value.groups.forEach(g => {
    g.rows = firstGroupRows
  })
}

function resetConfig() {
  initLocalConfig()
}

function handleCancel() {
  emit('update:visible', false)
}

function handleConfirm() {
  const newConfig: Partial<SeatConfig> = {
    groupCount: localConfig.value.groupCount,
    groups: localConfig.value.groups.map(g => ({ ...g })),
    podiumPosition: localConfig.value.podiumPosition
  }
  
  if (localConfig.value.groups.length > 0) {
    newConfig.columnsPerGroup = localConfig.value.groups[0].columns
    newConfig.seatsPerColumn = localConfig.value.groups[0].rows
  }
  
  emit('confirm', newConfig)
}
</script>

<style scoped>

.dialog-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-tip {
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  padding: 12px 16px;
}

.info-tip p {
  margin: 0;
  font-size: 13px;
  color: var(--color-primary);
}

.preview-container {
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  padding: 24px;
  min-height: 0;
  overflow-x: auto;
  flex: 1;
}

.preview-seat-chart {
  display: inline-flex;
  gap: 16px;
  align-items: flex-start;
}

.preview-seat-chart.align-top {
  align-items: flex-start;
}

.preview-seat-chart.align-bottom {
  align-items: flex-end;
}

.preview-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.preview-group-content {
  display: flex;
  gap: 6px;
}

.preview-column {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.preview-seat {
  width: 28px;
  height: 22px;
  background: var(--color-primary);
  border-radius: 4px;
}

.preview-seat.first-row {
  background: var(--color-warning);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-warning) 30%, transparent);
}

.group-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: var(--color-surface);
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  min-width: 100px;
}

.group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
}

.control-row {
  display: flex;
  gap: 10px;
}

.control-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.control-label {
  font-size: 10px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.button-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.control-btn {
  flex: 0 0 auto;
}

.control-btn:focus-visible,
.alignment-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.control-value {
  min-width: 20px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
}

.global-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.global-controls {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.alignment-buttons {
  display: flex;
  gap: 8px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-group > span {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.input-with-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-count-display {
  min-width: 40px;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.quick-actions {
  display: flex;
  gap: 8px;
}

.total-stats {
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  padding: 12px 16px;
  text-align: center;
}

.total-stats span {
  font-size: 14px;
  color: var(--color-primary);
}

.total-stats strong {
  font-size: 18px;
  font-weight: 700;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
  gap: 12px;
}

</style>
