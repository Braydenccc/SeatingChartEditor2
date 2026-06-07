import { computed, ref } from 'vue'

export type EditorTool = 'normal' | 'swap' | 'clear' | 'empty'
export type WorkbenchDialog = 'seatConfig' | 'shiftRotation' | 'zoneRotation' | 'assignment' | 'rules' | null
export type AssignmentWorkbenchPanel = 'run' | 'rules' | 'guide'
export type RightRailTab = 'candidates' | 'selection' | 'activity'
export type MobileDrawer = 'candidates' | 'selection' | 'tools' | null
export type MobileSheet = 'candidates' | 'context' | 'tools' | null
export type MobileViewMode = 'normal' | 'seatFullscreen'
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
const mobileSheet = ref<MobileSheet>(null)
const mobileViewMode = ref<MobileViewMode>('normal')
const suspendedMobileDrawer = ref<MobileDrawer>(null)
const dragOpenedMobileDrawer = ref<MobileDrawer>(null)
const drawerBeforeDragOpen = ref<MobileDrawer>(null)
const isSeatFullscreen = computed(() => mobileViewMode.value === 'seatFullscreen')

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
const validMobileSheets = new Set<Exclude<MobileSheet, null>>([
  'candidates',
  'context',
  'tools'
])

const drawerToSheet = (drawer: Exclude<MobileDrawer, null>): Exclude<MobileSheet, null> => (
  drawer === 'selection' ? 'context' : drawer
)

const sheetToDrawer = (sheet: MobileSheet): MobileDrawer => (
  sheet === 'context' ? 'selection' : sheet
)

const mobileDrawer = computed<MobileDrawer>({
  get: () => sheetToDrawer(mobileSheet.value),
  set: (drawer) => {
    mobileSheet.value = drawer ? drawerToSheet(drawer) : null
  }
})

export function useEditorWorkbench() {
  const resetMobileDragState = () => {
    suspendedMobileDrawer.value = null
    dragOpenedMobileDrawer.value = null
    drawerBeforeDragOpen.value = null
  }

  const closeMobileSheet = () => {
    mobileSheet.value = null
    resetMobileDragState()
  }

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
    closeMobileSheet()
  }

  const closeDialog = () => {
    activeWorkbenchDialog.value = null
    isWorkbenchDialogHidden.value = false
    zoneEditSession.value = null
    focusedRuleId.value = ''
    closeMobileSheet()
  }

  const startZoneEditSession = (session: ZoneEditSession) => {
    if (!validDialogs.has(session.sourceDialog)) return
    if (activeWorkbenchDialog.value !== session.sourceDialog) {
      activeWorkbenchDialog.value = session.sourceDialog
    }
    zoneEditSession.value = session
    isWorkbenchDialogHidden.value = true
    rightRailTab.value = 'selection'
    closeMobileSheet()
  }

  const finishZoneEditSession = () => {
    zoneEditSession.value = null
    isWorkbenchDialogHidden.value = false
  }

  const setRightRailTab = (tab: RightRailTab) => {
    if (!validRightTabs.has(tab)) return
    rightRailTab.value = tab
  }

  const showMobileSheet = (sheet: Exclude<MobileSheet, null>) => {
    if (!validMobileSheets.has(sheet)) return
    resetMobileDragState()
    mobileSheet.value = sheet
    activeWorkbenchDialog.value = null
    isWorkbenchDialogHidden.value = false
    zoneEditSession.value = null
  }

  const openMobileSheet = (sheet: Exclude<MobileSheet, null>) => {
    if (!validMobileSheets.has(sheet)) return
    resetMobileDragState()
    mobileSheet.value = mobileSheet.value === sheet ? null : sheet
    activeWorkbenchDialog.value = null
    isWorkbenchDialogHidden.value = false
    zoneEditSession.value = null
  }

  const enterSeatFullscreen = () => {
    mobileViewMode.value = 'seatFullscreen'
    closeMobileSheet()
  }

  const exitSeatFullscreen = () => {
    mobileViewMode.value = 'normal'
    closeMobileSheet()
  }

  const toggleSeatFullscreen = () => {
    if (isSeatFullscreen.value) {
      exitSeatFullscreen()
      return
    }
    enterSeatFullscreen()
  }

  const openMobileDrawer = (drawer: Exclude<MobileDrawer, null>) => {
    if (!validMobileDrawers.has(drawer)) return
    openMobileSheet(drawerToSheet(drawer))
  }

  const showMobileDrawer = (drawer: Exclude<MobileDrawer, null>) => {
    if (!validMobileDrawers.has(drawer)) return
    showMobileSheet(drawerToSheet(drawer))
  }

  const closeMobileDrawer = () => {
    closeMobileSheet()
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
    mobileSheet.value = drawerToSheet(drawer)
  }

  const restoreMobileDrawerOpenedForDrag = () => {
    if (!dragOpenedMobileDrawer.value) return
    mobileSheet.value = drawerBeforeDragOpen.value ? drawerToSheet(drawerBeforeDragOpen.value) : null
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
    mobileSheet,
    mobileViewMode,
    isSeatFullscreen,
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
    showMobileSheet,
    openMobileSheet,
    closeMobileSheet,
    enterSeatFullscreen,
    exitSeatFullscreen,
    toggleSeatFullscreen,
    showMobileDrawer,
    openMobileDrawer,
    closeMobileDrawer,
    suspendMobileDrawerForDrag,
    restoreMobileDrawerAfterDrag,
    openMobileDrawerForDrag,
    restoreMobileDrawerOpenedForDrag
  }
}
