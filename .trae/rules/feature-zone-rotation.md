---
trigger: conditional
globs:
  - "src/components/zone/**"
  - "src/composables/useZoneData.js"
  - "src/composables/useZoneRotation.js"
---

# 区域与轮换系统

杂散座位归纳为逻辑区域(Zone)，构建大组轮换引擎。

## 数据模型

- Zone: id / name / tagIds[](带标签学生优先塞入) / seatIds[](框选座位)
- RotationGroup: id / type('cycle'|'swap') / zones[]

## 关键实现

- sortedBySeatPos：轮换前按 group-col-row 排序防乱序
- applyZoneRotation：原子快照，ZoneA→B 且 B→C 不因覆盖丢数据

## 防坑

- 轮换组局部选区用全局 nextZoneId，UI 用 getZoneColor() 匹配颜色
- 删除座位后 cleanupInvalidSeats 清理 Zone 空指针