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
    expect(workbench.activeWorkbenchDialog.value).toBeNull()

    workbench.openMobileDrawer('candidates')
    expect(workbench.mobileDrawer.value).toBeNull()
  })
})
