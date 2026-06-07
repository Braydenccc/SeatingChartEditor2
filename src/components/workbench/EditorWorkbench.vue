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
        <button :class="{ active: rightRailTab === 'selection' }" @click="setRightRailTab('selection')">上下文</button>
        <button :class="{ active: rightRailTab === 'candidates' }" @click="setRightRailTab('candidates')">学生</button>
        <button :class="{ active: rightRailTab === 'activity' }" @click="setRightRailTab('activity')">状态</button>
      </div>
      <div class="rail-content">
        <ZoneEditContextPanel v-if="zoneEditSession" />
        <ContextInspector v-else-if="isWideDesktop || rightRailTab === 'selection' || (isMobileWorkbench && rightRailTab === 'candidates')" />
        <StudentPoolPanel v-else-if="rightRailTab === 'candidates'" />
        <ActivityPanel v-else />
      </div>
    </aside>

    <EditorToolDock class="tool-dock" />

    <Transition :name="suspendedMobileDrawer ? '' : 'drawer'">
      <div
        v-if="activeMobileSheet"
        class="mobile-drawer-shell"
        :class="{ 'is-drag-suspended': suspendedMobileDrawer }"
      >
        <div
          class="mobile-drawer-header"
          @pointerdown="handleDrawerPointerDown"
          @pointermove="handleDrawerPointerMove"
          @pointerup="handleDrawerPointerUp"
          @pointercancel="handleDrawerPointerCancel"
        >
          <strong>{{ mobileDrawerTitle }}</strong>
          <button @pointerdown.stop @click="closeMobileDrawer">关闭</button>
        </div>
        <div class="mobile-drawer-body">
          <ZoneEditContextPanel v-if="zoneEditSession" />
          <ContextInspector v-else-if="mobileSheet === 'context'" />
          <StudentPoolPanel v-else-if="mobileSheet === 'candidates'" />
          <MobileToolsPanel v-else-if="mobileSheet === 'tools'" />
        </div>
      </div>
    </Transition>

    <div v-if="activeMobileSheet && !suspendedMobileDrawer" class="mobile-drawer-backdrop" @click="closeMobileSheet"></div>

    <WorkbenchDialogs />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import SeatChart from '@/components/seat/SeatChart.vue'
import ActivityPanel from './ActivityPanel.vue'
import ContextInspector from './ContextInspector.vue'
import EditorToolDock from './EditorToolDock.vue'
import MobileToolsPanel from './MobileToolsPanel.vue'
import StudentPoolPanel from './StudentPoolPanel.vue'
import WorkbenchDialogs from './WorkbenchDialogs.vue'
import ZoneEditContextPanel from './ZoneEditContextPanel.vue'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'

const isWideDesktop = useMediaQuery('(min-width: 1440px)')
const isMobileWorkbench = useMediaQuery('(max-width: 1024px)')
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
const isFullscreenLandscape = computed(() => isSeatFullscreen.value && isMobileWorkbench.value && isLandscape.value)
const activeMobileSheet = computed(() => {
  if (!mobileSheet.value) return null
  if (isFullscreenLandscape.value && mobileSheet.value === 'candidates') return null
  return mobileSheet.value
})

const mobileDrawerTitle = computed(() => {
  const titles = {
    candidates: '学生',
    context: '上下文',
    selection: '上下文',
    tools: '工具'
  }
  return titles[mobileSheet.value] || titles[mobileDrawer.value] || ''
})

let drawerStartY = 0
let drawerDragY = 0
let isDrawerDragging = false

const handleDrawerPointerDown = (e) => {
  if (e.pointerType !== 'touch') return
  isDrawerDragging = true
  drawerStartY = e.clientY
  drawerDragY = 0
  e.currentTarget.setPointerCapture?.(e.pointerId)
}

const handleDrawerPointerMove = (e) => {
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

.mobile-drawer-backdrop,
.mobile-drawer-shell {
  display: none;
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
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 8px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    flex-shrink: 0;
  }

  .rail-tabs button {
    min-height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 12px;
    cursor: pointer;
  }

  .rail-tabs button.active {
    background: var(--color-surface);
    color: var(--color-primary);
    font-weight: 600;
    box-shadow: var(--shadow-sm);
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
    --mobile-drawer-limit: calc(100dvh - var(--app-header-height, 78px) - var(--mobile-tool-dock-height) - 8px);
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
    --mobile-drawer-limit: calc(100dvh - var(--mobile-tool-dock-height) - 8px);
    position: fixed;
    inset: 0;
    z-index: 3000;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    background: var(--color-bg-secondary);
  }

  .editor-workbench.seat-fullscreen .mobile-drawer-backdrop {
    inset: 0 0 var(--mobile-tool-dock-height) 0;
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

  .editor-workbench.seat-fullscreen.fullscreen-landscape .tool-dock {
    grid-column: 1;
    grid-row: 2;
  }

  .mobile-drawer-backdrop {
    display: block;
    position: fixed;
    inset: var(--app-header-height, 0px) 0 var(--mobile-tool-dock-height) 0;
    z-index: 998;
    background: var(--color-bg-overlay);
  }

  .mobile-drawer-shell {
    display: flex;
    flex-direction: column;
    position: fixed;
    left: 0;
    right: 0;
    bottom: var(--mobile-tool-dock-height);
    z-index: 999;
    max-height: min(68vh, var(--mobile-drawer-limit));
    min-height: min(240px, var(--mobile-drawer-limit));
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    border-radius: 10px 10px 0 0;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    transition: transform 0.2s ease, opacity 0.16s ease;
  }

  .mobile-drawer-shell:focus-within {
    max-height: min(78vh, var(--mobile-drawer-limit));
  }

  .mobile-drawer-shell.is-drag-suspended {
    transform: none;
    opacity: 0;
    visibility: hidden;
    box-shadow: none;
    pointer-events: none;
    transition: none !important;
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

  .mobile-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .mobile-drawer-header strong {
    color: var(--color-text-primary);
    font-size: 14px;
  }

  .mobile-drawer-header button {
    min-height: 34px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg-subtle);
    color: var(--color-primary);
    padding: 0 10px;
    font-size: 13px;
    cursor: pointer;
  }

  .mobile-drawer-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
}

.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.24s ease, opacity 0.2s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
