# 拖拽动画优化计划

## 现状分析

当前拖拽系统存在三个核心问题：

1. **多座位拖拽预览不完整**：拖拽选区时，HTML5 Drag 只显示浏览器默认的单元素幽灵图；触摸拖拽只创建一个显示单个学生姓名的 `touch-drag-preview`。其他选中座位仅显示 `.selection-dragging`（虚线半透明），用户无法看到完整的选区形态。

2. **无放置位置预览**：拖拽悬停在目标座位时，仅该座位显示 `.drag-over` 高亮。对于多座位选区，用户无法预知其他学生会落到哪些位置。

3. **松手后无过渡动画**：数据变更（交换/移动）瞬间生效，座位内容直接切换，缺乏视觉连续性。

---

## 改进一：多座位拖拽预览

### 目标
拖拽选区时，预览元素完整展示所有选中座位的学生信息及相对位置关系。

### 方案

#### HTML5 Drag（鼠标端）

在 `SeatItem.vue` 的 `handleDragStart` 中，当选区拖拽时：

1. 收集所有选中座位的 DOM 元素和 `getBoundingClientRect()`
2. 计算选区的整体包围盒（bounding box）
3. 创建一个离屏容器 div，内部按相对位置放置每个座位的简化克隆
4. 调用 `e.dataTransfer.setDragImage(previewEl, offsetX, offsetY)` 设置自定义拖拽图像
5. 下一帧移除离屏容器（浏览器已捕获图像）

**预览元素设计**：
- 容器背景：`rgba(35, 88, 123, 0.08)`，圆角 12px，虚线边框
- 每个座位克隆：显示学生姓名 + 学号，保持相对网格布局
- 整体缩放至合理尺寸（不超过 300x300px），避免遮挡视线
- 拖拽偏移量以锚点座位（发起拖拽的座位）为中心

#### Touch Drag（触摸端）

在 `SeatItem.vue` 的 `handleTouchStart` 长按激活后：

1. 判断当前座位是否属于选区（`isInSelection`）
2. 若是选区拖拽，创建包含所有选中座位的预览容器
3. 预览容器跟随手指移动，以锚点座位为定位参考
4. 预览容器样式：半透明背景 + 阴影 + 轻微缩放（0.9）

**与单座位触摸拖拽的兼容**：
- 非选区拖拽保持现有单座位预览逻辑不变
- 选区拖拽使用新的多座位预览逻辑

### 修改文件
- `src/components/seat/SeatItem.vue` — 修改 `handleDragStart`、`handleTouchStart`

---

## 改进二：放置位置吸附预览

### 目标
拖拽悬停在目标座位时，实时显示所有选中学生将要落到的位置（幽灵轮廓），让用户在松手前就能确认放置结果。

### 方案

#### 新增状态

在 `useDragState.js` 中新增：

```javascript
const snapPreviewIds = ref(new Set())       // 吸附预览的座位 ID 集合
const snapPreviewAnchor = ref(null)          // 当前吸附的锚点目标座位 ID

const setSnapPreview = (seatIds, anchorId) => {
  snapPreviewIds.value = new Set(seatIds)
  snapPreviewAnchor.value = anchorId
}

const clearSnapPreview = () => {
  snapPreviewIds.value = new Set()
  snapPreviewAnchor.value = null
}
```

#### 计算逻辑

提取 `useSeatChart.js` 中 `moveSelection` 的偏移计算为独立函数 `calculateMoveTargets`：

```javascript
const calculateMoveTargets = (selectedSeatIds, anchorId, targetSeatId) => {
  // 返回 [{ sourceSeatId, targetSeatId }, ...]
  // 不执行实际移动，仅计算目标位置
  // 过滤掉无效目标（越界、空置座位）
}
```

#### HTML5 Drag 触发

在 `SeatItem.vue` 的 `handleDragEnter` 中：

1. 判断当前是否为选区拖拽（通过 `isDraggingSelection`）
2. 若是，调用 `calculateMoveTargets` 计算所有目标座位
3. 调用 `setSnapPreview(targetSeatIds, targetSeatId)` 设置吸附预览
4. 在 `handleDragLeave` 和 `handleDragEnd` 中调用 `clearSnapPreview()`

#### Touch Drag 触发

在 `SeatItem.vue` 的 `handleTouchMove` 的 rAF 回调中：

1. 找到目标座位后，判断是否为选区拖拽
2. 若是，调用 `calculateMoveTargets` 计算目标座位
3. 调用 `setSnapPreview` 设置吸附预览
4. 手指移开座位时调用 `clearSnapPreview()`

#### 视觉样式

在 `SeatItem.vue` 中新增 `.snap-preview` 样式：

```css
.seat-item.snap-preview {
  border: 2px dashed var(--color-primary);
  background: rgba(35, 88, 123, 0.06);
  position: relative;
}

.seat-item.snap-preview::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 8px;
  background: rgba(35, 88, 123, 0.1);
  animation: snap-breathe 1.5s ease-in-out infinite;
}

@keyframes snap-breathe {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
```

- 锚点目标座位（直接悬停的座位）使用更明显的样式（实线边框 + 填充背景）
- 其他目标座位使用虚线边框 + 呼吸动画
- 与现有 `.drag-over` 样式区分：`.drag-over` 用于单座位交换，`.snap-preview` 用于选区移动预览

#### 单座位拖拽的增强

对于单座位拖拽（非选区），也添加简单的吸附预览：
- 拖拽到目标座位时，目标座位显示 `.drag-over`（已有）
- 同时在源座位显示一个"即将空出"的提示（轻微透明化）

### 修改文件
- `src/composables/useDragState.js` — 新增 `snapPreviewIds`、`setSnapPreview`、`clearSnapPreview`
- `src/composables/useSeatChart.js` — 提取 `calculateMoveTargets` 函数
- `src/components/seat/SeatItem.vue` — 修改 `handleDragEnter`/`handleDragLeave`/`handleTouchMove`，新增 `.snap-preview` 样式

---

## 改进三：松手后的过渡动画

### 目标
拖拽松手后，学生卡片从源位置流畅地"飞"到目标位置，而非瞬间切换。

### 方案：FLY（Flying Layer）动画

采用"飞行克隆"方案，而非 FLIP，原因：
- FLIP 要求 DOM 元素在数据变更前后是同一个，但 Vue 响应式更新内容后 DOM 元素相同但内容已变
- 飞行克隆方案更直观：创建临时绝对定位的克隆元素，从源位置动画飞到目标位置

#### 新建 composable：`useDropAnimation.js`

```javascript
// 核心流程：
// 1. 数据变更前：为每个受影响的学生创建"飞行克隆"
// 2. 数据变更：执行 swapSeats / moveSelection
// 3. DOM 更新后：隐藏目标座位的新内容，动画飞行克隆到目标位置
// 4. 动画结束：移除克隆，显示目标座位的真实内容

export function useDropAnimation() {
  const isAnimating = ref(false)

  const animateSwap = async (seatId1, seatId2) => { ... }
  const animateMoveSelection = async (moves) => { ... }

  return { isAnimating, animateSwap, animateMoveSelection }
}
```

#### 动画流程详解

**交换动画（swapSeats）**：

1. 获取 seat1 和 seat2 的 `.student-display` 元素及 `getBoundingClientRect()`
2. 为每个 student-display 创建克隆：
   - `position: fixed`，定位在源座位位置
   - `z-index: 10000`，`pointer-events: none`
   - 添加到 `document.body`
3. 隐藏源座位的学生显示（`opacity: 0`）
4. 执行 `swapSeats()` 数据变更
5. `await nextTick()` — 等待 Vue 更新 DOM
6. 隐藏目标座位的学生显示（`opacity: 0`）
7. 使用 Web Animations API 动画飞行克隆到目标位置：
   ```javascript
   flyer.animate([
     { left: sourceRect.left + 'px', top: sourceRect.top + 'px' },
     { left: targetRect.left + 'px', top: targetRect.top + 'px' }
   ], {
     duration: 280,
     easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
     fill: 'forwards'
   })
   ```
8. 动画完成后：
   - 移除飞行克隆
   - 恢复目标座位的学生显示（`opacity: 1`，带 `transition: opacity 0.15s`）

**选区移动动画（moveSelection）**：

与交换动画类似，但需要处理多个飞行克隆：
1. 为选区中每个有学生的座位创建飞行克隆
2. 执行 `moveSelection()` 数据变更
3. 动画所有克隆到各自目标位置
4. 清理

**边界情况处理**：
- 源座位或目标座位为空（无学生）：跳过该方向的飞行克隆
- 目标位置越界（`calculateMoveTargets` 已过滤）：不创建克隆
- 动画期间禁止新的拖拽操作（`isAnimating` 标志）
- 动画期间窗口 resize：使用 `position: fixed` 相对视口定位，resize 时取消动画

#### 性能优化

- 飞行克隆使用简化的 DOM 结构（仅姓名+学号，不含标签点等细节）
- 使用 `will-change: transform, left, top` 提示浏览器优化
- 动画使用 Web Animations API（GPU 加速），而非 CSS transition + rAF
- 限制同时飞行的克隆数量（超过 20 个时跳过动画，直接更新）

#### 与撤销系统的兼容

- 动画是纯视觉效果，不影响数据变更的时机
- `recordSwap` / `recordClear` 等撤销记录在数据变更时立即写入
- 撤销操作不触发飞行动画（直接回退数据即可）

### 修改文件
- `src/composables/useDropAnimation.js` — **新建**，飞行动画核心逻辑
- `src/components/seat/SeatChart.vue` — 在 `handleDrop`、`handleTouchSeatDrop` 中集成动画
- `src/components/seat/SeatItem.vue` — 配合隐藏/显示学生内容

---

## 实施步骤

### 阶段一：多座位拖拽预览（改进一）
1. 在 `SeatItem.vue` 中实现 `createSelectionDragImage()` 函数
2. 修改 `handleDragStart`，选区拖拽时调用 `setDragImage`
3. 在 `SeatItem.vue` 中实现 `createTouchSelectionPreview()` 函数
4. 修改 `handleTouchStart`，选区触摸拖拽时创建多座位预览
5. 修改 `handleTouchMove`，更新多座位预览位置

### 阶段二：放置位置吸附预览（改进二）
1. 在 `useDragState.js` 中新增 `snapPreviewIds` 状态和相关方法
2. 在 `useSeatChart.js` 中提取 `calculateMoveTargets` 函数
3. 修改 `SeatItem.vue` 的 `handleDragEnter`/`handleDragLeave`，计算并设置吸附预览
4. 修改 `SeatItem.vue` 的 `handleTouchMove`，触摸拖拽时设置吸附预览
5. 在 `SeatItem.vue` 中新增 `.snap-preview` CSS 样式
6. 在 `handleDragEnd`/`cleanupTouchDrag` 中清理吸附预览状态

### 阶段三：松手后过渡动画（改进三）
1. 新建 `useDropAnimation.js` composable
2. 实现交换动画 `animateSwap`
3. 实现选区移动动画 `animateMoveSelection`
4. 在 `SeatChart.vue` 的 `handleDrop` 中集成动画
5. 在 `SeatChart.vue` 的 `handleTouchSeatDrop` 中集成动画
6. 处理边界情况和性能优化

---

## 技术要点

### 座位布局坐标系
- 座位使用 Flexbox 布局，非绝对定位
- 座位位置由 `groupIndex → columnIndex → rowIndex` 三级结构决定
- `getBoundingClientRect()` 获取的是视口坐标，需考虑缩放（`scale`）和平移（`panX/panY`）
- 飞行克隆使用 `position: fixed`，直接使用视口坐标，无需额外变换

### 缩放适配
- 座位图有缩放变换（`transform: scale(...)`)
- `getBoundingClientRect()` 返回的是变换后的视口坐标，已包含缩放效果
- 飞行克隆使用 `position: fixed` + 视口坐标，天然适配缩放

### 触摸/鼠标双端兼容
- HTML5 Drag：自定义 `setDragImage`、`dragenter`/`dragleave` 事件
- Touch Drag：自定义预览元素、`elementFromPoint` 检测目标
- 两套机制共享 `useDragState` 中的吸附预览状态
- 两套机制共享 `useDropAnimation` 中的飞行动画

### 动画参数
- 飞行动画时长：280ms
- 缓动函数：`cubic-bezier(0.25, 0.46, 0.45, 0.94)`（ease-out-quad，流畅减速）
- 呼吸动画周期：1.5s
- 预览缩放：0.9（触摸拖拽预览）
