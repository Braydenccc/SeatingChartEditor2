import { ref } from 'vue'
import type { Ref } from 'vue'
import type { Tag, UseTagDataReturn } from '@/types'
import { DEFAULT_TAGS, getNextColor } from '@/constants/tagColors'

// 标签数据管理
const tags = ref<Tag[]>([])
let nextTagId: number = 1
let colorIndex: number = 0

// 全局设置：是否在座位表中显示标签
const showTagsInSeatChart = ref<boolean>(true)

// 标签显示模式: 'dot' | 'corner' | 'bottom'
const tagDisplayMode = ref<'dot' | 'corner' | 'bottom'>('dot')

// 初始化默认标签
export function initializeTags(): void {
  if (tags.value.length === 0) {
    DEFAULT_TAGS.forEach(tag => {
      tags.value.push({
        id: nextTagId++,
        name: tag.name,
        color: tag.color,
        showInSeatChart: true
      })
    })
    colorIndex = DEFAULT_TAGS.length
  }
}

export function useTagData(): UseTagDataReturn {
  // 添加标签
  const addTag = (tagData?: Partial<Tag>): number => {
    const color = tagData?.color || getNextColor(colorIndex++)
    const newId = nextTagId++
    tags.value.push({
      id: newId,
      name: tagData?.name || '',
      color: color,
      showInSeatChart: tagData?.showInSeatChart !== false
    })
    return newId
  }

  // 编辑标签
  const editTag = (tagId: number, tagData: Partial<Tag>): void => {
    const tag = tags.value.find(t => t.id === tagId)
    if (tag) {
      if (tagData.name !== undefined) tag.name = tagData.name.trim()
      if (tagData.color !== undefined) tag.color = tagData.color
      if (tagData.showInSeatChart !== undefined) {
        tag.showInSeatChart = tagData.showInSeatChart
      }
    }
  }

  // 更新标签（别名）
  const updateTag = (tagId: number, tagData: Partial<Tag>): void => {
    editTag(tagId, tagData)
  }

  // 根据ID获取标签
  const getTagById = (tagId: number): Tag | undefined => {
    return tags.value.find(t => t.id === tagId)
  }

  // 删除标签
  const deleteTag = (tagId: number): void => {
    tags.value = tags.value.filter(t => t.id !== tagId)
  }

  // 清除所有标签
  const clearAllTags = (): void => {
    tags.value = []
    nextTagId = 1
    colorIndex = 0
  }

  // 设置全局标签显示开关
  const setShowTagsInSeatChart = (show: boolean): void => {
    showTagsInSeatChart.value = show
  }

  // 设置标签显示模式
  const setTagDisplayMode = (mode: 'dot' | 'corner' | 'bottom'): void => {
    tagDisplayMode.value = mode
  }

  return {
    tags,
    showTagsInSeatChart,
    tagDisplayMode,
    addTag,
    editTag,
    updateTag,
    getTagById,
    deleteTag,
    clearAllTags,
    setShowTagsInSeatChart,
    setTagDisplayMode
  }
}
