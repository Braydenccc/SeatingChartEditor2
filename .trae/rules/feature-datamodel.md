---
trigger: conditional
globs:
  - "src/composables/useStudentData.js"
  - "src/composables/useSeatChart.js"
  - "src/composables/useWorkspace.js"
  - "src/composables/useZoneData.js"
---

# 核心数据模型

座位与学生解耦，通过 studentId 缝合。Map 实现 O(1) 检索。

## 数据结构

- **Seat**: id(seat-{g}-{c}-{r}) / groupIndex / columnIndex / rowIndex / studentId / isEmpty
- **SeatConfig**: groupCount / columnsPerGroup / seatsPerColumn
- **Student**: id / name / studentNumber / tags[]
- **Zone**: id / name / color / tagIds[] / seatIds[]

## 关键实现

- rebuildSeatMap()：配置变更后铺平到 Map
- organizedSeats：扁平数组→[group][col][row] 三维数组

## 防坑

- rowIndex 翻转：0=最后排，越大越靠讲台！方向判定最易出 Bug
- 学号冲突：更新时若冲突，老数据静默丢失学号