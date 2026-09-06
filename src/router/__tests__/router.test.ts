import { describe, expect, it } from 'vitest'
import router, { shouldFocusRouteHeading } from '../index'

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

  it('provides route titles for document and assistive-technology context', () => {
    expect(router.resolve('/editor').meta.title).toBe('座位编辑')
    expect(router.resolve('/files').meta.title).toBe('文件')
    expect(router.resolve('/user').meta.title).toBe('账号中心')
    expect(router.resolve('/students').meta.title).toBe('学生')
    expect(router.resolve('/export').meta.title).toBe('导出')
    expect(router.resolve('/settings').meta.title).toBe('设置')
  })

  it('does not move focus for query-only navigation', () => {
    expect(shouldFocusRouteHeading(
      { path: '/export' },
      { path: '/export', matched: [{}] }
    )).toBe(false)
  })

  it('moves focus when navigating between pages after initial routing', () => {
    expect(shouldFocusRouteHeading(
      { path: '/export' },
      { path: '/files', matched: [{}] }
    )).toBe(true)
  })

  it('does not move focus for an initial unmatched route', () => {
    expect(shouldFocusRouteHeading(
      { path: '/editor' },
      { path: '/', matched: [] }
    )).toBe(false)
  })
})
