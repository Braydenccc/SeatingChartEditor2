---
trigger: conditional
globs:
  - "src/components/seat/**"
  - "src/composables/useEditMode.js"
  - "src/composables/useZoom.js"
  - "src/composables/useStudentDragging.js"
---

# 布局编辑器

organizedSeats 转可视化座位矩形，支持缩放/平移/拖拽，5 种编辑模式。

## 编辑模式

NORMAL(分配) / EMPTY_EDIT(空置过道) / SWAP(交换) / CLEAR(清除) / ZONE_EDIT(选区画笔)

## 关键实现

- HTML5 拖放：dragstart/dragover(.prevent)/drop，useStudentDragging.js 统一接管
- CSS 缩放：useZoom 输出 scale/translate，transform: matrix(...) 避免 DOM 重排
- 自适应居中：autoCenter 读取父盒子与内容尺寸计算最佳比例

## 防坑

- 禁止在 SeatGrid.vue 循环写 margin/width style
- dragend/drop 跨可滚动 DOM 需全局事件捕获清理
- currentMode 排他，新模式通过 useEditMode.js 单向流管理