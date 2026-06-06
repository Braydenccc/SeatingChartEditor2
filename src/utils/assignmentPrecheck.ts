const REQUIRED_PRIORITY = 'required'

const POSITION_RULES = new Set([
  'IN_ZONE',
  'NOT_IN_ZONE',
  'IN_ROW_RANGE',
  'IN_GROUP_RANGE',
  'NOT_IN_COLUMN_TYPE'
])

const isGuardSeatLike = (seat: any) => seat?.kind === 'guard' || String(seat?.id || '').startsWith('guard-')

const getRuleSubjects = (rule: any) => {
  if (Array.isArray(rule?.subjects)) return rule.subjects
  if (rule?.subjectMode === 'single' || rule?.subjectMode === 'dual') {
    return [...(rule.subjectsA || []), ...(rule.subjectsB || [])]
  }

  const subject = rule?.subject || {}
  if (subject.kind === 'student') return [{ type: 'person', id: subject.id }]
  if (subject.kind === 'tag') return [{ type: 'tag', id: subject.tagId }]
  if (subject.kind === 'pair') return [{ type: 'person', id: subject.id1 }, { type: 'person', id: subject.id2 }]
  if (subject.kind === 'tag_pair') return [{ type: 'tag', id: subject.tagId1 }, { type: 'tag', id: subject.tagId2 }]
  return []
}

const cloneRuleForPrecheck = (rule: any, subRule: any = null, index: number | null = null) => {
  const source = subRule || rule
  const subjects = Array.isArray(source.subjects) && source.subjects.length > 0
    ? source.subjects
    : getRuleSubjects(rule)

  return {
    ...rule,
    id: index === null ? rule.id : `${rule.id || 'rule'}:${index}`,
    predicate: source.predicate,
    params: { ...(source.params || {}) },
    subjects: subjects.map((item: any) => ({ ...item })),
    not: source.not ?? rule.not ?? false,
    priority: rule.priority,
    subRules: null,
    logicOperator: null
  }
}

const expandRulesForPrecheck = (rules: any[]) => {
  const expanded = []

  for (const rule of rules || []) {
    const subRules = Array.isArray(rule?.subRules)
      ? rule.subRules.filter((subRule: any) => subRule?.predicate)
      : []

    if (subRules.length > 1 && rule.logicOperator === 'OR') {
      continue
    }

    if (subRules.length > 0) {
      subRules.forEach((subRule: any, index: number) => {
        expanded.push(cloneRuleForPrecheck(rule, subRule, index))
      })
      continue
    }

    if (rule?.predicate) {
      expanded.push(cloneRuleForPrecheck(rule))
    }
  }

  return expanded
}

const buildPrecheckContext = (input: any) => {
  const studentList = input.students || []
  const rawActiveRules = input.activeRules || []
  const activeRules = expandRulesForPrecheck(rawActiveRules)
  const availableSeats = input.availableSeats || []
  const availableSeatIds = new Set(availableSeats.map((seat: any) => seat.id))
  const seatList = input.seats || []
  const config = input.seatConfig || {}
  const zoneList = input.zones || []
  const seatById = new Map(seatList.map((seat: any) => [seat.id, seat]))
  const zoneById = new Map(zoneList.map((zone: any) => [zone.id, zone]))
  const studentNameMap = new Map(studentList.map((student: any) => [student.id, student.name || `学生#${student.id}`]))
  const tagToStudentIds = new Map()

  for (const student of studentList) {
    for (const tagId of student.tags || []) {
      if (!tagToStudentIds.has(tagId)) tagToStudentIds.set(tagId, new Set())
      tagToStudentIds.get(tagId).add(student.id)
    }
  }

  const expandEntriesToStudentIds = (entries = []) => {
    const ids = new Set()
    for (const entry of entries as any[]) {
      if (entry?.type === 'all') {
        for (const student of studentList) ids.add(student.id)
        continue
      }
      if (!entry?.id) continue
      if (entry.type === 'person') {
        ids.add(entry.id)
        continue
      }
      if (entry.type === 'tag') {
        const studentIds = tagToStudentIds.get(entry.id)
        if (!studentIds) continue
        for (const studentId of studentIds as Set<any>) ids.add(studentId)
      }
    }
    return [...ids]
  }

  const rulesByStudentId = new Map<any, any[]>(studentList.map((student: any) => [student.id, []]))
  const coveredStudentIds = new Set()
  for (const rule of activeRules) {
    const studentIds = expandEntriesToStudentIds(getRuleSubjects(rule))
    for (const studentId of studentIds) {
      coveredStudentIds.add(studentId)
      if (!rulesByStudentId.has(studentId)) rulesByStudentId.set(studentId, [])
      rulesByStudentId.get(studentId).push(rule)
    }
  }

  return {
    ...input,
    studentList,
    rawActiveRules,
    activeRules,
    originalActiveRuleCount: rawActiveRules.length,
    availableSeats,
    availableSeatIds,
    seatList,
    config,
    zoneList,
    seatById,
    zoneById,
    studentNameMap,
    expandEntriesToStudentIds,
    rulesByStudentId,
    coveredStudentIds
  }
}

const detectDeskmateBindingConflicts = (ctx: any) => {
  const activeRules = ctx.activeRules.filter((rule: any) => !rule.not && rule.predicate === 'MUST_BE_SEATMATES')
  if (activeRules.length === 0) return { count: 0, details: [] }

  const columnsPerGroup = Number(ctx.config?.columnsPerGroup || 0)
  if (columnsPerGroup <= 1) {
    return {
      count: 1,
      details: ['当前每大组列数为 1，不存在同桌位，所有“必须同桌”规则不可满足']
    }
  }

  const adjacency = new Map()
  const pairKeys = new Set()
  const expandedPairs = []

  for (const rule of activeRules) {
    const ids = ctx.expandEntriesToStudentIds(getRuleSubjects(rule))
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]
        const b = ids[j]
        const key = a < b ? `${a}:${b}` : `${b}:${a}`
        if (pairKeys.has(key)) continue
        pairKeys.add(key)
        expandedPairs.push([a, b])
        if (!adjacency.has(a)) adjacency.set(a, new Set())
        if (!adjacency.has(b)) adjacency.set(b, new Set())
        adjacency.get(a).add(b)
        adjacency.get(b).add(a)
      }
    }
  }

  const details = []
  const seatsByGroupRow = new Map()
  for (const seat of ctx.availableSeats) {
    if (isGuardSeatLike(seat)) continue
    const key = `${seat.groupIndex}:${seat.rowIndex}`
    seatsByGroupRow.set(key, (seatsByGroupRow.get(key) || 0) + 1)
  }

  let maxFeasiblePairs = 0
  for (const count of seatsByGroupRow.values()) {
    maxFeasiblePairs += Math.floor((count * Math.max(0, count - 1)) / 2)
  }
  if (expandedPairs.length > maxFeasiblePairs) {
    details.push(`同桌容量不足：当前最多可满足约 ${maxFeasiblePairs} 对同桌关系，但规则展开后需要 ${expandedPairs.length} 对`)
  }

  const maxDeskmatesPerStudent = columnsPerGroup - 1
  for (const [studentId, mates] of adjacency.entries()) {
    if (mates.size <= maxDeskmatesPerStudent) continue
    const selfName = ctx.studentNameMap.get(studentId) || `学生#${studentId}`
    const mateNames = [...mates].map((id: any) => ctx.studentNameMap.get(id) || `学生#${id}`)
    details.push(`同桌绑定冲突：${selfName} 绑定了 ${mateNames.join('、')}，超过当前列数可容纳上限（${maxDeskmatesPerStudent}）`)
  }

  const forbidRules = ctx.activeRules.filter((rule: any) => !rule.not && rule.predicate === 'MUST_NOT_BE_SEATMATES')
  if (forbidRules.length > 0 && expandedPairs.length > 0) {
    const forbidPairKeys = new Set()
    for (const rule of forbidRules) {
      const ids = ctx.expandEntriesToStudentIds(getRuleSubjects(rule))
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i]
          const b = ids[j]
          forbidPairKeys.add(a < b ? `${a}:${b}` : `${b}:${a}`)
        }
      }
    }
    for (const [a, b] of expandedPairs) {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`
      if (!forbidPairKeys.has(key)) continue
      const aName = ctx.studentNameMap.get(a) || `学生#${a}`
      const bName = ctx.studentNameMap.get(b) || `学生#${b}`
      details.push(`规则冲突：${aName} 与 ${bName} 同时存在“必须同桌”和“禁止同桌”`)
    }
  }

  return { count: details.length, details }
}

const detectSeatCapacityConflicts = (ctx: any) => {
  const details = []
  const renderRuleText = ctx.renderRuleText || ((rule: any) => rule.predicate)

  for (const rule of ctx.activeRules.filter((r: any) => !r.not && r.predicate === 'IN_ZONE')) {
    const studentIds = ctx.expandEntriesToStudentIds(getRuleSubjects(rule))
    const zone = ctx.zoneById.get(rule.params?.zoneId)
    if (!zone) continue
    const zoneSeatCount = (zone.seatIds || []).filter((seatId: any) => {
      const seat = ctx.seatById.get(seatId)
      return seat && !isGuardSeatLike(seat) && ctx.availableSeatIds.has(seatId)
    }).length
    if (studentIds.length > zoneSeatCount) {
      details.push(`选区容量不足：「${renderRuleText(rule)}」需要 ${studentIds.length} 个座位，但选区只有 ${zoneSeatCount} 个可用座位`)
    }
  }

  for (const rule of ctx.activeRules.filter((r: any) => !r.not && r.predicate === 'IN_ROW_RANGE')) {
    const studentIds = ctx.expandEntriesToStudentIds(getRuleSubjects(rule))
    const { minRow, maxRow } = rule.params || {}
    const eligibleSeats = ctx.availableSeats.filter((seat: any) =>
      !isGuardSeatLike(seat) && ctx.isInRowRange(seat.id, minRow, maxRow)
    )
    if (studentIds.length > eligibleSeats.length) {
      details.push(`排范围容量不足：「${renderRuleText(rule)}」需要 ${studentIds.length} 个座位，但指定排范围只有 ${eligibleSeats.length} 个可用座位`)
    }
  }

  for (const rule of ctx.activeRules.filter((r: any) => !r.not && r.predicate === 'IN_GROUP_RANGE')) {
    const studentIds = ctx.expandEntriesToStudentIds(getRuleSubjects(rule))
    const { minGroup, maxGroup } = rule.params || {}
    const eligibleSeats = ctx.availableSeats.filter((seat: any) => {
      if (isGuardSeatLike(seat)) return false
      const group1 = seat.groupIndex + 1
      return group1 >= minGroup && group1 <= maxGroup
    })
    if (studentIds.length > eligibleSeats.length) {
      details.push(`大组范围容量不足：「${renderRuleText(rule)}」需要 ${studentIds.length} 个座位，但指定大组范围只有 ${eligibleSeats.length} 个可用座位`)
    }
  }

  return { count: details.length, details }
}

const getEligibleSeatIdsForStudent = (ctx: any, studentId: any, rules: any[]) => {
  let eligibleSeats = new Set(ctx.availableSeatIds)

  for (const rule of rules) {
    if (rule.not || !POSITION_RULES.has(rule.predicate)) continue

    if (rule.predicate === 'IN_ZONE') {
      const zone = ctx.zoneById.get(rule.params?.zoneId)
      if (zone) {
        const zoneSeats = new Set((zone.seatIds || []).filter((seatId: any) => {
          const seat = ctx.seatById.get(seatId)
          return seat && !isGuardSeatLike(seat)
        }))
        eligibleSeats = new Set([...eligibleSeats].filter(id => zoneSeats.has(id)))
      }
    } else if (rule.predicate === 'NOT_IN_ZONE') {
      const zone = ctx.zoneById.get(rule.params?.zoneId)
      if (zone) {
        const zoneSeats = new Set(zone.seatIds || [])
        eligibleSeats = new Set([...eligibleSeats].filter(id => !zoneSeats.has(id)))
      }
    } else if (rule.predicate === 'IN_ROW_RANGE') {
      const { minRow, maxRow } = rule.params || {}
      eligibleSeats = new Set([...eligibleSeats].filter(id => {
        const seat = ctx.seatById.get(id)
        if (!seat || isGuardSeatLike(seat)) return false
        return ctx.isInRowRange(id, minRow, maxRow)
      }))
    } else if (rule.predicate === 'IN_GROUP_RANGE') {
      const { minGroup, maxGroup } = rule.params || {}
      eligibleSeats = new Set([...eligibleSeats].filter(id => {
        const seat = ctx.seatById.get(id)
        if (!seat || isGuardSeatLike(seat)) return false
        const group1 = seat.groupIndex + 1
        return group1 >= minGroup && group1 <= maxGroup
      }))
    } else if (rule.predicate === 'NOT_IN_COLUMN_TYPE') {
      const columnType = rule.params?.columnType
      eligibleSeats = new Set([...eligibleSeats].filter(id => {
        const seat = ctx.seatById.get(id)
        if (!seat) return false
        if (isGuardSeatLike(seat)) return true
        return !ctx.isColumnType(id, columnType)
      }))
    }
  }

  return eligibleSeats
}

const detectStudentFeasibilityConflicts = (ctx: any) => {
  const details = []

  for (const student of ctx.studentList) {
    const studentRules = ctx.rulesByStudentId.get(student.id) || []
    const eligibleSeats = getEligibleSeatIdsForStudent(ctx, student.id, studentRules)

    if (eligibleSeats.size === 0 && studentRules.length > 0) {
      const studentName = student.name || `学生#${student.id}`
      details.push(`学生位置不可行：${studentName} 的所有规则结合后没有可用座位`)
    }
  }

  return { count: details.length, details }
}

const detectRequiredPositionMatchingConflicts = (ctx: any) => {
  const constrainedStudents = []

  for (const student of ctx.studentList) {
    const requiredRules = (ctx.rulesByStudentId.get(student.id) || []).filter((rule: any) =>
      rule.priority === REQUIRED_PRIORITY && !rule.not && POSITION_RULES.has(rule.predicate)
    )
    if (requiredRules.length === 0) continue
    const eligibleSeatIds = [...getEligibleSeatIdsForStudent(ctx, student.id, requiredRules)]
    constrainedStudents.push({ student, eligibleSeatIds })
  }

  if (constrainedStudents.length <= 1) return { count: 0, details: [] }

  constrainedStudents.sort((a, b) => a.eligibleSeatIds.length - b.eligibleSeatIds.length)

  const matchedStudentBySeat = new Map()
  const findSeat = (item: any, seenSeats: Set<any>) => {
    for (const seatId of item.eligibleSeatIds) {
      if (seenSeats.has(seatId)) continue
      seenSeats.add(seatId)
      const matched = matchedStudentBySeat.get(seatId)
      if (!matched || findSeat(matched, seenSeats)) {
        matchedStudentBySeat.set(seatId, item)
        return true
      }
    }
    return false
  }

  let matchedCount = 0
  for (const item of constrainedStudents) {
    if (findSeat(item, new Set())) matchedCount += 1
  }

  if (matchedCount >= constrainedStudents.length) return { count: 0, details: [] }

  const hardestNames = constrainedStudents
    .slice(0, 5)
    .map(item => `${item.student.name || `学生#${item.student.id}`}(${item.eligibleSeatIds.length})`)
    .join('、')

  return {
    count: 1,
    details: [
      `必须级位置规则整体不可行：${constrainedStudents.length} 名受限学生最多只能匹配 ${matchedCount} 个座位；候选最少的学生为 ${hardestNames}`
    ]
  }
}

const getGroupConfig = (config: any, groupIndex: number) => {
  const group = config?.groups?.[groupIndex]
  return {
    columns: Number(group?.columns || config?.columnsPerGroup || 0),
    rows: Number(group?.rows || config?.seatsPerColumn || 0)
  }
}

const getTotalColumnsFromConfig = (config: any) => {
  let totalCols = 0
  for (let g = 0; g < Number(config?.groupCount || 0); g++) {
    totalCols += getGroupConfig(config, g).columns
  }
  return totalCols
}

const getMaxRowsFromConfig = (config: any) => {
  let maxRows = 0
  for (let g = 0; g < Number(config?.groupCount || 0); g++) {
    maxRows = Math.max(maxRows, getGroupConfig(config, g).rows)
  }
  return maxRows
}

const calculateIdealMinDistance = (studentCount: number, config: any) => {
  if (studentCount <= 1) return Infinity
  if (!config) return Math.max(1.41, Math.sqrt(studentCount) * 0.8)

  const totalCols = getTotalColumnsFromConfig(config)
  const totalRows = getMaxRowsFromConfig(config)
  const totalSeats = Math.max(1, totalCols * totalRows)
  const maxTheoreticalDistance = Math.sqrt((totalCols - 1) * (totalCols - 1) + (totalRows - 1) * (totalRows - 1))

  let idealMinDistance
  if (studentCount <= 3) {
    idealMinDistance = 1.5
  } else if (studentCount <= 8) {
    idealMinDistance = 1.41 + (studentCount - 1) * 0.15
  } else {
    idealMinDistance = 2.5 + Math.log10(studentCount - 5) * 0.6
  }

  const classroomScaleFactor = Math.min(1.5, maxTheoreticalDistance / 10)
  idealMinDistance *= classroomScaleFactor
  idealMinDistance = Math.max(1.41, idealMinDistance)
  idealMinDistance = Math.min(idealMinDistance, maxTheoreticalDistance * 0.7)

  return Number.isFinite(idealMinDistance) ? idealMinDistance : Math.sqrt(totalSeats)
}

const calculateTheoreticalMinimumDistance = (studentCount: number, totalSeats: number) => {
  if (studentCount <= 1) return Infinity
  if (studentCount > totalSeats) return 0

  const gridSide = Math.ceil(Math.sqrt(studentCount))
  const totalGridCells = gridSide * gridSide
  if (studentCount <= totalGridCells * 0.5) return 2.0
  if (studentCount <= totalGridCells * 0.75) return 1.5
  return 1.0
}

const detectDistributeEvenlyFeasibility = (ctx: any) => {
  const details = []

  for (const rule of ctx.activeRules.filter((r: any) => !r.not && r.predicate === 'DISTRIBUTE_EVENLY')) {
    const studentIds = ctx.expandEntriesToStudentIds(getRuleSubjects(rule))
    if (studentIds.length <= 1 || ctx.availableSeats.length === 0) continue

    const idealMinDistance = calculateIdealMinDistance(studentIds.length, ctx.config)
    const totalCols = getTotalColumnsFromConfig(ctx.config)
    const totalRows = getMaxRowsFromConfig(ctx.config)
    const maxTheoreticalDistance = Math.sqrt((totalCols - 1) * (totalCols - 1) + (totalRows - 1) * (totalRows - 1))
    const theoreticalMinDistance = calculateTheoreticalMinimumDistance(studentIds.length, ctx.availableSeats.length)

    if (theoreticalMinDistance <= 1.0) {
      details.push(`均匀分散无法排除相邻：学生数 ${studentIds.length}，可用座位 ${ctx.availableSeats.length}，理论上有至少两人相邻`)
    }

    let feasibleMinDistance = 0
    if (studentIds.length <= ctx.availableSeats.length) {
      const gridSide = Math.ceil(Math.sqrt(studentIds.length))
      feasibleMinDistance = Math.min(
        maxTheoreticalDistance / (gridSide - 1 || 1),
        idealMinDistance * 1.5
      )
    }

    if (feasibleMinDistance < idealMinDistance * 0.8) {
      details.push(`均匀分散可能较难：学生数 ${studentIds.length}，理想距离 ${idealMinDistance.toFixed(2)}，预计可行距离 ${feasibleMinDistance.toFixed(2)}`)
    } else if (idealMinDistance > maxTheoreticalDistance * 0.6) {
      details.push(`均匀分散要求较高：学生数 ${studentIds.length}，理想距离 ${idealMinDistance.toFixed(2)}，教室最大距离 ${maxTheoreticalDistance.toFixed(2)}`)
    }
  }

  return { count: details.length, details }
}

export const createAssignmentPrecheck = (input: any) => {
  const ctx = buildPrecheckContext(input)
  const studentCount = ctx.studentList.length
  const availableSeatCount = ctx.availableSeats.length
  const activeRuleCount = ctx.originalActiveRuleCount
  const conflictList = ctx.detectConflicts
    ? ctx.detectConflicts({ zones: ctx.zoneList }, { seats: ctx.seatList, seatConfig: ctx.config })
    : []
  const conflictCount = conflictList.length
  const blockingReasons = []
  const warnings = []

  if (studentCount === 0) blockingReasons.push('没有学生数据')
  if (availableSeatCount === 0) blockingReasons.push('没有可用座位')
  if (studentCount > 0 && availableSeatCount < studentCount) {
    blockingReasons.push(`可用座位不足（学生 ${studentCount} 人 / 座位 ${availableSeatCount} 个）`)
  }

  const hardConflictCount = conflictList.filter((item: any) => item.type === 'infeasible' || item.type === 'contradiction').length
  if (hardConflictCount > 0) {
    blockingReasons.push(`存在 ${hardConflictCount} 条不可满足或逻辑矛盾规则`)
    conflictList.slice(0, 5).forEach((item: any) => blockingReasons.push(item.message))
  }

  const deskmateBindingConflict = detectDeskmateBindingConflicts(ctx)
  if (deskmateBindingConflict.count > 0) {
    blockingReasons.push(`存在 ${deskmateBindingConflict.count} 处同桌绑定冲突`)
    blockingReasons.push(...deskmateBindingConflict.details.slice(0, 5))
  }

  const seatCapacityConflict = detectSeatCapacityConflicts(ctx)
  if (seatCapacityConflict.count > 0) {
    blockingReasons.push(`存在 ${seatCapacityConflict.count} 处座位容量冲突`)
    blockingReasons.push(...seatCapacityConflict.details.slice(0, 5))
  }

  const studentFeasibilityConflict = detectStudentFeasibilityConflicts(ctx)
  if (studentFeasibilityConflict.count > 0) {
    blockingReasons.push(`存在 ${studentFeasibilityConflict.count} 处学生位置不可行问题`)
    blockingReasons.push(...studentFeasibilityConflict.details.slice(0, 5))
  }

  const requiredPositionMatchingConflict = detectRequiredPositionMatchingConflicts(ctx)
  if (requiredPositionMatchingConflict.count > 0) {
    blockingReasons.push(...requiredPositionMatchingConflict.details)
  }

  const distributeEvenlyWarning = detectDistributeEvenlyFeasibility(ctx)
  if (distributeEvenlyWarning.count > 0) {
    warnings.push(...distributeEvenlyWarning.details)
  }

  if (activeRuleCount === 0) {
    warnings.push('当前未启用规则，本次将接近随机排位')
  }

  const coverageRate = studentCount > 0 ? Math.round((ctx.coveredStudentIds.size / studentCount) * 100) : 0
  const maxIterations = Number(ctx.maxIterations || 100000)
  const estimatedMs = Math.max(300, Math.round((maxIterations / 100000) * Math.max(1, studentCount / 20) * 900))

  let risk = 'low'
  if (blockingReasons.length > 0) {
    risk = 'high'
  } else if (warnings.length > 0 || conflictCount > 0) {
    risk = 'medium'
  }

  return {
    pass: blockingReasons.length === 0,
    risk,
    studentCount,
    availableSeatCount,
    activeRuleCount,
    conflictCount,
    coverageRate,
    estimatedMs,
    blockingReasons,
    warnings
  }
}
