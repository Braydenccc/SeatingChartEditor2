/**
 * 颜色对比度和可读性检测工具
 */

/**
 * 将 hex 颜色转换为 RGB
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}

/**
 * 计算相对亮度（WCAG 标准）
 */
export function getRelativeLuminance(rgb) {
  const { r, g, b } = rgb
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * 计算对比度（WCAG 标准）
 */
export function getContrastRatio(color1, color2) {
  const rgb1 = typeof color1 === 'string' ? hexToRgb(color1) : color1
  const rgb2 = typeof color2 === 'string' ? hexToRgb(color2) : color2

  if (!rgb1 || !rgb2) return 1

  const l1 = getRelativeLuminance(rgb1)
  const l2 = getRelativeLuminance(rgb2)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * 检查对比度是否符合 WCAG AA 标准
 * @param {number} ratio - 对比度
 * @param {string} level - 'AA' | 'AAA'
 * @param {string} size - 'normal' | 'large'
 */
export function meetsWCAG(ratio, level = 'AA', size = 'normal') {
  if (level === 'AAA') {
    return size === 'large' ? ratio >= 4.5 : ratio >= 7
  }
  return size === 'large' ? ratio >= 3 : ratio >= 4.5
}

/**
 * 获取可读性评级
 */
export function getReadabilityRating(ratio) {
  if (ratio >= 7) return { level: 'excellent', label: '优秀', color: '#059669' }
  if (ratio >= 4.5) return { level: 'good', label: '良好', color: '#0ea5e9' }
  if (ratio >= 3) return { level: 'fair', label: '一般', color: '#f59e0b' }
  return { level: 'poor', label: '较差', color: '#ef4444' }
}

/**
 * 检查颜色组合的可读性
 */
export function checkColorCombination(foreground, background) {
  const ratio = getContrastRatio(foreground, background)
  const rating = getReadabilityRating(ratio)
  const meetsAA = meetsWCAG(ratio, 'AA', 'normal')
  const meetsAAA = meetsWCAG(ratio, 'AAA', 'normal')

  return {
    ratio: ratio.toFixed(2),
    rating,
    meetsAA,
    meetsAAA,
    wcagLevel: meetsAAA ? 'AAA' : meetsAA ? 'AA' : '不达标'
  }
}
