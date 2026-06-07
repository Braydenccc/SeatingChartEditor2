<template>
  <footer class="editor-tool-dock">
    <div v-if="zoneEditSession" class="zone-edit-strip">
      <span>{{ zoneEditSession.title || '正在编辑选区' }}</span>
      <button type="button" @click="finishZoneEditing">
        <Check :size="15" stroke-width="2.4" />
        <span>完成</span>
      </button>
    </div>

    <div class="tool-group mobile-only">
      <button class="tool-button" :title="isSeatFullscreen ? '退出全屏座位表' : '全屏座位表'" @click="toggleSeatFullscreen">
        <Minimize2 v-if="isSeatFullscreen" :size="17" stroke-width="2" />
        <Maximize2 v-else :size="17" stroke-width="2" />
        <span>{{ isSeatFullscreen ? '退出' : '全屏' }}</span>
      </button>
      <button class="tool-button" title="候选学生" @click="openWorkbenchDrawer('candidates')">
        <Users :size="17" stroke-width="2" />
        <span>学生</span>
      </button>
      <button class="tool-button" title="更多工具" @click="openWorkbenchDrawer('tools')">
        <MoreHorizontal :size="17" stroke-width="2" />
        <span>工具</span>
      </button>
    </div>

    <div v-if="selectedStudent" class="placement-strip mobile-placement">
      <span>正在放置：{{ selectedStudent.name || '未命名' }}</span>
      <button type="button" @click="clearStudentSelection">取消</button>
    </div>

    <div class="tool-group">
      <button class="tool-button icon-only" title="撤销" :disabled="!canUndo" @click="undo">
        <Undo2 :size="17" stroke-width="2" />
      </button>
      <button class="tool-button icon-only" title="重做" :disabled="!canRedo" @click="redo">
        <Redo2 :size="17" stroke-width="2" />
      </button>
      <button class="tool-button" :class="{ active: currentMode === EditMode.NORMAL && !isSelectionMode }" title="普通模式" @click="activateTool('normal')">
        <MousePointer2 :size="17" stroke-width="2" />
        <span>普通</span>
      </button>
      <button
        class="tool-button"
        :class="{ active: isSelectionMode }"
        :title="selectionToolTitle"
        :aria-label="selectionToolTitle"
        :aria-pressed="isSelectionMode"
        @click="toggleSelectionMode"
      >
        <BoxSelect :size="17" stroke-width="2" />
        <span>多选</span>
        <span v-if="isSelectionMode && selectedCount > 0" class="selection-badge">{{ selectedCount }}</span>
      </button>
      <div v-if="isSelectionMode" class="selection-mode-hint" role="status">
        {{ selectionModeHint }}
      </div>
    </div>

    <div class="tool-group">
      <button class="tool-button" :class="{ active: currentMode === EditMode.SWAP }" title="交换座位" @click="activateTool('swap')">
        <ArrowLeftRight :size="17" stroke-width="2" />
        <span>交换</span>
      </button>
      <button class="tool-button" :class="{ active: currentMode === EditMode.CLEAR }" title="清空座位" @click="activateTool('clear')">
        <Trash2 :size="17" stroke-width="2" />
        <span>清空</span>
      </button>
      <button class="tool-button" :class="{ active: currentMode === EditMode.EMPTY_EDIT }" title="空置座位" @click="activateTool('empty')">
        <LayoutGrid :size="17" stroke-width="2" />
        <span>空置</span>
      </button>
    </div>

    <div class="tool-group workflows">
      <button class="tool-button" title="座位配置" @click="openWorkbenchDialog('seatConfig')">
        <Settings :size="17" stroke-width="2" />
        <span>配置</span>
      </button>
      <button class="tool-button" title="位移轮换" @click="openWorkbenchDialog('shiftRotation')">
        <MoveDiagonal2 :size="17" stroke-width="2" />
        <span>位移</span>
      </button>
      <button class="tool-button" title="选区轮换" @click="openWorkbenchDialog('zoneRotation')">
        <RefreshCcw :size="17" stroke-width="2" />
        <span>轮换</span>
      </button>
      <button class="tool-button" title="智能排位" @click="openWorkbenchDialog('assignment')">
        <Shuffle :size="17" stroke-width="2" />
        <span>排位</span>
      </button>
      <button class="tool-button" title="规则管理" @click="openWorkbenchDialog('rules')">
        <Scale :size="17" stroke-width="2" />
        <span>规则</span>
      </button>
    </div>

    <div class="tool-group zoom-tools">
      <button class="tool-button icon-only" title="缩小" :disabled="scale <= MIN_SCALE" @click="zoomOut">
        <Minus :size="17" stroke-width="2" />
      </button>
      <button class="tool-button zoom-label" title="自适应大小" @click="fitToViewport">
        {{ Math.round(scale * 100) }}%
      </button>
      <button class="tool-button icon-only" title="放大" :disabled="scale >= MAX_SCALE" @click="zoomIn">
        <Plus :size="17" stroke-width="2" />
      </button>
      <button class="tool-button export-tool" title="导出" @click="router.push({ path: '/export', query: { tab: 'image' } })">
        <FileOutput :size="17" stroke-width="2" />
        <span>导出</span>
      </button>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
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
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useEditMode } from '@/composables/useEditMode'
import { useSelection } from '@/composables/useSelection'
import { useStudentData } from '@/composables/useStudentData'
import { useUndo } from '@/composables/useUndo'
import { useZoom } from '@/composables/useZoom'
import { useZoneData } from '@/composables/useZoneData'
import { useZoneRotation } from '@/composables/useZoneRotation'
import { useLogger } from '@/composables/useLogger'

const router = useRouter()
const {
  setTool,
  openDialog,
  showMobileSheet,
  openMobileDrawer,
  closeMobileDrawer,
  zoneEditSession,
  finishZoneEditSession,
  isSeatFullscreen,
  toggleSeatFullscreen
} = useEditorWorkbench()
const { currentMode, setMode, clearFirstSelectedSeat, EditMode } = useEditMode()
const { isSelectionMode, selectedCount, toggleSelectionMode: toggleRawSelectionMode, clearSelection } = useSelection()
const { students, selectedStudentId, clearSelection: clearStudentSelection } = useStudentData()
const { undo, redo, canUndo, canRedo } = useUndo()
const { scale, zoomIn, zoomOut, MIN_SCALE, MAX_SCALE, fitToViewport } = useZoom()
const { clearZoneSelection } = useZoneData()
const { clearEditingZone } = useZoneRotation()
const { info } = useLogger()
const isMobileWorkbench = useMediaQuery('(max-width: 1024px)')
const isLandscape = useMediaQuery('(orientation: landscape)')
const isFullscreenLandscape = computed(() => isSeatFullscreen.value && isMobileWorkbench.value && isLandscape.value)

const selectedStudent = computed(() => (
  students.value.find(student => student.id === selectedStudentId.value) || null
))

const selectionModeHint = computed(() => {
  if (selectedCount.value > 0) return `已选 ${selectedCount.value} 个座位`
  return '按住左键涂抹多选'
})

const selectionToolTitle = computed(() => {
  if (isSelectionMode.value) return `${selectionModeHint.value}，再次点击退出多选`
  return '多选座位：按住左键拖过座位连续选择，Shift+右键框选'
})

const activateTool = (tool) => {
  finishZoneEditing()
  setTool(tool)
  clearSelection()
  if (tool === 'normal') {
    setMode(EditMode.NORMAL)
    clearFirstSelectedSeat()
    if (isSelectionMode.value) toggleRawSelectionMode()
    return
  }
  closeMobileDrawer()
  if (isSelectionMode.value) toggleRawSelectionMode()
  const modeMap = {
    swap: EditMode.SWAP,
    clear: EditMode.CLEAR,
    empty: EditMode.EMPTY_EDIT
  }
  if (currentMode.value === modeMap[tool]) {
    setMode(EditMode.NORMAL)
    setTool('normal')
  } else {
    setMode(modeMap[tool])
    const hints = {
      swap: '交换模式：依次点击两个座位交换学生',
      clear: '清空模式：点击有学生的座位移出学生',
      empty: '空置编辑：点击座位切换是否可用'
    }
    info(hints[tool])
  }
}

const toggleSelectionMode = () => {
  finishZoneEditing()
  if (currentMode.value !== EditMode.NORMAL) {
    setMode(EditMode.NORMAL)
    setTool('normal')
  }
  toggleRawSelectionMode()
  if (isSelectionMode.value) {
    showMobileSheet('context')
    info('多选模式：按住左键涂抹选择座位，再从上下文面板执行操作')
  } else {
    closeMobileDrawer()
  }
}

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

const openWorkbenchDrawer = (drawer) => {
  finishZoneEditing()
  if (drawer === 'candidates' && isFullscreenLandscape.value) {
    closeMobileDrawer()
    return
  }
  openMobileDrawer(drawer)
}
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

.zone-edit-strip button {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 8px;
  border: none;
  border-radius: 5px;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
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

.placement-strip button {
  min-height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: var(--color-surface);
  color: var(--color-primary);
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.tool-group:last-child {
  border-right: none;
}

.tool-button {
  position: relative;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
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
  width: 38px;
  padding: 0;
}

.tool-button:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--color-primary);
}

.tool-button.active {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.tool-button:disabled {
  color: var(--color-text-disabled);
  cursor: not-allowed;
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
