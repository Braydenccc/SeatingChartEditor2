<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-overlay" @mousedown.self="close">
      <div class="modal-container">
      <div class="modal-header">
        <h3>座位规则 & 联系编辑</h3>
        <button class="close-btn" @click="close" aria-label="关闭">
          <X :size="18" stroke-width="2" />
        </button>
      </div>

      <!-- tab 导航 -->
      <div class="tab-bar">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <component :is="tab.icon" :size="15" stroke-width="1.8" />
          <span class="tab-label">{{ tab.label }}</span>
          <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
        </button>
      </div>

      <div class="modal-body">
        <!-- Tab 1: 规则总览 -->
        <div v-if="activeTab === 'rules'" class="tab-content">
          <div class="rule-workbench">
            <section class="workbench-pane list-pane">
              <RuleList
                ref="ruleListRef"
                :focus-rule-id="focusRuleId"
                @export="handleExportRules"
                @import="handleImportRules"
                @edit="handleEditRule"
              />
            </section>
            <section class="workbench-pane editor-pane">
              <RuleBuilder
                ref="ruleBuilderRef"
                :editing-rule="editingRule"
                @added="onRuleAdded"
                @cancel-edit="editingRuleId = ''"
              />
            </section>
            <aside class="workbench-pane quick-pane">
              <div class="quick-panel">
                <div class="quick-panel-head">
                  <Wand2 :size="16" />
                  <div>
                    <h4>快捷方案</h4>
                    <p>先选场景，再在中间补对象和参数</p>
                  </div>
                </div>
                <div class="quick-sections">
                  <section
                    v-for="group in quickTemplateGroups"
                    :key="group.title"
                    class="quick-section"
                  >
                    <div class="quick-section-title">{{ group.title }}</div>
                    <button
                      v-for="option in group.options"
                      :key="option.key"
                      class="quick-option"
                      @click="applyTemplate(option.key)"
                    >
                      <span class="quick-option-main">
                        <span>{{ option.title }}</span>
                      </span>
                      <span class="quick-option-desc">{{ option.desc }}</span>
                    </button>
                  </section>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <!-- Tab 2: 使用说明 -->
        <div v-if="activeTab === 'personal'" class="tab-content">
          <RuleUsageGuide>
            <template #action-button>
              <button class="tip-action-btn" @click="activeTab = 'rules'">去规则总览创建规则</button>
            </template>
          </RuleUsageGuide>
        </div>

      </div>

      <div class="modal-footer">
        <span class="footer-stats">
          <span>{{ ruleCount }} 条规则</span>
        </span>
        <button class="btn-secondary" @click="close">关闭</button>
      </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { X, List, Users, Wand2 } from 'lucide-vue-next'
import { useSeatRules } from '@/composables/useSeatRules'
import { useLogger } from '@/composables/useLogger'
import RuleBuilder from '@/components/rule/RuleBuilder.vue'
import RuleList from '@/components/rule/RuleList.vue'
import RuleUsageGuide from '@/components/docs/RuleUsageGuide.vue'
import { openTextFile, saveTextFile } from '@/platform/files'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  initialTab: {
    type: String,
    default: 'rules'
  },
  focusRuleId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])

const { rules, ruleCount, exportRules, importRules } = useSeatRules()
const { success, warning, error } = useLogger()
const ruleListRef = ref(null)
const ruleBuilderRef = ref(null)

// ==================== Tab 状态 ====================
const activeTab = ref('rules')
const editingRuleId = ref('')
const editingRule = computed(() => {
  if (!editingRuleId.value) return null
  return rules.value.find(r => r.id === editingRuleId.value) || null
})
const tabs = computed(() => [
  { key: 'rules', icon: List, label: '规则总览', badge: ruleCount.value > 0 ? ruleCount.value : null },
  { key: 'personal', icon: Users, label: '使用说明', badge: null }
])

const quickTemplateGroups = [
  {
    title: '位置照顾',
    options: [
      {
        key: 'front-row',
        title: '前排优先',
        desc: '给视力、听课或需要关注的学生限定前几排。'
      },
      {
        key: 'avoid-window',
        title: '避开窗边',
        desc: '减少靠墙或窗边位置对特定学生的影响。'
      }
    ]
  },
  {
    title: '同桌关系',
    options: [
      {
        key: 'deskmates',
        title: '安排同桌',
        desc: '把两个指定学生绑定在同一张桌附近。'
      },
      {
        key: 'avoid-deskmates',
        title: '禁止同桌',
        desc: '避免两个学生成为同桌，适合冲突或分心组合。'
      },
      {
        key: 'keep-distance',
        title: '保持距离',
        desc: '让指定学生之间至少隔开一段座位距离。'
      }
    ]
  },
  {
    title: '全班均衡',
    options: [
      {
        key: 'spread-group',
        title: '标签分散',
        desc: '把同标签学生尽量分散，避免集中在同一区域。'
      },
      {
        key: 'height-gradient',
        title: '身高前后梯度',
        desc: '按身高形成前后梯度，默认低值靠前。'
      },
      {
        key: 'score-balance',
        title: '成绩大组均衡',
        desc: '让各大组平均成绩尽量接近。'
      },
      {
        key: 'score-bands',
        title: '成绩分层分散',
        desc: '按成绩分层后均匀分到各组。'
      }
    ]
  }
]

// 当弹窗打开时，跳转到 initialTab 指定的 Tab
watch(() => props.visible, (visible) => {
  if (visible && props.initialTab) {
    activeTab.value = props.initialTab
  }
})

// 导出规则
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

const onRuleAdded = () => {
  editingRuleId.value = ''
}

const handleEditRule = (ruleId) => {
  editingRuleId.value = ruleId
}

const applyTemplate = (key) => {
  ruleBuilderRef.value?.applyQuickTemplate?.(key)
}

// 当模态框关闭时重置 tab
watch(() => props.visible, (visible) => {
  if (visible && props.focusRuleId) {
    activeTab.value = 'rules'
    nextTick(() => {
      ruleListRef.value?.focusRule?.(props.focusRuleId)
    })
  }
})

// 关闭模态框
const close = () => {
  editingRuleId.value = ''
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-container {
  background: var(--color-dialog-bg);
  border-radius: 8px;
  box-shadow: 0 12px 48px var(--shadow-lg), 0 0 0 1px var(--color-border);
  width: 95%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

/* Modal transition styles */
.modal-enter-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-container {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from {
  opacity: 0;
}

.modal-enter-from .modal-container {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

.modal-leave-active {
  transition: opacity 0.16s ease;
}

.modal-leave-active .modal-container {
  transition: all 0.2s ease;
}

.modal-leave-to {
  opacity: 0;
}

.modal-leave-to .modal-container {
  opacity: 0;
  transform: scale(0.95);
}

/* ==================== Tab 导航 ==================== */
.tab-bar {
  display: flex;
  gap: 12px;
  border-bottom: 1px solid var(--color-border-light);
  background: var(--color-bg-subtle);
  padding: 0 24px;
  flex-shrink: 0;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 0;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary); /* Darkened for readability */
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab-btn::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-primary);
  border-radius: 3px 3px 0 0;
  transform: scaleX(0);
  transition: transform 0.2s;
}

.tab-btn:hover { color: var(--color-text-primary); }
.tab-btn.active { color: var(--color-primary); font-weight: 600; }
.tab-btn.active::after { transform: scaleX(1); }

.tab-badge {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 700;
  min-width: 16px;
  text-align: center;
  box-shadow: 0 2px 4px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

/* .tab-icon: size controlled by :size prop on <component :is> */

/* ==================== Tab 内容 ==================== */
.tab-content {
  min-height: 0;
}

.rule-workbench {
  display: grid;
  grid-template-columns: minmax(280px, 0.95fr) minmax(380px, 1.2fr) minmax(260px, 0.85fr);
  gap: 14px;
  align-items: start;
}

.workbench-pane {
  min-width: 0;
}

.list-pane,
.editor-pane {
  max-height: calc(90vh - 210px);
  overflow: auto;
}

.quick-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: visible;
}

.quick-panel {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  padding: 12px;
}

.quick-panel-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--color-primary);
  margin-bottom: 12px;
}

.quick-panel-head h4 {
  margin: 0;
  color: var(--color-text-primary);
}

.quick-panel-head p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.quick-sections {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.quick-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-section-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.quick-option {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  cursor: pointer;
  padding: 9px 10px;
  text-align: left;
  transition: all 0.2s ease;
}

.quick-option:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-subtle);
  box-shadow: 0 2px 8px var(--shadow-sm);
}

.quick-option-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
}

.quick-option-desc {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.tab-divider {
  height: 2px;
  background: var(--color-border);
  border-radius: 1px;
}

/* 占位提示 */
.placeholder-tip {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 24px;
  background: var(--color-bg-subtle);
  border-radius: 12px;
  border: 2px dashed var(--color-border);
}

.tip-title {
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tip-desc {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary); /* Darkened for readability */
  line-height: 1.6;
}

.tip-actions {
  margin-top: 12px;
}

.tip-action-btn {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-surface);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.tip-action-btn {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-surface);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.tip-action-btn:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
}


.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 2px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--color-bg-secondary);
  border-radius: 50%;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--color-border);
  color: var(--color-text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.modal-body::-webkit-scrollbar {
  width: 6px;
}

.modal-body::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}

.modal-body::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

.modal-body h4 {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-primary);
}

.relation-count {
  font-weight: 400;
  color: var(--color-text-disabled);
  font-size: 13px;
}

/* ==================== 关系列表 ==================== */
.relation-list {
  margin-bottom: 24px;
}

.empty-relation {
  text-align: center;
  padding: 20px;
  color: var(--color-text-disabled);
  font-size: 14px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  border: 1px dashed var(--color-border);
}

.relation-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  margin-bottom: 6px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--rel-color);
  border-radius: 6px;
  transition: all 0.15s;
  gap: 10px;
}

.relation-item:hover {
  background: var(--color-bg-subtle);
  box-shadow: 0 1px 4px var(--shadow-sm);
}

.relation-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-inverse);
  white-space: nowrap;
  flex-shrink: 0;
}

.relation-students {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.student-name-tag {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.relation-sep {
  font-size: 13px;
  color: var(--color-text-disabled);
  flex-shrink: 0;
}

.relation-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.strength-pill {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.distance-info {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.delete-relation-btn {
  width: 26px;
  height: 26px;
  background: transparent;
  color: var(--color-text-disabled);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
}

.delete-relation-btn:hover {
  background: var(--color-danger-bg);
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.delete-relation-btn.confirming {
  background: var(--color-danger) !important;
  color: var(--color-surface) !important;
  border-color: var(--color-danger) !important;
  font-size: 11px;
}

/* ==================== 添加表单 ==================== */
.add-relation-form {
  padding-top: 20px;
  border-top: 2px solid var(--color-border);
}

/* 关系类型卡片 */
.type-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 6px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
  background: var(--color-surface);
  gap: 4px;
}

.type-card:hover {
  border-color: var(--card-color);
  background: color-mix(in srgb, var(--card-color) 5%, var(--color-surface));
}

.type-card.active {
  border-color: var(--card-color);
  background: color-mix(in srgb, var(--card-color) 10%, var(--color-surface));
  box-shadow: 0 0 0 1px var(--card-color);
}

.type-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--card-color);
  line-height: 1;
}

.type-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.type-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.type-desc {
  font-size: 10px;
  color: var(--color-text-disabled);
  line-height: 1.3;
}

/* 学生选择行 */
.student-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 16px;
}

.student-select-wrapper {
  flex: 1;
}

.student-select-wrapper label {
  display: block;
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
  font-weight: 500;
}

.relation-arrow {
  font-size: 20px;
  font-weight: 700;
  padding-bottom: 8px;
  flex-shrink: 0;
}

.student-select {
  width: 100%;
  padding: 9px 10px;
  border: 2px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.student-select:focus {
  border-color: var(--color-primary);
}

/* 高级选项 */
.advanced-options {
  background: var(--color-bg-hover);
  padding: 14px;
  border-radius: 8px;
  margin-bottom: 14px;
}

.option-row {
  margin-bottom: 10px;
}

.option-row:last-child {
  margin-bottom: 0;
}

.option-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

/* 优先级选择器 */
.strength-selector {
  display: flex;
  gap: 6px;
}

.strength-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 6px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  background: var(--color-surface);
  gap: 2px;
}

.strength-option input[type="radio"] {
  display: none;
}

.strength-option.active {
  color: var(--color-text-inverse);
  border-color: transparent;
}

.strength-option.active .strength-label,
.strength-option.active .strength-desc {
  color: var(--color-text-inverse);
}

.strength-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.strength-option.disabled.active {
  opacity: 1;
}

.strength-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.strength-desc {
  font-size: 10px;
  color: var(--color-text-disabled);
  line-height: 1.2;
}

.hard-hint {
  display: block;
  font-size: 11px;
  color: var(--color-text-disabled);
  margin-top: 6px;
  font-style: italic;
}

/* 距离选择 */
.distance-select {
  padding: 6px 10px;
  border: 2px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.distance-select:focus {
  border-color: var(--color-primary);
}

.distance-hint {
  font-size: 11px;
  color: var(--color-text-disabled);
  margin-left: 8px;
}

/* 冲突警告 */
.conflict-warning {
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--color-warning-hover);
}

/* 添加按钮 */
.add-relation-btn {
  width: 100%;
  padding: 11px;
  color: var(--color-surface);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
  background: var(--color-text-disabled);
}

.add-relation-btn:hover:not(:disabled) {
  filter: brightness(0.9);
  transform: translateY(-1px);
}

.add-relation-btn:disabled {
  background: var(--color-text-disabled) !important;
  cursor: not-allowed;
  transform: none !important;
}

/* ==================== Modal Footer ==================== */
.modal-footer {
  padding: 14px 24px;
  border-top: 2px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-stats {
  font-size: 12px;
  color: var(--color-text-disabled);
}

.btn-secondary {
  padding: 9px 18px;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--color-border);
}

/* ==================== 响应式 ==================== */
@media (max-width: 768px) {
  .modal-container {
    width: 95%;
    max-height: 90vh;
  }

  .rule-workbench {
    grid-template-columns: 1fr;
  }

  .list-pane,
  .editor-pane,
  .quick-pane {
    max-height: none;
    overflow: visible;
  }

  .modal-header {
    padding: 16px 18px;
  }

  .modal-header h3 {
    font-size: 18px;
  }

  .modal-body {
    padding: 16px 18px;
  }

  .type-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .student-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .relation-arrow {
    text-align: center;
    padding: 0;
  }

  .student-select {
    min-height: 44px;
    font-size: 15px;
    padding: 10px 12px;
  }

  .strength-selector {
    flex-wrap: wrap;
  }

  .strength-option {
    min-height: 44px;
  }

  .relation-item {
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 12px;
    min-height: 44px;
  }

  .relation-students {
    width: 100%;
    order: 1;
  }

  .relation-meta {
    order: 2;
  }

  .delete-relation-btn {
    order: 3;
    margin-left: auto;
    width: 32px;
    height: 32px;
  }

  .add-relation-btn {
    min-height: 44px;
    font-size: 15px;
  }

  .distance-select {
    min-height: 44px;
    font-size: 15px;
  }

  .modal-footer {
    padding: 14px 18px;
    padding-bottom: calc(14px + env(safe-area-inset-bottom, 0));
  }
}

@media (max-width: 480px) {
  .modal-header h3 {
    font-size: 16px;
  }

  .modal-body h4 {
    font-size: 14px;
  }

  .type-card {
    padding: 10px 4px;
  }

  .type-icon {
    font-size: 18px;
  }

  .type-label {
    font-size: 12px;
  }

  .type-desc {
    font-size: 9px;
  }

  .strength-option {
    padding: 6px 4px;
  }

  .strength-label {
    font-size: 13px;
  }

  .option-row .distance-select,
  .option-row .distance-hint {
    display: inline;
  }
}
</style>
