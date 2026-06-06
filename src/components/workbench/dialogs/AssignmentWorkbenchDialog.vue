<template>
  <div v-if="visible" class="dialog-overlay" @click.self="emit('close')">
    <section class="workbench-dialog">
      <header class="dialog-header">
        <div>
          <h2>智能排位与规则</h2>
          <p>先配置规则和选区，再检查容量并执行自动排位</p>
        </div>
        <button class="icon-button" title="关闭" @click="emit('close')">
          <X :size="18" stroke-width="2" />
        </button>
      </header>

      <nav class="workbench-tabs">
        <button
          v-for="tab in panelTabs"
          :key="tab.key"
          class="workbench-tab"
          :class="{ active: activePanel === tab.key }"
          @click="activePanel = tab.key"
        >
          <component :is="tab.icon" :size="15" stroke-width="2" />
          <span>{{ tab.label }}</span>
          <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
        </button>
      </nav>

      <div class="dialog-body">
        <template v-if="activePanel === 'run'">
          <section class="summary-strip">
            <div><span>学生</span><strong>{{ students.length }}</strong></div>
            <div><span>可用座位</span><strong>{{ availableSeatCount }}</strong></div>
            <div><span>启用规则</span><strong>{{ activeRuleCount }}</strong></div>
            <div><span>风险</span><strong>{{ precheckRiskText }}</strong></div>
          </section>

          <section class="panel-section">
            <div class="section-heading">
              <h3>规则与选区</h3>
              <button class="text-action" @click="activePanel = 'rules'">
                <Scale :size="14" stroke-width="2" />
                <span>管理规则</span>
              </button>
            </div>
            <ZoneList />
          </section>

          <section class="panel-section">
            <div class="section-heading">
              <h3>执行前预检查</h3>
              <button class="text-action" @click="runAssignmentPrecheck">
                <Sliders :size="14" stroke-width="2" />
                <span>运行预检查</span>
              </button>
            </div>

            <div v-if="precheckResult" class="precheck-card" :class="`risk-${precheckResult.risk}`">
              <div class="precheck-main">
                <span>状态：{{ precheckResult.pass ? '通过' : '未通过' }}</span>
                <span>覆盖率：{{ precheckResult.coverageRate }}%</span>
                <span>预计耗时：{{ precheckResult.estimatedMs }}ms</span>
              </div>
              <div v-if="precheckResult.blockingReasons.length > 0" class="precheck-list blocking">
                <div v-for="(item, index) in precheckResult.blockingReasons" :key="`b-${index}`">
                  <CircleX :size="14" stroke-width="2" />
                  <span>{{ item }}</span>
                </div>
              </div>
              <div v-if="precheckResult.warnings.length > 0" class="precheck-list warning">
                <div v-for="(item, index) in precheckResult.warnings" :key="`w-${index}`">
                  <CircleAlert :size="14" stroke-width="2" />
                  <span>{{ item }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty-precheck">尚未预检查</div>
          </section>

          <section class="panel-section">
            <div class="section-heading">
              <h3>排位参数</h3>
              <span class="iteration-badge">{{ (assignConfig.maxIterations / 10000).toFixed(0) }}w</span>
            </div>
            <input v-model.number="assignConfig.maxIterations" type="range" min="10000" max="1000000" step="10000" />
          </section>

          <section v-if="isAssigning || lastAssignmentReport" class="panel-section">
            <div class="progress-wrap">
              <div class="progress-bar" :style="{ width: `${assignmentProgress}%` }"></div>
            </div>
            <div class="stat-row">
              <span>进度 {{ assignmentProgress }}%</span>
              <span>得分 {{ assignmentIterationInfo.bestScore ?? '-' }}</span>
              <span>迭代 {{ ((assignmentIterationInfo.i || 0) / 10000).toFixed(0) }}w</span>
            </div>
          </section>

          <AssignmentInlineReport
            v-if="lastAssignmentReport !== null && !isAssigning"
            :report="lastAssignmentReport"
            :duration="lastAssignmentDuration"
            @focus-rule="handleFocusRule"
          />
        </template>

        <template v-else-if="activePanel === 'rules'">
          <div class="rule-workbench">
            <section class="rule-pane list-pane">
              <RuleList
                ref="ruleListRef"
                :focus-rule-id="focusRuleId"
                @export="handleExportRules"
                @import="handleImportRules"
                @edit="handleEditRule"
              />
            </section>
            <section class="rule-pane editor-pane">
              <RuleBuilder
                ref="ruleBuilderRef"
                :editing-rule="editingRule"
                @added="onRuleAdded"
                @cancel-edit="editingRuleId = ''"
              />
            </section>
            <aside class="rule-pane quick-pane">
              <div class="quick-panel">
                <div class="quick-panel-head">
                  <Wand2 :size="16" stroke-width="2" />
                  <div>
                    <h3>快捷方案</h3>
                    <p>选择场景后补齐对象和参数</p>
                  </div>
                </div>
                <section v-for="group in quickTemplateGroups" :key="group.title" class="quick-section">
                  <div class="quick-section-title">{{ group.title }}</div>
                  <button
                    v-for="option in group.options"
                    :key="option.key"
                    class="quick-option"
                    @click="applyTemplate(option.key)"
                  >
                    <span>{{ option.title }}</span>
                    <small>{{ option.desc }}</small>
                  </button>
                </section>
              </div>
            </aside>
          </div>
        </template>

        <RuleUsageGuide v-else>
          <template #action-button>
            <button class="text-action" @click="activePanel = 'rules'">去规则管理创建规则</button>
          </template>
        </RuleUsageGuide>
      </div>

      <footer class="dialog-footer">
        <span class="footer-stats">{{ ruleCount }} 条规则</span>
        <div class="footer-actions">
          <button v-if="activePanel !== 'run'" class="secondary-button" @click="activePanel = 'run'">返回排位</button>
          <button class="secondary-button" @click="emit('close')">关闭</button>
          <button
            v-if="activePanel === 'run'"
            class="primary-button"
            :class="{ danger: isAssigning }"
            :disabled="isAssignmentCancelRequested || (!isAssigning && precheckResult && !precheckResult.pass)"
            @click="handleRunAssignment"
          >
          <Loader2 v-if="isAssignmentCancelRequested" :size="16" stroke-width="2" class="spin-icon" />
          <X v-else-if="isAssigning" :size="16" stroke-width="2" />
          <Play v-else :size="16" stroke-width="2" />
          <span>{{ isAssignmentCancelRequested ? '正在中断' : (isAssigning ? '中断排位' : '开始排位') }}</span>
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { BookOpen, CircleAlert, CircleX, Loader2, Play, Scale, Sliders, Wand2, X } from 'lucide-vue-next'
import ZoneList from '@/components/zone/ZoneList.vue'
import AssignmentInlineReport from '@/components/rule/AssignmentInlineReport.vue'
import RuleBuilder from '@/components/rule/RuleBuilder.vue'
import RuleList from '@/components/rule/RuleList.vue'
import RuleUsageGuide from '@/components/docs/RuleUsageGuide.vue'
import { useAssignment } from '@/composables/useAssignment'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'
import { useSeatRules } from '@/composables/useSeatRules'
import { useStudentData } from '@/composables/useStudentData'
import { useZoneData } from '@/composables/useZoneData'
import { createAssignmentPrecheck } from '@/utils/assignmentPrecheck'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  initialPanel: {
    type: String,
    default: 'run'
  },
  focusRuleId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])
const { students } = useStudentData()
const { seats, seatConfig, getAvailableSeats, isInRowRange, isColumnType } = useSeatChart()
const { zones } = useZoneData()
const { rules, ruleCount, getActiveRules, detectConflicts, renderRuleText, exportRules, importRules } = useSeatRules()
const { success, warning, error } = useLogger()
const {
  isAssigning,
  isAssignmentCancelRequested,
  assignmentProgress,
  assignmentIterationInfo,
  runSmartAssignment,
  cancelSmartAssignment
} = useAssignment()

const assignConfig = reactive({
  maxIterations: 500000
})
const activePanel = ref('run')
const ruleListRef = ref(null)
const ruleBuilderRef = ref(null)
const editingRuleId = ref('')
const lastAssignmentReport = ref(null)
const lastAssignmentDuration = ref(0)
const precheckResult = ref(null)

const activeRules = computed(() => getActiveRules())
const activeRuleCount = computed(() => activeRules.value.length)
const availableSeatCount = computed(() => getAvailableSeats(seatConfig.value.guardSeats?.includeInAutoAssignment === true).length)
const editingRule = computed(() => {
  if (!editingRuleId.value) return null
  return rules.value.find(rule => rule.id === editingRuleId.value) || null
})
const panelTabs = computed(() => [
  { key: 'run', icon: Play, label: '执行排位', badge: null },
  { key: 'rules', icon: Scale, label: '规则管理', badge: ruleCount.value > 0 ? ruleCount.value : null },
  { key: 'guide', icon: BookOpen, label: '使用说明', badge: null }
])

const quickTemplateGroups = [
  {
    title: '位置照顾',
    options: [
      { key: 'front-row', title: '前排优先', desc: '给需要关注的学生限定前几排' },
      { key: 'avoid-window', title: '避开窗边', desc: '减少靠墙或窗边位置影响' }
    ]
  },
  {
    title: '同桌关系',
    options: [
      { key: 'deskmates', title: '安排同桌', desc: '把两个指定学生安排为同桌' },
      { key: 'avoid-deskmates', title: '禁止同桌', desc: '避免两个学生成为同桌' },
      { key: 'keep-distance', title: '保持距离', desc: '让指定学生之间隔开距离' }
    ]
  },
  {
    title: '全班均衡',
    options: [
      { key: 'spread-group', title: '标签分散', desc: '把同标签学生尽量分散' },
      { key: 'height-gradient', title: '身高梯度', desc: '按身高形成前后梯度' },
      { key: 'score-balance', title: '成绩均衡', desc: '让各大组平均成绩接近' },
      { key: 'score-bands', title: '成绩分层', desc: '按成绩分层后均匀分布' }
    ]
  }
]

const precheckRiskText = computed(() => {
  if (!precheckResult.value) return '未评估'
  if (precheckResult.value.risk === 'low') return '低'
  if (precheckResult.value.risk === 'medium') return '中'
  return '高'
})

let autoPrecheckTimer = null
const schedulePrecheck = () => {
  if (!props.visible) return
  precheckResult.value = null
  if (autoPrecheckTimer) window.clearTimeout(autoPrecheckTimer)
  autoPrecheckTimer = window.setTimeout(() => {
    autoPrecheckTimer = null
    runAssignmentPrecheck({ silent: true })
  }, 500)
}

const runAssignmentPrecheck = ({ silent = false } = {}) => {
  const includeGuardSeats = seatConfig.value.guardSeats?.includeInAutoAssignment === true
  const availableSeats = getAvailableSeats(includeGuardSeats)
  const result = createAssignmentPrecheck({
    students: students.value,
    activeRules: activeRules.value,
    availableSeats,
    seats: seats.value,
    seatConfig: seatConfig.value,
    zones: zones.value,
    detectConflicts,
    renderRuleText,
    isInRowRange,
    isColumnType,
    maxIterations: assignConfig.maxIterations
  })

  precheckResult.value = result
  if (!silent) {
    if (result.pass) success(`预检查通过（风险${precheckRiskText.value}）`)
    else error('预检查未通过，请先处理阻断项')
  }
  return result
}

const handleRunAssignment = async () => {
  if (isAssigning.value) {
    if (cancelSmartAssignment()) warning('正在中断智能排位...')
    return
  }

  const gate = runAssignmentPrecheck({ silent: true })
  if (!gate.pass) {
    error('预检查未通过，请先修复阻断项')
    return
  }

  lastAssignmentReport.value = null
  const startTime = Date.now()
  try {
    const result = await runSmartAssignment({
      useRules: true,
      iterations: assignConfig.maxIterations
    })
    if (result.success) {
      if (result.message) success(result.message)
      lastAssignmentReport.value = result.report ?? null
      lastAssignmentDuration.value = result.duration ?? (Date.now() - startTime)
    } else if (result.canceled) {
      warning(result.message)
    } else {
      error(result.message)
    }
  } catch (err) {
    error('排位执行过程中出错')
    console.error(err)
  }
}

const handleFocusRule = (item) => {
  if (!item?.rule) return
  activePanel.value = 'rules'
  nextTick(() => {
    ruleListRef.value?.focusRule?.(item.rule.id)
  })
  success(`已定位规则：${renderRuleText(item.rule)}`)
}

const handleExportRules = () => {
  const json = exportRules()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `seat_rules_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const handleImportRules = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async (event) => {
    const file = event.target?.files?.[0]
    if (!file) return
    const text = await file.text()
    const result = importRules(text)
    if (!result.success) {
      const firstErr = result.errors?.[0]
      error(firstErr?.message || '规则导入失败')
      return
    }

    if (result.imported > 0) {
      editingRuleId.value = ''
      success(`规则导入成功：${result.imported} 条`)
    } else {
      warning('未导入任何规则')
    }
    if (result.errors?.length) {
      warning(`有 ${result.errors.length} 条规则导入失败，请检查格式或参数`)
    }
  }
  input.click()
}

const handleEditRule = (ruleId) => {
  editingRuleId.value = ruleId
}

const onRuleAdded = () => {
  editingRuleId.value = ''
}

const applyTemplate = (key) => {
  ruleBuilderRef.value?.applyQuickTemplate?.(key)
}

watch(() => props.visible, (visible) => {
  if (visible) {
    activePanel.value = props.initialPanel || 'run'
  } else {
    editingRuleId.value = ''
  }
}, { immediate: true })

watch(() => props.initialPanel, (panel) => {
  if (props.visible && panel) activePanel.value = panel
})

watch(() => props.focusRuleId, (ruleId) => {
  if (!props.visible || !ruleId) return
  activePanel.value = 'rules'
  nextTick(() => {
    ruleListRef.value?.focusRule?.(ruleId)
  })
})

watch(
  [
    () => props.visible,
    () => students.value.map(student => `${student.id}:${(student.tags || []).join(',')}`).join('|'),
    () => rules.value.map(rule => `${rule.id}:${rule.updatedAt || rule.createdAt || 0}:${rule.enabled !== false}`).join('|'),
    () => seats.value.map(seat => `${seat.id}:${seat.isEmpty ? 1 : 0}:${seat.studentId ?? ''}`).join('|'),
    () => zones.value.map(zone => `${zone.id}:${zone.seatIds?.join(',') || ''}`).join('|'),
    () => assignConfig.maxIterations
  ],
  schedulePrecheck,
  { immediate: true }
)

onBeforeUnmount(() => {
  if (autoPrecheckTimer) window.clearTimeout(autoPrecheckTimer)
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--color-bg-overlay);
}

.workbench-dialog {
  width: min(1180px, 100%);
  max-height: min(820px, 92vh);
  display: flex;
  flex-direction: column;
  background: var(--color-dialog-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.dialog-header,
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.dialog-footer {
  border-top: 1px solid var(--color-border);
  border-bottom: none;
}

.workbench-tabs {
  display: flex;
  gap: 8px;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
}

.workbench-tab {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: none;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.workbench-tab:hover {
  color: var(--color-text-primary);
}

.workbench-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-badge {
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.dialog-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--color-text-primary);
}

.dialog-header p {
  margin: 4px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.dialog-body {
  overflow-y: auto;
  padding: 16px;
}

.footer-stats {
  color: var(--color-text-muted);
  font-size: 12px;
}

.footer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.icon-button,
.text-action,
.secondary-button,
.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
}

.icon-button {
  width: 34px;
  padding: 0;
}

.text-action {
  min-height: 32px;
  padding: 0 10px;
  color: var(--color-primary);
}

.primary-button {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
  padding: 0 14px;
}

.primary-button.danger {
  background: var(--color-danger);
  border-color: var(--color-danger);
}

.secondary-button {
  padding: 0 14px;
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}

.summary-strip div {
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
}

.summary-strip span {
  display: block;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.summary-strip strong {
  display: block;
  margin-top: 4px;
  color: var(--color-text-primary);
  font-size: 18px;
}

.panel-section {
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  margin-bottom: 14px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-heading h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 15px;
}

.iteration-badge {
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 700;
}

.panel-section input[type="range"] {
  width: 100%;
}

.rule-workbench {
  display: grid;
  grid-template-columns: minmax(280px, 0.95fr) minmax(380px, 1.25fr) minmax(240px, 0.75fr);
  gap: 14px;
  align-items: start;
}

.rule-pane {
  min-width: 0;
}

.list-pane,
.editor-pane {
  max-height: calc(92vh - 220px);
  overflow: auto;
}

.quick-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.quick-panel-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--color-primary);
}

.quick-panel-head h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 14px;
}

.quick-panel-head p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.quick-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-section-title {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.quick-option {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;
}

.quick-option:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-subtle);
}

.quick-option span {
  font-size: 13px;
  font-weight: 700;
}

.quick-option small {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.precheck-card {
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.precheck-card.risk-high {
  border-color: var(--color-danger);
}

.precheck-card.risk-medium {
  border-color: var(--color-warning);
}

.precheck-main,
.stat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.precheck-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.precheck-list div {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12px;
  line-height: 1.5;
}

.precheck-list.blocking {
  color: var(--color-danger-text);
}

.precheck-list.warning {
  color: var(--color-warning-text);
}

.empty-precheck {
  color: var(--color-text-muted);
  font-size: 13px;
}

.progress-wrap {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  margin-bottom: 10px;
}

.progress-bar {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.2s ease;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 720px) {
  .dialog-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .workbench-dialog {
    border-radius: 12px 12px 0 0;
  }

  .summary-strip {
    grid-template-columns: repeat(2, 1fr);
  }

  .workbench-tabs {
    overflow-x: auto;
  }

  .rule-workbench {
    grid-template-columns: 1fr;
  }

  .list-pane,
  .editor-pane {
    max-height: none;
    overflow: visible;
  }

  .dialog-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .footer-actions {
    width: 100%;
  }
}
</style>
