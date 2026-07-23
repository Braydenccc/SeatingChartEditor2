import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ZoneItem from '../ZoneItem.vue'
import ZoneList from '../ZoneList.vue'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    zones: ref([{
      id: 1,
      name: '前排',
      seatIds: ['seat-1'],
      tagIds: [7],
      visible: true
    }]),
    selectedZoneId: ref<number | null>(null),
    tags: ref([{ id: 7, name: '重点', color: 'var(--color-info)' }]),
    activeWorkbenchDialog: ref<string | null>(null),
    addZone: vi.fn(),
    updateZone: vi.fn(),
    deleteZone: vi.fn(),
    addTagToZone: vi.fn(),
    removeTagFromZone: vi.fn(),
    getZoneColor: vi.fn(() => 'var(--color-info)'),
    toggleZoneVisible: vi.fn(),
    finishZoneEditing: vi.fn(),
    startGlobalZoneEditing: vi.fn(),
    warning: vi.fn(),
    success: vi.fn()
  }
})

vi.mock('@/composables/useZoneData', () => ({
  useZoneData: () => ({
    zones: mocks.zones,
    selectedZoneId: mocks.selectedZoneId,
    addZone: mocks.addZone,
    updateZone: mocks.updateZone,
    deleteZone: mocks.deleteZone,
    addTagToZone: mocks.addTagToZone,
    removeTagFromZone: mocks.removeTagFromZone,
    getZoneColor: mocks.getZoneColor,
    toggleZoneVisible: mocks.toggleZoneVisible
  })
}))
vi.mock('@/composables/useTagData', () => ({ useTagData: () => ({ tags: mocks.tags }) }))
vi.mock('@/composables/useEditorWorkbench', () => ({
  useEditorWorkbench: () => ({ activeWorkbenchDialog: mocks.activeWorkbenchDialog })
}))
vi.mock('@/composables/useEditorCommands', () => ({
  useEditorCommands: () => ({
    finishZoneEditing: mocks.finishZoneEditing,
    startGlobalZoneEditing: mocks.startGlobalZoneEditing
  })
}))
vi.mock('@/composables/useLogger', () => ({
  useLogger: () => ({ warning: mocks.warning, success: mocks.success })
}))

describe('ZoneList', () => {
  const mountedWrappers: Array<ReturnType<typeof mount>> = []

  beforeEach(() => {
    mocks.selectedZoneId.value = null
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('renders the imported ZoneItem and provides a keyboard-accessible edit action', async () => {
    const wrapper = mount(ZoneList)
    mountedWrappers.push(wrapper)

    expect(wrapper.get('[role="list"]').attributes('role')).toBe('list')
    expect(wrapper.findComponent(ZoneItem).exists()).toBe(true)
    expect(wrapper.get('[role="listitem"]').attributes('aria-label')).toBe('选区 前排')

    await wrapper.get('[aria-label="编辑选区 前排 的座位"]').trigger('click')

    expect(mocks.startGlobalZoneEditing).toHaveBeenCalledTimes(1)
    expect(mocks.startGlobalZoneEditing).toHaveBeenCalledWith(1, undefined)
  })

  it('names nested controls and prevents them from selecting the zone', async () => {
    const wrapper = mount(ZoneList)
    mountedWrappers.push(wrapper)

    expect(wrapper.get('[aria-label="前排 显示状态"]').attributes('aria-label')).toBe('前排 显示状态')
    expect(wrapper.get('[aria-label="从 前排 移除标签 重点"]').attributes('aria-label')).toBe('从 前排 移除标签 重点')
    expect(wrapper.get('[aria-label="为 前排 添加标签"]').attributes('aria-label')).toBe('为 前排 添加标签')

    await wrapper.get('[aria-label="从 前排 移除标签 重点"]').trigger('click')
    expect(mocks.removeTagFromZone).toHaveBeenCalledWith(1, 7)
    expect(mocks.startGlobalZoneEditing).not.toHaveBeenCalled()

    await wrapper.get('.zone-name').trigger('dblclick')
    expect(wrapper.get('input[aria-label="修改选区 前排 的名称"]').attributes('aria-label')).toBe('修改选区 前排 的名称')
  })
})
