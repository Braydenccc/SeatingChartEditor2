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
})
