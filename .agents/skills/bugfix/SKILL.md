---
name: bugfix
description: 座位表编辑器 v2 的 Codex 专用 Bug 修复工作流。用于用户要求修复、诊断、复现、验证本仓库中的 Bug 时，指导 Codex 按项目规范读取上下文、最小化修改、使用 apply_patch 编辑、运行相关测试，并避免自动启动开发服务器、自动构建或自动提交。
---

# Codex Bug 修复工作流

本 skill 专用于 `座位表编辑器 v2`。目标是让 Codex 在修 Bug 时少问空泛问题，多用本地代码和测试找证据；改动要小，验证要明确，不能碰用户已有的无关改动。

## 0. 启动规则

- 使用本 skill 时，先快速确认当前请求是 Bug 修复、异常诊断、回归验证或修复后复盘。
- 如果用户只问原因或要代码审查，先回答问题或按 review 方式给发现；除非用户明确要修，否则不要擅自改代码。
- 如果用户要求“继续”“直接修”“帮我处理”，默认执行诊断、修复和验证，不停在方案阶段。
- 缺少复现信息时，先从代码、测试、日志和现有文档推断；只有关键事实无法推断且继续会有风险时，再问一个简短问题。

## 1. 项目边界

必须遵守仓库根目录 `AGENTS.md` 中的规则，尤其是：

- 不自动运行 `npm run dev`、`npm run build`、`npm run build:web`、`npm run build:desktop`、`npm run build:test`。
- 不直接修改 `dist/`。
- 不使用 Emoji。
- 图标统一使用 `lucide-vue-next`，按需具名导入，用 `:size` 控制尺寸；不要内联 SVG 或用 Unicode 充当图标。
- CSS 颜色使用 `src/assets/main.css` 中的 `var(--color-*)` 变量；不要新增硬编码十六进制、RGB 或 RGBA。
- 不使用 base64；本地图片显示用 `URL.createObjectURL()`。
- 新文件优先使用 `.ts`，类型放在 `src/types/`；迁移中的旧 `.js` 文件按现状小步修改。
- 不自动创建 Git 提交、分支、PR 或 GitHub Issue，除非用户明确要求。

## 2. 快速定位

优先使用 Codex 当前工具链：

- 搜索文件：`rg --files`
- 搜索内容：`rg "关键词" 路径`
- 读取文件：`Get-Content -Path <path>`
- 多个只读命令可用 `multi_tool_use.parallel` 并行。
- 修改文件必须使用 `apply_patch`。不要用 shell 写入命令、Python 脚本或重定向来手工改文件。

常用入口：

- 学生数据：`src/composables/useStudentData.ts`
- 座位数据：`src/composables/useSeatChart.js`
- 编辑模式：`src/composables/useEditMode.js`
- 规则引擎：`src/composables/useSeatRules.js`
- 自动排位：`src/composables/useAssignment.js`
- 区域数据：`src/composables/useZoneData.ts`
- 区域轮换：`src/composables/useZoneRotation.js`
- 座位组件：`src/components/seat/SeatChart.vue`、`src/components/seat/SeatItem.vue`
- 学生组件：`src/components/student/StudentList.vue`、`src/components/student/StudentItem.vue`
- 布局组件：`src/App.vue`、`src/views/EditorView.vue`、`src/components/workbench/EditorWorkbench.vue`

复杂模块先按需阅读 `.agents/features/`：

- 数据模型：`.agents/features/01-core-datamodel.md`
- 布局编辑：`.agents/features/02-layout-editor.md`
- 学生管理：`.agents/features/03-student-management.md`
- 规则引擎：`.agents/features/04-rule-engine.md`
- 自动排位：`.agents/features/05-auto-assignment.md`
- 区域轮换：`.agents/features/06-zone-rotation.md`
- 云端同步：`.agents/features/07-cloud-sync.md`
- 导出系统：`.agents/features/08-export-system.md`

## 3. 诊断顺序

按最可能的层级向下查：

1. 状态管理层：检查 composable 的模块作用域单例、`ref` 的 `.value`、`computed` 是否被错误写入。
2. 数据结构层：检查扁平 `seats`、`organizedSeats`、`seatMap` 是否同步，配置变更是否处理旧座位和旧分配。
3. 组件交互层：检查 props、emit、`v-model`、点击/拖拽事件、watch 清理。
4. 规则与算法层：检查规则优先级、过滤条件、随机性、冲突处理和边界输入。
5. UI/样式层：检查 Flex/Grid、容器高度、滚动区域、移动端约束、颜色变量和图标规范。
6. 平台层：检查 Web/Tauri/Electron 差异，避免在 `src/` 直接使用 Node.js 模块。

常见陷阱：

- 座位分配后忘记更新 `seatMap`。
- 删除学生时没有同步座位占用、选择状态或标签引用。
- 配置行列变化后旧座位、禁用座位、分区数据残留。
- 拖拽状态未在失败、取消或组件卸载时重置。
- 组合式状态在组件内重复创建，破坏共享单例。
- UI 改动触碰 `App.vue` 严格高度结构，导致页面溢出。

## 4. 修复方式

- 先理解现有模式，再做最小改动。
- 优先修源文件，不改构建产物。
- 修改现有文件前先读取相关片段。
- 用 `apply_patch` 做局部 diff；不要全文件重写，除非文件本身就是本次要重写的文档或模板。
- 遇到用户已有改动时，保留并绕开；如果同一文件内有相关改动，先读清楚再合并自己的改法。
- 新增抽象必须有实际收益：减少重复、降低复杂度或匹配已有模式。
- UI 修复要同时检查文字是否溢出、控件尺寸是否稳定、颜色和图标是否符合规范。

## 5. 测试验证

优先运行和改动相关的最小测试：

```bash
npm run test:student
npm run test:seat
npm run test:assignment
npm run test:integration
npm run test:edge
```

必要时运行：

```bash
npm run test:run
npm run type-check
```

注意：

- 不自动运行构建命令。
- UI 相关修复如果已有 dev server，可用 Browser 插件打开本地页面验证。
- 如果没有 dev server，说明需要用户手动运行 `npm run dev` 后再做浏览器验证。
- 修复共享逻辑、算法、数据结构时，优先补充或更新 Vitest 用例。
- 新测试文件放在现有测试目录；临时测试脚本放 `test-scr/`，不要放 `src/` 或 `public/`。

测试文件参考：

- `src/composables/__tests__/useStudentData.test.js`
- `src/composables/__tests__/useSeatChart.test.js`
- `src/composables/__tests__/useSeatRules.test.js`
- `src/composables/__tests__/useAssignment.test.js`
- `src/composables/__tests__/integration.test.js`
- `src/composables/__tests__/edge-cases.test.js`

## 6. 文档与沉淀

- 只有修复改变了业务规则、数据模型、架构约定或易错点时，才更新文档。
- 优先更新 `.agents/features/` 中对应功能文档。
- 只有项目级规则变化时才更新 `AGENTS.md` 或 `.agents/rules/项目规范.md`。
- 不创建 `*-UPDATE.md`、`*-REPORT.md`、`*-SUMMARY.md` 之类临时文档。
- 不为了普通 bugfix 额外创建 GitHub Issue；发现独立问题且用户要求记录时，按 `AGENTS.md` 的 Issue 规范创建。

## 7. 收尾格式

最终回复要简洁说明：

- 修了什么问题，涉及哪些关键文件。
- 运行了哪些测试，结果如何。
- 哪些验证没有做，以及原因。
- 如有用户需要手动验证的 UI 步骤，给出具体步骤。

不要声称已构建、已启动服务、已提交或已创建 Issue，除非实际完成了对应操作。
