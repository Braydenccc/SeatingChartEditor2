---
module_name: Project Overview
description: 作为项目的中枢级指南，概述技术栈、多端适配策略与编译配置入口。
---

# 00-项目概览 (Project Overview)

## 1. 核心职责 (Core Purpose)
**BraydenSCE (座位表编辑器v2)** 是一个高自由度、功能丰富的座位表分发与管理工具。它被设计成一个“核心纯前端代码、Tauri 桌面壳包裹”的形态，依靠纯逻辑处理排位，再通过 Tauri 提供原生桌面端能力，或通过 Retinbox 提供 Web 托管。

## 2. 源代码入口 (Source Files & Entry Points)
所有核心逻辑全在 `src/` 目录下，与运行平台完全解耦。

| 模块类别 | 路径入口 | 职责说明 |
| :--- | :--- | :--- |
| **浏览器入口** | `src/main.js` | 加载全局样式、注册 `vue-router` 并挂载应用。 |
| **应用壳** | `src/App.vue` | 渲染 `RouterView`、全局拖拽区、登录与云工作区对话框。 |
| **路由配置** | `src/router/index.ts` | hash 路由，包含编辑、文件、学生、导出和设置页面。 |
| **编辑主界面** | `src/views/EditorView.vue`、`src/components/workbench/EditorWorkbench.vue` | 当前编辑器布局与工作台。 |
| **Vite 配置** | `vite.config.js` | Web 构建核心。 |
| **Tauri 入口** | `src-tauri/` | Tauri/Rust 壳配置，通常不需要高频修改。 |
| **平台适配层** | `src/platform/` | 隔离 Tauri 文件、HTTP、存储等本地能力，Web 版提供浏览器 fallback。 |
| **PWA 配置**  | `index.html` | 提供了 manifest 和移动端 icon 的元数据。 |

## 3. 技术栈规范 (Tech Stack & Conventions)
- **渲染层**: Vue 3 (Composition API / `<script setup>`)。完全不使用 Class API。
- **路由层**: 使用 `vue-router` hash 路由。当前已不是“无路由单页”结构。
- **状态管理**: 未使用 Pinia。依靠 Vue3 reactivity (`ref`, `computed`) 封装在多个独立的 `useXXX` composables 中，通过单例模式共享状态。
- **构建/包管理**: Vite + Tauri。
- **本地能力**: Tauri 插件按需启用 dialog、fs、http；前端只能通过 `src/platform/` 的封装访问这些插件。

## 4. 全局依赖 (Dependencies)
```json
{
  "@vueuse/core": "用于鼠标拖拽、窗口大小防抖等高级交互",
  "lucide-vue-next": "统一的图标库规范",
  "xlsx-js-style": "用于带有边框等样式的 Excel 导出"
}
```

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **避免引入 Vuex或Pinia**: 项目强依赖 `composables/` 的自闭环状态树（Stateful Composables），如果要加新状态字段，直接去对应 `useXXX` 文件的顶层定义 `const myVar = ref(null)`。
- **全平台兼容警示**: 项目需要编译为浏览器 Web 和 Tauri 桌面端。因此，绝对不要在 `src/components/` 或 `src/composables/` 内部直接调用 Node.js 内置模块（如 `fs`, `path`）。也不要在业务组件中静态导入 `@tauri-apps/*`，必须通过 `src/platform/` 的动态适配层隔离。
