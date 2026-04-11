# Excel 导出优化 - Product Requirement Document

## Overview
- **Summary**: 优化 Excel 导出功能，增强边框样式自定义能力，并添加更多有用的自定义选项，让用户可以更灵活地控制导出 Excel 的外观和格式。
- **Purpose**: 解决当前 Excel 导出功能中边框样式选择有限、自定义选项不够丰富的问题，满足用户对导出文件多样化外观的需求。
- **Target Users**: 教师、教育工作者、需要导出座位表的用户。

## Goals
- 增强边框样式自定义，支持更多边框类型和独立设置
- 添加更多字体和颜色自定义选项
- 支持背景颜色和填充样式的自定义
- 支持单元格内容模板中每个占位符的独立样式设置
- 优化 UI 界面，让设置更直观易用
- 保持与现有功能的兼容性

## Non-Goals (Out of Scope)
- 不修改 Excel 导入功能
- 不修改图片导出功能
- 不添加数据透视表等高级 Excel 功能
- 不修改核心数据结构

## Background & Context
- 当前项目已使用 `xlsx-js-style` 库支持基本的 Excel 样式
- 已有边框颜色和是否显示边框的设置，但边框样式选择有限
- 已有字号、列宽、行高等基本设置
- 导出预览功能已支持切换工作表
- 需要新增功能与现有架构保持一致

## Functional Requirements
- **FR-1**: 支持更多边框样式（细、中、粗、虚线、点线、双线条等）
- **FR-2**: 支持独立设置内边框和外边框样式
- **FR-3**: 支持自定义标题、表头、座位单元格的字体样式（粗体、斜体等）
- **FR-4**: 支持自定义标题、表头、座位单元格的颜色（字体色、背景色）
- **FR-5**: 支持单元格内容模板中每个占位符的独立样式设置（字体大小、颜色、粗体、斜体等）
- **FR-6**: 在 UI 界面中添加新设置的控制面板
- **FR-7**: 保持 Excel 预览功能与新设置同步更新

## Non-Functional Requirements
- **NFR-1**: 新设置应该有合理的默认值，保持现有导出效果不变
- **NFR-2**: UI 改动应该符合项目现有的视觉规范
- **NFR-3**: 性能应该与现有版本相当，新增设置不应显著降低导出速度
- **NFR-4**: 代码改动应该遵循项目的编码规范

## Constraints
- **Technical**: 使用现有的 `xlsx-js-style` 库，不引入新的 Excel 处理库
- **Business**: 保持向后兼容，现有设置应该继续有效
- **Dependencies**: 依赖现有的 Composables 架构和组件结构

## Assumptions
- 用户希望保持默认设置与当前版本一致
- 新增设置应该可以独立控制，不影响其他设置
- xlsx-js-style 库支持所需的边框和样式选项

## Acceptance Criteria

### AC-1: 边框样式增强
- **Given**: 用户打开 Excel 导出设置
- **When**: 用户选择不同的边框样式选项
- **Then**: 导出的 Excel 文件应该正确应用所选的边框样式
- **Verification**: `programmatic`
- **Notes**: 支持 thin、medium、thick、dashed、dotted、double 等样式

### AC-2: 内外边框独立设置
- **Given**: 用户打开 Excel 导出设置
- **When**: 用户分别设置内边框和外边框样式
- **Then**: 导出的 Excel 文件应该正确区分内边框和外边框
- **Verification**: `human-judgment`
- **Notes**: 外边框可以比内边框更粗或使用不同样式

### AC-3: 字体样式自定义
- **Given**: 用户打开 Excel 导出设置
- **When**: 用户设置标题、表头、座位单元格的字体样式（粗体、斜体）
- **Then**: 导出的 Excel 文件应该正确应用所选的字体样式
- **Verification**: `human-judgment`

### AC-4: 颜色自定义
- **Given**: 用户打开 Excel 导出设置
- **When**: 用户设置标题、表头、座位单元格的字体颜色和背景颜色
- **Then**: 导出的 Excel 文件应该正确应用所选的颜色
- **Verification**: `human-judgment`

### AC-5: UI 界面更新
- **Given**: 用户打开 Excel 导出设置面板
- **When**: 用户查看设置选项
- **Then**: 应该能看到新增的边框、字体、颜色设置选项
- **Verification**: `human-judgment`
- **Notes**: 界面应该符合项目现有的视觉风格

### AC-6: 预览功能同步
- **Given**: 用户调整 Excel 导出设置
- **When**: 用户查看预览
- **Then**: 预览应该实时反映新设置的效果
- **Verification**: `human-judgment`

### AC-7: 单元格内容模板占位符样式自定义
- **Given**: 用户打开 Excel 导出设置
- **When**: 用户为单元格内容模板中的不同占位符（姓名、学号、行号、组号、序号）设置独立的样式
- **Then**: 导出的 Excel 文件中每个占位符应该正确应用各自的样式
- **Verification**: `human-judgment`
- **Notes**: 支持的样式包括：字体大小、颜色、粗体、斜体

### AC-8: 向后兼容
- **Given**: 用户使用默认设置导出 Excel
- **When**: 用户不修改任何新设置
- **Then**: 导出结果应该与优化前保持一致
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要支持单元格对齐方式的自定义？
- [ ] 是否需要支持更多的字体样式（如下划线、删除线）？
- [ ] 是否需要预设一些常用的样式模板供用户快速选择？
