# 座位表编辑器 v2 (BraydenSCE) - 知识库引擎

本目录（`.agents/features`）存放着专门针对 **AI 协作编程 (Vibe Coding)** 高度优化的业务解构文档。每一个文件都对应着项目某一个复杂模块的数据模型、相关代码绝对路径及易错陷阱。

## 核心架构大纲

```mermaid
graph TD
  UI[UI 视图层<br/>SeatChart.vue] --> |拖拽分发| Zoom(缩放平移引擎<br/>useZoom)
  UI --> EditMode(工作模式状态<br/>useEditMode)
  UI --> Selection(多选管理<br/>useSelection)
  UI --> DragPreview(拖拽预览<br/>useDragPreview)
  
  EditMode -->|写入数据| CoreState
  Selection -->|批量操作| CoreState
  DragPreview -->|选区拖拽| CoreState

  subgraph 核心数据层 Composables (无框架无UI，纯响应式单例)
    direction TB
    CoreState((工作区总线<br/>useWorkspace))
    Student(学生管理<br/>useStudentData)
    Seat(物理座位矩阵<br/>useSeatChart)
    Rule(排位约束规则<br/>useSeatRules)
    Zone(区域大组轮换<br/>useZoneData/Rotation)
    CoreState --- Student & Seat & Rule & Zone
  end

  Auto(自动排位算法/退火<br/>useAssignment) -->|读取规则与名单| CoreState

  Export[A4 Canvas 输出<br/>useImageExport] -->|读取座位表| CoreState
  ExportExcel[Excel 高保真输出<br/>useExcelData] -->|读取模型| CoreState
  
  Cloud(双轨云同步<br/>useCloudWorkspace) --> |Retiehe / WebDAV| CoreState
```

## 功能剖析导览

如果你在开发中需要修改指定的模块，请使用 `view_file` 查阅对应的 Markdown，那里包含 `TypeScript` 数据结构、文件路径以及非常明确的警告项。

- 🗺️ **基础铺垫**
  - [00-项目概览 (00-project-overview.md)](./00-project-overview.md)
  - [01-核心数据模型 (01-core-datamodel.md)](./01-core-datamodel.md)

- 🖌️ **界面与交互**
  - [02-布局编辑器实现 (02-layout-editor.md)](./02-layout-editor.md)
  - [03-学生与数据处理 (03-student-management.md)](./03-student-management.md)

- 🧠 **最强核心 (排位引擎)**
  - [04-规则引擎方案 (04-rule-engine.md)](./04-rule-engine.md)
  - [05-自动排位算法 (05-auto-assignment.md)](./05-auto-assignment.md)
  - [06-区域与轮换系统 (06-zone-rotation.md)](./06-zone-rotation.md)

- ☁️ **云端网络与输出渲染**
  - [07-云端同步与认证 (07-cloud-sync.md)](./07-cloud-sync.md)
  - [08-导出系统 (08-export-system.md)](./08-export-system.md)

## Vibe Coding 注意事项

1. **优先保持结构完整**: 不要破坏已有的 `useXXX.js` 单例导出。如果是加功能，在原文件里暴露新的变量。
2. **遵守 TypeScript 模型约束**: 上述文档已将项目里隐式的对象类型严格定义了，在修改业务之前，必须了解其底层是 `Map` 还是 `Array`，以及坐标维度。
