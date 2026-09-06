import { mount, shallowMount } from '@vue/test-utils'
import { NButton } from 'naive-ui'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AssignmentInlineReport from '../AssignmentInlineReport.vue'
import RuleList from '../RuleList.vue'

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    rules: ref([{
      id: 'rule-1',
      enabled: true,
      priority: 'required',
      predicate: 'IN_ROW_RANGE',
      subjects: [],
      params: { minRow: 1, maxRow: 2 },
      not: false,
      description: ''
    }]),
    renderRuleText: vi.fn(() => '张三必须坐在第 1 至 2 排'),
    renderRuleTextWithoutPriority: vi.fn(() => '张三坐在第 1 至 2 排'),
    detectConflicts: vi.fn(() => [])
  }
})

vi.mock('@/composables/useSeatRules', () => ({
  useSeatRules: () => ({
    rules: mocks.rules,
    renderRuleText: mocks.renderRuleText,
    renderRuleTextWithoutPriority: mocks.renderRuleTextWithoutPriority,
    toggleRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
    clearAllRules: vi.fn(),
    detectConflicts: mocks.detectConflicts
  })
}))
vi.mock('@/composables/useStudentData', () => ({ useStudentData: () => ({ students: mocks.rules.constructor === Array ? [] : { value: [] } }) }))
vi.mock('@/composables/useTagData', () => ({ useTagData: () => ({ tags: { value: [] } }) }))
vi.mock('@/composables/useStudentAttributes', () => ({
  useStudentAttributes: () => ({ attributeDefinitions: { value: [] }, getAttributeById: vi.fn() })
}))
vi.mock('@/composables/useLogger', () => ({
  useLogger: () => ({ success: vi.fn(), confirm: vi.fn().mockResolvedValue(true) })
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('rule disclosure accessibility', () => {
  it('exposes and toggles the satisfied-rules disclosure as a button', async () => {
    const rule = mocks.rules.value[0]
    const wrapper = mount(AssignmentInlineReport, {
      attachTo: document.body,
      props: {
        report: { satRate: 1, satisfied: [rule], violated: [] },
        duration: 12
      }
    })

    const disclosure = wrapper.get('button.toggle-btn')
    expect(disclosure.attributes('aria-expanded')).toBe('false')
    expect(disclosure.attributes('aria-controls')).toBe('assignment-satisfied-rules')

    ;(disclosure.element as HTMLElement).focus()
    expect(document.activeElement).toBe(disclosure.element)
    await disclosure.trigger('click')

    expect(disclosure.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#assignment-satisfied-rules').isVisible()).toBe(true)
    wrapper.unmount()
  })

  it('uses a dedicated button to expand a rule and links it to the detail region', async () => {
    const wrapper = shallowMount(RuleList, {
      global: { renderStubDefaultSlot: true }
    })

    const disclosure = wrapper.findAllComponents(NButton)
      .find(button => button.classes().includes('rule-expand-button'))
    if (!disclosure) throw new Error('missing rule disclosure button')
    expect(disclosure.attributes('aria-expanded')).toBe('false')
    expect(disclosure.attributes('aria-controls')).toBe('rule-detail-rule-1')

    disclosure.vm.$emit('click')
    await nextTick()

    expect(disclosure.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#rule-detail-rule-1').attributes('id')).toBe('rule-detail-rule-1')
    wrapper.unmount()
  })
})
