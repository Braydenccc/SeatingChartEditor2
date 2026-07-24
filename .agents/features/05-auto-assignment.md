---
module_name: Auto-Assignment Algorithm
description: 座位表的核心大脑。利用“模拟退火”实现满足多维约束（同桌、分区、排数、隔离距离、正前方防遮挡）的最优座次计算。
related_files:
  - src/composables/useAssignment.ts
---

# 05-自动排位算法 (Auto-Assignment Algorithm)

## 1. 核心职责 (Core Purpose)
将所有被放到右侧工作区的学生，根据《04-规则引擎》里定义的上百条冲突和偏好，找出一个最优（总体扣分最少）的坐法。它不再是 $O(n^2)$ 的贪婪分配，而是一种启发式暴力搜索过程。

## 2. 源代码入口 (Source Files)
- 退火算法核心: `src/composables/useAssignment.ts`
- 必须规则验收策略: `src/utils/assignmentRuleAcceptance.ts`
- 规则惩罚依赖: `src/constants/ruleTypes.ts`
- 座位拓扑判定库: `src/composables/useSeatChart.ts` (依赖里面的 `validateRepulsion` 等方法)

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
- **规则编译 (`compileRulesForAssignment`)**: 进入退火循环前会把活跃规则复制成编译版。编译阶段会展开主体、预取数值属性、缓存学生/座位索引，并生成评分单元与学生反向索引，避免在高频评分循环里反复查找学生对象、展开标签主体或解析座位。
- **局部评分 (`ScoreTracker`)**: 普通交换/空位移动会先临时修改 `Map`，再只重算移动学生牵连的评分单元；均匀分散、聚集、数值大组均衡、复合规则等全局规则仍整体重算，以保证规则语义不变。
- **同分随机游走 (`randomizePlateauSolution`)**: 初始解或退火过程已达到满分时，不再直接返回第一个 0 分解，而是从最佳解出发做一小段同分平台随机游走。只接受不降分的交换或空位移动，提升多合法位置场景下的随机性，同时保持满足率和报告分数可信。
- **距离下限规则**: `DISTANCE_AT_LEAST` 使用同大组内的直线距离判断，避免对角线相邻座位在曼哈顿距离上“刚好合格”但视觉上仍过近。
- **数值参考评分**:
  - `ATTRIBUTE_ROW_GRADIENT`: 将学生属性值归一到 0～1，并和座位前后比例比较，偏差越大扣分越多。
  - `ATTRIBUTE_GROUP_BALANCE`: 按大组统计均值或合计值，组间差距越大扣分越多。
  - `ATTRIBUTE_PAIR_DELTA`: 对两两对象检查属性差值上限，超出部分追加扣分。
  - `ATTRIBUTE_DISTRIBUTE_BANDS`: 按属性排序分层后，惩罚同一层在大组间分布不均。
- **必须规则验收策略 v1 (`evaluateRuleAcceptance`)**: 原始惩罚分仍用于退火持续寻找更优解；最终报告和提交门禁复用同一个验收结果，避免报告显示满足但拒绝提交，或反向出现不一致。只有连续型 `required` 规则使用无量纲容差：
  - `DISTRIBUTE_EVENLY`: 最小距离相对理想值的缺口不超过 10%；任何相邻座位仍作为硬违规严格拒绝。
  - `ATTRIBUTE_ROW_GRADIENT`: 前后深度比例的均方误差不超过 0.04，即 RMSE 不超过 20%，约等于常见五排布局的一排偏差。
  - `ATTRIBUTE_GROUP_BALANCE`: 按属性值域归一化后的组间均方误差不超过 0.01，即 RMSE 不超过 10%；存在有可用座位但没有规则目标的空大组时仍严格拒绝。
  - 位置、同桌、距离、聚集、属性差值和属性分层等离散谓词继续按布尔结果严格验收；`prefer` / `optional` 不使用必须级容差。缺失数值导致规则无法评估时继续视为不阻断。策略集中在版本化常量中，不要求旧工作区新增字段。
- **数值缺失与归一化策略**: 学生缺失某个属性值时跳过该对象，不视为违规，不阻断排位；大组均衡会分别统计“规则目标”和“可评估数值”，在至少存在一个可评估值时，只有完全没有规则目标的大组才触发空组硬错误，只有缺失值目标的大组不参与误差计算。非零属性值域直接用于无量纲归一化，避免计量单位改变验收结果；行梯度遇到所有有效值相等时视为无法评估，不会把同值学生强行推向同一侧。
- **数值初始解**: 对 `prefer` 级 `ATTRIBUTE_ROW_GRADIENT` 会先按属性排序分配前后排座位，再交给退火继续优化；同值学生和同排候选座位会随机打破平局，避免数组顺序固定化；`required` 规则仍主要靠评分保证，避免抢占同桌绑定等硬约束的初始位置。
- **偏向变异 (`violatingStudents` list + ruleAffectedStudentIds)**: 正常退火是随机抽 2 人换位置，但在 `useAssignment.ts` 中，每次循环都会预先整理出一批**“正在犯规的人的名单”**。变异时优先移动违规学生；若暂无明确违规学生，则优先从被规则覆盖的学生池中抽取；最后才回落到全体已分配学生。这样无规则学生更多承担随机填空角色，但仍可参与交换，避免局部子问题封死。
- **线程脱离避卡 (`setTimeout(0)`)**: JavaScript 是单线程的，死循环 5w 次计算会锁死标签页。本项目规定每隔 1000 次执行一次 `await new Promise(r => setTimeout(r, 0))`，向主 UI 框架注入呼吸孔，使画面进度条 `assignmentProgress.value` 可以持续滚动更新。
- **运行所有权与迟到结果保护**: 智能排位使用模块级 run token。关闭弹层、卸载或主动取消会让当前任务失效；提交前还会核对学生、座位配置、座位状态、选区和规则输入签名。旧任务、被取消任务或输入已变化的任务不会清空或覆盖当前座位，也不会写入 Undo 或成功报告。
- **拓扑与随机一致性**: 梯度按学生所在大组的实际行数归一化；未分区座位在区域聚集规则中各自成为独立 bucket；属性均衡会纳入有可用座位但目标数为 0 的大组。所有随机排列统一使用 Fisher–Yates；需要主键排序时先洗牌再依赖稳定排序打破同值顺序。
- **护法位参与排位**: `getAvailableSeats()` 默认不返回左右护法位；只有 `seatConfig.guardSeats.includeInAutoAssignment === true` 时，智能排位才会把 `guard-left` / `guard-right` 纳入基础候选座位。护法位没有普通行列坐标：单人行/组/区域正向规则会视为不满足，负向规则视为不违规；同桌、同组、相邻排、最大距离等需要普通坐标才能满足的正向关系会视为不满足；分散/聚集这类整体坐标统计会跳过护法位，避免 `parseSeatId()` 读取出 `NaN`。

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **禁止在循环中分配大对象**: 在 `runAnnealingLoop` 中，任何 `array.map()`，`filter()` 或 `{...foo}` 的克隆产生都会在一个回合中累积到 50,000 次以上。不要在内循环里添加复杂的内存开销，使用普通的 `let/for/...`。若新增规则，请优先接入编译主体、座位缓存和评分单元索引，而不是在评分函数里临时构造数据。
- **分数累减逻辑**: 增加对新规则的识别时，注意去找 `checkViolation` 和 `evaluateScore` 两个内部函数，按照惩罚系统 (`PENALTY_WEIGHTS.optional = 100`) 往下减分，如果违背程度更深（比如要求离3格远但现在贴一起），还要给叠加乘数扣分。
- **特殊座位防护**: 所有直接调用 `parseSeatId()` 的新规则都必须先排除 `isGuardSeatId(seatId)`。护法位可以被分配学生、交换、撤销，但不能参与普通座位的距离、前后排、同桌、全局列等几何计算。
