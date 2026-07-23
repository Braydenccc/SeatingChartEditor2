---
module_name: Core Data Model
description: 定义系统最底层的“座位”、“学生”与“工作区快照”的数据结构，是排位系统的根本。
---

# 01-核心数据模型 (Core Data Model)

## 1. 核心职责 (Core Purpose)
维系全局的响应式数据模型，并保证大规模数据渲染时的检索性能（O(1) Map）。座位（Seat）和学生（Student）是互相解耦的资源，通过 `studentId` 缝合。

## 2. 源代码入口 (Source Files)
- 学生数据源: `src/composables/useStudentData.ts`
- 座位数据源: `src/composables/useSeatChart.ts`
- 数据中枢与格式定义: `src/composables/useWorkspace.ts`
- 自动保存备份: `src/composables/useAutoSave.ts`
- 工作区结构校验: `src/utils/workspaceValidation.ts`

## 3. 数据模型定义 (TypeScript Interfaces)

```typescript
// --- 核心拓扑单元 (Seat) ---
// 定义在 useSeatChart.ts 中
interface Seat {
  id: string;          // 普通座位格式: `seat-{groupIndex}-{columnIndex}-{rowIndex}`；护法座位为 `guard-left` / `guard-right`
  groupIndex: number;  // 大组索引 (0-indexed，左->右)
  columnIndex: number; // 所在大组内的列索引 (0-indexed，左->右)
  rowIndex: number;    // 行索引 (0-indexed)。注意：0 代表离讲台最远的最后一排！
  studentId: number | null; // 绑定的实体ID
  isEmpty: boolean;    // 是否是“走廊/柱子”（物理不存在的占位符）。为true时不可再坐人。
  kind?: 'regular' | 'guard'; // 默认 regular；guard 表示讲台左右护法特殊座位
  guardSide?: 'left' | 'right'; // 护法座位所在侧
}

// --- 座位表总体维度 (seatConfig) ---
// 任意改变此值会触发 rebuildSeatMap
interface SeatConfig {
  groupCount: number;      // 总大组数
  columnsPerGroup: number; // 每组多少列（默认值，向后兼容）
  seatsPerColumn: number;  // 每列多少个座位（默认值，向后兼容）
  groups: Array<{          // 每大组的独立配置
    columns: number;       // 该组的列数
    rows: number;          // 该组的行数
  }>;
  shiftDistance: number;   // 轮换距离
  podiumPosition: 'top' | 'bottom';  // 编辑器内唯一方向来源：'top'（顶部）或 'bottom'（底部）
  guardSeats: {
    enabled: boolean;                 // 是否启用左右护法，默认 true
    leftEnabled: boolean;             // 是否显示左护法，默认 true
    rightEnabled: boolean;            // 是否显示右护法，默认 true
    includeInAutoAssignment: boolean; // 是否参与智能排位，默认 false
    hideEmptyOnExport: boolean;       // 空护法位导出时是否隐藏，默认 true
  };
}

// --- 人的实体单元 (Student) ---
interface Student {
  id: number;          // 内部递增自增主键
  name: string;
  studentNumber: string | number | null; // 保证在班级内唯一
  tags: string[];      // 挂载的 TagId 列表（标签）
}

// --- 分区单元 (Zone) ---
// 定义在 useZoneData.ts
interface Zone {
  id: number;
  name: string;
  color: string;       // 自动取关联的第一个标签颜色，如果没标签就给灰色
  tagIds: string[];    // 与该 Zone 绑定的条件标签
  seatIds: string[];   // 该 Zone 实际框选的哪些物理座位（物理落点集合）
}
```

## 4. 关键实现节点 (Implementation Details)
- **Map加速 (`rebuildSeatMap`)**:  为了避免拖拽时产生的 $O(n)$ 线性查找，在每次更改配置（行、列）后，都会执行 `rebuildSeatMap()` 把所有 proxy 给铺平到 Map 中，确保 `O(1)` 操作。
- **渲染数据准备 (`organizedSeats`)**: 原生 `seats.value` 是扁平一维数组，为了让 Vue 能通过嵌套 `v-for` 渲染出大组-列-行的 UI 表格组合，专门设计了 `organizedSeats` computed，以 $O(n)$ 复杂度预分桶成三维数组 `[group][col][row]`。
- **护法特殊座位**: 左右护法与普通座位共享 `seatMap`、分配、交换、清空和撤销机制，但不进入 `organizedSeats`。编辑器通过 `visibleGuardSeats` 渲染讲台两侧；渲染时根据讲台视觉位置决定左右槽位，讲台在顶部时左右护法顺序互换，讲台在底部时保持 `左护法 / 讲台 / 右护法`。默认不进入 `getAvailableSeats()`，只有显式传入并开启 `guardSeats.includeInAutoAssignment` 时才可被智能排位使用。
- **自动保存恢复**: `useAutoSave()` 监听完整工作区签名，每次逻辑变更都会按顺序覆盖平台存储中的唯一 `sce-autosave-backup` 快照；快照记录同时包含保存时间与工作区数据，避免分键写入产生不一致。启动时 `App.vue` 每次都会检查现有快照并显示恢复提示，文件页会在工作区列表顶部显示自动保存卡片，统一调用 `restoreAutoSaveBackup()` 应用工作区数据。旧版 `sce-autosave-time` 数据仍可读取，并会在下一次保存时清理。
- **工作区契约版本**: 当前 `.sce` schema 为 `2.3`。持久化层允许学生、标签和选区使用数字或字符串 ID，加载时统一按字符串键映射到运行时数字 ID；高于当前 schema 的文件会在迁移和状态写入前拒绝，避免新版本字段被旧版本静默覆盖。
- **原子加载**: 所有本地、云端和自动保存数据都会先复制、迁移并通过 `workspaceValidation.ts` 完整校验。迁移阶段会把旧版数字字符串学号转换为数字；对于分支前允许保存的数值属性值，会按实际有限数值扩展对应定义的上下限和小数位，从而保留旧数据而不在重载时截断。校验覆盖布局、座位 ID/坐标一致性、学生唯一分配、数值属性定义、轮换座位引用和规则对象/参数引用；只有候选数据有效时才写入共享状态，不能解析的规则不会静默丢弃。写入阶段异常会通过可信运行态快照恢复学生、标签、选区、规则和轮换的原始 ID，并同步恢复撤销、选择及编辑模式，不能重新导入快照后再挂回旧 ID；成功切换工作区后会清理工作台弹层、移动面板和选区编辑会话。
- **本地路径提交**: Tauri 本地文件路径只在工作区成功应用后更新。云端或自动保存来源会清除旧本地路径，避免后续“保存”误覆盖先前文件。

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **坐标系方向警告陷阱**:  底层 `rowIndex` 始终是物理坐标，不随导出翻转改写。编辑器内“前方”只由 `seatConfig.podiumPosition` 决定：讲台在底部时 `rowIndex` 越大越靠前；讲台在顶部时 `rowIndex` 越小越靠前。旧字段 `alignment`/`seatAlignment` 只用于工作区加载迁移。
- **特殊座位解析陷阱**: `guard-left` / `guard-right` 不能传入普通 `parseSeatId()` 坐标流程。多选平移、区域轮换、行列规则等依赖普通坐标的逻辑应默认跳过护法位。
- **学号防冲突覆盖**: 在更新学生信息时若发现 `studentNumber` 冲突，老数据（即使已被绑定）会**静默丢失其学号**，而把该号码转交给新用户。
- **迁移纯度**: `migrateWorkspace()` 只能处理 `cloneWorkspaceInput()` 创建的副本，禁止直接修改调用方传入的工作区对象。
