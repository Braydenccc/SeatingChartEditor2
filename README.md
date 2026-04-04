![SeatingCrartEditor2](https://socialify.git.ci/Braydenccc/SeatingCrartEditor2/image?custom_description=%E6%98%93%E7%94%A8%E3%80%81%E8%BD%BB%E9%87%8F%E3%80%81%E4%BE%BF%E6%90%BA%E7%9A%84%E5%BA%A7%E4%BD%8D%E8%A1%A8%E7%BC%96%E8%BE%91%E5%99%A8&description=1&font=JetBrains+Mono&name=1&owner=1&stargazers=1&tab=readme-ov-file%3Flanguage%3D1&theme=Auto)

# BraydenSCE V2 (座位表编辑器)

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![在线体验](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C-sce.jbyc.cc-23587b)](https://sce.jbyc.cc/)

> 一个跨平台、现代化的座位表可视化编辑器。  
> 支持在浏览器直接使用，也可下载 Windows 纯净桌面版（主要使用 Tauri）。

**在线体验：** <https://sce.jbyc.cc/> 

**测试版：** <https://sce.jbyc.cc/> 

**离线版本不保证最新！**

**发布者：** Braydenccc / Jbyccc

---

## 核心功能特性

| 功能 | 说明 |
|------|------|
| **可视化座位表编辑** | 支持按不同行列组创建自适应布局的排位地图 |
| **强大的智能排位功能** | 撰写复杂的排位规则，剩下的交给算法。 |
| **快捷标签与分区管理** | 内置彩色标签系统，拖拽圈选座位区域，限定指定标签学生只能排入划定区域（如：走读生区、特殊视力照顾区） |
| **极速名单录入** | 一键从内置 Excel 模板导入学生数据及批量打标签，支持全量导出 |
| **可打印图片与精美 Excel 导出** | 专为学校打印优化：支持导出海报级高清 `.png`，或高度还原排版与格式的高清 Excel 文件，即刻满足多种需求 |
| **跨端云同步与 WebDAV 备份** | 免费内置跨设备云端储存，新增自定义 WebDAV 支持（如坚果云、Alist等），实现跨平台及自托管数据安全同步备份 |

## Todo

### feat

- [x] 自定义接入 WebDAV 网盘支持（不再单一依赖数据库）
- [x] 更加强大的排位规则，以及易于学习和使用的编辑器（考虑接入llm）
- [x] 补上自动换位功能
- [ ] 基于数值的排位规则（如：身高、成绩、视力等）
- [ ] 增加更多导出格式（如：PDF、Word等）
- [ ] 自动发布预览版本
- [ ] 手机端编辑优化（现在貌似打不了标签）
- [ ] 继续优化加载及资源占用
- [ ] 引入更多排位规则（或许支持自定义，只是算法很难针对优化），引入Agent

### bugs/perf

- [ ] 手机端打不了标签
- [ ] 规则中用语不对
- [ ] 不能以同一个标签座位对比对象（规则还得优化）
- [ ] 重构界面，考虑窗口化或者tag化，目前过于拥挤，特别是名单。

---

## 使用指南

**体验链接** <https://jbyc.cc>

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

若在 Copilot/CI 新环境遇到 `vite: not found`，先执行：

```bash
rm -rf node_modules
npm ci
npm run build:web
```

该问题通常由依赖未安装完整或锁文件与依赖树不一致导致；仓库已提交更新后的 `package-lock.json`，请确保所有 Copilot 环境拉取最新提交后再执行构建。

开发服务器默认运行在 `http://localhost:5173`。

### 云端部署

项目集成热铁盒云函数，用户登录与工作区云存档功能依赖 `public/api/*.php`。一键部署：

```bash
npm run deploy
```

> 需要预先配置热铁盒的 `RTH_API_KEY` 环境变量。

测试环境分支部署：

```bash
# 默认：将当前分支合并到 test 并部署到 https://test.sce.jbyc.cc
npm run deploy:test

# 指定路径：不修改 test 分支，直接部署当前分支到 https://test.sce.jbyc.cc/<path>
npm run deploy:test -- <path>
```

`<path>` 仅允许字母、数字、`.`、`_`、`-`、`/`，且不能包含空段、`.`、`..` 或 `test` 段。

### Windows 桌面版编译（Tauri 主流程）

推荐流程（桌面打包）：

```bash
npm run build:lite
```

说明：

- `npm run build:desktop`：构建 Tauri 桌面版（当前主桌面构建入口）。
- `npm run build:lite`：与 `build:desktop` 等价，作为兼容入口。
- `npm run build:web`：仅在需要执行前端单独校验/构建时使用。


---

## 赞助与支持

觉得好用？可以请作者喝杯奶茶：[赞助通道](https://afdian.com/a/brayden)
