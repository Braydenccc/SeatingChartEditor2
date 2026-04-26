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
| `npm run deploy:main` | 合并到 main 并推送 |
| `npm run test` | 运行测试（watch 模式） |
| `npm run test:run` | 运行测试（单次） |
| `npm run test:coverage` | 生成覆盖率报告 |
| `npm run test:ui` | 启动 Vitest UI |
| `npm run test:student` | 运行学生数据测试 |
| `npm run test:seat` | 运行座位图测试 |
| `npm run test:assignment` | 运行分配算法测试 |
| `npm run test:integration` | 运行集成测试 |
| `npm run test:edge` | 运行边界情况测试 |
| `npm run type-check` | TypeScript 类型检查（单次） |
| `npm run type-check:watch` | TypeScript 类型检查（watch 模式） |

Node.js >= 20.0.0。无 linter、formatter。测试框架使用 Vitest + happy-dom。

## 架构概览

基于 Vue 3 + Vite 的教室座位表编辑器，支持 Web、Tauri 桌面端、Electron 备选三种平台。单页应用，无路由。项目正在从 JavaScript 迁移到 TypeScript（`.ts` 文件优先于 `.js`）。

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

## 测试

测试文件位于 `src/composables/__tests__/`，使用 Vitest + happy-dom。测试工具函数在 `src/test-utils/`：

- `mocks.js` — Mock 对象创建
- `factories.js` — 测试数据工厂
- `assertions.js` — 自定义断言

覆盖率目标：Lines 70%、Functions 70%、Branches 60%、Statements 70%。详见 [docs/TESTING.md](docs/TESTING.md)。

## 核心准则

- **禁止表情**：严禁在代码、注释或 UI 中使用 Emoji
- **布局限制**：`App.vue` 具有严格的高度限制，不要修改其布局结构
- **不自动构建/启动**：开发完成后不自动运行 `npm run build` 或 `npm run dev`
- **图标库**：统一使用 `lucide-vue-next`，按需具名导入，通过 `:size` prop 控制尺寸（不用 CSS width/height）。禁止内联 SVG 和 Unicode 字符充当图标
- **中文文档**：所有项目规则和文档使用中文编写
- **托管平台**：项目使用 Retinbox Web Hosting 部署，不建议其他平台
- **禁止 base64**：不在任何地方使用 base64 编码，显示本地图片用 `URL.createObjectURL()`
- **TypeScript 迁移**：新文件使用 `.ts` 扩展名，类型定义在 `src/types/`。`tsconfig.json` 配置为宽松模式（`strict: false`）。优先使用 `.ts` 文件而非 `.js` 文件
- **命名规范**：组件使用 PascalCase，Composable 使用 camelCase + `use` 前缀，常量使用 camelCase
- **禁止修改 dist 目录**：`dist/` 是构建输出目录，禁止直接修改其中的文件。所有修改应在源文件（`public/`、`src/` 等）中进行，通过构建流程同步到 `dist/`
- **测试脚本管理**：临时测试脚本应放在 `test-scr/` 目录，不要放在 `public/` 或 `src/` 中。创建测试脚本后提醒用户手动部署
- **Write 工具使用规范**：如果你是 claude code，必须严格遵守以下规则
  - **使用场景**：
    - ✅ 仅用于创建新文件或完全重写文件
    - ✅ 修改现有文件必须先用 Read 工具读取（否则会失败）
    - ✅ 优先使用 Edit 工具修改文件（只发送 diff，更高效）
    - ❌ 禁止用 Write 修改现有文件（应该用 Edit）
  - **参数验证**：
    - ✅ 确保 `content` 参数非空且已正确赋值
    - ✅ 使用正确的参数名：`file_path`（绝对路径）和 `content`
    - ✅ `file_path` 必须是绝对路径，不能是相对路径
    - ✅ 避免传递空字符串或未初始化的变量
    - ❌ 禁止在未准备好内容时调用 Write（会导致 "Write failed" 错误）
  - **注意事项**：
    - Write 会覆盖现有文件的全部内容
    - 如果内容过长，考虑分段写入或使用 Edit 工具
- **文档管理规范**：
  - **禁止创建临时更新文档**：不要创建 `*-UPDATE.md`、`*-REPORT.md`、`*-SUMMARY.md` 等临时性文档
  - **实现计划文档例外**：`*-IMPLEMENTATION.md` 仅在计划（Plan Mode）必须时可创建，完成后会被自动删除
  - **直接更新功能文档**：功能变更应直接更新 `.agents/features/` 中的对应功能文档
  - **创建新功能文档**：新功能应在 `.agents/features/` 创建独立文档，而非在 `docs/` 创建临时文档
  - **docs/ 目录用途**：仅用于测试指南（`TESTING.md`）、部署说明等长期维护的文档
  - **删除过时文档**：完成功能开发后，应删除 `docs/` 中的临时文档，将内容整合到功能文档中

## 后端开发规范（Retinbox 平台）

**遇到后端问题时，优先查阅以下文档：**

1. **[docs/Retinbox Web Hosting Documentation](docs/Retinbox%20Web%20Hosting%20Documentation)** — Retinbox 平台完整文档
2. **[.trae/rules/rth-php-functions.md](.trae/rules/rth-php-functions.md)** — PHP 云函数规范
3. **[.trae/rules/rth-database.md](.trae/rules/rth-database.md)** — KV 数据库使用
4. **[.trae/rules/rth-overview.md](.trae/rules/rth-overview.md)** — 平台概览

**关键规则：**

- **文件引用**：使用从网站根目录开始的绝对路径，省略开头的 `/`
  - ✅ 正确：`require_once "api/common.php"`
  - ❌ 错误：`require_once __DIR__ . '/common.php'`（`__DIR__` 不支持）
  - ❌ 错误：`require_once "/api/common.php"`（不要开头的 `/`）
- **数据库**：使用内置 KV 数据库 `new Database("db_name")`，不需要外部数据库
- **云函数**：PHP 文件以 `.php` 结尾，Node.js 文件以 `.node.js` 结尾
- **部署**：使用 `npm run deploy:test` 部署到测试环境，`npm run deploy:main` 部署到生产环境


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

## GitHub 集成

项目已配置 GitHub MCP server，可直接通过 Claude Code 管理 GitHub Issues、Pull Requests 等。

### GitHub MCP Server 配置

**全局配置位置**：`~/.claude/settings.json`

```json
{
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxx"
  },
  "enabledPlugins": {
    "github@claude-plugins-official": true
  }
}
```

**获取 GitHub Token**：
1. 访问 https://github.com/settings/tokens
2. 生成 Personal Access Token (classic)
3. 必需权限：`repo`、`workflow`、`admin:org`（可选）

### GitHub Issue 提交规范

发现项目问题时，使用 GitHub MCP server 直接创建 Issue。

**标签要求**：
- **`agent`** — 必须添加，标识为 Agent 发现的问题
- **`Bug`** 或 **`功能建议`** — 二选一
  - `Bug`：代码缺陷、功能异常
  - `功能建议`：功能建议、优化改进

**Issue 模板**：
- **标题格式**：`[<严重程度>] <简短描述>`
  - 严重程度：`严重`/`高危`/`中等`/`低`
  - 示例：`[严重] SidebarPanel ref访问缺少.value`
- **正文结构**：
  1. 问题描述
  2. 影响范围
  3. 代码位置（具体文件和行号）
  4. 修复建议（可选）

**提交方式**：直接使用 GitHub MCP server 工具创建 Issue，无需通过智能体代理。
