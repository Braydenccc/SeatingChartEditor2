import { describe, expect, it } from 'vitest'
import {
  hasRepresentableNumberInputRange,
  normalizeNumberInput,
  normalizeRequiredNumberInput
} from '../inputNormalization'

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

  it('rounds on the precision grid before clamping to non-aligned bounds', () => {
    expect(normalizeNumberInput(1.25, { max: 1.25, precision: 1 })).toBe(1.2)
    expect(normalizeNumberInput(1.25, { min: 1.25, precision: 1 })).toBe(1.3)
    expect(normalizeNumberInput(0.29, { min: 0.29, max: 0.29, precision: 2 })).toBe(0.29)
  })

  it('rejects precision ranges without a representable value', () => {
    const options = { min: 1.21, max: 1.25, precision: 1 }

    expect(hasRepresentableNumberInputRange(options)).toBe(false)
    expect(normalizeNumberInput(1.23, options)).toBeNull()
  })

  it('handles high-magnitude precision ticks only inside the safe integer domain', () => {
    const reliableValue = 900000.0000000001
    const reliableOptions = { min: reliableValue, max: reliableValue, precision: 10 }
    const unsafeOptions = { min: 1000000, max: 1000000, precision: 10 }

    expect(hasRepresentableNumberInputRange(reliableOptions)).toBe(true)
    expect(normalizeNumberInput(reliableValue, reliableOptions)).toBe(reliableValue)
    expect(hasRepresentableNumberInputRange(unsafeOptions)).toBe(false)
    expect(normalizeNumberInput(1000000, unsafeOptions)).toBeNull()
  })

  it('clamps extreme raw ticks before validating the final safe tick', () => {
    expect(normalizeNumberInput(1e20, { max: 150, precision: 0 })).toBe(150)
    expect(normalizeNumberInput(-1e20, { min: 80, precision: 0 })).toBe(80)
  })

  it('keeps the current required value when the input is empty or invalid', () => {
    expect(normalizeRequiredNumberInput(null, 24, { min: 1 })).toBe(24)
    expect(normalizeRequiredNumberInput('invalid', 24, { min: 1 })).toBe(24)
    expect(normalizeRequiredNumberInput('8', 24, { min: 10 })).toBe(10)
  })
})
