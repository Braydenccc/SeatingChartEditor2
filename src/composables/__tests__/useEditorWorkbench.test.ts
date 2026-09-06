import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useEditorWorkbench } from '../useEditorWorkbench'

describe('useEditorWorkbench', () => {
  let workbench: ReturnType<typeof useEditorWorkbench>

  beforeEach(async () => {
    workbench = useEditorWorkbench()
    await workbench.resetTransientWorkbenchState()
    workbench.setRightRailTab('candidates')
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

  it('stores an isolated seat configuration draft for the advanced dialog', () => {
    const initialConfig = {
      groupCount: 2,
      columnsPerGroup: 2,
      seatsPerColumn: 7,
      groups: [{ columns: 2, rows: 7 }, { columns: 3, rows: 6 }],
      shiftDistance: 3,
      podiumPosition: 'top' as const,
      guardSeats: {
        enabled: true,
        leftEnabled: true,
        rightEnabled: false,
        includeInAutoAssignment: false,
        hideEmptyOnExport: true
      }
    }

    workbench.openDialog('seatConfig', { seatConfig: initialConfig })

    expect(workbench.seatConfigDialogInitialConfig.value).toEqual(initialConfig)
    initialConfig.groups[0].columns = 5
    initialConfig.guardSeats.enabled = false
    expect(workbench.seatConfigDialogInitialConfig.value?.groups?.[0].columns).toBe(2)
    expect(workbench.seatConfigDialogInitialConfig.value?.guardSeats?.enabled).toBe(true)

    workbench.closeDialog()
    expect(workbench.seatConfigDialogInitialConfig.value).toBeNull()
  })

  it('does not reuse an earlier seat configuration draft', () => {
    workbench.openDialog('seatConfig', { seatConfig: { groupCount: 2 } })
    expect(workbench.seatConfigDialogInitialConfig.value?.groupCount).toBe(2)

    workbench.openDialog('seatConfig')
    expect(workbench.seatConfigDialogInitialConfig.value).toBeNull()
  })

  it('resets transient route state without changing the right rail preference', async () => {
    workbench.enterSeatFullscreen()
    workbench.openDialog('rules', { focusRuleId: 'rule-1' })
    workbench.startZoneEditSession({
      kind: 'assignment',
      sourceDialog: 'assignment',
      zoneId: 1,
      title: 'A区'
    })
    workbench.openMobileDrawerForDrag('candidates')
    workbench.suspendMobileDrawerForDrag('candidates')
    workbench.setRightRailTab('activity')

    await workbench.resetTransientWorkbenchState()

    expect(workbench.activeWorkbenchDialog.value).toBeNull()
    expect(workbench.assignmentWorkbenchPanel.value).toBe('run')
    expect(workbench.focusedRuleId.value).toBe('')
    expect(workbench.seatConfigDialogInitialConfig.value).toBeNull()
    expect(workbench.isWorkbenchDialogHidden.value).toBe(false)
    expect(workbench.zoneEditSession.value).toBeNull()
    expect(workbench.mobileSheet.value).toBeNull()
    expect(workbench.mobileDrawer.value).toBeNull()
    expect(workbench.suspendedMobileDrawer.value).toBeNull()
    expect(workbench.dragOpenedMobileDrawer.value).toBeNull()
    expect(workbench.mobileViewMode.value).toBe('normal')
    expect(workbench.rightRailTab.value).toBe('activity')
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

  it('attempts native fullscreen and landscape locking when entering seat fullscreen', async () => {
    let fullscreenElement: Element | null = null
    const originalRequestFullscreen = document.documentElement.requestFullscreen
    const originalExitFullscreen = document.exitFullscreen
    const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')
    const orientationDescriptor = Object.getOwnPropertyDescriptor(window.screen, 'orientation')
    const lock = vi.fn().mockResolvedValue(undefined)
    const unlock = vi.fn()

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement
    })
    document.documentElement.requestFullscreen = vi.fn(async () => {
      fullscreenElement = document.documentElement
    })
    document.exitFullscreen = vi.fn(async () => {
      fullscreenElement = null
    })
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: { lock, unlock }
    })

    workbench.enterSeatFullscreen()

    await vi.waitFor(() => {
      expect(document.documentElement.requestFullscreen).toHaveBeenCalled()
      expect(lock).toHaveBeenCalledWith('landscape')
    })

    workbench.exitSeatFullscreen()

    await vi.waitFor(() => {
      expect(unlock).toHaveBeenCalled()
      expect(document.exitFullscreen).toHaveBeenCalled()
    })

    document.documentElement.requestFullscreen = originalRequestFullscreen
    document.exitFullscreen = originalExitFullscreen
    if (fullscreenDescriptor) {
      Object.defineProperty(document, 'fullscreenElement', fullscreenDescriptor)
    }
    if (orientationDescriptor) {
      Object.defineProperty(window.screen, 'orientation', orientationDescriptor)
    }
  })

  it('leaves css fullscreen when native fullscreen exits externally', async () => {
    let fullscreenElement: Element | null = null
    const originalRequestFullscreen = document.documentElement.requestFullscreen
    const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')
    const orientationDescriptor = Object.getOwnPropertyDescriptor(window.screen, 'orientation')
    const unlock = vi.fn()

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement
    })
    document.documentElement.requestFullscreen = vi.fn(async () => {
      fullscreenElement = document.documentElement
    })
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: { lock: vi.fn().mockResolvedValue(undefined), unlock }
    })

    workbench.enterSeatFullscreen()
    await vi.waitFor(() => {
      expect(document.documentElement.requestFullscreen).toHaveBeenCalled()
      expect(workbench.isSeatFullscreen.value).toBe(true)
    })

    fullscreenElement = null
    document.dispatchEvent(new Event('fullscreenchange'))

    expect(workbench.isSeatFullscreen.value).toBe(false)
    expect(workbench.mobileViewMode.value).toBe('normal')
    expect(unlock).toHaveBeenCalled()

    document.documentElement.requestFullscreen = originalRequestFullscreen
    if (fullscreenDescriptor) {
      Object.defineProperty(document, 'fullscreenElement', fullscreenDescriptor)
    }
    if (orientationDescriptor) {
      Object.defineProperty(window.screen, 'orientation', orientationDescriptor)
    }
  })

  it('exits native fullscreen if route cleanup wins a pending fullscreen request', async () => {
    let fullscreenElement: Element | null = null
    let finishRequest: () => void = () => undefined
    const originalRequestFullscreen = document.documentElement.requestFullscreen
    const originalExitFullscreen = document.exitFullscreen
    const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement
    })
    document.documentElement.requestFullscreen = vi.fn(() => new Promise<void>((resolve) => {
      finishRequest = () => {
        fullscreenElement = document.documentElement
        resolve()
      }
    }))
    document.exitFullscreen = vi.fn(async () => {
      fullscreenElement = null
    })

    workbench.enterSeatFullscreen()
    await vi.waitFor(() => {
      expect(document.documentElement.requestFullscreen).toHaveBeenCalled()
    })

    await workbench.resetTransientWorkbenchState()
    expect(workbench.isSeatFullscreen.value).toBe(false)

    finishRequest()
    await vi.waitFor(() => {
      expect(document.exitFullscreen).toHaveBeenCalled()
    })

    document.documentElement.requestFullscreen = originalRequestFullscreen
    document.exitFullscreen = originalExitFullscreen
    if (fullscreenDescriptor) {
      Object.defineProperty(document, 'fullscreenElement', fullscreenDescriptor)
    }
  })

  it('keeps a newer fullscreen request owned when an older request rejects', async () => {
    let fullscreenElement: Element | null = null
    let rejectFirstRequest: (reason?: unknown) => void = () => undefined
    let finishSecondRequest: () => void = () => undefined
    const originalRequestFullscreen = document.documentElement.requestFullscreen
    const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement
    })
    document.documentElement.requestFullscreen = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => {
        rejectFirstRequest = reject
      }))
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        finishSecondRequest = () => {
          fullscreenElement = document.documentElement
          resolve()
        }
      }))

    workbench.enterSeatFullscreen()
    await vi.waitFor(() => {
      expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
    })

    workbench.exitSeatFullscreen()
    workbench.enterSeatFullscreen()
    await vi.waitFor(() => {
      expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(2)
    })

    rejectFirstRequest(new Error('older request rejected'))
    finishSecondRequest()
    await vi.waitFor(() => {
      expect(workbench.isSeatFullscreen.value).toBe(true)
      expect(document.fullscreenElement).toBe(document.documentElement)
    })

    fullscreenElement = null
    document.dispatchEvent(new Event('fullscreenchange'))

    expect(workbench.isSeatFullscreen.value).toBe(false)
    expect(workbench.mobileViewMode.value).toBe('normal')

    document.documentElement.requestFullscreen = originalRequestFullscreen
    if (fullscreenDescriptor) {
      Object.defineProperty(document, 'fullscreenElement', fullscreenDescriptor)
    }
  })

  it('keeps fullscreen ownership when an older request succeeds before a newer request rejects', async () => {
    let fullscreenElement: Element | null = null
    let finishFirstRequest: () => void = () => undefined
    let rejectSecondRequest: (reason?: unknown) => void = () => undefined
    const originalRequestFullscreen = document.documentElement.requestFullscreen
    const originalExitFullscreen = document.exitFullscreen
    const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')
    const orientationDescriptor = Object.getOwnPropertyDescriptor(window.screen, 'orientation')
    const lock = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement
    })
    document.documentElement.requestFullscreen = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        finishFirstRequest = () => {
          fullscreenElement = document.documentElement
          resolve()
        }
      }))
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => {
        rejectSecondRequest = reject
      }))
    document.exitFullscreen = vi.fn(async () => {
      fullscreenElement = null
    })
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: { lock, unlock: vi.fn() }
    })

    workbench.enterSeatFullscreen()
    await vi.waitFor(() => {
      expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
    })

    workbench.exitSeatFullscreen()
    workbench.enterSeatFullscreen()
    await vi.waitFor(() => {
      expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(2)
    })

    finishFirstRequest()
    await vi.waitFor(() => {
      expect(document.fullscreenElement).toBe(document.documentElement)
    })

    rejectSecondRequest(new Error('newer request rejected'))
    await vi.waitFor(() => {
      expect(lock).toHaveBeenCalledWith('landscape')
    })

    workbench.exitSeatFullscreen()
    await vi.waitFor(() => {
      expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
      expect(document.fullscreenElement).toBeNull()
    })

    document.documentElement.requestFullscreen = originalRequestFullscreen
    document.exitFullscreen = originalExitFullscreen
    if (fullscreenDescriptor) {
      Object.defineProperty(document, 'fullscreenElement', fullscreenDescriptor)
    }
    if (orientationDescriptor) {
      Object.defineProperty(window.screen, 'orientation', orientationDescriptor)
    }
  })

  it('keeps css fullscreen state when native fullscreen or orientation locking fails', async () => {
    const originalRequestFullscreen = document.documentElement.requestFullscreen
    const orientationDescriptor = Object.getOwnPropertyDescriptor(window.screen, 'orientation')

    document.documentElement.requestFullscreen = vi.fn().mockRejectedValue(new Error('not supported'))
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: {
        lock: vi.fn().mockRejectedValue(new Error('lock failed')),
        unlock: vi.fn()
      }
    })

    workbench.enterSeatFullscreen()

    expect(workbench.mobileViewMode.value).toBe('seatFullscreen')
    expect(workbench.isSeatFullscreen.value).toBe(true)
    await vi.waitFor(() => {
      expect(document.documentElement.requestFullscreen).toHaveBeenCalled()
    })

    workbench.exitSeatFullscreen()
    expect(workbench.mobileViewMode.value).toBe('normal')

    document.documentElement.requestFullscreen = originalRequestFullscreen
    if (orientationDescriptor) {
      Object.defineProperty(window.screen, 'orientation', orientationDescriptor)
    }
  })
})
