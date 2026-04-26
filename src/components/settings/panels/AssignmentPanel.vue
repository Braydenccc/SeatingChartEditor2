<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">智能排位算法</h3>
      <p class="section-desc">基于模拟退火算法的自动座位分配系统</p>

      <div class="info-box">
        <Info :size="16" />
        <div class="info-content">
          <span>当前规则数量：<strong>{{ ruleCount }}</strong></span>
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
            <span class="feature-title">多维约束满足</span>
            <span class="feature-desc">同时满足吸引、排斥、位置偏好等规则</span>
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon">
            <TrendingUp :size="16" />
          </div>
          <div class="feature-content">
            <span class="feature-title">智能优化</span>
            <span class="feature-desc">优先处理违规学生，快速收敛</span>
          </div>
        </div>
      </div>

      <div class="hint-box">
        <p><strong>算法特性：</strong></p>
        <ul>
          <li>自动处理必需规则（REQUIRED 优先级）</li>
          <li>支持区域标签约束和空座位避让</li>
          <li>动态温度调整，避免局部最优</li>
          <li>实时进度显示，可随时中断</li>
        </ul>
      </div>

      <button class="action-button" @click="openRuleEditor">
        <Wand2 :size="18" />
        <div class="button-content">
          <span class="button-title">打开规则编辑器</span>
          <span class="button-desc">在侧边栏中配置排位规则</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Info, Zap, Target, TrendingUp, Wand2 } from 'lucide-vue-next'
import { useSeatRules } from '@/composables/useSeatRules'
import { useSidebar } from '@/composables/useSidebar'

const emit = defineEmits(['update:visible'])

const { rules } = useSeatRules()
const { setActiveTab } = useSidebar()

const ruleCount = computed(() => rules.value?.length || 0)

const openRuleEditor = () => {
  setActiveTab(3) // 切换到侧边栏的"排位"标签
  emit('update:visible', false) // 关闭设置对话框
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
  color: #1e293b;
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 20px 0;
}

.info-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #e0f2fe;
  border: 1px solid #0ea5e9;
  border-radius: 6px;
  color: #075985;
  font-size: 13px;
  margin-bottom: 20px;
}

.info-content strong {
  font-weight: 600;
  color: #0c4a6e;
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
  background: #f8f9fa;
  border-radius: 6px;
}

.feature-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #dbeafe;
  color: #2563eb;
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
  color: #1e293b;
}

.feature-desc {
  font-size: 12px;
  color: #64748b;
}

.hint-box {
  padding: 12px;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 13px;
  color: #475569;
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
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  color: #23587b;
  width: 100%;
}

.action-button:hover {
  border-color: #23587b;
  background: #f8fafb;
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(35, 88, 123, 0.1);
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
  color: #1e293b;
}

.button-desc {
  font-size: 12px;
  color: #64748b;
}
</style>
