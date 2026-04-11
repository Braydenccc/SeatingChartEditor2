# 合并底部两个功能栏为一个

## 背景

当前移动端（<=768px）底部存在两个独立的功能栏：

### 功能栏 A：`seat-toolbar`（SeatChart.vue）
- **位置**：`seat-chart-container` 内部底部，`position: absolute; bottom: 0`
- **内容**：
  - 座位统计信息（大组数/列数/每列座数/总座位数）
  - 缩放控件（缩小、百分比标签、放大）
  - 拖拽移出放置区提示（drop-zone-active 状态）

### 功能栏 B：SidebarPanel（SidebarPanel.vue）
- **位置**：`position: fixed; bottom: 0; left: 0; right: 0; z-index: 999`
- **默认高度**：56px（仅显示 tabs-bar），展开时最大 70vh
- **结构分两部分**：
  - **常驻按钮区（tabs-bar）**：文件 / 编辑 / 排位 / 导出 四个 tab 按钮
  - **智能操作区（options-bar）**：点击 tab 后展开的内容面板，包含：
    - 文件 tab：工作区管理（加载/保存/云端）、名单管理（编辑名单/标签设置/Excel导入导出）
    - 编辑 tab：座位表配置、座位编辑（交换/清空/空置/选区）、自动轮换（位移/选区轮换）
    - 排位 tab：智能排位核心操作（选区管理、退火强度、规则管理、开始排位、预检查、进度报告）
    - 导出 tab：导出设置、快速导出
  - **日志区域（log-area）**

## 目标

将 seat-toolbar（功能栏 A）的内容整合进 SidebarPanel（功能栏 B）中，形成统一的单一底部功能栏。合并后必须保证：

1. **常驻按钮可用**：四个 tab 切换正常工作
2. **智能操作可用**：所有 options-bar 中的功能（智能排位、自动轮换、导出等）完整保留
3. **座位信息可见**：座位统计信息仍然可以查看
4. **缩放功能可用**：缩小/放大/自适应功能正常
5. **拖拽放置区可用**：drop-zone 交互不受影响

## 方案

### 整体思路

将 SidebarPanel 的 tabs-bar 从"纯 tab 按钮行"改造为"复合工具栏"，在移动端同时容纳：
- **左侧**：座位信息 + 缩放控件（从 seat-toolbar 迁入）
- **右侧**：四个 tab 按钮（保持不变）

桌面端不受影响（tabs-bar 仍为垂直布局）。

### 新的 tabs-bar 移动端布局

```
+--------------------------------------------------+
| [3大组·2列·6座·36座] [-] [100%] [+] | 文件 编辑 排位 导出 |
+--------------------------------------------------+
  ^---- toolbar-info (左) ----^   ^--- tabs (右) ---^
```

收起状态（默认 56px）：显示精简信息 + tab 按钮
展开状态（max-height: 70vh）：上方出现 options-bar 内容面板

## 具体步骤

### 步骤 1：修改 SidebarPanel.vue — 脚本部分

**新增 import**：
```js
import { Minus, Plus } from 'lucide-vue-next'
import { useZoom } from '@/composables/useZoom'
```

**从 useZoom 解构**：
```js
const { scale, zoomIn, zoomOut, MIN_SCALE, MAX_SCALE } = useZoom()
```

**从 useSeatChart 补充解构**（已有 `seatConfig`，需确认 `totalSeats` 是否已解构，若无则添加计算属性）：
```js
const totalSeats = computed(() => seatConfig.value.groupCount * seatConfig.value.columnsPerGroup * seatConfig.value.seatsPerColumn)
```

**添加 handleFitZoom 方法**（复用 SeatChart 中的 fitToViewport 逻辑，或通过事件总线/composable 共享）：
- 方案 A：将 `fitToViewport` 提取到 useZoom composable 中（推荐）
- 方案 B：在 SidebarPanel 中 emit 事件，由父组件处理
- 方案 C：直接在 SidebarPanel 中调用 viewport ref 的逻辑

### 步骤 2：修改 SidebarPanel.vue — 模板部分（tabs-bar 结构改造）

将 tabs-bar 从：
```html
<div class="tabs-bar">
  <button v-for="tab in tabs" ... >...</button>
</div>
```

改为：
```html
<div class="tabs-bar">
  <!-- 左侧：座位信息 + 缩放（仅移动端显示） -->
  <div class="toolbar-info">
    <span class="info-item">{{ seatConfig.groupCount }}大组</span>
    <span class="info-separator">·</span>
    <span class="info-item">{{ seatConfig.columnsPerGroup }}列</span>
    <span class="info-separator">·</span>
    <span class="info-item">{{ seatConfig.seatsPerColumn }}座</span>
    <span class="info-separator">·</span>
    <span class="info-item">共{{ totalSeats }}座</span>
    <div class="zoom-controls">
      <button class="zoom-btn" @click.stop="zoomOut" :disabled="scale <= MIN_SCALE">
        <Minus :size="14" stroke-width="2.5" />
      </button>
      <button class="zoom-label" @click.stop="handleFitZoom">
        {{ Math.round(scale.value * 100) }}%
      </button>
      <button class="zoom-btn" @click.stop="zoomIn" :disabled="scale >= MAX_SCALE">
        <Plus :size="14" stroke-width="2.5" />
      </button>
    </div>
  </div>

  <!-- 右侧：tab 按钮 -->
  <div class="tabs-buttons">
    <button v-for="tab in tabs" :key="tab.id" class="tab-button" ... >
      ...
    </button>
  </div>
</div>
```

**关于 drop-zone**：拖拽移出学生的提示需要在合并后的栏中显示。方案是将 `showDropZone` 状态也引入 SidebarPanel，当激活时隐藏 toolbar-info 和 tabs-buttons，显示 drop-zone-hint。

### 步骤 3：修改 SidebarPanel.vue — 样式部分

#### 桌面端（>768px）：无变化
- `.tabs-bar` 保持垂直 flex 布局
- `.toolbar-info` 在桌面端 `display: none`
- `.tabs-buttons` 保持原有样式

#### 移动端（<=768px）：改造 tabs-bar

```css
@media (max-width: 768px) {
  .tabs-bar {
    /* 保持原有的 flex-direction: row, width: 100%, height: 56px */
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    gap: 4px;
  }

  /* 左侧信息区 */
  .toolbar-info {
    display: flex;           /* 移动端显示 */
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 10px;
    color: #666;
  }

  .info-item {
    font-weight: 500;
    color: #23587b;
    white-space: nowrap;
  }

  .info-separator {
    color: #ccc;
    flex-shrink: 0;
  }

  /* 缩放控件 */
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .zoom-btn {
    width: 28px;
    height: 28px;
    /* ... 触控友好尺寸 */
  }

  .zoom-label {
    font-size: 10px;
    padding: 4px 6px;
    /* ... */
  }

  /* 右侧 tab 区 */
  .tabs-buttons {
    display: flex;
    flex-shrink: 0;
    gap: 0;
  }

  .tab-button {
    flex: 1;
    /* 保持原有高度 56px，调整内部布局 */
    padding: 6px 2px;
    font-size: 10px;
  }
}
```

#### 桌面端 toolbar-info 隐藏
```css
.toolbar-info {
  display: none;  /* 默认隐藏，仅在移动端显示 */
}

@media (max-width: 768px) {
  .toolbar-info {
    display: flex;
  }
}
```

### 步骤 4：修改 SeatChart.vue — 移动端隐藏 seat-toolbar

```css
@media (max-width: 768px) {
  .seat-toolbar {
    display: none;  /* 功能已迁移至统一底部栏 */
  }
}
```

桌面端和平板端的 seat-toolbar 保持不变。

### 步骤 5：处理 fitToViewport（自适应缩放）的共享问题

fitToViewport 当前定义在 SeatChart.vue 内部，依赖 `viewportRef` 和 `chartRef`。

**推荐方案**：将 fitToViewport 逻辑提取到 useZoom composable 中，通过 ref 参数传入或提供 registerViewport 方法。

```js
// useZoom.js 扩展
let viewportEl = null
let chartEl = null

export function useZoom() {
  // ... 现有代码 ...

  const registerViewport = (vp, chart) => {
    viewportEl = vp
    chartEl = chart
  }

  const fitToViewport = () => {
    if (!viewportEl || !chartEl) return
    // ... 原 SeatChart 中的 fitToViewport 逻辑 ...
  }

  return {
    // ... 现有返回值 ...
    registerViewport,
    fitToViewport,
  }
}
```

SeatChart.vue 在 onMounted 中调用 `registerViewport(viewportRef.value, chartRef.value)`。
SidebarPanel.vue 直接调用 `handleFitZoom()` 即可。

### 步骤 6：处理 drop-zone（拖拽移出）状态

当前 `showDropZone` 在 SeatChart.vue 中定义，依赖 `isDraggingFromSeat` 和 `candidateAreaComputed`。

**方案**：将 `showDropZone` 状态提升到 composable 层（如 useEditMode 或新建），SidebarPanel 和 SeatChart 都可以读取。

或者更简单的方案：由于移动端 seat-toolbar 已隐藏，drop-zone 提示可以直接放在统一底部栏的 toolbar-info 区域位置，通过 props 或 composable 共享状态。

### 步骤 7：调整 App.vue 的 padding-bottom

如果新的统一底部栏高度保持 56px 则无需调整。若高度变化则同步更新：
```css
@media (max-width: 768px) {
  .main-content {
    padding-bottom: XXpx;  /* 匹配新的 tabs-bar 高度 */
  }
}
```

### 步骤 8：细节优化与测试要点

1. **超窄屏适配**：座位信息文字在小屏可能溢出，使用 ellipsis 或进一步精简
2. **触控目标**：缩放按钮最小触控区域 44x44px
3. **过渡动画**：SidebarPanel 展开/收起的 max-height 过渡保持流畅
4. **日志区域**：移动端已隐藏（原代码 `display: none`），保持不变
5. **z-index 层级**：确保统一底部栏 z-index: 999 不被遮挡

## 涉及文件清单

| 文件 | 改动说明 |
|------|----------|
| `src/composables/useZoom.js` | 提取 fitToViewport/registerViewport |
| `src/components/layout/SidebarPanel.vue` | **主要改动**：模板(tabs-bar)+脚本(导入zoom/seat数据)+样式(移动端复合布局) |
| `src/components/seat/SeatChart.vue` | 移动端隐藏 seat-toolbar；注册 viewport 到 useZoom |
| `src/App.vue` | 可能微调 padding-bottom |

## 风险点

1. **fitToViewport 依赖 DOM 尺寸**：提取到 composable 时需确保 refs 已就绪
2. **drop-zone 状态共享**：需确保拖拽时状态同步到 SidebarPanel
3. **桌面端 tabs-bar 为垂直布局**：新增的 toolbar-info 必须确保桌面端完全隐藏不影响现有布局
4. **缩放响应式引用 scale 是 ref**：模板中访问需用 `scale.value` 或自动解包
