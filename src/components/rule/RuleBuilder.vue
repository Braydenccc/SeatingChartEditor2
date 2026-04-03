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

    <!-- 句子式构建器 -->
    <!-- 句子式构建器 -->
    <div class="sentence-builder">
      <!-- Step 1: 主体类型 -->
      <div class="builder-segment">
        <label class="seg-label">针对对象</label>
        <div class="chip-group">
          <button 
            v-for="kind in subjectKinds" 
            :key="kind.key"
            class="chip-item"
            :class="{ active: subjectKind === kind.key }"
            @click="setSubjectKind(kind.key)"
          >
            {{ kind.label }}
          </button>
        </div>
      </div>

      <!-- Step 2: 谓词（规则类型）-->
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

      <!-- Step 3: 优先级 -->
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

    <!-- 主体详细选择 -->
    <div class="subject-section" v-if="selectedPredicate">
      <div class="subject-inputs">
        <!-- 单个学生 -->
        <template v-if="subjectKind === 'student'">
          <div class="input-group">
            <label>学生</label>
            <select v-model="subjectStudentId" class="detail-select">
              <option :value="null">选择学生…</option>
              <option v-for="s in students" :key="s.id" :value="s.id">
                {{ s.studentNumber || '-' }} {{ s.name || '未命名' }}
              </option>
            </select>
          </div>
        </template>

        <!-- 学生对 -->
        <template v-if="subjectKind === 'pair'">
          <div class="input-group">
            <label>学生 A</label>
            <select v-model="subjectId1" class="detail-select">
              <option :value="null">选择学生…</option>
              <option v-for="s in students" :key="s.id" :value="s.id" :disabled="s.id === subjectId2">
                {{ s.studentNumber || '-' }} {{ s.name || '未命名' }}
              </option>
            </select>
          </div>
          <div class="pair-arrow">→</div>
          <div class="input-group">
            <label>学生 B</label>
            <select v-model="subjectId2" class="detail-select">
              <option :value="null">选择学生…</option>
              <option v-for="s in students" :key="s.id" :value="s.id" :disabled="s.id === subjectId1">
                {{ s.studentNumber || '-' }} {{ s.name || '未命名' }}
              </option>
            </select>
          </div>
        </template>

        <!-- 标签 -->
        <template v-if="subjectKind === 'tag'">
          <div class="input-group">
            <label>标签</label>
            <select v-model="subjectTagId" class="detail-select">
              <option :value="null">选择标签…</option>
              <option v-for="t in tags" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
        </template>

        <!-- 标签对 -->
        <template v-if="subjectKind === 'tag_pair'">
          <div class="input-group">
            <label>标签 A</label>
            <select v-model="subjectTagId1" class="detail-select">
              <option :value="null">选择标签…</option>
              <option v-for="t in tags" :key="t.id" :value="t.id" :disabled="t.id === subjectTagId2">{{ t.name }}</option>
            </select>
          </div>
          <div class="pair-arrow">×</div>
          <div class="input-group">
            <label>标签 B</label>
            <select v-model="subjectTagId2" class="detail-select">
              <option :value="null">选择标签…</option>
              <option v-for="t in tags" :key="t.id" :value="t.id" :disabled="t.id === subjectTagId1">{{ t.name }}</option>
            </select>
          </div>
        </template>
      </div>

      <!-- 谓词参数 -->
      <div v-if="paramSpecs.length > 0" class="params-section">
        <template v-for="param in paramSpecs" :key="param.key">
          <div class="input-group">
            <label>{{ param.label }}</label>
            <!-- 数字输入 -->
            <input
              v-if="param.type === 'number'"
              v-model.number="paramValues[param.key]"
              type="number"
              :min="param.min ?? 1"
              class="detail-input"
            />
            <!-- 下拉选择 -->
            <select
              v-else-if="param.type === 'select'"
              v-model="paramValues[param.key]"
              class="detail-select"
            >
              <option v-for="opt in param.options" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <!-- 选区选择 -->
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

      <!-- 备注（可选） -->
      <div class="input-group">
        <label>备注（选填）</label>
        <input v-model="description" type="text" class="detail-input" placeholder="为这条规则添加说明…" />
      </div>
    </div>

    <!-- 预览文本 -->
    <!-- 智能预览卡片 -->
    <div v-if="previewText" class="builder-preview-section">
      <label class="seg-label">效果预览</label>
      <div class="smart-preview-card" :class="selectedPriority">
        <div class="preview-main">
          <div class="preview-text-content">{{ previewText }}</div>
        </div>
      </div>
    </div>

    <!-- 验证警告 -->
    <div v-if="validationWarnings.length > 0" class="validation-warnings">
      <div v-for="(w, i) in validationWarnings" :key="i" class="warning-item">
        ⚠️ {{ w }}
      </div>
    </div>

    <!-- 添加按钮 -->
    <div class="builder-footer">
      <button class="btn-add" :disabled="!canAdd" @click="handleAdd">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        添加规则
      </button>
      <button class="btn-reset" @click="resetForm">重置</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useZoneData } from '@/composables/useZoneData'
import { useSeatRules } from '@/composables/useSeatRules'
import {
  RulePriority,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  PRIORITY_ICONS,
  PREDICATE_META,
  RULE_TYPE_LABELS,
  getDefaultParams,
  SubjectKind
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

// ==================== 表单状态 ====================
const subjectKind = ref('student')
const selectedPredicate = ref('')
const selectedPriority = ref(RulePriority.PREFER)
const description = ref('')

// 主体字段
const subjectStudentId = ref(null)
const subjectId1 = ref(null)
const subjectId2 = ref(null)
const subjectTagId = ref(null)
const subjectTagId1 = ref(null)
const subjectTagId2 = ref(null)

// 谓词参数
const paramValues = ref({})

const subjectKinds = [
  { key: 'student', label: '单个学生' },
  { key: 'pair', label: '学生搭档' },
  { key: 'tag', label: '标签分组' },
  { key: 'tag_pair', label: '标签对比' }
]

const priorities = [
  { key: 'required', label: '强制必须', color: '#ef4444', icon: '🔴' },
  { key: 'prefer', label: '建议尽量', color: '#f59e0b', icon: '🟡' },
  { key: 'optional', label: '可选参考', color: '#94a3b8', icon: '⚪' }
]

const setSubjectKind = (kind) => {
  subjectKind.value = kind
  onSubjectKindChange()
}

// ==================== 谓词分组 ====================
const predicateGroups = [
  {
    label: 'A. 单人位置规则',
    predicates: [
      { key: 'IN_ROW_RANGE', kinds: ['student', 'tag'] },
      { key: 'NOT_IN_COLUMN_TYPE', kinds: ['student', 'tag'] },
      { key: 'IN_ZONE', kinds: ['student', 'tag'] },
      { key: 'NOT_IN_ZONE', kinds: ['student', 'tag'] },
      { key: 'IN_GROUP_RANGE', kinds: ['student', 'tag'] }
    ]
  },
  {
    label: 'B. 对关系规则',
    predicates: [
      { key: 'MUST_BE_SEATMATES', kinds: ['pair', 'tag_pair'] },
      { key: 'MUST_NOT_BE_SEATMATES', kinds: ['pair', 'tag_pair'] },
      { key: 'DISTANCE_AT_MOST', kinds: ['pair', 'tag_pair'] },
      { key: 'DISTANCE_AT_LEAST', kinds: ['pair', 'tag_pair'] },
      { key: 'NOT_BLOCK_VIEW', kinds: ['pair'] },
      { key: 'MUST_BE_SAME_GROUP', kinds: ['pair', 'tag_pair'] },
      { key: 'MUST_NOT_BE_SAME_GROUP', kinds: ['pair', 'tag_pair'] },
      { key: 'MUST_BE_ADJACENT_ROW', kinds: ['pair', 'tag_pair'] }
    ]
  },
  {
    label: 'C. 分组分散规则',
    predicates: [
      { key: 'DISTRIBUTE_EVENLY', kinds: ['tag'] },
      { key: 'CLUSTER_TOGETHER', kinds: ['tag'] }
    ]
  }
]

const filteredPredicateGroups = computed(() => {
  return predicateGroups
    .map(group => ({
      ...group,
      predicates: group.predicates
        .filter(p => p.kinds.includes(subjectKind.value))
        .map(p => ({ ...p, label: RULE_TYPE_LABELS[p.key] }))
    }))
    .filter(group => group.predicates.length > 0)
})

// ==================== 参数规格 ====================
const paramSpecs = computed(() => {
  if (!selectedPredicate.value) return []
  return PREDICATE_META[selectedPredicate.value]?.params ?? []
})

// ==================== 主体对象 ====================
const currentSubject = computed(() => {
  if (subjectKind.value === 'student') {
    return { kind: 'student', id: subjectStudentId.value }
  }
  if (subjectKind.value === 'pair') {
    return { kind: 'pair', id1: subjectId1.value, id2: subjectId2.value }
  }
  if (subjectKind.value === 'tag') {
    return { kind: 'tag', tagId: subjectTagId.value }
  }
  if (subjectKind.value === 'tag_pair') {
    return { kind: 'tag_pair', tagId1: subjectTagId1.value, tagId2: subjectTagId2.value }
  }
  return null
})

// ==================== 验证 ====================
const validationResult = computed(() => {
  if (!selectedPredicate.value || !currentSubject.value) return { valid: false, warnings: [] }
  return validateRule({
    predicate: selectedPredicate.value,
    subject: currentSubject.value,
    priority: selectedPriority.value,
    params: paramValues.value
  })
})

const validationWarnings = computed(() => validationResult.value.warnings)
const canAdd = computed(() => {
  if (!selectedPredicate.value) return false
  return validationResult.value.valid
})

// ==================== 预览文本 ====================
const previewText = computed(() => {
  if (!selectedPredicate.value || !currentSubject.value) return ''
  try {
    const tempRule = {
      id: 'preview',
      priority: selectedPriority.value,
      subject: currentSubject.value,
      predicate: selectedPredicate.value,
      params: paramValues.value
    }
    return renderRuleText(tempRule)
  } catch {
    return ''
  }
})

// ==================== 事件处理 ====================
const onSubjectKindChange = () => {
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

  const result = addRule({
    priority: selectedPriority.value,
    subject: currentSubject.value,
    predicate: selectedPredicate.value,
    params: { ...paramValues.value },
    description: description.value
  })

  if (result.success) {
    emit('added', result.rule)
    resetForm()
  }
}

const resetForm = () => {
  subjectKind.value = 'student'
  selectedPredicate.value = ''
  selectedPriority.value = RulePriority.PREFER
  description.value = ''
  subjectStudentId.value = null
  subjectId1.value = null
  subjectId2.value = null
  subjectTagId.value = null
  subjectTagId1.value = null
  subjectTagId2.value = null
  paramValues.value = {}
}

const applyQuickTemplate = (key) => {
  if (key === 'front-row') {
    setSubjectKind('student')
    selectedPriority.value = RulePriority.REQUIRED
    selectedPredicate.value = 'IN_ROW_RANGE'
    paramValues.value = getDefaultParams('IN_ROW_RANGE')
    return
  }
  if (key === 'avoid-window') {
    setSubjectKind('student')
    selectedPriority.value = RulePriority.PREFER
    selectedPredicate.value = 'NOT_IN_COLUMN_TYPE'
    paramValues.value = { ...getDefaultParams('NOT_IN_COLUMN_TYPE'), columnType: 'window' }
    return
  }
  if (key === 'deskmates') {
    setSubjectKind('pair')
    selectedPriority.value = RulePriority.REQUIRED
    selectedPredicate.value = 'MUST_BE_SEATMATES'
    paramValues.value = getDefaultParams('MUST_BE_SEATMATES')
    return
  }
  if (key === 'spread-group') {
    setSubjectKind('tag')
    selectedPriority.value = RulePriority.PREFER
    selectedPredicate.value = 'DISTRIBUTE_EVENLY'
    paramValues.value = { ...getDefaultParams('DISTRIBUTE_EVENLY'), scope: 'group' }
  }
}
</script>

<style scoped>
.rule-builder {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.builder-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #23587b;
}

.quick-template-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.quick-template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.quick-template-btn {
  border: 1px solid #dbe3ea;
  background: white;
  color: #334155;
  border-radius: 8px;
  padding: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.quick-template-btn:hover {
  border-color: #23587b;
  color: #23587b;
}

.quick-template-tip {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

/* ==================== 句子构建器 ==================== */
.sentence-builder {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  border: 1px solid #eef2f6;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
}

.builder-segment {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.seg-label {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chip-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chip-item {
  padding: 8px 14px;
  background: #f1f5f9;
  border: 1px solid transparent;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: #475569; /* Darkened for readability */
  cursor: pointer;
  transition: all 0.2s;
}

.chip-item:hover { background: #e2e8f0; color: #1e293b; }
.chip-item.active {
  background: var(--color-primary);
  color: white;
  box-shadow: 0 2px 8px rgba(35, 88, 123, 0.25);
}

.rule-selector-wrap {
  position: relative;
}

.seg-select {
  width: 100%;
  padding: 10px 14px;
  background: #fff;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 13px;
  color: #1e293b;
  outline: none;
  cursor: pointer;
  appearance: none;
  transition: all 0.2s;
}

.seg-select:focus { border-color: var(--color-primary); background: #f8fafc; }

.priority-pills {
  display: flex;
  gap: 8px;
}

.priority-pill {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #475569; /* Darkened for readability */
  cursor: pointer;
  transition: all 0.2s;
}

.pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5e1;
}

.priority-pill.active.required { border-color: #ef4444; background: #fff1f2; color: #ef4444; }
.priority-pill.active.required .pill-dot { background: #ef4444; }

.priority-pill.active.prefer { border-color: #f59e0b; background: #fffbeb; color: #b45309; }
.priority-pill.active.prefer .pill-dot { background: #f59e0b; }

.priority-pill.active.optional { border-color: #64748b; background: #f1f5f9; color: #1e293b; }
.priority-pill.active.optional .pill-dot { background: #64748b; }

/* ==================== 主体选择区 ==================== */
.subject-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1.5px solid #e2e8f0;
}

.subject-inputs {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.params-section {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
  flex: 1;
}

.input-group label {
  font-size: 11px;
  color: #475569; /* Darkened for readability */
  font-weight: 500;
}

.detail-select,
.detail-input {
  padding: 7px 10px;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  font-size: 13px;
  color: #334155;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.detail-select:focus,
.detail-input:focus { border-color: #23587b; }

.pair-arrow {
  font-size: 18px;
  font-weight: 700;
  color: #64748b; /* Darkened for readability */
  padding-bottom: 8px;
  flex-shrink: 0;
}

/* ==================== 预览文本 ==================== */
.builder-preview-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.smart-preview-card {
  padding: 12px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.smart-preview-card.required { border-left: 4px solid #ef4444; }
.smart-preview-card.prefer { border-left: 4px solid #f59e0b; }
.smart-preview-card.optional { border-left: 4px solid #cbd5e1; } /* Lighter border, but better context */

.preview-main {
  display: flex;
  align-items: center;
  gap: 10px;
}



.preview-text-content {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

/* ==================== 警告 ==================== */
.validation-warnings {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.warning-item {
  font-size: 12px;
  color: #92400e;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  padding: 6px 10px;
}

/* ==================== 底部按钮 ==================== */
.builder-footer {
  display: flex;
  gap: 8px;
}

.btn-add {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 18px;
  background: #23587b;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add:hover:not(:disabled) { background: #1a4260; transform: translateY(-1px); }
.btn-add:disabled { background: #e2e8f0; color: #64748b; cursor: not-allowed; transform: none; }

.btn-reset {
  padding: 10px 16px;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  font-size: 13px;
  color: #475569; /* Darkened for readability */
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover { border-color: #94a3b8; color: #334155; }
</style>
