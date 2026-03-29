<template>
  <div class="rule-list">
    <!-- 过滤工具栏 -->
    <div class="filter-bar">
      <div class="filter-tabs">
        <button
          v-for="tab in priorityTabs"
          :key="tab.key"
          class="filter-tab"
          :class="{ active: filterPriority === tab.key }"
          @click="filterPriority = tab.key"
        >
          <span v-if="tab.key !== 'all'" class="dot" :style="{ background: PRIORITY_COLORS[tab.key] }"></span>
          {{ tab.label }}
          <span class="badge">{{ tabCounts[tab.key] }}</span>
        </button>
      </div>
      <div class="filter-actions">
        <button class="btn-ghost btn-sm" @click="emit('export')" title="导出规则 JSON">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          导出
        </button>
        <button class="btn-ghost btn-sm" @click="emit('import')" title="导入规则 JSON">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          导入
        </button>
        <button v-if="rules.length > 0" class="btn-ghost btn-sm danger" @click="handleClearAll">
          清空
        </button>
      </div>
    </div>

    <!-- 冲突警告 -->
    <div v-if="conflicts.length > 0" class="conflict-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      发现 {{ conflicts.length }} 条逻辑冲突规则
      <button class="conflict-detail-btn" @click="showConflicts = !showConflicts">
        {{ showConflicts ? '收起' : '查看' }}
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
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
      <p>{{ filterPriority === 'all' ? '暂无规则，请在上方添加' : '该优先级下没有规则' }}</p>
    </div>

    <!-- 规则列表 -->
    <transition-group name="rule-list-anim" tag="div" class="rules-container">
      <div
        v-for="rule in filteredRules"
        :key="rule.id"
        class="rule-item"
        :class="{
          disabled: !rule.enabled,
          expanded: expandedId === rule.id,
          [rule.priority]: true
        }"
      >
        <!-- 主行 -->
        <div class="rule-main" @click="toggleExpand(rule.id)">
          <div class="rule-priority-bar" :style="{ background: PRIORITY_COLORS[rule.priority] }"></div>

          <div class="rule-toggle">
            <label class="toggle-switch" @click.stop>
              <input type="checkbox" :checked="rule.enabled" @change="handleToggle(rule.id)" />
              <span class="toggle-knob"></span>
            </label>
          </div>

          <div class="rule-text">
            <span class="rule-icon">{{ PRIORITY_ICONS[rule.priority] }}</span>
            <span class="rule-label">{{ renderRuleText(rule) }}</span>
          </div>

          <div class="rule-actions">
            <span class="rule-chevron" :class="{ open: expandedId === rule.id }">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
        </div>

        <!-- 展开区：参数详情 + 删除 -->
        <transition name="expand">
          <div v-if="expandedId === rule.id" class="rule-detail">
            <div class="rule-detail-grid">
              <div class="detail-item">
                <span class="detail-key">主体类型</span>
                <span class="detail-val">{{ SUBJECT_KIND_LABELS[rule.subject.kind] }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-key">谓词</span>
                <span class="detail-val">{{ RULE_TYPE_LABELS[rule.predicate] }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-key">优先级</span>
                <span class="detail-val priority-chip" :class="rule.priority">{{ PRIORITY_LABELS[rule.priority] }}</span>
              </div>
              <div v-if="rule.description" class="detail-item full-width">
                <span class="detail-key">备注</span>
                <span class="detail-val">{{ rule.description }}</span>
              </div>
              <div v-for="(val, key) in rule.params" :key="key" class="detail-item">
                <span class="detail-key">{{ getParamLabel(rule.predicate, key) }}</span>
                <span class="detail-val">{{ formatParamValue(rule.predicate, key, val) }}</span>
              </div>
            </div>
            <div class="detail-actions">
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
    </transition-group>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSeatRules } from '@/composables/useSeatRules'
import { useConfirmAction } from '@/composables/useConfirmAction'
import {
  PRIORITY_COLORS,
  PRIORITY_ICONS,
  PRIORITY_LABELS,
  SUBJECT_KIND_LABELS,
  RULE_TYPE_LABELS,
  PREDICATE_META,
  COLUMN_TYPE_LABELS,
  SCOPE_LABELS
} from '@/constants/ruleTypes.js'

const emit = defineEmits(['export', 'import'])

const { rules, renderRuleText, toggleRule, deleteRule, clearAllRules, detectConflicts } = useSeatRules()
const { requestConfirm, isConfirming } = useConfirmAction()

const filterPriority = ref('all')
const expandedId = ref(null)
const showConflicts = ref(false)

const priorityTabs = [
  { key: 'all', label: '全部' },
  { key: 'required', label: '必须' },
  { key: 'prefer', label: '尽量' },
  { key: 'optional', label: '可选' }
]

const conflicts = computed(() => detectConflicts())

const tabCounts = computed(() => ({
  all: rules.value.length,
  required: rules.value.filter(r => r.priority === 'required').length,
  prefer: rules.value.filter(r => r.priority === 'prefer').length,
  optional: rules.value.filter(r => r.priority === 'optional').length
}))

const filteredRules = computed(() => {
  if (filterPriority.value === 'all') return rules.value
  return rules.value.filter(r => r.priority === filterPriority.value)
})

const toggleExpand = (id) => {
  expandedId.value = expandedId.value === id ? null : id
}

const handleToggle = (ruleId) => {
  toggleRule(ruleId)
}

const getDeletingKey = (id) => `deleteRule-${id}`
const isDeletingRule = (id) => isConfirming(getDeletingKey(id))

const handleDelete = (rule) => {
  requestConfirm(
    getDeletingKey(rule.id),
    () => {
      deleteRule(rule.id)
      if (expandedId.value === rule.id) expandedId.value = null
    },
    `确定删除此规则？`
  )
}

const handleClearAll = () => {
  if (confirm(`确定清空全部 ${rules.value.length} 条规则？此操作不可撤销。`)) {
    clearAllRules()
    expandedId.value = null
  }
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
  return String(value)
}
</script>

<style scoped>
.rule-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ==================== 过滤栏 ==================== */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-tabs {
  display: flex;
  gap: 4px;
}

.filter-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1.5px solid #e2e8f0;
  border-radius: 20px;
  background: white;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab:hover { border-color: #94a3b8; color: #334155; }
.filter-tab.active { background: #23587b; border-color: #23587b; color: white; }

.filter-tab .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.badge {
  background: rgba(0,0,0,0.1);
  border-radius: 10px;
  padding: 0 5px;
  font-size: 11px;
  min-width: 18px;
  text-align: center;
}

.filter-tab.active .badge { background: rgba(255,255,255,0.25); }

.filter-actions {
  display: flex;
  gap: 4px;
}

.btn-ghost {
  padding: 5px 10px;
  border: 1.5px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.btn-ghost:hover { border-color: #94a3b8; color: #334155; }
.btn-ghost.danger:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }
.btn-sm { padding: 4px 8px; font-size: 11px; }

/* ==================== 冲突警告 ==================== */
.conflict-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
}

.conflict-detail-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 12px;
  color: #d97706;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.conflict-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: #fff7ed;
  border-radius: 8px;
  border: 1px solid #fed7aa;
}

.conflict-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: #7c2d12;
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

.conflict-type-badge.contradiction { background: #fee2e2; color: #dc2626; }
.conflict-type-badge.infeasible { background: #fef9c3; color: #b45309; }

/* ==================== 空状态 ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 0;
  color: #94a3b8;
}

.empty-state p { margin: 0; font-size: 13px; }

/* ==================== 规则列表 ==================== */
.rules-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rule-item {
  border-radius: 10px;
  border: 1.5px solid #e2e8f0;
  background: white;
  overflow: hidden;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.rule-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.rule-item.disabled { opacity: 0.55; }
.rule-item.required { border-left: 3px solid #ef4444; }
.rule-item.prefer { border-left: 3px solid #f59e0b; }
.rule-item.optional { border-left: 3px solid #94a3b8; }
.rule-item.expanded { border-color: #93c5fd; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); }

.rule-main {
  display: flex;
  align-items: center;
  padding: 10px 12px 10px 0;
  cursor: pointer;
  gap: 8px;
  user-select: none;
}

.rule-priority-bar {
  width: 0;
  align-self: stretch;
  flex-shrink: 0;
}

/* 开关 */
.rule-toggle { flex-shrink: 0; padding-left: 12px; }

.toggle-switch {
  display: inline-block;
  position: relative;
  width: 34px;
  height: 20px;
  cursor: pointer;
}

.toggle-switch input { display: none; }

.toggle-knob {
  position: absolute;
  inset: 0;
  background: #cbd5e1;
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
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.toggle-switch input:checked ~ .toggle-knob { background: #22c55e; }
.toggle-switch input:checked ~ .toggle-knob::after { transform: translateX(14px); }

.rule-text {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.rule-icon { font-size: 14px; flex-shrink: 0; }
.rule-label {
  font-size: 13px;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rule-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.rule-chevron {
  color: #94a3b8;
  transition: transform 0.2s;
  display: flex;
}
.rule-chevron.open { transform: rotate(180deg); }

/* ==================== 展开区 ==================== */
.rule-detail {
  border-top: 1px solid #f1f5f9;
  padding: 12px 16px;
  background: #f8fafc;
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
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.detail-val {
  font-size: 13px;
  color: #334155;
  font-weight: 500;
}

.priority-chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.priority-chip.required { background: #fee2e2; color: #dc2626; }
.priority-chip.prefer { background: #fef9c3; color: #b45309; }
.priority-chip.optional { background: #f1f5f9; color: #64748b; }

.detail-actions { display: flex; justify-content: flex-end; }

.btn-delete {
  padding: 5px 14px;
  border: 1.5px solid #fca5a5;
  border-radius: 6px;
  background: white;
  color: #dc2626;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete:hover { background: #fee2e2; }

.btn-delete.confirming {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
  animation: pulse-del 0.5s ease-in-out infinite;
}

@keyframes pulse-del {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

/* ==================== 动画 ==================== */
.rule-list-anim-enter-active,
.rule-list-anim-leave-active {
  transition: all 0.25s ease;
}

.rule-list-anim-enter-from,
.rule-list-anim-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

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
