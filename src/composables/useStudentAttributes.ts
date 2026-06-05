import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { NumericAttributeDefinition } from '@/types'
import { useStudentData } from './useStudentData'

const defaultAttributeDefinitions: NumericAttributeDefinition[] = [
  {
    id: 'height',
    name: '身高',
    unit: 'cm',
    min: 80,
    max: 220,
    precision: 0,
    enabled: true,
    showInEditor: true,
    builtInKey: 'height',
    createdFrom: 'default'
  },
  {
    id: 'score',
    name: '成绩',
    unit: '分',
    min: 0,
    max: 150,
    precision: 1,
    enabled: true,
    showInEditor: true,
    builtInKey: 'score',
    createdFrom: 'default'
  }
]

const attributeDefinitions = ref<NumericAttributeDefinition[]>(
  defaultAttributeDefinitions.map(def => ({ ...def }))
)
const showNumericAttributesInEditor = ref(true)
let nextAttributeId = 1

const createDefaultDefinitions = (): NumericAttributeDefinition[] =>
  defaultAttributeDefinitions.map(def => ({ ...def }))

const enabledAttributeDefinitions = computed(() =>
  attributeDefinitions.value.filter(def => def.enabled !== false)
)

const parseOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeDefinition = (
  definition: Partial<NumericAttributeDefinition>,
  fallbackId?: string
): NumericAttributeDefinition | null => {
  const id = String(definition.id || fallbackId || '').trim()
  const name = String(definition.name || '').trim()
  if (!id || !name) return null

  const precision = Number(definition.precision ?? 0)
  return {
    id,
    name,
    unit: String(definition.unit || '').trim(),
    min: parseOptionalNumber(definition.min),
    max: parseOptionalNumber(definition.max),
    precision: Number.isFinite(precision) ? Math.max(0, Math.floor(precision)) : 0,
    enabled: definition.enabled !== false,
    showInEditor: definition.showInEditor !== false,
    builtInKey: definition.builtInKey,
    createdFrom: definition.createdFrom || 'manual'
  }
}

const createAttributeId = (): string => `attr-${Date.now()}-${nextAttributeId++}`

const attributePrefixPattern = /^(数值属性|标签数值|数值|属性|numeric|attribute|number|value)(?:\s*[:：_\-－—–/／]\s*|\s+)(.+)$/i

const normalizeFullWidth = (value: string): string =>
  value.replace(/[０-９Ａ-Ｚａ-ｚ]/g, char =>
    String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
  )

const normalizeHeader = (value: unknown): string => {
  return String(value || '')
    .trim()
    .replace(/[　]/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[：:]/g, ':')
    .replace(/[（）()\[\]【】]/g, '')
    .replace(/[\/／_\-－—–]/g, '')
    .toLowerCase()
}

const getExplicitAttributeLookup = (header: unknown): string | null => {
  const raw = normalizeFullWidth(String(header || '').trim())
  const matched = raw.match(attributePrefixPattern)
  if (!matched) return null
  return normalizeHeader(matched[2])
}

const parseAttributeHeaderLabel = (header: unknown): { name: string; unit: string } => {
  const rawHeader = normalizeFullWidth(String(header || ''))
  const rawName = rawHeader
    .replace(attributePrefixPattern, '$2')
    .trim()
  const unitMatch = rawName.match(/^(.+?)[（(]([^（）()]+)[）)]$/)
  if (unitMatch) {
    return {
      name: unitMatch[1].trim(),
      unit: unitMatch[2].trim()
    }
  }
  const bracketUnitMatch = rawName.match(/^(.+?)[\[【]([^\]】]+)[\]】]$/)
  if (bracketUnitMatch) {
    return {
      name: bracketUnitMatch[1].trim(),
      unit: bracketUnitMatch[2].trim()
    }
  }
  const slashUnitMatch = rawName.match(/^(.+?)[/／]([^/／]+)$/)
  if (slashUnitMatch) {
    return {
      name: slashUnitMatch[1].trim(),
      unit: slashUnitMatch[2].trim()
    }
  }
  return {
    name: rawName,
    unit: ''
  }
}

const headerAliases: Record<string, string[]> = {
  height: ['身高', '身高cm', '身高厘米', 'height', 'heightcm'],
  score: ['成绩', '分数', '总分', '得分', '评分', '考试成绩', '测试成绩', '平均分', 'score']
}

export function useStudentAttributes(): {
  attributeDefinitions: Ref<NumericAttributeDefinition[]>
  enabledAttributeDefinitions: ComputedRef<NumericAttributeDefinition[]>
  showNumericAttributesInEditor: Ref<boolean>
  addAttribute: (definition?: Partial<NumericAttributeDefinition>) => string
  updateAttribute: (attributeId: string, updates: Partial<NumericAttributeDefinition>) => boolean
  deleteAttribute: (attributeId: string) => boolean
  clearAttributeDefinitions: () => void
  replaceAttributeDefinitions: (
    definitions?: Partial<NumericAttributeDefinition>[],
    options?: { useDefaultsWhenEmpty?: boolean }
  ) => void
  setShowNumericAttributesInEditor: (show: boolean) => void
  getAttributeById: (attributeId?: string | null) => NumericAttributeDefinition | undefined
  getAttributeOptions: () => { id: string; label: string }[]
  parseNumericValue: (value: unknown, definition?: NumericAttributeDefinition | null) => number | null
  formatNumericValue: (value: number | null | undefined, attributeId?: string | null) => string
  findAttributeByHeader: (header: unknown) => NumericAttributeDefinition | null
  ensureAttributeForHeader: (
    header: unknown,
    options?: { allowImplicit?: boolean }
  ) => NumericAttributeDefinition | null
  getMissingValueSummary: () => { missingCount: number; totalSlots: number }
} {
  const { students, updateStudent } = useStudentData()

  const getAttributeById = (attributeId?: string | null) => {
    if (!attributeId) return undefined
    return attributeDefinitions.value.find(def => def.id === attributeId)
  }

  const parseNumericValue = (
    value: unknown,
    definition?: NumericAttributeDefinition | null
  ): number | null => {
    if (value === null || value === undefined || value === '') return null
    let normalized = value
    if (typeof value === 'string') {
      const text = normalizeFullWidth(value)
        .trim()
        .replace(/\s+/g, '')
        .replace(/，/g, ',')
      if (!text) return null
      const compactNumber = /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?%?$/.test(text)
        ? text.replace(/,/g, '')
        : text.replace(',', '.')
      const matched = compactNumber.match(/[-+]?\d+(?:\.\d+)?/)
      normalized = matched ? matched[0] : compactNumber
    }
    const numberValue = typeof normalized === 'number' ? normalized : Number(normalized)
    if (!Number.isFinite(numberValue)) return null
    if (definition?.min !== null && definition?.min !== undefined && numberValue < definition.min) return null
    if (definition?.max !== null && definition?.max !== undefined && numberValue > definition.max) return null
    return numberValue
  }

  const addAttribute = (definition: Partial<NumericAttributeDefinition> = {}) => {
    const id = definition.id || createAttributeId()
    const normalized = normalizeDefinition({ ...definition, id }, id)
    if (!normalized) return ''
    if (attributeDefinitions.value.some(def => def.id === normalized.id)) return normalized.id
    attributeDefinitions.value.push(normalized)
    return normalized.id
  }

  const updateAttribute = (attributeId: string, updates: Partial<NumericAttributeDefinition>) => {
    const index = attributeDefinitions.value.findIndex(def => def.id === attributeId)
    if (index === -1) return false
    const normalized = normalizeDefinition({
      ...attributeDefinitions.value[index],
      ...updates,
      id: attributeId
    }, attributeId)
    if (!normalized) return false
    attributeDefinitions.value[index] = normalized
    return true
  }

  const deleteAttribute = (attributeId: string) => {
    const index = attributeDefinitions.value.findIndex(def => def.id === attributeId)
    if (index === -1) return false
    attributeDefinitions.value.splice(index, 1)
    students.value.forEach(student => {
      const nextAttributes = { ...(student.numericAttributes || {}) }
      delete nextAttributes[attributeId]
      updateStudent(student.id, { numericAttributes: nextAttributes })
    })
    return true
  }

  const clearAttributeDefinitions = () => {
    attributeDefinitions.value = []
    nextAttributeId = 1
  }

  const replaceAttributeDefinitions = (
    definitions: Partial<NumericAttributeDefinition>[] = [],
    options: { useDefaultsWhenEmpty?: boolean } = { useDefaultsWhenEmpty: true }
  ) => {
    const seen = new Set<string>()
    const normalized = definitions
      .map(def => normalizeDefinition(def))
      .filter((def): def is NumericAttributeDefinition => {
        if (!def || seen.has(def.id)) return false
        seen.add(def.id)
        return true
      })
    attributeDefinitions.value = normalized.length > 0
      ? normalized
      : (options.useDefaultsWhenEmpty === false ? [] : createDefaultDefinitions())
  }

  const setShowNumericAttributesInEditor = (show: boolean) => {
    showNumericAttributesInEditor.value = show
  }

  const getAttributeOptions = () =>
    enabledAttributeDefinitions.value.map(def => ({
      id: def.id,
      label: def.unit ? `${def.name}（${def.unit}）` : def.name
    }))

  const formatNumericValue = (value: number | null | undefined, attributeId?: string | null) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return ''
    const definition = getAttributeById(attributeId)
    const precision = definition?.precision ?? 0
    const formatted = Number(value).toFixed(precision)
    return definition?.unit ? `${formatted}${definition.unit}` : formatted
  }

  const findAttributeByHeader = (header: unknown): NumericAttributeDefinition | null => {
    const normalized = normalizeHeader(header)
    if (!normalized) return null
    const explicitLookup = getExplicitAttributeLookup(header)
    const lookup = explicitLookup || normalized

    const byIdOrName = attributeDefinitions.value.find(def => {
      const defName = normalizeHeader(def.name)
      const defId = normalizeHeader(def.id)
      const defNameWithUnit = normalizeHeader(`${def.name}${def.unit || ''}`)
      return defName === lookup || defId === lookup || defNameWithUnit === lookup
    })
    if (byIdOrName) return byIdOrName

    for (const def of attributeDefinitions.value) {
      if (!def.builtInKey) continue
      const aliases = headerAliases[def.builtInKey] || []
      if (aliases.some(alias => normalizeHeader(alias) === lookup)) return def
    }

    return null
  }

  const ensureAttributeForHeader = (
    header: unknown,
    options: { allowImplicit?: boolean } = {}
  ): NumericAttributeDefinition | null => {
    const existing = findAttributeByHeader(header)
    if (existing) return existing

    const explicitLookup = getExplicitAttributeLookup(header)
    if (!explicitLookup && !options.allowImplicit) return null

    const { name, unit } = parseAttributeHeaderLabel(header)
    if (!name) return null
    const id = addAttribute({
      name,
      unit,
      min: null,
      max: null,
      precision: 1,
      enabled: true,
      createdFrom: 'excel'
    })
    return getAttributeById(id) || null
  }

  const getMissingValueSummary = () => {
    const enabled = enabledAttributeDefinitions.value
    let totalSlots = 0
    let missingCount = 0
    for (const student of students.value) {
      for (const definition of enabled) {
        totalSlots += 1
        const value = student.numericAttributes?.[definition.id]
        if (value === null || value === undefined) missingCount += 1
      }
    }
    return { missingCount, totalSlots }
  }

  return {
    attributeDefinitions,
    enabledAttributeDefinitions,
    showNumericAttributesInEditor,
    addAttribute,
    updateAttribute,
    deleteAttribute,
    clearAttributeDefinitions,
    replaceAttributeDefinitions,
    setShowNumericAttributesInEditor,
    getAttributeById,
    getAttributeOptions,
    parseNumericValue,
    formatNumericValue,
    findAttributeByHeader,
    ensureAttributeForHeader,
    getMissingValueSummary
  }
}
