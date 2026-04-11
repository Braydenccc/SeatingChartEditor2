---
trigger: conditional
globs:
  - "src/components/rule/**"
  - "src/composables/useSeatRules.js"
  - "src/constants/ruleTypes.js"
---

# 规则引擎

定义/校验/渲染排位规则，是自动排位和 UI 报错的合规性检测器。

## 数据模型

- Rule: id / version:5 / enabled / priority(1=REQUIRED,0=PREFER) / subjects[] / predicate / params
- RuleSubject: type('person'|'tag') / id

## 关键实现

- renderRuleText：拼接自然语言如"张三、李四 · 禁止同桌"
- expandEntriesToStudentIds：标签平铺为学生实例
- detectConflicts：笛卡尔组合检测规则矛盾

## 防坑

- 版本兼容：normalizeRuleShape 兼容 v3/v4→v5，修改 Rule 结构务必同步更新
- 添加新规则三步：ruleTypes.js 加 PREDICATE_META → useSeatRules.js 加 renderRuleText → useAssignment.js 加惩罚函数