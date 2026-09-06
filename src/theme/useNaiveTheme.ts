import { computed } from 'vue'
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import type { CustomThemeColors, ThemeBaseScheme } from '@/types/settings'

interface ResolvedNaiveColors extends CustomThemeColors {
  textInverse: string
}

const prefersDark = () => typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

const effectiveBaseScheme = (): ThemeBaseScheme => {
  const { ui } = useGlobalSettings().settings.value
  if (ui.colorMode === 'custom') return ui.customBaseScheme
  if (ui.colorScheme === 'auto') return prefersDark() ? 'dark' : 'light'
  return ui.colorScheme
}

const resolvedColors = (): ResolvedNaiveColors => {
  const { settings, defaultSettings } = useGlobalSettings()
  const { ui } = settings.value
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  const fallback = defaultSettings.ui.customColors
  if (ui.colorMode === 'custom') {
    return {
      ...ui.customColors,
      textInverse: read('--color-text-inverse', fallback.surface)
    }
  }

  return {
    ...ui.customColors,
    primary: read('--color-primary', ui.themeColor),
    primaryLight: read('--color-primary-light', ui.themeColor),
    primaryDark: read('--color-primary-dark', ui.themeColor),
    primaryHover: read('--color-primary-hover', ui.themeColor),
    surface: read('--color-surface', fallback.surface),
    bgSelected: read('--color-bg-selected', fallback.bgSelected),
    bgCard: read('--color-bg-card', fallback.bgCard),
    bgSubtle: read('--color-bg-subtle', fallback.bgSubtle),
    bgSoft: read('--color-bg-soft', fallback.bgSoft),
    bgHover: read('--color-bg-hover', fallback.bgHover),
    textPrimary: read('--color-text-primary', fallback.textPrimary),
    textSecondary: read('--color-text-secondary', fallback.textSecondary),
    textMuted: read('--color-text-muted', fallback.textMuted),
    textDisabled: read('--color-text-disabled', fallback.textDisabled),
    border: read('--color-border', fallback.border),
    borderStrong: read('--color-border-strong', fallback.borderStrong),
    borderHover: read('--color-border-hover', fallback.borderHover),
    danger: read('--color-danger', fallback.danger),
    dangerHover: read('--color-danger-hover', fallback.dangerHover),
    success: read('--color-success', fallback.success),
    successHover: read('--color-success-hover', fallback.successHover),
    warning: read('--color-warning', fallback.warning),
    warningHover: read('--color-warning-hover', fallback.warningHover),
    info: read('--color-info', fallback.info),
    infoHover: read('--color-info-hover', fallback.infoHover),
    textInverse: read('--color-text-inverse', fallback.surface)
  }
}

export function useNaiveTheme() {
  const { settings, themeRevision } = useGlobalSettings()

  const theme = computed(() => {
    void settings.value.ui.colorMode
    void settings.value.ui.colorScheme
    void settings.value.ui.customBaseScheme
    void themeRevision.value
    return effectiveBaseScheme() === 'dark' ? darkTheme : null
  })

  const themeOverrides = computed<GlobalThemeOverrides>(() => {
    void settings.value.ui
    void themeRevision.value
    const colors = resolvedColors()
    return {
      common: {
        primaryColor: colors.primary,
        primaryColorHover: colors.primaryHover,
        primaryColorPressed: colors.primaryDark,
        primaryColorSuppl: colors.primaryLight,
        infoColor: colors.info,
        infoColorHover: colors.infoHover,
        successColor: colors.success,
        successColorHover: colors.successHover,
        warningColor: colors.warning,
        warningColorHover: colors.warningHover,
        errorColor: colors.danger,
        errorColorHover: colors.dangerHover,
        bodyColor: colors.surface,
        cardColor: colors.bgCard,
        modalColor: colors.surface,
        popoverColor: colors.surface,
        tableColor: colors.surface,
        inputColor: colors.bgSubtle,
        actionColor: colors.bgSoft,
        hoverColor: colors.bgHover,
        textColorBase: colors.textPrimary,
        textColor1: colors.textPrimary,
        textColor2: colors.textSecondary,
        textColor3: colors.textMuted,
        textColorDisabled: colors.textDisabled,
        borderColor: colors.border,
        dividerColor: colors.border,
        borderRadius: '8px'
      },
      Button: {
        borderRadiusSmall: '7px',
        heightSmall: '34px',
        textColorPrimary: colors.textInverse,
        textColorHoverPrimary: colors.textInverse,
        textColorPressedPrimary: colors.textInverse,
        textColorFocusPrimary: colors.textInverse,
        textColorDisabledPrimary: colors.textInverse
      },
      Input: { borderRadius: '8px' },
      Card: { borderRadius: '8px' },
      Drawer: { color: colors.surface },
      Tabs: {
        colorSegment: colors.bgSubtle,
        tabColorSegment: colors.bgSelected,
        tabTextColorSegment: colors.textSecondary,
        tabTextColorHoverSegment: colors.textPrimary,
        tabTextColorActiveSegment: colors.primary,
        tabTextColorActiveLine: colors.primary
      },
      Menu: { itemTextColorActive: colors.primary }
    }
  })

  return { theme, themeOverrides }
}
