---
trigger: always_on
---

# 编码与视觉规范

## 命名

- 组件：PascalCase（SeatChart.vue）
- Composable：camelCase + use 前缀（useStudentData.js）
- 常量：camelCase

## 目录

- 布局：src/components/layout/
- 功能：src/components/student/、src/components/seat/、src/components/rule/、src/components/zone/

## 交互

- **严禁 Emoji**：代码、注释、UI 中禁止任何 Emoji
- 点击穿透：StudentItem 用 event.target.closest 避开按钮/输入框
- 配置覆盖：新座位表配置会清除已分配数据，需确认对话框
- 学生删除：仅允许删"无姓名+无学号+无标签"的学生
- sortedStudents：无学号→学号升序

## 视觉

- 品牌色：#23587b
- 阴影：0 2px 4px rgba(0,0,0,0.08)
- 圆角：6-12px
- 渐变：linear-gradient(135deg, #23587b, #2d6a94)
- 过渡：all 0.2s ease