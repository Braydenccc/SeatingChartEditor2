<template>
  <div v-if="visible" class="dialog-overlay" @click.self="emit('close')">
    <section
      class="workbench-dialog"
      :class="{ 'rule-mobile-editor-active': activePanel === 'rules' && mobileRulePage === 'editor' }"
    >
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

      <div class="dialog-body" :class="{ 'rules-body': activePanel === 'rules' }">
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
              <h3>迭代次数</h3>
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
          <div class="rule-workbench" :class="{ 'show-mobile-editor': mobileRulePage === 'editor' }">
            <section class="rule-pane rule-left-pane">
              <button class="add-rule-button" @click="handleCreateRule">
                <Plus :size="15" stroke-width="2" />
                <span>添加规则</span>
              </button>
              <RuleList
                ref="ruleListRef"
                :focus-rule-id="focusRuleId"
                @export="handleExportRules"
                @import="handleImportRules"
                @edit="handleEditRule"
              />
            </section>
            <section v-if="isRuleEditorOpen" class="rule-pane editor-pane">
              <div class="mobile-rule-editor-header">
                <button class="icon-button" title="返回规则列表" @click="closeRuleEditor">
                  <ArrowLeft :size="18" stroke-width="2" />
                </button>
                <h3>{{ isEditingRule ? '编辑规则' : '添加规则' }}</h3>
              </div>
              <RuleBuilder
                ref="ruleBuilderRef"
                :editing-rule="editingRule"
                @added="onRuleAdded"
                @cancel-edit="closeRuleEditor"
              />
            </section>
            <aside v-else class="rule-pane empty-editor-pane">
              <div class="empty-editor-panel">
                <div>
                  <h3>选择一条规则进行编辑</h3>
                  <p>也可以新建规则，在编辑窗口中使用快捷方案快速填充常见约束。</p>
                </div>
                <button class="add-rule-button" @click="handleCreateRule">
                  <Plus :size="15" stroke-width="2" />
                  <span>添加规则</span>
                </button>
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
import { ArrowLeft, BookOpen, CircleAlert, CircleX, Loader2, Play, Plus, Scale, Sliders, X } from 'lucide-vue-next'
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
import { openTextFile, saveTextFile } from '@/platform/files'

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
const creatingRule = ref(false)
const mobileRulePage = ref('list')
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
const isEditingRule = computed(() => !!editingRule.value)
const isRuleEditorOpen = computed(() => creatingRule.value || isEditingRule.value)
const panelTabs = computed(() => [
  { key: 'run', icon: Play, label: '执行排位', badge: null },
  { key: 'rules', icon: Scale, label: '规则管理', badge: ruleCount.value > 0 ? ruleCount.value : null },
  { key: 'guide', icon: BookOpen, label: '使用说明', badge: null }
])

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

const handleExportRules = async () => {
  const json = exportRules()
  await saveTextFile(json, {
    title: '导出座位规则',
    defaultPath: `seat_rules_${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    extension: '.json',
    mimeType: 'application/json;charset=utf-8'
  })
}

const handleImportRules = async () => {
  try {
    const selected = await openTextFile({
      title: '导入座位规则',
      accept: '.json,application/json',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    })
    if (!selected) return
    const text = selected.text
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
  } catch (err) {
    error(err.message || '规则导入失败')
  }
}

const handleEditRule = (ruleId) => {
  creatingRule.value = false
  editingRuleId.value = ruleId
  mobileRulePage.value = 'editor'
}

const onRuleAdded = () => {
  closeRuleEditor()
}

const closeRuleEditor = () => {
  creatingRule.value = false
  editingRuleId.value = ''
  mobileRulePage.value = 'list'
}

const handleCreateRule = () => {
  editingRuleId.value = ''
  creatingRule.value = true
  mobileRulePage.value = 'editor'
}

watch(() => props.visible, (visible) => {
  if (visible) {
    activePanel.value = props.initialPanel || 'run'
    if ((props.initialPanel || 'run') === 'rules') mobileRulePage.value = 'list'
  } else {
    closeRuleEditor()
  }
}, { immediate: true })

watch(() => props.initialPanel, (panel) => {
  if (props.visible && panel) {
    activePanel.value = panel
    if (panel === 'rules') mobileRulePage.value = 'list'
  }
})

watch(() => props.focusRuleId, (ruleId) => {
  if (!props.visible || !ruleId) return
  activePanel.value = 'rules'
  mobileRulePage.value = 'list'
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
  width: min(1280px, calc(100vw - 48px));
  height: min(860px, calc(100vh - 48px));
  max-height: calc(100vh - 48px);
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
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.dialog-body.rules-body {
  overflow: hidden;
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
  grid-template-columns: minmax(360px, 0.9fr) minmax(420px, 1.1fr);
  gap: 14px;
  align-items: stretch;
  height: 100%;
  min-height: 0;
}

.rule-pane {
  min-width: 0;
  min-height: 0;
}

.rule-left-pane,
.empty-editor-pane {
  height: 100%;
  overflow-y: auto;
}

.editor-pane {
  height: 100%;
  overflow: hidden;
}

.rule-left-pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.add-rule-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.add-rule-button:hover {
  background: var(--color-primary-hover);
}

.mobile-rule-editor-header {
  display: none;
}

.empty-editor-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  justify-content: center;
  min-height: 100%;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.empty-editor-panel h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 15px;
}

.empty-editor-panel p {
  margin: 6px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.4;
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
    width: 100%;
    height: 92vh;
    max-height: 92vh;
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
    height: 100%;
    min-height: 0;
  }

  .dialog-body.rules-body {
    overflow: hidden;
  }

  .rule-left-pane,
  .editor-pane,
  .empty-editor-pane {
    height: 100%;
    max-height: none;
    overflow-y: auto;
  }

  .rule-workbench.show-mobile-editor .rule-left-pane,
  .rule-workbench:not(.show-mobile-editor) .editor-pane,
  .rule-workbench:not(.show-mobile-editor) .empty-editor-pane {
    display: none;
  }

  .mobile-rule-editor-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  .mobile-rule-editor-header h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 16px;
  }

  .rule-mobile-editor-active .dialog-header,
  .rule-mobile-editor-active .workbench-tabs,
  .rule-mobile-editor-active .dialog-footer {
    display: none;
  }

  .workbench-dialog.rule-mobile-editor-active {
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }

  .rule-mobile-editor-active .dialog-body {
    padding: 14px;
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
