---
module_name: Core Data Model
description: 定义系统最底层的“座位”、“学生”与“工作区快照”的数据结构，是排位系统的根本。
---

# 01-核心数据模型 (Core Data Model)

## 1. 核心职责 (Core Purpose)
维系全局的响应式数据模型，并保证大规模数据渲染时的检索性能（O(1) Map）。座位（Seat）和学生（Student）是互相解耦的资源，通过 `studentId` 缝合。

## 2. 源代码入口 (Source Files)
- 学生数据源: `src/composables/useStudentData.js`
- 座位数据源: `src/composables/useSeatChart.js`
- 数据中枢与格式定义: `src/composables/useWorkspace.js`

## 3. 数据模型定义 (TypeScript Interfaces)

```typescript
// --- 核心拓扑单元 (Seat) ---
// 定义在 useSeatChart.js 中
interface Seat {
  id: string;          // 完全结构化的ID，格式: `seat-{groupIndex}-{columnIndex}-{rowIndex}`
  groupIndex: number;  // 大组索引 (0-indexed，左->右)
  columnIndex: number; // 所在大组内的列索引 (0-indexed，左->右)
  rowIndex: number;    // 行索引 (0-indexed)。注意：0 代表离讲台最远的最后一排！
  studentId: number | null; // 绑定的实体ID
  isEmpty: boolean;    // 是否是“走廊/柱子”（物理不存在的占位符）。为true时不可再坐人。
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
  podiumPosition: 'top' | 'bottom';  // 讲台位置：'top'（顶部）或 'bottom'（底部）
  seatAlignment: 'top' | 'bottom';   // 座位对齐方式：'top'（对齐顶部/后排）或 'bottom'（对齐底部/前排）
}

// --- 人的实体单元 (Student) ---
interface Student {
  id: number;          // 内部递增自增主键
  name: string;
  studentNumber: string | number | null; // 保证在班级内唯一
  tags: string[];      // 挂载的 TagId 列表（标签）
}

// --- 分区单元 (Zone) ---
// 定义在 useZoneData.js
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

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **坐标系翻转警告陷阱**:  在底层结构中，讲台位于布局最下方！这意味着 `rowIndex` 值**越大**，越靠前（离讲台近）。这是所有方向判定（遮挡判断 `isDirectlyBehind`）最容易出Bug的地方。
- **学号防冲突覆盖**: 在更新学生信息时若发现 `studentNumber` 冲突，老数据（即使已被绑定）会**静默丢失其学号**，而把该号码转交给新用户。
