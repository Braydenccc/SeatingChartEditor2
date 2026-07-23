import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import EditorView from '../EditorView.vue'

vi.mock('@/components/layout/AppHeader.vue', () => ({
  default: { template: '<header />' }
}))

vi.mock('@/components/workbench/EditorWorkbench.vue', () => ({
  default: { template: '<main />' }
}))

describe('EditorView', () => {
  const workbench = useEditorWorkbench()

  beforeEach(async () => {
    await workbench.resetTransientWorkbenchState()
    workbench.setRightRailTab('candidates')
  })

  it('resets transient workbench state when the editor route unmounts', () => {
    const wrapper = shallowMount(EditorView)

    workbench.openDialog('assignment')
    workbench.startZoneEditSession({
      kind: 'assignment',
      sourceDialog: 'assignment',
      zoneId: 1,
      title: 'A区'
    })
    workbench.openMobileDrawerForDrag('candidates')
    workbench.suspendMobileDrawerForDrag('candidates')
    workbench.mobileViewMode.value = 'seatFullscreen'

    wrapper.unmount()

    expect(workbench.activeWorkbenchDialog.value).toBeNull()
    expect(workbench.zoneEditSession.value).toBeNull()
    expect(workbench.isWorkbenchDialogHidden.value).toBe(false)
    expect(workbench.mobileSheet.value).toBeNull()
    expect(workbench.suspendedMobileDrawer.value).toBeNull()
    expect(workbench.dragOpenedMobileDrawer.value).toBeNull()
    expect(workbench.mobileViewMode.value).toBe('normal')
  })
})
