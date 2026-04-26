<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">选区轮换</h3>
      <p class="section-desc">创建轮换组，手动触发座位在不同选区之间的循环或互换</p>

      <div class="info-box">
        <Info :size="16" />
        <div class="info-content">
          <span>当前轮换组数量：<strong>{{ rotationGroupCount }}</strong></span>
        </div>
      </div>

      <div class="feature-list">
        <div class="feature-item">
          <div class="feature-icon cycle">
            <RotateCw :size="16" />
          </div>
          <div class="feature-content">
            <span class="feature-title">循环模式</span>
            <span class="feature-desc">多个选区按顺序循环轮换（A→B→C→A）</span>
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon swap">
            <ArrowLeftRight :size="16" />
          </div>
          <div class="feature-content">
            <span class="feature-title">互换模式</span>
            <span class="feature-desc">两个选区之间直接对换（A↔B）</span>
          </div>
        </div>
      </div>

      <div class="hint-box">
        <p><strong>使用说明：</strong></p>
        <ul>
          <li>在侧边栏"轮换"标签中创建轮换组</li>
          <li>为每个组添加选区并框选座位</li>
          <li>点击"执行轮换"按钮手动触发</li>
          <li>支持循环模式（≥2个选区）和互换模式（2个选区）</li>
        </ul>
      </div>

      <button class="action-button" @click="openRotationConfig">
        <RotateCw :size="18" />
        <div class="button-content">
          <span class="button-title">打开轮换配置</span>
          <span class="button-desc">在侧边栏中管理轮换组和选区</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Info, RotateCw, ArrowLeftRight } from 'lucide-vue-next'
import { useZoneRotation } from '@/composables/useZoneRotation'
import { useSidebar } from '@/composables/useSidebar'

const emit = defineEmits(['update:visible'])

const { rotGroups } = useZoneRotation()
const { setActiveTab } = useSidebar()

const rotationGroupCount = computed(() => rotGroups.value?.length || 0)

const openRotationConfig = () => {
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
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-icon.cycle {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.feature-icon.swap {
  background: var(--color-danger-bg);
  color: var(--color-danger);
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
