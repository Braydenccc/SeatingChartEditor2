import type { RuleEntityReference } from '@/types/models'
import type { AlertRequest } from '@/services/uiFeedback'

interface RuleReferenceFeedbackApi {
  warning: (
    message: string,
    context?: Record<string, unknown>,
    immediate?: boolean
  ) => number
  alert: (request: AlertRequest) => Promise<void>
}

export const formatRuleReferenceBlockMessage = (
  entityLabel: string,
  references: RuleEntityReference[]
): string => {
  const rules = new Map<string, RuleEntityReference>()
  references.forEach(reference => {
    if (!rules.has(reference.ruleId)) rules.set(reference.ruleId, reference)
  })
  const labels = [...rules.values()].map(reference => {
    const name = reference.ruleDescription || reference.predicate || '未命名规则'
    return `“${name}”（${reference.ruleId}）`
  })
  return `${entityLabel}仍被以下规则引用，无法删除：\n${labels.map(label => `- ${label}`).join('\n')}\n请先修改或删除这些规则。`
}

export const showRuleReferenceBlockFeedback = (
  feedback: RuleReferenceFeedbackApi,
  title: string,
  entityLabel: string,
  references: RuleEntityReference[]
) => {
  const content = formatRuleReferenceBlockMessage(entityLabel, references)
  feedback.warning(content, { references }, false)
  void feedback.alert({
    title,
    content,
    positiveText: '知道了',
    type: 'warning'
  })
}
