<template>
  <transition name="dialog-fade">
    <div v-if="visible" class="student-roster-overlay" @mousedown.self="close">
      <div class="student-roster-dialog">
        <div class="dialog-header">
          <h3>名单与属性</h3>
          <button class="close-btn" @click="close" aria-label="关闭">
            <X :size="18" />
          </button>
        </div>

        <div class="dialog-body">
          <aside class="roster-context">
            <div class="context-header">
              <span class="context-eyebrow">表头菜单</span>
              <h3>{{ contextTitle }}</h3>
              <p>{{ contextDescription }}</p>
            </div>

            <div v-if="activeContext.type === 'overview'" class="context-panel">
              <div class="summary-grid">
                <div class="summary-card">
                  <span class="summary-value">{{ attributeDefinitions.length }}</span>
                  <span class="summary-label">数值属性</span>
                </div>
                <div class="summary-card">
                  <span class="summary-value">{{ tags.length }}</span>
                  <span class="summary-label">标签</span>
                </div>
              </div>

              <div class="quick-actions">
                <button class="context-action-btn" @click="handleAddAttributeFromHeader">
                  <BarChart3 :size="15" />
                  <span>新增数值属性</span>
                </button>
                <button class="context-action-btn" @click="handleAddTagFromHeader">
                  <Tag :size="15" />
                  <span>新增标签</span>
                </button>
              </div>

              <div class="context-list">
                <button
                  v-for="attribute in attributeDefinitions"
                  :key="attribute.id"
                  class="context-list-item"
                  @click="openAttributeContext(attribute.id)"
                >
                  <BarChart3 :size="14" />
                  <span>{{ attribute.name }}</span>
                  <small>{{ attribute.enabled === false ? '已隐藏' : attribute.unit }}</small>
                </button>
                <button
                  v-for="tag in tags"
                  :key="tag.id"
                  class="context-list-item tag-item"
                  :style="{ '--tag-color': tag.color }"
                  @click="openTagContext(tag.id)"
                >
                  <span class="tag-swatch"></span>
                  <span>{{ tag.name || '未命名标签' }}</span>
                  <small>{{ getTagStudentCount(tag.id) }}人</small>
                </button>
              </div>
            </div>

            <div v-else-if="activeContext.type === 'attribute' && activeAttribute" class="context-panel">
              <div class="form-stack">
                <label class="field-row">
                  <span>属性名</span>
                  <input
                    class="context-input"
                    :value="activeAttribute.name"
                    @change="updateActiveAttribute({ name: $event.target.value })"
                  />
                </label>
                <label class="field-row">
                  <span>单位</span>
                  <input
                    class="context-input"
                    :value="activeAttribute.unit"
                    placeholder="可选"
                    @change="updateActiveAttribute({ unit: $event.target.value })"
                  />
                </label>
                <div class="field-grid">
                  <label class="field-row">
                    <span>最小值</span>
                    <input
                      class="context-input"
                      type="number"
                      :value="activeAttribute.min ?? ''"
                      @change="updateActiveAttribute({ min: parseOptionalNumber($event.target.value) })"
                    />
                  </label>
                  <label class="field-row">
                    <span>最大值</span>
                    <input
                      class="context-input"
                      type="number"
                      :value="activeAttribute.max ?? ''"
                      @change="updateActiveAttribute({ max: parseOptionalNumber($event.target.value) })"
                    />
                  </label>
                </div>
                <label class="field-row">
                  <span>小数位</span>
                  <input
                    class="context-input"
                    type="number"
                    min="0"
                    :value="activeAttribute.precision ?? 0"
                    @change="updateActiveAttribute({ precision: normalizePrecision($event.target.value) })"
                  />
                </label>
                <label class="switch-row">
                  <span>启用为表格列</span>
                  <input
                    type="checkbox"
                    :checked="activeAttribute.enabled !== false"
                    @change="updateActiveAttribute({ enabled: $event.target.checked })"
                  />
                </label>
                <label class="switch-row" :class="{ disabled: !showNumericAttributesInEditor }">
                  <span>在编辑器显示</span>
                  <input
                    type="checkbox"
                    :checked="activeAttribute.showInEditor !== false"
                    :disabled="!showNumericAttributesInEditor"
                    @change="updateActiveAttribute({ showInEditor: $event.target.checked })"
                  />
                </label>
                <div v-if="!showNumericAttributesInEditor" class="global-disabled-notice">
                  <span>全局数值显示已关闭</span>
                  <button class="inline-settings-btn" @click="goToNumericDisplaySettings">
                    <Settings :size="13" />
                    <span>前往界面偏好</span>
                  </button>
                </div>
              </div>

              <div class="context-footer">
                <button class="context-action-btn muted" @click="showOverviewContext">
                  <PanelLeft :size="15" />
                  <span>返回总览</span>
                </button>
                <button class="context-action-btn danger" @click="handleDeleteActiveAttribute">
                  <Trash2 :size="15" />
                  <span>删除属性</span>
                </button>
              </div>
            </div>

            <div v-else-if="activeContext.type === 'tag' && activeTag" class="context-panel">
              <div class="form-stack">
                <label class="field-row">
                  <span>标签名</span>
                  <input
                    class="context-input"
                    :value="activeTag.name"
                    @change="updateActiveTag({ name: $event.target.value })"
                  />
                </label>
                <label class="field-row">
                  <span>颜色</span>
                  <input
                    class="context-input color-input"
                    type="color"
                    :value="activeTag.color"
                    @change="updateActiveTag({ color: $event.target.value })"
                  />
                </label>
                <label class="switch-row">
                  <span>在座位表显示</span>
                  <input
                    type="checkbox"
                    :checked="activeTag.showInSeatChart !== false"
                    @change="updateActiveTag({ showInSeatChart: $event.target.checked })"
                  />
                </label>
              </div>

              <TagStudentSelector
                v-model="selectedTagStudentIds"
                :students="students"
              />

              <div class="context-footer">
                <button class="context-action-btn muted" @click="showOverviewContext">
                  <PanelLeft :size="15" />
                  <span>返回总览</span>
                </button>
                <button class="context-action-btn" @click="applyActiveTagStudents">
                  <Check :size="15" />
                  <span>应用学生范围</span>
                </button>
                <button
                  class="context-action-btn danger"
                  :class="{ confirming: isDeletingActiveTag }"
                  @click="handleDeleteActiveTag"
                >
                  <Trash2 :size="15" />
                  <span>{{ isDeletingActiveTag ? '确认删除' : '删除标签' }}</span>
                </button>
              </div>
            </div>
          </aside>

          <section class="roster-sheet">
            <div class="sheet-toolbar">
              <div class="sheet-title-group">
                <h3>学生名单</h3>
                <span>{{ students.length }} 人 · {{ enabledAttributes.length }} 个数值属性 · {{ tags.length }} 个标签</span>
              </div>
              <div class="student-count-control">
                <label>共</label>
                <input
                  v-model.number="targetStudentCount"
                  type="number"
                  min="0"
                  class="student-count-input"
                  :class="{ error: isCountError }"
                  @blur="handleStudentCountChange"
                  @keyup.enter="handleStudentCountChange"
                />
                <label>人</label>
              </div>
              <button class="add-student-btn" @click="handleAddStudent">
                <Plus :size="15" />
                <span>添加学生</span>
              </button>
            </div>

            <div class="sheet-wrap">
              <table class="student-sheet">
                <thead>
                  <tr>
                    <th class="col-index sticky-col-1">#</th>
                    <th class="col-number sticky-col-2">学号</th>
                    <th class="col-name sticky-col-3">姓名</th>
                    <th
                      v-for="attribute in enabledAttributes"
                      :key="attribute.id"
                      class="col-number-attr"
                      :class="{ active: activeContext.type === 'attribute' && activeContext.id === attribute.id }"
                    >
                      <button class="header-cell-button" @click="openAttributeContext(attribute.id)">
                        <span class="th-title">{{ attribute.name }}</span>
                        <span v-if="attribute.unit" class="th-sub">{{ attribute.unit }}</span>
                      </button>
                    </th>
                    <th
                      v-for="tag in tags"
                      :key="tag.id"
                      class="col-tag"
                      :class="{ active: activeContext.type === 'tag' && activeContext.id === tag.id }"
                    >
                      <button class="header-cell-button tag-heading" @click="openTagContext(tag.id)">
                        <span class="tag-swatch" :style="{ background: tag.color }"></span>
                        <span>{{ tag.name }}</span>
                      </button>
                    </th>
                    <th class="col-action">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(student, index) in students" :key="student.id">
                    <td class="col-index sticky-col-1 row-index">{{ index + 1 }}</td>
                    <td class="col-number sticky-col-2">
                      <input
                        class="sheet-input number-input"
                        type="number"
                        :value="student.studentNumber ?? ''"
                        @focus="$event.target.select()"
                        @change="handleStudentNumberChange(student, $event.target.value)"
                        @keydown.enter="$event.target.blur()"
                      />
                    </td>
                    <td class="col-name sticky-col-3">
                      <input
                        class="sheet-input name-input"
                        :value="student.name"
                        placeholder="未命名"
                        @focus="$event.target.select()"
                        @change="handleStudentNameChange(student, $event.target.value)"
                        @keydown.enter="$event.target.blur()"
                      />
                    </td>
                    <td
                      v-for="attribute in enabledAttributes"
                      :key="attribute.id"
                      class="col-number-attr"
                    >
                      <input
                        class="sheet-input number-input"
                        type="number"
                        :step="getAttributeStep(attribute)"
                        :min="attribute.min ?? undefined"
                        :max="attribute.max ?? undefined"
                        :value="getNumericCellValue(student, attribute.id)"
                        @focus="$event.target.select()"
                        @input="setNumericDraft(student.id, attribute.id, $event.target.value)"
                        @blur="commitNumericAttributeChange(student, attribute, $event.target.value)"
                        @keydown.enter="commitNumericAttributeChange(student, attribute, $event.target.value); $event.target.blur()"
                      />
                    </td>
                    <td
                      v-for="tag in tags"
                      :key="tag.id"
                      class="col-tag tag-cell"
                    >
                      <label class="tag-check" :title="tag.name">
                        <input
                          type="checkbox"
                          :checked="student.tags.includes(tag.id)"
                          @change="handleTagToggle(student, tag.id, $event.target.checked)"
                        />
                        <span :style="{ '--tag-color': tag.color }"></span>
                      </label>
                    </td>
                    <td class="col-action">
                      <button class="delete-row-btn" title="删除学生" @click="handleDeleteStudent(student.id)">
                        <Trash2 :size="14" />
                      </button>
                    </td>
                  </tr>
                  <tr v-if="students.length === 0">
                    <td class="empty-row" :colspan="sheetColumnCount">
                      暂无学生，点击“添加学生”开始录入
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { BarChart3, Check, PanelLeft, Plus, Settings, Tag, Trash2, X } from 'lucide-vue-next'
import TagStudentSelector from './TagStudentSelector.vue'
import { getNextColor } from '@/constants/tagColors'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useLogger } from '@/composables/useLogger'
import { useTagData } from '@/composables/useTagData'
import { useStudentData } from '@/composables/useStudentData'
import { useZoneData } from '@/composables/useZoneData'
import { useExportSettings } from '@/composables/useExportSettings'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useSettingsDialog } from '@/composables/useSettingsDialog'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['update:visible'])

// 使用composables
const { tags, addTag, editTag, deleteTag } = useTagData()
const { students, addStudent, setStudentCount, updateStudent, deleteStudent, removeTagFromStudents, addTagToStudents, removeTagFromStudent } = useStudentData()
const { removeTagFromAllZones } = useZoneData()
const { exportSettings } = useExportSettings()
const {
  attributeDefinitions,
  enabledAttributeDefinitions,
  parseNumericValue,
  addAttribute,
  updateAttribute,
  deleteAttribute,
  getAttributeById,
  showNumericAttributesInEditor
} = useStudentAttributes()
const { openSettings } = useSettingsDialog()
const { requestConfirm, isPending } = useConfirmAction()
const { warning, success } = useLogger()

// 学生人数控制
const targetStudentCount = ref(0)
const isCountError = ref(false)
const numericDrafts = ref({})
const activeContext = ref({ type: 'overview', id: null })
const selectedTagStudentIds = ref([])
const enabledAttributes = computed(() => enabledAttributeDefinitions.value)
const sheetColumnCount = computed(() => 4 + enabledAttributes.value.length + tags.value.length)
const activeAttribute = computed(() => {
  if (activeContext.value.type !== 'attribute') return null
  return getAttributeById(activeContext.value.id)
})
const activeTag = computed(() => {
  if (activeContext.value.type !== 'tag') return null
  return tags.value.find(tag => tag.id === activeContext.value.id) || null
})
const contextTitle = computed(() => {
  if (activeContext.value.type === 'attribute' && activeAttribute.value) {
    return activeAttribute.value.name || '未命名属性'
  }
  if (activeContext.value.type === 'tag' && activeTag.value) {
    return activeTag.value.name || '未命名标签'
  }
  return '名单字段'
})
const contextDescription = computed(() => {
  if (activeContext.value.type === 'attribute') return '数值列设置'
  if (activeContext.value.type === 'tag') return '标签列设置'
  return `${students.value.length} 人 · ${attributeDefinitions.value.length} 个数值属性 · ${tags.value.length} 个标签`
})
const isDeletingActiveTag = computed(() => {
  if (!activeTag.value) return false
  return isPending(getDeletingKey(activeTag.value.id))
})

// 监听学生列表变化，同步人数输入框
watch(students, (newStudents) => {
  if (!isCountError.value) {
    targetStudentCount.value = newStudents.length
  }
}, { immediate: true })

watch(activeTag, (tag) => {
  if (!tag) {
    selectedTagStudentIds.value = []
    return
  }
  selectedTagStudentIds.value = students.value
    .filter(student => (student.tags || []).includes(tag.id))
    .map(student => student.id)
}, { immediate: true })

const getTagStudentCount = (tagId) => {
  return students.value.filter(student => (student.tags || []).includes(tagId)).length
}

const showOverviewContext = () => {
  activeContext.value = { type: 'overview', id: null }
}

const openAttributeContext = (attributeId) => {
  activeContext.value = { type: 'attribute', id: attributeId }
}

const openTagContext = (tagId) => {
  activeContext.value = { type: 'tag', id: tagId }
}

const parseOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizePrecision = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

const updateActiveAttribute = (updates) => {
  if (!activeAttribute.value) return
  updateAttribute(activeAttribute.value.id, updates)
}

const goToNumericDisplaySettings = () => {
  close()
  openSettings('global', 'ui')
}

const updateActiveTag = (updates) => {
  if (!activeTag.value) return
  if (updates.name !== undefined && !String(updates.name).trim()) {
    warning('标签名称不能为空')
    return
  }
  editTag(activeTag.value.id, updates)
}

const handleAddAttributeFromHeader = () => {
  const nextIndex = enabledAttributes.value.length + 1
  const attributeId = addAttribute({
    name: `自定义数值${nextIndex}`,
    unit: '',
    min: null,
    max: null,
    precision: 1,
    enabled: true,
    createdFrom: 'manual'
  })
  if (attributeId) {
    openAttributeContext(attributeId)
  }
}

const handleAddTagFromHeader = () => {
  const newTagId = addTag({
    name: `标签${tags.value.length + 1}`,
    color: getNextColor(tags.value.length),
    showInSeatChart: true
  })
  openTagContext(newTagId)
}

const handleDeleteActiveAttribute = () => {
  if (!activeAttribute.value) return
  const deleted = deleteAttribute(activeAttribute.value.id)
  if (deleted) {
    success('已删除数值属性')
    showOverviewContext()
  }
}

const applyActiveTagStudents = () => {
  if (!activeTag.value) return
  const tagId = activeTag.value.id
  const nextStudentIds = selectedTagStudentIds.value
  const currentStudentIds = students.value
    .filter(student => (student.tags || []).includes(tagId))
    .map(student => student.id)

  const addedIds = nextStudentIds.filter(id => !currentStudentIds.includes(id))
  const removedIds = currentStudentIds.filter(id => !nextStudentIds.includes(id))

  if (addedIds.length > 0) {
    addTagToStudents(tagId, addedIds)
  }
  removedIds.forEach(studentId => {
    removeTagFromStudent(tagId, studentId)
  })
  success('已更新标签学生范围')
}

const getDeletingKey = (tagId) => `deleteTag-${tagId}`

const handleDeleteActiveTag = () => {
  if (!activeTag.value) return
  const tagId = activeTag.value.id
  const tagName = activeTag.value.name || '未命名标签'
  const confirmed = requestConfirm(
    getDeletingKey(tagId),
    () => {
      removeTagFromStudents(tagId)
      removeTagFromAllZones(tagId)
      if (exportSettings.value.tagSettings) {
        delete exportSettings.value.tagSettings[tagId]
      }
      deleteTag(tagId)
      success(`已删除标签"${tagName}"`)
      showOverviewContext()
    },
    `确定要删除标签"${tagName}"吗？将从所有学生中移除`
  )

  if (!confirmed) {
    warning(`请再次点击删除按钮以确认删除标签"${tagName}"`)
  }
}

// 处理人数变化
const handleStudentCountChange = () => {
  if (!targetStudentCount.value || targetStudentCount.value < 0) {
    targetStudentCount.value = students.value.length
    isCountError.value = false
    return
  }

  const success = setStudentCount(targetStudentCount.value)

  if (!success) {
    // 无法满足要求，标红提示
    isCountError.value = true
  } else {
    isCountError.value = false
  }
}

// 学生管理
const handleAddStudent = () => {
  addStudent()
  isCountError.value = false
}

const handleStudentNameChange = (student, value) => {
  updateStudent(student.id, { name: value })
}

const handleStudentNumberChange = (student, value) => {
  const normalized = value === '' || value === null || value === undefined
    ? null
    : Number(value)
  updateStudent(student.id, {
    studentNumber: Number.isFinite(normalized) ? normalized : null
  })
}

const getNumericValue = (student, attributeId) => {
  const value = student.numericAttributes?.[attributeId]
  return value === null || value === undefined ? '' : value
}

const getNumericDraftKey = (studentId, attributeId) => `${studentId}:${attributeId}`

const getNumericCellValue = (student, attributeId) => {
  const key = getNumericDraftKey(student.id, attributeId)
  if (Object.prototype.hasOwnProperty.call(numericDrafts.value, key)) {
    return numericDrafts.value[key]
  }
  return getNumericValue(student, attributeId)
}

const setNumericDraft = (studentId, attributeId, value) => {
  numericDrafts.value = {
    ...numericDrafts.value,
    [getNumericDraftKey(studentId, attributeId)]: value
  }
}

const clearNumericDraft = (studentId, attributeId) => {
  const key = getNumericDraftKey(studentId, attributeId)
  if (!Object.prototype.hasOwnProperty.call(numericDrafts.value, key)) return
  const nextDrafts = { ...numericDrafts.value }
  delete nextDrafts[key]
  numericDrafts.value = nextDrafts
}

const getAttributeStep = (attribute) => {
  const precision = Math.max(0, Number(attribute.precision ?? 0))
  return precision === 0 ? 1 : Number(`0.${'0'.repeat(Math.max(0, precision - 1))}1`)
}

const normalizeNumericCellValue = (value, attribute) => {
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

const commitNumericAttributeChange = (student, attribute, value) => {
  const normalized = normalizeNumericCellValue(value, attribute)
  clearNumericDraft(student.id, attribute.id)
  if (normalized === undefined) return
  const nextAttributes = { ...(student.numericAttributes || {}) }
  nextAttributes[attribute.id] = normalized
  updateStudent(student.id, { numericAttributes: nextAttributes })
}

const handleTagToggle = (student, tagId, checked) => {
  const currentTags = student.tags || []
  const nextTags = checked
    ? [...new Set([...currentTags, tagId])]
    : currentTags.filter(id => id !== tagId)
  updateStudent(student.id, { tags: nextTags })

  if (activeContext.value.type === 'tag' && activeContext.value.id === tagId) {
    selectedTagStudentIds.value = checked
      ? [...new Set([...selectedTagStudentIds.value, student.id])]
      : selectedTagStudentIds.value.filter(id => id !== student.id)
  }
}

const handleDeleteStudent = (studentId) => {
  deleteStudent(studentId)
  isCountError.value = false
}

const close = () => {
  emit('update:visible', false)
}
</script>

<style scoped>
.student-roster-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.student-roster-dialog {
  background: var(--color-surface, #ffffff);
  width: 96vw;
  max-width: 1280px;
  height: 88vh;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--color-bg-subtle, #f8f9fa);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.dialog-header h3 {
  margin: 0;
  color: var(--color-primary, #23587b);
  font-size: 18px;
}

.close-btn {
  width: 32px;
  height: 32px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-disabled);
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.dialog-body {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  flex: 1;
  overflow: hidden;
  background: var(--color-bg-secondary);
}

.roster-context {
  min-width: 0;
  overflow: auto;
  padding: 14px;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--color-bg-secondary);
}

.context-header {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--color-surface);
}

.context-eyebrow {
  display: block;
  margin-bottom: 6px;
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 700;
}

.context-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 16px;
  font-weight: 700;
}

.context-header p {
  margin: 5px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.context-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.summary-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px;
  background: var(--color-surface);
}

.summary-value {
  display: block;
  color: var(--color-primary);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.summary-label {
  display: block;
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.quick-actions,
.context-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.context-action-btn {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
}

.context-action-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-bg-selected);
}

.context-action-btn.muted {
  color: var(--color-text-secondary);
  background: var(--color-bg-subtle);
}

.context-action-btn.danger {
  color: var(--color-danger);
}

.context-action-btn.danger:hover,
.context-action-btn.danger.confirming {
  border-color: var(--color-danger);
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.context-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.context-list-item {
  min-height: 32px;
  padding: 0 9px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 7px;
  text-align: left;
  min-width: 0;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.context-list-item:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-selected);
}

.context-list-item span:nth-child(2) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}

.context-list-item small {
  color: var(--color-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.context-list-item.tag-item {
  border-color: color-mix(in srgb, var(--tag-color) 35%, var(--color-border));
  background: color-mix(in srgb, var(--tag-color) 10%, var(--color-surface));
}

.context-list-item.tag-item:hover {
  border-color: color-mix(in srgb, var(--tag-color) 65%, var(--color-border));
  background: color-mix(in srgb, var(--tag-color) 22%, var(--color-surface));
}

.form-stack {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field-row > span,
.switch-row > span {
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

.color-input {
  padding: 3px;
}

.switch-row {
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.switch-row.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.switch-row input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}

.switch-row input:disabled {
  cursor: not-allowed;
}

.global-disabled-notice {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 12px;
  line-height: 1.4;
}

.inline-settings-btn {
  min-height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
}

.inline-settings-btn:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-selected);
}

.roster-sheet {
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
}

.sheet-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.sheet-title-group {
  min-width: 0;
  margin-right: auto;
}

.sheet-title-group h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 16px;
  font-weight: 600;
}

.sheet-title-group span {
  display: block;
  margin-top: 3px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.student-count-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.student-count-control label {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.student-count-input {
  width: 68px;
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.student-count-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.student-count-input.error {
  border-color: var(--color-danger);
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
}

.student-count-input::-webkit-inner-spin-button,
.student-count-input::-webkit-outer-spin-button {
  opacity: 1;
}

.add-student-btn {
  min-height: 34px;
  padding: 0 12px;
  background: var(--color-primary);
  color: var(--color-surface);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.add-student-btn:hover {
  background: var(--color-primary-hover);
}

.sheet-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background:
    linear-gradient(var(--color-surface), var(--color-surface)) padding-box,
    linear-gradient(to right, var(--color-border), transparent 18px) border-box;
}

.sheet-wrap::-webkit-scrollbar {
  width: 8px;
  height: 10px;
}

.sheet-wrap::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}

.sheet-wrap::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
}

.sheet-wrap::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

.student-sheet {
  border-collapse: separate;
  border-spacing: 0;
  min-width: max-content;
  width: 100%;
  table-layout: fixed;
  color: var(--color-text-primary);
  font-size: 13px;
}

.student-sheet th,
.student-sheet td {
  height: 36px;
  border-right: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
  background: var(--color-surface);
  padding: 0;
  vertical-align: middle;
}

.student-sheet th {
  position: sticky;
  top: 0;
  z-index: 4;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
  text-align: left;
  padding: 0 8px;
  white-space: nowrap;
}

.student-sheet th.active {
  background: var(--color-bg-selected);
  color: var(--color-primary);
  box-shadow: inset 0 -2px 0 var(--color-primary);
}

.header-cell-button {
  width: 100%;
  height: 100%;
  min-height: 36px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0;
  text-align: left;
}

.header-cell-button:hover {
  color: var(--color-primary);
}

.student-sheet tbody tr:hover td {
  background: var(--color-bg-subtle);
}

.col-index { width: 48px; text-align: center; }
.col-number { width: 86px; }
.col-name { width: 150px; }
.col-number-attr { width: 112px; }
.col-tag { width: 76px; text-align: center; }
.col-action { width: 58px; text-align: center; }

.sticky-col-1,
.sticky-col-2,
.sticky-col-3 {
  position: sticky;
  z-index: 3;
}

th.sticky-col-1,
th.sticky-col-2,
th.sticky-col-3 {
  z-index: 6;
}

.sticky-col-1 { left: 0; }
.sticky-col-2 { left: 48px; }
.sticky-col-3 {
  left: 134px;
  box-shadow: 1px 0 0 var(--color-border);
}

.row-index {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  background: var(--color-bg-secondary) !important;
}

.sheet-input {
  width: 100%;
  height: 35px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--color-text-primary);
  padding: 0 8px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.sheet-input:focus {
  background: var(--color-surface);
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.number-input {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.name-input {
  font-weight: 500;
}

.th-title,
.th-sub {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.th-sub {
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 500;
}

.tag-heading {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  max-width: 100%;
  overflow: hidden;
}

.tag-heading span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-swatch {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--tag-color);
  box-shadow: inset 0 0 0 1px var(--shadow-md);
}

.tag-cell {
  text-align: center;
}

.tag-check {
  position: relative;
  width: 100%;
  height: 35px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tag-check input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.tag-check span {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  display: inline-block;
  box-sizing: border-box;
}

.tag-check input:checked + span {
  background: var(--tag-color);
  border-color: var(--tag-color);
  box-shadow: inset 0 0 0 3px var(--color-surface);
}

.tag-check:focus-within span {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.delete-row-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-muted);
  background: var(--color-surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.delete-row-btn:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: var(--color-danger-bg);
}

.empty-row {
  height: 120px !important;
  text-align: center;
  color: var(--color-text-muted);
  background: var(--color-bg-secondary) !important;
}

/* Transition styles */
.dialog-fade-enter-active {
  transition: opacity 0.3s ease;
}

.dialog-fade-enter-active .student-roster-dialog {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dialog-fade-enter-from {
  opacity: 0;
}

.dialog-fade-enter-from .student-roster-dialog {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-leave-active .student-roster-dialog {
  transition: all 0.2s ease;
}

.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-leave-to .student-roster-dialog {
  opacity: 0;
  transform: scale(0.95);
}

@media (max-width: 980px) {
  .student-roster-dialog {
    width: 96vw;
    height: 92vh;
  }

  .dialog-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .roster-context {
    max-height: 260px;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }

  .sheet-toolbar {
    flex-wrap: wrap;
  }
}
</style>
