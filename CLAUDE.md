<!--
此文件由 scripts/sync-agent-docs.js 生成。
请修改 .agents/project/shared-agent-guide.md 或 .agents/templates/agent-entry.md.tpl 后运行 npm run docs:sync。
-->

# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## 本 Agent 专属规则

- Claude Code 修改现有文件前必须先读取文件内容。
- 修改现有文件优先使用 Edit；仅在创建新文件或完整重写时使用 Write。
- 使用 Bash/Read/Grep/Edit/Write 等 Claude 工具时，仍以本项目 `.agents/project/shared-agent-guide.md` 为准。
- 搜索优先使用 Grep/Glob 或命令行 `rg`；不要因为工具名不同而跳过 `.agents/features/` 深度文档。
- 需要执行构建、启动开发服务器、部署或提交 Git 时，必须先确认用户明确要求。
- 不自动创建 Git 提交、分支、PR 或 GitHub Issue，除非用户明确要求。

# 多 Agent 共享指南

本文件是本项目 agent 文档的公共真源。`AGENTS.md`、`CLAUDE.md`、`.trae/rules/project-architecture.md` 等入口文档应由 `npm run docs:sync` 生成或同步，不要手动维护多份完整规则。

## 开发命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器，默认 `localhost:5173` |
| `npm run build` | 等同于 `npm run build:web`，构建 Web 版本 |
| `npm run build:web` | 类型检查并构建 Web 版本，产物在 `dist/` |
| `npm run build:desktop` | 构建 Tauri 桌面版 |
| `npm run build:desktop:win` | 构建 Tauri Windows 安装包（NSIS/MSI） |
| `npm run build:test` | 构建测试环境版本，会临时 patch 指定文件并自动还原 |
| `npm run preview` | 预览构建结果 |
| `npm run deploy:main` | 合并到 `main` 并推送生产分支 |
| `npm run test` | 运行 Vitest watch 模式 |
| `npm run test:run` | 运行 Vitest 单次测试 |
| `npm run test:coverage` | 生成覆盖率报告 |
| `npm run type-check` | TypeScript 类型检查 |
| `npm run docs:sync` | 从统一真源同步各 agent 入口文档 |
| `npm run docs:check` | 检查 agent 文档漂移、旧引用和命令有效性 |

Node.js >= 20.0.0。项目没有统一 linter/formatter；测试框架使用 Vitest + happy-dom。

## 当前架构

本项目是 Vue 3 + Vite 的教室座位表编辑器，支持 Web、Tauri 桌面端和 Retinbox Web Hosting。当前应用使用 `vue-router` 的 hash 路由，不再是无路由单页结构。

```text
src/main.js
└── src/App.vue
    ├── RouterView
    ├── GlobalDropZone
    ├── LoginDialog
    └── CloudWorkspaceDialog

src/router/index.ts
├── /editor   -> src/views/EditorView.vue
├── /files    -> src/views/FilesView.vue
├── /students -> src/views/StudentsView.vue
├── /export   -> src/views/ExportView.vue
└── /settings -> src/views/SettingsView.vue

EditorView.vue
└── AppHeader + EditorWorkbench
    ├── SeatChart
    ├── StudentPoolPanel
    ├── ContextInspector
    ├── ActivityPanel
    ├── EditorToolDock
    └── WorkbenchDialogs
```

`src/views/EditorView.vue` 仍承担编辑页的严格高度约束；不要随意破坏 `main-content` 的 `height/min-height/max-height` 结构。

## 状态管理

项目使用组合式 API 共享状态单例模式，不使用 Pinia/Vuex。每个 composable 在模块作用域声明 `ref`/`reactive`，导出函数返回这些引用，所有组件共享同一份状态。

核心 composable：

- `useSeatChart`：座位网格、配置、分配逻辑
- `useStudentData`：学生列表 CRUD、排序、选择
- `useTagData`：学生标签系统
- `useZoneData`：座位分区管理
- `useEditMode`：编辑模式状态机
- `useEditorWorkbench`：编辑工作台右栏、移动抽屉、区域编辑会话状态
- `useDragState` / `useStudentDragging`：拖拽分配
- `useDragPreview`：拖拽预览效果
- `useSelection`：多选操作
- `useUndo`：撤销/重做
- `useZoom`：座位图缩放
- `useSeatRules`：规则引擎
- `useAssignment`：智能自动分配算法
- `useZoneRotation`：周期性座位轮换
- `useWorkspace`：本地工作区
- `useCloudWorkspace` / `useCloudWorkspaceDialog`：云端工作区
- `useWebDav`：WebDAV 同步
- `useAuth`：认证
- `useImageExport`：导出高清 PNG
- `useExcelData`：Excel 导入导出
- `useExportSettings`：导出配置

## 座位数据结构

座位以扁平数组 `seats` 存储，通过 `organizedSeats` 计算属性组织为三级结构用于渲染：

```text
分组 (groupIndex) -> 列 (columnIndex) -> 行 (rowIndex)
```

每个分组可独立配置列数和行数（`seatConfig.groups[]`）。`seatMap` 提供 O(1) 的 id 查找。

## 编辑模式

5 种全局模式由 `useEditMode()` 管理：

- `NORMAL`：选中学生后点击座位分配
- `SWAP`：依次点击两个座位交换学生
- `CLEAR`：点击座位移除学生
- `EMPTY_EDIT`：标记座位为不可用
- `ZONE_EDIT`：圈选座位区域

## 核心准则

- 禁止在代码、注释或 UI 中使用 Emoji。
- 不自动运行 `npm run dev`、`npm run build`、`npm run build:web`、`npm run build:desktop`、`npm run build:test`，除非用户明确要求。
- 图标统一使用 `lucide-vue-next`，按需具名导入，通过 `:size` prop 控制尺寸；禁止内联 SVG 和 Unicode 字符充当图标。
- CSS 颜色必须使用 `var(--color-*)` 变量；不要在组件中硬编码十六进制、RGB 或 RGBA 颜色。颜色变量定义在 `src/assets/main.css`。
- 新文件优先使用 `.ts`，类型定义放在 `src/types/`。当前迁移仍是 JS/TS 混合，引用文件时以实际存在路径为准。
- 组件使用 PascalCase，Composable 使用 camelCase + `use` 前缀，常量使用 camelCase。
- 禁止直接修改 `dist/`；所有修改应在源文件中完成。
- 临时测试脚本放在 `test-scr/`，不要放在 `public/` 或 `src/`。
- 功能变更优先更新 `.agents/features/` 中对应功能文档；不要在 `docs/` 新建 `*-UPDATE.md`、`*-REPORT.md`、`*-SUMMARY.md` 之类临时文档。

## 深度文档

修改复杂模块前优先查阅：

- `.agents/features/00-project-overview.md`
- `.agents/features/01-core-datamodel.md`
- `.agents/features/02-layout-editor.md`
- `.agents/features/03-student-management.md`
- `.agents/features/04-rule-engine.md`
- `.agents/features/05-auto-assignment.md`
- `.agents/features/06-zone-rotation.md`
- `.agents/features/07-cloud-sync.md`
- `.agents/features/08-export-system.md`
- `.agents/features/09-security-enhancements.md`
- `.agents/rules/项目规范.md`
- `.agents/rules/学生卡片外观规范.md`

## Retinbox 后端规范

遇到后端或部署问题时，优先查阅：

- `.agents/retiehe_web_host/SKILL.md`
- `.agents/retiehe_web_host/references/REFERENCE.md`
- `.agents/rules/Retinbox Web Hosting Documentation.md`
- `.trae/rules/rth-php-functions.md`
- `.trae/rules/rth-database.md`
- `.trae/rules/rth-overview.md`

关键规则：

- PHP 文件引用使用从网站根目录开始的相对路径，省略开头 `/`，例如 `require_once "api/common.php"`。
- 不使用 `__DIR__` 拼接云函数引用路径。
- 数据库使用 Retinbox 内置 KV：`new Database("db_name")`。
- 云函数扩展名：PHP 为 `.php`，Node.js 为 `.node.js`。
- 本项目目前没有测试环境部署 npm 脚本；不要在文档或流程中引用不存在的部署命令。

## GitHub Issue 规范

用户明确要求创建 Issue 时才创建。标签要求：

- `agent`
- `Bug` 或 `功能建议`

标题格式：`[<严重程度>] <简短描述>`，严重程度使用 `严重`、`高危`、`中等`、`低`。

