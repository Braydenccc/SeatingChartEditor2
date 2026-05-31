---
name: bugfix
description: 座位表编辑器 v2 的 Bug 修复工作流 - 系统化诊断、验证和修复流程
---

# Bug 修复工作流

本 skill 为座位表编辑器 v2 项目定制，遵循项目架构模式和测试规范。

## 阶段 1：问题诊断 (Diagnosis)

### 1.1 收集信息

**必须明确的信息：**
- 预期行为 vs 实际行为
- 复现步骤（具体操作序列）
- 影响范围（哪些功能/组件受影响）
- 错误信息（控制台错误、Vue 警告）
- 环境信息（浏览器/桌面端、操作系统）

**提问模板：**
```
1. 你期望看到什么行为？
2. 实际发生了什么？
3. 如何复现这个问题？（具体步骤）
4. 是否有错误信息？（截图或文本）
5. 在哪个环境下出现？（Web/Tauri/Electron）
```

### 1.2 定位问题层级

按优先级检查：

**A. 状态管理层（Composables）**
- 检查相关 composable 的状态更新逻辑
- 验证响应式引用是否正确使用 `.value`
- 确认单例模式是否正确实现（模块作用域声明）

**B. 组件交互层**
- 检查事件处理函数（`@click`, `@input` 等）
- 验证 props 传递和 emit 事件
- 确认 v-model 双向绑定

**C. 数据结构层**
- 座位数据：扁平数组 `seats` 与三级结构 `organizedSeats`
- 学生数据：排序逻辑（无学号在前）
- 映射关系：`seatMap` 的 O(1) 查找

**D. UI/样式层**
- CSS 布局问题（Flexbox/Grid）
- 响应式设计（移动端适配）
- 视觉反馈（hover/active 状态）

### 1.3 项目特定检查清单

**状态管理陷阱：**
- [ ] 是否在组件内部创建了新的 composable 实例？（应该在模块作用域）
- [ ] 是否忘记 `.value` 访问 ref？
- [ ] 是否直接修改了 computed 属性？

**数据结构陷阱：**
- [ ] 座位分配后是否同步更新了 `seatMap`？
- [ ] 学生删除时是否检查了"无姓名、无学号、无标签"条件？
- [ ] 座位配置变更时是否清除了旧的分配数据？

**跨平台兼容性：**
- [ ] 是否在 `src/` 下直接使用了 Node.js 模块（`fs`, `path`）？
- [ ] 文件操作是否通过 WebDAV 或 IPC 隔离？

**UI 规范：**
- [ ] 是否使用了 Emoji？（项目严禁）
- [ ] 图标是否来自 `lucide-vue-next`？（统一图标库）
- [ ] 是否使用了 base64 编码？（项目禁止，应用 `URL.createObjectURL()`）

## 阶段 2：代码审查 (Code Review)

### 2.1 定位相关文件

**按功能模块查找：**
```bash
# 学生管理相关
src/composables/useStudentData.js
src/components/StudentList.vue
src/components/StudentItem.vue

# 座位管理相关
src/composables/useSeatChart.js
src/components/SeatChart.vue
src/components/SeatItem.vue

# 编辑模式相关
src/composables/useEditMode.js

# 规则引擎相关
src/composables/useSeatRules.js
src/composables/useAssignment.js

# 区域轮换相关
src/composables/useZoneData.js
src/composables/useZoneRotation.js
```

**查阅深度文档：**
修改复杂模块前，先阅读 `.agents/features/` 对应文档：
- `01-core-datamodel.md` — 数据模型与状态管理
- `02-layout-editor.md` — 座位布局编辑
- `03-student-management.md` — 学生管理
- `04-rule-engine.md` — 规则引擎
- `05-auto-assignment.md` — 自动排位算法
- `06-zone-rotation.md` — 区域轮换系统

### 2.2 使用工具定位

```bash
# 搜索关键字
Grep pattern:"关键函数名或变量名" output_mode:"content"

# 查找相关文件
Glob pattern:"**/*关键词*.{vue,js,ts}"

# 读取完整文件
Read file_path:"src/composables/useXXX.js"
```

### 2.3 分析代码逻辑

**检查点：**
1. 函数签名和参数验证
2. 边界条件处理（空数组、null、undefined）
3. 异步操作的错误处理
4. 响应式数据的正确访问
5. 副作用的清理（watchEffect 返回的 stop 函数）

## 阶段 3：修复实施 (Fix Implementation)

### 3.1 编写修复代码

**原则：**
- 最小化改动范围
- 保持代码风格一致
- 不引入新的依赖（除非必要）
- 遵循项目命名规范（PascalCase 组件、camelCase composable）

**TypeScript 迁移注意：**
- 新文件使用 `.ts` 扩展名
- 类型定义放在 `src/types/`
- 项目使用宽松模式（`strict: false`）

**禁止事项：**
- 不使用 Emoji
- 不使用 base64 编码
- 不在 `src/` 下直接调用 Node.js 模块
- 不使用内联 SVG 作为图标
- 不自动运行 `npm run build` 或 `npm run dev`

### 3.2 使用 Edit 工具

```javascript
Edit({
  file_path: "src/composables/useXXX.js",
  old_string: "// 精确匹配的旧代码",
  new_string: "// 修复后的新代码"
})
```

**注意：**
- `old_string` 必须在文件中唯一
- 保持原有缩进格式
- 如果需要重命名符号，使用 `replace_all: true`

## 阶段 4：测试验证 (Testing)

### 4.1 运行相关测试

**按模块运行：**
```bash
npm run test:student    # 学生数据测试
npm run test:seat       # 座位图测试
npm run test:assignment # 分配算法测试
```

**完整测试：**
```bash
npm run test:run        # 单次运行所有测试
npm run test:coverage   # 生成覆盖率报告
```

**类型检查：**
```bash
npm run type-check      # TypeScript 类型检查
```

### 4.2 编写新测试（如需要）

**测试文件位置：**
```
src/composables/__tests__/useXXX.test.js
```

**使用测试工具：**
```javascript
import { createMockSeatChart, createMockStudentData } from '@/test-utils/mocks'
import { createMockStudent, createMockSeats } from '@/test-utils/factories'
import { expectSeatToHaveStudent } from '@/test-utils/assertions'

describe('Bug Fix: 描述问题', () => {
  it('should 预期行为', () => {
    // Arrange
    const { students, addStudent } = createMockStudentData()
    
    // Act
    addStudent({ name: '张三', studentNumber: 1 })
    
    // Assert
    expect(students.value).toHaveLength(1)
  })
})
```

**覆盖率目标：**
- Lines: 70%
- Functions: 70%
- Branches: 60%
- Statements: 70%

### 4.3 手动测试

**UI 相关 Bug 必须手动验证：**
1. 启动开发服务器（用户手动运行 `npm run dev`）
2. 复现原始问题的步骤
3. 验证修复后的行为
4. 测试边界情况
5. 检查是否引入回归问题

**多端测试（如适用）：**
- Web 浏览器（Chrome/Firefox/Safari）
- Tauri 桌面端
- 移动端响应式布局

## 阶段 5：文档与提交 (Documentation)

### 5.1 更新相关文档

**如果修复涉及架构变更：**
- 更新 `AGENTS.md`
- 更新 `.agents/features/` 对应文档
- 更新 `.agents/rules/项目规范.md`

### 5.2 Git 提交

**提交信息格式：**
```
fix: 简短描述问题（50字符内）

- 详细说明问题原因
- 说明修复方案
- 列出影响范围

Closes #issue_number (如果有关联 Issue)

Co-Authored-By: Codex Sonnet 4.6 (1M context) <noreply@anthropic.com>
```

**提交前检查：**
```bash
git status              # 查看变更文件
git diff                # 查看具体改动
npm run test:run        # 确保测试通过
npm run type-check      # 确保类型检查通过
```

### 5.3 创建 GitHub Issue（如需要）

**使用 GitHub MCP server 创建 Issue：**

**标签要求：**
- `agent` — 必须添加
- `Bug` 或 `功能建议` — 二选一

**Issue 模板：**
```markdown
# [严重程度] 简短描述

## 问题描述
详细描述问题的表现和影响

## 影响范围
- 受影响的功能模块
- 受影响的用户场景

## 代码位置
- 文件：src/composables/useXXX.js:42-51
- 相关组件：SeatChart.vue, StudentList.vue

## 修复建议
（可选）提供可能的修复方案
```

**严重程度分级：**
- `严重` — 核心功能完全不可用、数据丢失风险
- `高危` — 主要功能受阻、影响大量用户
- `中等` — 部分功能异常、有替代方案
- `低` — 边缘情况、视觉问题

## 阶段 6：复盘与预防 (Retrospective)

### 6.1 根因分析

**思考问题：**
1. 为什么会出现这个 Bug？
2. 为什么测试没有发现？
3. 是否有类似的潜在问题？
4. 如何预防类似问题？

### 6.2 改进措施

**代码层面：**
- 添加防御性检查（参数验证、边界条件）
- 增加单元测试覆盖
- 改进类型定义（TypeScript）

**流程层面：**
- 更新开发规范文档
- 添加 Code Review 检查项
- 完善测试用例库

### 6.3 知识沉淀

**更新项目文档：**
- 在 `.agents/features/` 添加"易错陷阱"章节
- 在 `AGENTS.md` 补充注意事项
- 在测试文档中添加回归测试用例

## 快速参考

### 常见 Bug 类型与定位

| Bug 类型 | 检查位置 | 常见原因 |
|---------|---------|---------|
| 状态不更新 | Composable | 忘记 `.value`、非响应式赋值 |
| 数据不同步 | `seatMap` 更新逻辑 | 座位分配后未更新映射 |
| 学生删除失败 | `useStudentData.js` | 未满足删除条件（有姓名/学号/标签） |
| 座位配置异常 | `useSeatChart.js` | 配置变更未清除旧数据 |
| 跨平台兼容性 | `src/` 下的文件操作 | 直接使用 Node.js 模块 |
| UI 渲染问题 | 组件 template | CSS 布局、条件渲染逻辑 |
| 拖拽异常 | `useDragState.js` | 事件监听未清理、状态未重置 |
| 规则不生效 | `useSeatRules.js` | 规则优先级、条件判断错误 |

### 调试工具

```javascript
// 在 composable 中添加调试日志
import { useLogger } from '@/composables/useLogger'
const { logInfo, logError } = useLogger()

logInfo('调试信息', { data: someValue })
logError('错误信息', error)
```

### 项目特定命令

```bash
# 开发
npm run dev              # 启动开发服务器（用户手动运行）

# 测试
npm run test:run         # 运行所有测试
npm run test:student     # 学生数据测试
npm run test:seat        # 座位图测试
npm run test:assignment  # 分配算法测试
npm run test:coverage    # 覆盖率报告
npm run test:ui          # Vitest UI

# 类型检查
npm run type-check       # TypeScript 类型检查

# 构建
npm run build:web        # Web 版本
npm run build:desktop    # Tauri 桌面版
npm run build:test       # 测试环境版本
```

## 总结

修复 Bug 的核心流程：

1. **诊断** — 明确问题、定位层级、检查陷阱
2. **审查** — 定位文件、查阅文档、分析逻辑
3. **修复** — 最小改动、遵循规范、使用工具
4. **测试** — 自动测试、手动验证、多端检查
5. **文档** — 更新文档、规范提交、创建 Issue
6. **复盘** — 根因分析、改进措施、知识沉淀

**记住：**
- 先理解问题，再动手修复
- 测试驱动，证据先行
- 最小改动，避免过度工程
- 文档同步，知识沉淀
