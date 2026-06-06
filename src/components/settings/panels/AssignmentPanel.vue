<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">智能排位算法</h3>
      <p class="section-desc">基于模拟退火算法的自动座位分配系统</p>

      <div class="info-box">
        <Info :size="16" />
        <div class="info-content">
          <span>当前规则数量：<strong>{{ ruleCount }}</strong></span>
          <span>数值属性：<strong>{{ attributeCount }}</strong></span>
          <span>缺失数值：<strong>{{ missingSummary.missingCount }}</strong></span>
        </div>
      </div>

      <div class="feature-list">
        <div class="feature-item">
          <div class="feature-icon">
            <Zap :size="16" />
          </div>
          <div class="feature-content">
            <span class="feature-title">模拟退火算法</span>
            <span class="feature-desc">启发式搜索最优座位布局</span>
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon">
            <Target :size="16" />
          </div>
          <div class="feature-content">
            <span class="feature-title">规则工作台</span>
            <span class="feature-desc">集中管理对象、位置、关系和数值参考规则</span>
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon">
            <TrendingUp :size="16" />
          </div>
          <div class="feature-content">
            <span class="feature-title">数值参考</span>
            <span class="feature-desc">支持身高梯度、成绩均衡和分层分散</span>
          </div>
        </div>
      </div>

      <div class="hint-box">
        <p><strong>算法特性：</strong></p>
        <ul>
          <li>自动处理必需规则（REQUIRED 优先级）</li>
          <li>支持区域、标签、全体学生和数值属性约束</li>
          <li>动态温度调整，避免局部最优</li>
          <li>缺失数值会跳过对应规则，不阻断排位</li>
        </ul>
      </div>

      <button class="action-button" @click="openRuleEditor">
          <Wand2 :size="18" />
          <div class="button-content">
            <span class="button-title">打开规则编辑器</span>
            <span class="button-desc">在编辑器工作台中配置排位规则</span>
          </div>
        </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Info, Zap, Target, TrendingUp, Wand2 } from 'lucide-vue-next'
import { useSeatRules } from '@/composables/useSeatRules'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'

const emit = defineEmits(['update:visible'])
const router = useRouter()

const { rules } = useSeatRules()
const { enabledAttributeDefinitions, getMissingValueSummary } = useStudentAttributes()
const { openDialog } = useEditorWorkbench()

const ruleCount = computed(() => rules.value?.length || 0)
const attributeCount = computed(() => enabledAttributeDefinitions.value.length)
const missingSummary = computed(() => getMissingValueSummary())

const openRuleEditor = async () => {
  await router.push('/editor')
  openDialog('rules')
  emit('update:visible', false)
}
</script>

<style scoped>
.settings-panel {
  padding: 0;
}

.setting-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 20px 0;
}

.info-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-info-bg);
  border: 1px solid var(--color-info);
  border-radius: 6px;
  color: var(--color-info);
  font-size: 13px;
  margin-bottom: 20px;
}

.info-content strong {
  font-weight: 600;
  color: var(--color-info);
}

.info-content {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-secondary);
  border-radius: 6px;
}

.feature-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--color-info-bg);
  color: var(--color-info);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feature-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.feature-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.hint-box {
  padding: 12px;
  background: var(--color-bg-secondary);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 20px;
}

.hint-box p {
  margin: 0 0 8px 0;
}

.hint-box ul {
  margin: 0;
  padding-left: 20px;
}

.hint-box li {
  margin-bottom: 4px;
  line-height: 1.5;
}

.hint-box li:last-child {
  margin-bottom: 0;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  color: var(--color-primary);
  width: 100%;
}

.action-button:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-secondary);
  transform: translateX(4px);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.button-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.button-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.button-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
