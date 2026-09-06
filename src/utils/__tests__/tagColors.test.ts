import { describe, expect, it } from 'vitest'
import { normalizeTagColor, TAG_COLORS } from '@/constants/tagColors'

describe('normalizeTagColor', () => {
  it('keeps supported hex colors and migrates legacy CSS variable tokens', () => {
    expect(normalizeTagColor('#0a59f7')).toBe('#0a59f7')
    expect(normalizeTagColor('#00FF0080')).toBe('#00FF0080')
    expect(normalizeTagColor('var(--tag-color-2)')).toBe(TAG_COLORS[1])
  })

  it('uses a valid palette fallback for unsupported values', () => {
    expect(normalizeTagColor('invalid-color', TAG_COLORS[4])).toBe(TAG_COLORS[4])
    expect(normalizeTagColor(null, 'invalid-fallback')).toBe(TAG_COLORS[0])
  })
})
