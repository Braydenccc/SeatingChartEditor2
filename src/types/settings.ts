export type ColorMode = 'simple' | 'custom'
export type ColorScheme = 'light' | 'dark' | 'auto'
export type ThemeBaseScheme = 'light' | 'dark'

export interface CustomThemeColors {
  primary: string
  primaryLight: string
  primaryDark: string
  primaryHover: string
  surface: string
  bgSelected: string
  bgCard: string
  bgSubtle: string
  bgSoft: string
  bgHover: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textDisabled: string
  border: string
  borderStrong: string
  borderHover: string
  danger: string
  dangerHover: string
  success: string
  successHover: string
  warning: string
  warningHover: string
  info: string
  infoHover: string
}

export interface SyncSettings {
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  autoSync: boolean
  syncInterval: number
}

export interface UiSettings {
  language: 'zh-CN' | 'en-US'
  colorMode: ColorMode
  colorScheme: ColorScheme
  customBaseScheme: ThemeBaseScheme
  themeColor: string
  customColors: CustomThemeColors
  defaultZoom: number
  enableAnimations: boolean
  showStudentName: boolean
  showStudentNumber: boolean
  showEditorRowNumbers: boolean
  largeNameMode: boolean
  largeNumberMode: boolean
}

export interface EditorSettings {
  undoHistorySize: number
  dragSensitivity: number
  doubleClickAction: 'edit' | 'random'
}

export interface GlobalSettingsV2 {
  schemaVersion: 2
  sync: SyncSettings
  ui: UiSettings
  editor: EditorSettings
}

export type SettingsCategory = 'sync' | 'ui' | 'editor'

