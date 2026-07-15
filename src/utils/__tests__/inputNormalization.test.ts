import { describe, expect, it } from 'vitest'
import { normalizeNumberInput, normalizeRequiredNumberInput } from '../inputNormalization'

describe('inputNormalization', () => {
  it('normalizes number-like values at the UI boundary', () => {
    expect(normalizeNumberInput('12.345', { precision: 2 })).toBe(12.35)
    expect(normalizeNumberInput(12, { min: 20, max: 30 })).toBe(20)
    expect(normalizeNumberInput(40, { min: 20, max: 30 })).toBe(30)
  })

  it('maps empty and invalid values to null', () => {
    expect(normalizeNumberInput(null)).toBeNull()
    expect(normalizeNumberInput('')).toBeNull()
    expect(normalizeNumberInput('not-a-number')).toBeNull()
    expect(normalizeNumberInput(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('keeps the current required value when the input is empty or invalid', () => {
    expect(normalizeRequiredNumberInput(null, 24, { min: 1 })).toBe(24)
    expect(normalizeRequiredNumberInput('invalid', 24, { min: 1 })).toBe(24)
    expect(normalizeRequiredNumberInput('8', 24, { min: 10 })).toBe(10)
  })
})
