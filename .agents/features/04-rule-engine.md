---
module_name: Rule Engine
description: 将用户对“座位安排”的自然语言需求转化为结构化的拓扑冲突约束，支持排位前自检。
related_files:
  - src/composables/useSeatRules.js
  - src/constants/ruleTypes.js
---

# 04-规则引擎方案 (Rule Engine Strategy)

## 1. 核心职责 (Core Purpose)
定义、校验以及人类语言化渲染所有排位规则。规则引擎不直接执行排座位操作，它是给【05-自动排位算法】和【人工排位时 UI 报错机制】提供一个通用的“合规性检测器” (Compliance Checker)。

## 2. 源代码入口 (Source Files)
- 规则配置字典: `src/constants/ruleTypes.js` (存放枚举、默认参数、谓词元数据)
- 规则中枢逻辑: `src/composables/useSeatRules.js`

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
  type: 'person' | 'tag';
  id: number | string;  
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
- **自然语言渲染 (`renderRuleText`)**: 能够根据 `subjects` (主体), `predicate` (动词/条件), `params` (参数) 拼接成类似：`❗ 张三、李四 · 禁止同桌` 的字符串，用于展示在左侧列表。
- **平埔展开 (`expandEntriesToStudentIds`)**: 由于规则主体支持“标签(Tag)”，真正的算法计算前，必须利用此函数将一个规则平铺展开成若干个“学生实例(StudentId)”。
- **高级拓扑冲突 (`detectConflicts`)**: 利用笛卡尔组合判断所有激活的规则是否存在矛盾。这是整个系统的最强亮点。比如判定：“规则A要求张三离李四超过 3 步”，同时“规则B要求张三离李四不得超过 2 步”，就会抛出异常。

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **前后兼容坑**: 由于该项目持续演进到 v2，存在历史存档的解析版本差异。`useSeatRules.js` 首部有一个长达几十行的 `normalizeRuleShape`，它是用来兼容 `version=3`, `version=4` 到最新的 `version=5`（即统一使用 `subjects: []`）的桥梁。如果修改 `Rule` 结构，务必同步更新并测试此 Normalize 方法。
- **添加新规则**: 若要添加一种全新的排位逻辑：
  1. `ruleTypes.js` 中添加对应的 `PREDICATE_META`。
  2. `useSeatRules.js` 的 `renderRuleText` 中加上 switch-case 的文案。
  3. `useAssignment.js`（核心算法层）中补齐其惩罚函数的实现。不需要改动已有 UI！它会自动识别 `meta` 渲染出参数框。
