<template>
  <div class="student-list-header">
    <div class="header-left">
      <template v-if="students.length === 0">
        <div class="status-block empty-state">
          <div class="status-indicator"></div>
          <span class="status-text">暂无学生数据</span>
        </div>
      </template>
      <template v-else>
        <div class="status-block">
          <div class="status-indicator" :class="modeClass"></div>
          <span class="status-text">{{ modeLabel }}</span>
          <span class="candidate-count" v-if="unassignedCount > 0">
            {{ unassignedCount }}
          </span>
        </div>
        <div class="header-actions">
          <button v-if="currentMode !== EditMode.NORMAL" class="icon-btn btn-ghost" title="退出当前模式" @click="exitCurrentMode">
            <X :size="14" stroke-width="2.5" />
            <span>{{ currentMode === EditMode.ZONE_EDIT ? '完成' : '取消' }}</span>
          </button>
          <button v-else class="icon-btn btn-primary-light" title="开始导出" @click="showExportDialog = true">
            <FileOutput :size="14" stroke-width="2.5" />
            <span>导出</span>
          </button>
        </div>
      </template>
    </div>
    <div class="header-divider"></div>
    <div class="header-right">
      <button v-if="unassignedCount > 0" class="icon-btn btn-primary" title="随机排位" @click="handleRandomAssign">
        <Shuffle :size="15" stroke-width="2.5" />
        <span>一键排入</span>
      </button>
      <button class="icon-btn" title="标签设置" @click="emit('open-tag-settings')">
        <Tag :size="15" stroke-width="2.5" />
        <span>标签</span>
      </button>
      <button class="icon-btn" title="编辑名单" @click="emit('open-roster')">
        <Users :size="15" stroke-width="2.5" />
        <span>名单</span>
      </button>
    </div>

    <!-- 导出设置弹窗 -->
    <ExportDialog v-if="showExportDialog" :visible="showExportDialog" @close="showExportDialog = false" @exported="onExported" />
  </div>
</template>

<script setup>
import { computed, ref, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { Shuffle, Users, Tag, X, FileOutput } from 'lucide-vue-next'
import { useStudentData } from '@/composables/useStudentData'
import { useSeatChart } from '@/composables/useSeatChart'
import { useEditMode } from '@/composables/useEditMode'
import { useLogger } from '@/composables/useLogger'
import { useUndo } from '@/composables/useUndo'

const ExportDialog = defineAsyncComponent(() => import('../layout/ExportPreview.vue'))

const props = defineProps({
  unassignedCount: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['open-tag-settings', 'open-roster', 'random-assign'])

const { students } = useStudentData()
const { findSeatByStudent, getEmptySeats, assignStudent } = useSeatChart()
const { currentMode, setMode, EditMode, clearFirstSelectedSeat } = useEditMode()
const { success, warning } = useLogger()
const { recordBatch, createSnapshot } = useUndo()

const showExportDialog = ref(false)
const lastExportUrl = ref('')
let lastExportObjectUrl = ''

const unassignedStudents = computed(() => {
  return students.value.filter(student => !findSeatByStudent(student.id))
})

const modeClass = computed(() => {
  const modeMap = {
    [EditMode.NORMAL]: 'mode-normal',
    [EditMode.SWAP]: 'mode-swap',
    [EditMode.CLEAR]: 'mode-clear',
    [EditMode.EMPTY_EDIT]: 'mode-empty_edit',
    [EditMode.ZONE_EDIT]: 'mode-zone_edit'
  }
  return modeMap[currentMode.value] || 'mode-normal'
})

const modeLabel = computed(() => {
  switch (currentMode.value) {
    case EditMode.NORMAL:
      return '正常分配'
    case EditMode.SWAP:
      return '交换座位'
    case EditMode.CLEAR:
      return '清空座位'
    case EditMode.EMPTY_EDIT:
      return '空置座位'
    case EditMode.ZONE_EDIT:
      return '选区编辑'
    default:
      return '正常分配'
  }
})

const exitCurrentMode = () => {
  setMode(EditMode.NORMAL)
  clearFirstSelectedSeat()
}

const handleRandomAssign = () => {
  if (unassignedStudents.value.length === 0) {
    warning('没有需要分配的学生候选')
    return
  }

  const emptySeats = getEmptySeats()
  if (emptySeats.length === 0) {
    warning('没有空余座位可用')
    return
  }

  const candidates = [...unassignedStudents.value]
  const shuffledSeats = [...emptySeats]
  for (let i = shuffledSeats.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledSeats[i], shuffledSeats[j]] = [shuffledSeats[j], shuffledSeats[i]]
  }

  let assignedCount = 0
  const beforeSnapshot = createSnapshot()
  for (let i = 0; i < candidates.length && i < shuffledSeats.length; i++) {
    assignStudent(shuffledSeats[i].id, candidates[i].id, false)
    assignedCount++
  }
  const afterSnapshot = createSnapshot()
  recordBatch(beforeSnapshot, afterSnapshot)

  success(`已随机入座 ${assignedCount} 名学生！`)
  emit('random-assign')
}

const onExported = (payload) => {
  if (!(payload instanceof Blob)) {
    if (lastExportObjectUrl) {
      URL.revokeObjectURL(lastExportObjectUrl)
      lastExportObjectUrl = ''
    }
    lastExportUrl.value = ''
    return
  }
  if (lastExportObjectUrl) {
    URL.revokeObjectURL(lastExportObjectUrl)
  }
  lastExportObjectUrl = URL.createObjectURL(payload)
  lastExportUrl.value = lastExportObjectUrl
}

onBeforeUnmount(() => {
  if (lastExportObjectUrl) {
    URL.revokeObjectURL(lastExportObjectUrl)
    lastExportObjectUrl = ''
  }
})
</script>

<style scoped>
.student-list-header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  gap: 4px;
  min-height: 48px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.header-divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
  flex-shrink: 0;
}

.status-block {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-block.empty-state .status-indicator {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--color-border);
}

.status-indicator {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  background: var(--color-primary);
  transition: background 0.2s ease;
}

.status-indicator.mode-swap { background: var(--color-mode-swap); }
.status-indicator.mode-clear { background: var(--color-danger-text); }
.status-indicator.mode-empty_edit { background: var(--color-mode-empty); }
.status-indicator.mode-zone_edit { background: var(--color-mode-zone); }

.status-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.candidate-count {
  background: var(--color-primary);
  color: var(--color-surface);
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
  line-height: 1.6;
  min-width: 18px;
  text-align: center;
  box-shadow: 0 1px 3px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.header-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
  line-height: 1;
}

.icon-btn:hover {
  background: var(--color-bg-secondary);
  color: var(--color-primary);
  border-color: var(--color-border-strong);
}

.icon-btn:active {
  transform: scale(0.97);
}

.icon-btn.btn-primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: transparent;
  box-shadow: 0 1px 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.icon-btn.btn-primary:hover {
  background: var(--color-primary-hover);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--color-primary) 30%, transparent);
  color: var(--color-text-inverse);
  border-color: transparent;
  transform: translateY(-1px);
}

.icon-btn.btn-primary:active {
  transform: translateY(0) scale(0.97);
}

.icon-btn.btn-primary-light {
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  color: var(--color-primary);
  border: 1px solid color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.icon-btn.btn-primary-light:hover {
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
  color: var(--color-primary-hover);
}

.icon-btn.btn-ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-bg-secondary);
}

.icon-btn.btn-ghost:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}

@media (max-width: 1366px) and (min-width: 1025px) {
  .student-list-header {
    padding: 8px 12px;
    gap: 4px;
  }

  .header-divider {
    height: 20px;
  }

  .icon-btn {
    padding: 4px 8px;
    font-size: 11px;
  }

  .status-text {
    font-size: 12px;
  }
}

@media (max-height: 820px) and (min-width: 1025px) {
  .student-list-header {
    padding: 7px 10px;
    gap: 3px;
  }

  .header-divider {
    height: 18px;
  }

  .icon-btn {
    padding: 4px 7px;
    font-size: 11px;
  }

  .status-text {
    font-size: 11px;
  }
}

@media (max-width: 768px) {
  .student-list-header {
    padding: 6px 10px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    flex-wrap: nowrap;
  }

  .student-list-header::-webkit-scrollbar {
    display: none;
  }

  .header-divider {
    display: none;
  }

  .header-left {
    flex-shrink: 1;
    min-width: 0;
    gap: 8px;
  }

  .header-actions {
    margin-left: auto;
  }

  .header-right {
    flex-shrink: 0;
    gap: 4px;
  }

  .icon-btn {
    padding: 5px 7px;
    font-size: 11px;
  }

  .status-text {
    font-size: 12px;
  }

  .status-indicator,
  .status-block.empty-state .status-indicator {
    height: 12px;
  }
}
</style>
