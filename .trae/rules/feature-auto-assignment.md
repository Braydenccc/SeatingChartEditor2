---
trigger: conditional
globs:
  - "src/composables/useAssignment.js"
---

# 自动排位算法

模拟退火实现多维约束最优座次。启发式暴力搜索，非 O(n²) 贪婪。

## 核心概念

- currentAssignment: Map<StudentId, SeatId>，currentReverse 用于 O(1) 交换
- evaluateScore：计算扣分（负数，0=完美解）
- 温度 T：高温容忍差解跳出局部极值，冷却后仅接受更好布局
- Stagnation & Reheat：无改观时升温，随机拨乱 15% 座位

## 关键实现

- 贪心种子：generateInitialSolution 先硬排 REQUIRED 规则
- 偏向变异：70% 概率强制选犯规者换座
- 呼吸孔：每 1000 次循环 await setTimeout(0) 让 UI 更新

## 防坑

- 禁止内循环分配大对象(map/filter/展开)，用普通 let/for
- 新规则去 checkViolation 和 evaluateScore 按惩罚权重减分