# Excel 导出优化 - The Implementation Plan (Decomposed and Prioritized Task List)

## [ ] Task 1: 扩展 useExportSettings 添加新配置项
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 useExportSettings.js 中添加新的 Excel 导出配置项
  - 包括：内/外边框样式、各种字体样式和颜色设置
  - 包括：单元格内容模板中每个占位符（姓名、学号、行号、组号、序号）的独立样式配置
  - 设置合理的默认值保持向后兼容
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3, AC-4, AC-7, AC-8]
- **Test Requirements**:
  - `programmatic` TR-1.1: 新增配置项有默认值，与现有效果一致
  - `human-judgement` TR-1.2: 配置项命名符合项目规范
- **Notes**: 保持现有配置项不变，只新增

## [ ] Task 2: 更新 useExcelData 支持新样式选项
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 修改 generateSeatChartWorkbook 函数，接受并应用新的样式选项
  - 实现内边框和外边框的区分逻辑
  - 更新单元格样式对象，支持字体样式和颜色自定义
  - 修改 formatCellContent 函数，支持为每个占位符应用独立样式
  - 实现富文本单元格生成逻辑（xlsx-js-style 的 rich text 格式）
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3, AC-4, AC-7, AC-8]
- **Test Requirements**:
  - `programmatic` TR-2.1: 边框样式正确传递给 xlsx-js-style
  - `human-judgement` TR-2.2: 内边框和外边框样式正确区分应用
  - `human-judgement` TR-2.3: 字体样式（粗体、斜体）正确应用
  - `human-judgement` TR-2.4: 颜色设置正确应用
  - `human-judgement` TR-2.5: 单元格内容模板占位符样式正确应用
- **Notes**: 需要修改 thinBorder 辅助函数，区分内外边框；需要使用 xlsx-js-style 的 rich text 功能

## [ ] Task 3: 更新 ExportPreview UI 添加新设置控件
- **Priority**: P1
- **Depends On**: Task 1
- **Description**: 
  - 在 Excel 设置面板中添加新的设置区域
  - 添加边框样式选择器（细、中、粗、虚线、点线、双线条）
  - 添加内外边框独立设置
  - 添加字体样式和颜色选择器
  - 添加单元格内容模板占位符样式设置区域（姓名、学号、行号、组号、序号）
  - 为每个占位符提供样式设置（字体大小、颜色、粗体、斜体）
- **Acceptance Criteria Addressed**: [AC-5, AC-6]
- **Test Requirements**:
  - `human-judgement` TR-3.1: 新设置控件布局合理，符合项目视觉风格
  - `human-judgement` TR-3.2: 设置选项描述清晰易懂
  - `human-judgement` TR-3.3: 单元格内容模板占位符样式设置区域布局清晰
- **Notes**: 新增设置应该放在合适的分组中，保持界面整洁

## [ ] Task 4: 更新预览渲染逻辑支持新样式
- **Priority**: P1
- **Depends On**: Task 2, Task 3
- **Description**: 
  - 更新 Excel 预览的 getCssFromStyle 函数
  - 支持渲染新的边框样式
  - 支持渲染新的字体样式和颜色
  - 支持渲染单元格内容模板中占位符的独立样式
  - 处理富文本单元格的预览渲染
- **Acceptance Criteria Addressed**: [AC-6, AC-7]
- **Test Requirements**:
  - `human-judgement` TR-4.1: 预览正确显示所有新边框样式
  - `human-judgement` TR-4.2: 预览正确显示字体样式（粗体、斜体）
  - `human-judgement` TR-4.3: 预览正确显示自定义颜色
  - `human-judgement` TR-4.4: 预览正确显示单元格内容模板占位符的独立样式
- **Notes**: 需要将 xlsx-js-style 的样式映射为 CSS；需要处理 rich text 格式的预览

## [ ] Task 5: 更新监听器和下载函数
- **Priority**: P1
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 更新 updateExcelWorkbook 中的 watch 监听列表
  - 更新 handleExcelDownload 函数传递新选项
  - 更新 handleCloudExportExcel 函数传递新选项
  - 确保单元格内容模板占位符样式选项也被正确传递
- **Acceptance Criteria Addressed**: [AC-6, AC-7]
- **Test Requirements**:
  - `programmatic` TR-5.1: 新设置变化能触发预览更新
  - `programmatic` TR-5.2: 下载功能正确传递所有新选项
- **Notes**: 确保所有调用 generateSeatChartWorkbook 的地方都更新

## [ ] Task 6: 整体测试与验证
- **Priority**: P2
- **Depends On**: Task 3, Task 4, Task 5
- **Description**: 
  - 测试所有新设置的组合
  - 验证向后兼容性（默认设置与原效果一致）
  - 检查预览与实际导出文件的一致性
  - 测试单元格内容模板占位符样式的各种组合
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8]
- **Test Requirements**:
  - `human-judgement` TR-6.1: 所有设置组合都能正常工作
  - `human-judgement` TR-6.2: 默认设置与原效果一致
  - `human-judgement` TR-6.3: 预览与实际导出一致
  - `human-judgement` TR-6.4: 单元格内容模板占位符样式正确显示
