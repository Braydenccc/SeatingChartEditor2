export interface NumberInputOptions {
  min?: number
  max?: number
  precision?: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const normalizeNumberInput = (
  value: unknown,
  options: NumberInputOptions = {}
): number | null => {
  if (value === null || value === undefined || value === '') return null

  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return null

  const min = options.min ?? Number.NEGATIVE_INFINITY
  const max = options.max ?? Number.POSITIVE_INFINITY
  const limited = clamp(parsed, min, max)
  if (options.precision === undefined) return limited

  const factor = 10 ** Math.max(0, options.precision)
  return Math.round(limited * factor) / factor
}

export const normalizeRequiredNumberInput = (
  value: unknown,
  currentValue: number,
  options: NumberInputOptions = {}
): number => normalizeNumberInput(value, options) ?? currentValue
