import { ref, watch } from 'vue'
import { useWindowSize } from '@vueuse/core'

const STORAGE_KEY = 'sce_candidate_panel_height'
const MIN_HEIGHT = 0 // 允许完全隐藏
const MAX_HEIGHT_RATIO = 0.6 // 不超过可用空间的 60%
const DEFAULT_HEIGHT_RATIO = 0.35 // 默认 35%

// 模块作用域状态（单例）
const userHeight = ref(null) // null 表示使用默认值
const isDragging = ref(false)
const dragStartY = ref(0)
const dragStartHeight = ref(0)

export function useResizablePanel() {
  const { height: windowHeight, width: windowWidth } = useWindowSize()

  // 计算动态最大高度（基于未分配学生数量）
  const calculateMaxHeight = (unassignedCount, viewportWidth) => {
    const HEADER_HEIGHT = 48
    // 注意：快捷键提示栏已分离到 EditorPanel，不再计入候选栏高度
    const FIXED_HEIGHT = HEADER_HEIGHT

    // 如果没有学生，返回足够显示空状态占位符的高度
    if (unassignedCount === 0) {
      return FIXED_HEIGHT + 180 // 足够显示"全部已入座"占位符
    }

    // 根据视口宽度确定网格参数（响应式断点）
    let cardWidth, cardHeight, gap, padding

    if (viewportWidth >= 1367) {
      cardWidth = 120; cardHeight = 80; gap = 12; padding = 30
    } else if (viewportWidth >= 1025) {
      cardWidth = 102; cardHeight = 68; gap = 12; padding = 16
    } else if (viewportWidth > 768) {
      cardWidth = 105; cardHeight = 70; gap = 12; padding = 12
    } else {
      cardWidth = 82.5; cardHeight = 55; gap = 12; padding = 12
    }

    // 计算每行可容纳的卡片数
    const availableWidth = viewportWidth * 0.8 - padding
    const cardsPerRow = Math.floor((availableWidth + gap) / (cardWidth + gap))

    // 计算需要的行数
    const rowsNeeded = Math.ceil(unassignedCount / Math.max(cardsPerRow, 1))

    // 计算内容区域高度
    const contentHeight = rowsNeeded * cardHeight + (rowsNeeded - 1) * gap + padding

    return FIXED_HEIGHT + contentHeight
  }

  // 获取高度约束
  const getConstraints = (unassignedCount) => {
    const availableHeight = windowHeight.value - 100 // 减去 AppHeader
    const dynamicMax = calculateMaxHeight(unassignedCount, windowWidth.value)
    const absoluteMax = availableHeight * MAX_HEIGHT_RATIO

    return {
      min: MIN_HEIGHT,
      max: Math.min(dynamicMax, absoluteMax),
      default: Math.min(availableHeight * DEFAULT_HEIGHT_RATIO, dynamicMax)
    }
  }

  // 获取当前有效高度
  const getEffectiveHeight = (unassignedCount) => {
    const constraints = getConstraints(unassignedCount)

    if (userHeight.value === null) {
      return constraints.default
    }

    return Math.max(constraints.min, Math.min(userHeight.value, constraints.max))
  }

  // 开始拖动
  const startResize = (clientY, currentHeight) => {
    isDragging.value = true
    dragStartY.value = clientY
    dragStartHeight.value = currentHeight
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  // 更新拖动（使用 requestAnimationFrame 优化性能）
  let rafId = null
  const updateResize = (clientY, unassignedCount) => {
    if (!isDragging.value) return

    if (rafId) cancelAnimationFrame(rafId)

    rafId = requestAnimationFrame(() => {
      const deltaY = dragStartY.value - clientY // 向上拖动为正
      const newHeight = dragStartHeight.value + deltaY

      const constraints = getConstraints(unassignedCount)
      userHeight.value = Math.max(constraints.min, Math.min(newHeight, constraints.max))
    })
  }

  // 结束拖动
  const endResize = () => {
    if (!isDragging.value) return

    isDragging.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    // 保存到 localStorage
    if (userHeight.value !== null) {
      try {
        localStorage.setItem(STORAGE_KEY, userHeight.value.toString())
      } catch (e) {
        console.warn('Failed to save panel height:', e)
      }
    }
  }

  // 切换折叠/展开
  const toggleCollapse = (unassignedCount) => {
    if (userHeight.value === 0) {
      userHeight.value = getConstraints(unassignedCount).default
    } else {
      userHeight.value = 0
    }
    try {
      localStorage.setItem(STORAGE_KEY, userHeight.value.toString())
    } catch (e) {
      console.warn('Failed to save panel height:', e)
    }
  }

  // 从 localStorage 恢复
  const loadSavedHeight = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed)) {
          userHeight.value = parsed
        }
      }
    } catch (e) {
      console.warn('Failed to load saved height:', e)
    }
  }

  // 窗口大小变化时，验证当前高度是否仍在有效范围内
  watch([windowHeight, windowWidth], () => {
    if (userHeight.value !== null && userHeight.value > 0) {
      const constraints = getConstraints(0) // 使用 0 作为保守估计
      if (userHeight.value > constraints.max) {
        userHeight.value = constraints.max
      }
    }
  })

  // 初始化
  loadSavedHeight()

  return {
    userHeight,
    isDragging,
    getEffectiveHeight,
    getConstraints,
    startResize,
    updateResize,
    endResize,
    toggleCollapse
  }
}
