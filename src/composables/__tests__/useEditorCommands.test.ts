import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditMode } from '../useEditMode'
import { useEditorCommands } from '../useEditorCommands'
import { useEditorWorkbench } from '../useEditorWorkbench'
import { useSelection } from '../useSelection'
import { useZoneData } from '../useZoneData'
import { useZoneRotation } from '../useZoneRotation'

describe('useEditorCommands', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })

    useEditMode().resetEditMode()
    const selection = useSelection()
    selection.clearSelection()
    if (selection.isSelectionMode.value) selection.toggleSelectionMode()
    const workbench = useEditorWorkbench()
    workbench.closeDialog()
    workbench.closeMobileDrawer()
    workbench.finishZoneEditSession()
    useZoneData().clearZoneSelection()
    useZoneRotation().clearEditingZone()
  })

  it('cleans incompatible state before activating a specialized tool', () => {
    const editMode = useEditMode()
    const selection = useSelection()
    const workbench = useEditorWorkbench()
    editMode.setFirstSelectedSeat('seat-1')
    selection.toggleSelectionMode()
    workbench.showMobileDrawer('candidates')

    useEditorCommands().activateTool('swap')

    expect(editMode.currentMode.value).toBe(editMode.EditMode.SWAP)
    expect(editMode.firstSelectedSeat.value).toBeNull()
    expect(selection.isSelectionMode.value).toBe(false)
    expect(workbench.mobileDrawer.value).toBeNull()
  })

  it('returns to normal when the active specialized tool is selected again', () => {
    const commands = useEditorCommands()
    const editMode = useEditMode()

    commands.activateTool('clear')
    commands.activateTool('clear')

    expect(editMode.currentMode.value).toBe(editMode.EditMode.NORMAL)
  })

  it('coordinates global and rotation zone editing sessions', () => {
    const commands = useEditorCommands()
    const editMode = useEditMode()
    const zones = useZoneData()
    const rotation = useZoneRotation()
    const workbench = useEditorWorkbench()

    commands.startGlobalZoneEditing(7, {
      kind: 'assignment',
      sourceDialog: 'assignment',
      zoneId: 7,
      title: '排位区域'
    })
    expect(zones.selectedZoneId.value).toBe(7)
    expect(rotation.editingZoneId.value).toBeNull()
    expect(editMode.currentMode.value).toBe(editMode.EditMode.ZONE_EDIT)
    expect(workbench.zoneEditSession.value?.kind).toBe('assignment')

    commands.startRotationZoneEditing(9, {
      kind: 'rotation',
      sourceDialog: 'zoneRotation',
      zoneId: 9,
      title: '轮换区域'
    })
    expect(zones.selectedZoneId.value).toBeNull()
    expect(rotation.editingZoneId.value).toBe(9)
    expect(workbench.zoneEditSession.value?.kind).toBe('rotation')
  })
})
