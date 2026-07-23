<template>
  <div class="rule-list">
    <!-- 过滤工具栏 -->
    <!-- 搜索与筛选工具栏 -->
    <div class="rule-toolbar">
      <div class="search-box">
        <NInput v-model:value="searchQuery" size="small" placeholder="搜索规则、学生、备注..." aria-label="搜索规则" clearable>
          <template #prefix><Search :size="15" stroke-width="2.5" /></template>
        </NInput>
      </div>

      <div class="filter-row">
        <div class="filter-tabs">
          <NButton
            v-for="tab in priorityTabs"
            :key="tab.key"
            class="filter-tab"
            :class="{ active: filterPriority === tab.key }"
            size="small"
            :secondary="filterPriority === tab.key"
            :type="filterPriority === tab.key ? 'primary' : 'default'"
            @click="filterPriority = tab.key"
          >
            {{ tab.label }}
          </NButton>
        </div>
        <div class="toolbar-actions">
          <NButton size="small" quaternary circle aria-label="导出规则" @click="emit('export')" title="导出规则">
            <FileOutput :size="14" />
          </NButton>
          <NButton size="small" quaternary circle aria-label="导入规则" @click="emit('import')" title="导入规则">
            <FileInput :size="14" />
          </NButton>
          <NButton
            v-if="rules.length > 0"
            size="small"
            quaternary
            circle
            type="error"
            aria-label="清空全部规则"
            @click="handleClearAll"
            title="清空全部"
          >
            <Trash2 :size="14" />
          </NButton>
        </div>
      </div>

      <div v-if="filteredRules.length > 0" class="batch-toolbar">
        <label class="batch-select-all">
          <NCheckbox
            :checked="isAllFilteredSelected"
            @update:checked="toggleSelectAllFiltered"
          />
          <span>全选当前筛选项</span>
        </label>
        <div class="batch-actions">
          <span class="batch-count">已选 {{ selectedRuleIds.length }} 条</span>
          <NButton size="tiny" type="error" secondary :disabled="!hasSelectedRules" @click="handleBatchSetPriority('required')">设为必须</NButton>
          <NButton size="tiny" type="warning" secondary :disabled="!hasSelectedRules" @click="handleBatchSetPriority('prefer')">设为建议</NButton>
          <NButton size="tiny" :disabled="!hasSelectedRules" @click="handleBatchSetPriority('optional')">设为可选</NButton>
          <NButton size="tiny" :disabled="!hasSelectedRules" @click="handleBatchToggle(true)">启用</NButton>
          <NButton size="tiny" :disabled="!hasSelectedRules" @click="handleBatchToggle(false)">停用</NButton>
          <NButton
            size="tiny"
            type="error"
            :disabled="!hasSelectedRules"
            @click="handleBatchDelete"
          >
            删除
          </NButton>
        </div>
      </div>
    </div>

    <!-- 冲突检查 -->
    <div class="conflict-banner" :class="{ idle: !hasScannedConflicts, clean: hasScannedConflicts && conflicts.length === 0 }">
      <AlertTriangle :size="16" />
      <template v-if="hasScannedConflicts && conflicts.length > 0">发现 {{ conflicts.length }} 条逻辑冲突规则</template>
      <template v-else-if="hasScannedConflicts">未发现逻辑冲突</template>
      <template v-else>正在检查逻辑冲突...</template>
      <NButton
        v-if="conflicts.length > 0"
        class="conflict-detail-action"
        size="tiny"
        text
        :aria-expanded="showConflicts"
        aria-controls="rule-conflict-details"
        @click="showConflicts = !showConflicts"
      >
        {{ showConflicts ? '收起' : '详情' }}
      </NButton>
    </div>
    <div id="rule-conflict-details" v-if="showConflicts && conflicts.length > 0" class="conflict-list">
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
          <div class="rule-main">
            <div class="rule-priority-bar" :style="{ background: PRIORITY_COLORS[rule.priority] }"></div>

            <div class="rule-select" @click.stop>
              <NCheckbox
                :checked="isSelected(rule.id)"
                :aria-label="`选择规则：${getRuleText(rule)}`"
                @update:checked="toggleSelectRule(rule.id)"
              />
            </div>

            <div class="rule-toggle">
            <NSwitch
              size="small"
              :value="rule.enabled"
              :aria-label="`${rule.enabled ? '停用' : '启用'}规则：${getRuleText(rule)}`"
              @update:value="handleToggle(rule.id)"
            />
          </div>

          <div class="rule-text">
            <span class="rule-label">{{ getRuleText(rule) }}</span>
          </div>

          <div class="rule-actions">
            <NButton size="tiny" quaternary title="编辑规则" @click.stop="emit('edit', rule.id)">
              <template #icon><Pencil :size="14" stroke-width="2" /></template>
              <span>编辑</span>
            </NButton>
            <NButton
              class="rule-expand-button"
              size="tiny"
              quaternary
              circle
              :aria-label="`${expandedId === rule.id ? '收起' : '展开'}规则详情：${getRuleText(rule)}`"
              :aria-expanded="expandedId === rule.id"
              :aria-controls="getRuleDetailId(rule.id)"
              @click="toggleExpand(rule.id)"
            >
              <ChevronDown class="rule-chevron" :class="{ open: expandedId === rule.id }" :size="14" />
            </NButton>
          </div>
        </div>

        <!-- 展开区：参数详情 + 删除 -->
        <transition name="expand">
          <div v-if="expandedId === rule.id" :id="getRuleDetailId(rule.id)" class="rule-detail">
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
                  <span class="detail-key">条件 #{{ Number(idx) + 1 }}</span>
                  <span class="detail-val">{{ getSubRuleText(rule, sr) }}</span>
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
              <NButton size="small" type="primary" secondary @click="emit('edit', rule.id)">
                编辑规则
              </NButton>
              <NButton size="small" type="error" secondary @click="handleDelete(rule)">
                删除规则
              </NButton>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { NButton, NCheckbox, NInput, NSwitch } from 'naive-ui'
import { Search, FileOutput, FileInput, Trash2, AlertTriangle, ClipboardList, ChevronDown, Pencil } from 'lucide-vue-next'
import { useSeatRules } from '@/composables/useSeatRules'
import { useLogger } from '@/composables/useLogger'
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
} from '@/constants/ruleTypes'
import type { Rule, RulePriority, RuleSubRule, RuleSubject } from '@/types/models'

const props = withDefaults(defineProps<{ focusRuleId?: string }>(), {
  focusRuleId: ''
})

const emit = defineEmits<{
  (e: 'export' | 'import'): void
  (e: 'edit', ruleId: string): void
}>()

const { rules, renderRuleText, renderRuleTextWithoutPriority, toggleRule, updateRule, deleteRule, clearAllRules, detectConflicts } = useSeatRules()
const { students } = useStudentData()
const { tags } = useTagData()
const { attributeDefinitions, getAttributeById } = useStudentAttributes()
const { success, confirm } = useLogger()

const searchQuery = ref('')
const filterPriority = ref<RulePriority | 'all'>('all')
const expandedId = ref<string | null>(null)
const showConflicts = ref(false)
const selectedRuleIds = ref<string[]>([])
const selectedRuleIdSet = computed(() => new Set(selectedRuleIds.value))

const priorityTabs: Array<{ key: RulePriority | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'required', label: '必须' },
  { key: 'prefer', label: '建议' },
  { key: 'optional', label: '可选' }
]

const conflicts = ref<ReturnType<typeof detectConflicts>>([])
const hasScannedConflicts = ref(false)
const ruleTextCache = new Map<string, { signature: string; text: string }>()
let autoConflictScanTimer: number | null = null

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
const getRuleDetailId = (ruleId: string) => `rule-detail-${ruleId.replace(/[^a-zA-Z0-9_-]/g, '-')}`

const studentNameMap = computed(() => {
  const map = new Map<number, string>()
  for (const student of students.value) {
    map.set(student.id, student.name || `学生#${student.id}`)
  }
  return map
})

const tagNameMap = computed(() => {
  const map = new Map<number, string>()
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

const isSelected = (ruleId: string) => selectedRuleIdSet.value.has(ruleId)

const toggleSelectRule = (ruleId: string) => {
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

const toggleExpand = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id
}

const handleToggle = (ruleId: string) => {
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

const handleBatchSetPriority = (priority: RulePriority) => {
  const count = selectedRuleIds.value.length
  selectedRuleIds.value.forEach(ruleId => {
    updateRule(ruleId, { priority })
  })
  success(`已将 ${count} 条规则设为${PRIORITY_LABELS[priority]}`)
  hasScannedConflicts.value = false
}

const handleBatchToggle = (enabled: boolean) => {
  const count = selectedRuleIds.value.length
  selectedRuleIds.value.forEach(ruleId => {
    updateRule(ruleId, { enabled })
  })
  success(`已${enabled ? '启用' : '停用'} ${count} 条规则`)
  hasScannedConflicts.value = false
}

const handleBatchDelete = async () => {
  const count = selectedRuleIds.value.length
  if (count === 0) return
  const confirmed = await confirm({ title: '删除所选规则', content: `确认删除已选 ${count} 条规则？`, positiveText: '删除', type: 'error' })
  if (!confirmed) return
  selectedRuleIds.value.forEach(ruleId => deleteRule(ruleId))
  selectedRuleIds.value = []
  if (expandedId.value && !rules.value.find(r => r.id === expandedId.value)) expandedId.value = null
  success(`已成功删除 ${count} 条规则`)
  hasScannedConflicts.value = false
}

const handleDelete = async (rule: Rule) => {
  const confirmed = await confirm({ title: '删除规则', content: '确认删除此规则？', positiveText: '删除', type: 'error' })
  if (!confirmed) return
  deleteRule(rule.id)
  success('成功删除规则')
  if (expandedId.value === rule.id) expandedId.value = null
}

const handleClearAll = async () => {
  const count = rules.value.length
  if (count === 0) return
  const confirmed = await confirm({ title: '清空全部规则', content: `确认清空全部 ${count} 条规则？`, positiveText: '清空', type: 'error' })
  if (!confirmed) return
  clearAllRules()
  expandedId.value = null
  selectedRuleIds.value = []
  success(`已成功清空 ${count} 条规则`)
  conflicts.value = []
  hasScannedConflicts.value = false
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

const getRuleSignature = (rule: Rule) => {
  return `${rule.id}:${rule.updatedAt || rule.createdAt || 0}`
}

const getRuleText = (rule: Rule) => {
  const signature = getRuleSignature(rule)
  const cached = ruleTextCache.get(rule.id)
  if (cached?.signature === signature) return cached.text
  const text = renderRuleText(rule)
  ruleTextCache.set(rule.id, { signature, text })
  return text
}

const getSubRuleText = (rule: Rule, subRule: RuleSubRule) => {
  return renderRuleTextWithoutPriority({
    ...subRule,
    subjects: rule.subjects?.length ? rule.subjects : (subRule.subjects || []),
    priority: rule.priority
  })
}

const getParamLabel = (predicate: string, key: string) => {
  const meta = PREDICATE_META[predicate]
  const param = meta?.params?.find(p => p.key === key)
  return param?.label ?? key
}

const formatParamValue = (predicate: string, key: string, value: unknown) => {
  if (key === 'columnType' && typeof value === 'string') {
    return COLUMN_TYPE_LABELS[value as keyof typeof COLUMN_TYPE_LABELS] ?? value
  }
  if (key === 'scope' && typeof value === 'string') {
    return SCOPE_LABELS[value as keyof typeof SCOPE_LABELS] ?? value
  }
  if (key === 'tolerance') return value === 0 ? '仅正后方' : '正后方±1列'
  if (key === 'attributeId') {
    const attribute = typeof value === 'string' ? getAttributeById(value) : undefined
    return attribute ? (attribute.unit ? `${attribute.name}（${attribute.unit}）` : attribute.name) : String(value)
  }
  if (key === 'direction') return value === 'highFront' ? '高值靠前' : '低值靠前'
  if (key === 'aggregate') return value === 'sum' ? '合计值' : '平均值'
  return String(value)
}

const formatSubjects = (subjects: RuleSubject[] | undefined) => {
  if (!subjects?.length) return '-'
  return subjects.map(s => {
    if (s.type === 'person') {
      return s.id === null ? '未选择学生' : (studentNameMap.value.get(s.id) || `学生#${s.id}`)
    }
    if (s.type === 'tag') {
      return s.id === null ? '未选择标签' : (tagNameMap.value.get(s.id) || `标签#${s.id}`)
    }
    if (s.type === 'all') return '全体学生'
    return '-'
  }).join('、')
}

const focusRule = async (ruleId: string) => {
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

.search-box {
  display: flex;
  align-items: center;
}

.search-box > * {
  width: 100%;
}

.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.filter-tabs {
  display: flex;
  gap: 4px;
}

.toolbar-actions {
  display: flex;
  gap: 6px;
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

.conflict-detail-action {
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
  box-shadow: 0 1px 3px var(--shadow-sm);
}

.rule-item:hover { 
  border-color: var(--color-border-strong);
  box-shadow: 0 4px 12px var(--shadow-md);
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

.rule-expand-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

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

.detail-actions { display: flex; justify-content: flex-end; gap: 8px; }

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

@media (max-width: 720px) {
  .rule-toolbar {
    gap: 10px;
    padding: 10px;
  }

  .filter-row {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }

  .filter-tabs {
    width: 100%;
    overflow-x: auto;
  }

  .filter-tab {
    flex: 1 0 auto;
    min-height: 38px;
  }

  .toolbar-actions {
    justify-content: flex-end;
  }

  .batch-toolbar {
    gap: 6px;
  }

  .batch-actions {
    max-height: 92px;
    overflow-y: auto;
  }

  .rule-main {
    align-items: flex-start;
    padding: 10px 10px 10px 0;
  }

  .rule-select {
    padding-left: 8px;
  }

  .rule-toggle {
    padding-left: 8px;
    padding-top: 2px;
  }

  .rule-label {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .rule-actions {
    align-self: stretch;
    flex-direction: column;
    justify-content: space-between;
  }

  .rule-detail {
    padding: 12px;
  }

  .rule-detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-actions {
    gap: 8px;
  }

}
</style>
