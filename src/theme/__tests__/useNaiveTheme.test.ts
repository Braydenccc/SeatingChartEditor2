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
    const inverseText = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-text-inverse').trim() || globalSettings.defaultSettings.ui.customColors.surface
    expect(themeOverrides.value.Button?.textColorPrimary).toBe(inverseText)
    expect(themeOverrides.value.Tabs?.colorSegment)
      .toBe(globalSettings.settings.value.ui.customColors.bgSubtle)
    expect(themeOverrides.value.Tabs?.tabColorSegment)
      .toBe(globalSettings.settings.value.ui.customColors.bgSelected)
  })

  it('re-evaluates auto mode against the current system color scheme', () => {
    let prefersDark = true
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string): MediaQueryList => ({
        matches: prefersDark,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true)
      })
    })
    globalSettings.updateSetting('ui.colorMode', 'simple', { immediate: true })
    globalSettings.updateSetting('ui.colorScheme', 'auto', { immediate: true })
    const { theme } = useNaiveTheme()

    expect(theme.value).toBe(darkTheme)

    prefersDark = false
    globalSettings.applyColorScheme()
    expect(theme.value).toBeNull()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia
    })
  })
})
