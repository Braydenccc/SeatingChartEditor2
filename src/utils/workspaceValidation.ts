import type { Workspace } from '@/types'

const MAX_STUDENTS = 5000
const MAX_TAGS = 500
export const MAX_WORKSPACE_GROUPS = 100
export const MAX_WORKSPACE_SEATS = 20000
const MAX_ZONES = 1000
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

const validateStudents = (value: unknown, errors: string[]) => {
  if (!validateArrayLimit(value, 'students', MAX_STUDENTS, errors)) return
  validateUniqueIds(value, 'students', errors)

  value.forEach((student, index) => {
    const path = `students[${index}]`
    if (!isRecord(student)) {
      errors.push(`${path} 必须是对象`)
      return
    }
    if (!isIdentifier(student.id)) errors.push(`${path}.id 无效`)
    if (typeof student.name !== 'string') errors.push(`${path}.name 必须是字符串`)
    if (student.tags !== undefined && !Array.isArray(student.tags)) {
      errors.push(`${path}.tags 必须是数组`)
    } else if (Array.isArray(student.tags) && student.tags.some(tagId => !isIdentifier(tagId))) {
      errors.push(`${path}.tags 包含无效标签 ID`)
    }
    if (student.numericAttributes !== undefined && !isRecord(student.numericAttributes)) {
      errors.push(`${path}.numericAttributes 必须是对象`)
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
  value.seats.forEach((seat, index) => {
    const path = `layout.seats[${index}]`
    if (!isRecord(seat)) {
      errors.push(`${path} 必须是对象`)
      return
    }
    if (typeof seat.id !== 'string' || seat.id.length === 0) errors.push(`${path}.id 必须是非空字符串`)
    const isGuard = seat.kind === 'guard' || seat.id === 'guard-left' || seat.id === 'guard-right'
    if (!isGuard) {
      if (!isNonNegativeInteger(seat.group)) errors.push(`${path}.group 必须是非负整数`)
      if (!isNonNegativeInteger(seat.col)) errors.push(`${path}.col 必须是非负整数`)
      if (!isNonNegativeInteger(seat.row)) errors.push(`${path}.row 必须是非负整数`)
      if (isNonNegativeInteger(seat.group) && isNonNegativeInteger(seat.col) && isNonNegativeInteger(seat.row)) {
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
    if (!Array.isArray(workspace.studentAttributeDefinitions)) {
      errors.push('studentAttributeDefinitions 必须是数组')
    } else {
      workspace.studentAttributeDefinitions.forEach((definition, index) => {
        if (!isRecord(definition) || typeof definition.id !== 'string' || typeof definition.name !== 'string') {
          errors.push(`studentAttributeDefinitions[${index}] 缺少有效的 id 或 name`)
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

  if (validateArrayLimit(workspace.rules, 'rules', MAX_RULES, errors)) {
    workspace.rules.forEach((rule, index) => {
      if (!isRecord(rule)) errors.push(`rules[${index}] 必须是对象`)
    })
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

  seats.forEach((seat, index) => {
    if (!isRecord(seat) || seat.studentId === null || seat.studentId === undefined) return
    if (isIdentifier(seat.studentId) && !studentIds.has(String(seat.studentId))) {
      errors.push(`layout.seats[${index}].studentId 引用了不存在的学生 ${String(seat.studentId)}`)
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
    }
  }

  validateStudents(value.students, errors)
  validateTags(value.tags, errors)
  validateLayout(value.layout, errors)
  validateOptionalCollections(value, errors)
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
