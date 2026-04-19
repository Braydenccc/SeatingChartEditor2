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
