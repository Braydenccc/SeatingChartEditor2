<template>
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
        <div class="mode-switch-bar">
          <div class="mode-switch-left">
            <button
              class="mode-btn"
              :class="{ active: editorMode === 'quick' }"
              @click="editorMode = 'quick'"
            >
              快速模式
            </button>
            <button
              class="mode-btn"
              :class="{ active: editorMode === 'pro' }"
              @click="editorMode = 'pro'"
            >
              专业模式
            </button>
          </div>
          <span class="mode-hint">
            {{ editorMode === 'quick' ? '推荐：按场景快速建规则' : '高级：按对象和参数精细控制' }}
          </span>
        </div>

        <!-- Tab 1: 规则总览 -->
        <div v-show="activeTab === 'rules'" class="tab-content">
          <RuleList
            ref="ruleListRef"
            :focus-rule-id="focusRuleId"
            @export="handleExportRules"
            @import="handleImportRules"
            @edit="handleEditRule"
          />
          <div class="tab-divider"></div>
          <RuleBuilder
            :mode="editorMode"
            :editing-rule="editingRule"
            @added="onRuleAdded"
            @cancel-edit="editingRuleId = ''"
          />
        </div>

        <!-- Tab 2: 对象类型说明（目前展示占位符，内容在 rules tab 中） -->
        <div v-show="activeTab === 'personal'" class="tab-content">
          <div class="placeholder-tip">
            <Users :size="32" color="#94a3b8" stroke-width="1.5" />
            <div>
              <p class="tip-title">对象类型说明</p>
              <p class="tip-desc">个人对象：针对单个学生；标签对象：针对某类学生（如“住宿”标签）。请在「规则总览」中创建并组合使用。</p>
              <div class="tip-actions">
                <button class="tip-action-btn" @click="activeTab = 'rules'">去规则总览创建规则</button>
              </div>
            </div>
          </div>
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
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { X, List, Users } from 'lucide-vue-next'
import { useSeatRules } from '@/composables/useSeatRules'
import { useLogger } from '@/composables/useLogger'
import RuleBuilder from '@/components/rule/RuleBuilder.vue'
import RuleList from '@/components/rule/RuleList.vue'

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

// ==================== Tab 状态 ====================
const activeTab = ref('rules')
const editorMode = ref('quick')
const editingRuleId = ref('')
const editingRule = computed(() => {
  if (!editingRuleId.value) return null
  return rules.value.find(r => r.id === editingRuleId.value) || null
})
const tabs = computed(() => [
  { key: 'rules', icon: List, label: '规则总览', badge: ruleCount.value > 0 ? ruleCount.value : null },
  { key: 'personal', icon: Users, label: '对象说明', badge: null }
])

// 当弹窗打开时，跳转到 initialTab 指定的 Tab
watch(() => props.visible, (visible) => {
  if (visible && props.initialTab) {
    activeTab.value = props.initialTab
  }
})

// 导出规则
const handleExportRules = () => {
  const json = exportRules()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `seat_rules_${new Date().toISOString().slice(0,10)}.json`
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

const onRuleAdded = () => {
  editingRuleId.value = ''
}

const handleEditRule = (ruleId) => {
  editingRuleId.value = ruleId
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-container {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
  width: 95%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: modal-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modal-pop {
  0% { transform: scale(0.95); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* ==================== Tab 导航 ==================== */
.tab-bar {
  display: flex;
  gap: 12px;
  border-bottom: 1px solid #eef2f6;
  background: rgba(248, 250, 252, 0.5);
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
  color: #475569; /* Darkened for readability */
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

.tab-btn:hover { color: #334155; }
.tab-btn.active { color: var(--color-primary); font-weight: 600; }
.tab-btn.active::after { transform: scaleX(1); }

.tab-badge {
  background: var(--color-primary);
  color: white;
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 700;
  min-width: 16px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(35, 88, 123, 0.2);
}

/* .tab-icon: size controlled by :size prop on <component :is> */

/* ==================== Tab 内容 ==================== */
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.mode-switch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 12px;
  min-height: 44px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.mode-switch-left {
  display: flex;
  gap: 8px;
  align-items: center;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #dbe3ea;
  background: white;
  color: #334155;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  min-height: 30px;
  padding: 0 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.mode-btn:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
}

.mode-btn.active {
  background: #23587b;
  border-color: #23587b;
  color: white;
  box-shadow: 0 2px 8px rgba(35, 88, 123, 0.28);
}

.mode-hint {
  font-size: 12px;
  color: #64748b;
  line-height: 1.2;
  display: inline-flex;
  align-items: center;
  min-height: 30px;
}

.tab-divider {
  height: 2px;
  background: linear-gradient(to right, #e2e8f0, transparent);
  border-radius: 1px;
}

/* 占位提示 */
.placeholder-tip {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 24px;
  background: #f8fafc;
  border-radius: 12px;
  border: 2px dashed #e2e8f0;
}

.tip-title {
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 600;
  color: #334155;
}

.tip-desc {
  margin: 0;
  font-size: 13px;
  color: #475569; /* Darkened for readability */
  line-height: 1.6;
}

.tip-actions {
  margin-top: 12px;
}

.tip-action-btn {
  border: 1px solid #23587b;
  background: #23587b;
  color: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.tip-action-btn:hover {
  background: #2d6a94;
  border-color: #2d6a94;
}


.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 2px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: -0.01em;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #f0f0f0;
  border-radius: 50%;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #e0e0e0;
  color: #333;
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
  background: #f1f1f1;
}

.modal-body::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.modal-body h4 {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #23587b;
}

.relation-count {
  font-weight: 400;
  color: #999;
  font-size: 13px;
}

/* ==================== 关系列表 ==================== */
.relation-list {
  margin-bottom: 24px;
}

.empty-relation {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 14px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px dashed #e0e0e0;
}

.relation-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  margin-bottom: 6px;
  background: #fafafa;
  border: 1px solid #eee;
  border-left: 3px solid var(--rel-color);
  border-radius: 6px;
  transition: all 0.15s;
  gap: 10px;
}

.relation-item:hover {
  background: #f0f4f8;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.relation-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: white;
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
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.relation-sep {
  font-size: 13px;
  color: #ccc;
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
  color: #888;
  white-space: nowrap;
}

.delete-relation-btn {
  width: 26px;
  height: 26px;
  background: transparent;
  color: #ccc;
  border: 1px solid #e0e0e0;
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
  background: #fee2e2;
  color: #dc2626;
  border-color: #dc2626;
}

.delete-relation-btn.confirming {
  background: #fff7ed !important;
  color: #ea580c !important;
  border-color: #ea580c !important;
  animation: pulse-rel 0.6s ease-in-out infinite;
  font-size: 11px;
}

@keyframes pulse-rel {

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.15);
  }
}

/* ==================== 添加表单 ==================== */
.add-relation-form {
  padding-top: 20px;
  border-top: 2px solid #e0e0e0;
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
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
  background: white;
  gap: 4px;
}

.type-card:hover {
  border-color: var(--card-color);
  background: color-mix(in srgb, var(--card-color) 5%, #fff);
}

.type-card.active {
  border-color: var(--card-color);
  background: color-mix(in srgb, var(--card-color) 10%, #fff);
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
  color: #333;
}

.type-desc {
  font-size: 10px;
  color: #999;
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
  color: #888;
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
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.student-select:focus {
  border-color: #23587b;
}

/* 高级选项 */
.advanced-options {
  background: #f8f9fa;
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
  color: #555;
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
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  background: white;
  gap: 2px;
}

.strength-option input[type="radio"] {
  display: none;
}

.strength-option.active {
  color: white;
  border-color: transparent;
}

.strength-option.active .strength-label,
.strength-option.active .strength-desc {
  color: white;
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
  color: #333;
  line-height: 1.2;
}

.strength-desc {
  font-size: 10px;
  color: #999;
  line-height: 1.2;
}

.hard-hint {
  display: block;
  font-size: 11px;
  color: #999;
  margin-top: 6px;
  font-style: italic;
}

/* 距离选择 */
.distance-select {
  padding: 6px 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.distance-select:focus {
  border-color: #23587b;
}

.distance-hint {
  font-size: 11px;
  color: #999;
  margin-left: 8px;
}

/* 冲突警告 */
.conflict-warning {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #856404;
}

/* 添加按钮 */
.add-relation-btn {
  width: 100%;
  padding: 11px;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
  background: #ccc;
}

.add-relation-btn:hover:not(:disabled) {
  filter: brightness(0.9);
  transform: translateY(-1px);
}

.add-relation-btn:disabled {
  background: #ccc !important;
  cursor: not-allowed;
  transform: none !important;
}

/* ==================== Modal Footer ==================== */
.modal-footer {
  padding: 14px 24px;
  border-top: 2px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-stats {
  font-size: 12px;
  color: #999;
}

.btn-secondary {
  padding: 9px 18px;
  background: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

/* ==================== 响应式 ==================== */
@media (max-width: 768px) {
  .modal-container {
    width: 95%;
    max-height: 90vh;
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
