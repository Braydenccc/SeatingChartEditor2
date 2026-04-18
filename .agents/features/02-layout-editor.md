---
module_name: Layout Editor
description: 用户核心视窗交互域。负责可视化整个三维数组的座位表、拖拽分发逻辑以及全局缩放与平移的视图层控制。
---

# 02-布局编辑器实现 (Layout Editor)

## 1. 核心职责 (Core Purpose)
将 `organizedSeats` 数据转化为可视化的座位矩形模块，支持任意缩放视图和防抖拖拽交互。同时接管 5 种不同的“特殊指针工具（编辑模式）”，如普通点击、空置画笔、交换魔杖等以实施局部覆盖。

## 2. 源代码入口 (Source Files)
- 面板渲染: `src/components/seat/SeatChart.vue`
- 个体组件: `src/components/seat/SeatItem.vue`
- 选区工具栏: `src/components/seat/SelectionToolbar.vue`
- 视图矩阵与平移: `src/composables/useZoom.js`
- 工具栏模式: `src/composables/useEditMode.js`
- 多选管理: `src/composables/useSelection.js`
- 拖拽预览: `src/composables/useDragPreview.js`

## 3. 核心 API 暴露 (Core Internal Logic)

```javascript
// from useEditMode.js
export const EditMode = {
  NORMAL: 'normal',           // 默认业务模式（给座位分发左侧选中的学生）
  EMPTY_EDIT: 'empty_edit',   // 建筑模式（将实体座位标记为空气块/过道）
  SWAP: 'swap',               // 动作模式（将所点的双座互相交换）
  CLEAR: 'clear',             // 擦除模式（清空选中）
  ZONE_EDIT: 'zone_edit'      // 画笔模式（为某个选区批量划定范围）
}
```

## 4. 关键实现节点 (Implementation Details)
- **HTML5 拖放 (Drag & Drop)**: 严重依赖 `dragstart`, `dragover` (必须加 `.prevent` 劫持默认行为), `drop` 原生事件。`useStudentDragging.js` 统一接管这些动作，将 `draggedStudentId` 注册到内存。
- **纯 CSS 中心化放大点**: `useZoom` 仅输出了 `scale` 和 `translate(x, y)` 几个变量。座位图通过 `transform: matrix(...)` 和 `transform-origin` 进行视图包裹，避免让底层数十万个 DOM 由于尺寸变化进行疯狂重排（Reflow），这是防卡顿优化的最关键一环。
- **自适应居中计算 (`autoCenter`)**: 编辑器加载时或按恢复键时，会读取父盒子的 clientW/H 和 内部内容的 W/H 自动应用最佳比例参数，使得居中呈现。
- **选区拖拽 (`useDragPreview`)**: 支持多选座位后整体拖拽移动。通过 `clientToChartLocal` 将鼠标坐标转换为画布本地坐标，再通过 `chartLocalToGrid` 计算目标网格位置。拖拽时会显示半透明预览，松手后执行批量座位交换。
- **选区工具栏 (`SelectionToolbar`)**: 当选中多个座位时，在选区上方显示浮动工具栏，提供编辑、移出、打乱、排入等快捷操作。工具栏位置通过 `anchorX/anchorY` 动态定位，始终跟随选区中心点。

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **DOM重排开销**: 绝对不要在 `SeatChart.vue` 内去循环写 `margin/width` 的 `style` 计算（除了全局控制的Gap）。
- **拖拽的幽灵阻断**: 在处理”将学生拖回侧边栏扔掉”逻辑中，Vue 原生的 `@dragend` 与 `@drop` 判断常常无法完美闭环（因为跨越了可滚动 DOM 边界），需要小心依赖全局事件捕获清理状态。
- **交互冲突**: 模式控制 (`currentMode.value`) 是排他的。例如当处于 `SWAP` 模式点两次触发互换时，就不能再触发左键直接塞人的 `NORMAL` 处理。如果后续引入新模式，务必通过 `useEditMode.js` 进行单向流管理。
- **选区拖拽性能**: `useDragPreview` 在拖拽过程中会频繁计算坐标转换和网格吸附，需要缓存 `chartRect` 避免重复调用 `getBoundingClientRect()`。拖拽预览元素使用绝对定位和 `transform` 而非 `left/top` 以提升性能。
- **选区状态同步**: `useSelection` 使用 `Set` 存储选中的座位ID，修改后必须调用 `triggerRef()` 手动触发响应式更新，否则 Vue 无法检测到 Set 内部变化。
