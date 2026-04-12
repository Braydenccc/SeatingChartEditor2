<template>
  <div v-if="visible" class="seat-config-dialog-overlay" @click.self="handleCancel">
    <div class="seat-config-dialog">
      <div class="dialog-header">
        <h2>座位表配置</h2>
        <button class="close-btn" @click="handleCancel">
          <X :size="20" />
        </button>
      </div>

      <div class="dialog-body">
        <div class="info-tip">
          <p>点击下方按钮来调整每大组的列数和行数</p>
        </div>

        <div class="preview-container">
          <div class="preview-seat-chart" :class="localConfig.seatAlignment === 'top' ? 'align-top' : 'align-bottom'">
            <div v-for="(group, gIndex) in previewGroups" :key="gIndex" class="preview-group">
              <div class="preview-group-content">
                <div v-for="(col, cIndex) in group.columns" :key="cIndex" class="preview-column">
                  <div 
                    v-for="(seat, rIndex) in group.rows" 
                    :key="rIndex" 
                    class="preview-seat"
                    :class="{ 'first-row': (localConfig.seatAlignment === 'bottom' && rIndex === group.rows - 1) || (localConfig.seatAlignment === 'top' && rIndex === 0) }"
                  ></div>
                </div>
              </div>

              <div class="group-controls">
                <div class="group-label">第 {{ gIndex + 1 }} 组</div>
                <div class="control-row">
                  <div class="control-item">
                    <span class="control-label">列数</span>
                    <div class="button-group">
                      <button class="control-btn" @click="removeColumn(gIndex)" :disabled="group.columns <= 1">
                        <Minus :size="14" />
                      </button>
                      <span class="control-value">{{ group.columns }}</span>
                      <button class="control-btn" @click="addColumn(gIndex)" :disabled="group.columns >= 5">
                        <Plus :size="14" />
                      </button>
                    </div>
                  </div>
                  <div class="control-item">
                    <span class="control-label">行数</span>
                    <div class="button-group">
                      <button class="control-btn" @click="removeRow(gIndex)" :disabled="group.rows <= 1">
                        <Minus :size="14" />
                      </button>
                      <span class="control-value">{{ group.rows }}</span>
                      <button class="control-btn" @click="addRow(gIndex)" :disabled="group.rows >= 10">
                        <Plus :size="14" />
                      </button>
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
              <label>大组数量</label>
              <div class="input-with-buttons">
                <button class="control-btn" @click="removeGroup" :disabled="localConfig.groupCount <= 1">
                  <Minus :size="14" />
                </button>
                <span class="group-count-display">{{ localConfig.groupCount }}</span>
                <button class="control-btn" @click="addGroup" :disabled="localConfig.groupCount >= 10">
                  <Plus :size="14" />
                </button>
              </div>
            </div>
            <div class="input-group">
              <label>讲台位置</label>
              <div class="alignment-buttons">
                <button 
                  class="alignment-btn" 
                  :class="{ active: localConfig.podiumPosition === 'bottom' }"
                  @click="localConfig.podiumPosition = 'bottom'"
                >
                  底部
                </button>
                <button 
                  class="alignment-btn" 
                  :class="{ active: localConfig.podiumPosition === 'top' }"
                  @click="localConfig.podiumPosition = 'top'"
                >
                  顶部
                </button>
              </div>
            </div>
            <div class="input-group">
              <label>座位对齐方式</label>
              <div class="alignment-buttons">
                <button 
                  class="alignment-btn" 
                  :class="{ active: localConfig.seatAlignment === 'bottom' }"
                  @click="localConfig.seatAlignment = 'bottom'"
                >
                  对齐底部
                </button>
                <button 
                  class="alignment-btn" 
                  :class="{ active: localConfig.seatAlignment === 'top' }"
                  @click="localConfig.seatAlignment = 'top'"
                >
                  对齐顶部
                </button>
              </div>
            </div>
          </div>
          <div class="quick-actions">
            <button class="quick-btn" @click="applyAllColumns">统一列数</button>
            <button class="quick-btn" @click="applyAllRows">统一行数</button>
            <button class="quick-btn" @click="resetConfig">重置</button>
          </div>
        </div>

        <div class="total-stats">
          <span>总计：<strong>{{ totalSeats }}</strong> 个座位</span>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="cancel-btn" @click="handleCancel">取消</button>
        <button 
          class="confirm-btn" 
          :class="{ 'confirming': isConfirming }"
          @click="handleConfirm"
        >
          <span v-if="isConfirming">再次点击确认清空</span>
          <span v-else>应用配置并清空</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { X, Plus, Minus } from 'lucide-vue-next'
import { useSeatChart } from '@/composables/useSeatChart'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  isConfirming: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'confirm'])

const { seatConfig, updateConfig } = useSeatChart()

const localConfig = ref({
  groupCount: 4,
  groups: [],
  podiumPosition: 'bottom',
  seatAlignment: 'bottom'
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

function initLocalConfig() {
  const config = seatConfig.value
  localConfig.value.groupCount = config.groupCount
  localConfig.value.podiumPosition = config.podiumPosition || 'bottom'
  localConfig.value.seatAlignment = config.seatAlignment || 'bottom'
  localConfig.value.groups = []
  
  for (let i = 0; i < config.groupCount; i++) {
    const groupConfig = config.groups && config.groups[i] 
      ? { columns: config.groups[i].columns || config.columnsPerGroup, rows: config.groups[i].rows || config.seatsPerColumn }
      : { columns: config.columnsPerGroup, rows: config.seatsPerColumn }
    localConfig.value.groups.push({ ...groupConfig })
  }
  
  if (localConfig.value.groups.length > 0) {
    uniformValue.value.columns = localConfig.value.groups[0].columns
    uniformValue.value.rows = localConfig.value.groups[0].rows
  }
}

const previewGroups = computed(() => {
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
  if (localConfig.value.groupCount >= 10) return
  localConfig.value.groupCount++
  localConfig.value.groups.push({
    columns: uniformValue.value.columns,
    rows: uniformValue.value.rows
  })
}

function removeGroup() {
  if (localConfig.value.groupCount <= 1) return
  localConfig.value.groupCount--
  localConfig.value.groups.pop()
}

function addColumn(groupIndex) {
  const group = localConfig.value.groups[groupIndex]
  if (group && group.columns < 5) {
    group.columns++
  }
}

function removeColumn(groupIndex) {
  const group = localConfig.value.groups[groupIndex]
  if (group && group.columns > 1) {
    group.columns--
  }
}

function addRow(groupIndex) {
  const group = localConfig.value.groups[groupIndex]
  if (group && group.rows < 10) {
    group.rows++
  }
}

function removeRow(groupIndex) {
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
  const newConfig = {
    groupCount: localConfig.value.groupCount,
    groups: localConfig.value.groups.map(g => ({ ...g })),
    podiumPosition: localConfig.value.podiumPosition,
    seatAlignment: localConfig.value.seatAlignment
  }
  
  if (localConfig.value.groups.length > 0) {
    newConfig.columnsPerGroup = localConfig.value.groups[0].columns
    newConfig.seatsPerColumn = localConfig.value.groups[0].rows
  }
  
  emit('confirm', newConfig)
}
</script>

<style scoped>
.seat-config-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.seat-config-dialog {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e8eef2;
}

.dialog-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #23587b;
}

.close-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 4px;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-tip {
  background: #f0f7fb;
  border: 1px solid #cfe0f0;
  border-radius: 8px;
  padding: 12px 16px;
}

.info-tip p {
  margin: 0;
  font-size: 13px;
  color: #23587b;
}

.preview-container {
  background: #f8f9fa;
  border: 1px solid #e8eef2;
  border-radius: 8px;
  padding: 24px;
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
  background: #23587b;
  border-radius: 4px;
}

.preview-seat.first-row {
  background: #d97706;
  box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.3);
}

.group-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: white;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  min-width: 100px;
}

.group-label {
  font-size: 12px;
  font-weight: 600;
  color: #23587b;
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
  color: #666;
  font-weight: 500;
}

.button-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid #ddd;
  background: white;
  color: #333;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.control-btn:hover:not(:disabled) {
  border-color: #23587b;
  color: #23587b;
  background: #f0f7fb;
}

.control-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.control-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.control-value {
  min-width: 20px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #23587b;
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

.alignment-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  color: #666;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.alignment-btn:hover {
  border-color: #23587b;
  color: #23587b;
}

.alignment-btn.active {
  border-color: #23587b;
  background: #23587b;
  color: white;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-group label {
  font-size: 12px;
  color: #666;
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
  color: #23587b;
}

.quick-actions {
  display: flex;
  gap: 8px;
}

.quick-btn {
  padding: 8px 16px;
  border: 1px solid #23587b;
  background: white;
  color: #23587b;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-btn:hover {
  background: #23587b;
  color: white;
}

.total-stats {
  background: #f0f7fb;
  border: 1px solid #cfe0f0;
  border-radius: 8px;
  padding: 12px 16px;
  text-align: center;
}

.total-stats span {
  font-size: 14px;
  color: #23587b;
}

.total-stats strong {
  font-size: 18px;
  font-weight: 700;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e8eef2;
}

.cancel-btn,
.confirm-btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn {
  border: 1px solid #ddd;
  background: white;
  color: #666;
}

.cancel-btn:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.confirm-btn {
  border: none;
  background: #23587b;
  color: white;
}

.confirm-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(35, 88, 123, 0.3);
}

.confirm-btn:active {
  transform: translateY(0);
}

.confirm-btn.confirming {
  background: #dc2626;
}

.confirm-btn.confirming:hover {
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
}
</style>
