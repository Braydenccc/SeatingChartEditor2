![SeatingCrartEditor2](https://socialify.git.ci/Braydenccc/SeatingCrartEditor2/image?custom_description=%E6%98%93%E7%94%A8%E3%80%81%E8%BD%BB%E9%87%8F%E3%80%81%E4%BE%BF%E6%90%BA%E7%9A%84%E5%BA%A7%E4%BD%8D%E8%A1%A8%E7%BC%96%E8%BE%91%E5%99%A8&description=1&font=JetBrains+Mono&name=1&owner=1&stargazers=1&tab=readme-ov-file%3Flanguage%3D1&theme=Auto)

# BraydenSCE V2 (座位表编辑器)

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![在线体验](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C-sce.jbyc.cc-23587b)](https://sce.jbyc.cc/)

BraydenSCE V2 是一个面向教师日常排座的可视化座位表编辑器。它支持浏览器直接使用，也支持通过 Tauri 打包为 Windows 桌面版。

- 在线体验：<https://sce.jbyc.cc/>
- 发布者：Braydenccc / Jbyccc
- 开源协议：GPL-3.0-or-later

## 核心功能

| 功能 | 说明 |
| --- | --- |
| 可视化座位表编辑 | 支持多分组座位布局，每个分组可独立配置行数、列数、组间距和讲台方向。 |
| 学生名单与属性 | 支持学生 CRUD、学号排序、标签、数值属性和 Excel 名单导入导出。 |
| 标签与选区 | 可给学生打标签，也可圈选座位选区，用于规则限制、区域轮换和批量操作。 |
| 手动排座 | 支持点击分配、拖拽分配、交换、清空、空置座位、多选和撤销重做。 |
| 智能排位 | 基于规则引擎自动搜索座位方案，支持个人、标签、全体学生和数值属性规则。 |
| 自动轮换 | 支持区域轮换和平移轮换，适合按周或按阶段调整座位。 |
| 图片与 Excel 导出 | 可导出适合打印的高清 PNG，也可导出带格式的 Excel 座位表。 |
| 工作区管理 | 支持本地工作区文件、SCE 云端工作区和 WebDAV 备份。 |
| 多端适配 | Web 端和 Tauri 桌面端共用核心前端逻辑，平台能力通过适配层隔离。 |

## 使用入口

当前应用使用 `vue-router` hash 路由，主要页面如下：

| 路由 | 页面 | 用途 |
| --- | --- | --- |
| `#/editor` | 编辑 | 座位图、候选学生、规则排位、选区和轮换操作的核心工作台。 |
| `#/files` | 文件 | 新建、保存、打开工作区，管理云端工作区，导入导出学生名单。 |
| `#/students` | 名单与属性 | 维护学生、标签和数值属性。 |
| `#/user` | 账号中心 | 登录 SCE 账号、查看云端状态、修改账号密码。 |
| `#/export` | 导出 | 导出图片或 Excel 座位表。 |
| `#/settings` | 设置 | 管理全局设置、工作区设置、云端同步、轮换、导出配置和帮助。 |

应用内完整用户手册位于「设置 - 关于 - 帮助」。桌面宽度的编辑页顶栏右上角也提供帮助入口。

## 快速开始

推荐使用 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`。`npm run dev` 会以 `0.0.0.0` host 启动，方便局域网设备访问。

如果需要重新安装依赖，推荐使用：

```bash
npm ci
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器。 |
| `npm run build` | 等同于 `npm run build:web`。 |
| `npm run build:web` | 执行 TypeScript 类型检查并构建 Web 版本，产物在 `dist/`。 |
| `npm run build:desktop` | 构建 Tauri 桌面版。 |
| `npm run build:desktop:win` | 构建 Tauri Windows NSIS/MSI 安装包。 |
| `npm run build:test` | 构建测试环境版本，会临时 patch 指定文件并自动还原。 |
| `npm run preview` | 预览 Web 构建产物。 |
| `npm run type-check` | 执行 `vue-tsc --noEmit`。 |
| `npm run test:run` | 单次运行 Vitest 测试。 |
| `npm run test:coverage` | 生成测试覆盖率报告。 |
| `npm run docs:sync` | 从统一真源同步各 agent 入口文档。 |
| `npm run docs:check` | 检查 agent 文档漂移和命令有效性。 |

项目没有统一 linter/formatter；测试框架使用 Vitest + happy-dom。

## 构建与部署

Web 版本构建：

```bash
npm run build:web
```

构建产物位于 `dist/`，可部署到静态托管服务。当前生产环境推荐 Retinbox Web Hosting；涉及 Retinbox 后端或云函数时，请参考 `.agents/retiehe_web_host/` 和 `.agents/rules/` 中的 Retinbox 文档。

Tauri 桌面版构建：

```bash
npm run build:desktop
```

Windows 安装包构建：

```bash
npm run build:desktop:win
```

## 安全与同步

- 本地工作区适合离线使用，数据由浏览器存储或桌面端文件能力保存。
- SCE 云端工作区适合跨设备继续编辑，重要数据仍建议定期导出本地备份。
- WebDAV 支持自定义服务，例如坚果云或 Alist。记住密码时会加密存储，但浏览器环境无法抵御所有 XSS 风险。
- 已登录 SCE 账号时，WebDAV 加密密钥会结合用户 Token 派生；未登录时安全性较低，建议使用 WebDAV 应用专用密码。

## 技术栈

- Vue 3 Composition API
- Vue Router 4 hash 路由
- Vite 7
- Tauri 2
- TypeScript / JavaScript 混合代码库
- lucide-vue-next
- xlsx-js-style
- @vueuse/core
- Vitest + happy-dom

## 项目结构

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
├── /user     -> src/views/UserView.vue
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

核心逻辑集中在 `src/composables/`。项目使用组合式 API 共享状态单例模式，不使用 Pinia 或 Vuex。

## 核心 Composable

| 模块 | 说明 |
| --- | --- |
| `useSeatChart` | 座位网格、配置、分配逻辑。 |
| `useStudentData` | 学生列表 CRUD、排序、选择。 |
| `useTagData` | 学生标签系统。 |
| `useZoneData` | 座位选区管理。 |
| `useEditMode` | 编辑模式状态机。 |
| `useEditorWorkbench` | 编辑工作台右栏、移动抽屉、区域编辑会话状态。 |
| `useDragState` / `useStudentDragging` | 拖拽分配。 |
| `useSelection` | 多选操作。 |
| `useUndo` | 撤销与重做。 |
| `useZoom` | 座位图缩放。 |
| `useSeatRules` | 规则引擎。 |
| `useAssignment` | 智能自动分配算法。 |
| `useZoneRotation` | 周期性座位轮换。 |
| `useWorkspace` | 本地工作区。 |
| `useCloudWorkspace` / `useCloudWorkspaceDialog` | 云端工作区。 |
| `useWebDav` | WebDAV 同步。 |
| `useAuth` | 认证。 |
| `useImageExport` | 导出高清 PNG。 |
| `useExcelData` | Excel 导入导出。 |
| `useExportSettings` | 导出配置。 |

## 数据模型

座位以扁平数组 `seats` 存储，通过 `organizedSeats` 计算属性组织成三级结构用于渲染：

```text
分组 groupIndex -> 列 columnIndex -> 行 rowIndex
```

每个分组可独立配置列数和行数。`seatMap` 提供按座位 id 查询的快速索引。

## 编辑模式

| 模式 | 说明 |
| --- | --- |
| `NORMAL` | 选中学生后点击座位进行分配。 |
| `SWAP` | 依次点击两个座位交换学生。 |
| `CLEAR` | 点击座位移除学生。 |
| `EMPTY_EDIT` | 标记座位为不可用。 |
| `ZONE_EDIT` | 圈选座位区域。 |

## 开发规范

- 组件使用 PascalCase。
- Composable 使用 camelCase，并以 `use` 开头。
- 常量使用 camelCase。
- 图标统一使用 `lucide-vue-next`。
- CSS 颜色应使用 `src/assets/main.css` 中的 `var(--color-*)` 变量。
- 新文件优先使用 `.ts`，类型定义放在 `src/types/`。
- 不要直接修改 `dist/`。
- 涉及用户可见功能、入口、工作流、限制条件或排查步骤的变更，需要同步更新 `src/constants/userManual.ts`。

更多协作规则见 `AGENTS.md`；复杂模块说明见 `.agents/features/`。

## 赞助与支持

觉得好用？可以请作者喝杯奶茶：[赞助通道](https://afdian.com/a/brayden)
