---
module_name: Rule Engine
description: 将用户对“座位安排”的自然语言需求转化为结构化的拓扑冲突约束，支持排位前自检。
related_files:
  - src/composables/useSeatRules.ts
  - src/constants/ruleTypes.ts
---

# 04-规则引擎方案 (Rule Engine Strategy)

## 1. 核心职责 (Core Purpose)
定义、校验以及人类语言化渲染所有排位规则。规则引擎不直接执行排座位操作，它是给【05-自动排位算法】和【人工排位时 UI 报错机制】提供一个通用的“合规性检测器” (Compliance Checker)。

## 2. 源代码入口 (Source Files)
- 规则配置字典: `src/constants/ruleTypes.ts` (存放枚举、默认参数、谓词元数据)
- 规则中枢逻辑: `src/composables/useSeatRules.ts`
- 规则共享状态与实体引用查询: `src/composables/seatRuleState.ts`

## 3. 数据模型 / 核心API (Data Models & Core API)

```typescript
// 规则对象存储格式 (Version 5)
interface Rule {
  id: string;
  version: 5;
  enabled: boolean;
  priority: 1 | 0;     // 1=REQUIRED (不满足则报错/不许分配)，0=PREFER (加分项)
  subjects: RuleSubject[]; // 绑定的对象，支持混搭：[张三, 含有<视力不佳>标签的所有人]
  predicate: string;   // 谓词 (e.g. "IN_ROW_RANGE", "MUST_BE_SEATMATES")
  params: Record<string, any>; // 给谓词专用的参数集 (e.g. {minRow: 1, maxRow: 2})
  description?: string;
}

// 对象描述符
interface RuleSubject {
  type: 'person' | 'tag' | 'all';
  id: number | string;  
}

interface RuleEntityReference {
  entityType: 'student' | 'tag' | 'numericAttribute' | 'zone';
  entityId: number | string;
  ruleId: string;
  ruleDescription: string;
  predicate: string;
  locations: string[]; // 例如 $.subjects[0]、$.subRules[1].params.zoneId
}

interface EntityDeletionResult {
  success: boolean;
  reason?: 'not-found' | 'referenced-by-rules';
  references: RuleEntityReference[];
}

// PREDICATE_META 结构示例
const PREDICATE_META = {
  IN_ROW_RANGE: {
    relation: 'single', // 单体应用规则
    minSubjects: 1,
    params: [
      { key: 'minRow', type: 'number', label: '最前排' },
      { key: 'maxRow', type: 'number', label: '最后排' }
    ]
  }
}
```

## 4. 关键实现节点 (Implementation Details)
- **自然语言渲染 (`renderRuleText`)**: 能够根据 `subjects` (主体), `predicate` (动词/条件), `params` (参数), `priority` (优先级) 和 `not` / `subRules` 拼接成完整自然句，例如「张三必须坐在第 1 至 3 排。」或「对张三，尽量同时满足：不要坐在第 1 至 2 排，并且避开墙边列。」。规则列表、效果预览、排位报告和冲突提示都应复用此函数，避免直接展示 `对象集合(...)`、`[非]` 或内部谓词名。
- **平埔展开 (`expandEntriesToStudentIds`)**: 由于规则主体支持“标签(Tag)”，真正的算法计算前，必须利用此函数将一个规则平铺展开成若干个“学生实例(StudentId)”。
- **全体主体 (`type: 'all'`)**: 用于数值参考等班级级规则，展开时表示当前学生列表中的全部学生，不需要额外 `id`。
- **数值参考谓词**: `ATTRIBUTE_ROW_GRADIENT`、`ATTRIBUTE_GROUP_BALANCE`、`ATTRIBUTE_PAIR_DELTA`、`ATTRIBUTE_DISTRIBUTE_BANDS` 通过 `params.attributeId` 绑定学生数值属性。`PREDICATE_META` 支持 `attribute` 参数类型，由规则 UI 渲染为属性选择器。
- **递归实体引用查询 (`getRuleReferences`)**: 删除学生、标签、数值属性或全局选区前，`seatRuleState.ts` 会遍历全部规则，而不只扫描当前启用规则或顶层字段。查询覆盖 v5 `subjects`、兼容字段 `subjectsA/subjectsB`、legacy `subject`、组合 `subRules`、嵌套 `conditions`，以及各层 `params.zoneId` / `params.attributeId`；结果按规则聚合并保留精确引用路径。禁用规则仍属于持久化配置，删除其依赖实体同样会被阻止。`type: 'all'` 表示动态全体范围，不包含某个学生的悬空 ID，因此不会单独阻止学生删除。
- **删除保护边界**: 各实体 composable 在任何关联数据变更前调用引用查询，并返回结构化 `EntityDeletionResult`。交互层必须根据 `references` 提示用户先修改或删除规则，不能静默级联改写规则。工作区加载、新建和回滚使用专门的 `clear/replace` 原子状态路径，在整体替换规则与实体时不走单实体删除流程。
- **高级拓扑冲突 (`detectConflicts`)**: 利用笛卡尔组合判断所有激活的规则是否存在矛盾。这是整个系统的最强亮点。比如判定：“规则A要求张三离李四超过 3 步”，同时“规则B要求张三离李四不得超过 2 步”，就会抛出异常。
- **统一座位拓扑**: 行号、讲台方向、异构大组行数、同桌关系和座位深度由纯函数 `src/utils/seatTopology.ts` 统一计算。冲突预检不再使用全局默认行数；当前同桌关系允许同排列差 1～2，因此“必须同桌”和最小距离 2 可以同时成立，距离大于 2 才是结构性冲突。
- **同桌图可行性**: 排位前检查会把 REQUIRED 学生关系图嵌入真实可用座位同桌图，同时考虑禁止同桌边和单人座位域。搜索达到预算上限时只给警告，不把“尚未证明不可行”误判为阻断错误。

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **前后兼容坑**: 由于该项目持续演进到 v2，存在历史存档的解析版本差异。`useSeatRules.ts` 首部的 `normalizeRuleShape` 用来兼容旧版本到最新规则结构。如果修改 `Rule` 结构，务必同步更新并测试此 Normalize 方法。
- **添加新规则**: 若要添加一种全新的排位逻辑：
  1. `ruleTypes.ts` 中添加对应的 `PREDICATE_META`。
  2. `useSeatRules.ts` 的 `renderRuleText` 中加上 switch-case 的文案。
  3. `useAssignment.ts`（核心算法层）中补齐其惩罚函数的实现。不需要改动已有 UI，它会自动识别 `meta` 渲染出参数框。
- **数值参数边界**: 规则编辑器的 `NInputNumber` 必须先通过 `normalizeNumberInput` 处理空值、上下界和整数精度，再写入 `RuleParams`。规则创建、更新、规则 JSON 导入、工作区加载和智能排位入口都必须按 `PREDICATE_META` 拒绝非数值、`NaN`、无穷值及不符合整数约束的参数；数值分层的 `bandCount` 只接受 2～50 的整数，避免异常配置放大同步评分循环。
- **复合规则落盘**: 工作区保存必须保留 `not`、`logicOperator`、`subRules`，否则规则工作台创建的复合规则和数值参数会在保存后丢失。
- **新增引用字段**: 新规则若增加学生、标签、属性或选区 ID 字段，必须同步扩展 `seatRuleState.ts` 的语义引用识别并补充嵌套路径测试；不能只在某个删除按钮上增加临时判断。
