import { ref } from 'vue'
import type {
  Rule,
  RuleEntityReference,
  RuleReferencedEntityType
} from '@/types/models'

export const rules = ref<Rule[]>([])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const matchesEntityId = (
  value: unknown,
  entityId: number | string
): boolean => value === entityId

const collectReferenceLocations = (
  value: unknown,
  entityType: RuleReferencedEntityType,
  entityId: number | string,
  path: string,
  locations: Set<string>,
  visited: WeakSet<object>
): void => {
  if (!value || typeof value !== 'object') return
  if (visited.has(value)) return
  visited.add(value)

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectReferenceLocations(entry, entityType, entityId, `${path}[${index}]`, locations, visited)
    })
    return
  }

  const record = value as Record<string, unknown>

  if (
    (entityType === 'student' && record.type === 'person' && matchesEntityId(record.id, entityId)) ||
    (entityType === 'tag' && record.type === 'tag' && matchesEntityId(record.id, entityId))
  ) {
    locations.add(path)
  }

  if (entityType === 'student') {
    const legacyKeys = record.kind === 'pair' ? ['id1', 'id2'] : ['id']
    if (record.kind === 'student' || record.kind === 'pair') {
      legacyKeys.forEach(key => {
        if (matchesEntityId(record[key], entityId)) locations.add(`${path}.${key}`)
      })
    }
    for (const key of ['studentId', 'personId']) {
      if (matchesEntityId(record[key], entityId)) locations.add(`${path}.${key}`)
    }
  }

  if (entityType === 'tag') {
    const legacyKeys = record.kind === 'tag_pair' ? ['tagId1', 'tagId2'] : ['tagId']
    if (record.kind === 'tag' || record.kind === 'tag_pair') {
      legacyKeys.forEach(key => {
        if (matchesEntityId(record[key], entityId)) locations.add(`${path}.${key}`)
      })
    }
    if (matchesEntityId(record.tagId, entityId)) locations.add(`${path}.tagId`)
  }

  if (entityType === 'zone' && matchesEntityId(record.zoneId, entityId)) {
    locations.add(`${path}.zoneId`)
  }

  if (entityType === 'numericAttribute' && matchesEntityId(record.attributeId, entityId)) {
    locations.add(`${path}.attributeId`)
  }

  Object.entries(record).forEach(([key, entry]) => {
    if (isRecord(entry) || Array.isArray(entry)) {
      collectReferenceLocations(entry, entityType, entityId, `${path}.${key}`, locations, visited)
    }
  })
}

export const getRuleReferences = (
  entityType: RuleReferencedEntityType,
  entityId: number | string
): RuleEntityReference[] => {
  const references: RuleEntityReference[] = []

  rules.value.forEach(rule => {
    const locations = new Set<string>()
    collectReferenceLocations(rule, entityType, entityId, '$', locations, new WeakSet())
    if (locations.size === 0) return

    references.push({
      entityType,
      entityId,
      ruleId: rule.id,
      ruleDescription: String(rule.description || '').trim(),
      predicate: String(rule.predicate || ''),
      locations: [...locations].sort()
    })
  })

  return references
}
