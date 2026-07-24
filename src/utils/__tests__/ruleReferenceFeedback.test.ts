import { describe, expect, it, vi } from 'vitest'
import {
  formatRuleReferenceBlockMessage,
  showRuleReferenceBlockFeedback
} from '../ruleReferenceFeedback'
import type { RuleEntityReference } from '@/types/models'

const references: RuleEntityReference[] = [{
  entityType: 'student',
  entityId: 1,
  ruleId: 'rule-1',
  ruleDescription: '前排照顾',
  predicate: 'STUDENT_IN_ZONE',
  locations: ['$.params.studentIds[0]']
}, {
  entityType: 'student',
  entityId: 1,
  ruleId: 'rule-1',
  ruleDescription: '前排照顾',
  predicate: 'STUDENT_IN_ZONE',
  locations: ['$.predicates[0].params.studentIds[0]']
}]

describe('ruleReferenceFeedback', () => {
  it('lists each referencing rule once with its name and id', () => {
    const message = formatRuleReferenceBlockMessage('学生“张三”', references)

    expect(message).toContain('“前排照顾”（rule-1）')
    expect(message).toContain('\n- “前排照顾”（rule-1）\n')
    expect(message.match(/rule-1/g)).toHaveLength(1)
  })

  it('keeps structured references in the log and replaces the toast with an alert', () => {
    const warning = vi.fn(() => 1)
    const alert = vi.fn(() => Promise.resolve())

    showRuleReferenceBlockFeedback(
      { warning, alert },
      '无法删除学生',
      '学生“张三”',
      references
    )

    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('“前排照顾”（rule-1）'),
      { references },
      false
    )
    expect(alert).toHaveBeenCalledWith({
      title: '无法删除学生',
      content: expect.stringContaining('“前排照顾”（rule-1）'),
      positiveText: '知道了',
      type: 'warning'
    })
  })
})
