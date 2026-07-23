<template>
  <component
    :is="presentation === 'dialog' ? ResponsiveOverlay : 'div'"
    v-bind="presentation === 'dialog' ? overlayProps : {}"
    :class="{ 'student-roster-embedded': presentation === 'embedded' }"
    @update:show="(value: boolean) => !value && close()"
  >
      <div v-if="visible" :class="['student-roster-content', { embedded: presentation === 'embedded' }]">
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
                <NButton size="small" type="primary" secondary @click="handleAddAttributeFromHeader">
                  <template #icon><BarChart3 :size="15" /></template>
                  <span>新增数值属性</span>
                </NButton>
                <NButton size="small" type="primary" secondary @click="handleAddTagFromHeader">
                  <template #icon><Tag :size="15" /></template>
                  <span>新增标签</span>
                </NButton>
              </div>

              <div class="context-list">
                <NButton
                  v-for="attribute in attributeDefinitions"
                  :key="attribute.id"
                  class="context-list-item"
                  size="small"
                  secondary
                  block
                  @click="openAttributeContext(attribute.id)"
                >
                  <span class="context-list-content">
                    <BarChart3 :size="14" />
                    <span>{{ attribute.name }}</span>
                    <small>{{ attribute.enabled === false ? '已隐藏' : attribute.unit }}</small>
                  </span>
                </NButton>
                <NButton
                  v-for="tag in tags"
                  :key="tag.id"
                  class="context-list-item tag-item"
                  :style="{ '--tag-color': tag.color }"
                  size="small"
                  secondary
                  block
                  @click="openTagContext(tag.id)"
                >
                  <span class="context-list-content">
                    <span class="tag-swatch"></span>
                    <span>{{ tag.name || '未命名标签' }}</span>
                    <small>{{ getTagStudentCount(tag.id) }}人</small>
                  </span>
                </NButton>
              </div>
            </div>

            <div v-else-if="activeContext.type === 'attribute' && activeAttribute" class="context-panel">
              <div class="form-stack">
                <label class="field-row">
                  <span>属性名</span>
                  <NInput
                    class="context-input"
                    size="small"
                    :value="activeAttribute.name"
                    @change="value => updateActiveAttribute({ name: value })"
                  />
                </label>
                <label class="field-row">
                  <span>单位</span>
                  <NInput
                    class="context-input"
                    size="small"
                    :value="activeAttribute.unit"
                    placeholder="可选"
                    @change="value => updateActiveAttribute({ unit: value })"
                  />
                </label>
                <div class="field-grid">
                  <label class="field-row">
                    <span>最小值</span>
                    <NInputNumber
                      class="context-input"
                      size="small"
                      :value="activeAttribute.min"
                      @update:value="value => updateActiveAttributeRange('min', value)"
                    />
                  </label>
                  <label class="field-row">
                    <span>最大值</span>
                    <NInputNumber
                      class="context-input"
                      size="small"
                      :value="activeAttribute.max"
                      @update:value="value => updateActiveAttributeRange('max', value)"
                    />
                  </label>
                </div>
                <label class="field-row">
                  <span>小数位</span>
                  <NInputNumber
                    class="context-input"
                    size="small"
                    :min="0"
                    :value="activeAttribute.precision ?? 0"
                    @update:value="updateActiveAttributePrecision"
                  />
                </label>
                <label class="switch-row">
                  <span>启用为表格列</span>
                  <NSwitch
                    :value="activeAttribute.enabled !== false"
                    @update:value="value => updateActiveAttribute({ enabled: value })"
                  />
                </label>
                <label class="switch-row" :class="{ disabled: !showNumericAttributesInEditor }">
                  <span>在编辑器显示</span>
                  <NSwitch
                    :value="activeAttribute.showInEditor !== false"
                    :disabled="!showNumericAttributesInEditor"
                    @update:value="value => updateActiveAttribute({ showInEditor: value })"
                  />
                </label>
                <div v-if="!showNumericAttributesInEditor" class="global-disabled-notice">
                  <span>全局数值显示已关闭</span>
                  <NButton size="small" text type="primary" @click="goToNumericDisplaySettings">
                    <template #icon><Settings :size="13" /></template>
                    <span>前往界面偏好</span>
                  </NButton>
                </div>
              </div>

              <div class="context-footer">
                <NButton size="small" secondary @click="showOverviewContext">
                  <template #icon><PanelLeft :size="15" /></template>
                  <span>返回总览</span>
                </NButton>
                <NButton size="small" type="error" secondary @click="handleDeleteActiveAttribute">
                  <template #icon><Trash2 :size="15" /></template>
                  <span>删除属性</span>
                </NButton>
              </div>
            </div>

            <div v-else-if="activeContext.type === 'tag' && activeTag" class="context-panel">
              <div class="form-stack">
                <label class="field-row">
                  <span>标签名</span>
                  <NInput
                    class="context-input"
                    size="small"
                    :value="activeTag.name"
                    @change="value => updateActiveTag({ name: value })"
                  />
                </label>
                <label class="field-row">
                  <span>颜色</span>
                  <NColorPicker
                    class="context-input"
                    :value="activeTag.color"
                    :modes="['hex']"
                    :show-alpha="false"
                    @update:value="value => updateActiveTag({ color: value })"
                  />
                </label>
                <label class="switch-row">
                  <span>在座位表显示</span>
                  <NSwitch
                    :value="activeTag.showInSeatChart !== false"
                    @update:value="value => updateActiveTag({ showInSeatChart: value })"
                  />
                </label>
              </div>

              <TagStudentSelector
                v-model="selectedTagStudentIds"
                :students="students"
              />

              <div class="context-footer">
                <NButton size="small" secondary @click="showOverviewContext">
                  <template #icon><PanelLeft :size="15" /></template>
                  <span>返回总览</span>
                </NButton>
                <NButton size="small" type="primary" secondary @click="applyActiveTagStudents">
                  <template #icon><Check :size="15" /></template>
                  <span>应用学生范围</span>
                </NButton>
                <NButton
                  size="small"
                  type="error"
                  secondary
                  @click="handleDeleteActiveTag"
                >
                  <template #icon><Trash2 :size="15" /></template>
                  <span>删除标签</span>
                </NButton>
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
                <NInputNumber
                  :value="targetStudentCount"
                  :min="0"
                  class="student-count-input"
                  size="small"
                  :status="isCountError ? 'error' : undefined"
                  @update:value="updateTargetStudentCount"
                  @blur="handleStudentCountChange"
                  @keyup.enter="handleStudentCountChange"
                />
                <label>人</label>
              </div>
              <NButton size="small" secondary attr-type="button" @click="goFilesView">
                <template #icon><FileInput :size="15" /></template>
                <span>到文件页导入</span>
              </NButton>
              <NButton size="small" type="primary" @click="handleAddStudent">
                <template #icon><Plus :size="15" /></template>
                <span>添加学生</span>
              </NButton>
            </div>

            <div class="sheet-wrap desktop-roster">
              <NDataTable
                :columns="tableColumns"
                :data="students"
                :row-key="student => student.id"
                :scroll-x="tableScrollX"
                :max-height="tableMaxHeight"
                size="small"
                striped
              />
            </div>

            <NList class="mobile-roster" bordered>
              <NListItem v-for="(student, index) in students" :key="student.id">
                <template #prefix><span class="mobile-row-index">{{ index + 1 }}</span></template>
                <div class="mobile-student-card">
                  <div class="mobile-primary-fields">
                    <NInput
                      :value="student.name"
                      placeholder="未命名"
                      @change="value => handleStudentNameChange(student, value)"
                    />
                    <NInputNumber
                      :value="student.studentNumber"
                      :show-button="false"
                      placeholder="学号"
                      @update:value="value => handleStudentNumberChange(student, value)"
                    />
                  </div>
                  <div v-if="enabledAttributes.length > 0" class="mobile-attribute-grid">
                    <label v-for="attribute in enabledAttributes" :key="attribute.id">
                      <span>{{ attribute.name }}{{ attribute.unit ? `（${attribute.unit}）` : '' }}</span>
                      <NInputNumber
                        :step="getAttributeStep(attribute)"
                        :min="attribute.min ?? undefined"
                        :max="attribute.max ?? undefined"
                        :value="getNumericCellValue(student, attribute.id)"
                        @update:value="value => setNumericDraft(student.id, attribute.id, value)"
                        @blur="commitNumericAttributeChange(student, attribute, getNumericCellValue(student, attribute.id))"
                      />
                    </label>
                  </div>
                  <NSelect
                    v-if="tags.length > 0"
                    :value="student.tags"
                    :options="tagOptions"
                    multiple
                    clearable
                    placeholder="选择标签"
                    @update:value="value => handleStudentTagsChange(student, value)"
                  />
                </div>
                <template #suffix>
                  <NPopconfirm positive-text="删除" negative-text="取消" @positive-click="handleDeleteStudent(student.id)">
                    <template #trigger>
                      <NButton class="mobile-delete-button" quaternary circle type="error" title="删除学生"><Trash2 :size="16" /></NButton>
                    </template>
                    删除学生“{{ student.name || '未命名' }}”？
                  </NPopconfirm>
                </template>
              </NListItem>
              <NEmpty v-if="students.length === 0" description="暂无学生，点击“添加学生”开始录入" />
            </NList>
          </section>
        </div>
      </div>
  </component>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import {
  NButton,
  NCheckbox,
  NColorPicker,
  NDataTable,
  NEmpty,
  NInput,
  NInputNumber,
  NList,
  NListItem,
  NPopconfirm,
  NSelect,
  NSwitch,
  type DataTableColumns
} from 'naive-ui'
import { BarChart3, Check, FileInput, PanelLeft, Plus, Settings, Tag, Trash2 } from 'lucide-vue-next'
import TagStudentSelector from './TagStudentSelector.vue'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { getNextColor } from '@/constants/tagColors'
import { useLogger } from '@/composables/useLogger'
import { useRouter } from 'vue-router'
import { useTagData } from '@/composables/useTagData'
import { useStudentData } from '@/composables/useStudentData'
import { useZoneData } from '@/composables/useZoneData'
import { useExportSettings } from '@/composables/useExportSettings'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useSettingsDialog } from '@/composables/useSettingsDialog'
import { normalizeNumberInput, normalizeRequiredNumberInput } from '@/utils/inputNormalization'
import type { NumericAttributeDefinition, Student, Tag as StudentTag } from '@/types/models'

const props = withDefaults(defineProps<{
  visible?: boolean
  presentation?: 'dialog' | 'embedded'
}>(), {
  visible: false,
  presentation: 'dialog'
})

const emit = defineEmits<{ 'update:visible': [value: boolean] }>()
const overlayProps = computed(() => ({
  show: props.visible,
  title: '名单与属性',
  desktopWidth: 'min(1440px, calc(100vw - 32px))',
  mobileHeight: '94dvh'
}))

// 使用composables
const { tags, addTag, editTag, deleteTag } = useTagData()
const { students, addStudent, setStudentCount, updateStudent, deleteStudent, removeTagFromStudents, addTagToStudents, removeTagFromStudent } = useStudentData()
const { removeTagFromAllZones } = useZoneData()
const { exportSettings } = useExportSettings()
const {
  attributeDefinitions,
  enabledAttributeDefinitions,
  addAttribute,
  updateAttribute,
  deleteAttribute,
  getAttributeById,
  showNumericAttributesInEditor
} = useStudentAttributes()
const { openSettings } = useSettingsDialog()
const { warning, success, confirm } = useLogger()
const router = useRouter()

const selectInputText = (event: FocusEvent) => {
  if (event.target instanceof HTMLInputElement) event.target.select()
}

const goFilesView = () => {
  router.push('/files')
}
// 学生人数控制
const targetStudentCount = ref<number | null>(0)
const isCountError = ref(false)
const numericDrafts = ref<Record<string, number | null>>({})
type RosterContext =
  | { type: 'overview'; id: null }
  | { type: 'attribute'; id: string }
  | { type: 'tag'; id: number }
const activeContext = ref<RosterContext>({ type: 'overview', id: null })
const selectedTagStudentIds = ref<number[]>([])
const enabledAttributes = computed(() => enabledAttributeDefinitions.value)
const tagOptions = computed(() => tags.value.map(tag => ({ label: tag.name, value: tag.id })))
const tableScrollX = computed(() => 342 + enabledAttributes.value.length * 112 + tags.value.length * 76)
const tableMaxHeight = 'calc(100dvh - 270px)'
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

const tableColumns = computed<DataTableColumns<Student>>(() => [
  {
    title: '#',
    key: 'index',
    width: 48,
    fixed: 'left',
    render: (_row, index) => index + 1
  },
  {
    title: '学号',
    key: 'studentNumber',
    width: 86,
    fixed: 'left',
    render: (student) => h(NInputNumber, {
      value: student.studentNumber,
      size: 'small',
      showButton: false,
      placeholder: '学号',
      onFocus: selectInputText,
      'onUpdate:value': (value: number | null) => handleStudentNumberChange(student, value)
    })
  },
  {
    title: '姓名',
    key: 'name',
    width: 150,
    fixed: 'left',
    render: (student) => h(NInput, {
      value: student.name,
      size: 'small',
      placeholder: '未命名',
      onFocus: selectInputText,
      onChange: (value: string) => handleStudentNameChange(student, value)
    })
  },
  ...enabledAttributes.value.map(attribute => ({
    key: `attribute-${attribute.id}`,
    width: 112,
    title: () => h(NButton, {
      size: 'tiny',
      text: true,
      type: activeContext.value.type === 'attribute' && activeContext.value.id === attribute.id ? 'primary' : 'default',
      onClick: () => openAttributeContext(attribute.id)
    }, { default: () => attribute.unit ? `${attribute.name}（${attribute.unit}）` : attribute.name }),
    render: (student: Student) => h(NInputNumber, {
      value: getNumericCellValue(student, attribute.id),
      size: 'small',
      showButton: false,
      step: getAttributeStep(attribute),
      min: attribute.min ?? undefined,
      max: attribute.max ?? undefined,
      onFocus: selectInputText,
      'onUpdate:value': (value: number | null) => setNumericDraft(student.id, attribute.id, value),
      onBlur: () => commitNumericAttributeChange(student, attribute, getNumericCellValue(student, attribute.id)),
      onKeyup: (event: KeyboardEvent) => {
        if (event.key === 'Enter') commitNumericAttributeChange(student, attribute, getNumericCellValue(student, attribute.id))
      }
    })
  })),
  ...tags.value.map(tag => ({
    key: `tag-${tag.id}`,
    width: 76,
    align: 'center' as const,
    title: () => h(NButton, {
      size: 'tiny',
      text: true,
      color: activeContext.value.type === 'tag' && activeContext.value.id === tag.id ? tag.color : undefined,
      onClick: () => openTagContext(tag.id)
    }, { default: () => tag.name }),
    render: (student: Student) => h(NCheckbox, {
      checked: student.tags.includes(tag.id),
      'aria-label': `${tag.name}：${student.name || '未命名学生'}`,
      'onUpdate:checked': (checked: boolean) => handleTagToggle(student, tag.id, checked)
    })
  })),
  {
    title: '操作',
    key: 'actions',
    width: 58,
    fixed: 'right',
    align: 'center',
    render: (student) => h(NPopconfirm, {
      positiveText: '删除',
      negativeText: '取消',
      onPositiveClick: () => handleDeleteStudent(student.id)
    }, {
      trigger: () => h(NButton, {
        size: 'small',
        quaternary: true,
        circle: true,
        type: 'error',
        title: '删除学生'
      }, { default: () => h(Trash2, { size: 14 }) }),
      default: () => `删除学生“${student.name || '未命名'}”？`
    })
  }
])

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

const getTagStudentCount = (tagId: number) => {
  return students.value.filter(student => (student.tags || []).includes(tagId)).length
}

const showOverviewContext = () => {
  activeContext.value = { type: 'overview', id: null }
}

const openAttributeContext = (attributeId: string) => {
  activeContext.value = { type: 'attribute', id: attributeId }
}

const openTagContext = (tagId: number) => {
  activeContext.value = { type: 'tag', id: tagId }
}

const updateActiveAttribute = (updates: Partial<NumericAttributeDefinition>) => {
  if (!activeAttribute.value) return
  updateAttribute(activeAttribute.value.id, updates)
}

const updateActiveAttributeRange = (key: 'min' | 'max', value: number | null) => {
  updateActiveAttribute({ [key]: normalizeNumberInput(value) })
}

const updateActiveAttributePrecision = (value: number | null) => {
  updateActiveAttribute({
    precision: normalizeRequiredNumberInput(
      value,
      activeAttribute.value?.precision ?? 0,
      { min: 0, precision: 0 }
    )
  })
}

const goToNumericDisplaySettings = () => {
  close()
  openSettings('global', 'ui')
}

const updateActiveTag = (updates: Partial<StudentTag>) => {
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

const handleDeleteActiveAttribute = async () => {
  if (!activeAttribute.value) return
  const attributeName = activeAttribute.value.name || '未命名属性'
  const confirmed = await confirm({
    title: '删除数值属性',
    content: `确认删除“${attributeName}”及所有学生在该列中的数值？`,
    positiveText: '删除',
    type: 'error'
  })
  if (!confirmed) return
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

const handleDeleteActiveTag = async () => {
  if (!activeTag.value) return
  const tagId = activeTag.value.id
  const tagName = activeTag.value.name || '未命名标签'
  const confirmed = await confirm({
    title: '删除标签',
    content: `确认删除“${tagName}”并从所有学生、选区和导出设置中移除？`,
    positiveText: '删除',
    type: 'error'
  })
  if (!confirmed) return
  removeTagFromStudents(tagId)
  removeTagFromAllZones(tagId)
  if (exportSettings.value.tagSettings) delete exportSettings.value.tagSettings[tagId]
  deleteTag(tagId)
  success(`已删除标签“${tagName}”`)
  showOverviewContext()
}

// 处理人数变化
const updateTargetStudentCount = (value: number | null) => {
  targetStudentCount.value = normalizeNumberInput(value, { min: 0, precision: 0 })
}

const handleStudentCountChange = () => {
  const nextCount = Number(targetStudentCount.value)
  if (!Number.isInteger(nextCount) || nextCount < 0) {
    targetStudentCount.value = students.value.length
    isCountError.value = false
    return
  }

  const success = setStudentCount(nextCount)

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

const handleStudentNameChange = (student: Student, value: string) => {
  updateStudent(student.id, { name: value })
}

const handleStudentNumberChange = (student: Student, value: number | null) => {
  updateStudent(student.id, {
    studentNumber: normalizeNumberInput(value)
  })
}

const getNumericValue = (student: Student, attributeId: string): number | null => {
  const value = student.numericAttributes?.[attributeId]
  return value === null || value === undefined ? null : value
}

const getNumericDraftKey = (studentId: number, attributeId: string) => `${studentId}:${attributeId}`

const getNumericCellValue = (student: Student, attributeId: string): number | null => {
  const key = getNumericDraftKey(student.id, attributeId)
  if (Object.prototype.hasOwnProperty.call(numericDrafts.value, key)) {
    return numericDrafts.value[key]
  }
  return getNumericValue(student, attributeId)
}

const setNumericDraft = (studentId: number, attributeId: string, value: number | null) => {
  numericDrafts.value = {
    ...numericDrafts.value,
    [getNumericDraftKey(studentId, attributeId)]: value
  }
}

const clearNumericDraft = (studentId: number, attributeId: string) => {
  const key = getNumericDraftKey(studentId, attributeId)
  if (!Object.prototype.hasOwnProperty.call(numericDrafts.value, key)) return
  const nextDrafts = { ...numericDrafts.value }
  delete nextDrafts[key]
  numericDrafts.value = nextDrafts
}

const getAttributeStep = (attribute: NumericAttributeDefinition) => {
  const precision = Math.max(0, Number(attribute.precision ?? 0))
  return precision === 0 ? 1 : Number(`0.${'0'.repeat(Math.max(0, precision - 1))}1`)
}

const normalizeNumericCellValue = (value: unknown, attribute: NumericAttributeDefinition) => {
  return normalizeNumberInput(value, {
    min: attribute.min ?? undefined,
    max: attribute.max ?? undefined,
    precision: attribute.precision ?? 0
  })
}

const commitNumericAttributeChange = (
  student: Student,
  attribute: NumericAttributeDefinition,
  value: unknown
) => {
  const normalized = normalizeNumericCellValue(value, attribute)
  clearNumericDraft(student.id, attribute.id)
  const nextAttributes = { ...(student.numericAttributes || {}) }
  nextAttributes[attribute.id] = normalized
  updateStudent(student.id, { numericAttributes: nextAttributes })
}

const handleTagToggle = (student: Student, tagId: number, checked: boolean) => {
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

const handleStudentTagsChange = (student: Student, value: Array<string | number>) => {
  const nextTags = value
    .map(item => Number(item))
    .filter(tagId => Number.isInteger(tagId) && tags.value.some(tag => tag.id === tagId))
  updateStudent(student.id, { tags: [...new Set(nextTags)] })
}

const handleDeleteStudent = (studentId: number) => {
  deleteStudent(studentId)
  isCountError.value = false
}

const close = () => {
  emit('update:visible', false)
}
</script>

<style scoped>
.student-roster-embedded {
  height: 100%;
  min-height: 0;
}

.student-roster-content {
  width: 100%;
  height: min(760px, calc(100dvh - 180px));
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.student-roster-content.embedded {
  height: 100%;
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


.context-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.context-list-item {
  height: auto;
  text-align: left;
  min-width: 0;
}

.context-list-content {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 7px;
}

.context-list-content > span:nth-child(2) {
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
}


.sheet-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background:
    linear-gradient(var(--color-surface), var(--color-surface)) padding-box,
    linear-gradient(to right, var(--color-border), transparent 18px) border-box;
}

.mobile-roster {
  display: none;
  min-height: 0;
  overflow-y: auto;
}

.mobile-student-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mobile-primary-fields,
.mobile-attribute-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mobile-attribute-grid label {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.mobile-attribute-grid label > span,
.mobile-row-index {
  color: var(--color-text-secondary);
  font-size: 12px;
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



@media (max-width: 980px) {
  .dialog-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .roster-context {
    max-height: 220px;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    padding: 12px;
  }

  .sheet-toolbar {
    flex-wrap: wrap;
  }
}

@media (max-width: 640px) {
  .student-roster-content {
    height: calc(94dvh - 110px);
  }

  .dialog-body {
    min-height: 0;
  }

  .roster-context {
    max-height: 158px;
    padding: 10px;
    gap: 8px;
  }

  .context-header {
    display: none;
  }

  .summary-grid {
    grid-template-columns: repeat(4, minmax(70px, 1fr));
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .summary-grid::-webkit-scrollbar {
    display: none;
  }

  .summary-card {
    padding: 8px;
  }

  .summary-value {
    font-size: 17px;
  }

  .quick-actions,
  .context-footer {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }

  .context-list-item {
    min-height: 44px;
  }

  .sheet-toolbar {
    gap: 8px;
    padding: 10px;
  }

  .sheet-title-group {
    width: 100%;
    margin-right: 0;
  }

  .sheet-title-group h3 {
    font-size: 15px;
  }

  .student-count-control {
    flex: 1;
    min-width: 0;
  }

  .desktop-roster {
    display: none;
  }

  .mobile-roster {
    display: block;
    flex: 1;
  }

  .mobile-primary-fields,
  .mobile-attribute-grid {
    grid-template-columns: 1fr;
  }

  .mobile-delete-button {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
