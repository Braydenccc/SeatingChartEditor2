import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import UIPanel from '../UIPanel.vue'
import { useGlobalSettings } from '@/composables/useGlobalSettings'

const {
  settings,
  resetSettings,
  applyColorScheme,
  applyThemeColor
} = useGlobalSettings()

describe('UIPanel theme switching', () => {
  beforeEach(() => {
    resetSettings('ui')
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('style')
    applyColorScheme()
    applyThemeColor()
  })

  it('recalculates the simple theme color when switching from light to dark', async () => {
    const wrapper = mount(UIPanel, {
      props: { settings: settings.value.ui }
    })
    const lightPrimary = document.documentElement.style.getPropertyValue('--color-primary')

    await wrapper.get('input[value="dark"]').setValue(true)

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--color-primary')).not.toBe(lightPrimary)

    wrapper.unmount()
  })

  it('removes custom color overrides when returning to simple mode', async () => {
    settings.value.ui.colorMode = 'custom'
    settings.value.ui.customColors.surface = '#123456'
    applyColorScheme()
    applyThemeColor()

    const wrapper = mount(UIPanel, {
      props: { settings: settings.value.ui }
    })

    expect(document.documentElement.style.getPropertyValue('--color-surface')).toBe('#123456')

    await wrapper.get('input[value="simple"]').setValue(true)

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.getPropertyValue('--color-surface')).toBe('')

    wrapper.unmount()
  })

  it('retains the original compact preference controls while using Naive UI', () => {
    const wrapper = mount(UIPanel, {
      props: { settings: settings.value.ui }
    })

    expect(wrapper.text()).toContain('语言')
    expect(wrapper.text()).toContain('多语言功能即将推出')
    expect(wrapper.findAll('.scheme-button')).toHaveLength(3)
    expect(wrapper.findAll('.tag-mode-option')).toHaveLength(3)
    expect(wrapper.find('.element-toggles').text()).toContain('姓名')
    expect(wrapper.find('.element-toggles').text()).toContain('学号')
    expect(wrapper.find('.element-toggles').text()).toContain('数值')
    expect(wrapper.findAll('.toggle-label').map(label => label.text())).toEqual([
      '姓名',
      '姓名大字号',
      '学号',
      '学号大字号',
      '标签',
      '数值',
      '行号'
    ])

    wrapper.unmount()
  })
})
