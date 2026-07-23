import type { TagColorDefinition } from '@/types'

// 标签配色方案 - 12种不同颜色
export const TAG_COLORS: string[] = [
  '#4CAF50', // 绿色
  '#2196F3', // 蓝色
  '#FF9800', // 橙色
  '#9C27B0', // 紫色
  '#F44336', // 红色
  '#00BCD4', // 青色
  '#8BC34A', // 浅绿
  '#E91E63', // 粉色
  '#3F51B5', // 靛蓝
  '#FFC107', // 黄色
  '#009688', // 蓝绿
  '#795548'  // 棕色
]

const hexTagColorPattern = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i
const legacyTagColorPattern = /^var\(\s*--tag-color-(\d+)\s*\)$/i

const resolveTagColor = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const color = value.trim()
  if (hexTagColorPattern.test(color)) return color

  const legacyMatch = color.match(legacyTagColorPattern)
  if (!legacyMatch) return null
  const colorIndex = Number(legacyMatch[1]) - 1
  return Number.isSafeInteger(colorIndex) && colorIndex >= 0
    ? TAG_COLORS[colorIndex] ?? null
    : null
}

export function normalizeTagColor(value: unknown, fallback = TAG_COLORS[0]): string {
  return resolveTagColor(value) ?? resolveTagColor(fallback) ?? TAG_COLORS[0]
}

// 获取下一个可用颜色
export function getNextColor(currentIndex: number): string {
  return TAG_COLORS[currentIndex % TAG_COLORS.length]
}

// 默认标签配置
export const DEFAULT_TAGS: TagColorDefinition[] = [
  { name: '住宿', color: TAG_COLORS[0] },
  { name: '午休', color: TAG_COLORS[1] },
  { name: '晚修', color: TAG_COLORS[2] }
]
