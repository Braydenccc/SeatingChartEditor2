---
trigger: always_on
---

# 项目架构与核心规范

Vue 3 + Vite 教室座位表编辑器。核心纯前端 + 多端壳子(Tauri/Electron/Retinbox)。

## 状态管理

Composition API 共享状态 Composables 单例模式，**禁止** Pinia/Vuex。新状态直接在 useXXX.js 顶层 `const myVar = ref(null)`。

## 核心 Composable

useStudentData / useSeatChart / useEditMode / useTagData / useSidebar / useZoneData / useZoneRotation / useAssignment / useSeatRules / useAuth / useWebDav / useCloudWorkspace / useImageExport / useExcelData / useZoom

## 座位三级结构

扁平数组存储，organizedSeats 分桶为 `[group][col][row]`。rebuildSeatMap() 铺平到 Map 实现 O(1) 检索。

## 编辑模式(useEditMode)

NORMAL(分配) / SWAP(交换) / CLEAR(清除) / EMPTY_EDIT(空置) / ZONE_EDIT(选区)

## 组件树

App.vue → AppHeader + EditorPanel(SeatChart→SeatItem + StudentList→StudentItem/TagManager) + SidebarPanel

## 关键依赖

@vueuse/core / lucide-vue-next / xlsx-js-style

## 防坑

- 禁止在 src/components 或 src/composables 内直接调用 Node.js 模块，必须通过 IPC 或 WebDAV 隔离
- rowIndex 翻转：0=最后排，越大越靠讲台