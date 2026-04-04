<template>
  <div class="rule-builder">
    <h4 class="builder-title">添加新规则</h4>

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
      <div class="builder-segment">
        <label class="seg-label">针对对象</label>
        <div class="chip-group">
          <button
            v-for="item in subjectModes"
            :key="item.key"
            class="chip-item"
            :class="{ active: subjectMode === item.key }"
            @click="setSubjectMode(item.key)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="builder-segment">
        <label class="seg-label">应用规则</label>
        <div class="rule-selector-wrap">
          <select v-model="selectedPredicate" class="seg-select pred-select" @change="onPredicateChange">
            <option value="" disabled>请选择规则类型...</option>
            <optgroup v-for="group in filteredPredicateGroups" :key="group.label" :label="group.label">
              <option v-for="p in group.predicates" :key="p.key" :value="p.key">
                {{ p.label }}
              </option>
            </optgroup>
          </select>
          <div class="select-arrow"></div>
        </div>
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

    <div class="subject-section" v-if="selectedPredicate">
      <div class="subject-slot">
        <div class="slot-title">对象集合 A</div>
        <div v-for="(entry, index) in subjectsA" :key="`a-${index}`" class="subject-row">
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

          <button class="mini-btn danger" @click="removeEntry('A', index)">删除</button>
        </div>
        <button class="mini-btn" @click="addEntry('A')">+ 添加对象</button>
      </div>

      <div class="subject-slot" v-if="subjectMode === 'dual'">
        <div class="slot-title">对象集合 B</div>
        <div v-for="(entry, index) in subjectsB" :key="`b-${index}`" class="subject-row">
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

          <button class="mini-btn danger" @click="removeEntry('B', index)">删除</button>
        </div>
        <button class="mini-btn" @click="addEntry('B')">+ 添加对象</button>
      </div>

      <div v-if="paramSpecs.length > 0" class="params-section">
        <template v-for="param in paramSpecs" :key="param.key">
          <div class="input-group">
            <label>{{ param.label }}</label>
            <input
              v-if="param.type === 'number'"
              v-model.number="paramValues[param.key]"
              type="number"
              :min="param.min ?? 1"
              class="detail-input"
            />
            <select
              v-else-if="param.type === 'select'"
              v-model="paramValues[param.key]"
              class="detail-select"
            >
              <option v-for="opt in param.options" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <select
              v-else-if="param.type === 'zone'"
              v-model="paramValues[param.key]"
              class="detail-select"
            >
              <option :value="null">选择选区…</option>
              <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }}</option>
            </select>
          </div>
        </template>
      </div>

      <div class="input-group">
        <label>备注（选填）</label>
        <input v-model="description" type="text" class="detail-input" placeholder="为这条规则添加说明…" />
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
        ⚠️ {{ w }}
      </div>
    </div>

    <div class="builder-footer">
      <button class="btn-add" :disabled="!canAdd" @click="handleAdd">添加规则</button>
      <button class="btn-reset" @click="resetForm">重置</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useZoneData } from '@/composables/useZoneData'
import { useSeatRules } from '@/composables/useSeatRules'
import {
  RulePriority,
  RULE_TYPE_LABELS,
  PREDICATE_META,
  getDefaultParams
} from '@/constants/ruleTypes.js'

const emit = defineEmits(['added'])
const props = defineProps({
  mode: {
    type: String,
    default: 'quick'
  }
})

const { students } = useStudentData()
const { tags } = useTagData()
const { zones } = useZoneData()
const { addRule, validateRule, renderRuleText } = useSeatRules()

const QUICK_TEMPLATE_KEYS = {
  FRONT_ROW: 'front-row',
  AVOID_WINDOW: 'avoid-window',
  DESKMATES: 'deskmates',
  SPREAD_GROUP: 'spread-group'
}

const subjectMode = ref('single')
const selectedPredicate = ref('')
const selectedPriority = ref(RulePriority.PREFER)
const description = ref('')
const subjectsA = ref([{ type: 'person', id: null }])
const subjectsB = ref([{ type: 'person', id: null }])
const paramValues = ref({})

const subjectModes = [
  { key: 'single', label: '单对象' },
  { key: 'dual', label: '双对象' }
]

const priorities = [
  { key: 'required', label: '强制必须' },
  { key: 'prefer', label: '建议尽量' },
  { key: 'optional', label: '可选参考' }
]

const predicateGroups = [
  {
    label: 'A. 单对象规则',
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
    label: 'B. 双对象规则',
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
        .filter(key => (PREDICATE_META[key]?.subjectMode || []).includes(subjectMode.value))
        .map(key => ({ key, label: RULE_TYPE_LABELS[key] }))
    }))
    .filter(group => group.predicates.length > 0)
})

const paramSpecs = computed(() => {
  if (!selectedPredicate.value) return []
  return PREDICATE_META[selectedPredicate.value]?.params ?? []
})

const currentRulePayload = computed(() => ({
  subjectMode: subjectMode.value,
  subjectsA: subjectsA.value.map(s => ({ ...s })),
  subjectsB: subjectMode.value === 'dual' ? subjectsB.value.map(s => ({ ...s })) : [],
  predicate: selectedPredicate.value,
  priority: selectedPriority.value,
  params: { ...paramValues.value },
  description: description.value
}))

const validationResult = computed(() => {
  if (!selectedPredicate.value) return { valid: false, warnings: [] }
  return validateRule(currentRulePayload.value)
})

const validationWarnings = computed(() => validationResult.value.warnings)
const canAdd = computed(() => !!selectedPredicate.value && validationResult.value.valid)

const previewText = computed(() => {
  if (!selectedPredicate.value) return ''
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

const addEntry = (slot) => {
  if (slot === 'A') subjectsA.value.push({ type: 'person', id: null })
  else subjectsB.value.push({ type: 'person', id: null })
}

const removeEntry = (slot, index) => {
  if (slot === 'A') {
    subjectsA.value.splice(index, 1)
    if (subjectsA.value.length === 0) subjectsA.value.push({ type: 'person', id: null })
  } else {
    subjectsB.value.splice(index, 1)
    if (subjectsB.value.length === 0) subjectsB.value.push({ type: 'person', id: null })
  }
}

const setSubjectMode = (mode) => {
  subjectMode.value = mode
  selectedPredicate.value = ''
  paramValues.value = {}
}

const onPredicateChange = () => {
  if (selectedPredicate.value) {
    paramValues.value = getDefaultParams(selectedPredicate.value)
  }
}

const handleAdd = () => {
  if (!canAdd.value) return
  const result = addRule(currentRulePayload.value)
  if (result.success) {
    emit('added', result.rule)
    resetForm()
  }
}

const resetForm = () => {
  subjectMode.value = 'single'
  selectedPredicate.value = ''
  selectedPriority.value = RulePriority.PREFER
  description.value = ''
  subjectsA.value = [{ type: 'person', id: null }]
  subjectsB.value = [{ type: 'person', id: null }]
  paramValues.value = {}
}

const applyQuickTemplate = (key) => {
  const quickTemplates = {
    [QUICK_TEMPLATE_KEYS.FRONT_ROW]: {
      mode: 'single',
      priority: RulePriority.REQUIRED,
      predicate: 'IN_ROW_RANGE',
      params: () => getDefaultParams('IN_ROW_RANGE')
    },
    [QUICK_TEMPLATE_KEYS.AVOID_WINDOW]: {
      mode: 'single',
      priority: RulePriority.PREFER,
      predicate: 'NOT_IN_COLUMN_TYPE',
      params: () => ({ ...getDefaultParams('NOT_IN_COLUMN_TYPE'), columnType: 'wall' })
    },
    [QUICK_TEMPLATE_KEYS.DESKMATES]: {
      mode: 'dual',
      priority: RulePriority.REQUIRED,
      predicate: 'MUST_BE_SEATMATES',
      params: () => getDefaultParams('MUST_BE_SEATMATES')
    },
    [QUICK_TEMPLATE_KEYS.SPREAD_GROUP]: {
      mode: 'single',
      priority: RulePriority.PREFER,
      predicate: 'DISTRIBUTE_EVENLY',
      params: () => ({ ...getDefaultParams('DISTRIBUTE_EVENLY'), scope: 'group' })
    }
  }

  const tpl = quickTemplates[key]
  if (!tpl) return
  setSubjectMode(tpl.mode)
  selectedPriority.value = tpl.priority
  selectedPredicate.value = tpl.predicate
  paramValues.value = tpl.params()
}
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
.chip-group { display: flex; gap: 8px; flex-wrap: wrap; }
.chip-item { border: 1px solid #dbe3ea; background: white; color: #334155; border-radius: 999px; font-size: 12px; padding: 6px 12px; cursor: pointer; }
.chip-item.active { background: #23587b; color: white; border-color: #23587b; }
.rule-selector-wrap { position: relative; }
.seg-select { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid #dbe3ea; }
.priority-pills { display: flex; gap: 8px; }
.priority-pill { border: 1px solid #dbe3ea; background: white; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
.priority-pill.active { border-color: #23587b; color: #23587b; }
.subject-section { border: 1px solid #eef2f6; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
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
