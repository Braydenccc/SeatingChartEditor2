import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EditorWorkbench from '../EditorWorkbench.vue'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useSelection } from '@/composables/useSelection'

describe('EditorWorkbench mobile context drawer', () => {
  const workbench = useEditorWorkbench()
  const selection = useSelection()

  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({
        matches: query.includes('max-width: 1024px'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })

    selection.clearSelection()
    await workbench.resetTransientWorkbenchState()
  })

  it('keeps the drawer body in the native flex layout and handles cancellation through the real button', async () => {
    const wrapper = mount(EditorWorkbench, {
      attachTo: document.body,
      global: {
        stubs: {
          ActivityPanel: true,
          BatchEditDialog: true,
          EditorToolDock: true,
          SeatChart: true,
          StudentEditDialog: true,
          StudentPoolPanel: true,
          WorkbenchDialogs: true,
          ZoneEditContextPanel: true
        }
      }
    })
    selection.setSelection(['seat-0-0-0', 'seat-0-0-3'])
    workbench.showMobileDrawer('selection')
    await flushPromises()

    const drawer = wrapper.get('.n-drawer')
    expect(drawer.classes()).toContain('n-drawer--native-scrollbar')
    expect(drawer.get('.n-drawer-content').classes()).toContain('n-drawer-content--native-scrollbar')

    const cancelButton = drawer.findAll('button')
      .find(button => button.text().includes('取消选择'))
    expect(cancelButton).toBeDefined()
    await cancelButton!.trigger('click')
    await flushPromises()

    expect(selection.selectedCount.value).toBe(0)
    expect(workbench.mobileDrawer.value).toBeNull()
    wrapper.unmount()
  })
})
