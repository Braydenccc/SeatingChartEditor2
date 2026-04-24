import { describe, it, expect } from 'vitest'
import { useMarkdown } from '../useMarkdown'

describe('useMarkdown', () => {
  const { parseMarkdown } = useMarkdown()

  describe('XSS prevention', () => {
    it('should escape script tags', () => {
      const html = parseMarkdown('<script>alert("xss")</script>')

      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
      expect(html).not.toContain('<script>')
    })

    it('should escape event handler attributes in html tags', () => {
      const html = parseMarkdown('<img src="x" onerror="alert(1)">')

      expect(html).toContain('&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;')
      expect(html).not.toContain('onerror=')
    })

    it('should keep html entities escaped as text', () => {
      const html = parseMarkdown('&lt;div&gt;safe&lt;/div&gt;')

      expect(html).toContain('&amp;lt;div&amp;gt;safe&amp;lt;/div&amp;gt;')
    })
  })

  describe('input safety', () => {
    it('should handle truthy non-string values safely', () => {
      expect(() => parseMarkdown(12345)).not.toThrow()
      expect(parseMarkdown(12345)).toBe('<p class="guide-text">12345</p>')
    })
  })
})
