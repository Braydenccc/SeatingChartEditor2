import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NPopconfirm } from 'naive-ui'
import ZoneItem from '../ZoneItem.vue'
import ZoneList from '../ZoneList.vue'
import type { EntityDeletionResult } from '@/types/models'

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
    deleteZone: vi.fn<(zoneId: number) => EntityDeletionResult>(() => ({ success: true, references: [] })),
    addTagToZone: vi.fn(),
    removeTagFromZone: vi.fn(),
    getZoneColor: vi.fn(() => 'var(--color-info)'),
    toggleZoneVisible: vi.fn(),
    finishZoneEditing: vi.fn(),
    startGlobalZoneEditing: vi.fn(),
    warning: vi.fn(),
    alert: vi.fn(() => Promise.resolve()),
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
  useLogger: () => ({ warning: mocks.warning, success: mocks.success }),
  useUiFeedback: () => ({ warning: mocks.warning, alert: mocks.alert, success: mocks.success })
}))

describe('ZoneList', () => {
  const mountedWrappers: Array<ReturnType<typeof mount>> = []

  const confirmZoneDeletion = (wrapper: ReturnType<typeof mount>) => {
    const onPositiveClick = wrapper.findComponent(NPopconfirm).props('onPositiveClick') as (() => void) | undefined
    expect(onPositiveClick).toBeTypeOf('function')
    onPositiveClick?.()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedZoneId.value = null
    mocks.deleteZone.mockReturnValue({ success: true, references: [] })
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

    await wrapper.get('[aria-label="重命名选区 前排"]').trigger('click')
    expect(mocks.startGlobalZoneEditing).not.toHaveBeenCalled()
    expect(wrapper.get('input[aria-label="修改选区 前排 的名称"]').attributes('aria-label')).toBe('修改选区 前排 的名称')
  })

  it('does not select the zone while double-clicking its name to rename it', async () => {
    const wrapper = mount(ZoneList)
    mountedWrappers.push(wrapper)
    const name = wrapper.get('.zone-name')

    await name.trigger('click')
    await name.trigger('click')
    await name.trigger('dblclick')

    expect(mocks.startGlobalZoneEditing).not.toHaveBeenCalled()
    expect(mocks.finishZoneEditing).not.toHaveBeenCalled()
    expect(wrapper.get('input[aria-label="修改选区 前排 的名称"]').attributes('aria-label')).toBe('修改选区 前排 的名称')
  })

  it('reports the rules that block a zone deletion', async () => {
    mocks.deleteZone.mockReturnValue({
      success: false,
      reason: 'referenced-by-rules',
      references: [{
        entityType: 'zone',
        entityId: 1,
        ruleId: 'rule-1',
        ruleDescription: '前排规则',
        predicate: 'IN_ZONE',
        locations: ['$.params.zoneId']
      }]
    })
    const wrapper = mount(ZoneList)
    mountedWrappers.push(wrapper)

    confirmZoneDeletion(wrapper)
    await wrapper.vm.$nextTick()

    expect(mocks.warning).toHaveBeenCalledWith(
      expect.stringContaining('“前排规则”（rule-1）'),
      expect.objectContaining({ references: expect.any(Array) }),
      false
    )
    expect(mocks.alert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '无法删除选区',
        content: expect.stringContaining('“前排规则”（rule-1）'),
        positiveText: '知道了',
        type: 'warning'
      })
    )
    expect(mocks.finishZoneEditing).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('reports success exactly once after the parent confirms deletion', async () => {
    const wrapper = mount(ZoneList)
    mountedWrappers.push(wrapper)

    confirmZoneDeletion(wrapper)
    await wrapper.vm.$nextTick()

    expect(mocks.deleteZone).toHaveBeenCalledWith(1)
    expect(mocks.success).toHaveBeenCalledTimes(1)
    expect(mocks.success).toHaveBeenCalledWith('已成功删除选区“前排”')
  })
})
