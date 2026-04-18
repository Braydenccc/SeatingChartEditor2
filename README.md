![SeatingCrartEditor2](https://socialify.git.ci/Braydenccc/SeatingCrartEditor2/image?custom_description=%E6%98%93%E7%94%A8%E3%80%81%E8%BD%BB%E9%87%8F%E3%80%81%E4%BE%BF%E6%90%BA%E7%9A%84%E5%BA%A7%E4%BD%8D%E8%A1%A8%E7%BC%96%E8%BE%91%E5%99%A8&description=1&font=JetBrains+Mono&name=1&owner=1&stargazers=1&tab=readme-ov-file%3Flanguage%3D1&theme=Auto)

# BraydenSCE V2 (座位表编辑器)

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![在线体验](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C-sce.jbyc.cc-23587b)](https://sce.jbyc.cc/)

> 一个跨平台、现代化的座位表可视化编辑器。  
> 支持在浏览器直接使用，也可下载 Windows 纯净桌面版（主要使用 Tauri）。

**在线体验：** <https://sce.jbyc.cc/> 

**发布者：** Braydenccc / Jbyccc

---

## 核心功能特性

| 功能 | 说明 |
|------|------|
| **可视化座位表编辑** | 支持多分组布局，每组可独立配置行列数，灵活适配各类教室 |
| **强大的智能排位功能** | 基于规则引擎的自动分配算法，支持吸引/排斥关系、位置偏好等复杂规则 |
| **智能自动换位** | 支持周期性轮换座位，可按分区或全局轮换，确保公平性 |
| **快捷标签与分区管理** | 内置彩色标签系统，圈选座位区域，限定指定标签学生只能排入划定区域 |
| **极速名单录入** | 一键从内置 Excel 模板导入学生数据及批量打标签，支持全量导出 |
| **可打印图片与精美 Excel 导出** | 专为学校打印优化：支持导出海报级高清 PNG，或高度还原排版与格式的高清 Excel 文件 |
| **跨端云同步与 WebDAV 备份** | 免费内置跨设备云端存储，支持自定义 WebDAV（如坚果云、Alist等） |
| **撤销/重做** | 支持操作历史记录（Ctrl+Z / Ctrl+Y），方便回退和恢复 |
| **缩放与拖拽** | 支持座位图缩放、学生拖拽分配、多选操作等交互功能 |
| **本地工作区** | 支持多工作区管理，数据本地存储，无需联网即可使用 |

## Todo

### 功能增强

- [ ] 基于数值的排位规则（如：身高、成绩、视力等）
- [ ] 增加更多导出格式（如：PDF、Word等）
- [ ] 自动发布预览版本
- [ ] 移动端编辑体验优化
- [ ] 继续优化加载及资源占用
- [ ] 引入更多排位规则类型

### 已完成

- [x] 移动端标签功能优化
- [x] 界面重构，优化布局拥挤问题
- [x] 规则引擎优化，支持更复杂的标签对比

---

## 使用指南

**在线体验** <https://sce.jbyc.cc>

### 1. 基础配置

1. **录入学生** — 在侧边栏"学生管理"面板中，通过"导入/导出"按钮下载 Excel 模板。填入学号、姓名及标签后，一键导入。
2. **设定标签与分区** — 为特殊学生（如需要前排）添加身份标签。在"分区管理"面板圈选座位区域，并限制这些座位仅允许包含指定标签的学生坐入。
3. **设置座位布局** — 在"座位配置"面板中调节分组数量、每组的行列数以及组间间距。

### 2. 智能化座位分配

1. 切换到"规则管理"面板。
2. 创建排位规则，可设置吸引关系、排斥关系、位置偏好等多种规则类型。
3. 点击"一键分配"，算法将基于所有规则进行智能分配，输出最优解。

### 3. 自动换位功能

1. 在"轮换管理"面板配置轮换规则。
2. 支持按指定间隔和规则进行座位轮换，可选择全局轮换或分区轮换。
3. 系统会自动记录轮换历史，确保公平性。

### 4. 微调与修饰

你随时可以在顶部工具栏启用以下模式：

- **常规模式** — 选中学生后点击座位进行分配。
- **交换模式** — 快速互换两个座位上的学生。
- **清空模式** — 将指定座位上的学生移除。
- **空置编辑** — 标记座位为不可用（如讲台、过道）。
- **选区编辑** — 圈选座位区域进行批量操作。

完成后点击"导出"，可选择导出高清图片或 Excel 文件。

---

## 技术栈

- **前端框架**：Vue 3 (Composition API)
- **构建工具**：Vite 7.x
- **图标库**：lucide-vue-next
- **Excel处理**：xlsx-js-style
- **工具函数**：@vueuse/core
- **桌面端**：Tauri 2.x (主) / Electron (备选)
- **状态管理**：Composition API 单例模式（不使用 Pinia/Vuex）
- **认证加密**：bcryptjs

---

## 私有化部署说明

### 开发环境

```bash
npm install
npm run dev
```

若在新环境遇到依赖问题，先执行：

```bash
rm -rf node_modules
npm ci
```

开发服务器默认运行在 `http://localhost:5173`。

### Node.js 版本要求

需要 Node.js >= 20.0.0

### 云端部署

项目支持多种部署方式：

```bash
# 仅构建 Web 版本（推荐用于静态托管）
npm run build:web

# 构建测试环境版本
npm run build:test

# 部署到测试环境
npm run deploy:test

# 合并到主分支并推送
npm run deploy:main
```

构建产物在 `dist/` 目录，可部署到任何静态托管服务（推荐 Retinbox Web Hosting）。

### Windows 桌面版编译

推荐使用 Tauri 构建桌面版：

```bash
# 构建 Tauri 桌面版
npm run build:desktop
# 或使用别名
npm run build:lite
```

如需完整打包（包括 NSIS 安装包）：

```bash
# 完整构建：Vite + pkg + NSIS 安装包
npm run build

# 仅构建可执行文件
npm run build:exe

# 使用 Electron 构建（备选方案）
npm run build:full
```

### 可用构建命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（localhost:5173） |
| `npm run build:web` | 仅构建 Web 版本，产物在 dist/ |
| `npm run build:desktop` | 构建 Tauri 桌面版 |
| `npm run build:lite` | 等价于 build:desktop |
| `npm run build` | 完整构建：Vite + pkg + NSIS 安装包 |
| `npm run build:test` | 构建测试环境版本 |
| `npm run preview` | 预览构建结果 |
| `npm run deploy:test` | 部署到测试环境 |
| `npm run deploy:main` | 合并到 main 并推送 |

---

## 项目架构

### 核心 Composable

**数据管理：**

- `useStudentData` - 学生数据 CRUD、排序、选择
- `useSeatChart` - 座位网格、配置、分配逻辑
- `useTagData` - 标签系统
- `useZoneData` - 分区管理

**编辑与交互：**

- `useEditMode` - 编辑模式状态机
- `useDragState` / `useStudentDragging` - 拖拽分配
- `useDragPreview` - 拖拽预览效果
- `useSelection` - 多选操作
- `useUndo` - 撤销/重做（Ctrl+Z / Ctrl+Y）
- `useZoom` - 座位图缩放
- `useSidebar` - 侧边栏 Tab 状态

**规则与分配：**

- `useSeatRules` - 规则引擎（吸引/排斥/位置偏好）
- `useAssignment` - 智能自动分配算法
- `useZoneRotation` - 周期性座位轮换

**持久化与同步：**

- `useWorkspace` - 本地工作区
- `useCloudWorkspace` / `useCloudWorkspaceDialog` - 云端工作区
- `useWebDav` - WebDAV 同步
- `useAuth` - 认证

**导出：**

- `useImageExport` - 导出高清 PNG
- `useExcelData` - Excel 导入导出
- `useExportSettings` - 导出配置

**工具：**

- `useLogger` - 日志与提示
- `useConfirmAction` - 确认对话框
- `useMarkdown` - Markdown 渲染

### 编辑模式

1. **NORMAL** - 常规分配模式
2. **SWAP** - 交换模式
3. **CLEAR** - 清除模式
4. **EMPTY_EDIT** - 空置编辑
5. **ZONE_EDIT** - 选区编辑

---

## 开发规范

详细开发规范请参考项目文档：

- 命名规范：组件使用 PascalCase，Composable 使用 camelCase + use 前缀
- 状态管理：使用 Composition API 单例模式，不使用 Pinia
- 图标使用：统一使用 lucide-vue-next
- 严禁使用 Emoji

---

## 赞助与支持

觉得好用？可以请作者喝杯奶茶：[赞助通道](https://afdian.com/a/brayden)
