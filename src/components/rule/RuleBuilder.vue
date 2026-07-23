<template>
  <div class="rule-builder">
    <div class="builder-content">
      <div class="builder-heading">
        <h4 class="builder-title">{{ isEditing ? '编辑规则' : '添加新规则' }}</h4>
        <NButton size="small" secondary type="primary" @click="showTemplateDialog = true">
          <template #icon><Wand2 :size="15" stroke-width="2" /></template>
          <span>快捷方案</span>
        </NButton>
      </div>

      <div class="sentence-builder">
        <!-- 对象集合（所有子规则共用） -->
        <div class="builder-segment">
          <label class="seg-label">适用对象</label>
          <div class="subject-section inline-subject">
            <div class="subject-slot">
              <div v-for="(entry, entryIndex) in sharedSubjects" :key="`s-${entryIndex}`" class="subject-row">
                <NSelect
                  v-model:value="entry.type"
                  class="detail-select"
                  :options="subjectTypeOptions"
                  @update:value="onEntryTypeChange(entry)"
                />

                <NSelect
                  v-if="entry.type !== 'all'"
                  v-model:value="entry.id"
                  class="detail-select"
                  :options="getEntryOptions(entry.type).map(opt => ({ label: opt.label, value: opt.id }))"
                  :placeholder="entry.type === 'person' ? '选择学生…' : '选择标签…'"
                  clearable
                />

                <NButton size="small" quaternary type="error" @click="removeSharedEntry(entryIndex)">删除</NButton>
              </div>
              <NButton size="small" dashed @click="addSharedEntry">+ 添加对象</NButton>
            </div>
          </div>
        </div>

        <!-- 规则条件区域 -->
        <div class="rules-container">
          <label class="seg-label">规则条件</label>

          <!-- 子规则列表 -->
          <div v-for="(subRule, ruleIndex) in subRules" :key="`rule-${ruleIndex}`" class="sub-rule-item">
            <div class="rule-header-row">
              <!-- 逻辑操作符（多规则时显示，第一条不显示或显示为默认） -->
              <NButton
                v-if="subRules.length > 1"
                class="logic-toggle"
                :class="{ active: selectedLogicOperator === 'AND', or: selectedLogicOperator === 'OR' }"
                size="small"
                secondary
                :type="selectedLogicOperator === 'OR' ? 'warning' : 'info'"
                @click="selectedLogicOperator = selectedLogicOperator === 'AND' ? 'OR' : 'AND'"
                title="点击切换与/或"
              >
                {{ selectedLogicOperator === 'AND' ? '且' : '或' }}
              </NButton>
              <span v-else class="logic-placeholder"></span>

              <!-- 是/非 切换 -->
              <NButton
                class="not-toggle"
                :class="{ active: subRule.not }"
                size="small"
                secondary
                :type="subRule.not ? 'error' : 'default'"
                @click="toggleNot(ruleIndex)"
                title="点击切换是否取反该规则"
              >
                {{ subRule.not ? '非' : '是' }}
              </NButton>

              <div class="rule-selector-wrap flex-1">
                <NSelect
                  v-model:value="subRule.predicate"
                  class="seg-select pred-select"
                  :options="predicateOptions"
                  placeholder="请选择规则类型..."
                  @update:value="onPredicateChange(ruleIndex)"
                />
              </div>

              <!-- 删除子规则按钮 -->
              <NButton
                v-if="subRules.length > 1"
                class="mini-btn danger remove-rule-btn"
                size="small"
                quaternary
                circle
                type="error"
                @click="removeSubRule(ruleIndex)"
                title="删除此规则"
              >
                <X :size="14" />
              </NButton>
            </div>

            <!-- 参数（仅当选择了谓词时显示） -->
            <div v-if="subRule.predicate && getParamSpecs(ruleIndex).length > 0" class="params-inline">
              <template v-for="param in getParamSpecs(ruleIndex)" :key="param.key">
                <div class="input-group inline-param">
                  <label>{{ param.label }}</label>
                  <NInputNumber
                    v-if="param.type === 'number'"
                    :value="getNumberParam(ruleIndex, param.key)"
                    :min="param.min ?? 1"
                    class="detail-input"
                    @update:value="value => setNumberParamValue(ruleIndex, param, value)"
                  />
                  <NSelect
                    v-else-if="param.type === 'select'"
                    :value="getSelectParam(ruleIndex, param.key)"
                    class="detail-select"
                    :options="normalizeParamOptions(param.options)"
                    @update:value="value => setParamValue(ruleIndex, param.key, value)"
                  />
                  <NSelect
                    v-else-if="param.type === 'attribute'"
                    :value="getSelectParam(ruleIndex, param.key)"
                    class="detail-select"
                    :options="attributeOptions.map(opt => ({ label: opt.label, value: opt.id }))"
                    placeholder="选择数值属性…"
                    clearable
                    @update:value="value => setParamValue(ruleIndex, param.key, value)"
                  />
                  <NSelect
                    v-else-if="param.type === 'zone'"
                    :value="getSelectParam(ruleIndex, param.key)"
                    class="detail-select"
                    :options="zoneOptions"
                    placeholder="选择选区…"
                    clearable
                    @update:value="value => setParamValue(ruleIndex, param.key, value)"
                  />
                </div>
              </template>
            </div>
          </div>

          <!-- 添加子规则按钮 -->
          <NButton size="small" type="primary" secondary @click="addSubRule">
            + 添加规则条件（{{ selectedLogicOperator === 'AND' ? '与' : '或' }}组合）
          </NButton>
        </div>

        <div class="builder-segment">
          <label class="seg-label">重要程度</label>
          <div class="priority-pills">
            <NButton
              v-for="p in priorities"
              :key="p.key"
              class="priority-pill"
              :class="[p.key, { active: selectedPriority === p.key }]"
              size="small"
              :secondary="selectedPriority === p.key"
              :type="selectedPriority === p.key ? priorityButtonType(p.key) : 'default'"
              @click="selectedPriority = p.key"
            >
              <span class="pill-dot"></span>
              {{ p.label }}
            </NButton>
          </div>
        </div>
      </div>

      <div v-if="previewText" class="builder-preview-section">
        <label class="seg-label">效果预览</label>
        <div class="smart-preview-card" :class="selectedPriority">
          <div class="preview-main">
            <div class="preview-text-content">{{ previewText }}</div>
          </div>
        </div>
      </div>

      <div v-if="validationWarnings.length > 0" class="validation-warnings">
        <div v-for="(w, i) in validationWarnings" :key="i" class="warning-item">
          警告：{{ w }}
        </div>
      </div>
    </div>

    <div class="builder-footer">
      <NButton type="primary" :disabled="!canAdd" @click="handleAdd">{{ isEditing ? '保存修改' : '添加规则' }}</NButton>
      <NButton secondary @click="handleReset">{{ isEditing ? '取消编辑' : '重置' }}</NButton>
    </div>

    <ResponsiveOverlay v-model:show="showTemplateDialog" title="快捷方案" :desktop-width="760" mobile-height="88dvh">
          <p class="template-description">选择后会覆盖当前编辑草稿的对象、规则类型和默认参数。</p>

          <div class="template-groups">
            <section v-for="group in quickTemplateGroups" :key="group.title" class="template-group">
              <h4>{{ group.title }}</h4>
              <NButton
                v-for="option in group.options"
                :key="option.key"
                class="template-option"
                size="small"
                secondary
                block
                @click="handleQuickTemplate(option.key)"
              >
                <span class="template-option-content">
                  <span>{{ option.title }}</span>
                  <small>{{ option.desc }}</small>
                </span>
              </NButton>
            </section>
          </div>
    </ResponsiveOverlay>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInputNumber, NSelect } from 'naive-ui'
import type { ButtonProps, SelectOption } from 'naive-ui'
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Wand2, X } from 'lucide-vue-next'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useZoneData } from '@/composables/useZoneData'
import { useSeatRules } from '@/composables/useSeatRules'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useLogger } from '@/composables/useLogger'
import { normalizeNumberInput } from '@/utils/inputNormalization'
import {
  RulePriority,
  RULE_TYPE_LABELS,
  PREDICATE_META,
  getDefaultParams,
  LogicOperator,
  LOGIC_OPERATOR_LABELS
} from '@/constants/ruleTypes'
import type { PredicateParamSpec } from '@/constants/ruleTypes'
import type {
  Rule,
  RuleInput,
  RuleParams,
  RulePriority as RulePriorityValue,
  RuleSubject,
  SubjectType
} from '@/types/models'

const emit = defineEmits<{
  (e: 'added', rule: Rule | string): void
  (e: 'cancel-edit'): void
}>()
const props = withDefaults(defineProps<{ editingRule?: Rule | null }>(), {
  editingRule: null
})

const { students } = useStudentData()
const { tags } = useTagData()
const { zones } = useZoneData()
const { getAttributeOptions } = useStudentAttributes()
const { addRule, updateRule, validateRule, renderRuleText } = useSeatRules()
const { error } = useLogger()

const QUICK_TEMPLATE_KEYS = {
  FRONT_ROW: 'front-row',
  AVOID_WINDOW: 'avoid-window',
  DESKMATES: 'deskmates',
  AVOID_DESKMATES: 'avoid-deskmates',
  KEEP_DISTANCE: 'keep-distance',
  SPREAD_GROUP: 'spread-group',
  HEIGHT_GRADIENT: 'height-gradient',
  SCORE_BALANCE: 'score-balance',
  SCORE_BANDS: 'score-bands'
} as const

type QuickTemplateKey = typeof QUICK_TEMPLATE_KEYS[keyof typeof QUICK_TEMPLATE_KEYS]

interface QuickTemplate {
  priority: RulePriorityValue
  predicate: string
  subjects: () => RuleSubject[]
  params: () => RuleParams
}

interface BuilderSubRule {
  predicate: string
  not: boolean
  params: RuleParams
}

// 新数据结构：支持多规则组合
const selectedPriority = ref<RulePriorityValue>(RulePriority.PREFER)
const description = ref('')
const selectedLogicOperator = ref<'AND' | 'OR'>(LogicOperator.AND)

// 共享的对象集合（所有子规则共用）
const sharedSubjects = ref<RuleSubject[]>([{ type: 'person', id: null }])

// 子规则列表（不再包含 subjects）
const subRules = ref<BuilderSubRule[]>([
  createEmptySubRule()
])

// 创建空的子规则（不含 subjects）
function createEmptySubRule(): BuilderSubRule {
  return {
    predicate: '',
    not: false,
    params: {}
  }
}

// 逻辑操作符选项
const logicOperators = [
  { key: LogicOperator.AND, label: '与（AND）' },
  { key: LogicOperator.OR, label: '或（OR）' }
]

// 兼容旧接口：selectedPredicate 取第一条子规则的 predicate
const selectedPredicate = computed({
  get: () => subRules.value[0]?.predicate || '',
  set: (val) => { if (subRules.value[0]) subRules.value[0].predicate = val }
})

// 兼容旧接口：subjects 指向 sharedSubjects
const subjects = computed({
  get: () => sharedSubjects.value,
  set: (val) => { sharedSubjects.value = val }
})

// 兼容旧接口：paramValues
const paramValues = computed({
  get: () => subRules.value[0]?.params || {},
  set: (val) => { if (subRules.value[0]) subRules.value[0].params = val }
})

const isEditing = computed(() => !!props.editingRule?.id)

const priorities: Array<{ key: RulePriorityValue; label: string }> = [
  { key: 'required', label: '强制必须' },
  { key: 'prefer', label: '建议尽量' },
  { key: 'optional', label: '可选参考' }
]

const priorityButtonType = (priority: RulePriorityValue): ButtonProps['type'] => {
  if (priority === 'required') return 'error'
  if (priority === 'prefer') return 'warning'
  return 'default'
}

const subjectTypeOptions: Array<{ value: SubjectType; label: string }> = [
  { value: 'all', label: '全体' },
  { value: 'person', label: '个人' },
  { value: 'tag', label: '标签' }
]

const predicateGroups = [
  {
    label: 'A. 对象位置规则',
    predicates: [
      'IN_ROW_RANGE',
      'NOT_IN_COLUMN_TYPE',
      'IN_ZONE',
      'NOT_IN_ZONE',
      'IN_GROUP_RANGE',
      'DISTRIBUTE_EVENLY',
      'CLUSTER_TOGETHER'
    ]
  },
  {
    label: 'B. 数值参考规则',
    predicates: [
      'ATTRIBUTE_ROW_GRADIENT',
      'ATTRIBUTE_GROUP_BALANCE',
      'ATTRIBUTE_PAIR_DELTA',
      'ATTRIBUTE_DISTRIBUTE_BANDS'
    ]
  },
  {
    label: 'C. 对象关系规则',
    predicates: [
      'MUST_BE_SEATMATES',
      'MUST_NOT_BE_SEATMATES',
      'DISTANCE_AT_MOST',
      'DISTANCE_AT_LEAST',
      'NOT_BLOCK_VIEW',
      'MUST_BE_SAME_GROUP',
      'MUST_NOT_BE_SAME_GROUP',
      'MUST_BE_ADJACENT_ROW'
    ]
  }
]

const filteredPredicateGroups = computed(() => {
  return predicateGroups
    .map(group => ({
      ...group,
      predicates: group.predicates
        .map(key => ({ key, label: RULE_TYPE_LABELS[key] }))
    }))
    .filter(group => group.predicates.length > 0)
})

const predicateOptions = computed(() => filteredPredicateGroups.value.map(group => ({
  type: 'group',
  key: group.label,
  label: group.label,
  children: group.predicates.map(predicate => ({
    label: predicate.label,
    value: predicate.key
  }))
})))

const studentOptions = computed(() =>
  students.value.map(s => ({ id: s.id, label: `${s.studentNumber || '-'} ${s.name || '未命名'}` }))
)

const tagOptions = computed(() =>
  tags.value.map(t => ({ id: t.id, label: t.name }))
)

const attributeOptions = computed(() => getAttributeOptions())
const zoneOptions = computed(() => zones.value.map(zone => ({
  label: zone.name,
  value: zone.id
})))

const getNumberParam = (ruleIndex: number, key: string): number | null => {
  const value = subRules.value[ruleIndex]?.params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const getSelectParam = (ruleIndex: number, key: string): string | number | null => {
  const value = subRules.value[ruleIndex]?.params[key]
  return typeof value === 'string' || typeof value === 'number' ? value : null
}

const setParamValue = (ruleIndex: number, key: string, value: string | number | null) => {
  const rule = subRules.value[ruleIndex]
  if (!rule) return
  if (value === null) {
    delete rule.params[key]
    return
  }
  rule.params[key] = value
}

const setNumberParamValue = (
  ruleIndex: number,
  param: PredicateParamSpec,
  value: number | null
) => {
  setParamValue(ruleIndex, param.key, normalizeNumberInput(value, {
    min: param.min ?? 1,
    precision: 0
  }))
}

const normalizeParamOptions = (
  options: Array<{ label: string; value: string | number }> | undefined
): SelectOption[] => (
  options?.map(option => ({ label: option.label, value: option.value })) ?? []
)

// 获取指定子规则的参数规格
const getParamSpecs = (ruleIndex: number) => {
  const predicate = subRules.value[ruleIndex]?.predicate
  if (!predicate) return []
  return PREDICATE_META[predicate]?.params ?? []
}

// 获取指定子规则的最小对象数提示
const getSubjectHint = (ruleIndex: number) => {
  const predicate = subRules.value[ruleIndex]?.predicate
  if (!predicate) return ''
  const minSubjects = PREDICATE_META[predicate]?.minSubjects ?? 1
  return minSubjects > 1 ? `当前规则至少需要 ${minSubjects} 个对象` : ''
}

const currentRulePayload = computed<RuleInput>(() => {
  const firstRule = subRules.value[0]
  // 如果只有一条子规则且未取反，保持兼容的扁平结构
  if (subRules.value.length === 1 && firstRule && !firstRule.not) {
    const sr = firstRule
    return {
      subjects: sharedSubjects.value.map(s => ({ ...s })),
      predicate: sr.predicate,
      priority: selectedPriority.value,
      params: { ...sr.params },
      description: description.value
    }
  }

  // 多规则或有取反，使用复合结构
  return {
    subjects: sharedSubjects.value.map(s => ({ ...s })),
    predicate: firstRule?.predicate || '',
    priority: selectedPriority.value,
    params: { ...(firstRule?.params || {}) },
    description: description.value,
    // 新增字段
    not: subRules.value.length === 1 ? subRules.value[0].not : false,
    logicOperator: subRules.value.length > 1 ? selectedLogicOperator.value : null,
    subRules: subRules.value.map(sr => ({
      predicate: sr.predicate,
      not: sr.not,
      subjects: sharedSubjects.value.map(s => ({ ...s })),
      params: { ...sr.params }
    }))
  }
})

const validationWarnings = ref<string[]>([])
const canAdd = ref(false)
const previewText = ref('')
const showTemplateDialog = ref(false)
let feedbackTimer: number | null = null

const quickTemplateGroups = [
  {
    title: '位置照顾',
    options: [
      { key: QUICK_TEMPLATE_KEYS.FRONT_ROW, title: '前排优先', desc: '给需要关注的学生限定前几排' },
      { key: QUICK_TEMPLATE_KEYS.AVOID_WINDOW, title: '避开窗边', desc: '减少靠墙或窗边位置影响' }
    ]
  },
  {
    title: '同桌关系',
    options: [
      { key: QUICK_TEMPLATE_KEYS.DESKMATES, title: '安排同桌', desc: '把两个指定学生安排为同桌' },
      { key: QUICK_TEMPLATE_KEYS.AVOID_DESKMATES, title: '禁止同桌', desc: '避免两个学生成为同桌' },
      { key: QUICK_TEMPLATE_KEYS.KEEP_DISTANCE, title: '保持距离', desc: '让指定学生之间隔开距离' }
    ]
  },
  {
    title: '全班均衡',
    options: [
      { key: QUICK_TEMPLATE_KEYS.SPREAD_GROUP, title: '标签分散', desc: '把同标签学生尽量分散' },
      { key: QUICK_TEMPLATE_KEYS.HEIGHT_GRADIENT, title: '身高梯度', desc: '按身高形成前后梯度' },
      { key: QUICK_TEMPLATE_KEYS.SCORE_BALANCE, title: '成绩均衡', desc: '让各大组平均成绩接近' },
      { key: QUICK_TEMPLATE_KEYS.SCORE_BANDS, title: '成绩分层', desc: '按成绩分层后均匀分布' }
    ]
  }
]

const buildFeedbackState = () => {
  const firstPredicate = subRules.value[0]?.predicate
  if (!firstPredicate) return { valid: false, warnings: [], preview: '' }

  // 验证每条子规则
  const allWarnings: string[] = []
  for (const sr of subRules.value) {
    if (!sr.predicate) continue
    const result = validateRule({
      subjects: sharedSubjects.value,
      predicate: sr.predicate,
      params: sr.params
    })
    if (result.warnings?.length) {
      allWarnings.push(...result.warnings)
    }
  }

  let preview = ''
  if (subRules.value.some(sr => sr.predicate)) {
    try {
      preview = renderRuleText({
        id: 'preview',
        ...currentRulePayload.value
      })
    } catch {
      preview = ''
    }
  }

  return {
    valid: allWarnings.length === 0 && !!firstPredicate,
    warnings: allWarnings,
    preview
  }
}

const applyFeedbackState = () => {
  const state = buildFeedbackState()
  validationWarnings.value = state.warnings
  canAdd.value = subRules.value.some(sr => sr.predicate) && state.valid
  previewText.value = state.preview
  return state
}

const scheduleFeedbackUpdate = () => {
  if (feedbackTimer) window.clearTimeout(feedbackTimer)
  feedbackTimer = window.setTimeout(() => {
    feedbackTimer = null
    applyFeedbackState()
  }, 120)
}

const getEntryOptions = (type: SubjectType) => {
  if (type === 'all') return []
  if (type === 'person') return studentOptions.value
  return tagOptions.value
}

const onEntryTypeChange = (entry: RuleSubject) => {
  entry.id = null
  if (entry.type === 'all') {
    sharedSubjects.value = [{ type: 'all', id: null }]
  }
}

// 切换子规则的 not 状态
const toggleNot = (ruleIndex: number) => {
  if (subRules.value[ruleIndex]) {
    subRules.value[ruleIndex].not = !subRules.value[ruleIndex].not
  }
}

// 添加子规则
const addSubRule = () => {
  subRules.value.push(createEmptySubRule())
}

// 删除子规则
const removeSubRule = (ruleIndex: number) => {
  subRules.value.splice(ruleIndex, 1)
  if (subRules.value.length === 0) {
    subRules.value.push(createEmptySubRule())
  }
}

// 共享对象管理：添加对象
const addSharedEntry = () => {
  sharedSubjects.value.push({ type: 'person', id: null })
}

// 共享对象管理：删除对象
const removeSharedEntry = (entryIndex: number) => {
  sharedSubjects.value.splice(entryIndex, 1)
  if (sharedSubjects.value.length === 0) {
    sharedSubjects.value.push({ type: 'person', id: null })
  }
}

// 确保共享对象数量满足最小要求（基于所有子规则的 max minSubjects）
const ensureMinimumSharedSubjects = () => {
  let maxMinSubjects = 1
  for (const sr of subRules.value) {
    if (sr.predicate) {
      const minSubjects = PREDICATE_META[sr.predicate]?.minSubjects ?? 1
      if (minSubjects > maxMinSubjects) maxMinSubjects = minSubjects
    }
  }
  while (sharedSubjects.value.length < maxMinSubjects) {
    sharedSubjects.value.push({ type: 'person', id: null })
  }
}

const onPredicateChange = (ruleIndex: number) => {
  const sr = subRules.value[ruleIndex]
  if (sr?.predicate) {
    sr.params = getDefaultParams(sr.predicate)
    // 检查并确保共享对象数量足够
    ensureMinimumSharedSubjects()
  }
}

const handleAdd = () => {
  if (feedbackTimer) {
    window.clearTimeout(feedbackTimer)
    feedbackTimer = null
  }
  applyFeedbackState()
  if (!canAdd.value) return
  const editingRule = props.editingRule
  if (isEditing.value && editingRule) {
    const updated = updateRule(editingRule.id, currentRulePayload.value)
    if (updated) {
      emit('added', editingRule.id)
      resetForm()
      return
    }
    error('当前编辑的规则不存在，可能已被删除或覆盖，请刷新规则列表后重试。')
    return
  }
  const result = addRule(currentRulePayload.value)
  if (result.success && result.rule) {
    emit('added', result.rule)
    resetForm()
  }
}

const resetForm = () => {
  selectedPriority.value = RulePriority.PREFER
  description.value = ''
  selectedLogicOperator.value = LogicOperator.AND
  sharedSubjects.value = [{ type: 'person', id: null }]
  subRules.value = [createEmptySubRule()]
}

const handleReset = () => {
  resetForm()
  if (isEditing.value) {
    emit('cancel-edit')
  }
}

const applyEditingRule = (rule: Rule | null | undefined) => {
  if (!rule?.id) {
    resetForm()
    return
  }

  selectedPriority.value = rule.priority || RulePriority.PREFER
  description.value = rule.description || ''

  // 恢复逻辑操作符
  selectedLogicOperator.value = rule.logicOperator || LogicOperator.AND

  // 恢复共享对象集合（从规则的主 subjects 字段）
  sharedSubjects.value = rule.subjects?.length
    ? rule.subjects.map(s => ({ ...s }))
    : [{ type: 'person', id: null }]

  // 恢复子规则列表（不再包含 subjects）
  if (rule.subRules && rule.subRules.length > 0) {
    subRules.value = rule.subRules.map(sr => ({
      predicate: sr.predicate || '',
      not: sr.not || false,
      params: { ...(sr.params || (sr.predicate ? getDefaultParams(sr.predicate) : {})) }
    }))
  } else {
    // 兼容旧格式：单条规则
    subRules.value = [{
      predicate: rule.predicate || '',
      not: rule.not || false,
      params: { ...(rule.params || (rule.predicate ? getDefaultParams(rule.predicate) : {})) }
    }]
  }
}

const applyQuickTemplate = (key: QuickTemplateKey) => {
  const quickTemplates: Record<QuickTemplateKey, QuickTemplate> = {
    [QUICK_TEMPLATE_KEYS.FRONT_ROW]: {
      priority: RulePriority.REQUIRED,
      predicate: 'IN_ROW_RANGE',
      subjects: () => [{ type: 'person', id: null }],
      params: () => getDefaultParams('IN_ROW_RANGE')
    },
    [QUICK_TEMPLATE_KEYS.AVOID_WINDOW]: {
      priority: RulePriority.PREFER,
      predicate: 'NOT_IN_COLUMN_TYPE',
      subjects: () => [{ type: 'person', id: null }],
      params: () => ({ ...getDefaultParams('NOT_IN_COLUMN_TYPE'), columnType: 'wall' })
    },
    [QUICK_TEMPLATE_KEYS.DESKMATES]: {
      priority: RulePriority.REQUIRED,
      predicate: 'MUST_BE_SEATMATES',
      subjects: () => [{ type: 'person', id: null }, { type: 'person', id: null }],
      params: () => getDefaultParams('MUST_BE_SEATMATES')
    },
    [QUICK_TEMPLATE_KEYS.AVOID_DESKMATES]: {
      priority: RulePriority.REQUIRED,
      predicate: 'MUST_NOT_BE_SEATMATES',
      subjects: () => [{ type: 'person', id: null }, { type: 'person', id: null }],
      params: () => getDefaultParams('MUST_NOT_BE_SEATMATES')
    },
    [QUICK_TEMPLATE_KEYS.KEEP_DISTANCE]: {
      priority: RulePriority.PREFER,
      predicate: 'DISTANCE_AT_LEAST',
      subjects: () => [{ type: 'person', id: null }, { type: 'person', id: null }],
      params: () => ({ ...getDefaultParams('DISTANCE_AT_LEAST'), distance: 3 })
    },
    [QUICK_TEMPLATE_KEYS.SPREAD_GROUP]: {
      priority: RulePriority.PREFER,
      predicate: 'DISTRIBUTE_EVENLY',
      subjects: () => [{ type: 'tag', id: null }],
      params: () => getDefaultParams('DISTRIBUTE_EVENLY')
    },
    [QUICK_TEMPLATE_KEYS.HEIGHT_GRADIENT]: {
      priority: RulePriority.PREFER,
      predicate: 'ATTRIBUTE_ROW_GRADIENT',
      subjects: () => [{ type: 'all', id: null }],
      params: () => ({ ...getDefaultParams('ATTRIBUTE_ROW_GRADIENT'), attributeId: 'height', direction: 'lowFront' })
    },
    [QUICK_TEMPLATE_KEYS.SCORE_BALANCE]: {
      priority: RulePriority.PREFER,
      predicate: 'ATTRIBUTE_GROUP_BALANCE',
      subjects: () => [{ type: 'all', id: null }],
      params: () => ({ ...getDefaultParams('ATTRIBUTE_GROUP_BALANCE'), attributeId: 'score', aggregate: 'average' })
    },
    [QUICK_TEMPLATE_KEYS.SCORE_BANDS]: {
      priority: RulePriority.PREFER,
      predicate: 'ATTRIBUTE_DISTRIBUTE_BANDS',
      subjects: () => [{ type: 'all', id: null }],
      params: () => ({ ...getDefaultParams('ATTRIBUTE_DISTRIBUTE_BANDS'), attributeId: 'score', bandCount: 3 })
    }
  }

  const tpl = quickTemplates[key]
  if (!tpl) return
  selectedPriority.value = tpl.priority
  selectedLogicOperator.value = LogicOperator.AND
  sharedSubjects.value = tpl.subjects ? tpl.subjects() : [{ type: 'person', id: null }]
  subRules.value = [{
    predicate: tpl.predicate,
    params: tpl.params(),
    not: false
  }]
  ensureMinimumSharedSubjects()
}

const handleQuickTemplate = (key: QuickTemplateKey) => {
  applyQuickTemplate(key)
  showTemplateDialog.value = false
  applyFeedbackState()
}

watch(
  () => props.editingRule?.id ?? null,
  () => {
    applyEditingRule(props.editingRule)
    applyFeedbackState()
  },
  { immediate: true }
)

watch(
  [sharedSubjects, subRules, selectedPriority, description, selectedLogicOperator],
  scheduleFeedbackUpdate,
  { deep: true }
)

onBeforeUnmount(() => {
  if (feedbackTimer) {
    window.clearTimeout(feedbackTimer)
    feedbackTimer = null
  }
  showTemplateDialog.value = false
})

defineExpose({
  applyQuickTemplate
})
</script>

<style scoped>
.rule-builder {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.builder-content {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding-right: 4px;
}

.builder-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.builder-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-primary); }
.sentence-builder { display: flex; flex-direction: column; gap: 16px; padding: 16px; background: var(--color-surface); border-radius: 12px; border: 1px solid var(--color-border-light); }
.builder-segment { display: flex; flex-direction: column; gap: 8px; }
.seg-label { font-size: 12px; color: var(--color-text-muted); font-weight: 600; }

/* 内联对象集合 */
.inline-subject {
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  padding: 12px;
  background: var(--color-bg-card);
}

/* 规则容器 */
.rules-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 子规则项（同一框内） */
.sub-rule-item {
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--color-bg-card);
}
.sub-rule-item + .sub-rule-item {
  margin-top: 4px;
}

/* 规则头部行：逻辑符 → 取反 → 选择器 → 删除 */
.rule-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 逻辑操作符切换按钮（在每行左侧） */
.logic-toggle {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

/* 占位符（第一条规则不显示逻辑符） */
.logic-placeholder {
  width: 36px;
  flex-shrink: 0;
}

.flex-1 {
  flex: 1;
  min-width: 0;
}

/* 是/非切换按钮 */
.not-toggle {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

/* 内联参数区域 */
.params-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-border);
}
.inline-param {
  flex: 0 0 auto;
  min-width: 140px;
}

/* 删除子规则按钮 */
.remove-rule-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rule-selector-wrap { position: relative; }
.seg-select { width: 100%; }
.priority-pills { display: flex; gap: 8px; }
.subject-section { display: flex; flex-direction: column; gap: 12px; }
.subject-slot { display: flex; flex-direction: column; gap: 8px; }
.subject-row { display: grid; grid-template-columns: 120px 1fr auto; gap: 8px; }
.input-group { display: flex; flex-direction: column; gap: 6px; }
.input-group label { font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
.detail-select, .detail-input { width: 100%; }
.builder-preview-section { display: flex; flex-direction: column; gap: 8px; }
.smart-preview-card { border: 1px solid var(--color-border); border-radius: 10px; padding: 10px 12px; background: var(--color-bg-secondary); }
.preview-text-content { font-size: 13px; color: var(--color-text-primary); }
.validation-warnings { display: flex; flex-direction: column; gap: 6px; }
.warning-item { color: var(--color-warning); font-size: 12px; }
.builder-footer {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-dialog-bg);
}
.template-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 0;
}

.template-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-group h4 {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.template-option {
  width: 100%;
  min-height: 54px;
  text-align: left;
}

.template-option-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.template-option span {
  font-size: 13px;
  font-weight: 700;
}

.template-option small {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 720px) {
  .rule-builder {
    height: 100%;
  }

  .builder-content {
    padding-right: 0;
  }

  .builder-heading {
    align-items: stretch;
  }

  .sentence-builder {
    padding: 12px;
    gap: 14px;
  }

  .subject-row {
    grid-template-columns: 1fr;
  }

  .rule-header-row {
    flex-wrap: wrap;
    align-items: stretch;
  }

  .logic-placeholder {
    display: none;
  }

  .logic-toggle,
  .not-toggle,
  .remove-rule-btn {
    width: 44px;
    height: 44px;
  }

  .rule-selector-wrap {
    flex-basis: calc(100% - 52px);
  }

  .seg-select,
  .detail-select,
  .detail-input,
  .mini-btn,
  .priority-pill {
    min-height: 44px;
  }

  .inline-param {
    flex: 1 1 100%;
    min-width: 0;
  }

  .priority-pills {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .builder-footer {
    padding-bottom: env(safe-area-inset-bottom, 0);
  }

  .template-groups {
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0));
  }
}
</style>
