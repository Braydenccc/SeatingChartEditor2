import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TagStudentSelector from '../TagStudentSelector.vue'

describe('TagStudentSelector accessibility', () => {
  it('associates visible labels with focusable controls and preserves student number zero', async () => {
    const wrapper = mount(TagStudentSelector, {
      attachTo: document.body,
      props: {
        modelValue: [],
        students: [{
          id: 7,
          name: '张三',
          studentNumber: 0,
          tags: [],
          numericAttributes: {}
        }]
      }
    })

    const searchInput = wrapper.get('input#tag-student-search')
    expect(wrapper.get('.selector-label').attributes('for')).toBe('tag-student-search')

    ;(searchInput.element as HTMLElement).focus()
    expect(document.activeElement).toBe(searchInput.element)

    const studentRow = wrapper.get('.student-row')
    expect(studentRow.element.tagName).toBe('DIV')
    expect(studentRow.text()).toContain('#0')

    const checkbox = studentRow.get('[role="checkbox"]')
    expect(checkbox.attributes('aria-labelledby')).toBe('tag-student-label-7')
    expect(studentRow.get('#tag-student-label-7').text()).toBe('张三')
    ;(checkbox.element as HTMLElement).focus()
    expect(document.activeElement).toBe(checkbox.element)
    await checkbox.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[[7]]])
    wrapper.unmount()
  })
})
