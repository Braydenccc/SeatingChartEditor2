import { describe, expect, it } from 'vitest'
import router from '@/router'
import { useSettingsDialog } from '../useSettingsDialog'

describe('useSettingsDialog', () => {
  it('opens settings through router navigation', async () => {
    const { openSettings, initialTab, initialCategory, visible } = useSettingsDialog()

    await router.push('/editor')
    await openSettings('workspace', 'seat')

    expect(initialTab.value).toBe('workspace')
    expect(initialCategory.value).toBe('seat')
    expect(visible.value).toBe(false)
    expect(router.currentRoute.value.path).toBe('/settings')
    expect(router.currentRoute.value.query).toMatchObject({
      tab: 'workspace',
      category: 'seat'
    })
  })
})
