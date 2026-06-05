<template>
  <div class="rule-list">
    <!-- 过滤工具栏 -->
    <!-- 搜索与筛选工具栏 -->
    <div class="rule-toolbar">
      <div class="search-box">
        <Search :size="15" color="var(--color-text-disabled)" stroke-width="2.5" />
        <input v-model="searchQuery" type="text" placeholder="搜索规则、学生、备注..." />
        <button v-if="searchQuery" class="clear-search" @click="searchQuery = ''" aria-label="清空搜索">
          <X :size="12" />
        </button>
      </div>

      <div class="filter-row">
        <div class="filter-tabs">
          <button
            v-for="tab in priorityTabs"
            :key="tab.key"
            class="filter-tab"
            :class="{ active: filterPriority === tab.key }"
            @click="filterPriority = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="toolbar-actions">
          <button class="action-btn" @click="emit('export')" title="导出规则">
            <FileOutput :size="14" />
          </button>
          <button class="action-btn" @click="emit('import')" title="导入规则">
            <FileInput :size="14" />
          </button>
          <button v-if="rules.length > 0" class="action-btn danger" @click="handleClearAll" title="清空全部">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>

      <div v-if="filteredRules.length > 0" class="batch-toolbar">
        <label class="batch-select-all">
          <input
            type="checkbox"
            :checked="isAllFilteredSelected"
            @change="toggleSelectAllFiltered"
          />
          <span>全选当前筛选项</span>
        </label>
        <div class="batch-actions">
          <span class="batch-count">已选 {{ selectedRuleIds.length }} 条</span>
          <button class="batch-btn required" :disabled="!hasSelectedRules" @click="handleBatchSetPriority('required')">设为必须</button>
          <button class="batch-btn prefer" :disabled="!hasSelectedRules" @click="handleBatchSetPriority('prefer')">设为建议</button>
          <button class="batch-btn optional" :disabled="!hasSelectedRules" @click="handleBatchSetPriority('optional')">设为可选</button>
          <button class="batch-btn" :disabled="!hasSelectedRules" @click="handleBatchToggle(true)">启用</button>
          <button class="batch-btn" :disabled="!hasSelectedRules" @click="handleBatchToggle(false)">停用</button>
          <button class="batch-btn danger" :disabled="!hasSelectedRules" @click="handleBatchDelete">删除</button>
        </div>
      </div>
    </div>

    <!-- 冲突检查 -->
    <div class="conflict-banner" :class="{ idle: !hasScannedConflicts, clean: hasScannedConflicts && conflicts.length === 0 }">
      <AlertTriangle :size="16" />
      <template v-if="hasScannedConflicts && conflicts.length > 0">发现 {{ conflicts.length }} 条逻辑冲突规则</template>
      <template v-else-if="hasScannedConflicts">未发现逻辑冲突</template>
      <template v-else>正在检查逻辑冲突...</template>
      <button v-if="conflicts.length > 0" class="conflict-detail-btn" @click="showConflicts = !showConflicts">
        {{ showConflicts ? '收起' : '详情' }}
      </button>
    </div>
    <div v-if="showConflicts && conflicts.length > 0" class="conflict-list">
      <div v-for="(c, i) in conflicts" :key="i" class="conflict-item">
        <span class="conflict-type-badge" :class="c.type">{{ c.type === 'infeasible' ? '无法满足' : '逻辑矛盾' }}</span>
        {{ c.message }}
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="filteredRules.length === 0" class="empty-state">
      <ClipboardList :size="40" color="var(--color-border-strong)" stroke-width="1.5" />
      <p>{{ filterPriority === 'all' ? '暂无规则，请在上方添加' : '该优先级下没有规则' }}</p>
    </div>

    <!-- 规则列表 -->
    <div class="rules-container">
        <div
          v-for="rule in filteredRules"
          :key="rule.id"
          class="rule-item"
          :data-rule-id="rule.id"
        :class="{
          disabled: !rule.enabled,
          expanded: expandedId === rule.id,
          [rule.priority]: true
        }"
        >
          <!-- 主行 -->
          <div class="rule-main" @click="toggleExpand(rule.id)">
            <div class="rule-priority-bar" :style="{ background: PRIORITY_COLORS[rule.priority] }"></div>

            <div class="rule-select" @click.stop>
              <input
                type="checkbox"
                :checked="isSelected(rule.id)"
                @change="toggleSelectRule(rule.id)"
              />
            </div>

            <div class="rule-toggle">
            <label class="toggle-switch" @click.stop>
              <input type="checkbox" :checked="rule.enabled" @change="handleToggle(rule.id)" />
              <span class="toggle-knob"></span>
            </label>
          </div>

          <div class="rule-text">
            <span class="rule-label">{{ getRuleText(rule) }}</span>
          </div>

          <div class="rule-actions">
            <span class="rule-chevron" :class="{ open: expandedId === rule.id }">
              <ChevronDown :size="14" />
            </span>
          </div>
        </div>

        <!-- 展开区：参数详情 + 删除 -->
        <transition name="expand">
          <div v-if="expandedId === rule.id" class="rule-detail">
            <div class="rule-detail-grid">
              <div v-if="rule.description" class="detail-item full-width">
                <span class="detail-key">使用指南</span>
                <span class="detail-val guide-text">{{ rule.description }}</span>
              </div>
              <div class="detail-item full-width">
                <span class="detail-key">适用对象</span>
                <span class="detail-val">{{ formatSubjects(rule.subjects || []) }}</span>
              </div>
              <!-- NOT 取反标记 -->
              <div v-if="rule.not" class="detail-item">
                <span class="detail-key">取反</span>
                <span class="detail-val not-badge">是（结果取反）</span>
              </div>
              <!-- 逻辑操作符（多规则时显示） -->
              <div v-if="rule.subRules && rule.subRules.length > 1" class="detail-item full-width">
                <span class="detail-key">组合方式</span>
                <span class="detail-val logic-op-badge">{{ rule.logicOperator === 'OR' ? '或（OR）- 满足任一即可' : '与（AND）- 全部需满足' }}</span>
              </div>
              <!-- 子规则列表（多规则时显示） -->
              <template v-if="rule.subRules && rule.subRules.length > 1">
                <div v-for="(sr, idx) in rule.subRules" :key="`sr-${idx}`" class="detail-item full-width sub-rule-detail">
                  <span class="detail-key">条件 #{{ idx + 1 }}{{ sr.not ? ' [非]' : '' }}</span>
                  <span class="detail-val">{{ RULE_TYPE_LABELS[sr.predicate] || sr.predicate }} · {{ formatSubjects(sr.subjects || []) }}</span>
                </div>
              </template>
              <!-- 单条规则的类型 -->
              <div v-if="!rule.subRules || rule.subRules.length <= 1" class="detail-item">
                <span class="detail-key">规则类型</span>
                <span class="detail-val">{{ RULE_TYPE_LABELS[rule.predicate] }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-key">优先级</span>
                <span class="detail-val priority-chip" :class="rule.priority">{{ PRIORITY_LABELS[rule.priority] }}</span>
              </div>
              <div v-for="(val, key) in rule.params" :key="key" class="detail-item">
                <span class="detail-key">{{ getParamLabel(rule.predicate, key) }}</span>
                <span class="detail-val">{{ formatParamValue(rule.predicate, key, val) }}</span>
              </div>
            </div>
            <div class="detail-actions">
              <button
                class="btn-edit"
                @click="emit('edit', rule.id)"
              >
                编辑规则
              </button>
              <button
                class="btn-delete"
                :class="{ confirming: isDeletingRule(rule.id).value }"
                @click="handleDelete(rule)"
              >
                {{ isDeletingRule(rule.id).value ? '确认删除' : '删除规则' }}
              </button>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { Search, X, FileOutput, FileInput, Trash2, AlertTriangle, ClipboardList, ChevronDown } from 'lucide-vue-next'
import { useSeatRules } from '@/composables/useSeatRules'
import { useLogger } from '@/composables/useLogger'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import {
  PRIORITY_COLORS,
  PRIORITY_ICONS,
  PRIORITY_LABELS,
  RULE_TYPE_LABELS,
  PREDICATE_META,
  COLUMN_TYPE_LABELS,
  SCOPE_LABELS
} from '@/constants/ruleTypes.js'

const props = defineProps({
  focusRuleId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['export', 'import', 'edit'])

const { rules, renderRuleText, toggleRule, updateRule, deleteRule, clearAllRules, detectConflicts } = useSeatRules()
const { students } = useStudentData()
const { tags } = useTagData()
const { attributeDefinitions, getAttributeById } = useStudentAttributes()
const { requestConfirm, isConfirming } = useConfirmAction()
const { info, success } = useLogger()

const searchQuery = ref('')
const filterPriority = ref('all')
const expandedId = ref(null)
const showConflicts = ref(false)
const selectedRuleIds = ref([])
const selectedRuleIdSet = computed(() => new Set(selectedRuleIds.value))

const priorityTabs = [
  { key: 'all', label: '全部' },
  { key: 'required', label: '必须' },
  { key: 'prefer', label: '建议' },
  { key: 'optional', label: '可选' }
]

const conflicts = ref([])
const hasScannedConflicts = ref(false)
const ruleTextCache = new Map()
let autoConflictScanTimer = null

const filteredRules = computed(() => {
  let list = rules.value
  if (filterPriority.value !== 'all') {
    list = list.filter(r => r.priority === filterPriority.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(r => {
      const text = getRuleText(r).toLowerCase()
      const desc = (r.description || '').toLowerCase()
      return text.includes(q) || desc.includes(q)
    })
  }
  return list
})

const filteredRuleIds = computed(() => filteredRules.value.map(r => r.id))
const isAllFilteredSelected = computed(() => {
  if (filteredRuleIds.value.length === 0) return false
  return filteredRuleIds.value.every(id => selectedRuleIdSet.value.has(id))
})
const hasSelectedRules = computed(() => selectedRuleIds.value.length > 0)

const studentNameMap = computed(() => {
  const map = new Map()
  for (const student of students.value) {
    map.set(student.id, student.name || `学生#${student.id}`)
  }
  return map
})

const tagNameMap = computed(() => {
  const map = new Map()
  for (const tag of tags.value) {
    map.set(tag.id, tag.name || `标签#${tag.id}`)
  }
  return map
})

const ruleTextDataVersion = computed(() => {
  const studentVersion = students.value.map(s => `${s.id}:${s.name || ''}`).join('|')
  const tagVersion = tags.value.map(t => `${t.id}:${t.name || ''}`).join('|')
  const attributeVersion = attributeDefinitions.value
    .map(attr => `${attr.id}:${attr.name || ''}:${attr.unit || ''}`)
    .join('|')
  return `${studentVersion}::${tagVersion}::${attributeVersion}`
})

const conflictScanVersion = computed(() => {
  const ruleVersion = JSON.stringify(rules.value.map(rule => ({
    id: rule.id,
    enabled: rule.enabled,
    priority: rule.priority,
    predicate: rule.predicate,
    params: rule.params,
    subjects: rule.subjects,
    not: rule.not,
    logicOperator: rule.logicOperator,
    subRules: rule.subRules
  })))
  const studentVersion = students.value
    .map(student => `${student.id}:${(student.tags || []).join(',')}`)
    .join('|')
  const tagVersion = tags.value.map(tag => tag.id).join('|')
  return `${ruleVersion}::${studentVersion}::${tagVersion}`
})

const isSelected = (ruleId) => selectedRuleIdSet.value.has(ruleId)

const toggleSelectRule = (ruleId) => {
  if (selectedRuleIds.value.includes(ruleId)) {
    selectedRuleIds.value = selectedRuleIds.value.filter(id => id !== ruleId)
  } else {
    selectedRuleIds.value = [...selectedRuleIds.value, ruleId]
  }
}

const toggleSelectAllFiltered = () => {
  if (isAllFilteredSelected.value) {
    selectedRuleIds.value = selectedRuleIds.value.filter(id => !filteredRuleIds.value.includes(id))
    return
  }
  const merged = new Set([...selectedRuleIds.value, ...filteredRuleIds.value])
  selectedRuleIds.value = [...merged]
}

const toggleExpand = (id) => {
  expandedId.value = expandedId.value === id ? null : id
}

const handleToggle = (ruleId) => {
  toggleRule(ruleId)
  hasScannedConflicts.value = false
}

const clearInvalidSelections = () => {
  const idSet = new Set(rules.value.map(r => r.id))
  selectedRuleIds.value = selectedRuleIds.value.filter(id => idSet.has(id))
  for (const id of ruleTextCache.keys()) {
    if (!idSet.has(id)) ruleTextCache.delete(id)
  }
}

const handleBatchSetPriority = (priority) => {
  const count = selectedRuleIds.value.length
  selectedRuleIds.value.forEach(ruleId => {
    updateRule(ruleId, { priority })
  })
  success(`已将 ${count} 条规则设为${PRIORITY_LABELS[priority]}`)
  hasScannedConflicts.value = false
}

const handleBatchToggle = (enabled) => {
  const count = selectedRuleIds.value.length
  selectedRuleIds.value.forEach(ruleId => {
    updateRule(ruleId, { enabled })
  })
  success(`已${enabled ? '启用' : '停用'} ${count} 条规则`)
  hasScannedConflicts.value = false
}

const handleBatchDelete = () => {
  const count = selectedRuleIds.value.length
  if (count === 0) return
  if (!confirm(`确定删除已选 ${count} 条规则？此操作不可撤销。`)) return
  selectedRuleIds.value.forEach(ruleId => deleteRule(ruleId))
  selectedRuleIds.value = []
  if (expandedId.value && !rules.value.find(r => r.id === expandedId.value)) {
    expandedId.value = null
  }
  success(`已成功删除 ${count} 条规则`)
  hasScannedConflicts.value = false
}

const getDeletingKey = (id) => `deleteRule-${id}`
const isDeletingRule = (id) => isConfirming(getDeletingKey(id))

const handleDelete = (rule) => {
  if (!isDeletingRule(rule.id).value) {
    info(`请再次点击以确认删除此规则`)
  }
  requestConfirm(
    getDeletingKey(rule.id),
    () => {
      deleteRule(rule.id)
      success(`成功删除规则`)
      if (expandedId.value === rule.id) expandedId.value = null
    },
    `确定删除此规则？`
  )
}

const handleClearAll = () => {
  if (confirm(`确定清空全部 ${rules.value.length} 条规则？此操作不可撤销。`)) {
    const count = rules.value.length
    clearAllRules()
    expandedId.value = null
    selectedRuleIds.value = []
    success(`已成功清空 ${count} 条规则`)
    conflicts.value = []
    hasScannedConflicts.value = false
  }
}

const runConflictScan = () => {
  conflicts.value = detectConflicts()
  hasScannedConflicts.value = true
  if (conflicts.value.length === 0) {
    showConflicts.value = false
  }
}

const clearAutoConflictScanTimer = () => {
  if (autoConflictScanTimer) {
    window.clearTimeout(autoConflictScanTimer)
    autoConflictScanTimer = null
  }
}

const scheduleAutoConflictScan = () => {
  clearAutoConflictScanTimer()
  autoConflictScanTimer = window.setTimeout(() => {
    autoConflictScanTimer = null
    runConflictScan()
  }, 120)
}

const getRuleSignature = (rule) => {
  return `${rule.id}:${rule.updatedAt || rule.createdAt || 0}`
}

const getRuleText = (rule) => {
  const signature = getRuleSignature(rule)
  const cached = ruleTextCache.get(rule.id)
  if (cached?.signature === signature) return cached.text
  const text = renderRuleText(rule)
  ruleTextCache.set(rule.id, { signature, text })
  return text
}

const getParamLabel = (predicate, key) => {
  const meta = PREDICATE_META[predicate]
  const param = meta?.params?.find(p => p.key === key)
  return param?.label ?? key
}

const formatParamValue = (predicate, key, value) => {
  if (key === 'columnType') return COLUMN_TYPE_LABELS[value] ?? value
  if (key === 'scope') return SCOPE_LABELS[value] ?? value
  if (key === 'tolerance') return value === 0 ? '仅正后方' : '正后方±1列'
  if (key === 'attributeId') {
    const attribute = getAttributeById(value)
    return attribute ? (attribute.unit ? `${attribute.name}（${attribute.unit}）` : attribute.name) : String(value)
  }
  if (key === 'direction') return value === 'highFront' ? '高值靠前' : '低值靠前'
  if (key === 'aggregate') return value === 'sum' ? '合计值' : '平均值'
  return String(value)
}

const formatSubjects = (subjects) => {
  if (!subjects?.length) return '-'
  return subjects.map(s => {
    if (s.type === 'person') {
      return studentNameMap.value.get(s.id) || `学生#${s.id}`
    }
    if (s.type === 'tag') {
      return tagNameMap.value.get(s.id) || `标签#${s.id}`
    }
    if (s.type === 'all') return '全体学生'
    return '-'
  }).join('、')
}

const focusRule = async (ruleId) => {
  if (!ruleId) return false
  const target = rules.value.find(r => r.id === ruleId)
  if (!target) return false

  if (filterPriority.value !== 'all' && target.priority !== filterPriority.value) {
    filterPriority.value = 'all'
  }
  if (searchQuery.value.trim()) {
    searchQuery.value = ''
  }
  expandedId.value = ruleId

  await nextTick()
  const node = document.querySelector(`.rule-item[data-rule-id="${ruleId}"]`)
  node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return true
}

watch(() => props.focusRuleId, (id) => {
  if (id) {
    focusRule(id)
  }
})

watch(
  () => rules.value.map(r => r.id).join('|'),
  clearInvalidSelections
)

watch(ruleTextDataVersion, () => {
  ruleTextCache.clear()
})

watch(conflictScanVersion, () => {
  scheduleAutoConflictScan()
}, { immediate: true })

onBeforeUnmount(() => {
  clearAutoConflictScanTimer()
})

defineExpose({ focusRule })
</script>

<style scoped>
.rule-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ==================== 顶部工具栏 ==================== */
.rule-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 8px;
  background: var(--color-bg-secondary);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--color-border-light);
}

.batch-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px 10px;
}

.batch-select-all {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-primary);
  user-select: none;
}

.batch-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.batch-count {
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 600;
  margin-right: 2px;
}

.batch-btn {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-primary);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 8px;
  cursor: pointer;
}

.batch-btn:hover {
  border-color: var(--color-text-disabled);
}

.batch-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.batch-btn.required {
  color: var(--color-danger);
  border-color: var(--color-danger-text);
  background: var(--color-danger-bg);
}

.batch-btn.prefer {
  color: var(--color-warning);
  border-color: var(--color-warning-text);
  background: var(--color-warning-bg);
}

.batch-btn.optional {
  color: var(--color-text-secondary);
  border-color: var(--color-border);
  background: var(--color-bg-secondary);
}

.batch-btn.danger {
  color: var(--color-danger);
  border-color: var(--color-danger-text);
  background: var(--color-danger-bg);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-box svg {
  position: absolute;
  left: 12px;
}

.search-box input {
  width: 100%;
  padding: 10px 36px;
  background: var(--color-input-bg);
  border: 1.5px solid var(--color-border);
  border-radius: 10px;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}

.search-box input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.clear-search {
  position: absolute;
  right: 8px;
  width: 20px;
  height: 20px;
  padding: 0;
  line-height: 0;
  border: none;
  background: var(--color-border);
  color: var(--color-text-muted);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.clear-search svg {
  display: block;
  flex-shrink: 0;
}

.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.filter-tabs {
  display: flex;
  background: var(--color-bg-subtle);
  padding: 3px;
  border-radius: 10px;
  gap: 2px;
}

.filter-tab {
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab:hover { color: var(--color-text-primary); }
.filter-tab.active {
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
}

.toolbar-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--color-bg-subtle);
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

.action-btn.danger:hover {
  border-color: var(--color-danger-text);
  color: var(--color-danger-text);
  background: var(--color-danger-bg);
}

/* ==================== 冲突警告 ==================== */
.conflict-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-warning-bg-light);
  border: 1px solid var(--color-warning-light);
  border-radius: 8px;
  font-size: 13px;
  color: var(--color-warning-hover);
}

.conflict-banner.idle {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.conflict-banner.clean {
  background: var(--color-success-bg);
  border-color: var(--color-success);
  color: var(--color-success);
}

.conflict-detail-btn {
  background: none;
  border: none;
  font-size: 12px;
  color: currentColor;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.conflict-detail-btn:first-of-type {
  margin-left: auto;
}

.conflict-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--color-warning-bg-light);
  border-radius: 8px;
  border: 1px solid var(--color-warning-light);
}

.conflict-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--color-danger-hover);
  padding: 4px 6px;
}

.conflict-type-badge {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
  margin-top: 1px;
}

.conflict-type-badge.contradiction { background: var(--color-danger-bg); color: var(--color-danger); }
.conflict-type-badge.infeasible { background: var(--color-warning-bg); color: var(--color-warning); }

/* ==================== 空状态 ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 0;
  color: var(--color-text-muted); /* Darkened for readability */
}

.empty-state p { margin: 0; font-size: 13px; }

/* ==================== 规则列表 ==================== */
.rules-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rule-item {
  border-radius: 12px;
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  overflow: hidden;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.rule-item:hover { 
  border-color: var(--color-border-strong);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05); 
  transform: translateY(-1px);
}

.rule-item.disabled { opacity: 0.5; filter: grayscale(0.5); }

.rule-item.required { border-left: 4px solid var(--color-danger); }
.rule-item.prefer { border-left: 4px solid var(--color-warning); }
.rule-item.optional { border-left: 4px solid var(--color-text-disabled); }

.rule-item.expanded {
  border-color: var(--color-primary);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-primary) 12%, transparent);
  transform: translateY(-2px);
}

.rule-main {
  display: flex;
  align-items: center;
  padding: 10px 12px 10px 0;
  cursor: pointer;
  gap: 8px;
  user-select: none;
}

.rule-select {
  display: flex;
  align-items: center;
  padding-left: 10px;
}

.rule-priority-bar {
  width: 0;
  align-self: stretch;
  flex-shrink: 0;
}

/* 开关 */
.rule-toggle {
  flex-shrink: 0;
  padding-left: 12px;
  display: flex;
  align-items: center;
}

.toggle-switch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 34px;
  height: 20px;
  cursor: pointer;
  vertical-align: middle;
}

.toggle-switch input { display: none; }

.toggle-knob {
  position: absolute;
  inset: 0;
  background: var(--color-border-strong);
  border-radius: 20px;
  transition: background 0.2s;
}

.toggle-knob::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: var(--color-surface);
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.toggle-switch input:checked ~ .toggle-knob { background: var(--color-success); }
.toggle-switch input:checked ~ .toggle-knob::after { transform: translateX(14px); }

.rule-text {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}


.rule-label {
  font-size: 13px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rule-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.rule-chevron {
  color: var(--color-text-disabled);
  transition: transform 0.2s;
  display: flex;
}
.rule-chevron.open { transform: rotate(180deg); }

/* ==================== 展开区 ==================== */
.rule-detail {
  border-top: 1px solid var(--color-bg-subtle);
  padding: 12px 16px;
  background: var(--color-bg-subtle);
}

.rule-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.detail-item.full-width { grid-column: 1 / -1; }

.detail-key {
  display: block;
  font-size: 10px;
  color: var(--color-text-muted); /* Darkened for readability */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.detail-val {
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.priority-chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.priority-chip.required { background: var(--color-danger-bg); color: var(--color-danger); }
.priority-chip.prefer { background: var(--color-warning-bg); color: var(--color-warning-hover); }
.priority-chip.optional { background: var(--color-bg-subtle); color: var(--color-text-secondary); }

.guide-text {
  color: var(--color-primary);
  font-style: italic;
  line-height: 1.5;
}

.not-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
}

.logic-op-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: var(--color-info-bg);
  color: var(--color-info);
}

.sub-rule-detail {
  background: var(--color-bg-subtle);
  border-left: 3px solid var(--color-border-strong);
  border-radius: 0 6px 6px 0;
  padding-left: 10px;
} /* Darkened for readability */

.detail-actions { display: flex; justify-content: flex-end; }

.btn-edit {
  padding: 5px 14px;
  border: 1.5px solid var(--color-info-text);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-info);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 8px;
}

.btn-edit:hover { background: var(--color-info-bg); }

.btn-delete {
  padding: 5px 14px;
  border: 1.5px solid var(--color-danger-text);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-danger);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete:hover { background: var(--color-danger-bg); }

.btn-delete.confirming {
  background: var(--color-danger);
  color: var(--color-text-inverse);
  border-color: var(--color-danger);
}

/* ==================== 动画 ==================== */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 400px;
  opacity: 1;
}
</style>
