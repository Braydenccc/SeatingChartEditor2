import { WORKSPACE_SCHEMA_VERSION, type Workspace } from '@/types/models'
import { MAX_WORKSPACE_GROUPS, MAX_WORKSPACE_SEATS } from '@/constants/workspaceLimits'
import { PREDICATE_META } from '@/constants/ruleTypes'
import { generateGuardSeatId, generateSeatId } from '@/utils/seatHelpers'
import { hasRepresentableNumberInputRange, normalizeNumberInput } from '@/utils/inputNormalization'

const MAX_STUDENTS = 5000
const MAX_TAGS = 500
const MAX_STUDENT_ATTRIBUTES = 500
export { MAX_WORKSPACE_GROUPS, MAX_WORKSPACE_SEATS } from '@/constants/workspaceLimits'
const MAX_ZONES = 1000
const MAX_ROTATION_GROUPS = 1000
const MAX_ROTATION_ZONES = 5000
const MAX_RULES = 5000

type JsonRecord = Record<string, unknown>

export type WorkspaceValidationResult =
  | { valid: true; data: Workspace; errors: [] }
  | { valid: false; data: null; errors: string[] }

const isRecord = (value: unknown): value is JsonRecord => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

const isIdentifier = (value: unknown) => (
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && value.trim().length > 0)
)

const isNonNegativeInteger = (value: unknown) => (
  Number.isInteger(value) && Number(value) >= 0
)

const isPositiveInteger = (value: unknown) => (
  Number.isInteger(value) && Number(value) > 0
)

const parseVersion = (value: unknown): number[] | null => {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+){1,2}$/.test(value)) return null
  return value.split('.').map(part => Number(part))
}

const compareVersions = (left: number[], right: number[]) => {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

const hasValidDecimalPrecision = (value: number, precision: number) => {
  return Number(value.toFixed(precision)) === value
}

export const getWorkspaceVersionError = (value: unknown): string | null => {
  const parsed = parseVersion(value)
  if (!parsed) return '工作区版本格式无效'
  const current = parseVersion(WORKSPACE_SCHEMA_VERSION)
  if (!current || compareVersions(parsed, current) > 0) {
    return `工作区版本 ${String(value)} 高于当前支持的 ${WORKSPACE_SCHEMA_VERSION}`
  }
  return null
}

const validateArrayLimit = (
  value: unknown,
  path: string,
  max: number,
  errors: string[]
): value is unknown[] => {
  if (!Array.isArray(value)) {
    errors.push(`${path} 必须是数组`)
    return false
  }
  if (value.length > max) {
    errors.push(`${path} 数量不能超过 ${max}`)
    return false
  }
  return true
}

const validateUniqueIds = (items: unknown[], path: string, errors: string[]) => {
  const ids = new Set<string>()
  items.forEach((item, index) => {
    if (!isRecord(item) || !isIdentifier(item.id)) return
    const key = String(item.id)
    if (ids.has(key)) {
      errors.push(`${path}[${index}].id 与其他条目重复`)
    }
    ids.add(key)
  })
}

interface RuleReferenceSets {
  studentIds: Set<string>
  tagIds: Set<string>
  zoneIds: Set<string>
  attributeIds: Set<string>
}

const validateRuleSubject = (
  value: unknown,
  path: string,
  references: RuleReferenceSets,
  errors: string[]
) => {
  if (!isRecord(value)) {
    errors.push(`${path} 必须是对象`)
    return null
  }
  if (value.type === 'all') {
    if (value.id !== null && value.id !== undefined) errors.push(`${path}.id 在全体对象中必须为空`)
    return 'all:null'
  }
  if (value.type !== 'person' && value.type !== 'tag') {
    errors.push(`${path}.type 必须是 person、tag 或 all`)
    return null
  }
  if (!isIdentifier(value.id)) {
    errors.push(`${path}.id 无效`)
    return null
  }

  const id = String(value.id)
  const targetIds = value.type === 'person' ? references.studentIds : references.tagIds
  if (!targetIds.has(id)) {
    errors.push(`${path}.id 引用了不存在的${value.type === 'person' ? '学生' : '标签'} ${id}`)
  }
  return `${value.type}:${id}`
}

const validateRuleSubjectArray = (
  value: unknown,
  path: string,
  references: RuleReferenceSets,
  errors: string[]
) => {
  if (!Array.isArray(value)) {
    errors.push(`${path} 必须是数组`)
    return []
  }
  return value
    .map((subject, index) => validateRuleSubject(subject, `${path}[${index}]`, references, errors))
    .filter((key): key is string => key !== null)
}

const validateLegacyRuleSubject = (
  value: unknown,
  path: string,
  references: RuleReferenceSets,
  errors: string[]
) => {
  if (!isRecord(value)) {
    errors.push(`${path} 必须是对象`)
    return []
  }

  const validateLegacyId = (candidate: unknown, type: 'person' | 'tag', field: string) => {
    if (!isIdentifier(candidate)) {
      errors.push(`${path}.${field} 无效`)
      return null
    }
    const id = String(candidate)
    const targetIds = type === 'person' ? references.studentIds : references.tagIds
    if (!targetIds.has(id)) {
      errors.push(`${path}.${field} 引用了不存在的${type === 'person' ? '学生' : '标签'} ${id}`)
    }
    return `${type}:${id}`
  }

  if (value.kind === 'student') return [validateLegacyId(value.id, 'person', 'id')].filter((key): key is string => key !== null)
  if (value.kind === 'tag') return [validateLegacyId(value.tagId, 'tag', 'tagId')].filter((key): key is string => key !== null)
  if (value.kind === 'pair') {
    return [
      validateLegacyId(value.id1, 'person', 'id1'),
      validateLegacyId(value.id2, 'person', 'id2')
    ].filter((key): key is string => key !== null)
  }
  if (value.kind === 'tag_pair') {
    return [
      validateLegacyId(value.tagId1, 'tag', 'tagId1'),
      validateLegacyId(value.tagId2, 'tag', 'tagId2')
    ].filter((key): key is string => key !== null)
  }
  errors.push(`${path}.kind 无效`)
  return []
}

const validateRuleParams = (
  value: unknown,
  predicate: string,
  path: string,
  references: RuleReferenceSets,
  errors: string[]
) => {
  if (!isRecord(value)) {
    errors.push(`${path} 必须是对象`)
    return
  }

  const meta = PREDICATE_META[predicate]
  if (!meta) return
  meta.params.forEach(param => {
    const paramPath = `${path}.${param.key}`
    const candidate = value[param.key]
    if (candidate === null || candidate === undefined || candidate === '') {
      errors.push(`${paramPath} 不能为空`)
      return
    }
    if (param.type === 'number') {
      if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
        errors.push(`${paramPath} 必须是数字`)
      } else if (param.min !== undefined && candidate < param.min) {
        errors.push(`${paramPath} 不能小于 ${param.min}`)
      }
    }
    if (param.type === 'select' && param.options && !param.options.some(option => option.value === candidate)) {
      errors.push(`${paramPath} 不是有效选项`)
    }
    if (param.type === 'zone') {
      if (!isIdentifier(candidate)) {
        errors.push(`${paramPath} 必须是有效选区 ID`)
      } else if (!references.zoneIds.has(String(candidate))) {
        errors.push(`${paramPath} 引用了不存在的选区 ${String(candidate)}`)
      }
    }
    if (param.type === 'attribute') {
      if (typeof candidate !== 'string' || !references.attributeIds.has(candidate)) {
        errors.push(`${paramPath} 引用了不存在的数值属性 ${String(candidate)}`)
      }
    }
  })

  if (value.tagId !== undefined && value.tagId !== null) {
    if (!isIdentifier(value.tagId) || !references.tagIds.has(String(value.tagId))) {
      errors.push(`${path}.tagId 引用了不存在的标签 ${String(value.tagId)}`)
    }
  }
  if (value.zoneId !== undefined && value.zoneId !== null) {
    if (!isIdentifier(value.zoneId) || !references.zoneIds.has(String(value.zoneId))) {
      errors.push(`${path}.zoneId 引用了不存在的选区 ${String(value.zoneId)}`)
    }
  }
  if (predicate === 'IN_ROW_RANGE' && typeof value.minRow === 'number' && typeof value.maxRow === 'number' && value.minRow > value.maxRow) {
    errors.push(`${path}.minRow 不能大于 maxRow`)
  }
  if (predicate === 'IN_GROUP_RANGE' && typeof value.minGroup === 'number' && typeof value.maxGroup === 'number' && value.minGroup > value.maxGroup) {
    errors.push(`${path}.minGroup 不能大于 maxGroup`)
  }
}

const validateRules = (workspace: JsonRecord, errors: string[]) => {
  if (!validateArrayLimit(workspace.rules, 'rules', MAX_RULES, errors)) return

  const references: RuleReferenceSets = {
    studentIds: new Set(Array.isArray(workspace.students)
      ? workspace.students.filter(isRecord).filter(student => isIdentifier(student.id)).map(student => String(student.id))
      : []),
    tagIds: new Set(Array.isArray(workspace.tags)
      ? workspace.tags.filter(isRecord).filter(tag => isIdentifier(tag.id)).map(tag => String(tag.id))
      : []),
    zoneIds: new Set(Array.isArray(workspace.zones)
      ? workspace.zones.filter(isRecord).filter(zone => isIdentifier(zone.id)).map(zone => String(zone.id))
      : []),
    attributeIds: new Set(Array.isArray(workspace.studentAttributeDefinitions)
      ? workspace.studentAttributeDefinitions
        .filter(isRecord)
        .filter(definition => typeof definition.id === 'string')
        .map(definition => String(definition.id))
      : [])
  }

  workspace.rules.forEach((rule, index) => {
    const path = `rules[${index}]`
    if (!isRecord(rule)) {
      errors.push(`${path} 必须是对象`)
      return
    }
    if (typeof rule.predicate !== 'string' || !PREDICATE_META[rule.predicate]) {
      errors.push(`${path}.predicate 不是受支持的规则类型`)
      return
    }
    if (rule.priority !== undefined && !['required', 'prefer', 'optional'].includes(String(rule.priority))) {
      errors.push(`${path}.priority 无效`)
    }
    if (rule.enabled !== undefined && typeof rule.enabled !== 'boolean') errors.push(`${path}.enabled 必须是布尔值`)
    if (rule.not !== undefined && typeof rule.not !== 'boolean') errors.push(`${path}.not 必须是布尔值`)
    if (rule.logicOperator !== undefined && rule.logicOperator !== null && rule.logicOperator !== 'AND' && rule.logicOperator !== 'OR') {
      errors.push(`${path}.logicOperator 必须是 AND、OR 或 null`)
    }

    let subjectKeys: string[] = []
    if (Array.isArray(rule.subjects)) {
      subjectKeys = validateRuleSubjectArray(rule.subjects, `${path}.subjects`, references, errors)
    } else if (rule.subjectMode === 'single' || rule.subjectMode === 'dual') {
      subjectKeys = [
        ...validateRuleSubjectArray(rule.subjectsA ?? [], `${path}.subjectsA`, references, errors),
        ...validateRuleSubjectArray(rule.subjectsB ?? [], `${path}.subjectsB`, references, errors)
      ]
    } else if (rule.subject !== undefined) {
      subjectKeys = validateLegacyRuleSubject(rule.subject, `${path}.subject`, references, errors)
    } else {
      errors.push(`${path}.subjects 缺少规则对象`)
    }

    if (subjectKeys.length < PREDICATE_META[rule.predicate].minSubjects) {
      errors.push(`${path}.subjects 数量少于规则要求的 ${PREDICATE_META[rule.predicate].minSubjects}`)
    }
    if (new Set(subjectKeys).size !== subjectKeys.length) errors.push(`${path}.subjects 包含重复对象`)
    validateRuleParams(rule.params ?? {}, rule.predicate, `${path}.params`, references, errors)

    if (rule.subRules !== undefined && rule.subRules !== null) {
      if (!Array.isArray(rule.subRules)) {
        errors.push(`${path}.subRules 必须是数组或 null`)
      } else {
        rule.subRules.forEach((subRule, subRuleIndex) => {
          const subPath = `${path}.subRules[${subRuleIndex}]`
          if (!isRecord(subRule)) {
            errors.push(`${subPath} 必须是对象`)
            return
          }
          if (typeof subRule.predicate !== 'string' || !PREDICATE_META[subRule.predicate]) {
            errors.push(`${subPath}.predicate 不是受支持的规则类型`)
            return
          }
          if (subRule.not !== undefined && typeof subRule.not !== 'boolean') {
            errors.push(`${subPath}.not 必须是布尔值`)
          }
          if (subRule.subjects !== undefined) {
            validateRuleSubjectArray(subRule.subjects, `${subPath}.subjects`, references, errors)
          }
          validateRuleParams(subRule.params ?? {}, subRule.predicate, `${subPath}.params`, references, errors)
        })
      }
    }
  })
}

const validateStudents = (
  value: unknown,
  attributeDefinitions: unknown,
  errors: string[]
) => {
  if (!validateArrayLimit(value, 'students', MAX_STUDENTS, errors)) return
  validateUniqueIds(value, 'students', errors)

  const studentNumbers = new Set<number>()
  const attributeDefinitionsById = new Map<string, JsonRecord>()
  if (Array.isArray(attributeDefinitions)) {
    attributeDefinitions.forEach(definition => {
      if (!isRecord(definition) || typeof definition.id !== 'string' || !definition.id) return
      if (!attributeDefinitionsById.has(definition.id)) {
        attributeDefinitionsById.set(definition.id, definition)
      }
    })
  }

  value.forEach((student, index) => {
    const path = `students[${index}]`
    if (!isRecord(student)) {
      errors.push(`${path} 必须是对象`)
      return
    }
    if (!isIdentifier(student.id)) errors.push(`${path}.id 无效`)
    if (typeof student.name !== 'string') errors.push(`${path}.name 必须是字符串`)
    if (student.studentNumber !== null && (typeof student.studentNumber !== 'number' || !Number.isFinite(student.studentNumber))) {
      errors.push(`${path}.studentNumber 必须是有限数字或 null`)
    } else if (typeof student.studentNumber === 'number') {
      if (studentNumbers.has(student.studentNumber)) {
        errors.push(`${path}.studentNumber 与其他学生重复`)
      }
      studentNumbers.add(student.studentNumber)
    }
    if (student.tags !== undefined && !Array.isArray(student.tags)) {
      errors.push(`${path}.tags 必须是数组`)
    } else if (Array.isArray(student.tags) && student.tags.some(tagId => !isIdentifier(tagId))) {
      errors.push(`${path}.tags 包含无效标签 ID`)
    }
    if (student.numericAttributes !== undefined && !isRecord(student.numericAttributes)) {
      errors.push(`${path}.numericAttributes 必须是对象`)
    } else if (isRecord(student.numericAttributes)) {
      Object.entries(student.numericAttributes).forEach(([attributeId, attributeValue]) => {
        const attributePath = `${path}.numericAttributes.${attributeId}`
        const definition = attributeDefinitionsById.get(attributeId)
        if (!definition) {
          errors.push(`${attributePath} 没有对应的数值属性定义`)
          return
        }
        if (attributeValue === null) return
        if (typeof attributeValue !== 'number' || !Number.isFinite(attributeValue)) {
          errors.push(`${attributePath} 必须是有限数字或 null`)
          return
        }
        if (typeof definition.min === 'number' && Number.isFinite(definition.min) && attributeValue < definition.min) {
          errors.push(`${attributePath} 不能小于 ${definition.min}`)
        }
        if (typeof definition.max === 'number' && Number.isFinite(definition.max) && attributeValue > definition.max) {
          errors.push(`${attributePath} 不能大于 ${definition.max}`)
        }
        if (
          Number.isInteger(definition.precision) &&
          Number(definition.precision) >= 0 &&
          Number(definition.precision) <= 10 &&
          !hasValidDecimalPrecision(attributeValue, Number(definition.precision))
        ) {
          errors.push(`${attributePath} 小数位数不能超过 ${definition.precision}`)
        }
        if (
          (definition.min === null || (typeof definition.min === 'number' && Number.isFinite(definition.min))) &&
          (definition.max === null || (typeof definition.max === 'number' && Number.isFinite(definition.max))) &&
          Number.isInteger(definition.precision) &&
          Number(definition.precision) >= 0 &&
          Number(definition.precision) <= 10
        ) {
          const normalizedValue = normalizeNumberInput(attributeValue, {
            min: definition.min ?? undefined,
            max: definition.max ?? undefined,
            precision: Number(definition.precision)
          })
          if (normalizedValue === null || normalizedValue !== attributeValue) {
            errors.push(`${attributePath} 无法按数值属性定义无损重载`)
          }
        }
      })
    }
  })
}

const validateTags = (value: unknown, errors: string[]) => {
  if (!validateArrayLimit(value, 'tags', MAX_TAGS, errors)) return
  validateUniqueIds(value, 'tags', errors)

  value.forEach((tag, index) => {
    const path = `tags[${index}]`
    if (!isRecord(tag)) {
      errors.push(`${path} 必须是对象`)
      return
    }
    if (!isIdentifier(tag.id)) errors.push(`${path}.id 无效`)
    if (typeof tag.name !== 'string') errors.push(`${path}.name 必须是字符串`)
    if (typeof tag.color !== 'string') errors.push(`${path}.color 必须是字符串`)
    if (tag.showInSeatChart !== undefined && typeof tag.showInSeatChart !== 'boolean') {
      errors.push(`${path}.showInSeatChart 必须是布尔值`)
    }
  })
}

const validateLayout = (value: unknown, errors: string[]) => {
  if (!isRecord(value)) {
    errors.push('layout 必须是对象')
    return
  }

  const config = value.config
  if (!isRecord(config)) {
    errors.push('layout.config 必须是对象')
  } else {
    if (!isPositiveInteger(config.groupCount)) {
      errors.push('layout.config.groupCount 必须是正整数')
    } else if (Number(config.groupCount) > MAX_WORKSPACE_GROUPS) {
      errors.push(`layout.config.groupCount 不能超过 ${MAX_WORKSPACE_GROUPS}`)
    }
    if (!isPositiveInteger(config.columnsPerGroup)) errors.push('layout.config.columnsPerGroup 必须是正整数')
    if (!isPositiveInteger(config.seatsPerColumn)) errors.push('layout.config.seatsPerColumn 必须是正整数')
    if (config.podiumPosition !== 'top' && config.podiumPosition !== 'bottom') {
      errors.push('layout.config.podiumPosition 必须是 top 或 bottom')
    }

    if (!Array.isArray(config.groups) || config.groups.length === 0) {
      errors.push('layout.config.groups 必须是非空数组')
    } else {
      if (config.groups.length > MAX_WORKSPACE_GROUPS) {
        errors.push(`layout.config.groups 数量不能超过 ${MAX_WORKSPACE_GROUPS}`)
      }
      if (isPositiveInteger(config.groupCount) && config.groups.length !== config.groupCount) {
        errors.push('layout.config.groups 长度必须与 groupCount 一致')
      }
      let configuredSeatCount = 0
      config.groups.forEach((group, index) => {
        const path = `layout.config.groups[${index}]`
        if (!isRecord(group)) {
          errors.push(`${path} 必须是对象`)
          return
        }
        if (!isPositiveInteger(group.columns)) errors.push(`${path}.columns 必须是正整数`)
        if (!isPositiveInteger(group.rows)) errors.push(`${path}.rows 必须是正整数`)
        if (isPositiveInteger(group.columns) && isPositiveInteger(group.rows)) {
          configuredSeatCount += Number(group.columns) * Number(group.rows)
        }
      })
      if (configuredSeatCount > MAX_WORKSPACE_SEATS) {
        errors.push(`layout.config 配置的普通座位数不能超过 ${MAX_WORKSPACE_SEATS}`)
      }
    }

    if (!isRecord(config.guardSeats)) {
      errors.push('layout.config.guardSeats 必须是对象')
    }
  }

  const configuredGroups = isRecord(config) && Array.isArray(config.groups) ? config.groups : []
  if (!validateArrayLimit(value.seats, 'layout.seats', MAX_WORKSPACE_SEATS + 2, errors)) return
  validateUniqueIds(value.seats, 'layout.seats', errors)
  const regularSeatPositions = new Set<string>()
  const guardSides = new Set<'left' | 'right'>()
  value.seats.forEach((seat, index) => {
    const path = `layout.seats[${index}]`
    if (!isRecord(seat)) {
      errors.push(`${path} 必须是对象`)
      return
    }
    if (typeof seat.id !== 'string' || seat.id.length === 0) errors.push(`${path}.id 必须是非空字符串`)
    const isGuard = seat.kind === 'guard' || seat.id === 'guard-left' || seat.id === 'guard-right'
    if (isGuard) {
      if (seat.guardSide !== 'left' && seat.guardSide !== 'right') {
        errors.push(`${path}.guardSide 必须是 left 或 right`)
      } else {
        const expectedId = generateGuardSeatId(seat.guardSide)
        if (seat.id !== expectedId) {
          errors.push(`${path}.id 必须与 guardSide 一致（${seat.guardSide} 护法位应使用 ${expectedId}）`)
        }
        if (guardSides.has(seat.guardSide)) {
          errors.push(`${path}.guardSide 与其他护法位重复，每侧最多一个`)
        }
        guardSides.add(seat.guardSide)
      }
    } else {
      if (!isNonNegativeInteger(seat.group)) errors.push(`${path}.group 必须是非负整数`)
      if (!isNonNegativeInteger(seat.col)) errors.push(`${path}.col 必须是非负整数`)
      if (!isNonNegativeInteger(seat.row)) errors.push(`${path}.row 必须是非负整数`)
      if (isNonNegativeInteger(seat.group) && isNonNegativeInteger(seat.col) && isNonNegativeInteger(seat.row)) {
        const positionKey = `${seat.group}:${seat.col}:${seat.row}`
        if (regularSeatPositions.has(positionKey)) {
          errors.push(`${path} 与其他普通座位坐标重复`)
        }
        regularSeatPositions.add(positionKey)
        if (typeof seat.id === 'string' && seat.id !== generateSeatId(Number(seat.group), Number(seat.col), Number(seat.row))) {
          errors.push(`${path}.id 与 group/col/row 不一致`)
        }
        const group = configuredGroups[Number(seat.group)]
        if (!isRecord(group)) {
          errors.push(`${path}.group 超出布局范围`)
        } else {
          if (Number(seat.col) >= Number(group.columns)) errors.push(`${path}.col 超出大组列范围`)
          if (Number(seat.row) >= Number(group.rows)) errors.push(`${path}.row 超出大组行范围`)
        }
      }
    }
    if (seat.studentId !== null && seat.studentId !== undefined && !isIdentifier(seat.studentId)) {
      errors.push(`${path}.studentId 无效`)
    }
    if (seat.empty !== undefined && typeof seat.empty !== 'boolean') {
      errors.push(`${path}.empty 必须是布尔值`)
    }
  })
}

const validateOptionalCollections = (workspace: JsonRecord, errors: string[]) => {
  if (workspace.studentAttributeDefinitions !== undefined) {
    if (validateArrayLimit(
      workspace.studentAttributeDefinitions,
      'studentAttributeDefinitions',
      MAX_STUDENT_ATTRIBUTES,
      errors
    )) {
      const attributeIds = new Set<string>()
      workspace.studentAttributeDefinitions.forEach((definition, index) => {
        const path = `studentAttributeDefinitions[${index}]`
        if (!isRecord(definition)) {
          errors.push(`${path} 必须是对象`)
          return
        }
        if (typeof definition.id !== 'string' || definition.id.trim().length === 0) {
          errors.push(`${path}.id 必须是非空字符串`)
        } else if (attributeIds.has(definition.id)) {
          errors.push(`${path}.id 与其他数值属性重复`)
        } else {
          attributeIds.add(definition.id)
        }
        if (typeof definition.name !== 'string' || definition.name.trim().length === 0) {
          errors.push(`${path}.name 必须是非空字符串`)
        }
        if (typeof definition.unit !== 'string') errors.push(`${path}.unit 必须是字符串`)
        for (const field of ['min', 'max'] as const) {
          const value = definition[field]
          if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
            errors.push(`${path}.${field} 必须是有限数字或 null`)
          }
        }
        if (typeof definition.min === 'number' && typeof definition.max === 'number' && definition.min > definition.max) {
          errors.push(`${path}.min 不能大于 max`)
        }
        if (!Number.isInteger(definition.precision) || Number(definition.precision) < 0 || Number(definition.precision) > 10) {
          errors.push(`${path}.precision 必须是 0 到 10 的整数`)
        }
        if (
          (definition.min === null || (typeof definition.min === 'number' && Number.isFinite(definition.min))) &&
          (definition.max === null || (typeof definition.max === 'number' && Number.isFinite(definition.max))) &&
          Number.isInteger(definition.precision) &&
          Number(definition.precision) >= 0 &&
          Number(definition.precision) <= 10 &&
          !hasRepresentableNumberInputRange({
            min: definition.min ?? undefined,
            max: definition.max ?? undefined,
            precision: Number(definition.precision)
          })
        ) {
          errors.push(`${path} 在当前 min、max 和 precision 下没有可表示值`)
        }
        if (typeof definition.enabled !== 'boolean') errors.push(`${path}.enabled 必须是布尔值`)
        if (definition.showInEditor !== undefined && typeof definition.showInEditor !== 'boolean') {
          errors.push(`${path}.showInEditor 必须是布尔值`)
        }
        if (definition.builtInKey !== undefined && definition.builtInKey !== 'height' && definition.builtInKey !== 'score') {
          errors.push(`${path}.builtInKey 无效`)
        }
        if (definition.createdFrom !== undefined && !['default', 'manual', 'excel'].includes(String(definition.createdFrom))) {
          errors.push(`${path}.createdFrom 无效`)
        }
      })
    }
  }

  if (workspace.studentAttributeSettings !== undefined && !isRecord(workspace.studentAttributeSettings)) {
    errors.push('studentAttributeSettings 必须是对象')
  }
  if (workspace.tagSettings !== undefined && !isRecord(workspace.tagSettings)) {
    errors.push('tagSettings 必须是对象')
  }
  if (workspace.exportSettings !== undefined && !isRecord(workspace.exportSettings)) {
    errors.push('exportSettings 必须是对象')
  }

  if (validateArrayLimit(workspace.zones, 'zones', MAX_ZONES, errors)) {
    validateUniqueIds(workspace.zones, 'zones', errors)
    workspace.zones.forEach((zone, index) => {
      const path = `zones[${index}]`
      if (!isRecord(zone)) {
        errors.push(`${path} 必须是对象`)
        return
      }
      if (!isIdentifier(zone.id)) errors.push(`${path}.id 无效`)
      if (typeof zone.name !== 'string') errors.push(`${path}.name 必须是字符串`)
      if (!Array.isArray(zone.tagIds) || zone.tagIds.some(tagId => !isIdentifier(tagId))) {
        errors.push(`${path}.tagIds 必须是有效 ID 数组`)
      }
      if (!Array.isArray(zone.seatIds) || zone.seatIds.some(seatId => typeof seatId !== 'string')) {
        errors.push(`${path}.seatIds 必须是字符串数组`)
      }
    })
  }

  if (workspace.rotationGroups !== undefined) {
    if (validateArrayLimit(workspace.rotationGroups, 'rotationGroups', MAX_ROTATION_GROUPS, errors)) {
      validateUniqueIds(workspace.rotationGroups, 'rotationGroups', errors)
      const rotationZoneIds = new Set<string>()
      let rotationZoneCount = 0

      workspace.rotationGroups.forEach((group, groupIndex) => {
        const groupPath = `rotationGroups[${groupIndex}]`
        if (!isRecord(group)) {
          errors.push(`${groupPath} 必须是对象`)
          return
        }
        if (!isPositiveInteger(group.id)) errors.push(`${groupPath}.id 必须是正整数`)
        if (typeof group.name !== 'string') errors.push(`${groupPath}.name 必须是字符串`)
        if (group.type !== 'cycle' && group.type !== 'swap') {
          errors.push(`${groupPath}.type 必须是 cycle 或 swap`)
        }
        if (!Array.isArray(group.zones)) {
          errors.push(`${groupPath}.zones 必须是数组`)
          return
        }

        rotationZoneCount += group.zones.length
        if (rotationZoneCount > MAX_ROTATION_ZONES) {
          errors.push(`rotationGroups 中的选区总数不能超过 ${MAX_ROTATION_ZONES}`)
          return
        }

        group.zones.forEach((zone, zoneIndex) => {
          const zonePath = `${groupPath}.zones[${zoneIndex}]`
          if (!isRecord(zone)) {
            errors.push(`${zonePath} 必须是对象`)
            return
          }
          if (!isPositiveInteger(zone.id)) {
            errors.push(`${zonePath}.id 必须是正整数`)
          } else {
            const zoneId = String(zone.id)
            if (rotationZoneIds.has(zoneId)) errors.push(`${zonePath}.id 与其他轮换选区重复`)
            rotationZoneIds.add(zoneId)
          }
          if (typeof zone.name !== 'string') errors.push(`${zonePath}.name 必须是字符串`)
          if (!Array.isArray(zone.seatIds) || zone.seatIds.some(seatId => typeof seatId !== 'string')) {
            errors.push(`${zonePath}.seatIds 必须是字符串数组`)
          }
        })
      })
    }
  }

}

const validateReferences = (workspace: JsonRecord, errors: string[]) => {
  if (!Array.isArray(workspace.students) || !Array.isArray(workspace.tags) || !isRecord(workspace.layout)) return
  const studentIds = new Set(workspace.students.filter(isRecord).map(student => String(student.id)))
  const tagIds = new Set(workspace.tags.filter(isRecord).map(tag => String(tag.id)))
  const seats = Array.isArray(workspace.layout.seats) ? workspace.layout.seats : []
  const seatIds = new Set(seats.filter(isRecord).map(seat => String(seat.id)))

  workspace.students.forEach((student, index) => {
    if (!isRecord(student) || !Array.isArray(student.tags)) return
    student.tags.forEach(tagId => {
      if (isIdentifier(tagId) && !tagIds.has(String(tagId))) {
        errors.push(`students[${index}].tags 引用了不存在的标签 ${String(tagId)}`)
      }
    })
  })

  const assignedStudentSeats = new Map<string, string>()
  seats.forEach((seat, index) => {
    if (!isRecord(seat) || seat.studentId === null || seat.studentId === undefined) return
    if (isIdentifier(seat.studentId)) {
      const studentId = String(seat.studentId)
      if (!studentIds.has(studentId)) {
        errors.push(`layout.seats[${index}].studentId 引用了不存在的学生 ${studentId}`)
      }
      const previousSeatId = assignedStudentSeats.get(studentId)
      if (previousSeatId) {
        errors.push(`layout.seats[${index}].studentId 将学生 ${studentId} 同时分配到 ${previousSeatId} 和 ${String(seat.id)}`)
      } else {
        assignedStudentSeats.set(studentId, String(seat.id))
      }
    }
  })

  if (!Array.isArray(workspace.zones)) return
  workspace.zones.forEach((zone, index) => {
    if (!isRecord(zone)) return
    if (Array.isArray(zone.tagIds)) {
      zone.tagIds.forEach(tagId => {
        if (isIdentifier(tagId) && !tagIds.has(String(tagId))) {
          errors.push(`zones[${index}].tagIds 引用了不存在的标签 ${String(tagId)}`)
        }
      })
    }
    if (Array.isArray(zone.seatIds)) {
      zone.seatIds.forEach(seatId => {
        if (typeof seatId === 'string' && !seatIds.has(seatId)) {
          errors.push(`zones[${index}].seatIds 引用了不存在的座位 ${seatId}`)
        }
      })
    }
  })

  if (Array.isArray(workspace.rotationGroups)) {
    workspace.rotationGroups.forEach((group, groupIndex) => {
      if (!isRecord(group) || !Array.isArray(group.zones)) return
      group.zones.forEach((zone, zoneIndex) => {
        if (!isRecord(zone) || !Array.isArray(zone.seatIds)) return
        zone.seatIds.forEach(seatId => {
          if (typeof seatId === 'string' && !seatIds.has(seatId)) {
            errors.push(`rotationGroups[${groupIndex}].zones[${zoneIndex}].seatIds 引用了不存在的座位 ${seatId}`)
          }
        })
      })
    })
  }
}

export const cloneWorkspaceInput = <T>(value: T): T => {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    throw new Error('工作区数据不是可序列化的 JSON')
  }
}

export const validateWorkspaceDocument = (value: unknown): WorkspaceValidationResult => {
  const errors: string[] = []
  if (!isRecord(value)) {
    return { valid: false, data: null, errors: ['工作区根节点必须是对象'] }
  }

  if (value.meta !== undefined) {
    if (!isRecord(value.meta)) {
      errors.push('meta 必须是对象')
    } else if (typeof value.meta.version !== 'string' || value.meta.version.length === 0) {
      errors.push('meta.version 必须是非空字符串')
    } else {
      const versionError = getWorkspaceVersionError(value.meta.version)
      if (versionError) errors.push(versionError)
    }
  }

  validateStudents(value.students, value.studentAttributeDefinitions, errors)
  validateTags(value.tags, errors)
  validateLayout(value.layout, errors)
  validateOptionalCollections(value, errors)
  validateRules(value, errors)
  validateReferences(value, errors)

  if (errors.length > 0) {
    return { valid: false, data: null, errors }
  }
  return { valid: true, data: value as unknown as Workspace, errors: [] }
}

export const formatWorkspaceValidationErrors = (errors: string[]) => {
  const visibleErrors = errors.slice(0, 3)
  const suffix = errors.length > visibleErrors.length ? `；另有 ${errors.length - visibleErrors.length} 项错误` : ''
  return `${visibleErrors.join('；')}${suffix}`
}
