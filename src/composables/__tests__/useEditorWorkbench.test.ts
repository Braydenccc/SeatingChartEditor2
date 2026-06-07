import { describe, expect, it, beforeEach } from 'vitest'
import { useEditorWorkbench } from '../useEditorWorkbench'

describe('useEditorWorkbench', () => {
  let workbench: ReturnType<typeof useEditorWorkbench>

  beforeEach(() => {
    workbench = useEditorWorkbench()
    workbench.resetTool()
    workbench.closeDialog()
    workbench.finishZoneEditSession()
    workbench.setRightRailTab('candidates')
    workbench.closeMobileDrawer()
    workbench.exitSeatFullscreen()
  })

  it('tracks active tool', () => {
    workbench.setTool('swap')
    expect(workbench.activeTool.value).toBe('swap')

    workbench.resetTool()
    expect(workbench.activeTool.value).toBe('normal')
  })

  it('opens and closes a workbench dialog', () => {
    workbench.openDialog('assignment')
    expect(workbench.activeWorkbenchDialog.value).toBe('assignment')
    expect(workbench.assignmentWorkbenchPanel.value).toBe('run')
    expect(workbench.mobileDrawer.value).toBeNull()
    expect(workbench.mobileSheet.value).toBeNull()

    workbench.closeDialog()
    expect(workbench.activeWorkbenchDialog.value).toBeNull()
  })

  it('opens rules inside the assignment workbench', () => {
    workbench.openDialog('rules', { focusRuleId: 'rule-1' })

    expect(workbench.activeWorkbenchDialog.value).toBe('assignment')
    expect(workbench.assignmentWorkbenchPanel.value).toBe('rules')
    expect(workbench.focusedRuleId.value).toBe('rule-1')
  })

  it('hides the active dialog while editing a zone', () => {
    workbench.openDialog('assignment')

    workbench.startZoneEditSession({
      kind: 'assignment',
      sourceDialog: 'assignment',
      zoneId: 1,
      title: 'A区'
    })

    expect(workbench.activeWorkbenchDialog.value).toBe('assignment')
    expect(workbench.isWorkbenchDialogHidden.value).toBe(true)
    expect(workbench.zoneEditSession.value?.zoneId).toBe(1)
    expect(workbench.rightRailTab.value).toBe('selection')

    workbench.finishZoneEditSession()
    expect(workbench.activeWorkbenchDialog.value).toBe('assignment')
    expect(workbench.isWorkbenchDialogHidden.value).toBe(false)
    expect(workbench.zoneEditSession.value).toBeNull()
  })

  it('clears zone editing state when closing dialogs', () => {
    workbench.startZoneEditSession({
      kind: 'rotation',
      sourceDialog: 'zoneRotation',
      groupId: 1,
      zoneId: 2,
      title: '轮换选区'
    })

    workbench.closeDialog()
    expect(workbench.activeWorkbenchDialog.value).toBeNull()
    expect(workbench.isWorkbenchDialogHidden.value).toBe(false)
    expect(workbench.zoneEditSession.value).toBeNull()
  })

  it('switches right rail tabs', () => {
    workbench.setRightRailTab('activity')
    expect(workbench.rightRailTab.value).toBe('activity')
  })

  it('toggles mobile drawers and keeps dialogs closed', () => {
    workbench.openDialog('rules')
    workbench.openMobileDrawer('candidates')
    expect(workbench.mobileDrawer.value).toBe('candidates')
    expect(workbench.mobileSheet.value).toBe('candidates')
    expect(workbench.activeWorkbenchDialog.value).toBeNull()

    workbench.openMobileDrawer('candidates')
    expect(workbench.mobileDrawer.value).toBeNull()
    expect(workbench.mobileSheet.value).toBeNull()
  })

  it('maps the legacy selection drawer to the context sheet', () => {
    workbench.showMobileDrawer('selection')
    expect(workbench.mobileDrawer.value).toBe('selection')
    expect(workbench.mobileSheet.value).toBe('context')

    workbench.closeMobileSheet()
    expect(workbench.mobileDrawer.value).toBeNull()
    expect(workbench.mobileSheet.value).toBeNull()
  })

  it('switches mobile sheets exclusively and closes them when opening dialogs', () => {
    workbench.showMobileSheet('context')
    expect(workbench.mobileSheet.value).toBe('context')
    expect(workbench.mobileDrawer.value).toBe('selection')

    workbench.showMobileSheet('tools')
    expect(workbench.mobileSheet.value).toBe('tools')
    expect(workbench.mobileDrawer.value).toBe('tools')

    workbench.openDialog('seatConfig')
    expect(workbench.activeWorkbenchDialog.value).toBe('seatConfig')
    expect(workbench.mobileSheet.value).toBeNull()
  })

  it('temporarily hides and restores the candidates drawer while dragging', () => {
    workbench.openMobileDrawer('candidates')

    workbench.suspendMobileDrawerForDrag('candidates')
    expect(workbench.mobileDrawer.value).toBe('candidates')
    expect(workbench.suspendedMobileDrawer.value).toBe('candidates')

    workbench.restoreMobileDrawerAfterDrag()
    expect(workbench.mobileDrawer.value).toBe('candidates')
    expect(workbench.suspendedMobileDrawer.value).toBeNull()
  })

  it('does not restore a drawer that was not suspended', () => {
    workbench.openMobileDrawer('selection')

    workbench.suspendMobileDrawerForDrag('candidates')
    expect(workbench.mobileDrawer.value).toBe('selection')
    expect(workbench.mobileSheet.value).toBe('context')

    workbench.restoreMobileDrawerAfterDrag()
    expect(workbench.mobileDrawer.value).toBe('selection')
  })

  it('temporarily opens a drag target drawer and restores the previous drawer', () => {
    workbench.openMobileDrawer('selection')

    workbench.openMobileDrawerForDrag('candidates')
    expect(workbench.mobileDrawer.value).toBe('candidates')
    expect(workbench.dragOpenedMobileDrawer.value).toBe('candidates')

    workbench.restoreMobileDrawerOpenedForDrag()
    expect(workbench.mobileDrawer.value).toBe('selection')
    expect(workbench.dragOpenedMobileDrawer.value).toBeNull()
  })

  it('closes the drag target drawer after drag when no drawer was previously open', () => {
    workbench.openMobileDrawerForDrag('candidates')
    expect(workbench.mobileDrawer.value).toBe('candidates')

    workbench.restoreMobileDrawerOpenedForDrag()
    expect(workbench.mobileDrawer.value).toBeNull()
  })

  it('enters and exits seat fullscreen while closing mobile sheets', () => {
    workbench.showMobileSheet('candidates')

    workbench.enterSeatFullscreen()
    expect(workbench.mobileViewMode.value).toBe('seatFullscreen')
    expect(workbench.isSeatFullscreen.value).toBe(true)
    expect(workbench.mobileSheet.value).toBeNull()

    workbench.showMobileSheet('tools')
    workbench.exitSeatFullscreen()
    expect(workbench.mobileViewMode.value).toBe('normal')
    expect(workbench.isSeatFullscreen.value).toBe(false)
    expect(workbench.mobileSheet.value).toBeNull()
  })

  it('toggles seat fullscreen', () => {
    workbench.toggleSeatFullscreen()
    expect(workbench.isSeatFullscreen.value).toBe(true)

    workbench.toggleSeatFullscreen()
    expect(workbench.isSeatFullscreen.value).toBe(false)
  })
})
