---
module_name: Zones & Rotation System
description: 选区机制与周期性的座位大轮换。
related_files:
  - src/composables/useZoneData.ts
  - src/composables/useZoneRotation.ts
---

# 06-区域与轮换系统 (Zones & Rotation System)

## 1. 核心职责 (Core Purpose)
将物理上杂散的座位集合归纳成逻辑“区域 (Zone)”，用于高亮显示或条件绑定。并在 Zone 的基础上，构建“大组轮换”引擎，使学生能在多个 Zone 之间周期性转移。

## 2. 源代码入口 (Source Files)
- 选区元数据: `src/composables/useZoneData.ts`
- 轮换执行逻辑: `src/composables/useZoneRotation.ts`

## 3. 数据模型 / 核心API (Data Models & Core API)

```typescript
// useZoneData.ts
interface Zone {
  id: number;
  name: string;
  tagIds: string[];  // 若配置了标签，自动排位时会将带此标签的学生优先塞入此区
  seatIds: string[]; // 框选的确切座位 id 数组
}

// useZoneRotation.ts
interface RotationGroup {
  id: number;
  type: 'cycle' | 'swap'; // cycle=无限制循环，swap=强制对换
  zones: LocalZone[];     // 轮换独有的局部选区定义
}
```

## 4. 关键实现节点 (Implementation Details)
- **坐标防错排序 (`sortedBySeatPos`)**: 在执行轮换时，用户鼠标最初框选座位时 `seatIds` 的录入顺序往往是极度混乱的。如果不排序，一键轮换后整个大组的人是乱序填入新组的。因此代码内部每次都会强制按照 `.sort((a,b) => group - col - row)` 拍平进行一对一平移。
- **原子无缝替换 (Atomic Snapshot)**: `applyZoneRotation` 函数执行前，会用 `map` 对所有人“拍快照”。即使 ZoneA 的人要移到 ZoneB，且 ZoneB 的人移到 ZoneC，由于快照存在，也不会出现“ZoneB 先被覆盖而丢失数据”的时序问题。
- **工作区持久化**: `.sce` schema `2.3` 会保存完整 `rotationGroups`。`getRotationData()` 返回深拷贝，`replaceRotationData()` 先校验再整体替换并保留组/选区 ID，`resetRotationData()` 用于新建工作区；加载缺少该字段的旧工作区时必须恢复为空数组，不能沿用上一个工作区的轮换状态。
- **引用校验**: 工作区写入共享状态前会检查轮换组和局部选区 ID 唯一性、类型及全部 `seatIds`。引用不存在座位的轮换数据会拒绝加载并保留当前工作区。
- **布局缩减清理**: `zoneRotationState.ts` 保存无 `useSeatChart` 依赖的轮换状态与纯清理函数。布局删除行、列或大组后，普通选区和轮换局部选区会一起裁剪已不存在的座位 ID，避免保存出无法再次加载的工作区。

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **选区名复用风险**: 轮换组内部的局部选区使用的是全局 `nextZoneId`。如果要做 UI 展示，记得一定要拿 `getZoneColor` 方法来匹配，而不是死编码。
- **孤立引用**: 如果你在大画布里通过拖拽删除了某一排，记得底层会有一个 `cleanupInvalidSeats` 的拦截器执行。这保证了 Zone 不会记录一堆图谱里不存在的空指针。
