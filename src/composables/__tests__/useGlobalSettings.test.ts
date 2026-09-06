import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storageMocks = vi.hoisted(() => ({
  get: vi.fn((_key: string) => null as string | null),
  set: vi.fn((_key: string, _value: string) => true)
}))

vi.mock('@/utils/storage', () => ({
  safeStorageGet: storageMocks.get,
  safeStorageSet: storageMocks.set
}))

import { migrateGlobalSettings, useGlobalSettings } from '../useGlobalSettings'

describe('useGlobalSettings', () => {
  const globalSettings = useGlobalSettings()

  beforeEach(() => {
    vi.useFakeTimers()
    globalSettings.resetSettings()
    storageMocks.set.mockClear()
  })

  afterEach(() => {
    globalSettings.flushPendingSave()
    vi.useRealTimers()
  })

  it('deeply migrates and validates legacy or partial settings', () => {
    const migrated = migrateGlobalSettings({
      schemaVersion: 1,
      sync: { autoSync: 'yes', syncInterval: 500 },
      ui: {
        colorMode: 'custom',
        colorScheme: 'dark',
        themeColor: '#ABCDEF',
        defaultZoom: 999,
        customColors: { primary: '#112233', danger: 'red' }
      },
      editor: { undoHistorySize: 2, dragSensitivity: '1.75', doubleClickAction: 'unknown' }
    })

    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.sync.autoSync).toBe(globalSettings.defaultSettings.sync.autoSync)
    expect(migrated.sync.syncInterval).toBe(10_000)
    expect(migrated.ui.customBaseScheme).toBe('dark')
    expect(migrated.ui.themeColor).toBe('#abcdef')
    expect(migrated.ui.customColors.primary).toBe('#112233')
    expect(migrated.ui.customColors.danger).toBe(globalSettings.defaultSettings.ui.customColors.danger)
    expect(migrated.ui.defaultZoom).toBe(200)
    expect(migrated.editor.undoHistorySize).toBe(10)
    expect(migrated.editor.dragSensitivity).toBe(1.75)
    expect(migrated.editor.doubleClickAction).toBe(globalSettings.defaultSettings.editor.doubleClickAction)
  })

  it('applies settings immediately and debounces storage writes for 200ms', () => {
    globalSettings.updateSetting('ui.defaultZoom', 125)

    expect(globalSettings.settings.value.ui.defaultZoom).toBe(125)
    expect(storageMocks.set).not.toHaveBeenCalled()

    vi.advanceTimersByTime(199)
    expect(storageMocks.set).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(storageMocks.set).toHaveBeenCalledTimes(1)
    expect(JSON.parse(storageMocks.set.mock.calls[0][1]).ui.defaultZoom).toBe(125)
  })

  it('flushes a pending save exactly once', () => {
    globalSettings.updateSetting('editor.undoHistorySize', 80)

    expect(globalSettings.flushPendingSave()).toBe(true)
    expect(storageMocks.set).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(500)
    expect(storageMocks.set).toHaveBeenCalledTimes(1)
  })

  it('resets a single setting and persists it immediately', () => {
    globalSettings.updateSetting('ui.showStudentName', false, { immediate: true })
    storageMocks.set.mockClear()

    expect(globalSettings.resetSetting('ui.showStudentName')).toBe(true)
    expect(globalSettings.getSetting('ui.showStudentName')).toBe(true)
    expect(storageMocks.set).toHaveBeenCalledTimes(1)
  })

  it('uses a darker semantic header background for dark component bases', () => {
    globalSettings.updateSetting('ui.colorScheme', 'dark', { immediate: true })

    expect(document.documentElement.style.getPropertyValue('--color-header-accent-bg'))
      .toContain('var(--color-bg-card)')

    globalSettings.updateSetting('ui.colorScheme', 'light', { immediate: true })
    expect(document.documentElement.style.getPropertyValue('--color-header-accent-bg'))
      .toBe('var(--color-primary)')
  })
})
