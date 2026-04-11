# Excel 导出样式模块化优化计划

## 目标
将 Excel 导出的样式设置按模块（标题、座位、行号、组号、讲台、标签表）分类，每个模块新增背景颜色设置，并去掉默认的淡蓝色背景（`#DCEEFF`）。

---

## 现状分析

### 当前样式结构（useExcelData.js）
| 样式对象 | 用途 | 当前是否有 fill | 默认填充色 |
|---------|------|----------------|-----------|
| `styleTitle` | 标题行 | 有 | `#DCEEFF` |
| `styleHeader` | 组号行 | 有 | `#DCEEFF` |
| `styleRowNum` | 行号列 | 有 | `#DCEEFF` |
| `stylePodium` | 讲台行 | 有 | `#DCEEFF` |
| `styleTagHeader` | 标签表表头 | 有 | `#DCEEFF` |
| `styleSeatName` | 有学生的座位 | 无 | 无 |
| `styleSeat` | 空座位 | 无 | 无 |
| `styleEmpty` | 空置座位 | 无 | 无 |
| `styleVacant` | 空闲座位 | 无 | 无 |

### 当前设置面板（ExportPreview.vue Excel Tab）
- 内容 → 显示选项
- 外观 → 配色模式 + 边框开关
- 边框设置 → 外边框/内边框（样式+颜色）
- 字体样式 → 标题/表头/座位单元格（字号+颜色+粗体+斜体）—— **缺少背景色**
- 格式化 → 内容模板 + 编号方案
- 标签统计表 → 开关 + 位置

### 问题
1. 背景色硬编码为 `#DCEEFF`，用户无法修改
2. 行号/组号/讲台的样式与"表头"混在一起，没有独立控制
3. 座位单元格完全没有背景色选项

---

## 实施步骤

### 步骤 1：扩展导出设置（useExportSettings.js）

在 `exportSettings` 中新增各模块的背景颜色字段，默认值为空字符串（表示无填充）：

```
// 新增：各模块背景颜色（默认无填充）
excelTitleFillColor: '',          // 标题背景色
excelHeaderFillColor: '',         // 表头(组号)背景色
excelRowNumFillColor: '',         // 行号背景色
excelPodiumFillColor: '',         // 讲台背景色
excelSeatFillColor: '',           // 座位格背景色
excelEmptyFillColor: '',          // 空置格背景色
excelVacantFillColor: '',         // 空闲格背景色
excelTagHeaderFillColor: '',      // 标签表表头背景色
```

同时删除旧的默认值中不再需要的字段（`titleFillColor`/`headerFillColor` 原本就不在 exportSettings 中，是在 useExcelData.js 的 options 默认值里）。

### 步骤 2：改造 generateSeatChartWorkbook（useExcelData.js）

#### 2a. 扩展 options 解构
新增背景颜色参数，默认值全部改为空字符串：

```js
// 新增背景颜色参数
titleFillColor: '',
headerFillColor: '',
rowNumFillColor: '',
podiumFillColor: '',
seatFillColor: '',
emptyFillColor: '',
vacantFillColor: '',
tagHeaderFillColor: '',
```

同时将原有的 `titleFillColor: '#DCEEFF'` 和 `headerFillColor: '#DCEEFF'` 默认值改为空字符串。

删除 `COLOR_FILL_COLOR = 'DCEEFF'` 常量及相关 `accent` 对象（如果不再需要）。保留 `MONO_FILL_COLOR` 用于 bw 模式的回退。

#### 2b. 重构样式构建逻辑
创建一个辅助函数来条件性添加 fill 属性：

```js
const buildFill = (colorRgb) => {
  if (!colorRgb) return {}
  return { fill: { patternType: 'solid', fgColor: { rgb: colorRgb } } }
}
```

然后重构各样式对象，使用独立的颜色变量：

```js
const titleFillRgb   = normalizeHexColor(titleFillColor, '')   // 允许空
const headerFillRgb  = normalizeHexColor(headerFillColor, '')
const rowNumFillRgb  = normalizeHexColor(rowNumFillColor, '')
const podiumFillRgb  = normalizeHexColor(podiumFillColor, '')
const seatFillRgb    = normalizeHexColor(seatFillColor, '')
const emptyFillRgb   = normalizeHexColor(emptyFillColor, '')
const vacantFillRgb  = normalizeHexColor(vacantFillColor, '')
const tagHeaderFillRgb = normalizeHexColor(tagHeaderFillColor, '')
```

各样式对象改为：

```js
const styleTitle = {
  font: { ... },
  alignment: center,
  border: thinBorder(),
  ...buildFill(titleFillRgb)
}
// ... 同理其他样式
```

对于 `accent` 对象（bw 模式下的强调色），保留但仅用于无显式填充时的回退。当用户设置了明确的填充色时优先使用用户设置。

### 步骤 3：重构设置面板 UI（ExportPreview.vue）

#### 3a. 重组"字体样式"区域为"样式"区域
将原来的"字体样式" section 改名为 **"样式"**，内部按模块分类，每个模块包含：
- 字体相关：字号、颜色、粗体、斜体
- **新增**：背景颜色选择器

模块划分如下：

**1. 标题模块**
- 字号(pt)、字体颜色、粗体、斜体
- 背景颜色

**2. 表头模块（组号行）**
- 字号(pt)、字体颜色、粗体、斜体
- 背景颜色

**3. 行号模块**
- 字号(pt)、字体颜色、粗体、斜体（可与表头共享或独立——当前代码行号使用 headerFont* 设置）
- 背景颜色

**4. 讲台模块**
- 字号(pt)、字体颜色、粗体、斜体
- 背景颜色

**5. 座位格模块**
- 姓名字号、学号字号、列宽、行高
- 字体颜色、粗体、斜体
- 背景颜色

**6. 特殊座位模块**（可选，可合并到座位格）
- 空置格背景色
- 空闲格背景色

> 注意：为了不过度复杂化UI，行号的字体样式可以继续与表头共享（因为当前代码中 styleRowNum 使用 headerFont*），但背景色独立。讲台的字体样式也可与表头共享，背景色独立。

#### 3b. 简化的模块方案（推荐）

考虑到 UX 和当前代码的实际样式共享情况，采用以下精简方案：

| 模块 | 独立控制项 |
|-----|-----------|
| **标题** | 字号、颜色、粗体、斜体、**背景色** |
| **表头**（组号/行号/讲台共用字体） | 字号、颜色、粗体、斜体 |
| &nbsp;&nbsp;├ 组号背景色 | **背景色**（独立） |
| &nbsp;&nbsp;├ 行号背景色 | **背景色**（独立） |
| &nbsp;&nbsp;└ 讲台背景色 | **背景色**（独立） |
| **座位格** | 姓名字号、学号字号、颜色、粗体、斜体、**背景色** |
| **标签表** | 表头**背景色**（独立） |

#### 3c. UI 结构示意

```
<h4>样式</h4>

<!-- 标题 -->
<div class="font-style-section">
  <h5>标题</h5>
  <div class="spacing-grid">
    <div class="num-input">字号</div>
    <div class="color-input">字体颜色</div>
    <div class="color-input">背景颜色  ← 新增</div>
  </div>
  <div class="font-style-row">粗体 / 斜体</div>
</div>

<!-- 表头（基础字体共用） -->
<div class="font-style-section">
  <h5>表头（组号/行号/讲台）</h5>
  <div class="spacing-grid">
    <div class="num-input">字号</div>
    <div class="color-input">字体颜色</div>
  </div>
  <div class="font-style-row">粗体 / 斜体</div>
  <!-- 子项背景色 -->
  <div class="sub-fill-row">
    <div class="color-input">组号背景</div>
    <div class="color-input">行号背景</div>
    <div class="color-input">讲台背景</div>
  </div>
</div>

<!-- 座位格 -->
<div class="font-style-section">
  <h5>座位格</h5>
  <div class="spacing-grid">
    <div class="num-input">姓名字号</div>
    <div class="num-input">学号字号</div>
    <div class="color-input">字体颜色</div>
    <div class="color-input">背景颜色  ← 新增</div>
  </div>
  <div class="font-style-row">粗体 / 斜体</div>
</div>
```

### 步骤 4：更新数据传递链路

在 `ExportPreview.vue` 中，以下位置需要传递新的背景色参数：

1. **`updateExcelWorkbook()` 函数** — 添加新字段到 options 对象
2. **`handleExcelDownload()` 函数** — 添加新字段到 options 对象
3. **`handleCloudExportExcel()` 函数** — 添加新字段到 options 对象
4. **watch 监听器** — 将新字段加入依赖数组以触发预览刷新

### 步骤 5：CSS 微调

- `.color-input` 已有 grid 布局，新增背景色选择器可直接复用
- 可能需要调整 `.spacing-grid` 为 3 列或 4 列以容纳更多颜色选择器
- 或者在子背景色区域使用 flex 横排布局

---

## 涉及文件清单

| 文件 | 改动类型 |
|-----|---------|
| `src/composables/useExportSettings.js` | 新增背景色字段 |
| `src/composables/useExcelData.js` | 重构样式构建逻辑、新增参数 |
| `src/components/layout/ExportPreview.vue` | 重构 UI、更新数据传递 |

---

## 验证方式
1. 打开导出设置 → Excel 导出 Tab
2. 确认各模块都有背景颜色选择器
3. 确认默认状态下所有背景均为透明/无填充（无淡蓝色）
4. 分别设置各模块背景色，验证预览正确反映
5. 下载 Excel 文件验证实际效果
