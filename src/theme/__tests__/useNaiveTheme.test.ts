import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { darkTheme } from 'naive-ui'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { useNaiveTheme } from '../useNaiveTheme'

describe('useNaiveTheme', () => {
  const globalSettings = useGlobalSettings()

  beforeEach(() => {
    globalSettings.resetSettings()
  })

  afterEach(() => {
    globalSettings.resetSettings()
  })

  it('derives the Naive UI theme and overrides from custom settings', () => {
    globalSettings.updateSetting('ui.colorMode', 'custom', { immediate: true })
    globalSettings.updateSetting('ui.customBaseScheme', 'dark', { immediate: true })
    globalSettings.updateSetting('ui.customColors.primary', '#123456', { immediate: true })
    globalSettings.updateSetting('ui.customColors.primaryHover', '#234567', { immediate: true })

    const { theme, themeOverrides } = useNaiveTheme()

    expect(theme.value).toBe(darkTheme)
    expect(themeOverrides.value.common?.primaryColor).toBe('#123456')
    expect(themeOverrides.value.common?.primaryColorHover).toBe('#234567')
    expect(themeOverrides.value.common?.textColorBase)
      .toBe(globalSettings.settings.value.ui.customColors.textPrimary)
  })

  it('re-evaluates auto mode against the current system color scheme', () => {
    let prefersDark = true
    const originalMatchMedia = window.matchMedia
    window.matchMedia = ((query: string): MediaQueryList => ({
      matches: prefersDark,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true)
    }))
    globalSettings.updateSetting('ui.colorMode', 'simple', { immediate: true })
    globalSettings.updateSetting('ui.colorScheme', 'auto', { immediate: true })
    const { theme } = useNaiveTheme()

    expect(theme.value).toBe(darkTheme)

    prefersDark = false
    globalSettings.applyColorScheme()
    expect(theme.value).toBeNull()
    window.matchMedia = originalMatchMedia
  })
})
