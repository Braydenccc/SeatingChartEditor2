import type { RulePriority } from '@/types/models'

export const REQUIRED_RULE_ACCEPTANCE_POLICY_VERSION = 1 as const

export interface RequiredRuleAcceptancePolicy {
  version: typeof REQUIRED_RULE_ACCEPTANCE_POLICY_VERSION
  metric:
    | 'relative-min-distance-shortfall'
    | 'mean-squared-depth-error'
    | 'mean-squared-range-error'
  maxNormalizedViolation: number
}

/**
 * 必须级连续规则的验收阈值。
 *
 * 这些值作用于各谓词自身的无量纲归一化误差，而不是乘过优先级权重的原始惩罚分。
 * 未列出的谓词仍按离散规则处理，只有精确满足时才通过。
 */
export const REQUIRED_RULE_ACCEPTANCE_POLICIES = {
  DISTRIBUTE_EVENLY: {
    version: REQUIRED_RULE_ACCEPTANCE_POLICY_VERSION,
    metric: 'relative-min-distance-shortfall',
    // 最小距离最多比布局相关理想值低 10%；相邻座位仍由 hardViolation 严格拒绝。
    maxNormalizedViolation: 0.1
  },
  ATTRIBUTE_ROW_GRADIENT: {
    version: REQUIRED_RULE_ACCEPTANCE_POLICY_VERSION,
    metric: 'mean-squared-depth-error',
    // 深度比例均方误差 0.04 对应 RMSE 0.2，约为常见五排布局的一排偏差。
    maxNormalizedViolation: 0.04
  },
  ATTRIBUTE_GROUP_BALANCE: {
    version: REQUIRED_RULE_ACCEPTANCE_POLICY_VERSION,
    metric: 'mean-squared-range-error',
    // 以属性值域归一后的均方误差 0.01 对应 RMSE 10%；空大组仍严格拒绝。
    maxNormalizedViolation: 0.01
  }
} as const satisfies Record<string, RequiredRuleAcceptancePolicy>

export interface RuleAcceptanceInput {
  predicate: string
  priority: RulePriority
  not?: boolean
  evaluated?: boolean
  exactSatisfied: boolean
  normalizedViolation?: number | null
  hardViolation?: boolean
}

export interface RuleAcceptanceResult {
  policyVersion: typeof REQUIRED_RULE_ACCEPTANCE_POLICY_VERSION
  positiveSatisfied: boolean
  satisfied: boolean
  usedTolerance: boolean
  normalizedViolation: number | null
  maxNormalizedViolation: number | null
}

const acceptanceEpsilon = 1e-12

export const hasRequiredRuleAcceptancePolicy = (predicate: string) => (
  Object.prototype.hasOwnProperty.call(REQUIRED_RULE_ACCEPTANCE_POLICIES, predicate)
)

export const getRequiredRuleAcceptanceFailureCount = (
  priority: RulePriority,
  satisfied: boolean
) => priority === 'required' && !satisfied ? 1 : 0

export const compareAssignmentLexicographicScores = (
  requiredAcceptanceFailuresA: number,
  requiredScoreA: number,
  softScoreA: number,
  requiredAcceptanceFailuresB: number,
  requiredScoreB: number,
  softScoreB: number
) => {
  if (requiredAcceptanceFailuresA !== requiredAcceptanceFailuresB) {
    return requiredAcceptanceFailuresB - requiredAcceptanceFailuresA
  }
  if (requiredScoreA !== requiredScoreB) return requiredScoreA - requiredScoreB
  return softScoreA - softScoreB
}

export const evaluateRuleAcceptance = (input: RuleAcceptanceInput): RuleAcceptanceResult => {
  const policy = input.priority === 'required'
    ? REQUIRED_RULE_ACCEPTANCE_POLICIES[
        input.predicate as keyof typeof REQUIRED_RULE_ACCEPTANCE_POLICIES
      ]
    : undefined
  const normalizedViolation = typeof input.normalizedViolation === 'number' &&
    Number.isFinite(input.normalizedViolation)
    ? Math.max(0, input.normalizedViolation)
    : null

  if (input.evaluated === false) {
    return {
      policyVersion: REQUIRED_RULE_ACCEPTANCE_POLICY_VERSION,
      positiveSatisfied: true,
      satisfied: true,
      usedTolerance: false,
      normalizedViolation,
      maxNormalizedViolation: policy?.maxNormalizedViolation ?? null
    }
  }

  const withinTolerance = Boolean(
    policy &&
    normalizedViolation !== null &&
    !input.hardViolation &&
    normalizedViolation <= policy.maxNormalizedViolation + acceptanceEpsilon
  )
  const positiveSatisfied = !input.hardViolation && (input.exactSatisfied || withinTolerance)

  return {
    policyVersion: REQUIRED_RULE_ACCEPTANCE_POLICY_VERSION,
    positiveSatisfied,
    satisfied: input.not ? !positiveSatisfied : positiveSatisfied,
    usedTolerance: !input.exactSatisfied && withinTolerance,
    normalizedViolation,
    maxNormalizedViolation: policy?.maxNormalizedViolation ?? null
  }
}
