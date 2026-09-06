import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useEditMode } from '@/composables/useEditMode'
import {
  useEditorWorkbench,
  type WorkbenchDialog,
  type ZoneEditSession
} from '@/composables/useEditorWorkbench'
import { useLogger } from '@/composables/useLogger'
import { useSelection } from '@/composables/useSelection'
import { useZoneData } from '@/composables/useZoneData'
import { useZoneRotation } from '@/composables/useZoneRotation'

export type EditorToolCommand = 'normal' | 'swap' | 'clear' | 'empty'

export function useEditorCommands() {
  const workbench = useEditorWorkbench()
  const { currentMode, setMode, clearFirstSelectedSeat, EditMode } = useEditMode()
  const {
    clearSelection,
    isSelectionMode,
    selectedCount,
    toggleSelectionMode: toggleRawSelectionMode
  } = useSelection()
  const { clearZoneSelection, selectZone } = useZoneData()
  const { clearEditingZone, setEditingZone } = useZoneRotation()
  const { info } = useLogger()
  const isMobileWorkbench = useMediaQuery('(max-width: 1024px)')
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isFullscreenLandscape = computed(() => workbench.isSeatFullscreen.value && isMobileWorkbench.value && isLandscape.value)

  const finishZoneEditing = () => {
    clearZoneSelection()
    clearEditingZone()
    setMode(EditMode.NORMAL)
    workbench.finishZoneEditSession()
  }

  const startGlobalZoneEditing = (zoneId: number, session?: ZoneEditSession) => {
    clearEditingZone()
    selectZone(zoneId)
    clearFirstSelectedSeat()
    if (isSelectionMode.value) toggleRawSelectionMode()
    setMode(EditMode.ZONE_EDIT)
    if (session) workbench.startZoneEditSession(session)
  }

  const startRotationZoneEditing = (zoneId: number, session: ZoneEditSession) => {
    clearZoneSelection()
    setEditingZone(zoneId)
    clearFirstSelectedSeat()
    if (isSelectionMode.value) toggleRawSelectionMode()
    setMode(EditMode.ZONE_EDIT)
    workbench.startZoneEditSession(session)
  }

  const activateTool = (tool: EditorToolCommand) => {
    const previousMode = currentMode.value
    finishZoneEditing()
    if (tool === 'normal') {
      setMode(EditMode.NORMAL)
      clearFirstSelectedSeat()
      if (isSelectionMode.value) toggleRawSelectionMode()
      return
    }

    workbench.closeMobileDrawer()
    if (isSelectionMode.value) toggleRawSelectionMode()
    const modeMap = {
      swap: EditMode.SWAP,
      clear: EditMode.CLEAR,
      empty: EditMode.EMPTY_EDIT
    } as const
    const nextMode = modeMap[tool]
    if (previousMode === nextMode) {
      setMode(EditMode.NORMAL)
      return
    }

    setMode(nextMode)
    const hints = {
      swap: '交换模式：依次点击两个座位交换学生',
      clear: '清空模式：点击有学生的座位移出学生',
      empty: '空置编辑：点击座位切换是否可用'
    }
    info(hints[tool])
  }

  const toggleSelectionMode = () => {
    finishZoneEditing()
    if (currentMode.value !== EditMode.NORMAL) setMode(EditMode.NORMAL)
    toggleRawSelectionMode()
    if (isSelectionMode.value) {
      info(isMobileWorkbench.value
        ? '多选模式：在座位表上滑动涂抹选择座位'
        : '多选模式：按住左键涂抹选择座位，再从上下文面板执行操作')
    } else {
      workbench.closeMobileDrawer()
    }
  }

  const cancelSeatSelection = () => {
    clearSelection()
    workbench.closeMobileDrawer()
  }

  const openWorkbenchDialog = (dialog: Exclude<WorkbenchDialog, null>) => {
    finishZoneEditing()
    workbench.openDialog(dialog)
  }

  const openWorkbenchDrawer = (drawer: 'candidates' | 'selection' | 'tools') => {
    finishZoneEditing()
    if (drawer === 'candidates' && isFullscreenLandscape.value) {
      workbench.closeMobileDrawer()
      return
    }
    workbench.openMobileDrawer(drawer)
  }

  return {
    selectedCount,
    activateTool,
    toggleSelectionMode,
    cancelSeatSelection,
    finishZoneEditing,
    startGlobalZoneEditing,
    startRotationZoneEditing,
    openWorkbenchDialog,
    openWorkbenchDrawer
  }
}
