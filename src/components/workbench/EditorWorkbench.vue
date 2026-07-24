<template>
  <div
    class="editor-workbench"
    :class="{
      'zone-editing': zoneEditSession,
      'seat-fullscreen': isSeatFullscreen,
      'fullscreen-landscape': isFullscreenLandscape
    }"
  >
    <main class="chart-region">
      <SeatChart />
    </main>

    <aside v-if="!zoneEditSession" class="student-rail">
      <StudentPoolPanel />
    </aside>

    <aside class="context-rail">
      <div v-if="!zoneEditSession" class="rail-tabs">
        <NTabs :value="rightRailTab" type="segment" size="small" @update:value="setRightRailTab">
          <NTabPane name="selection" tab="上下文" />
          <NTabPane name="candidates" tab="学生" />
          <NTabPane name="activity" tab="状态" />
        </NTabs>
      </div>
      <div class="rail-content">
        <ZoneEditContextPanel v-if="zoneEditSession" />
        <ContextInspector v-else-if="isWideDesktop || rightRailTab === 'selection' || (isMobileWorkbench && rightRailTab === 'candidates')" />
        <StudentPoolPanel v-else-if="rightRailTab === 'candidates'" />
        <ActivityPanel v-else />
      </div>
    </aside>

    <EditorToolDock class="tool-dock" />

    <div
      v-if="showMobileDropOutZone"
      class="seat-touch-drop-out-zone"
      aria-label="拖到此处移出学生"
    >
      <LogOut :size="18" stroke-width="2.2" />
      <span>拖到此处移出学生</span>
    </div>

    <NDrawer
      :show="mobileDrawerVisible"
      to=".chart-region"
      placement="bottom"
      height="min(68dvh, calc(100% - 8px))"
      display-directive="show"
      :z-index="999"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="mobileDrawerTitleId"
      @mask-click="closeMobileSheet"
      @esc="closeMobileSheet"
      @update:show="value => !value && mobileDrawerVisible && closeMobileSheet()"
    >
      <NDrawerContent
        closable
        :body-style="{ minHeight: 0, overflow: 'hidden' }"
        :body-content-style="{ height: '100%', padding: 0, overflow: 'hidden' }"
        @close="closeMobileDrawer"
      >
        <template #header>
          <strong
          :id="mobileDrawerTitleId"
          class="mobile-drawer-title"
          @pointerdown="handleDrawerPointerDown"
          @pointermove="handleDrawerPointerMove"
          @pointerup="handleDrawerPointerUp"
          @pointercancel="handleDrawerPointerCancel"
        >
            {{ mobileDrawerTitle }}
          </strong>
        </template>
        <div class="mobile-drawer-body">
          <ZoneEditContextPanel v-if="zoneEditSession" />
          <ContextInspector v-else-if="mobileSheet === 'context'" />
          <StudentPoolPanel v-else-if="mobileSheet === 'candidates'" />
          <MobileToolsPanel v-else-if="mobileSheet === 'tools'" />
        </div>
      </NDrawerContent>
    </NDrawer>

    <WorkbenchDialogs />
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { mobileWorkbenchMediaQuery } from '@/constants/layout'
import { NDrawer, NDrawerContent, NTabPane, NTabs } from 'naive-ui'
import { LogOut } from 'lucide-vue-next'
import SeatChart from '@/components/seat/SeatChart.vue'
import ActivityPanel from './ActivityPanel.vue'
import ContextInspector from './ContextInspector.vue'
import EditorToolDock from './EditorToolDock.vue'
import MobileToolsPanel from './MobileToolsPanel.vue'
import StudentPoolPanel from './StudentPoolPanel.vue'
import WorkbenchDialogs from './WorkbenchDialogs.vue'
import ZoneEditContextPanel from './ZoneEditContextPanel.vue'
import { useDragState } from '@/composables/useDragState'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'

const isWideDesktop = useMediaQuery('(min-width: 1440px)')
const mobileDrawerTitleId = `${useId()}-mobile-drawer-title`
const isMobileWorkbench = useMediaQuery(mobileWorkbenchMediaQuery)
const isLandscape = useMediaQuery('(orientation: landscape)')
const {
  rightRailTab,
  mobileDrawer,
  mobileSheet,
  suspendedMobileDrawer,
  zoneEditSession,
  isSeatFullscreen,
  setRightRailTab,
  closeMobileDrawer,
  closeMobileSheet
} = useEditorWorkbench()
const { isTouchDraggingFromSeat } = useDragState()
const isFullscreenLandscape = computed(() => isSeatFullscreen.value && isMobileWorkbench.value && isLandscape.value)
const showMobileDropOutZone = computed(() => isMobileWorkbench.value && !isSeatFullscreen.value && isTouchDraggingFromSeat.value)
const activeMobileSheet = computed(() => {
  if (!mobileSheet.value) return null
  if (isFullscreenLandscape.value && mobileSheet.value === 'candidates') return null
  return mobileSheet.value
})
const mobileDrawerVisible = computed(() => Boolean(activeMobileSheet.value) && !suspendedMobileDrawer.value)

const mobileDrawerTitle = computed(() => {
  const titles = {
    candidates: '学生',
    context: '上下文',
    selection: '上下文',
    tools: '工具'
  }
  const sheet = mobileSheet.value
  if (sheet) return titles[sheet]
  const drawer = mobileDrawer.value
  return drawer ? titles[drawer] : ''
})

let drawerStartY = 0
let drawerDragY = 0
let isDrawerDragging = false

const handleDrawerPointerDown = (e: PointerEvent) => {
  if (e.pointerType !== 'touch') return
  isDrawerDragging = true
  drawerStartY = e.clientY
  drawerDragY = 0
  if (e.currentTarget instanceof Element) e.currentTarget.setPointerCapture?.(e.pointerId)
}

const handleDrawerPointerMove = (e: PointerEvent) => {
  if (!isDrawerDragging) return
  drawerDragY = e.clientY - drawerStartY
}

const handleDrawerPointerUp = () => {
  if (!isDrawerDragging) return
  isDrawerDragging = false
  if (drawerDragY > 64) closeMobileDrawer()
  drawerDragY = 0
}

const handleDrawerPointerCancel = () => {
  isDrawerDragging = false
  drawerDragY = 0
}
</script>

<style scoped>
.editor-workbench {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px 280px;
  grid-template-rows: minmax(0, 1fr) auto;
  background: var(--color-bg-secondary);
  overflow: hidden;
}

.chart-region {
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
  min-height: 0;
  background: var(--color-surface);
  position: relative;
  overflow: hidden;
}

.student-rail {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.context-rail {
  grid-column: 3;
  grid-row: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface);
}

.rail-tabs {
  display: none;
}

.rail-content {
  flex: 1;
  min-height: 0;
}

.tool-dock {
  grid-column: 1 / -1;
  grid-row: 2;
}

@media (max-width: 1439px) and (min-width: 1025px) {
  .editor-workbench {
    grid-template-columns: minmax(0, 1fr) 340px;
  }

  .student-rail {
    display: none;
  }

  .context-rail {
    grid-column: 2;
  }

  .rail-tabs {
    display: block;
    padding: 8px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    flex-shrink: 0;
  }

}

.editor-workbench.zone-editing {
  grid-template-columns: minmax(0, 1fr) 340px;
}

.editor-workbench.zone-editing .context-rail {
  grid-column: 2;
}

@media (max-width: 1024px) {
  .editor-workbench {
    --mobile-tool-dock-height: calc(56px + env(safe-area-inset-bottom, 0px));
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) var(--mobile-tool-dock-height);
  }

  .chart-region {
    grid-column: 1;
    grid-row: 1;
  }

  .student-rail {
    display: none;
  }

  .context-rail {
    grid-column: 1;
    grid-row: 1;
    min-height: 0;
    display: none;
    border-left: none;
    border-top: 1px solid var(--color-border);
  }

  .context-rail .rail-tabs {
    display: none;
  }

  .tool-dock {
    grid-column: 1;
    grid-row: 2;
  }

  .editor-workbench.seat-fullscreen {
    display: grid;
    position: fixed;
    inset: 0;
    z-index: 3000;
    width: 100vw;
    min-width: 100vw;
    max-width: none;
    height: 100vh;
    height: 100dvh;
    min-height: 100dvh;
    max-height: none;
    background: var(--color-bg-secondary);
  }

  .editor-workbench.seat-fullscreen.fullscreen-landscape {
    grid-template-columns: minmax(0, 1fr) clamp(260px, 30vw, 360px);
    grid-template-rows: minmax(0, 1fr) var(--mobile-tool-dock-height);
  }

  .editor-workbench.seat-fullscreen.fullscreen-landscape .chart-region {
    grid-column: 1;
    grid-row: 1;
  }

  .editor-workbench.seat-fullscreen.fullscreen-landscape .student-rail {
    display: block;
    grid-column: 2;
    grid-row: 1 / 3;
    min-height: 0;
    border-left: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  .editor-workbench.seat-fullscreen.fullscreen-landscape .student-rail :deep(.student-pool-panel) {
    border-left: none;
  }

  .editor-workbench.seat-fullscreen.fullscreen-landscape .tool-dock {
    grid-column: 1;
    grid-row: 2;
  }

  .seat-touch-drop-out-zone {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(var(--mobile-tool-dock-height) + 8px);
    z-index: 1001;
    min-height: 54px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 2px dashed var(--color-primary);
    border-radius: 8px;
    background: var(--color-info-bg);
    color: var(--color-primary);
    font-size: 14px;
    font-weight: 700;
    box-shadow: var(--shadow-lg);
    pointer-events: auto;
    transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
  }

  .seat-touch-drop-out-zone.is-touch-over {
    border-style: solid;
    background: var(--color-primary);
    color: var(--color-text-inverse);
    transform: translateY(-2px);
  }

  :global(body.student-dragging-from-candidate) .editor-workbench {
    grid-template-rows: minmax(0, 1fr) var(--mobile-tool-dock-height);
  }

  :global(body.student-dragging-from-candidate) .chart-region {
    grid-row: 1;
  }

  :global(body.student-dragging-from-candidate) .context-rail {
    display: none;
  }

  .mobile-drawer-title {
    display: block;
    width: 100%;
    min-width: 0;
    color: var(--color-text-primary);
    font-size: 14px;
    touch-action: none;
  }

  .mobile-drawer-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
}

@media (max-width: 1024px) and (orientation: landscape) and (max-height: 540px) {
  .editor-workbench {
    --mobile-tool-dock-height: calc(50px + env(safe-area-inset-bottom, 0px));
  }

  .editor-workbench.seat-fullscreen.fullscreen-landscape {
    grid-template-columns: minmax(0, 1fr) clamp(220px, 34vw, 300px);
  }

  .editor-workbench.seat-fullscreen.fullscreen-landscape .student-rail {
    grid-row: 1 / 3;
    overflow: hidden;
  }
}

</style>
