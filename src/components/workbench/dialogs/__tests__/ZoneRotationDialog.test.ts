import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ZoneRotationDialog from '../ZoneRotationDialog.vue'
import { useEditMode } from '@/composables/useEditMode'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useZoneRotation } from '@/composables/useZoneRotation'

const ResponsiveOverlayStub = defineComponent({
  name: 'ResponsiveOverlay',
  setup(_props, { slots }) {
    return () => h('section', [slots.default?.(), slots.footer?.()])
  }
})

describe('ZoneRotationDialog', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
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

    useZoneRotation().clearAllRotData()
    useEditMode().resetEditMode()
    useEditorWorkbench().finishZoneEditSession()
  })

  it('keeps a newly added zone active so its first seat click is accepted', async () => {
    const rotation = useZoneRotation()
    const group = rotation.addRotGroup()
    const wrapper = mount(ZoneRotationDialog, {
      props: { visible: true },
      global: {
        stubs: { ResponsiveOverlay: ResponsiveOverlayStub }
      }
    })

    await wrapper.get('.add-zone-button').trigger('click')

    const zone = group.zones[0]
    expect(zone).toBeDefined()
    expect(rotation.editingZoneId.value).toBe(zone?.id)
    expect(useEditorWorkbench().zoneEditSession.value?.zoneId).toBe(zone?.id)

    rotation.toggleSeatInEditingZone('seat-0-0-0')
    expect(zone?.seatIds).toEqual(['seat-0-0-0'])

    wrapper.unmount()
  })
})
