<template>
  <footer class="editor-tool-dock">
    <div v-if="zoneEditSession" class="zone-edit-strip">
      <span>{{ zoneEditSession.title || '正在编辑选区' }}</span>
      <NButton size="tiny" type="primary" @click="finishZoneEditing">
        <template #icon><Check :size="15" stroke-width="2.4" /></template>
        <span>完成</span>
      </NButton>
    </div>

    <div class="tool-group mobile-only">
      <NButton size="small" quaternary class="tool-button" :title="isSeatFullscreen ? '退出全屏座位表' : '全屏座位表'" @click="toggleSeatFullscreen">
        <template #icon>
          <Minimize2 v-if="isSeatFullscreen" :size="17" stroke-width="2" />
          <Maximize2 v-else :size="17" stroke-width="2" />
        </template>
        <span>{{ isSeatFullscreen ? '退出' : '全屏' }}</span>
      </NButton>
      <NButton
        size="small"
        quaternary
        class="tool-button"
        title="上下文"
        :aria-pressed="mobileDrawer === 'selection'"
        @click="openWorkbenchDrawer('selection')"
      >
        <template #icon><PanelRightOpen :size="17" stroke-width="2" /></template>
        <span>上下文</span>
      </NButton>
      <NButton size="small" quaternary class="tool-button" title="候选学生" @click="openWorkbenchDrawer('candidates')">
        <template #icon><Users :size="17" stroke-width="2" /></template>
        <span>学生</span>
      </NButton>
      <NButton size="small" quaternary class="tool-button" title="更多工具" @click="openWorkbenchDrawer('tools')">
        <template #icon><MoreHorizontal :size="17" stroke-width="2" /></template>
        <span>工具</span>
      </NButton>
    </div>

    <div v-if="selectedStudent" class="placement-strip mobile-placement">
      <span>正在放置：{{ selectedStudent.name || '未命名' }}</span>
      <NButton size="tiny" secondary @click="clearStudentSelection">取消</NButton>
    </div>

    <div class="tool-group">
      <NButton size="small" quaternary circle class="tool-button icon-only" title="撤销" :disabled="!canUndo" @click="undo">
        <Undo2 :size="17" stroke-width="2" />
      </NButton>
      <NButton size="small" quaternary circle class="tool-button icon-only" title="重做" :disabled="!canRedo" @click="redo">
        <Redo2 :size="17" stroke-width="2" />
      </NButton>
      <NButton size="small" class="tool-button" :type="currentMode === EditMode.NORMAL && !isSelectionMode ? 'primary' : 'default'" :secondary="currentMode === EditMode.NORMAL && !isSelectionMode" :quaternary="currentMode !== EditMode.NORMAL || isSelectionMode" title="普通模式" @click="activateTool('normal')">
        <template #icon><MousePointer2 :size="17" stroke-width="2" /></template>
        <span>普通</span>
      </NButton>
      <NButton
        size="small"
        class="tool-button"
        :type="isSelectionMode ? 'primary' : 'default'"
        :secondary="isSelectionMode"
        :quaternary="!isSelectionMode"
        :title="selectionToolTitle"
        :aria-label="selectionToolTitle"
        :aria-pressed="isSelectionMode"
        @click="toggleSelectionMode"
      >
        <template #icon><BoxSelect :size="17" stroke-width="2" /></template>
        <span>多选</span>
        <span v-if="isSelectionMode && selectedCount > 0" class="selection-badge">{{ selectedCount }}</span>
      </NButton>
      <div v-if="isSelectionMode" class="selection-mode-hint" role="status">
        {{ selectionModeHint }}
      </div>
    </div>

    <div class="tool-group">
      <NButton size="small" class="tool-button" :type="currentMode === EditMode.SWAP ? 'primary' : 'default'" :secondary="currentMode === EditMode.SWAP" :quaternary="currentMode !== EditMode.SWAP" title="交换座位" @click="activateTool('swap')">
        <template #icon><ArrowLeftRight :size="17" stroke-width="2" /></template>
        <span>交换</span>
      </NButton>
      <NButton size="small" class="tool-button" :type="currentMode === EditMode.CLEAR ? 'error' : 'default'" :secondary="currentMode === EditMode.CLEAR" :quaternary="currentMode !== EditMode.CLEAR" title="清空座位" @click="activateTool('clear')">
        <template #icon><Trash2 :size="17" stroke-width="2" /></template>
        <span>清空</span>
      </NButton>
      <NButton size="small" class="tool-button" :type="currentMode === EditMode.EMPTY_EDIT ? 'warning' : 'default'" :secondary="currentMode === EditMode.EMPTY_EDIT" :quaternary="currentMode !== EditMode.EMPTY_EDIT" title="空置座位" @click="activateTool('empty')">
        <template #icon><LayoutGrid :size="17" stroke-width="2" /></template>
        <span>空置</span>
      </NButton>
    </div>

    <div class="tool-group workflows">
      <NButton size="small" quaternary class="tool-button" title="座位配置" @click="openWorkbenchDialog('seatConfig')">
        <template #icon><Settings :size="17" stroke-width="2" /></template>
        <span>配置</span>
      </NButton>
      <NButton size="small" quaternary class="tool-button" title="位移轮换" @click="openWorkbenchDialog('shiftRotation')">
        <template #icon><MoveDiagonal2 :size="17" stroke-width="2" /></template>
        <span>位移</span>
      </NButton>
      <NButton size="small" quaternary class="tool-button" title="选区轮换" @click="openWorkbenchDialog('zoneRotation')">
        <template #icon><RefreshCcw :size="17" stroke-width="2" /></template>
        <span>轮换</span>
      </NButton>
      <NButton size="small" quaternary class="tool-button" title="智能排位" @click="openWorkbenchDialog('assignment')">
        <template #icon><Shuffle :size="17" stroke-width="2" /></template>
        <span>排位</span>
      </NButton>
      <NButton size="small" quaternary class="tool-button" title="规则管理" @click="openWorkbenchDialog('rules')">
        <template #icon><Scale :size="17" stroke-width="2" /></template>
        <span>规则</span>
      </NButton>
    </div>

    <div class="tool-group zoom-tools">
      <NButton size="small" quaternary circle class="tool-button icon-only" title="缩小" :disabled="scale <= MIN_SCALE" @click="zoomOut">
        <Minus :size="17" stroke-width="2" />
      </NButton>
      <NButton size="small" quaternary class="tool-button zoom-label" title="自适应大小" @click="fitToViewport">
        {{ Math.round(scale * 100) }}%
      </NButton>
      <NButton size="small" quaternary circle class="tool-button icon-only" title="放大" :disabled="scale >= MAX_SCALE" @click="zoomIn">
        <Plus :size="17" stroke-width="2" />
      </NButton>
      <NButton size="small" quaternary class="tool-button export-tool" title="导出" @click="router.push({ path: '/export', query: { tab: 'image' } })">
        <template #icon><FileOutput :size="17" stroke-width="2" /></template>
        <span>导出</span>
      </NButton>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NButton } from 'naive-ui'
import { useRouter } from 'vue-router'
import {
  ArrowLeftRight,
  BoxSelect,
  Check,
  FileOutput,
  LayoutGrid,
  Maximize2,
  Minus,
  Minimize2,
  MoreHorizontal,
  MousePointer2,
  MoveDiagonal2,
  PanelRightOpen,
  Plus,
  Redo2,
  RefreshCcw,
  Scale,
  Settings,
  Shuffle,
  Trash2,
  Undo2,
  Users
} from 'lucide-vue-next'
import { useMediaQuery } from '@vueuse/core'
import { mobileWorkbenchMediaQuery } from '@/constants/layout'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useEditorCommands } from '@/composables/useEditorCommands'
import { useEditMode } from '@/composables/useEditMode'
import { useSelection } from '@/composables/useSelection'
import { useStudentData } from '@/composables/useStudentData'
import { useUndo } from '@/composables/useUndo'
import { useZoom } from '@/composables/useZoom'

const router = useRouter()
const {
  zoneEditSession,
  isSeatFullscreen,
  mobileDrawer,
  toggleSeatFullscreen
} = useEditorWorkbench()
const { currentMode, EditMode } = useEditMode()
const { isSelectionMode } = useSelection()
const {
  selectedCount,
  activateTool,
  toggleSelectionMode,
  finishZoneEditing,
  openWorkbenchDialog,
  openWorkbenchDrawer
} = useEditorCommands()
const { students, selectedStudentId, clearSelection: clearStudentSelection } = useStudentData()
const { undo, redo, canUndo, canRedo } = useUndo()
const { scale, zoomIn, zoomOut, MIN_SCALE, MAX_SCALE, fitToViewport } = useZoom()
const isMobileWorkbench = useMediaQuery(mobileWorkbenchMediaQuery)

const selectedStudent = computed(() => (
  students.value.find(student => student.id === selectedStudentId.value) || null
))

const selectionModeHint = computed(() => {
  if (selectedCount.value > 0) return `已选 ${selectedCount.value} 个座位`
  return isMobileWorkbench.value ? '滑动涂抹多选' : '按住左键涂抹多选'
})

const selectionToolTitle = computed(() => {
  if (isSelectionMode.value) return `${selectionModeHint.value}，再次点击退出多选`
  return isMobileWorkbench.value
    ? '多选座位：在座位表上滑动涂抹选择'
    : '多选座位：按住左键拖过座位连续选择，Shift+右键框选'
})

</script>

<style scoped>
.editor-tool-dock {
  min-height: 58px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  overflow-x: auto;
  scrollbar-gutter: stable;
  position: relative;
  z-index: 20;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 8px;
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
}

.zone-edit-strip {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 12px;
  border: 1px solid var(--color-primary);
  border-radius: 6px;
  background: var(--color-info-bg);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.placement-strip {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 12px;
  border: 1px solid var(--color-primary);
  border-radius: 6px;
  background: var(--color-info-bg);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.tool-group:last-child {
  border-right: none;
}

.tool-button {
  position: relative;
  white-space: nowrap;
}

.selection-badge {
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.selection-mode-hint {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border-left: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.tool-button.icon-only {
  flex: 0 0 auto;
}

.zoom-label {
  min-width: 58px;
  font-variant-numeric: tabular-nums;
}

.mobile-only {
  display: none;
}

.mobile-placement {
  display: none;
}

@media (max-width: 1439px) {
  .tool-button span {
    display: none;
  }

  .tool-button .selection-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    display: inline-flex;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 10px;
  }

  .selection-mode-hint {
    display: none;
  }

  .tool-button {
    width: 38px;
    padding: 0;
  }

  .zoom-label {
    width: 54px;
  }
}

@media (max-width: 1024px) {
  .editor-tool-dock {
    height: var(--mobile-tool-dock-height, calc(56px + env(safe-area-inset-bottom, 0px)));
    min-height: var(--mobile-tool-dock-height, calc(56px + env(safe-area-inset-bottom, 0px)));
    align-items: center;
    gap: 5px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;
    box-shadow: 0 -6px 18px var(--shadow-md);
    scrollbar-width: none;
  }

  .editor-tool-dock::-webkit-scrollbar {
    display: none;
  }

  .tool-group {
    min-height: 44px;
    padding-right: 5px;
    gap: 3px;
  }

  .tool-button {
    width: 44px;
    min-width: 44px;
    min-height: 44px;
    border-radius: 7px;
  }

  .tool-button.icon-only {
    width: 44px;
  }

  .zoom-label {
    width: 56px;
    min-width: 56px;
  }

  .selection-mode-hint {
    min-height: 36px;
    display: inline-flex;
    padding: 0 9px;
    border-left: none;
    border-radius: 7px;
    background: var(--color-bg-subtle);
    color: var(--color-primary);
    font-size: 12px;
    font-weight: 600;
  }

  .mobile-only {
    display: flex;
  }

  .mobile-placement {
    display: inline-flex;
  }

  .workflows {
    order: 4;
  }

  .zoom-tools {
    order: 5;
  }

  :global(body.student-dragging-from-candidate) .workflows,
  :global(body.seat-dragging-from-chart) .workflows {
    display: none;
  }

  :global(.editor-workbench.seat-fullscreen) .workflows,
  :global(.editor-workbench.seat-fullscreen) .export-tool {
    display: none;
  }

  :global(.editor-workbench.seat-fullscreen.fullscreen-landscape) .tool-button span {
    display: none;
  }

  :global(.editor-workbench.seat-fullscreen.fullscreen-landscape) .mobile-placement {
    max-width: 220px;
  }
}
</style>
