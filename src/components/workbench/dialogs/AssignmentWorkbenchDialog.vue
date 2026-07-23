<template>
  <ResponsiveOverlay :show="visible" title="智能排位与规则" :desktop-width="1280" mobile-height="92dvh" @update:show="value => !value && emit('close')">
    <div
      class="workbench-dialog"
      :class="{
        'compact-layout': isCompactLayout,
        'rule-mobile-editor-active': activePanel === 'rules' && mobileRulePage === 'editor'
      }"
    >
      <p class="dialog-description">先配置规则和选区，再检查容量并执行自动排位</p>

      <nav class="workbench-tabs">
        <NButton
          v-for="tab in panelTabs"
          :key="tab.key"
          class="workbench-tab"
          :class="{ active: activePanel === tab.key }"
          size="small"
          quaternary
          :type="activePanel === tab.key ? 'primary' : 'default'"
          @click="activePanel = tab.key"
        >
          <template #icon><component :is="tab.icon" :size="15" stroke-width="2" /></template>
          <span>{{ tab.label }}</span>
          <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
        </NButton>
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
              <NButton size="small" text type="primary" @click="activePanel = 'rules'">
                <template #icon><Scale :size="14" stroke-width="2" /></template>
                <span>管理规则</span>
              </NButton>
            </div>
            <ZoneList />
          </section>

          <section class="panel-section">
            <div class="section-heading">
              <h3>执行前预检查</h3>
              <NButton size="small" text type="primary" @click="() => runAssignmentPrecheck()">
                <template #icon><Sliders :size="14" stroke-width="2" /></template>
                <span>运行预检查</span>
              </NButton>
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
            <NSlider v-model:value="assignConfig.maxIterations" :min="10000" :max="1000000" :step="10000" />
          </section>

          <section v-if="isAssigning || lastAssignmentReport" class="panel-section">
            <NProgress type="line" :percentage="assignmentProgress" :show-indicator="false" processing />
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
              <NButton type="primary" size="small" @click="handleCreateRule">
                <template #icon><Plus :size="15" stroke-width="2" /></template>
                <span>添加规则</span>
              </NButton>
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
                <NButton quaternary circle size="small" title="返回规则列表" @click="closeRuleEditor">
                  <ArrowLeft :size="18" stroke-width="2" />
                </NButton>
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
                <NButton type="primary" size="small" @click="handleCreateRule">
                  <template #icon><Plus :size="15" stroke-width="2" /></template>
                  <span>添加规则</span>
                </NButton>
              </div>
            </aside>
          </div>
        </template>

        <RuleUsageGuide v-else>
          <template #action-button>
            <NButton text type="primary" @click="activePanel = 'rules'">去规则管理创建规则</NButton>
          </template>
        </RuleUsageGuide>
      </div>

    </div>
      <template #footer><footer class="dialog-footer" :class="{ 'compact-layout': isCompactLayout }">
        <span class="footer-stats">{{ ruleCount }} 条规则</span>
        <div class="footer-actions">
          <NButton v-if="activePanel !== 'run'" @click="activePanel = 'run'">返回排位</NButton>
          <NButton @click="emit('close')">关闭</NButton>
          <NButton
            v-if="activePanel === 'run'"
            :type="isAssigning ? 'error' : 'primary'"
            :disabled="isAssignmentCancelRequested || (!isAssigning && !!precheckResult && !precheckResult.pass)"
            :loading="isAssignmentCancelRequested"
            @click="handleRunAssignment"
          >
            <template #icon>
              <X v-if="isAssigning && !isAssignmentCancelRequested" :size="16" stroke-width="2" />
              <Play v-else :size="16" stroke-width="2" />
            </template>
            <span>{{ isAssignmentCancelRequested ? '正在中断' : (isAssigning ? '中断排位' : '开始排位') }}</span>
          </NButton>
        </div>
      </footer></template>
  </ResponsiveOverlay>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { NButton, NProgress, NSlider } from 'naive-ui'
import { ArrowLeft, BookOpen, CircleAlert, CircleX, Play, Plus, Scale, Sliders, X } from 'lucide-vue-next'
import ZoneList from '@/components/zone/ZoneList.vue'
import AssignmentInlineReport from '@/components/rule/AssignmentInlineReport.vue'
import RuleBuilder from '@/components/rule/RuleBuilder.vue'
import RuleList from '@/components/rule/RuleList.vue'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import RuleUsageGuide from '@/components/docs/RuleUsageGuide.vue'
import { assignmentWorkbenchCompactMediaQuery } from '@/constants/layout'
import { useAssignment } from '@/composables/useAssignment'
import type { AssignmentReport, AssignmentRule } from '@/composables/useAssignment'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'
import { useSeatRules } from '@/composables/useSeatRules'
import { useStudentData } from '@/composables/useStudentData'
import { useZoneData } from '@/composables/useZoneData'
import { createAssignmentPrecheck } from '@/utils/assignmentPrecheck'
import { openTextFile, saveTextFile } from '@/platform/files'
import type { Rule } from '@/types/models'

type WorkbenchPanel = 'run' | 'rules' | 'guide'
type MobileRulePage = 'list' | 'editor'

interface RuleListApi {
  focusRule: (ruleId: string) => Promise<boolean> | boolean
}

const props = withDefaults(defineProps<{
  visible?: boolean
  initialPanel?: WorkbenchPanel
  focusRuleId?: string
}>(), {
  visible: false,
  initialPanel: 'run',
  focusRuleId: ''
})

const emit = defineEmits<{ close: [] }>()
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
const activePanel = ref<WorkbenchPanel>('run')
const ruleListRef = ref<RuleListApi | null>(null)
const ruleBuilderRef = ref<unknown>(null)
const editingRuleId = ref('')
const creatingRule = ref(false)
const mobileRulePage = ref<MobileRulePage>('list')
const lastAssignmentReport = ref<AssignmentReport | null>(null)
const lastAssignmentDuration = ref(0)
const precheckResult = ref<ReturnType<typeof createAssignmentPrecheck> | null>(null)
const isCompactLayout = useMediaQuery(assignmentWorkbenchCompactMediaQuery)

const activeRules = computed(() => getActiveRules())
const activeRuleCount = computed(() => activeRules.value.length)
const availableSeatCount = computed(() => getAvailableSeats(seatConfig.value.guardSeats?.includeInAutoAssignment === true).length)
const editingRule = computed<Rule | null>(() => {
  if (!editingRuleId.value) return null
  return rules.value.find(rule => rule.id === editingRuleId.value) || null
})
const isEditingRule = computed(() => !!editingRule.value)
const isRuleEditorOpen = computed(() => creatingRule.value || isEditingRule.value)
const panelTabs = computed(() => [
  { key: 'run' as const, icon: Play, label: '执行排位', badge: null },
  { key: 'rules' as const, icon: Scale, label: '规则管理', badge: ruleCount.value > 0 ? ruleCount.value : null },
  { key: 'guide' as const, icon: BookOpen, label: '使用说明', badge: null }
])

const precheckRiskText = computed(() => {
  if (!precheckResult.value) return '未评估'
  if (precheckResult.value.risk === 'low') return '低'
  if (precheckResult.value.risk === 'medium') return '中'
  return '高'
})

let autoPrecheckTimer: number | null = null
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

const handleFocusRule = (item: { rule?: AssignmentRule } | null) => {
  const rule = item?.rule
  if (!rule?.id) return
  const ruleId = rule.id
  activePanel.value = 'rules'
  nextTick(() => {
    ruleListRef.value?.focusRule?.(ruleId)
  })
  success(`已定位规则：${renderRuleText(rule)}`)
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
    error(err instanceof Error ? err.message : '规则导入失败')
  }
}

const handleEditRule = (ruleId: string) => {
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
    if (isAssigning.value) cancelSmartAssignment()
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
  if (isAssigning.value) cancelSmartAssignment()
})
</script>

<style scoped>
.workbench-dialog {
  width: 100%;
  height: min(720px, calc(100vh - 180px));
  max-height: calc(100vh - 180px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.workbench-tabs {
  display: flex;
  gap: 8px;
  padding: 0 0 8px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.workbench-tab {
  flex: 0 0 auto;
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

.dialog-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 0 0;
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

.workbench-dialog.compact-layout {
  width: 100%;
  height: 100%;
  max-height: 100%;
}

.workbench-dialog.compact-layout .summary-strip {
  grid-template-columns: repeat(2, 1fr);
}

.workbench-dialog.compact-layout .workbench-tabs {
  overflow-x: auto;
}

.workbench-dialog.compact-layout .workbench-tab {
  min-height: 44px;
}

.workbench-dialog.compact-layout .rule-workbench {
  grid-template-columns: 1fr;
  height: 100%;
  min-height: 0;
}

.workbench-dialog.compact-layout .dialog-body.rules-body {
  overflow: hidden;
}

.workbench-dialog.compact-layout .rule-left-pane,
.workbench-dialog.compact-layout .editor-pane,
.workbench-dialog.compact-layout .empty-editor-pane {
  height: 100%;
  max-height: none;
  overflow-y: auto;
}

.workbench-dialog.compact-layout .rule-workbench.show-mobile-editor .rule-left-pane,
.workbench-dialog.compact-layout .rule-workbench:not(.show-mobile-editor) .editor-pane,
.workbench-dialog.compact-layout .rule-workbench:not(.show-mobile-editor) .empty-editor-pane {
  display: none;
}

.workbench-dialog.compact-layout .mobile-rule-editor-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 12px;
  flex-shrink: 0;
}

.workbench-dialog.compact-layout .mobile-rule-editor-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 16px;
}

.workbench-dialog.compact-layout.rule-mobile-editor-active .workbench-tabs {
  display: none;
}

.workbench-dialog.compact-layout.rule-mobile-editor-active {
  height: 100%;
}

.workbench-dialog.compact-layout.rule-mobile-editor-active .dialog-body {
  padding: 14px;
}

.dialog-footer.compact-layout {
  align-items: flex-start;
  flex-direction: column;
}

.dialog-footer.compact-layout .footer-actions {
  width: 100%;
}
</style>
