import { computed, nextTick, ref } from 'vue'
import type { SeatConfig } from '@/types/models'

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

export interface WorkbenchDialogOptions {
  panel?: AssignmentWorkbenchPanel
  focusRuleId?: string
  seatConfig?: Partial<SeatConfig>
}

const activeWorkbenchDialog = ref<WorkbenchDialog>(null)
const assignmentWorkbenchPanel = ref<AssignmentWorkbenchPanel>('run')
const focusedRuleId = ref('')
const seatConfigDialogInitialConfig = ref<Partial<SeatConfig> | null>(null)
const isWorkbenchDialogHidden = ref(false)
const zoneEditSession = ref<ZoneEditSession | null>(null)
const rightRailTab = ref<RightRailTab>('candidates')
const mobileSheet = ref<MobileSheet>(null)
const mobileViewMode = ref<MobileViewMode>('normal')
const suspendedMobileDrawer = ref<MobileDrawer>(null)
const dragOpenedMobileDrawer = ref<MobileDrawer>(null)
const drawerBeforeDragOpen = ref<MobileDrawer>(null)
const requestedFullscreenElement = ref<Element | null>(null)
let fullscreenRequestVersion = 0
const isSeatFullscreen = computed(() => mobileViewMode.value === 'seatFullscreen')

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

const cloneSeatConfig = (config: Partial<SeatConfig>): Partial<SeatConfig> => ({
  ...config,
  groups: config.groups?.map(group => ({ ...group })),
  guardSeats: config.guardSeats ? { ...config.guardSeats } : undefined
})

const resetMobileDragState = () => {
  suspendedMobileDrawer.value = null
  dragOpenedMobileDrawer.value = null
  drawerBeforeDragOpen.value = null
}

const requestLandscapeFullscreen = async () => {
  if (typeof document === 'undefined') return

  const requestVersion = ++fullscreenRequestVersion
  await nextTick()
  const fullscreenTarget = document.querySelector('.editor-workbench') || document.documentElement
  try {
    if (!document.fullscreenElement && fullscreenTarget.requestFullscreen) {
      requestedFullscreenElement.value = fullscreenTarget
      await fullscreenTarget.requestFullscreen()
      if (requestVersion !== fullscreenRequestVersion) {
        const newerRequestOwnsTarget = requestedFullscreenElement.value === fullscreenTarget && isSeatFullscreen.value
        if (!newerRequestOwnsTarget && document.fullscreenElement === fullscreenTarget && document.exitFullscreen) {
          await document.exitFullscreen().catch(() => undefined)
        }
        return
      }
    }
  } catch {
    if (
      requestVersion === fullscreenRequestVersion &&
      requestedFullscreenElement.value === fullscreenTarget &&
      document.fullscreenElement !== fullscreenTarget
    ) {
      requestedFullscreenElement.value = null
    }
  }

  if (requestVersion !== fullscreenRequestVersion) return

  try {
    await window.screen?.orientation?.lock?.('landscape')
  } catch {
    // Direction locking is best-effort and unsupported on some mobile browsers.
  }
}

const releaseLandscapeFullscreen = async () => {
  fullscreenRequestVersion += 1
  if (typeof document === 'undefined') {
    requestedFullscreenElement.value = null
    return
  }

  try {
    window.screen?.orientation?.unlock?.()
  } catch {
    // Ignore unsupported unlock calls.
  }

  const fullscreenElement = document.fullscreenElement
  const shouldExitFullscreen = requestedFullscreenElement.value &&
    fullscreenElement === requestedFullscreenElement.value &&
    document.exitFullscreen

  requestedFullscreenElement.value = null
  if (!shouldExitFullscreen) return

  try {
    await document.exitFullscreen()
  } catch {
    // Ignore browsers that reject exitFullscreen after a state change.
  }
}

const handleFullscreenChange = () => {
  if (typeof document === 'undefined' || !requestedFullscreenElement.value) return
  if (document.fullscreenElement === requestedFullscreenElement.value) return

  fullscreenRequestVersion += 1
  requestedFullscreenElement.value = null
  mobileViewMode.value = 'normal'
  mobileSheet.value = null
  resetMobileDragState()

  try {
    window.screen?.orientation?.unlock?.()
  } catch {
    // Ignore unsupported unlock calls.
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
}

const mobileDrawer = computed<MobileDrawer>({
  get: () => sheetToDrawer(mobileSheet.value),
  set: (drawer) => {
    mobileSheet.value = drawer ? drawerToSheet(drawer) : null
  }
})

export function useEditorWorkbench() {
  const closeMobileSheet = () => {
    mobileSheet.value = null
    resetMobileDragState()
  }

  const resetTransientWorkbenchState = () => {
    activeWorkbenchDialog.value = null
    assignmentWorkbenchPanel.value = 'run'
    focusedRuleId.value = ''
    seatConfigDialogInitialConfig.value = null
    isWorkbenchDialogHidden.value = false
    zoneEditSession.value = null
    mobileSheet.value = null
    mobileViewMode.value = 'normal'
    resetMobileDragState()
    return releaseLandscapeFullscreen()
  }

  const openDialog = (
    dialog: Exclude<WorkbenchDialog, null>,
    options: WorkbenchDialogOptions = {}
  ) => {
    if (!validDialogs.has(dialog)) return
    seatConfigDialogInitialConfig.value = dialog === 'seatConfig' && options.seatConfig
      ? cloneSeatConfig(options.seatConfig)
      : null
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
    seatConfigDialogInitialConfig.value = null
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
    void requestLandscapeFullscreen()
  }

  const exitSeatFullscreen = () => {
    mobileViewMode.value = 'normal'
    closeMobileSheet()
    void releaseLandscapeFullscreen()
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
    activeWorkbenchDialog,
    assignmentWorkbenchPanel,
    focusedRuleId,
    seatConfigDialogInitialConfig,
    isWorkbenchDialogHidden,
    zoneEditSession,
    rightRailTab,
    mobileSheet,
    mobileViewMode,
    isSeatFullscreen,
    mobileDrawer,
    suspendedMobileDrawer,
    dragOpenedMobileDrawer,
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
    restoreMobileDrawerOpenedForDrag,
    resetTransientWorkbenchState
  }
}
