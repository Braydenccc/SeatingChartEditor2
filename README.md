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
| **可视化座位表编辑** | 支持按不同行列组创建自适应布局的排位地图 |
| **强大的智能排位功能** | 撰写复杂的排位规则，剩下的交给算法 |
| **智能自动换位** | 支持周期性轮换座位，确保公平性 |
| **快捷标签与分区管理** | 内置彩色标签系统，圈选座位区域，限定指定标签学生只能排入划定区域 |
| **极速名单录入** | 一键从内置 Excel 模板导入学生数据及批量打标签，支持全量导出 |
| **可打印图片与精美 Excel 导出** | 专为学校打印优化：支持导出海报级高清 `.png`，或高度还原排版与格式的高清 Excel 文件 |
| **跨端云同步与 WebDAV 备份** | 免费内置跨设备云端储存，新增自定义 WebDAV 支持（如坚果云、Alist等） |
| **撤销/重做** | 支持操作历史记录，方便回退和恢复 |
| **缩放功能** | 支持座位图表缩放，适应不同屏幕尺寸 |

## Todo

### feat

- [ ] 基于数值的排位规则（如：身高、成绩、视力等）
- [ ] 增加更多导出格式（如：PDF、Word等）
- [ ] 自动发布预览版本
- [ ] 手机端编辑优化
- [ ] 继续优化加载及资源占用
- [ ] 引入更多排位规则

### bugs/perf

- [x] 手机端打标签功能优化
- [x] 手机端打不了标签
- [ ] 规则编辑器用语优化
- [ ] 规则中用语不对
- [x] 不能以同一个标签座位对比对象（规则还得优化）
- [x] 界面重构，考虑窗口化或者tab化，目前过于拥挤，特别是名单。

---

## 使用指南

**在线体验** <https://sce.jbyc.cc>

### 1. 基础配置

1. **录入学生** — 在左侧控制面板中，通过"导入/导出"按钮下载 Excel 模板。填入学号、姓名及标签后，一键导入。
2. **设定标签与分区** — 为特殊学生（如需要前排）添加身份标签。在"分区与限制"面板圈选座位区域，并限制这些座位仅允许包含指定标签的学生坐入。
3. **设置行列与组距** — 在"配置"面板中调节教室的行、列数量以及走廊的空白间隙。

### 2. 智能化座位分配

1. 切换到"规则"面板。
2. 创建排位规则，可设置吸引关系、排斥关系、位置偏好等多种规则。
3. 点击"一键分配"，算法将随机打乱所有成员并输出一套符合所有规则的最优解。

### 3. 自动换位功能

1. 配置好基础座位表后，可以使用自动换位功能实现周期性轮换。
2. 支持按指定间隔和规则进行座位轮换，确保公平性。

### 4. 微调与修饰

你随时可以在顶部栏启用以下模式：

- **交换模式** — 快速互换两个座位上的学生。
- **清空模式** — 将指定座位设为空位（走廊/过道）。
- **空置编辑** — 标记座位为不可用。
- **选区编辑** — 圈选座位区域进行批量操作。

完成后点击"导出"，可选择导出图片或 Excel 文件。

---

## 技术栈

- **前端框架**：Vue 3 (Composition API)
- **构建工具**：Vite 7.x
- **图标库**：lucide-vue-next
- **Excel处理**：xlsx-js-style
- **工具函数**：@vueuse/core
- **桌面端**：Tauri 2.x (主) / Electron (备选)
- **状态管理**：Composition API 单例模式（不使用 Pinia）

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
# 仅构建 Web 版本
npm run build:web
```

构建产物在 `dist/` 目录，可部署到任何静态托管服务。

### Windows 桌面版编译（Tauri）

推荐流程（桌面打包）：

```bash
npm run build:desktop
# 或
npm run build:lite
```

### 可用构建命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build:web` | 构建 Web 版本 |
| `npm run build:desktop` | 构建 Tauri 桌面版 |
| `npm run build:lite` | 等价于 build:desktop |
| `npm run preview` | 预览构建结果 |

---

## 项目架构

### 核心 Composable

- `useStudentData` - 学生数据管理
- `useSeatChart` - 座位图表管理
- `useEditMode` - 编辑模式管理
- `useTagData` - 标签系统
- `useZoneData` - 分区管理
- `useZoneRotation` - 自动换位
- `useAssignment` - 智能分配
- `useSeatRules` - 规则引擎
- `useAuth` - 认证
- `useWebDav` - WebDAV 同步
- `useCloudWorkspace` - 云端工作区
- `useImageExport` - 图片导出
- `useExcelData` - Excel 处理
- `useZoom` - 缩放功能
- `useUndo` - 撤销/重做

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
