<template>
  <section class="mobile-tools-panel">
    <div class="tool-section">
      <h3>工作流</h3>
      <div class="tool-grid">
        <button type="button" @click="openWorkbenchDialog('seatConfig')">
          <Settings :size="18" stroke-width="2" />
          <span>座位配置</span>
        </button>
        <button type="button" @click="openWorkbenchDialog('shiftRotation')">
          <MoveDiagonal2 :size="18" stroke-width="2" />
          <span>位移轮换</span>
        </button>
        <button type="button" @click="openWorkbenchDialog('zoneRotation')">
          <RefreshCcw :size="18" stroke-width="2" />
          <span>选区轮换</span>
        </button>
        <button type="button" @click="openWorkbenchDialog('assignment')">
          <Shuffle :size="18" stroke-width="2" />
          <span>智能排位</span>
        </button>
        <button type="button" @click="openWorkbenchDialog('rules')">
          <Scale :size="18" stroke-width="2" />
          <span>规则管理</span>
        </button>
        <button type="button" @click="openExportPage">
          <FileOutput :size="18" stroke-width="2" />
          <span>导出图片</span>
        </button>
      </div>
    </div>

    <div class="tool-section">
      <h3>视图</h3>
      <div class="zoom-row">
        <button type="button" :disabled="scale <= MIN_SCALE" @click="zoomOut">
          <Minus :size="18" stroke-width="2" />
          <span>缩小</span>
        </button>
        <button type="button" class="zoom-value" @click="fitToViewport">
          {{ Math.round(scale * 100) }}%
        </button>
        <button type="button" :disabled="scale >= MAX_SCALE" @click="zoomIn">
          <Plus :size="18" stroke-width="2" />
          <span>放大</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
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
import { useEditMode } from '@/composables/useEditMode'
import { useZoom } from '@/composables/useZoom'
import { useZoneData } from '@/composables/useZoneData'
import { useZoneRotation } from '@/composables/useZoneRotation'

const router = useRouter()
const { openDialog, closeMobileDrawer, finishZoneEditSession } = useEditorWorkbench()
const { setMode, EditMode } = useEditMode()
const { scale, zoomIn, zoomOut, MIN_SCALE, MAX_SCALE, fitToViewport } = useZoom()
const { clearZoneSelection } = useZoneData()
const { clearEditingZone } = useZoneRotation()

const finishZoneEditing = () => {
  clearZoneSelection()
  clearEditingZone()
  setMode(EditMode.NORMAL)
  finishZoneEditSession()
}

const openWorkbenchDialog = (dialog) => {
  finishZoneEditing()
  openDialog(dialog)
}

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

.tool-grid button,
.zoom-row button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.tool-grid button:active,
.zoom-row button:active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-surface);
}

.tool-grid button:disabled,
.zoom-row button:disabled {
  color: var(--color-text-disabled);
  cursor: not-allowed;
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
