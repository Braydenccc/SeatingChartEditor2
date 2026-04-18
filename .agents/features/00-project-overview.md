---
module_name: Project Overview
description: 作为项目的中枢级指南，概述技术栈、多端适配策略与编译配置入口。
---

# 00-项目概览 (Project Overview)

## 1. 核心职责 (Core Purpose)
**BraydenSCE (座位表编辑器v2)** 是一个高自由度、功能丰富的座位表分发与管理工具。它被设计成一个“核心纯前端代码、多端壳子包裹”的形态，依靠纯逻辑处理排位，再通过 Tauri/Electron 提供原生桌面端能力，或通过 Retinbox 提供 Web 托管。

## 2. 源代码入口 (Source Files & Entry Points)
所有核心逻辑全在 `src/` 目录下，与运行平台完全解耦。

| 模块类别 | 路径入口 | 职责说明 |
| :--- | :--- | :--- |
| **Vite 配置** | `vite.config.js` | Web 构建核心。 |
| **Electron入口** | `electron-main.cjs` | Electron 的主进程（包含自动更新、文件系统支持）。 |
| **Tauri 入口** | `src-tauri/` | Tauri/Rust 壳配置，通常不需要高频修改。 |
| **Node.js 包装**| `server.cjs` | 作为 `pkg` 打包出的单文件后端，用于极简部署。 |
| **PWA 配置**  | `index.html` | 提供了 manifest 和移动端 icon 的元数据。 |

## 3. 技术栈规范 (Tech Stack & Conventions)
- **渲染层**: Vue 3 (Composition API / `<script setup>`)。完全不使用 Class API。
- **状态管理**: 未使用 Pinia。依靠 Vue3 reactivity (`ref`, `computed`) 封装在多个独立的 `useXXX.js` composables 中，通过单例模式共享状态。
- **构建/包管理**: Vite + Webpack/Pkg 混合。

## 4. 全局依赖 (Dependencies)
```json
{
  "@vueuse/core": "用于鼠标拖拽、窗口大小防抖等高级交互",
  "lucide-vue-next": "统一的图标库规范",
  "xlsx-js-style": "用于带有边框等样式的 Excel 导出"
}
```

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **避免引入 Vuex或Pinia**: 项目强依赖 `composables/` 的自闭环状态树（Stateful Composables），如果要加新状态字段，直接去对应 `useXXX.js` 文件的顶层定义 `const myVar = ref(null)`。
- **全平台兼容警示**: 项目需要编译为浏览器Web、Electron (Window/Mac) 和 Tauri。因此，绝对不要在 `src/components/` 或 `src/composables/` 内部直接调用 Node.js 内置模块（如 `fs`, `path`）。如果必须访问这些，必须通过 IPC 调用或 WebDAV 的形式隔离。
