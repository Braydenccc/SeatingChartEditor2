<template>
  <div class="rule-builder">
    <h4 class="builder-title">{{ isEditing ? '编辑规则' : '添加新规则' }}</h4>

    <div v-if="mode === 'quick'" class="quick-template-wrap">
      <label class="seg-label">快捷场景</label>
      <div class="quick-template-grid">
        <button class="quick-template-btn" @click="applyQuickTemplate('front-row')">前排优先</button>
        <button class="quick-template-btn" @click="applyQuickTemplate('avoid-window')">避开窗边</button>
        <button class="quick-template-btn" @click="applyQuickTemplate('deskmates')">同桌绑定</button>
        <button class="quick-template-btn" @click="applyQuickTemplate('spread-group')">分组分散</button>
      </div>
      <p class="quick-template-tip">提示：点击后可继续修改对象、参数和优先级。</p>
    </div>

    <div class="sentence-builder">
      <!-- 对象集合（所有子规则共用） -->
      <div class="builder-segment">
        <label class="seg-label">适用对象</label>
        <div class="subject-section inline-subject">
          <div class="subject-slot">
            <div v-for="(entry, entryIndex) in sharedSubjects" :key="`s-${entryIndex}`" class="subject-row">
              <select v-model="entry.type" class="detail-select" @change="onEntryTypeChange(entry)">
                <option value="person">个人</option>
                <option value="tag">标签</option>
              </select>

              <select v-model="entry.id" class="detail-select">
                <option :value="null">{{ entry.type === 'person' ? '选择学生…' : '选择标签…' }}</option>
                <option
                  v-for="opt in getEntryOptions(entry.type)"
                  :key="opt.id"
                  :value="opt.id"
                >
                  {{ opt.label }}
                </option>
              </select>

              <button class="mini-btn danger" @click="removeSharedEntry(entryIndex)">删除</button>
            </div>
            <button class="mini-btn" @click="addSharedEntry">+ 添加对象</button>
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
            <button
              v-if="subRules.length > 1"
              class="logic-toggle"
              :class="{ active: selectedLogicOperator === 'AND', or: selectedLogicOperator === 'OR' }"
              @click="selectedLogicOperator = selectedLogicOperator === 'AND' ? 'OR' : 'AND'"
              title="点击切换与/或"
            >
              {{ selectedLogicOperator === 'AND' ? '且' : '或' }}
            </button>
            <span v-else class="logic-placeholder"></span>

            <!-- 是/非 切换 -->
            <button
              class="not-toggle"
              :class="{ active: subRule.not }"
              @click="toggleNot(ruleIndex)"
              title="点击切换是否取反该规则"
            >
              {{ subRule.not ? '非' : '是' }}
            </button>

            <div class="rule-selector-wrap flex-1">
              <select
                v-model="subRule.predicate"
                class="seg-select pred-select"
                @change="onPredicateChange(ruleIndex)"
              >
                <option value="" disabled>请选择规则类型...</option>
                <optgroup v-for="group in filteredPredicateGroups" :key="group.label" :label="group.label">
                  <option v-for="p in group.predicates" :key="p.key" :value="p.key">
                    {{ p.label }}
                  </option>
                </optgroup>
              </select>
              <div class="select-arrow"></div>
            </div>

            <!-- 删除子规则按钮 -->
            <button
              v-if="subRules.length > 1"
              class="mini-btn danger remove-rule-btn"
              @click="removeSubRule(ruleIndex)"
              title="删除此规则"
            >
              <X :size="14" />
            </button>
          </div>

          <!-- 参数（仅当选择了谓词时显示） -->
          <div v-if="subRule.predicate && getParamSpecs(ruleIndex).length > 0" class="params-inline">
            <template v-for="param in getParamSpecs(ruleIndex)" :key="param.key">
              <div class="input-group inline-param">
                <label>{{ param.label }}</label>
                <input
                  v-if="param.type === 'number'"
                  v-model.number="subRule.params[param.key]"
                  type="number"
                  :min="param.min ?? 1"
                  class="detail-input"
                />
                <select
                  v-else-if="param.type === 'select'"
                  v-model="subRule.params[param.key]"
                  class="detail-select"
                >
                  <option v-for="opt in param.options" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
                <select
                  v-else-if="param.type === 'zone'"
                  v-model="subRule.params[param.key]"
                  class="detail-select"
                >
                  <option :value="null">选择选区…</option>
                  <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }}</option>
                </select>
              </div>
            </template>
          </div>
        </div>

        <!-- 添加子规则按钮 -->
        <button class="add-sub-rule-btn" @click="addSubRule">
          + 添加规则条件（{{ selectedLogicOperator === 'AND' ? '与' : '或' }}组合）
        </button>
      </div>

      <div class="builder-segment">
        <label class="seg-label">重要程度</label>
        <div class="priority-pills">
          <button
            v-for="p in priorities"
            :key="p.key"
            class="priority-pill"
            :class="[p.key, { active: selectedPriority === p.key }]"
            @click="selectedPriority = p.key"
          >
            <span class="pill-dot"></span>
            {{ p.label }}
          </button>
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

    <div class="builder-footer">
      <button class="btn-add" :disabled="!canAdd" @click="handleAdd">{{ isEditing ? '保存修改' : '添加规则' }}</button>
      <button class="btn-reset" @click="handleReset">{{ isEditing ? '取消编辑' : '重置' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useZoneData } from '@/composables/useZoneData'
import { useSeatRules } from '@/composables/useSeatRules'
import { useLogger } from '@/composables/useLogger'
import {
  RulePriority,
  RULE_TYPE_LABELS,
  PREDICATE_META,
  getDefaultParams,
  LogicOperator,
  LOGIC_OPERATOR_LABELS
} from '@/constants/ruleTypes.js'

const emit = defineEmits(['added', 'cancel-edit'])
const props = defineProps({
  mode: {
    type: String,
    default: 'quick'
  },
  editingRule: {
    type: Object,
    default: null
  }
})

const { students } = useStudentData()
const { tags } = useTagData()
const { zones } = useZoneData()
const { addRule, updateRule, validateRule, renderRuleText } = useSeatRules()
const { error } = useLogger()

const QUICK_TEMPLATE_KEYS = {
  FRONT_ROW: 'front-row',
  AVOID_WINDOW: 'avoid-window',
  DESKMATES: 'deskmates',
  SPREAD_GROUP: 'spread-group'
}

// 新数据结构：支持多规则组合
const selectedPriority = ref(RulePriority.PREFER)
const description = ref('')
const selectedLogicOperator = ref(LogicOperator.AND)

// 共享的对象集合（所有子规则共用）
const sharedSubjects = ref([{ type: 'person', id: null }])

// 子规则列表（不再包含 subjects）
const subRules = ref([
  createEmptySubRule()
])

// 创建空的子规则（不含 subjects）
function createEmptySubRule() {
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

const priorities = [
  { key: 'required', label: '强制必须' },
  { key: 'prefer', label: '建议尽量' },
  { key: 'optional', label: '可选参考' }
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
    label: 'B. 对象关系规则',
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

// 获取指定子规则的参数规格
const getParamSpecs = (ruleIndex) => {
  const predicate = subRules.value[ruleIndex]?.predicate
  if (!predicate) return []
  return PREDICATE_META[predicate]?.params ?? []
}

// 获取指定子规则的最小对象数提示
const getSubjectHint = (ruleIndex) => {
  const predicate = subRules.value[ruleIndex]?.predicate
  if (!predicate) return ''
  const minSubjects = PREDICATE_META[predicate]?.minSubjects ?? 1
  return minSubjects > 1 ? `当前规则至少需要 ${minSubjects} 个对象` : ''
}

const currentRulePayload = computed(() => {
  // 如果只有一条子规则且未取反，保持兼容的扁平结构
  if (subRules.value.length === 1 && !subRules.value[0].not) {
    const sr = subRules.value[0]
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
    predicate: subRules.value[0]?.predicate || '',
    priority: selectedPriority.value,
    params: { ...(subRules.value[0]?.params || {}) },
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

const validationResult = computed(() => {
  const firstPredicate = subRules.value[0]?.predicate
  if (!firstPredicate) return { valid: false, warnings: [] }

  // 验证每条子规则
  const allWarnings = []
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

  return {
    valid: allWarnings.length === 0 && firstPredicate,
    warnings: allWarnings
  }
})

const validationWarnings = computed(() => validationResult.value.warnings)
const canAdd = computed(() => {
  return subRules.value.some(sr => sr.predicate) && validationResult.value.valid
})

const previewText = computed(() => {
  if (!subRules.value.some(sr => sr.predicate)) return ''
  try {
    return renderRuleText({
      id: 'preview',
      ...currentRulePayload.value
    })
  } catch {
    return ''
  }
})

const getEntryOptions = (type) => {
  if (type === 'person') {
    return students.value.map(s => ({ id: s.id, label: `${s.studentNumber || '-'} ${s.name || '未命名'}` }))
  }
  return tags.value.map(t => ({ id: t.id, label: t.name }))
}

const onEntryTypeChange = (entry) => {
  entry.id = null
}

// 切换子规则的 not 状态
const toggleNot = (ruleIndex) => {
  if (subRules.value[ruleIndex]) {
    subRules.value[ruleIndex].not = !subRules.value[ruleIndex].not
  }
}

// 添加子规则
const addSubRule = () => {
  subRules.value.push(createEmptySubRule())
}

// 删除子规则
const removeSubRule = (ruleIndex) => {
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
const removeSharedEntry = (entryIndex) => {
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

const onPredicateChange = (ruleIndex) => {
  const sr = subRules.value[ruleIndex]
  if (sr?.predicate) {
    sr.params = getDefaultParams(sr.predicate)
    // 检查并确保共享对象数量足够
    ensureMinimumSharedSubjects()
  }
}

const handleAdd = () => {
  if (!canAdd.value) return
  if (isEditing.value) {
    const updated = updateRule(props.editingRule.id, currentRulePayload.value)
    if (updated) {
      emit('added', props.editingRule.id)
      resetForm()
      return
    }
    error('当前编辑的规则不存在，可能已被删除或覆盖，请刷新规则列表后重试。')
    return
  }
  const result = addRule(currentRulePayload.value)
  if (result.success) {
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

const applyEditingRule = (rule) => {
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

const applyQuickTemplate = (key) => {
  const quickTemplates = {
    [QUICK_TEMPLATE_KEYS.FRONT_ROW]: {
      priority: RulePriority.REQUIRED,
      predicate: 'IN_ROW_RANGE',
      params: () => getDefaultParams('IN_ROW_RANGE')
    },
    [QUICK_TEMPLATE_KEYS.AVOID_WINDOW]: {
      priority: RulePriority.PREFER,
      predicate: 'NOT_IN_COLUMN_TYPE',
      params: () => ({ ...getDefaultParams('NOT_IN_COLUMN_TYPE'), columnType: 'wall' })
    },
    [QUICK_TEMPLATE_KEYS.DESKMATES]: {
      priority: RulePriority.REQUIRED,
      predicate: 'MUST_BE_SEATMATES',
      params: () => getDefaultParams('MUST_BE_SEATMATES')
    },
    [QUICK_TEMPLATE_KEYS.SPREAD_GROUP]: {
      priority: RulePriority.PREFER,
      predicate: 'DISTRIBUTE_EVENLY',
      params: () => ({ ...getDefaultParams('DISTRIBUTE_EVENLY'), scope: 'group' })
    }
  }

  const tpl = quickTemplates[key]
  if (!tpl) return
  selectedPriority.value = tpl.priority

  // 应用到第一条子规则
  if (subRules.value[0]) {
    subRules.value[0].predicate = tpl.predicate
    subRules.value[0].params = tpl.params()
    subRules.value[0].not = false
    const minSubjects = PREDICATE_META[tpl.predicate]?.minSubjects ?? 1
    ensureMinimumSubjects(0, minSubjects)
  }
}

watch(
  () => props.editingRule?.id ?? null,
  () => {
    applyEditingRule(props.editingRule)
  },
  { immediate: true }
)
</script>

<style scoped>
.rule-builder { display: flex; flex-direction: column; gap: 14px; }
.builder-title { margin: 0; font-size: 14px; font-weight: 600; color: #23587b; }
.quick-template-wrap { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
.quick-template-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.quick-template-btn { border: 1px solid #dbe3ea; background: white; color: #334155; border-radius: 8px; padding: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
.quick-template-tip { margin: 0; font-size: 12px; color: #64748b; }
.sentence-builder { display: flex; flex-direction: column; gap: 16px; padding: 16px; background: white; border-radius: 12px; border: 1px solid #eef2f6; }
.builder-segment { display: flex; flex-direction: column; gap: 8px; }
.seg-label { font-size: 12px; color: #64748b; font-weight: 600; }

/* 内联对象集合 */
.inline-subject {
  border: 1px solid #eef2f6;
  border-radius: 10px;
  padding: 12px;
  background: #fafbfc;
}

/* 规则容器 */
.rules-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 子规则项（同一框内） */
.sub-rule-item {
  border: 1px solid #eef2f6;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fafbfc;
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
  border: 2px solid #dbe3ea;
  background: white;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.logic-toggle:hover { border-color: #94a3b8; }
.logic-toggle.active {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #2563eb;
}
.logic-toggle.or {
  background: #fefce8;
  border-color: #eab308;
  color: #ca8a04;
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
  border: 2px solid #e2e8f0;
  background: white;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.not-toggle:hover { border-color: #94a3b8; }
.not-toggle.active {
  background: #fef2f2;
  border-color: #ef4444;
  color: #ef4444;
}

/* 内联参数区域 */
.params-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
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

/* 添加子规则按钮 */
.add-sub-rule-btn {
  border: 1px solid #dbe3ea;
  background: white;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: normal;
  cursor: pointer;
  transition: all 0.2s ease;
}
.add-sub-rule-btn:hover {
  border-color: #94a3b8;
}

.chip-group { display: flex; gap: 8px; flex-wrap: wrap; }
.chip-item { border: 1px solid #dbe3ea; background: white; color: #334155; border-radius: 999px; font-size: 12px; padding: 6px 12px; cursor: pointer; }
.chip-item.active { background: #23587b; color: white; border-color: #23587b; }
.rule-selector-wrap { position: relative; }
.seg-select { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid #dbe3ea; }
.priority-pills { display: flex; gap: 8px; }
.priority-pill { border: 1px solid #dbe3ea; background: white; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
.priority-pill.active { border-color: #23587b; color: #23587b; }
.subject-section { display: flex; flex-direction: column; gap: 12px; }
.subject-slot { display: flex; flex-direction: column; gap: 8px; }
.slot-title { font-size: 12px; color: #334155; font-weight: 600; }
.subject-row { display: grid; grid-template-columns: 120px 1fr auto; gap: 8px; }
.mini-btn { border: 1px solid #dbe3ea; background: white; border-radius: 8px; font-size: 12px; padding: 6px 10px; cursor: pointer; }
.mini-btn.danger { color: #b91c1c; border-color: #fecaca; }
.input-group { display: flex; flex-direction: column; gap: 6px; }
.input-group label { font-size: 12px; font-weight: 600; color: #1f2937; }
.detail-select, .detail-input { width: 100%; padding: 8px 10px; border: 1px solid #dbe3ea; border-radius: 8px; }
.params-section { display: flex; flex-direction: column; gap: 10px; }
.builder-preview-section { display: flex; flex-direction: column; gap: 8px; }
.smart-preview-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; background: #f8fafc; }
.preview-text-content { font-size: 13px; color: #334155; }
.validation-warnings { display: flex; flex-direction: column; gap: 6px; }
.warning-item { color: #b45309; font-size: 12px; }
.builder-footer { display: flex; gap: 8px; }
.btn-add, .btn-reset { border-radius: 8px; padding: 8px 12px; border: 1px solid #dbe3ea; background: white; cursor: pointer; }
.btn-add[disabled] { opacity: 0.5; cursor: not-allowed; }
</style>
