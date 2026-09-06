import { describe, expect, it } from 'vitest'
import {
  compareAssignmentLexicographicScores,
  evaluateRuleAcceptance,
  getRequiredRuleAcceptanceFailureCount,
  REQUIRED_RULE_ACCEPTANCE_POLICIES,
  REQUIRED_RULE_ACCEPTANCE_POLICY_VERSION
} from '../assignmentRuleAcceptance'

describe('assignmentRuleAcceptance', () => {
  it.each([
    ['DISTRIBUTE_EVENLY', 0.1],
    ['ATTRIBUTE_ROW_GRADIENT', 0.04],
    ['ATTRIBUTE_GROUP_BALANCE', 0.01]
  ] as const)('accepts %s at its versioned boundary and rejects values above it', (predicate, threshold) => {
    expect(REQUIRED_RULE_ACCEPTANCE_POLICIES[predicate]).toMatchObject({
      version: REQUIRED_RULE_ACCEPTANCE_POLICY_VERSION,
      maxNormalizedViolation: threshold
    })

    const atBoundary = evaluateRuleAcceptance({
      predicate,
      priority: 'required',
      exactSatisfied: false,
      normalizedViolation: threshold
    })
    const aboveBoundary = evaluateRuleAcceptance({
      predicate,
      priority: 'required',
      exactSatisfied: false,
      normalizedViolation: threshold + 0.000001
    })

    expect(atBoundary.satisfied).toBe(true)
    expect(atBoundary.usedTolerance).toBe(true)
    expect(aboveBoundary.satisfied).toBe(false)
    expect(aboveBoundary.usedTolerance).toBe(false)
  })

  it.each([
    'IN_ROW_RANGE',
    'CLUSTER_TOGETHER',
    'ATTRIBUTE_PAIR_DELTA',
    'ATTRIBUTE_DISTRIBUTE_BANDS'
  ])('keeps discrete required predicate %s strict even if a normalized value is supplied', predicate => {
    const result = evaluateRuleAcceptance({
      predicate,
      priority: 'required',
      exactSatisfied: false,
      normalizedViolation: 0
    })

    expect(result.satisfied).toBe(false)
    expect(result.maxNormalizedViolation).toBeNull()
  })

  it('does not apply required tolerances to prefer rules', () => {
    const result = evaluateRuleAcceptance({
      predicate: 'ATTRIBUTE_ROW_GRADIENT',
      priority: 'prefer',
      exactSatisfied: false,
      normalizedViolation: 0
    })

    expect(result.satisfied).toBe(false)
    expect(result.usedTolerance).toBe(false)
  })

  it('does not allow a hard invariant violation through a continuous tolerance', () => {
    const result = evaluateRuleAcceptance({
      predicate: 'DISTRIBUTE_EVENLY',
      priority: 'required',
      exactSatisfied: true,
      normalizedViolation: 0.01,
      hardViolation: true
    })

    expect(result.positiveSatisfied).toBe(false)
    expect(result.satisfied).toBe(false)
  })

  it('applies negation after a hard invariant overrides exact satisfaction', () => {
    const result = evaluateRuleAcceptance({
      predicate: 'ATTRIBUTE_GROUP_BALANCE',
      priority: 'required',
      not: true,
      exactSatisfied: true,
      normalizedViolation: 0,
      hardViolation: true
    })

    expect(result.positiveSatisfied).toBe(false)
    expect(result.satisfied).toBe(true)
  })

  it('prefers a required-acceptable layout over a higher raw score that cannot be committed', () => {
    const acceptablePenalty = 1.552622
    const rejectedPenalty = 1.459404

    expect(compareAssignmentLexicographicScores(
      0,
      -acceptablePenalty,
      0,
      1,
      -rejectedPenalty,
      0
    )).toBeGreaterThan(0)
  })

  it('counts failed discrete required rules in the lexicographic acceptance key', () => {
    expect(getRequiredRuleAcceptanceFailureCount('required', false)).toBe(1)
    expect(getRequiredRuleAcceptanceFailureCount('required', true)).toBe(0)
    expect(getRequiredRuleAcceptanceFailureCount('prefer', false)).toBe(0)
    expect(getRequiredRuleAcceptanceFailureCount('optional', false)).toBe(0)
  })

  it('inverts evaluated continuous rules after applying the same tolerance', () => {
    const insideTolerance = evaluateRuleAcceptance({
      predicate: 'ATTRIBUTE_GROUP_BALANCE',
      priority: 'required',
      not: true,
      exactSatisfied: false,
      normalizedViolation: 0.005
    })
    const outsideTolerance = evaluateRuleAcceptance({
      predicate: 'ATTRIBUTE_GROUP_BALANCE',
      priority: 'required',
      not: true,
      exactSatisfied: false,
      normalizedViolation: 0.02
    })

    expect(insideTolerance.satisfied).toBe(false)
    expect(outsideTolerance.satisfied).toBe(true)
  })

  it('keeps unevaluated rules non-blocking, including negated legacy rules', () => {
    const result = evaluateRuleAcceptance({
      predicate: 'ATTRIBUTE_ROW_GRADIENT',
      priority: 'required',
      not: true,
      evaluated: false,
      exactSatisfied: true
    })

    expect(result.satisfied).toBe(true)
    expect(result.usedTolerance).toBe(false)
  })
})
