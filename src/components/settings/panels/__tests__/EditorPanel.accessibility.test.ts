import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import EditorPanel from '../EditorPanel.vue'
import { useGlobalSettings } from '@/composables/useGlobalSettings'

const { settings, resetSettings } = useGlobalSettings()

describe('EditorPanel accessibility', () => {
  beforeEach(() => resetSettings('editor'))

  it('associates settings with their visible labels and names reset buttons', () => {
    const wrapper = mount(EditorPanel, {
      props: { settings: settings.value.editor }
    })

    const historyInput = wrapper.get('input#editor-undo-history-size')
    expect(historyInput.attributes('aria-labelledby')).toBe('editor-undo-history-label')

    const sliderGroup = wrapper.get('.setting-range')
    expect(sliderGroup.attributes('role')).toBe('group')
    expect(sliderGroup.attributes('aria-labelledby')).toBe('editor-drag-sensitivity-label')

    const selectGroup = wrapper.get('.setting-select')
    expect(selectGroup.attributes('role')).toBe('group')
    expect(selectGroup.attributes('aria-labelledby')).toBe('editor-double-click-label')

    expect(wrapper.findAll('.reset-btn').map(button => button.attributes('aria-label'))).toEqual([
      '恢复默认撤销历史大小',
      '恢复默认拖拽灵敏度',
      '恢复默认双击学生行为'
    ])
    wrapper.unmount()
  })
})
