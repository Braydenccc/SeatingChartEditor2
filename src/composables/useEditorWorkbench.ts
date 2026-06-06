import { ref } from 'vue'

export type EditorTool = 'normal' | 'swap' | 'clear' | 'empty'
export type WorkbenchDialog = 'seatConfig' | 'shiftRotation' | 'zoneRotation' | 'assignment' | 'rules' | null
export type AssignmentWorkbenchPanel = 'run' | 'rules' | 'guide'
export type RightRailTab = 'candidates' | 'selection' | 'activity'
export type MobileDrawer = 'candidates' | 'selection' | 'tools' | null
export type ZoneEditKind = 'assignment' | 'rotation'

export interface ZoneEditSession {
  kind: ZoneEditKind
  sourceDialog: Exclude<WorkbenchDialog, null>
  zoneId: number
  groupId?: number | null
  title: string
  subtitle?: string
}

const activeTool = ref<EditorTool>('normal')
const activeWorkbenchDialog = ref<WorkbenchDialog>(null)
const assignmentWorkbenchPanel = ref<AssignmentWorkbenchPanel>('run')
const focusedRuleId = ref('')
const isWorkbenchDialogHidden = ref(false)
const zoneEditSession = ref<ZoneEditSession | null>(null)
const rightRailTab = ref<RightRailTab>('candidates')
const mobileDrawer = ref<MobileDrawer>(null)
const suspendedMobileDrawer = ref<MobileDrawer>(null)
const dragOpenedMobileDrawer = ref<MobileDrawer>(null)
const drawerBeforeDragOpen = ref<MobileDrawer>(null)

const validTools = new Set<EditorTool>(['normal', 'swap', 'clear', 'empty'])
const validDialogs = new Set<Exclude<WorkbenchDialog, null>>([
  'seatConfig',
  'shiftRotation',
  'zoneRotation',
  'assignment',
  'rules'
])
const validRightTabs = new Set<RightRailTab>(['candidates', 'selection', 'activity'])
const validMobileDrawers = new Set<Exclude<MobileDrawer, null>>([
  'candidates',
  'selection',
  'tools'
])

export function useEditorWorkbench() {
  const setTool = (tool: EditorTool) => {
    if (!validTools.has(tool)) return
    activeTool.value = tool
  }

  const resetTool = () => {
    activeTool.value = 'normal'
  }

  const openDialog = (
    dialog: Exclude<WorkbenchDialog, null>,
    options: { panel?: AssignmentWorkbenchPanel; focusRuleId?: string } = {}
  ) => {
    if (!validDialogs.has(dialog)) return
    if (dialog === 'rules') {
      activeWorkbenchDialog.value = 'assignment'
      assignmentWorkbenchPanel.value = 'rules'
      focusedRuleId.value = options.focusRuleId || ''
    } else {
      activeWorkbenchDialog.value = dialog
      assignmentWorkbenchPanel.value = options.panel || (dialog === 'assignment' ? 'run' : assignmentWorkbenchPanel.value)
      focusedRuleId.value = options.focusRuleId || ''
    }
    isWorkbenchDialogHidden.value = false
    zoneEditSession.value = null
    mobileDrawer.value = null
    suspendedMobileDrawer.value = null
    dragOpenedMobileDrawer.value = null
    drawerBeforeDragOpen.value = null
  }

  const closeDialog = () => {
    activeWorkbenchDialog.value = null
    isWorkbenchDialogHidden.value = false
    zoneEditSession.value = null
    focusedRuleId.value = ''
    suspendedMobileDrawer.value = null
    dragOpenedMobileDrawer.value = null
    drawerBeforeDragOpen.value = null
  }

  const startZoneEditSession = (session: ZoneEditSession) => {
    if (!validDialogs.has(session.sourceDialog)) return
    if (activeWorkbenchDialog.value !== session.sourceDialog) {
      activeWorkbenchDialog.value = session.sourceDialog
    }
    zoneEditSession.value = session
    isWorkbenchDialogHidden.value = true
    rightRailTab.value = 'selection'
    mobileDrawer.value = null
    suspendedMobileDrawer.value = null
    dragOpenedMobileDrawer.value = null
    drawerBeforeDragOpen.value = null
  }

  const finishZoneEditSession = () => {
    zoneEditSession.value = null
    isWorkbenchDialogHidden.value = false
  }

  const setRightRailTab = (tab: RightRailTab) => {
    if (!validRightTabs.has(tab)) return
    rightRailTab.value = tab
  }

  const openMobileDrawer = (drawer: Exclude<MobileDrawer, null>) => {
    if (!validMobileDrawers.has(drawer)) return
    suspendedMobileDrawer.value = null
    dragOpenedMobileDrawer.value = null
    drawerBeforeDragOpen.value = null
    mobileDrawer.value = mobileDrawer.value === drawer ? null : drawer
    activeWorkbenchDialog.value = null
    isWorkbenchDialogHidden.value = false
    zoneEditSession.value = null
  }

  const showMobileDrawer = (drawer: Exclude<MobileDrawer, null>) => {
    if (!validMobileDrawers.has(drawer)) return
    suspendedMobileDrawer.value = null
    dragOpenedMobileDrawer.value = null
    drawerBeforeDragOpen.value = null
    mobileDrawer.value = drawer
    activeWorkbenchDialog.value = null
    isWorkbenchDialogHidden.value = false
    zoneEditSession.value = null
  }

  const closeMobileDrawer = () => {
    mobileDrawer.value = null
    suspendedMobileDrawer.value = null
    dragOpenedMobileDrawer.value = null
    drawerBeforeDragOpen.value = null
  }

  const suspendMobileDrawerForDrag = (drawer: Exclude<MobileDrawer, null>) => {
    if (!validMobileDrawers.has(drawer)) return
    if (mobileDrawer.value !== drawer) return
    suspendedMobileDrawer.value = drawer
  }

  const restoreMobileDrawerAfterDrag = () => {
    if (!suspendedMobileDrawer.value) return
    suspendedMobileDrawer.value = null
  }

  const openMobileDrawerForDrag = (drawer: Exclude<MobileDrawer, null>) => {
    if (!validMobileDrawers.has(drawer)) return
    if (dragOpenedMobileDrawer.value === drawer) return
    drawerBeforeDragOpen.value = mobileDrawer.value
    dragOpenedMobileDrawer.value = drawer
    suspendedMobileDrawer.value = null
    mobileDrawer.value = drawer
  }

  const restoreMobileDrawerOpenedForDrag = () => {
    if (!dragOpenedMobileDrawer.value) return
    mobileDrawer.value = drawerBeforeDragOpen.value
    dragOpenedMobileDrawer.value = null
    drawerBeforeDragOpen.value = null
  }

  return {
    activeTool,
    activeWorkbenchDialog,
    assignmentWorkbenchPanel,
    focusedRuleId,
    isWorkbenchDialogHidden,
    zoneEditSession,
    rightRailTab,
    mobileDrawer,
    suspendedMobileDrawer,
    dragOpenedMobileDrawer,
    setTool,
    resetTool,
    openDialog,
    closeDialog,
    startZoneEditSession,
    finishZoneEditSession,
    setRightRailTab,
    showMobileDrawer,
    openMobileDrawer,
    closeMobileDrawer,
    suspendMobileDrawerForDrag,
    restoreMobileDrawerAfterDrag,
    openMobileDrawerForDrag,
    restoreMobileDrawerOpenedForDrag
  }
}
