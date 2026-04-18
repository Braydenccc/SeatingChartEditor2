# 标签显示设置功能实现计划

## 需求概述

在标签设置对话框中新增显示设置功能，提供三种标签显示模式：
1. **颜色点模式**（现有）：在学生信息下方显示彩色小圆点
2. **右上角文字模式**：在座位右上角显示标签文字（类似导出图片效果）
3. **座位下部文字模式**：在座位底部显示标签文字

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/composables/useTagData.js` | 新增显示模式状态和方法 |
| `src/components/student/TagSettingsDialog.vue` | 新增显示设置UI |
| `src/components/seat/SeatItem.vue` | 根据模式渲染不同标签样式 |

## 详细实现步骤

### 步骤 1：修改 useTagData.js

在 `useTagData.js` 中新增显示模式相关状态：

```javascript
// 新增：标签显示模式状态
// 可选值: 'dot' | 'corner' | 'bottom'
const tagDisplayMode = ref('dot')

// 新增：设置显示模式的方法
const setTagDisplayMode = (mode) => {
  tagDisplayMode.value = mode
}

// 在 return 中导出
return {
  // ... 现有导出
  tagDisplayMode,
  setTagDisplayMode
}
```

### 步骤 2：修改 TagSettingsDialog.vue

在"在座位表中显示标签"复选框下方添加显示模式选择区域：

**UI 结构**：
```
全局设置
├── [x] 在座位表中显示标签
└── 显示模式（仅当上方勾选时可用）
    ├── ○ 颜色点
    ├── ○ 右上角文字
    └── ○ 座位下部文字
```

**实现要点**：
- 使用单选按钮组（radio buttons）选择显示模式
- 当"在座位表中显示标签"未勾选时，禁用显示模式选择
- 显示模式切换时实时更新座位表

### 步骤 3：修改 SeatItem.vue

根据 `tagDisplayMode` 渲染不同的标签显示方式：

#### 3.1 颜色点模式（现有实现）
保持现有的 `.student-tags` 和 `.tag-dot` 实现。

#### 3.2 右上角文字模式
在 `.seat-item` 内部添加绝对定位的标签容器：
- 位置：右上角，使用 `position: absolute`
- 样式：小号文字 + 背景色 + 圆角
- 参考 `useImageExport.js` 中 `drawTags` 函数的样式

#### 3.3 座位下部文字模式
在 `.student-display` 底部添加标签文字容器：
- 位置：学号下方
- 样式：小号文字，水平排列，带背景色

### 步骤 4：样式调整

为新增的标签显示模式添加相应的 CSS 样式：
- 右上角文字标签：绝对定位、小字号、圆角背景
- 座位下部文字标签：相对定位、水平排列、紧凑布局
- 响应式适配：针对不同屏幕尺寸调整标签大小

## 数据流

```
useTagData.js
    ↓ tagDisplayMode (ref)
TagSettingsDialog.vue
    ↓ 用户选择
useTagData.js
    ↓ setTagDisplayMode()
SeatItem.vue
    ↓ 读取 tagDisplayMode
    ↓ 根据 mode 渲染不同样式
```

## 注意事项

1. **状态持久化**：`tagDisplayMode` 应随工作区数据一起保存和加载
2. **性能考虑**：使用计算属性缓存标签渲染结果
3. **响应式设计**：确保三种模式在不同屏幕尺寸下都能正常显示
4. **兼容性**：确保现有工作区数据不受影响（默认值为 'dot'）
