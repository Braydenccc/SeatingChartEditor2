![SeatingCrartEditor2](https://socialify.git.ci/Braydenccc/SeatingCrartEditor2/image?custom_description=%E6%98%93%E7%94%A8%E3%80%81%E8%BD%BB%E9%87%8F%E3%80%81%E4%BE%BF%E6%90%BA%E7%9A%84%E5%BA%A7%E4%BD%8D%E8%A1%A8%E7%BC%96%E8%BE%91%E5%99%A8&description=1&font=JetBrains+Mono&name=1&owner=1&stargazers=1&tab=readme-ov-file%3Flanguage%3D1&theme=Auto)

# BraydenSCE V2 (座位表编辑器)

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![在线体验](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C-sce.jbyc.cc-23587b)](https://sce.jbyc.cc/)

> 一个跨平台、现代化的座位表可视化编辑器。  
> 支持在浏览器直接使用，也可下载 Windows 纯净桌面版（轻量级 Tauri 版 和 独立 Electron 版）。

**在线体验：** <https://sce.jbyc.cc/>  
**发布者：** Braydenccc / Jbyccc

---

## 核心功能特性

| 功能 | 说明 |
|------|------|
| **可视化座位表编辑** | 支持按不同行列组创建自适应布局的排位地图 |
| **智能化人际关系网** | 为学生添加"吸引"或"排斥"关系，一键自动化智能排位（自动避开仇恨、聚拢友好） |
| **快捷标签与分区管理** | 内置彩色标签系统，拖拽圈选座位区域，限定指定标签学生只能排入划定区域（如：走读生区、特殊视力照顾区） |
| **极速名单录入** | 一键从内置 Excel 模板导入学生数据及批量打标签，支持全量导出 |
| **可打印图片一键导出** | 内置原生画布引擎，座位图按海报级高清直接导出 `.png`，专为学校打印优化 |
| **跨端云同步工作区** | 免费内置跨设备云端储存，注册账号即可将不同班级配置安全备份至云端（谨慎使用） |

##Todo

•[ ]webdev支持

•[ ]更加强大的排位规则，以及易于学习和使用的编辑器（考虑接入llm）

•[ ]补上自动换位功能


---

## 使用指南

**体验链接**<jbyc.cc>

### 1. 基础配置

1. **录入学生** — 在左侧控制面板中，点击"数据"标签页，通过"导入/导出"按钮下载 Excel 模板。填入学号、姓名及标签后，一键导入。
2. **设定标签与分区** — 为特殊学生（如需要前排）添加身份标签。在"分区与限制"面板点击"画笔"圈选座位区域，并限制这些座位仅允许包含指定标签的学生坐入。
3. **设置行列与组距** — 在"配置"面板中调节教室的行、列数量以及走廊的空白间隙。

### 2. 智能化座位分配

1. 切换到"人物关系"面板。
2. 为需要隔离的学生添加 **排斥** 关系；为需要互助的学生添加 **吸引** 关系。
3. 点击"一键分配"，算法将随机打乱所有成员并输出一套符合"分区限制"与"人际关系限制"的最优解。

### 3. 微调与修饰

你随时可以在顶部栏启用以下模式：

- **交换模式** — 快速互换两个座位上的学生。
- **清空模式** — 将指定座位设为空位（走廊/过道）。

完成后点击"一键导出照片"，即可获得排位图。

---

## 私有化部署说明

### 开发环境

```bash
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`。

### 云端部署

项目集成热铁盒云函数，用户登录与工作区云存档功能依赖 `public/api/*.php`。一键部署：

```bash
npm run deploy
```

> 需要预先配置热铁盒的 `RTH_API_KEY` 环境变量。

### Windows 安装包编译

#### NSIS 独立安装包（约 20 MB）

```bash
npm run build
```

自动依序完成：Vite 构建前端 → `pkg` 打包本地服务器为 `.exe` → NSIS 生成 `dist/BraydenSCE-Setup.exe`。

安装包功能：可自定义安装目录 · 自动创建桌面和开始菜单快捷方式 · 完成后可选立即启动 · 支持控制面板卸载。

> **前提：** 需安装 [NSIS 3.x](https://nsis.sourceforge.io/) 并加入系统 PATH。

#### 其他桌面版本

| 命令 | 说明 |
|------|------|
| `npm run build:lite` | Tauri 轻量版（< 5 MB，需 Win10+ WebView2） |
| `npm run build:full` | Electron 完整版（~ 110 MB，内置 Chromium） |


---

## 赞助与支持

觉得好用？可以请作者喝杯奶茶：[赞助通道](https://afdian.com/a/brayden)
