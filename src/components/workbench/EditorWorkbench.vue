<template>
  <div class="editor-workbench" :class="{ 'zone-editing': zoneEditSession }">
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
        <ContextInspector v-else-if="isWideDesktop || rightRailTab === 'selection'" />
        <StudentPoolPanel v-else-if="rightRailTab === 'candidates'" />
        <ActivityPanel v-else />
      </div>
    </aside>

    <EditorToolDock class="tool-dock" />

    <Transition name="drawer">
      <div v-if="mobileDrawer" class="mobile-drawer-shell">
        <div class="mobile-drawer-header">
          <strong>{{ mobileDrawerTitle }}</strong>
          <button @click="closeMobileDrawer">关闭</button>
        </div>
        <div class="mobile-drawer-body">
          <ZoneEditContextPanel v-if="zoneEditSession" />
          <StudentPoolPanel v-else-if="mobileDrawer === 'candidates'" />
          <ContextInspector v-else-if="mobileDrawer === 'selection'" />
          <ActivityPanel v-else-if="mobileDrawer === 'activity'" />
        </div>
      </div>
    </Transition>

    <div v-if="mobileDrawer" class="mobile-drawer-backdrop" @click="closeMobileDrawer"></div>

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
import StudentPoolPanel from './StudentPoolPanel.vue'
import WorkbenchDialogs from './WorkbenchDialogs.vue'
import ZoneEditContextPanel from './ZoneEditContextPanel.vue'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'

const { rightRailTab, mobileDrawer, zoneEditSession, setRightRailTab, closeMobileDrawer } = useEditorWorkbench()
const isWideDesktop = useMediaQuery('(min-width: 1440px)')

const mobileDrawerTitle = computed(() => {
  const titles = {
    candidates: '候选学生',
    selection: '上下文',
    activity: '状态',
    tools: '工具'
  }
  return titles[mobileDrawer.value] || ''
})
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
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .chart-region {
    grid-column: 1;
    grid-row: 1;
  }

  .student-rail,
  .context-rail {
    display: none;
  }

  .mobile-drawer-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 998;
    background: var(--color-bg-overlay);
  }

  .mobile-drawer-shell {
    display: flex;
    flex-direction: column;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 56px;
    z-index: 999;
    max-height: 60vh;
    min-height: 280px;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    border-radius: 12px 12px 0 0;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  .mobile-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .mobile-drawer-header strong {
    color: var(--color-text-primary);
    font-size: 14px;
  }

  .mobile-drawer-header button {
    border: none;
    background: transparent;
    color: var(--color-primary);
    font-size: 13px;
    cursor: pointer;
  }

  .mobile-drawer-body {
    flex: 1;
    min-height: 0;
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
