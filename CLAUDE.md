# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发命令

| 命令 | 说明 |
| ------ | ------ |
| `npm run dev` | 启动开发服务器 (`localhost:5173`) |
| `npm run build:web` | 仅构建 Web 版本，产物在 `dist/` |
| `npm run build:desktop` | 构建 Tauri 桌面版 |
| `npm run build` | 完整构建：Vite + pkg + NSIS 安装包 (Windows) |
| `npm run build:test` | 构建测试环境版本（会临时修改文件，构建后自动还原） |
| `npm run preview` | 预览构建结果 |
| `npm run deploy:test` | 部署到测试环境 |
| `npm run deploy:main` | 合并到 main 并推送 |

Node.js >= 20.0.0。无 linter、formatter 或测试框架。

## 架构概览

基于 Vue 3 + Vite 的教室座位表编辑器，支持 Web、Tauri 桌面端、Electron 备选三种平台。单页应用，无路由。

### 状态管理

使用组合式 API 共享状态单例模式，**不使用 Pinia/Vuex**。每个 composable 在模块作用域声明 `ref`/`reactive`，导出函数返回这些引用，所有组件共享同一份状态：

```javascript
const students = ref([])
export function useStudentData() {
  return { students, ... }
}
```

### 座位数据结构

座位以**扁平数组** `seats` 存储，通过 `organizedSeats` 计算属性组织为三级结构用于渲染：

```text
分组 (groupIndex) -> 列 (columnIndex) -> 行 (rowIndex)
```

每个分组可独立配置列数和行数（`seatConfig.groups[]`）。`seatMap`（Map）提供 O(1) 的 id 查找。

### 编辑模式

5 种全局模式由 `useEditMode()` 管理，`EditMode` 枚举定义在同一文件：

- **NORMAL** — 选中学生后点击座位分配
- **SWAP** — 依次点击两个座位交换学生
- **CLEAR** — 点击座位移除学生
- **EMPTY_EDIT** — 标记座位为不可用
- **ZONE_EDIT** — 圈选座位区域

### 组件层级

```text
App.vue (主布局 - 高度严格限制)
├── AppHeader.vue
├── EditorPanel.vue (80% 宽度)
│   ├── SeatChart.vue (上部 60%)
│   │   └── SeatItem.vue
│   └── StudentList.vue (下部 40%)
│       ├── TagManager.vue
│       └── StudentItem.vue
└── SidebarPanel.vue (20% 宽度)
```

### Composable 职责

**核心数据：**

- `useSeatChart` — 座位网格、配置、分配逻辑
- `useStudentData` — 学生列表 CRUD、排序、选择
- `useTagData` — 学生标签系统
- `useZoneData` — 座位分区管理

**编辑与交互：**

- `useEditMode` — 编辑模式状态机
- `useDragState` / `useStudentDragging` — 拖拽分配
- `useDragPreview` — 拖拽预览效果
- `useSelection` — 多选操作
- `useUndo` — 撤销/重做（Ctrl+Z / Ctrl+Y）
- `useZoom` — 座位图缩放
- `useSidebar` — 侧边栏 Tab 状态

**规则与分配：**

- `useSeatRules` — 规则引擎（吸引/排斥/位置偏好）
- `useAssignment` — 智能自动分配算法
- `useZoneRotation` — 周期性座位轮换

**持久化与同步：**

- `useWorkspace` — 本地工作区
- `useCloudWorkspace` / `useCloudWorkspaceDialog` — 云端工作区
- `useWebDav` — WebDAV 同步
- `useAuth` — 认证

**导出：**

- `useImageExport` — 导出高清 PNG
- `useExcelData` — Excel 导入导出（xlsx-js-style）
- `useExportSettings` — 导出配置

**工具：**

- `useLogger` — 日志与提示
- `useConfirmAction` — 确认对话框
- `useMarkdown` — Markdown 渲染

### 路径别名

`@` 解析为 `src/`（在 `vite.config.js` 中配置）。

### 快捷键

- **Ctrl+Z** — 撤销
- **Ctrl+Y** — 重做

## 核心准则

- **禁止表情**：严禁在代码、注释或 UI 中使用 Emoji
- **布局限制**：`App.vue` 具有严格的高度限制，不要修改其布局结构
- **不自动构建/启动**：开发完成后不自动运行 `npm run build` 或 `npm run dev`
- **图标库**：统一使用 `lucide-vue-next`，按需具名导入，通过 `:size` prop 控制尺寸（不用 CSS width/height）。禁止内联 SVG 和 Unicode 字符充当图标
- **中文文档**：所有项目规则和文档使用中文编写
- **托管平台**：项目使用 Retinbox Web Hosting 部署，不建议其他平台
- **禁止 base64**：不在任何地方使用 base64 编码，显示本地图片用 `URL.createObjectURL()`

## 详细规范

图标尺寸表、视觉规范（品牌色 `#23587b`、阴影、圆角）、命名规范、交互细节等请参阅 [.agents/rules/项目规范.md](.agents/rules/项目规范.md)。

## 深度文档

`.agents/features/` 目录包含针对 AI 协作优化的业务解构文档，涵盖数据模型、代码路径及易错陷阱。修改复杂模块前建议查阅对应文档：

- [00-项目概览](.agents/features/00-project-overview.md)
- [01-核心数据模型](.agents/features/01-core-datamodel.md)
- [02-布局编辑器](.agents/features/02-layout-editor.md)
- [03-学生管理](.agents/features/03-student-management.md)
- [04-规则引擎](.agents/features/04-rule-engine.md)
- [05-自动排位算法](.agents/features/05-auto-assignment.md)
- [06-区域轮换系统](.agents/features/06-zone-rotation.md)
- [07-云端同步](.agents/features/07-cloud-sync.md)
- [08-导出系统](.agents/features/08-export-system.md)
