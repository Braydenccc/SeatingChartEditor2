export interface NumberInputOptions {
  min?: number
  max?: number
  precision?: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

interface NumberInputGrid {
  factor: number
  precision: number
  minTick: bigint
  maxTick: bigint
}

type TickRoundingMode = 'floor' | 'ceil' | 'round'

const maxSafeTick = BigInt(Number.MAX_SAFE_INTEGER)
const minSafeTick = -maxSafeTick
const maxSupportedPrecision = 100

const hasValidBounds = (min: number, max: number) => (
  !Number.isNaN(min) &&
  !Number.isNaN(max) &&
  min !== Number.POSITIVE_INFINITY &&
  max !== Number.NEGATIVE_INFINITY &&
  min <= max
)

const getNormalizedPrecision = (value: number) => {
  if (!Number.isFinite(value)) return null
  const precision = Math.max(0, Math.floor(value))
  return precision <= maxSupportedPrecision ? precision : null
}

const toScaledFraction = (value: number, precision: number) => {
  const match = value.toString().match(/^([+-]?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i)
  if (!match) return null

  const sign = match[1] === '-' ? -1n : 1n
  const fractionDigits = match[3] || ''
  const digits = `${match[2]}${fractionDigits}`.replace(/^0+(?=\d)/, '')
  const exponent = Number(match[4] || 0) - fractionDigits.length + precision
  let numerator = sign * BigInt(digits)
  let denominator = 1n
  if (exponent >= 0) {
    numerator *= 10n ** BigInt(exponent)
  } else {
    denominator = 10n ** BigInt(-exponent)
  }
  return { numerator, denominator }
}

const toScaledTick = (
  value: number,
  precision: number,
  mode: TickRoundingMode
): bigint | null => {
  const fraction = toScaledFraction(value, precision)
  if (!fraction) return null
  const { numerator, denominator } = fraction
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  const floorTick = remainder < 0n ? quotient - 1n : quotient

  if (mode === 'floor') return floorTick
  if (mode === 'ceil') return remainder > 0n ? quotient + 1n : quotient

  const positiveRemainder = numerator - floorTick * denominator
  return positiveRemainder * 2n < denominator ? floorTick : floorTick + 1n
}

const clampTick = (value: bigint, min: bigint, max: bigint) => (
  value < min ? min : value > max ? max : value
)

const getNumberInputGrid = (options: NumberInputOptions): NumberInputGrid | null => {
  const min = options.min ?? Number.NEGATIVE_INFINITY
  const max = options.max ?? Number.POSITIVE_INFINITY
  if (!hasValidBounds(min, max)) return null

  const precision = getNormalizedPrecision(options.precision ?? 0)
  if (precision === null) return null
  const factor = 10 ** precision
  if (!Number.isFinite(factor)) return null

  const rawMinTick = Number.isFinite(min) ? toScaledTick(min, precision, 'ceil') : minSafeTick
  const rawMaxTick = Number.isFinite(max) ? toScaledTick(max, precision, 'floor') : maxSafeTick
  if (rawMinTick === null || rawMaxTick === null) return null
  const minTick = rawMinTick < minSafeTick ? minSafeTick : rawMinTick
  const maxTick = rawMaxTick > maxSafeTick ? maxSafeTick : rawMaxTick

  if (minTick > maxTick) return null
  return { factor, precision, minTick, maxTick }
}

export const hasRepresentableNumberInputRange = (options: NumberInputOptions = {}) => {
  if (options.precision === undefined) {
    return hasValidBounds(
      options.min ?? Number.NEGATIVE_INFINITY,
      options.max ?? Number.POSITIVE_INFINITY
    )
  }
  return getNumberInputGrid(options) !== null
}

export const normalizeNumberInput = (
  value: unknown,
  options: NumberInputOptions = {}
): number | null => {
  if (value === null || value === undefined || value === '') return null

  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return null

  const min = options.min ?? Number.NEGATIVE_INFINITY
  const max = options.max ?? Number.POSITIVE_INFINITY
  if (!hasValidBounds(min, max)) return null
  if (options.precision === undefined) return clamp(parsed, min, max)

  const grid = getNumberInputGrid(options)
  if (!grid) return null
  const roundedTick = toScaledTick(parsed, grid.precision, 'round')
  if (roundedTick === null) return null
  const limitedTick = clampTick(roundedTick, grid.minTick, grid.maxTick)
  if (limitedTick < minSafeTick || limitedTick > maxSafeTick) return null
  const normalized = Number(limitedTick) / grid.factor
  if (!Number.isFinite(normalized) || normalized < min || normalized > max) return null
  return Number(normalized.toFixed(grid.precision)) === normalized ? normalized : null
}

export const normalizeRequiredNumberInput = (
  value: unknown,
  currentValue: number,
  options: NumberInputOptions = {}
): number => normalizeNumberInput(value, options) ?? currentValue
