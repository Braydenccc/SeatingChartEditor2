import { ref } from 'vue'

export type EditorTool = 'normal' | 'swap' | 'clear' | 'empty'
export type WorkbenchDialog = 'seatConfig' | 'shiftRotation' | 'zoneRotation' | 'assignment' | 'rules' | null
export type AssignmentWorkbenchPanel = 'run' | 'rules' | 'guide'
export type RightRailTab = 'candidates' | 'selection' | 'activity'
export type MobileDrawer = 'candidates' | 'selection' | 'activity' | 'tools' | null
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
  'activity',
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
  }

  const closeDialog = () => {
    activeWorkbenchDialog.value = null
    isWorkbenchDialogHidden.value = false
    zoneEditSession.value = null
    focusedRuleId.value = ''
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
    mobileDrawer.value = mobileDrawer.value === drawer ? null : drawer
    activeWorkbenchDialog.value = null
    isWorkbenchDialogHidden.value = false
    zoneEditSession.value = null
  }

  const closeMobileDrawer = () => {
    mobileDrawer.value = null
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
    setTool,
    resetTool,
    openDialog,
    closeDialog,
    startZoneEditSession,
    finishZoneEditSession,
    setRightRailTab,
    openMobileDrawer,
    closeMobileDrawer
  }
}
