import { ref } from 'vue'
import { DEFAULT_TAGS, getNextColor } from '@/constants/tagColors'

// 标签数据管理
const tags = ref([])
let nextTagId = 1
let colorIndex = 0

// 全局设置：是否在座位表中显示标签
const showTagsInSeatChart = ref(true)

// 标签显示模式: 'dot' | 'corner' | 'bottom'
const tagDisplayMode = ref('dot')

// 初始化默认标签
export function initializeTags() {
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

export function useTagData() {
  // 添加标签
  const addTag = (tagData) => {
    const color = tagData.color || getNextColor(colorIndex++)
    const newId = nextTagId++
    tags.value.push({
      id: newId,
      name: tagData.name,
      color: color,
      showInSeatChart: tagData.showInSeatChart !== false
    })
    return newId
  }

  // 编辑标签
  const editTag = (tagId, tagData) => {
    const tag = tags.value.find(t => t.id === tagId)
    if (tag) {
      tag.name = tagData.name
      tag.color = tagData.color
      if (tagData.showInSeatChart !== undefined) {
        tag.showInSeatChart = tagData.showInSeatChart
      }
    }
  }

  // 删除标签
  const deleteTag = (tagId) => {
    tags.value = tags.value.filter(t => t.id !== tagId)
  }

  // 清除所有标签
  const clearAllTags = () => {
    tags.value = []
    nextTagId = 1
    colorIndex = 0
  }

  // 设置全局标签显示开关
  const setShowTagsInSeatChart = (show) => {
    showTagsInSeatChart.value = show
  }

  // 设置标签显示模式
  const setTagDisplayMode = (mode) => {
    tagDisplayMode.value = mode
  }

  return {
    tags,
    showTagsInSeatChart,
    tagDisplayMode,
    addTag,
    editTag,
    deleteTag,
    clearAllTags,
    setShowTagsInSeatChart,
    setTagDisplayMode
  }
}
