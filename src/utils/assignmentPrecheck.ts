import { buildDeskmateAdjacency } from '@/utils/seatTopology'

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
  const subjects = getRuleSubjects(rule)

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
      const studentRules = rulesByStudentId.get(studentId)
      if (studentRules) studentRules.push(rule)
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

const detectDeskmateBindingConflicts = (
  ctx: any,
  ruleFilter: (rule: any) => boolean = () => true
) => {
  const requiredRules = ctx.activeRules.filter((rule: any) => (
    ruleFilter(rule) && (
      (!rule.not && rule.predicate === 'MUST_BE_SEATMATES') ||
      (rule.not && rule.predicate === 'MUST_NOT_BE_SEATMATES')
    )
  ))
  if (requiredRules.length === 0) return { count: 0, details: [], budgetExhausted: false }

  const requiredAdjacency = new Map<any, Set<any>>()
  const pairKeys = new Set()
  const expandedPairs: Array<[any, any]> = []

  for (const rule of requiredRules) {
    const ids = ctx.expandEntriesToStudentIds(getRuleSubjects(rule))
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]
        const b = ids[j]
        const key = a < b ? `${a}:${b}` : `${b}:${a}`
        if (pairKeys.has(key)) continue
        pairKeys.add(key)
        expandedPairs.push([a, b])
        if (!requiredAdjacency.has(a)) requiredAdjacency.set(a, new Set())
        if (!requiredAdjacency.has(b)) requiredAdjacency.set(b, new Set())
        requiredAdjacency.get(a)?.add(b)
        requiredAdjacency.get(b)?.add(a)
      }
    }
  }

  const pairKey = (first: any, second: any) => first < second
    ? `${first}:${second}`
    : `${second}:${first}`

  const details: string[] = []
  const availableRegularSeats = ctx.availableSeats.filter((seat: any) => !isGuardSeatLike(seat))
  const seatAdjacency = buildDeskmateAdjacency(availableRegularSeats, ctx.config)
  const forbiddenRules = ctx.activeRules.filter((rule: any) => (
    ruleFilter(rule) && (
      (!rule.not && rule.predicate === 'MUST_NOT_BE_SEATMATES') ||
      (rule.not && rule.predicate === 'MUST_BE_SEATMATES')
    )
  ))
  const forbiddenPairKeys = new Set<string>()
  for (const rule of forbiddenRules) {
    const ids = ctx.expandEntriesToStudentIds(getRuleSubjects(rule))
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]
        const b = ids[j]
        forbiddenPairKeys.add(a < b ? `${a}:${b}` : `${b}:${a}`)
      }
    }
  }

  const minimumDistanceByPair = new Map<string, number>()
  for (const rule of ctx.activeRules.filter((candidate: any) => (
    ruleFilter(candidate) && !candidate.not && candidate.predicate === 'DISTANCE_AT_LEAST'
  ))) {
    const ids = ctx.expandEntriesToStudentIds(getRuleSubjects(rule))
    const minimumDistance = Number(rule.params?.distance ?? 0)
    if (!Number.isFinite(minimumDistance)) continue
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = pairKey(ids[i], ids[j])
        minimumDistanceByPair.set(key, Math.max(minimumDistanceByPair.get(key) || 0, minimumDistance))
      }
    }
  }

  for (const [a, b] of expandedPairs) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`
    if (!forbiddenPairKeys.has(key)) continue
    const aName = ctx.studentNameMap.get(a) || `学生#${a}`
    const bName = ctx.studentNameMap.get(b) || `学生#${b}`
    details.push(`规则冲突：${aName} 与 ${bName} 同时存在“必须同桌”和“禁止同桌”`)
  }
  if (details.length > 0) return { count: details.length, details, budgetExhausted: false }

  const regularSeatIds = new Set(seatAdjacency.keys())
  const domains = new Map<any, string[]>()
  for (const studentId of requiredAdjacency.keys()) {
    const studentRules = (ctx.rulesByStudentId.get(studentId) || []).filter(ruleFilter)
    const eligibleSeatIds = getEligibleSeatIdsForStudent(ctx, studentId, studentRules)
    domains.set(studentId, [...eligibleSeatIds].filter(seatId => regularSeatIds.has(seatId as string)) as string[])
  }

  const assignment = new Map<any, string>()
  const usedSeatIds = new Set<string>()
  const requestedNodeLimit = Number(ctx.deskmateEmbeddingNodeLimit)
  const nodeLimit = Number.isFinite(requestedNodeLimit) && requestedNodeLimit > 0
    ? Math.floor(requestedNodeLimit)
    : 50000
  let visitedNodes = 0

  const isCompatible = (studentId: any, seatId: string) => {
    const adjacentSeats = seatAdjacency.get(seatId) || new Set<string>()
    for (const [otherStudentId, otherSeatId] of assignment.entries()) {
      if (requiredAdjacency.get(studentId)?.has(otherStudentId) && !adjacentSeats.has(otherSeatId)) {
        return false
      }
      if (forbiddenPairKeys.has(pairKey(studentId, otherStudentId)) && adjacentSeats.has(otherSeatId)) {
        return false
      }
      const minimumDistance = minimumDistanceByPair.get(pairKey(studentId, otherStudentId))
      if (minimumDistance !== undefined) {
        const seat = ctx.seatById.get(seatId)
        const otherSeat = ctx.seatById.get(otherSeatId)
        if (!seat || !otherSeat) return false
        const distance = seat.groupIndex === otherSeat.groupIndex
          ? Math.hypot(
            Number(seat.columnIndex) - Number(otherSeat.columnIndex),
            Number(seat.rowIndex) - Number(otherSeat.rowIndex)
          )
          : Infinity
        if (distance < minimumDistance) return false
      }
    }
    return true
  }

  const search = (): boolean | null => {
    if (assignment.size === requiredAdjacency.size) return true

    let selectedStudentId: any = null
    let selectedCandidates: string[] | null = null
    for (const studentId of requiredAdjacency.keys()) {
      if (assignment.has(studentId)) continue
      const candidates = (domains.get(studentId) || []).filter(seatId =>
        !usedSeatIds.has(seatId) && isCompatible(studentId, seatId)
      )
      if (candidates.length === 0) return false
      if (
        selectedCandidates === null ||
        candidates.length < selectedCandidates.length ||
        (candidates.length === selectedCandidates.length &&
          (requiredAdjacency.get(studentId)?.size || 0) > (requiredAdjacency.get(selectedStudentId)?.size || 0))
      ) {
        selectedStudentId = studentId
        selectedCandidates = candidates
      }
    }

    if (selectedStudentId === null || selectedCandidates === null) return false
    for (const seatId of selectedCandidates) {
      visitedNodes++
      if (visitedNodes > nodeLimit) return null
      assignment.set(selectedStudentId, seatId)
      usedSeatIds.add(seatId)
      const result = search()
      if (result !== false) return result
      usedSeatIds.delete(seatId)
      assignment.delete(selectedStudentId)
    }
    return false
  }

  const embeddingResult = search()
  if (embeddingResult === false) {
    details.push(`同桌绑定不可行：${requiredAdjacency.size} 名学生的绑定关系无法嵌入当前可用座位拓扑`)
  }

  return {
    count: details.length,
    details,
    budgetExhausted: embeddingResult === null
  }
}

const detectSeatCapacityConflicts = (
  ctx: any,
  ruleFilter: (rule: any) => boolean = () => true
) => {
  const details = []
  const renderRuleText = ctx.renderRuleText || ((rule: any) => rule.predicate)

  for (const rule of ctx.activeRules.filter((r: any) => ruleFilter(r) && !r.not && r.predicate === 'IN_ZONE')) {
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

  for (const rule of ctx.activeRules.filter((r: any) => ruleFilter(r) && !r.not && r.predicate === 'IN_ROW_RANGE')) {
    const studentIds = ctx.expandEntriesToStudentIds(getRuleSubjects(rule))
    const { minRow, maxRow } = rule.params || {}
    const eligibleSeats = ctx.availableSeats.filter((seat: any) =>
      !isGuardSeatLike(seat) && ctx.isInRowRange(seat.id, minRow, maxRow)
    )
    if (studentIds.length > eligibleSeats.length) {
      details.push(`排范围容量不足：「${renderRuleText(rule)}」需要 ${studentIds.length} 个座位，但指定排范围只有 ${eligibleSeats.length} 个可用座位`)
    }
  }

  for (const rule of ctx.activeRules.filter((r: any) => ruleFilter(r) && !r.not && r.predicate === 'IN_GROUP_RANGE')) {
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
    if (!POSITION_RULES.has(rule.predicate)) continue

    const zone = rule.predicate === 'IN_ZONE' || rule.predicate === 'NOT_IN_ZONE'
      ? ctx.zoneById.get(rule.params?.zoneId)
      : null
    if ((rule.predicate === 'IN_ZONE' || rule.predicate === 'NOT_IN_ZONE') && !zone) continue
    const zoneSeatIds = zone ? new Set(zone.seatIds || []) : null

    const matchesPositiveRule = (seatId: any) => {
      const seat = ctx.seatById.get(seatId)
      if (!seat) return false

      if (rule.predicate === 'IN_ZONE') {
        return !isGuardSeatLike(seat) && zoneSeatIds?.has(seatId) === true
      }
      if (rule.predicate === 'NOT_IN_ZONE') {
        return isGuardSeatLike(seat) || zoneSeatIds?.has(seatId) !== true
      }
      if (rule.predicate === 'IN_ROW_RANGE') {
        if (isGuardSeatLike(seat)) return false
        const { minRow, maxRow } = rule.params || {}
        return ctx.isInRowRange(seatId, minRow, maxRow)
      }
      if (rule.predicate === 'IN_GROUP_RANGE') {
        if (isGuardSeatLike(seat)) return false
        const { minGroup, maxGroup } = rule.params || {}
        const group1 = seat.groupIndex + 1
        return group1 >= minGroup && group1 <= maxGroup
      }
      if (rule.predicate === 'NOT_IN_COLUMN_TYPE') {
        if (isGuardSeatLike(seat)) return true
        return !ctx.isColumnType(seatId, rule.params?.columnType)
      }
      return true
    }

    eligibleSeats = new Set([...eligibleSeats].filter(seatId => {
      const positiveMatch = matchesPositiveRule(seatId)
      return rule.not ? !positiveMatch : positiveMatch
    }))
  }

  return eligibleSeats
}

const detectStudentFeasibilityConflicts = (
  ctx: any,
  ruleFilter: (rule: any) => boolean = () => true
) => {
  const details = []

  for (const student of ctx.studentList) {
    const studentRules = (ctx.rulesByStudentId.get(student.id) || []).filter(ruleFilter)
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
      rule.priority === REQUIRED_PRIORITY && POSITION_RULES.has(rule.predicate)
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

  const priorityEntries: Array<[string, any]> = []
  for (const rule of ctx.rawActiveRules) {
    if (!rule?.id) continue
    priorityEntries.push([String(rule.id), rule.priority])
    if (!Array.isArray(rule.subRules)) continue
    rule.subRules.forEach((subRule: any, index: number) => {
      if (subRule?.predicate) priorityEntries.push([`${rule.id}:${index}`, rule.priority])
    })
  }
  const priorityByRuleId = new Map(priorityEntries)
  const hardConflicts = conflictList.filter((item: any) => (
    (item.type === 'infeasible' || item.type === 'contradiction') &&
    Array.isArray(item.ruleIds) && item.ruleIds.length > 0 &&
    item.ruleIds.every((ruleId: any) => priorityByRuleId.get(String(ruleId)) === REQUIRED_PRIORITY)
  ))
  const softConflicts = conflictList.filter((item: any) => !hardConflicts.includes(item))
  if (hardConflicts.length > 0) {
    blockingReasons.push(`存在 ${hardConflicts.length} 条必须级不可满足或逻辑矛盾规则`)
    hardConflicts.slice(0, 5).forEach((item: any) => blockingReasons.push(item.message))
  }
  if (softConflicts.length > 0) {
    warnings.push(`存在 ${softConflicts.length} 条建议或可选规则冲突，排位将尽量满足`)
    softConflicts.slice(0, 5).forEach((item: any) => warnings.push(item.message))
  }

  const requiredRuleFilter = (rule: any) => rule.priority === REQUIRED_PRIORITY
  const appendDetectorResults = (
    label: string,
    allResult: { count: number; details: string[] },
    requiredResult: { count: number; details: string[] }
  ) => {
    if (requiredResult.count > 0) {
      blockingReasons.push(`存在 ${requiredResult.count} 处必须级${label}`)
      blockingReasons.push(...requiredResult.details.slice(0, 5))
    }

    const requiredDetails = new Set(requiredResult.details)
    const softDetails = allResult.details.filter(detail => !requiredDetails.has(detail))
    if (softDetails.length > 0) {
      warnings.push(`存在 ${softDetails.length} 处建议或可选规则${label}`)
      warnings.push(...softDetails.slice(0, 5))
    }
  }

  const allDeskmateConflicts = detectDeskmateBindingConflicts(ctx)
  const requiredDeskmateConflicts = detectDeskmateBindingConflicts(ctx, requiredRuleFilter)
  appendDetectorResults(
    '同桌绑定冲突',
    allDeskmateConflicts,
    requiredDeskmateConflicts
  )
  if (allDeskmateConflicts.budgetExhausted || requiredDeskmateConflicts.budgetExhausted) {
    warnings.push('同桌拓扑可行性搜索达到预算上限，本次不据此阻断排位')
  }
  appendDetectorResults(
    '座位容量冲突',
    detectSeatCapacityConflicts(ctx),
    detectSeatCapacityConflicts(ctx, requiredRuleFilter)
  )
  appendDetectorResults(
    '学生位置不可行问题',
    detectStudentFeasibilityConflicts(ctx),
    detectStudentFeasibilityConflicts(ctx, requiredRuleFilter)
  )

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
