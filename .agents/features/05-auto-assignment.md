---
module_name: Auto-Assignment Algorithm
description: 座位表的核心大脑。利用“模拟退火”实现满足多维约束（同桌、分区、排数、隔离距离、正前方防遮挡）的最优座次计算。
related_files:
  - src/composables/useAssignment.js
---

# 05-自动排位算法 (Auto-Assignment Algorithm)

## 1. 核心职责 (Core Purpose)
将所有被放到右侧工作区的学生，根据《04-规则引擎》里定义的上百条冲突和偏好，找出一个最优（总体扣分最少）的坐法。它不再是 $O(n^2)$ 的贪婪分配，而是一种启发式暴力搜索过程。

## 2. 源代码入口 (Source Files)
- 退火算法核心: `src/composables/useAssignment.js`
- 规则惩罚依赖: `src/constants/ruleTypes.js`
- 座位拓扑判定库: `src/composables/useSeatChart.js` (依赖里面的 `validateRepulsion` 等方法)

## 3. 算法核心概念 (The Heuristic Approach Context)

```typescript
// 内部使用了一个非常简单的 Map 来在循环中表达当前正在尝试的“状态”
// 这是一个性能极致攸关的选择，没用任何复杂的类
let currentAssignment = new Map<StudentId, SeatId>()
let currentReverse = new Map<SeatId, StudentId>() // 用于以 O(1) 交换两人
```

- **目标函数 (`evaluateScore`)**: 接受一个完整的 `Map<StudentId, SeatId>`，计算该布局有几道题没做对。得分为负数，`0` 分就是完美解。
- **温度 (`T`)**: 算法开始时温度很高，容忍尝试各种更糟糕的解（跳出局部极值）；随着迭代冷却，仅接受越来越好的布局。
- **动态干扰 (Stagnation & Reheat)**: 当长达几千次尝试都没改观时，说明陷入死胡同，此时会手动把“温度”再升高，强行随机拨乱 15% 人的座位 (`Global Shakeup`)。

## 4. 关键实现节点 (Implementation Details)
- **聪明的首批种子 (`generateInitialSolution`)**: 没有让系统完全从零随机。算法第一步是一个针对 `RulePriority.REQUIRED` 规则的“贪心硬排”：它会自动扫描所有要求“必须在第1排”的人，起手就直接锁在第1排的空位上，这一步能瞬间节约 80% 的退火山头寻找时间。
- **偏向变异 (`violatingStudents` list)**: 这是本项目最大的魔法。正常退火是随机抽 2 人换位置，但在 `useAssignment.js` 中，每次循环都会预先整理出一批**“正在犯规的人的名单”**。变异（抽人换座位）时，有 $70\%$ 的概率强制要求动的是有犯规在身的人！极大地抹平了无用功迭代。
- **线程脱离避卡 (`setTimeout(0)`)**: JavaScript 是单线程的，死循环 5w 次计算会锁死标签页。本项目规定每隔 1000 次执行一次 `await new Promise(r => setTimeout(r, 0))`，向主 UI 框架注入呼吸孔，使画面进度条 `assignmentProgress.value` 可以持续滚动更新。

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **禁止在循环中分配大对象**: 在 `runAnnealingLoop` 中，任何 `array.map()`，`filter()` 或 `{...foo}` 的克隆产生都会在一个回合中累积到 50,000 次以上。不要在内循环里添加复杂的内存开销，使用普通的 `let/for/...`。
- **分数累减逻辑**: 增加对新规则的识别时，注意去找 `checkViolation` 和 `evaluateScore` 两个内部函数，按照惩罚系统 (`PENALTY_WEIGHTS.optional = 100`) 往下减分，如果违背程度更深（比如要求离3格远但现在贴一起），还要给叠加乘数扣分。
