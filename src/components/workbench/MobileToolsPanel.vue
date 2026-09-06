<template>
  <section class="mobile-tools-panel">
    <div class="tool-section">
      <h3>工作流</h3>
      <div class="tool-grid">
        <NButton class="tool-action" attr-type="button" secondary block @click="openWorkbenchDialog('seatConfig')">
          <template #icon><Settings :size="18" stroke-width="2" /></template>
          <span>座位配置</span>
        </NButton>
        <NButton class="tool-action" attr-type="button" secondary block @click="openWorkbenchDialog('shiftRotation')">
          <template #icon><MoveDiagonal2 :size="18" stroke-width="2" /></template>
          <span>位移轮换</span>
        </NButton>
        <NButton class="tool-action" attr-type="button" secondary block @click="openWorkbenchDialog('zoneRotation')">
          <template #icon><RefreshCcw :size="18" stroke-width="2" /></template>
          <span>选区轮换</span>
        </NButton>
        <NButton class="tool-action" attr-type="button" secondary block @click="openWorkbenchDialog('assignment')">
          <template #icon><Shuffle :size="18" stroke-width="2" /></template>
          <span>智能排位</span>
        </NButton>
        <NButton class="tool-action" attr-type="button" secondary block @click="openWorkbenchDialog('rules')">
          <template #icon><Scale :size="18" stroke-width="2" /></template>
          <span>规则管理</span>
        </NButton>
        <NButton class="tool-action" attr-type="button" secondary block @click="openExportPage">
          <template #icon><FileOutput :size="18" stroke-width="2" /></template>
          <span>导出图片</span>
        </NButton>
      </div>
    </div>

    <div class="tool-section">
      <h3>视图</h3>
      <div class="zoom-row">
        <NButton class="tool-action" attr-type="button" secondary :disabled="scale <= MIN_SCALE" @click="zoomOut">
          <template #icon><Minus :size="18" stroke-width="2" /></template>
          <span>缩小</span>
        </NButton>
        <NButton attr-type="button" class="tool-action zoom-value" type="primary" secondary @click="fitToViewport">
          {{ Math.round(scale * 100) }}%
        </NButton>
        <NButton class="tool-action" attr-type="button" secondary :disabled="scale >= MAX_SCALE" @click="zoomIn">
          <template #icon><Plus :size="18" stroke-width="2" /></template>
          <span>放大</span>
        </NButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { useRouter } from 'vue-router'
import {
  FileOutput,
  Minus,
  MoveDiagonal2,
  Plus,
  RefreshCcw,
  Scale,
  Settings,
  Shuffle
} from 'lucide-vue-next'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useEditorCommands } from '@/composables/useEditorCommands'
import { useZoom } from '@/composables/useZoom'
import type { WorkbenchDialog } from '@/composables/useEditorWorkbench'

const router = useRouter()
const { closeMobileDrawer } = useEditorWorkbench()
const { finishZoneEditing, openWorkbenchDialog } = useEditorCommands()
const { scale, zoomIn, zoomOut, MIN_SCALE, MAX_SCALE, fitToViewport } = useZoom()

const openDialog = (dialog: Exclude<WorkbenchDialog, null>) => openWorkbenchDialog(dialog)

const openExportPage = () => {
  finishZoneEditing()
  closeMobileDrawer()
  router.push({ path: '/export', query: { tab: 'image' } })
}
</script>

<style scoped>
.mobile-tools-panel {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 14px;
  background: var(--color-surface);
}

.tool-section + .tool-section {
  margin-top: 18px;
}

.tool-section h3 {
  margin: 0 0 10px;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 650;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tool-action {
  min-height: 44px;
  font-size: 13px;
  font-weight: 600;
}

.zoom-row {
  display: grid;
  grid-template-columns: 1fr 72px 1fr;
  gap: 10px;
}

.zoom-row .zoom-value {
  font-variant-numeric: tabular-nums;
  color: var(--color-primary);
}
</style>
