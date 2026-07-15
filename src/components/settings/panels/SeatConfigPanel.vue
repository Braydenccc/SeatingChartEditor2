<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">座位表配置</h3>
      <p class="section-desc">查看当前布局；修改会重新生成座位，因此统一在编辑器中显式确认。</p>

      <NDescriptions bordered label-placement="left" :column="isMobile ? 1 : 2" size="small">
        <NDescriptionsItem label="大组数量">{{ seatConfig.groupCount }}</NDescriptionsItem>
        <NDescriptionsItem label="普通座位">{{ totalSeatCount }}</NDescriptionsItem>
        <NDescriptionsItem label="讲台位置">{{ seatConfig.podiumPosition === 'top' ? '顶部' : '底部' }}</NDescriptionsItem>
        <NDescriptionsItem label="左右护法">{{ guardSummary }}</NDescriptionsItem>
      </NDescriptions>

      <NAlert class="warning-box" type="warning" :show-icon="true">
        应用新的座位配置会重新生成布局并清除现有座位分配，操作前会再次确认。
      </NAlert>

      <NButton class="action-button" type="primary" @click="openAdvancedConfig">
        <template #icon><Settings :size="18" /></template>
        打开座位配置
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { NAlert, NButton, NDescriptions, NDescriptionsItem } from 'naive-ui'
import { useRouter } from 'vue-router'
import { Settings } from 'lucide-vue-next'
import { useSeatChart } from '@/composables/useSeatChart'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'

const emit = defineEmits<{ 'update:visible': [value: boolean] }>()
const router = useRouter()
const isMobile = useMediaQuery('(max-width: 820px)')
const { seatConfig } = useSeatChart()
const { openDialog } = useEditorWorkbench()

const totalSeatCount = computed(() => (
  (seatConfig.value.groups || []).reduce((sum, group) => sum + Number(group.columns || 0) * Number(group.rows || 0), 0)
))
const guardSummary = computed(() => {
  const guard = seatConfig.value.guardSeats
  if (!guard?.enabled) return '未启用'
  const sides = [guard.leftEnabled && '左侧', guard.rightEnabled && '右侧'].filter(Boolean)
  return sides.length > 0 ? sides.join('、') : '已启用但未选择位置'
})

const openAdvancedConfig = async () => {
  await router.push('/editor')
  openDialog('seatConfig')
  emit('update:visible', false)
}
</script>

<style scoped>
.settings-panel { padding: 0; }
.setting-section { display: grid; gap: 18px; }
.section-title { margin: 0; color: var(--color-text-primary); font-size: 16px; }
.section-desc { margin: -10px 0 0; color: var(--color-text-secondary); font-size: 13px; }
.warning-box { margin-top: 2px; }
.action-button { justify-self: start; }
@media (max-width: 820px) { .action-button { width: 100%; min-height: 44px; } }
</style>
