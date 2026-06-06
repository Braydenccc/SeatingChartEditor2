<template>
  <section class="context-inspector">
    <header class="panel-header">
      <div>
        <h2>上下文</h2>
        <p>{{ headerText }}</p>
      </div>
    </header>

    <div class="context-body">
      <div v-if="selectedCount > 1" class="context-section">
        <div class="section-title">多选座位</div>
        <div class="metric-row">
          <span>已选</span>
          <strong>{{ selectedCount }} 个座位</strong>
        </div>
        <div class="action-grid">
          <button :disabled="!hasSelectionStudent" @click="editSelectedSeats">
            <Edit3 :size="14" stroke-width="2" />
            <span>编辑学生</span>
          </button>
          <button :disabled="!hasSelectionStudent" @click="clearSelectedSeats">
            <UserMinus :size="14" stroke-width="2" />
            <span>移出学生</span>
          </button>
          <button :disabled="!canShuffleSelection" @click="shuffleSelectedSeats">
            <component :is="selectedCount === 2 ? ArrowLeftRight : Shuffle" :size="14" stroke-width="2" />
            <span>{{ selectedCount === 2 ? '交换座位' : '打乱座位' }}</span>
          </button>
          <button :disabled="!canAssignSelection" @click="assignSelectedSeats">
            <Sparkles :size="14" stroke-width="2" />
            <span>排入学生</span>
          </button>
          <button @click="clearSelection">
            <X :size="14" stroke-width="2" />
            <span>取消选择</span>
          </button>
        </div>
      </div>

      <div v-else-if="singleSelectedSeat" class="context-section">
        <div class="section-title">选中座位</div>
        <div class="detail-list">
          <div><span>座位</span><strong>{{ singleSelectedSeat.id }}</strong></div>
          <div><span>状态</span><strong>{{ singleSelectedSeat.isEmpty ? '空置' : '可用' }}</strong></div>
          <div><span>学生</span><strong>{{ seatStudentName }}</strong></div>
        </div>
        <div class="action-grid">
          <button :disabled="!singleSelectedSeat.studentId" @click="editSelectedSeats">
            <Edit3 :size="14" stroke-width="2" />
            <span>编辑学生</span>
          </button>
          <button :disabled="!singleSelectedSeat.studentId" @click="clearSingleSelectedSeat">
            <UserMinus :size="14" stroke-width="2" />
            <span>移出学生</span>
          </button>
          <button :disabled="!canAssignSelection" @click="assignSelectedSeats">
            <Sparkles :size="14" stroke-width="2" />
            <span>排入学生</span>
          </button>
          <button @click="toggleSingleSelectedEmpty">
            <LayoutGrid :size="14" stroke-width="2" />
            <span>切换空置</span>
          </button>
          <button @click="clearSelection">
            <X :size="14" stroke-width="2" />
            <span>取消选择</span>
          </button>
        </div>
      </div>

      <div v-else-if="selectedStudent" class="context-section">
        <div class="section-title">选中学生</div>
        <div class="student-card">
          <strong>{{ selectedStudent.name || '未命名' }}</strong>
          <span>{{ selectedStudent.studentNumber || '无学号' }}</span>
        </div>
        <div class="detail-list">
          <div><span>状态</span><strong>{{ selectedStudentSeat ? '已入座' : '未入座' }}</strong></div>
          <div v-if="selectedStudentSeat"><span>座位</span><strong>{{ selectedStudentSeat.id }}</strong></div>
        </div>

        <div class="student-edit-form">
          <label class="field-row">
            <span>姓名</span>
            <input
              class="context-input"
              :value="selectedStudent.name"
              placeholder="未命名"
              @change="handleSelectedStudentNameChange($event.target.value)"
              @keydown.enter="$event.target.blur()"
            />
          </label>
          <label class="field-row">
            <span>学号</span>
            <input
              class="context-input"
              type="number"
              :value="selectedStudent.studentNumber ?? ''"
              placeholder="可选"
              @change="handleSelectedStudentNumberChange($event.target.value)"
              @keydown.enter="$event.target.blur()"
            />
          </label>

          <div v-if="enabledStudentAttributes.length > 0" class="student-edit-section">
            <div class="section-subtitle">数值属性</div>
            <div class="field-grid">
              <label
                v-for="attribute in enabledStudentAttributes"
                :key="attribute.id"
                class="field-row"
              >
                <span>{{ attribute.unit ? `${attribute.name}（${attribute.unit}）` : attribute.name }}</span>
                <input
                  class="context-input"
                  type="number"
                  :step="getAttributeStep(attribute)"
                  :min="attribute.min ?? undefined"
                  :max="attribute.max ?? undefined"
                  :value="getSelectedNumericValue(attribute.id)"
                  @change="handleSelectedNumericChange(attribute, $event.target.value)"
                  @keydown.enter="$event.target.blur()"
                />
              </label>
            </div>
          </div>

          <div class="student-edit-section">
            <div class="section-subtitle">标签</div>
            <div v-if="tags.length > 0" class="tag-toggle-list">
              <button
                v-for="tag in tags"
                :key="tag.id"
                class="tag-toggle"
                :class="{ active: isSelectedStudentTagActive(tag.id) }"
                :style="{ '--student-tag-color': tag.color }"
                @click="toggleSelectedStudentTag(tag.id)"
              >
                <span class="tag-dot"></span>
                <span class="tag-name">{{ tag.name || '未命名标签' }}</span>
                <Check v-if="isSelectedStudentTagActive(tag.id)" :size="12" stroke-width="2.5" />
              </button>
            </div>
            <div v-else class="empty-hint">暂无标签，可在名单与属性中新增</div>
          </div>
        </div>

        <button class="full-action" @click="clearStudentSelection">取消选择</button>
      </div>

      <div v-else class="context-section">
        <div class="section-title">工作台状态</div>
        <div class="detail-list">
          <div><span>当前模式</span><strong>{{ modeLabel }}</strong></div>
          <div><span>座位总数</span><strong>{{ totalSeats }}</strong></div>
          <div><span>已入座</span><strong>{{ assignedCount }}</strong></div>
          <div><span>未入座</span><strong>{{ unassignedCount }}</strong></div>
        </div>
      </div>

      <div class="context-section recent-section">
        <div class="section-title">最近状态</div>
        <p v-if="latestLog">{{ latestLog.message }}</p>
        <p v-else>暂无日志</p>
      </div>
    </div>

    <BatchEditDialog
      v-model:visible="showBatchEditDialog"
      :studentIds="batchEditStudentIds"
    />

    <StudentEditDialog
      v-model:visible="showStudentEditDialog"
      :studentId="editingStudentId"
    />
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ArrowLeftRight, Check, Edit3, LayoutGrid, Shuffle, Sparkles, UserMinus, X } from 'lucide-vue-next'
import BatchEditDialog from '@/components/student/BatchEditDialog.vue'
import StudentEditDialog from '@/components/student/StudentEditDialog.vue'
import { useEditMode } from '@/composables/useEditMode'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'
import { useSelection } from '@/composables/useSelection'
import { useStudentData } from '@/composables/useStudentData'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useTagData } from '@/composables/useTagData'
import { useUndo } from '@/composables/useUndo'

const { currentMode, EditMode } = useEditMode()
const { logs, success, warning } = useLogger()
const { seats, seatConfig, getSeat, clearSeat, toggleEmpty, getStudentAtSeat, findSeatByStudent, assignStudent, swapSeats } = useSeatChart()
const { selectedCount, selectedSeatsArray, clearSelection, isSelectionMode } = useSelection()
const { students, selectedStudentId, updateStudent, clearSelection: clearStudentSelection } = useStudentData()
const { tags } = useTagData()
const { enabledAttributeDefinitions, parseNumericValue } = useStudentAttributes()
const { recordBatch, createSnapshot } = useUndo()

const modeLabel = computed(() => {
  if (isSelectionMode.value) return '多选座位'
  const labels = {
    [EditMode.NORMAL]: '普通分配',
    [EditMode.SWAP]: '交换座位',
    [EditMode.CLEAR]: '清空座位',
    [EditMode.EMPTY_EDIT]: '空置编辑',
    [EditMode.ZONE_EDIT]: '选区编辑'
  }
  return labels[currentMode.value] || '普通分配'
})

const totalSeats = computed(() => {
  const config = seatConfig.value
  if (config.groups?.length) {
    return config.groups.slice(0, config.groupCount).reduce((sum, group) => {
      return sum + (group.columns || config.columnsPerGroup) * (group.rows || config.seatsPerColumn)
    }, 0)
  }
  return config.groupCount * config.columnsPerGroup * config.seatsPerColumn
})

const assignedCount = computed(() => seats.value.filter(seat => seat.studentId != null).length)
const unassignedCount = computed(() => students.value.filter(student => !findSeatByStudent(student.id)).length)
const latestLog = computed(() => logs.value[0] || null)

const selectedStudent = computed(() => students.value.find(student => student.id === selectedStudentId.value) || null)
const selectedStudentSeat = computed(() => selectedStudent.value ? findSeatByStudent(selectedStudent.value.id) : null)
const singleSelectedSeat = computed(() => selectedCount.value === 1 ? getSeat(selectedSeatsArray.value[0]) : null)
const enabledStudentAttributes = computed(() => enabledAttributeDefinitions.value)
const showBatchEditDialog = ref(false)
const batchEditStudentIds = ref([])
const showStudentEditDialog = ref(false)
const editingStudentId = ref(null)

const seatStudentName = computed(() => {
  const studentId = singleSelectedSeat.value ? getStudentAtSeat(singleSelectedSeat.value.id) : null
  if (studentId == null) return '无'
  const student = students.value.find(item => item.id === studentId)
  return student?.name || '未命名'
})

const selectedSeatStudentIds = computed(() => {
  const ids = selectedSeatsArray.value
    .map(seatId => getStudentAtSeat(seatId))
    .filter(studentId => studentId !== null && studentId !== undefined)
  return Array.from(new Set(ids))
})

const hasSelectionStudent = computed(() => selectedSeatStudentIds.value.length > 0)

const canShuffleSelection = computed(() => {
  if (selectedCount.value < 2) return false
  return selectedSeatStudentIds.value.length >= 2
})

const assignableSeatIds = computed(() => selectedSeatsArray.value.filter(seatId => {
  const seat = getSeat(seatId)
  return seat && !seat.isEmpty && getStudentAtSeat(seatId) == null
}))

const canAssignSelection = computed(() => (
  assignableSeatIds.value.length > 0 && unassignedCount.value > 0
))

const headerText = computed(() => {
  if (selectedCount.value > 1) return `已选择 ${selectedCount.value} 个座位`
  if (singleSelectedSeat.value) return singleSelectedSeat.value.id
  if (selectedStudent.value) return selectedStudent.value.name || '未命名学生'
  return modeLabel.value
})

const handleSelectedStudentNameChange = (value) => {
  if (!selectedStudent.value) return
  updateStudent(selectedStudent.value.id, { name: value })
}

const handleSelectedStudentNumberChange = (value) => {
  if (!selectedStudent.value) return
  const normalized = value === '' || value === null || value === undefined
    ? null
    : Number(value)
  updateStudent(selectedStudent.value.id, {
    studentNumber: Number.isFinite(normalized) ? normalized : null
  })
}

const getAttributeStep = (attribute) => {
  const precision = Math.max(0, Number(attribute.precision ?? 0))
  return precision === 0 ? 1 : Number(`0.${'0'.repeat(Math.max(0, precision - 1))}1`)
}

const getSelectedNumericValue = (attributeId) => {
  const value = selectedStudent.value?.numericAttributes?.[attributeId]
  return value === null || value === undefined ? '' : value
}

const normalizeSelectedNumericValue = (value, attribute) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = parseNumericValue(value, { ...attribute, min: null, max: null })
  if (parsed === null) return undefined
  let nextValue = parsed
  if (attribute.min !== null && attribute.min !== undefined && nextValue < attribute.min) {
    nextValue = attribute.min
  }
  if (attribute.max !== null && attribute.max !== undefined && nextValue > attribute.max) {
    nextValue = attribute.max
  }
  const precision = Math.max(0, Number(attribute.precision ?? 0))
  return precision > 0 ? Number(nextValue.toFixed(precision)) : Math.round(nextValue)
}

const handleSelectedNumericChange = (attribute, value) => {
  if (!selectedStudent.value) return
  const normalized = normalizeSelectedNumericValue(value, attribute)
  if (normalized === undefined) return
  updateStudent(selectedStudent.value.id, {
    numericAttributes: {
      ...(selectedStudent.value.numericAttributes || {}),
      [attribute.id]: normalized
    }
  })
}

const isSelectedStudentTagActive = (tagId) => {
  return selectedStudent.value?.tags?.includes(tagId) || false
}

const toggleSelectedStudentTag = (tagId) => {
  if (!selectedStudent.value) return
  const currentTags = selectedStudent.value.tags || []
  const nextTags = currentTags.includes(tagId)
    ? currentTags.filter(id => id !== tagId)
    : [...currentTags, tagId]
  updateStudent(selectedStudent.value.id, { tags: nextTags })
}

const editSelectedSeats = () => {
  const studentIds = selectedSeatStudentIds.value
  if (studentIds.length === 0) return
  if (studentIds.length === 1) {
    editingStudentId.value = studentIds[0]
    showStudentEditDialog.value = true
    return
  }
  batchEditStudentIds.value = studentIds
  showBatchEditDialog.value = true
}

const clearSingleSelectedSeat = () => {
  if (!singleSelectedSeat.value?.studentId) return
  clearSeat(singleSelectedSeat.value.id)
  clearSelection()
}

const toggleSingleSelectedEmpty = () => {
  if (!singleSelectedSeat.value) return
  toggleEmpty(singleSelectedSeat.value.id)
}

const clearSelectedSeats = () => {
  if (selectedCount.value === 0) return
  const before = createSnapshot()
  for (const seatId of selectedSeatsArray.value) {
    if (getStudentAtSeat(seatId) != null) clearSeat(seatId, false)
  }
  const after = createSnapshot()
  recordBatch(before, after)
  success(`已移出 ${selectedCount.value} 个座位中的学生`)
  clearSelection()
}

const shuffleSelectedSeats = () => {
  if (selectedCount.value < 2) {
    warning('至少选择两个座位才能打乱')
    return
  }
  const ids = selectedSeatsArray.value
  const studentIds = ids.map(id => getStudentAtSeat(id)).filter(Boolean)
  if (studentIds.length < 2) {
    warning('选中座位中的学生不足两个')
    return
  }
  const before = createSnapshot()
  if (ids.length === 2) {
    const [seatA, seatB] = ids
    const studentA = getStudentAtSeat(seatA)
    const studentB = getStudentAtSeat(seatB)
    if (studentA && studentB) {
      swapSeats(seatA, seatB, false)
    } else if (studentA || studentB) {
      const fromSeat = studentA ? seatA : seatB
      const toSeat = studentA ? seatB : seatA
      clearSeat(fromSeat, false)
      assignStudent(toSeat, studentA || studentB, false)
    }
  } else {
    for (let i = studentIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [studentIds[i], studentIds[j]] = [studentIds[j], studentIds[i]]
    }
    const occupiedIds = ids.filter(id => getStudentAtSeat(id))
    for (const seatId of occupiedIds) clearSeat(seatId, false)
    for (let i = 0; i < occupiedIds.length; i++) {
      assignStudent(occupiedIds[i], studentIds[i], false)
    }
  }
  const after = createSnapshot()
  recordBatch(before, after)
  success('已打乱选中座位')
}

const assignSelectedSeats = () => {
  const emptyIds = assignableSeatIds.value
  const unassigned = students.value.filter(student => !findSeatByStudent(student.id))
  if (emptyIds.length === 0 || unassigned.length === 0) return

  const shuffled = [...unassigned].sort(() => Math.random() - 0.5)
  const count = Math.min(emptyIds.length, shuffled.length)
  const before = createSnapshot()
  for (let i = 0; i < count; i++) {
    assignStudent(emptyIds[i], shuffled[i].id, false)
  }
  const after = createSnapshot()
  recordBatch(before, after)
  success(`已排入 ${count} 名学生`)
  clearSelection()
}
</script>

<style scoped>
.context-inspector {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

.panel-header {
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
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.context-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
}

.context-section {
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  margin-bottom: 12px;
}

.section-title {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-list div,
.metric-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}

.detail-list span,
.metric-row span {
  color: var(--color-text-secondary);
}

.detail-list strong,
.metric-row strong {
  color: var(--color-text-primary);
  text-align: right;
  overflow-wrap: anywhere;
}

.student-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 10px;
}

.student-card strong {
  color: var(--color-text-primary);
  font-size: 17px;
}

.student-card span {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.student-edit-form {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.student-edit-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-subtitle {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.field-row {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-row span {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.context-input {
  width: 100%;
  min-height: 32px;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  padding: 0 9px;
  font-size: 13px;
}

.context-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.tag-toggle-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-toggle {
  max-width: 100%;
  min-height: 30px;
  border: 1px solid color-mix(in srgb, var(--student-tag-color) 45%, var(--color-border));
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
}

.tag-toggle:hover {
  background: color-mix(in srgb, var(--student-tag-color) 10%, var(--color-surface));
  border-color: color-mix(in srgb, var(--student-tag-color) 70%, var(--color-border));
}

.tag-toggle.active {
  background: color-mix(in srgb, var(--student-tag-color) 16%, var(--color-surface));
  border-color: var(--student-tag-color);
}

.tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--student-tag-color);
  flex-shrink: 0;
}

.tag-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-hint {
  border: 1px dashed var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  padding: 8px;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 12px;
}

.action-grid button,
.full-action {
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;
}

.action-grid button:hover:not(:disabled),
.full-action:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.action-grid button:disabled {
  color: var(--color-text-disabled);
  cursor: not-allowed;
}

.recent-section p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}
</style>
