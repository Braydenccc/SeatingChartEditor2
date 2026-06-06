import { describe, expect, it } from 'vitest'
import router from '../index'

describe('router', () => {
  it('redirects root to editor', () => {
    const root = router.resolve('/')

    expect(root.matched[0]?.redirect).toBe('/editor')
  })

  it('resolves full-screen routes', () => {
    expect(router.resolve('/editor').name).toBe('editor')
    expect(router.resolve('/files').name).toBe('files')
    expect(router.resolve('/user').name).toBe('user')
    expect(router.resolve('/students').name).toBe('students')
    expect(router.resolve('/export').name).toBe('export')
    expect(router.resolve('/settings').name).toBe('settings')
  })

  it('preserves route query parameters', () => {
    expect(router.resolve('/export?tab=excel').query.tab).toBe('excel')

    const settings = router.resolve('/settings?tab=workspace&category=seat')
    expect(settings.query.tab).toBe('workspace')
    expect(settings.query.category).toBe('seat')
  })
})
