/**
 * useAssignment.ts - 智能排位引擎 v2（模拟退火）
 *
 * 核心特性：
 * - 保留原有 runAssignment（贪婪）和 runRandomAssignment 作为降级方案
 * - 新增 runSmartAssignment，采用模拟退火 + 规则 DSL
 * - 支持旧联系关系数据的自动转换
 */
import { ref } from 'vue'
import { useStudentData } from './useStudentData'
import { useSeatChart } from './useSeatChart'
import { useZoneData } from './useZoneData'
import { useSeatRules } from './useSeatRules'
import { useUndo } from './useUndo'
import { PENALTY_WEIGHTS, RulePriority, PREDICATE_META } from '../constants/ruleTypes'
import { isGuardSeatId, parseSeatId } from '@/utils/seatHelpers'
import {
  areSeatPositionsDeskmates,
  getGroupShape,
  getRowNumberFromPodium,
  getSeatDepthRatio
} from '@/utils/seatTopology'
import { shuffleArray } from '@/utils/shuffleArray'
import type {
  AssignmentIterationInfo,
  LegacyRuleSubject,
  RuleInput,
  RuleParams,
  RulePriority as RulePriorityValue,
  RuleSubject,
  Seat,
  SeatConfig,
  Student
} from '@/types/models'

type AssignmentMap = Map<number, string>

type ExpandedSubject =
  | { type: 'single'; studentId: number }
  | { type: 'pair'; studentId1: number; studentId2: number }

export interface AssignmentRule {
  id?: string
  priority: RulePriorityValue
  predicate: string
  params: RuleParams
  subjects: RuleSubject[]
  subjectMode?: 'single' | 'dual'
  subjectsA?: RuleSubject[]
  subjectsB?: RuleSubject[]
  subject?: LegacyRuleSubject
  not?: boolean
  enabled?: boolean
  logicOperator?: 'AND' | 'OR'
  subRules?: AssignmentRule[] | null
  _subjects?: ExpandedSubject[]
  _subjectStudentIds?: Set<number>
  _numericValues?: Map<number, number>
  _availableGroupIndexes?: number[]
}

interface ViolationResult {
  violated: boolean
  excess?: number
}

type AssignmentSeatInfo =
  | {
      id: string
      guard: true
      groupIndex: null
      columnIndex: null
      rowIndex: null
      normalizedRow: null
      columnType: null
      zoneId: null
      backRatio: null
      globalCol: null
      columnsInGroup: 0
    }
  | {
      id: string
      guard: false
      groupIndex: number
      columnIndex: number
      rowIndex: number
      normalizedRow: number
      columnType: 'wall' | 'aisle' | 'center'
      zoneId: number | null
      backRatio: number | null
      globalCol: number
      columnsInGroup: number
    }

interface AssignmentPairInfo {
  hasGuard: boolean
  sameGroup: boolean
  deskmates: boolean
  distance: number
  euclideanDistance: number
  directlyBehind: number
  adjacentRow: boolean
}

type AssignmentScoringUnit =
  | { type: 'rule'; rule: AssignmentRule; global: true }
  | { type: 'subject'; rule: AssignmentRule; subject: ExpandedSubject; global: false }

interface AssignmentContext {
  studentById: Map<number, Student>
  seatInfoById: Map<string, AssignmentSeatInfo>
  pairInfoCache: Map<string, AssignmentPairInfo | null>
  scoringUnits: AssignmentScoringUnit[]
  unitIndexesByStudentId: Map<number, number[]>
  globalUnitIndexes: number[]
}

interface AnnealingLoopOptions {
  iterations?: number
  tStart?: number
  tEnd?: number
  availableSeats?: Seat[]
  context?: AssignmentContext | null
  onProgress?: ((progress: number, details?: AssignmentIterationInfo) => void) | null
  shouldCancel?: (() => boolean) | null
}

interface PlateauOptions {
  assignedStudentIds?: number[]
  partnerMap?: Map<number, number>
  iterations?: number
  shouldCancel?: (() => boolean) | null
}

interface SmartAssignmentOptions {
  useRules?: boolean
  iterations?: number
  onProgress?: ((progress: number, details?: AssignmentIterationInfo) => void) | null
  algorithm?: 'SA' | 'LEGACY_GREEDY' | 'EXHAUSTIVE'
  nodeLimit?: number
}

interface ReheatConfig {
  tStart: number
  baseThreshold: number
  maxReheats: number
}

interface ProbabilityConfig {
  baseProbViolating: number
  maxProbIncrease: number
  stagnationScale: number
  baseProbEmpty: number
  stagnationThreshold: number
  emptySeatBonus: number
}

interface AssignmentMoveResult {
  accepted: boolean
  newScore: number
  newRequiredScore: number
  newSoftScore: number
  useEmptySeat: boolean
  emptySeatIdx: number
}

interface AssignmentScorePreview {
  score: number
  requiredScore: number
  softScore: number
  updates: Array<[number, number]> | null
}

export interface AssignmentViolationReport {
  rule: AssignmentRule
  violatingSubjects: string[]
  reason: string
}

export interface DistributeEvenlyReport {
  rule: AssignmentRule
  minDistance: number
  avgDistance?: number
  positionedCount?: number
  idealMinDistance?: number
  isIdeal?: boolean
}

export interface AssignmentReport {
  satisfied: AssignmentRule[]
  violated: AssignmentViolationReport[]
  satRate: number
  distributeEvenlyDetails: DistributeEvenlyReport[]
}

type ReheatResult =
  | { shouldReheat: false }
  | { shouldReheat: true; newTemp: number; reheatType: string }

interface AssignmentRunToken {
  id: number
  canceled: boolean
}

const isAssigning = ref(false)
const isAssignmentCancelRequested = ref(false)
const assignmentProgress = ref(0)
const assignmentIterationInfo = ref<AssignmentIterationInfo>({
  i: 0,
  iterations: 0,
  score: 0,
  bestScore: 0,
  reheatCount: 0,
  algorithm: 'SA'
})
let assignmentRunSequence = 0
let currentAssignmentRun: AssignmentRunToken | null = null

export function useAssignment() {
  if (!currentAssignmentRun && !isAssigning.value) {
    isAssignmentCancelRequested.value = false
  }
  const { students } = useStudentData()
  const {
    seats,
    seatConfig,
    clearAllSeats,
    assignStudent,
    getAvailableSeats,
    getEmptySeats,
    getSeatDistance,
    getAdjacentSeats,
    validateRepulsion,
    isInRowRange,
    isColumnType,
    isDirectlyBehind,
    isAdjacentRow,
    isInGroupRange,
    getTotalRows,
    getSeatGroup,
    getGroupConfig
  } = useSeatChart()
  const { zones, getZoneForSeat } = useZoneData()

  // ==================== 布局辅助工具（支持复杂布局） ====================

  // 计算座位的全局列位置（支持每大组不同列数）
  const getGlobalColumn = (groupIndex: number, columnIndex: number) => {
    let globalCol = 0
    for (let g = 0; g < groupIndex; g++) {
      const groupConfig = getGroupConfig ? getGroupConfig(g) : { columns: seatConfig.value.columnsPerGroup }
      globalCol += groupConfig.columns
    }
    globalCol += columnIndex
    return globalCol
  }

  // 获取所有大组的总列数
  const getTotalColumns = () => {
    return getTotalColumnsFromConfig(seatConfig.value)
  }

  const hasGuardSeat = (...seatIds: string[]) => seatIds.some(seatId => isGuardSeatId(seatId))

  const areSeatIdsDeskmates = (seatId1: string, seatId2: string) => (
    !hasGuardSeat(seatId1, seatId2) &&
    areSeatPositionsDeskmates(parseSeatId(seatId1), parseSeatId(seatId2), seatConfig.value)
  )

  const applyRuleNegation = (rule: AssignmentRule, result: ViolationResult): ViolationResult => {
    if (!rule.not) return result
    return { ...result, violated: !result.violated, excess: undefined }
  }

  const applyGlobalRuleNegation = (
    rule: AssignmentRule,
    positivePenalties: number,
    positiveSatisfied: boolean,
    evaluated = true
  ) => {
    if (!rule.not || !evaluated) return positivePenalties
    const weight = PENALTY_WEIGHTS[rule.priority] ?? PENALTY_WEIGHTS.optional
    return positiveSatisfied ? weight : 0
  }

  // ==================== 随机工具 ====================

  const pickRandom = <T>(array: T[]): T | null => {
    if (array.length === 0) return null
    return array[Math.floor(Math.random() * array.length)]
  }

  const pickRandomPair = <T>(array: T[]): [T, T] | null => {
    if (array.length < 2) return null
    const shuffled = shuffleArray(array)
    return [shuffled[0]!, shuffled[1]!]
  }

  // ==================== 理想距离计算（基于学生数和教室尺寸） ====================

  // 辅助函数：基于传入的 seatConfig 计算总列数
  const getTotalColumnsFromConfig = (config: SeatConfig) => {
    let totalCols = 0
    for (let g = 0; g < config.groupCount; g++) {
      const groupConfig = config.groups && config.groups[g]
        ? { columns: config.groups[g].columns || config.columnsPerGroup }
        : { columns: config.columnsPerGroup }
      totalCols += groupConfig.columns
    }
    return totalCols
  }

  // 辅助函数：基于传入的 seatConfig 计算最大行数
  const getMaxRowsFromConfig = (config: SeatConfig) => {
    let maxRows = 0
    for (let g = 0; g < config.groupCount; g++) {
      const groupConfig = config.groups && config.groups[g]
        ? { rows: config.groups[g].rows || config.seatsPerColumn }
        : { rows: config.seatsPerColumn }
      maxRows = Math.max(maxRows, groupConfig.rows)
    }
    return maxRows
  }

  // 辅助函数：基于传入的 seatConfig 计算总座位数
  const getTotalSeatsFromConfig = (config: SeatConfig) => {
    let totalSeats = 0
    for (let g = 0; g < config.groupCount; g++) {
      const groupConfig = config.groups && config.groups[g]
        ? { columns: config.groups[g].columns || config.columnsPerGroup, rows: config.groups[g].rows || config.seatsPerColumn }
        : { columns: config.columnsPerGroup, rows: config.seatsPerColumn }
      totalSeats += groupConfig.columns * groupConfig.rows
    }
    return totalSeats
  }

  const calculateIdealMinDistance = (studentCount: number, currentSeatConfig: SeatConfig | null) => {
    if (studentCount <= 1) return Infinity
    if (!currentSeatConfig) return Math.max(1.41, Math.sqrt(studentCount) * 0.8)

    // 支持复杂布局的计算（基于传入的 seatConfig 参数）
    const totalCols = getTotalColumnsFromConfig(currentSeatConfig)
    const totalRows = getMaxRowsFromConfig(currentSeatConfig)
    const totalSeats = getTotalSeatsFromConfig(currentSeatConfig)

    const maxTheoreticalDistance = Math.sqrt((totalCols - 1) * (totalCols - 1) + (totalRows - 1) * (totalRows - 1))

    const density = studentCount / totalSeats
    const gridSide = Math.ceil(Math.sqrt(studentCount))
    
    let idealMinDistance
    
    if (studentCount <= 3) {
      idealMinDistance = 1.5
    } else if (studentCount <= 8) {
      const baseDistance = 1.41
      const linearGrowth = (studentCount - 1) * 0.15
      idealMinDistance = baseDistance + linearGrowth
    } else {
      const baseDistance = 2.5
      const logGrowth = Math.log10(studentCount - 5) * 0.6
      idealMinDistance = baseDistance + logGrowth
    }
    
    const classroomScaleFactor = Math.min(1.5, maxTheoreticalDistance / 10)
    idealMinDistance = idealMinDistance * classroomScaleFactor
    
    idealMinDistance = Math.max(1.41, idealMinDistance)
    idealMinDistance = Math.min(idealMinDistance, maxTheoreticalDistance * 0.7)
    
    return idealMinDistance
  }

  // ==================== 新引擎：主体展开 ====================

  const normalizeRuleSubjects = (rule: RuleInput): { subjects: RuleSubject[] } => {
    if (Array.isArray(rule.subjects)) {
      return {
        subjects: rule.subjects || []
      }
    }
    if (rule.subjectMode === 'single' || rule.subjectMode === 'dual') {
      return { subjects: [...(rule.subjectsA || []), ...(rule.subjectsB || [])] }
    }

    const subject = rule.subject || {}
    if (subject.kind === 'student') {
      return { subjects: [{ type: 'person', id: subject.id ?? null }] }
    }
    if (subject.kind === 'tag') {
      return { subjects: [{ type: 'tag', id: subject.tagId ?? null }] }
    }
    if (subject.kind === 'pair') {
      return {
        subjects: [{ type: 'person', id: subject.id1 ?? null }, { type: 'person', id: subject.id2 ?? null }]
      }
    }
    if (subject.kind === 'tag_pair') {
      return {
        subjects: [{ type: 'tag', id: subject.tagId1 ?? null }, { type: 'tag', id: subject.tagId2 ?? null }]
      }
    }
    return { subjects: [] }
  }

  const expandEntriesToStudentIds = (entries: RuleSubject[], studentList: Student[]) => {
    const ids = new Set<number>()
    for (const entry of entries || []) {
      if (entry?.type === 'all') {
        for (const s of studentList) ids.add(s.id)
        continue
      }
      if (!entry?.id) continue
      if (entry.type === 'person') ids.add(entry.id)
      if (entry.type === 'tag') {
        for (const s of studentList) {
          if (s.tags && s.tags.includes(entry.id)) ids.add(s.id)
        }
      }
    }
    return [...ids]
  }

  const warnedRules = new Set()
  const MAX_WARNED_RULES = 50

  /**
   * 将规则主体展开为具体的 { studentId } 或 { studentId1, studentId2 } 数组
   */
  const expandSubject = (rule: RuleInput, studentList: Student[]): ExpandedSubject[] => {
    const normalized = normalizeRuleSubjects(rule)
    const expanded = expandEntriesToStudentIds(normalized.subjects, studentList)
    const relation = rule.predicate ? PREDICATE_META[rule.predicate]?.relation || 'single' : 'single'
    const maxSuggestedSubjects = 20

    const warnKey = `${rule.predicate}-${expanded.length}`
    if (expanded.length > maxSuggestedSubjects && !warnedRules.has(warnKey)) {
      console.warn(`Rule "${rule.predicate}" has ${expanded.length} subjects; pair expansion may be expensive.`)
      if (warnedRules.size < MAX_WARNED_RULES) {
        warnedRules.add(warnKey)
      }
    }

    if (relation === 'single') {
      return expanded.map(studentId => ({ type: 'single', studentId }))
    }

    const pairs: ExpandedSubject[] = []
    if (relation === 'ordered_pair') {
      for (const a of expanded) {
        for (const b of expanded) {
          if (a === b) continue
          pairs.push({ type: 'pair', studentId1: a, studentId2: b })
        }
      }
      return pairs
    }

    for (let i = 0; i < expanded.length; i++) {
      for (let j = i + 1; j < expanded.length; j++) {
        pairs.push({ type: 'pair', studentId1: expanded[i], studentId2: expanded[j] })
      }
    }
    return pairs
  }

  const ATTRIBUTE_PREDICATES = new Set([
    'ATTRIBUTE_ROW_GRADIENT',
    'ATTRIBUTE_GROUP_BALANCE',
    'ATTRIBUTE_PAIR_DELTA',
    'ATTRIBUTE_DISTRIBUTE_BANDS'
  ])

  const isAttributePredicate = (predicate: string) => ATTRIBUTE_PREDICATES.has(predicate)

  const buildNumericValueMap = (attributeId: string | undefined, studentList: Student[]) => {
    const values = new Map<number, number>()
    if (!attributeId) return values
    for (const student of studentList) {
      const raw = student.numericAttributes?.[attributeId]
      if (raw === null || raw === undefined) continue
      const value = Number(raw)
      if (Number.isFinite(value)) values.set(student.id, value)
    }
    return values
  }

  const getCompiledSubjects = (rule: AssignmentRule, studentList: Student[]) => {
    return rule._subjects || expandSubject(rule, studentList)
  }

  const getSubjectStudentIds = (subject: ExpandedSubject): number[] => {
    if (subject.type === 'single') return [subject.studentId]
    if (subject.type === 'pair') return [subject.studentId1, subject.studentId2]
    return []
  }

  const buildSubjectStudentIdSet = (subjects: ExpandedSubject[]) => {
    const ids = new Set<number>()
    for (const subject of subjects || []) {
      if (subject.type === 'single') {
        ids.add(subject.studentId)
      } else if (subject.type === 'pair') {
        ids.add(subject.studentId1)
        ids.add(subject.studentId2)
      }
    }
    return ids
  }

  const compileRulesForAssignment = (activeRules: RuleInput[], studentList: Student[], availableSeats: Seat[] = []) => {
    const availableGroupIndexes = [...new Set(
      availableSeats
        .filter(seat => !isGuardSeatId(seat.id) && Number.isInteger(seat.groupIndex))
        .map(seat => seat.groupIndex)
    )].sort((a, b) => a - b)

    const compileOne = (rule: RuleInput): AssignmentRule => {
      const compiled: AssignmentRule = {
        id: rule.id,
        priority: rule.priority ?? RulePriority.PREFER,
        predicate: rule.predicate ?? '',
        params: { ...(rule.params || {}) },
        subjects: [...(rule.subjects || [])],
        subjectMode: rule.subjectMode,
        subjectsA: rule.subjectsA,
        subjectsB: rule.subjectsB,
        subject: rule.subject,
        not: rule.not,
        enabled: rule.enabled,
        logicOperator: rule.logicOperator ?? undefined,
        subRules: undefined
      }
      if (isAttributePredicate(compiled.predicate)) {
        compiled._numericValues = buildNumericValueMap(compiled.params?.attributeId, studentList)
      }
      if (compiled.predicate === 'ATTRIBUTE_GROUP_BALANCE') {
        compiled._availableGroupIndexes = availableGroupIndexes
      }
      if (Array.isArray(rule.subRules)) {
        compiled.subRules = rule.subRules.map(sr => compileOne({
          ...sr,
          priority: compiled.priority,
          subjects: compiled.subjects || sr.subjects || []
        }))
      }
      compiled._subjects = expandSubject(compiled, studentList)
      compiled._subjectStudentIds = buildSubjectStudentIdSet(compiled._subjects)
      return compiled
    }
    const rules = activeRules.map(compileOne)
    const context = buildAssignmentContext(rules, studentList, availableSeats)
    return {
      rules,
      context
    }
  }

  const getNumericValue = (rule: AssignmentRule, studentId: number, studentList: Student[]) => {
    if (rule._numericValues) return rule._numericValues.get(studentId)
    const student = studentList.find(s => s.id === studentId)
    const attributeId = rule.params.attributeId
    if (!attributeId) return undefined
    const raw = student?.numericAttributes?.[attributeId]
    if (raw === null || raw === undefined) return undefined
    const value = Number(raw)
    return Number.isFinite(value) ? value : undefined
  }

  const getSeatBackRatio = (seatId: string | null | undefined) => {
    if (!seatId || isGuardSeatId(seatId)) return null
    const parsed = parseSeatId(seatId)
    return getSeatDepthRatio(parsed, seatConfig.value)
  }

  const checkAttributeGroupViolation = (
    rule: AssignmentRule,
    expandedSubjects: ExpandedSubject[],
    assignment: AssignmentMap,
    studentList: Student[],
    returnDetails = false
  ) => {
    const predicate = rule.predicate
    const params = rule.params || {}
    const weight = PENALTY_WEIGHTS[rule.priority] ?? PENALTY_WEIGHTS.optional
    const positioned = []

    for (const subj of expandedSubjects) {
      if (subj.type !== 'single') continue
      const value = getNumericValue(rule, subj.studentId, studentList)
      if (value === undefined) continue
      const seatId = assignment.get(subj.studentId)
      if (!seatId || isGuardSeatId(seatId)) continue
      const parsed = parseSeatId(seatId)
      if (!parsed) continue
      positioned.push({
        studentId: subj.studentId,
        value,
        seatId,
        groupIndex: parsed.groupIndex,
        rowIndex: parsed.rowIndex,
        backRatio: getSeatBackRatio(seatId)
      })
    }

    if (positioned.length === 0 || (positioned.length === 1 && predicate !== 'ATTRIBUTE_GROUP_BALANCE')) {
      return returnDetails ? { penalties: 0, details: { positionedCount: positioned.length, missingCount: expandedSubjects.length - positioned.length } } : 0
    }

    const finalize = (positivePenalties: number, details: Record<string, number>) => {
      const effectivePenalties = applyGlobalRuleNegation(rule, positivePenalties, positivePenalties <= 0)
      return returnDetails ? { penalties: effectivePenalties, details } : effectivePenalties
    }

    let penalties = 0
    const values = positioned.map(item => item.value)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const valueRange = Math.max(1, maxValue - minValue)

    if (predicate === 'ATTRIBUTE_ROW_GRADIENT') {
      let totalDiff = 0
      for (const item of positioned) {
        if (item.backRatio === null) continue
        const valueRatio = (item.value - minValue) / valueRange
        const targetBackRatio = params.direction === 'highFront' ? 1 - valueRatio : valueRatio
        const diff = Math.abs(item.backRatio - targetBackRatio)
        totalDiff += diff
        penalties += diff * diff * weight * 1.8
      }
      const avgDiff = totalDiff / positioned.length
      return finalize(penalties, { positionedCount: positioned.length, avgDiff })
    }

    if (predicate === 'ATTRIBUTE_GROUP_BALANCE') {
      const participatingGroupIndexes = new Set(rule._availableGroupIndexes || [])
      for (const item of positioned) participatingGroupIndexes.add(item.groupIndex)
      if (participatingGroupIndexes.size <= 1) {
        return finalize(0, {
          positionedCount: positioned.length,
          groupCount: participatingGroupIndexes.size,
          emptyGroupCount: 0
        })
      }

      const groupMap = new Map<number, { sum: number; count: number }>()
      for (const groupIndex of participatingGroupIndexes) {
        groupMap.set(groupIndex, { sum: 0, count: 0 })
      }
      for (const item of positioned) {
        const group = groupMap.get(item.groupIndex) || { sum: 0, count: 0 }
        group.sum += item.value
        group.count += 1
        groupMap.set(item.groupIndex, group)
      }

      const groups = [...groupMap.values()]
      const emptyGroupCount = groups.filter(group => group.count === 0).length
      const metrics = params.aggregate === 'sum'
        ? groups.map(group => group.sum)
        : groups.filter(group => group.count > 0).map(group => group.sum / group.count)
      if (params.aggregate !== 'sum' && emptyGroupCount > 0) {
        penalties += emptyGroupCount * weight
      }
      if (metrics.length <= 1) {
        return finalize(penalties, {
          positionedCount: positioned.length,
          groupCount: groups.length,
          emptyGroupCount
        })
      }
      const mean = metrics.reduce((sum, value) => sum + value, 0) / metrics.length
      for (const metric of metrics) {
        const normalizedDiff = Math.abs(metric - mean) / valueRange
        penalties += normalizedDiff * normalizedDiff * weight * 2.5
      }
      return finalize(penalties, {
        positionedCount: positioned.length,
        groupCount: groups.length,
        emptyGroupCount
      })
    }

    if (predicate === 'ATTRIBUTE_DISTRIBUTE_BANDS') {
      const bandCount = Math.max(2, Number(params.bandCount || 3))
      const sorted = [...positioned].sort((a, b) => a.value - b.value)
      const bandByStudent = new Map<number, number>()
      sorted.forEach((item, index) => {
        const band = Math.min(bandCount - 1, Math.floor(index / Math.max(1, sorted.length / bandCount)))
        bandByStudent.set(item.studentId, band)
      })
      const bandGroupCounts = new Map<string, number>()
      for (const item of positioned) {
        const band = bandByStudent.get(item.studentId)
        const key = `${band}:${item.groupIndex}`
        bandGroupCounts.set(key, (bandGroupCounts.get(key) || 0) + 1)
      }
      for (let band = 0; band < bandCount; band++) {
        const counts: number[] = []
        for (let groupIndex = 0; groupIndex < seatConfig.value.groupCount; groupIndex++) {
          counts.push(bandGroupCounts.get(`${band}:${groupIndex}`) || 0)
        }
        const max = Math.max(...counts)
        const min = Math.min(...counts)
        penalties += (max - min) * weight * 0.45
      }
      return finalize(penalties, { positionedCount: positioned.length, bandCount })
    }

    return finalize(0, { positionedCount: positioned.length })
  }

  const checkAttributePairViolation = (
    rule: AssignmentRule,
    subject: ExpandedSubject,
    studentList: Student[]
  ): ViolationResult => {
    if (rule.predicate !== 'ATTRIBUTE_PAIR_DELTA') return { violated: false, excess: 0 }
    if (subject.type !== 'pair') return { violated: false, excess: 0 }
    const value1 = getNumericValue(rule, subject.studentId1, studentList)
    const value2 = getNumericValue(rule, subject.studentId2, studentList)
    if (value1 === undefined || value2 === undefined) return { violated: false, excess: 0 }
    const diff = Math.abs(value1 - value2)
    const maxDelta = Number(rule.params?.maxDelta ?? Infinity)
    const violated = diff > maxDelta
    return applyRuleNegation(rule, { violated, excess: violated ? diff - maxDelta : 0 })
  }

  // ==================== 新引擎：违规检测 ====================

  /**
   * 检查单条规则是否违规
   * @param {object} rule - 规则对象（支持 not 字段取反）
   * @param {object} subject - 已展开的 subject（{ type, studentId } 或 { type, studentId1, studentId2 }）
   * @param {Map} assignment - studentId -> seatId 的映射
   * @returns {{ violated: boolean, excess?: number }} 违规信息
   */
  const checkViolation = (rule: AssignmentRule, subject: ExpandedSubject, assignment: AssignmentMap): ViolationResult => {
    const { predicate, params, not } = rule

    const getSeat = (studentId: number) => assignment.get(studentId)

    // 内部检测函数
    const detect = () => {
      if (subject.type === 'single') {
        const seatId = getSeat(subject.studentId)
        if (!seatId) return { violated: false }

        switch (predicate) {
          case 'IN_ROW_RANGE':
            if (hasGuardSeat(seatId)) return { violated: true }
            return { violated: !isInRowRange(seatId, params.minRow ?? 1, params.maxRow ?? Number.MAX_SAFE_INTEGER) }
          case 'NOT_IN_COLUMN_TYPE':
            if (hasGuardSeat(seatId)) return { violated: false }
            return {
              violated: isColumnType(
                seatId,
                params.columnType === 'edge' || params.columnType === 'aisle' ||
                  params.columnType === 'wall' || params.columnType === 'center'
                  ? params.columnType
                  : 'center'
              )
            }
          case 'IN_ZONE': {
            if (hasGuardSeat(seatId)) return { violated: true }
            const zone = getZoneForSeat(seatId)
            return { violated: !zone || zone.id !== params.zoneId }
          }
          case 'NOT_IN_ZONE': {
            if (hasGuardSeat(seatId)) return { violated: false }
            const zone = getZoneForSeat(seatId)
            return { violated: zone?.id === params.zoneId }
          }
          case 'IN_GROUP_RANGE':
            if (hasGuardSeat(seatId)) return { violated: true }
            return { violated: !isInGroupRange(seatId, params.minGroup ?? 1, params.maxGroup ?? Number.MAX_SAFE_INTEGER) }
          default:
            return { violated: false }
        }
      }

      if (subject.type === 'pair') {
        const seatId1 = getSeat(subject.studentId1)
        const seatId2 = getSeat(subject.studentId2)
        if (!seatId1 || !seatId2) return { violated: false }

        switch (predicate) {
          case 'MUST_BE_SEATMATES':
            if (hasGuardSeat(seatId1, seatId2)) return { violated: true }
            return { violated: !areSeatIdsDeskmates(seatId1, seatId2) }
          case 'MUST_NOT_BE_SEATMATES':
            if (hasGuardSeat(seatId1, seatId2)) return { violated: false }
            return { violated: areSeatIdsDeskmates(seatId1, seatId2) }
          case 'DISTANCE_AT_MOST': {
            const maxDistance = params.distance ?? 0
            if (hasGuardSeat(seatId1, seatId2)) return { violated: true, excess: maxDistance }
            const dist = getSeatDistance(seatId1, seatId2)
            const violated = dist > maxDistance
            const excess = violated ? dist - maxDistance : 0
            return { violated, excess }
          }
          case 'DISTANCE_AT_LEAST': {
            if (hasGuardSeat(seatId1, seatId2)) return { violated: false, excess: 0 }
            const p1 = parseSeatId(seatId1)
            const p2 = parseSeatId(seatId2)
            const dist = p1.groupIndex === p2.groupIndex
              ? Math.sqrt(
                Math.pow(p1.columnIndex - p2.columnIndex, 2) +
                Math.pow(p1.rowIndex - p2.rowIndex, 2)
              )
              : Infinity
            const minDistance = params.distance ?? 0
            const violated = dist < minDistance
            const excess = violated ? minDistance - dist : 0
            return { violated, excess }
          }
          case 'NOT_BLOCK_VIEW': {
            if (hasGuardSeat(seatId1, seatId2)) return { violated: false }
            const tolerance = params.tolerance ?? 0
            return { violated: isDirectlyBehind(seatId1, seatId2, tolerance) }
          }
          case 'MUST_BE_SAME_GROUP': {
            if (hasGuardSeat(seatId1, seatId2)) return { violated: true }
            const p1 = parseSeatId(seatId1)
            const p2 = parseSeatId(seatId2)
            return { violated: p1.groupIndex !== p2.groupIndex }
          }
          case 'MUST_NOT_BE_SAME_GROUP': {
            if (hasGuardSeat(seatId1, seatId2)) return { violated: false }
            const p1 = parseSeatId(seatId1)
            const p2 = parseSeatId(seatId2)
            return { violated: p1.groupIndex === p2.groupIndex }
          }
          case 'MUST_BE_ADJACENT_ROW':
            if (hasGuardSeat(seatId1, seatId2)) return { violated: true }
            return { violated: !isAdjacentRow(seatId1, seatId2) }
          default:
            return { violated: false }
        }
      }

      return { violated: false }
    }

    // 执行检测并应用 NOT 取反
    const result = detect()
    return not ? applyRuleNegation(rule, result) : result
  }

  const getClusterBucketKey = (seatId: string, scope: unknown): string | null => {
    if (isGuardSeatId(seatId)) return null
    if (scope === 'group') return `group:${parseSeatId(seatId).groupIndex}`
    const zone = getZoneForSeat(seatId)
    return zone ? `zone:${zone.id}` : `unassigned:${seatId}`
  }

  /**
   * 检查分组分散/聚集谓词（需要整体视角）
   * DISTRIBUTE_EVENLY: 基于直线距离的两两分散（最大化最小距离）
   * CLUSTER_TOGETHER: 基于区域聚集
   */
  const checkGroupViolation = (
    rule: AssignmentRule,
    expandedSubjects: ExpandedSubject[],
    assignment: AssignmentMap,
    returnDetails = false
  ) => {
    const { predicate, params } = rule
    let penalties = 0
    let details = null
    let evaluated = false
    let positiveSatisfied = true

    if (predicate === 'DISTRIBUTE_EVENLY') {
      // 收集已分配学生的座位信息
      const positioned = []
      for (const subj of expandedSubjects) {
        if (subj.type !== 'single') continue
        const seatId = assignment.get(subj.studentId)
        if (!seatId) continue
        if (isGuardSeatId(seatId)) continue
        const parsed = parseSeatId(seatId)
        // 计算全局列号：跨大组的连续坐标（支持每大组不同列数）
        const globalCol = getGlobalColumn(parsed.groupIndex, parsed.columnIndex)
        positioned.push({
          studentId: subj.studentId,
          seatId,
          globalCol,
          row: parsed.rowIndex
        })
      }

      if (positioned.length <= 1) {
        if (returnDetails) {
          return { penalties: 0, minDistance: Infinity, avgDistance: 0 }
        }
        return 0
      }

      // 计算所有学生两两之间的欧几里得距离
      let minDistance = Infinity
      let totalDistance = 0
      let pairCount = 0
      const closePairs = [] // 记录距离过近的学生对
      const adjacentPairs = [] // 记录相邻的学生对（距离 < 1.5）
      const distanceOnePairs = [] // 记录距离为1的学生对（优先处理）

      for (let i = 0; i < positioned.length; i++) {
        for (let j = i + 1; j < positioned.length; j++) {
          const a = positioned[i]
          const b = positioned[j]
          // 欧几里得距离（使用全局坐标）
          const colDiff = Math.abs(a.globalCol - b.globalCol)
          const rowDiff = Math.abs(a.row - b.row)
          const distance = Math.sqrt(colDiff * colDiff + rowDiff * rowDiff)

          totalDistance += distance
          pairCount++

          if (distance < minDistance) {
            minDistance = distance
          }

          // 记录距离为1的学生对（优先处理）
          if (distance <= 1.01 && distance >= 0.99) {
            distanceOnePairs.push({ studentId1: a.studentId, studentId2: b.studentId, distance })
          }
          
          // 记录距离小于1.5的学生对（相邻）
          if (distance < 1.5) {
            adjacentPairs.push({ studentId1: a.studentId, studentId2: b.studentId, distance })
          }

          // 距离小于阈值时记录（阈值=3，提高检测灵敏度）
          if (distance < 3) {
            closePairs.push({ studentId1: a.studentId, studentId2: b.studentId, distance })
          }
        }
      }

      const avgDistance = pairCount > 0 ? totalDistance / pairCount : 0
      evaluated = true

      // 优化后的惩罚策略：优先分开距离为1的对象
      // 1. 距离为1的极高优先级惩罚：最优先处理距离正好为1的情况
      for (const pair of distanceOnePairs) {
        penalties += PENALTY_WEIGHTS[rule.priority] * 5.0
      }

      // 2. 最小距离惩罚：核心策略 - 强烈惩罚小的最小距离
      // 使用基于学生数量和教室尺寸的理想距离算法
      const idealMinDistance = calculateIdealMinDistance(positioned.length, seatConfig.value)
      
      if (minDistance < idealMinDistance) {
        const diff = idealMinDistance - minDistance
        penalties += diff * diff * PENALTY_WEIGHTS[rule.priority] * 0.8
      }

      // 3. 过近pair惩罚：对每对距离过近的学生进行额外惩罚
      for (const pair of closePairs) {
        penalties += (3 - pair.distance) * PENALTY_WEIGHTS[rule.priority] * 0.4
      }

      // 4. 平均距离奖励/惩罚：鼓励整体分布均匀，但优先级低于最小距离
      const idealAvg = Math.sqrt(positioned.length) * 2
      if (avgDistance < idealAvg && positioned.length > 2) {
        penalties += (idealAvg - avgDistance) * PENALTY_WEIGHTS[rule.priority] * 0.15
      }

      // 5. 最小距离的额外奖励：如果最小距离很大，给予负惩罚（即奖励）
      if (minDistance > idealMinDistance * 1.5) {
        penalties -= (minDistance - idealMinDistance * 1.5) * PENALTY_WEIGHTS[rule.priority] * 0.3
      }

      if (returnDetails) {
        details = { 
          minDistance, 
          avgDistance, 
          positionedCount: positioned.length,
          idealMinDistance,
          closePairs,
          adjacentPairs,
          distanceOnePairs,
          isIdeal: minDistance >= idealMinDistance && adjacentPairs.length === 0
        }
      }
      positiveSatisfied = (minDistance >= idealMinDistance && adjacentPairs.length === 0) || penalties <= 0
    }

    if (predicate === 'CLUSTER_TOGETHER') {
      // 统计不同大组/区域的数量，越多违规越重
      const keySet = new Set<string>()
      let positionedCount = 0
      for (const subj of expandedSubjects) {
        if (subj.type !== 'single') continue
        const seatId = assignment.get(subj.studentId)
        if (!seatId) continue
        const key = getClusterBucketKey(seatId, params.scope)
        if (key === null) continue
        positionedCount++
        keySet.add(key)
      }
      // keySet.size > 1 表示分散，惩罚分散程度
      if (keySet.size > 1) {
        penalties = (keySet.size - 1) * PENALTY_WEIGHTS[rule.priority] * 0.2
      }
      evaluated = positionedCount > 1
      positiveSatisfied = keySet.size <= 1
    }

    penalties = applyGlobalRuleNegation(rule, penalties, positiveSatisfied, evaluated)

    if (returnDetails) {
      return { penalties, details }
    }
    return penalties
  }

  /**
   * 细粒度定位分组规则违规学生（避免整组粗标记）
   * DISTRIBUTE_EVENLY: 返回距离过近的学生（参与近距离pair的学生）
   * CLUSTER_TOGETHER: 返回不在聚集区域的学生
   */
  const getGroupRuleViolatingStudentIds = (
    rule: AssignmentRule,
    expandedSubjects: ExpandedSubject[],
    assignment: AssignmentMap
  ): number[] => {
    const { predicate, params } = rule

    if (predicate === 'DISTRIBUTE_EVENLY') {
      // 收集已分配学生的座位信息
      const positioned = []
      for (const subj of expandedSubjects) {
        if (subj.type !== 'single') continue
        const seatId = assignment.get(subj.studentId)
        if (!seatId) continue
        if (isGuardSeatId(seatId)) continue
        const parsed = parseSeatId(seatId)
        // 计算全局列号：跨大组的连续坐标（支持每大组不同列数）
        const globalCol = getGlobalColumn(parsed.groupIndex, parsed.columnIndex)
        positioned.push({
          studentId: subj.studentId,
          globalCol,
          row: parsed.rowIndex
        })
      }

      if (positioned.length <= 1) return []

      // 找出所有距离过近的pair（距离<3，与优化后的策略保持一致）
      const violatingStudentIds = new Set<number>()
      const threshold = 3

      for (let i = 0; i < positioned.length; i++) {
        for (let j = i + 1; j < positioned.length; j++) {
          const a = positioned[i]
          const b = positioned[j]
          const colDiff = Math.abs(a.globalCol - b.globalCol)
          const rowDiff = Math.abs(a.row - b.row)
          const distance = Math.sqrt(colDiff * colDiff + rowDiff * rowDiff)

          if (distance < threshold) {
            // 距离过近，两个学生都标记为违规
            violatingStudentIds.add(a.studentId)
            violatingStudentIds.add(b.studentId)
          }
        }
      }

      return [...violatingStudentIds]
    }

    if (predicate === 'CLUSTER_TOGETHER') {
      const positioned = []
      for (const subj of expandedSubjects) {
        if (subj.type !== 'single') continue
        const seatId = assignment.get(subj.studentId)
        if (!seatId) continue
        const key = getClusterBucketKey(seatId, params.scope)
        if (key === null) continue
        positioned.push({ studentId: subj.studentId, key })
      }

      if (positioned.length <= 1) return []

      const counts = new Map<string, number>()
      for (const item of positioned) {
        counts.set(item.key, (counts.get(item.key) ?? 0) + 1)
      }
      if (counts.size <= 1) return []

      const dominantKey = [...counts.entries()]
        .sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])))[0]?.[0]
      if (dominantKey == null) return []
      return positioned
        .filter(item => item.key !== dominantKey)
        .map(item => item.studentId)
    }

    return []
  }

  const buildSeatInfo = (seatId: string): AssignmentSeatInfo | null => {
    const guard = isGuardSeatId(seatId)
    if (guard) {
      return {
        id: seatId,
        guard: true,
        groupIndex: null,
        columnIndex: null,
        rowIndex: null,
        normalizedRow: null,
        columnType: null,
        zoneId: null,
        backRatio: null,
        globalCol: null,
        columnsInGroup: 0
      }
    }

    const parsed = parseSeatId(seatId)
    if (!parsed) return null
    const groupConfig = getGroupShape(seatConfig.value, parsed.groupIndex)
    const columnsInGroup = groupConfig.columns
    const isFirstGroup = parsed.groupIndex === 0
    const isLastGroup = parsed.groupIndex === seatConfig.value.groupCount - 1
    const isFirstCol = parsed.columnIndex === 0
    const isLastCol = parsed.columnIndex === columnsInGroup - 1
    const isWall = (isFirstGroup && isFirstCol) || (isLastGroup && isLastCol)
    const isAisle = isFirstCol || isLastCol
    const columnType = isWall ? 'wall' : (isAisle ? 'aisle' : 'center')
    const normalizedRow = getRowNumberFromPodium(parsed, seatConfig.value)
    if (normalizedRow === null) return null
    const zone = getZoneForSeat(seatId)

    return {
      id: seatId,
      guard: false,
      groupIndex: parsed.groupIndex,
      columnIndex: parsed.columnIndex,
      rowIndex: parsed.rowIndex,
      normalizedRow,
      columnType,
      zoneId: zone?.id ?? null,
      backRatio: getSeatBackRatio(seatId),
      globalCol: getGlobalColumn(parsed.groupIndex, parsed.columnIndex),
      columnsInGroup
    }
  }

  const buildPairInfo = (
    seatInfo1: AssignmentSeatInfo | null | undefined,
    seatInfo2: AssignmentSeatInfo | null | undefined
  ): AssignmentPairInfo | null => {
    if (!seatInfo1 || !seatInfo2) return null
    if (seatInfo1.guard || seatInfo2.guard) {
      return {
        hasGuard: true,
        sameGroup: false,
        deskmates: false,
        distance: Infinity,
        euclideanDistance: Infinity,
        directlyBehind: Infinity,
        adjacentRow: false
      }
    }

    const sameGroup = seatInfo1.groupIndex === seatInfo2.groupIndex
    const colDiff = Math.abs(seatInfo1.columnIndex - seatInfo2.columnIndex)
    const rowDiff = Math.abs(seatInfo1.rowIndex - seatInfo2.rowIndex)
    const isInFront = seatInfo1.normalizedRow < seatInfo2.normalizedRow

    return {
      hasGuard: false,
      sameGroup,
      deskmates: sameGroup && areSeatPositionsDeskmates(seatInfo1, seatInfo2, seatConfig.value),
      distance: sameGroup ? colDiff + rowDiff : Infinity,
      euclideanDistance: sameGroup ? Math.sqrt(colDiff * colDiff + rowDiff * rowDiff) : Infinity,
      directlyBehind: sameGroup && isInFront ? colDiff : Infinity,
      adjacentRow: sameGroup && rowDiff === 1
    }
  }

  const getPairInfo = (context: AssignmentContext | null, seatId1: string, seatId2: string) => {
    if (!context) return null
    const key = `${seatId1}|${seatId2}`
    let info = context.pairInfoCache.get(key)
    if (!info) {
      info = buildPairInfo(context.seatInfoById.get(seatId1), context.seatInfoById.get(seatId2))
      context.pairInfoCache.set(key, info)
    }
    return info
  }

  const isFastColumnType = (seatInfo: AssignmentSeatInfo | undefined, columnType: string | undefined) => {
    if (!seatInfo || seatInfo.guard) return false
    if (columnType === 'edge') return seatInfo.columnType === 'wall' || seatInfo.columnType === 'aisle'
    return seatInfo.columnType === columnType
  }

  const fastCheckViolation = (
    rule: AssignmentRule,
    subject: ExpandedSubject,
    assignment: AssignmentMap,
    context: AssignmentContext | null
  ): ViolationResult => {
    if (!context) return checkViolation(rule, subject, assignment)
    const { predicate, params, not } = rule

    const detect = () => {
      if (subject.type === 'single') {
        const seatId = assignment.get(subject.studentId)
        if (!seatId) return { violated: false }
        const seatInfo = context.seatInfoById.get(seatId)
        if (!seatInfo) return checkViolation(rule, subject, assignment)

        switch (predicate) {
          case 'IN_ROW_RANGE':
            if (seatInfo.guard) return { violated: true }
            return {
              violated: seatInfo.normalizedRow < (params.minRow ?? 1) ||
                seatInfo.normalizedRow > (params.maxRow ?? Number.MAX_SAFE_INTEGER)
            }
          case 'NOT_IN_COLUMN_TYPE':
            if (seatInfo.guard) return { violated: false }
            return { violated: isFastColumnType(seatInfo, params.columnType) }
          case 'IN_ZONE':
            if (seatInfo.guard) return { violated: true }
            return { violated: seatInfo.zoneId !== params.zoneId }
          case 'NOT_IN_ZONE':
            if (seatInfo.guard) return { violated: false }
            return { violated: seatInfo.zoneId === params.zoneId }
          case 'IN_GROUP_RANGE': {
            if (seatInfo.guard) return { violated: true }
            const group = seatInfo.groupIndex + 1
            return {
              violated: group < (params.minGroup ?? 1) ||
                group > (params.maxGroup ?? Number.MAX_SAFE_INTEGER)
            }
          }
          default:
            return { violated: false }
        }
      }

      if (subject.type === 'pair') {
        const seatId1 = assignment.get(subject.studentId1)
        const seatId2 = assignment.get(subject.studentId2)
        if (!seatId1 || !seatId2) return { violated: false }
        const pairInfo = getPairInfo(context, seatId1, seatId2)
        if (!pairInfo) return checkViolation(rule, subject, assignment)

        switch (predicate) {
          case 'MUST_BE_SEATMATES':
            if (pairInfo.hasGuard) return { violated: true }
            return { violated: !pairInfo.deskmates }
          case 'MUST_NOT_BE_SEATMATES':
            if (pairInfo.hasGuard) return { violated: false }
            return { violated: pairInfo.deskmates }
          case 'DISTANCE_AT_MOST': {
            const maxDistance = params.distance ?? 0
            if (pairInfo.hasGuard) return { violated: true, excess: maxDistance }
            const violated = pairInfo.distance > maxDistance
            return { violated, excess: violated ? pairInfo.distance - maxDistance : 0 }
          }
          case 'DISTANCE_AT_LEAST': {
            if (pairInfo.hasGuard) return { violated: false, excess: 0 }
            const minDistance = params.distance ?? 0
            const violated = pairInfo.euclideanDistance < minDistance
            return { violated, excess: violated ? minDistance - pairInfo.euclideanDistance : 0 }
          }
          case 'NOT_BLOCK_VIEW':
            if (pairInfo.hasGuard) return { violated: false }
            return { violated: pairInfo.directlyBehind <= (params.tolerance ?? 0) }
          case 'MUST_BE_SAME_GROUP':
            if (pairInfo.hasGuard) return { violated: true }
            return { violated: !pairInfo.sameGroup }
          case 'MUST_NOT_BE_SAME_GROUP':
            if (pairInfo.hasGuard) return { violated: false }
            return { violated: pairInfo.sameGroup }
          case 'MUST_BE_ADJACENT_ROW':
            if (pairInfo.hasGuard) return { violated: true }
            return { violated: !pairInfo.adjacentRow }
          default:
            return { violated: false }
        }
      }

      return { violated: false }
    }

    const result = detect()
    return not ? applyRuleNegation(rule, result) : result
  }

  const isGlobalScoringRule = (rule: AssignmentRule) => {
    if (rule.subRules && rule.subRules.length > 1) return true
    if (rule.predicate === 'DISTRIBUTE_EVENLY' || rule.predicate === 'CLUSTER_TOGETHER') return true
    if (isAttributePredicate(rule.predicate) && rule.predicate !== 'ATTRIBUTE_PAIR_DELTA') return true
    return false
  }

  const scoreSubjectForRule = (
    rule: AssignmentRule,
    subject: ExpandedSubject,
    assignment: AssignmentMap,
    studentList: Student[],
    context: AssignmentContext | null
  ) => {
    const weight = PENALTY_WEIGHTS[rule.priority] ?? PENALTY_WEIGHTS.optional

    if (rule.predicate === 'ATTRIBUTE_PAIR_DELTA') {
      const { violated, excess = 0 } = checkAttributePairViolation(rule, subject, studentList)
      if (!violated) return 0
      return -weight - (excess > 0 ? excess * weight * 0.1 : 0)
    }

    const { violated, excess = 0 } = fastCheckViolation(rule, subject, assignment, context)
    if (!violated) return 0
    return -weight - (excess > 0 ? excess * weight * 0.1 : 0)
  }

  const scoreRule = (
    rule: AssignmentRule,
    assignment: AssignmentMap,
    studentList: Student[],
    context: AssignmentContext | null
  ) => {
    const weight = PENALTY_WEIGHTS[rule.priority] ?? PENALTY_WEIGHTS.optional

    if (rule.subRules && rule.subRules.length > 1) {
      const subScores: number[] = []
      for (const subRule of rule.subRules) {
        if (!subRule.predicate) continue
        const subSubjects = getCompiledSubjects(subRule, studentList)
        let subScore = 0

        if (subRule.predicate === 'DISTRIBUTE_EVENLY' || subRule.predicate === 'CLUSTER_TOGETHER') {
          const result = checkGroupViolation(subRule, subSubjects, assignment)
          subScore = -(typeof result === 'object' ? result.penalties : result)
        } else if (isAttributePredicate(subRule.predicate) && subRule.predicate !== 'ATTRIBUTE_PAIR_DELTA') {
          const result = checkAttributeGroupViolation(subRule, subSubjects, assignment, studentList)
          subScore = -(typeof result === 'object' ? result.penalties : result)
        } else {
          for (const subject of subSubjects) {
            if (subRule.predicate === 'ATTRIBUTE_PAIR_DELTA') {
              const { violated, excess = 0 } = checkAttributePairViolation(subRule, subject, studentList)
              if (violated) {
                subScore -= weight
                if (excess > 0) subScore -= excess * weight * 0.1
              }
            } else {
              const { violated, excess = 0 } = fastCheckViolation(subRule, subject, assignment, context)
              if (violated) {
                subScore -= weight
                if (excess > 0) subScore -= excess * weight * 0.1
              }
            }
          }
        }
        subScores.push(subScore)
      }

      if (rule.logicOperator === 'OR') return Math.max(...subScores)
      return subScores.reduce((sum, s) => sum + s, 0)
    }

    const subjects = getCompiledSubjects(rule, studentList)

    if (rule.predicate === 'DISTRIBUTE_EVENLY' || rule.predicate === 'CLUSTER_TOGETHER') {
      const result = checkGroupViolation(rule, subjects, assignment)
      return -(typeof result === 'object' ? result.penalties : result)
    }

    if (isAttributePredicate(rule.predicate) && rule.predicate !== 'ATTRIBUTE_PAIR_DELTA') {
      const result = checkAttributeGroupViolation(rule, subjects, assignment, studentList)
      return -(typeof result === 'object' ? result.penalties : result)
    }

    let score = 0
    for (const subject of subjects) {
      score += scoreSubjectForRule(rule, subject, assignment, studentList, context)
    }
    return score
  }

  const buildScoringUnits = (rules: AssignmentRule[], studentList: Student[]) => {
    const units: AssignmentScoringUnit[] = []
    const unitIndexesByStudentId = new Map<number, number[]>()
    const globalUnitIndexes: number[] = []

    const addStudentUnitIndex = (studentId: number, unitIndex: number) => {
      if (!unitIndexesByStudentId.has(studentId)) unitIndexesByStudentId.set(studentId, [])
      unitIndexesByStudentId.get(studentId)?.push(unitIndex)
    }

    for (const rule of rules) {
      if (isGlobalScoringRule(rule)) {
        const unitIndex = units.length
        units.push({ type: 'rule', rule, global: true })
        globalUnitIndexes.push(unitIndex)
        continue
      }

      const subjects = getCompiledSubjects(rule, studentList)
      for (const subject of subjects) {
        const unitIndex = units.length
        units.push({ type: 'subject', rule, subject, global: false })
        for (const studentId of getSubjectStudentIds(subject)) {
          addStudentUnitIndex(studentId, unitIndex)
        }
      }
    }

    return { units, unitIndexesByStudentId, globalUnitIndexes }
  }

  const buildAssignmentContext = (
    rules: AssignmentRule[],
    studentList: Student[],
    availableSeats: Seat[]
  ): AssignmentContext => {
    const studentById = new Map<number, Student>()
    for (const student of studentList) {
      studentById.set(student.id, student)
    }

    const seatInfoById = new Map<string, AssignmentSeatInfo>()
    for (const seat of availableSeats || []) {
      const info = buildSeatInfo(seat.id)
      if (info) seatInfoById.set(seat.id, info)
    }

    const scoring = buildScoringUnits(rules, studentList)
    return {
      studentById,
      seatInfoById,
      pairInfoCache: new Map<string, AssignmentPairInfo | null>(),
      scoringUnits: scoring.units,
      unitIndexesByStudentId: scoring.unitIndexesByStudentId,
      globalUnitIndexes: scoring.globalUnitIndexes
    }
  }

  const scoreUnit = (
    unit: AssignmentScoringUnit,
    assignment: AssignmentMap,
    studentList: Student[],
    context: AssignmentContext
  ) => {
    if (unit.type === 'subject') {
      return scoreSubjectForRule(unit.rule, unit.subject, assignment, studentList, context)
    }
    return scoreRule(unit.rule, assignment, studentList, context)
  }

  // ==================== 新引擎：评分函数 ====================

  /**
   * 计算当前分配方案的得分（越接近 0 越好，负数表示违规程度）
   * @param {Map} assignment - studentId -> seatId
   * @param {Array} activeRules - 已启用的规则列表
   * @param {Array} studentList - 学生列表
   */
  const evaluateScore = (
    assignment: AssignmentMap,
    activeRules: AssignmentRule[],
    studentList: Student[],
    context: AssignmentContext | null = null
  ) => {
    if (context?.scoringUnits) {
      let compiledScore = 0
      for (const unit of context.scoringUnits) {
        compiledScore += scoreUnit(unit, assignment, studentList, context)
      }
      return compiledScore
    }

    let score = 0

    for (const rule of activeRules) {
      const weight = PENALTY_WEIGHTS[rule.priority] ?? PENALTY_WEIGHTS.optional

      // 支持复合规则（多规则组合）
      if (rule.subRules && rule.subRules.length > 1) {
        // 对每条子规则分别评估
        const subScores = []
        for (const subRule of rule.subRules) {
          if (!subRule.predicate) continue
          const subSubjects = getCompiledSubjects(subRule, studentList)
          let subScore = 0

          // 分组谓词单独处理
          if (subRule.predicate === 'DISTRIBUTE_EVENLY' || subRule.predicate === 'CLUSTER_TOGETHER') {
            const result = checkGroupViolation(subRule, subSubjects, assignment)
            subScore = -(typeof result === 'object' ? result.penalties : result)
          } else if (isAttributePredicate(subRule.predicate) && subRule.predicate !== 'ATTRIBUTE_PAIR_DELTA') {
            const result = checkAttributeGroupViolation(subRule, subSubjects, assignment, studentList)
            subScore = -(typeof result === 'object' ? result.penalties : result)
          } else if (subRule.predicate === 'ATTRIBUTE_PAIR_DELTA') {
            for (const subject of subSubjects) {
              const { violated, excess = 0 } = checkAttributePairViolation(subRule, subject, studentList)
              if (violated) {
                subScore -= weight
                if (excess > 0) subScore -= excess * weight * 0.1
              }
            }
          } else {
            for (const subject of subSubjects) {
              const { violated, excess = 0 } = fastCheckViolation(subRule, subject, assignment, context)
              if (violated) {
                subScore -= weight
                if (excess > 0) {
                  subScore -= excess * weight * 0.1
                }
              }
            }
          }
          subScores.push(subScore)
        }

        // 应用 AND/OR 逻辑
        if (rule.logicOperator === 'OR') {
          // OR: 取最佳（最接近0）的子分数
          score += Math.max(...subScores)
        } else {
          // AND: 累加所有子规则的惩罚
          score += subScores.reduce((sum, s) => sum + s, 0)
        }
        continue
      }

      // 单条规则评估（原有逻辑）
      const subjects = getCompiledSubjects(rule, studentList)

      // 分组谓词单独处理
      if (rule.predicate === 'DISTRIBUTE_EVENLY' || rule.predicate === 'CLUSTER_TOGETHER') {
        const result = checkGroupViolation(rule, subjects, assignment)
        score -= typeof result === 'object' ? result.penalties : result
        continue
      }

      if (isAttributePredicate(rule.predicate) && rule.predicate !== 'ATTRIBUTE_PAIR_DELTA') {
        const result = checkAttributeGroupViolation(rule, subjects, assignment, studentList)
        score -= typeof result === 'object' ? result.penalties : result
        continue
      }

      if (rule.predicate === 'ATTRIBUTE_PAIR_DELTA') {
        for (const subject of subjects) {
          const { violated, excess = 0 } = checkAttributePairViolation(rule, subject, studentList)
          if (violated) {
            score -= weight
            if (excess > 0) {
              score -= excess * weight * 0.1
            }
          }
        }
        continue
      }

      for (const subject of subjects) {
        const { violated, excess = 0 } = fastCheckViolation(rule, subject, assignment, context)
        if (violated) {
          score -= weight
          if (excess > 0) {
            score -= excess * weight * 0.1
          }
        }
      }
    }

    return score
  }

  const compareLexicographicScores = (
    requiredScoreA: number,
    softScoreA: number,
    requiredScoreB: number,
    softScoreB: number
  ) => {
    if (requiredScoreA !== requiredScoreB) return requiredScoreA - requiredScoreB
    return softScoreA - softScoreB
  }

  const evaluateScoreParts = (
    assignment: AssignmentMap,
    activeRules: AssignmentRule[],
    studentList: Student[],
    context: AssignmentContext | null
  ) => {
    if (context?.scoringUnits) {
      let requiredScore = 0
      let softScore = 0
      for (const unit of context.scoringUnits) {
        const unitScore = scoreUnit(unit, assignment, studentList, context)
        if (unit.rule.priority === RulePriority.REQUIRED) requiredScore += unitScore
        else softScore += unitScore
      }
      return { requiredScore, softScore }
    }

    const requiredRules = activeRules.filter(rule => rule.priority === RulePriority.REQUIRED)
    const softRules = activeRules.filter(rule => rule.priority !== RulePriority.REQUIRED)
    return {
      requiredScore: evaluateScore(assignment, requiredRules, studentList, null),
      softScore: evaluateScore(assignment, softRules, studentList, null)
    }
  }

  // ==================== 新引擎：智能初始解 ====================

  /**
   * 基于 required 规则生成质量较好的初始解
   * 返回 Map<studentId, seatId>
   */
  const generateInitialSolution = (
    studentList: Student[],
    availableSeats: Seat[],
    activeRules: AssignmentRule[]
  ): AssignmentMap => {
    const assignment: AssignmentMap = new Map() // studentId -> seatId
    const occupiedSeats = new Set<string>()
    const assignedStudents = new Set<number>()

    const allZones = zones.value || []

    // 辅助：将学生分配到满足行范围约束的随机座位
    const tryAssignWithRowConstraint = (studentId: number, minRow: number, maxRow: number) => {
      const candidates = availableSeats.filter(s =>
        !occupiedSeats.has(s.id) &&
        isInRowRange(s.id, minRow, maxRow)
      )
      if (candidates.length > 0) {
        const seat = pickRandom(candidates)
        if (!seat) return false
        assignment.set(studentId, seat.id)
        occupiedSeats.add(seat.id)
        assignedStudents.add(studentId)
        return true
      }
      return false
    }

    // Step 1: 处理 required 的 IN_ROW_RANGE 和 IN_GROUP_RANGE 规则
    for (const rule of shuffleArray(activeRules)) {
      if (rule.priority !== RulePriority.REQUIRED) continue
      if (rule.not || (rule.subRules?.length ?? 0) > 1) continue
      if (!['IN_ROW_RANGE', 'IN_GROUP_RANGE'].includes(rule.predicate)) continue

      const subjects = shuffleArray(getCompiledSubjects(rule, studentList))
      for (const subj of subjects) {
        if (subj.type !== 'single') continue
        if (assignedStudents.has(subj.studentId)) continue

        if (rule.predicate === 'IN_ROW_RANGE') {
          tryAssignWithRowConstraint(
            subj.studentId,
            rule.params.minRow ?? 1,
            rule.params.maxRow ?? Number.MAX_SAFE_INTEGER
          )
        } else if (rule.predicate === 'IN_GROUP_RANGE') {
          const candidates = availableSeats.filter(s =>
            !occupiedSeats.has(s.id) &&
            isInGroupRange(
              s.id,
              rule.params.minGroup ?? 1,
              rule.params.maxGroup ?? Number.MAX_SAFE_INTEGER
            )
          )
          if (candidates.length > 0) {
            const seat = pickRandom(candidates)
            if (!seat) continue
            assignment.set(subj.studentId, seat.id)
            occupiedSeats.add(seat.id)
            assignedStudents.add(subj.studentId)
          }
        }
      }
    }

    // Step 1.5: 处理数值前后梯度，生成更合理的初始分布
    for (const rule of shuffleArray(activeRules)) {
      if (rule.priority !== RulePriority.PREFER) continue
      if (rule.not || (rule.subRules?.length ?? 0) > 1) continue
      if (rule.predicate !== 'ATTRIBUTE_ROW_GRADIENT') continue

      const subjects = getCompiledSubjects(rule, studentList)
      const candidates = []
      for (const subj of subjects) {
        if (subj.type !== 'single') continue
        if (assignedStudents.has(subj.studentId)) continue
        const value = getNumericValue(rule, subj.studentId, studentList)
        if (value === undefined) continue
        candidates.push({ studentId: subj.studentId, value })
      }
      if (candidates.length === 0) continue

      const sortedCandidates = shuffleArray(candidates).sort((a, b) => {
        const diff = rule.params?.direction === 'highFront' ? b.value - a.value : a.value - b.value
        return diff
      })
      const sortedSeats = shuffleArray(availableSeats
        .filter(seat => !occupiedSeats.has(seat.id) && !isGuardSeatId(seat.id))
        .map(seat => ({ seat, ratio: getSeatBackRatio(seat.id) ?? 1 })))
        .sort((a, b) => a.ratio - b.ratio)

      for (let i = 0; i < sortedCandidates.length && i < sortedSeats.length; i++) {
        assignment.set(sortedCandidates[i].studentId, sortedSeats[i].seat.id)
        occupiedSeats.add(sortedSeats[i].seat.id)
        assignedStudents.add(sortedCandidates[i].studentId)
      }
    }

    // Step 2: 处理 required 的 MUST_BE_SEATMATES（同桌绑定）
    for (const rule of shuffleArray(activeRules)) {
      if (rule.priority !== RulePriority.REQUIRED) continue
      if (rule.not || (rule.subRules?.length ?? 0) > 1) continue
      if (rule.predicate !== 'MUST_BE_SEATMATES') continue

      const subjects = shuffleArray(getCompiledSubjects(rule, studentList))
      for (const subj of subjects) {
        if (subj.type !== 'pair') continue
        if (assignedStudents.has(subj.studentId1) || assignedStudents.has(subj.studentId2)) continue

        // 找一对同桌空座位
        const deskmatingPairs = []
        for (let i = 0; i < availableSeats.length; i++) {
          if (occupiedSeats.has(availableSeats[i].id)) continue
          for (let j = i + 1; j < availableSeats.length; j++) {
            if (occupiedSeats.has(availableSeats[j].id)) continue
            if (areSeatIdsDeskmates(availableSeats[i].id, availableSeats[j].id)) {
              deskmatingPairs.push([availableSeats[i], availableSeats[j]])
            }
          }
        }
        if (deskmatingPairs.length > 0) {
          const pair = pickRandom(deskmatingPairs)
          if (!pair) continue
          assignment.set(subj.studentId1, pair[0].id)
          assignment.set(subj.studentId2, pair[1].id)
          occupiedSeats.add(pair[0].id)
          occupiedSeats.add(pair[1].id)
          assignedStudents.add(subj.studentId1)
          assignedStudents.add(subj.studentId2)
        }
      }
    }

    // Step 3: 处理选区约束（原有逻辑）
    const zoneSeatMap = new Map<number, Seat[]>()
    for (const seat of availableSeats) {
      if (occupiedSeats.has(seat.id)) continue
      const zone = getZoneForSeat(seat.id)
      if (zone) {
        if (!zoneSeatMap.has(zone.id)) zoneSeatMap.set(zone.id, [])
        zoneSeatMap.get(zone.id)?.push(seat)
      }
    }

    for (const [zoneId, zoneSeats] of zoneSeatMap.entries()) {
      const zone = allZones.find(z => z.id === zoneId)
      if (!zone || !zone.tagIds || zone.tagIds.length === 0) continue

      const eligible = shuffleArray(
        studentList.filter(s => {
          if (assignedStudents.has(s.id)) return false
          if (!s.tags || s.tags.length === 0) return false
          return s.tags.some(tagId => zone.tagIds.includes(tagId))
        })
      )
      const available = shuffleArray(zoneSeats.filter(s => !occupiedSeats.has(s.id)))
      const count = Math.min(eligible.length, available.length)
      for (let i = 0; i < count; i++) {
        assignment.set(eligible[i].id, available[i].id)
        occupiedSeats.add(available[i].id)
        assignedStudents.add(eligible[i].id)
      }
    }

    // Step 4: 随机填充剩余学生到剩余座位
    const remaining = shuffleArray(studentList.filter(s => !assignedStudents.has(s.id)))
    const freeSeats = shuffleArray(availableSeats.filter(s => !occupiedSeats.has(s.id)))
    const count = Math.min(remaining.length, freeSeats.length)
    for (let i = 0; i < count; i++) {
      assignment.set(remaining[i].id, freeSeats[i].id)
      occupiedSeats.add(freeSeats[i].id)
    }

    return assignment
  }

  // ==================== 新引擎：模拟退火辅助类 ====================

  class ScoreTracker {
    activeRules: AssignmentRule[]
    studentList: Student[]
    context: AssignmentContext | null
    unitScores: number[]
    totalScore: number
    requiredScore: number
    softScore: number

    constructor(
      assignment: AssignmentMap,
      activeRules: AssignmentRule[],
      studentList: Student[],
      context: AssignmentContext | null
    ) {
      this.activeRules = activeRules
      this.studentList = studentList
      this.context = context
      this.unitScores = []
      this.totalScore = 0
      this.requiredScore = 0
      this.softScore = 0
      this.rebuild(assignment)
    }

    rebuild(assignment: AssignmentMap) {
      this.unitScores = []
      this.totalScore = 0
      this.requiredScore = 0
      this.softScore = 0
      if (!this.context?.scoringUnits) {
        const parts = evaluateScoreParts(assignment, this.activeRules, this.studentList, this.context)
        this.requiredScore = parts.requiredScore
        this.softScore = parts.softScore
        this.totalScore = parts.requiredScore + parts.softScore
        return
      }
      for (let i = 0; i < this.context.scoringUnits.length; i++) {
        const unit = this.context.scoringUnits[i]
        const unitScore = scoreUnit(unit, assignment, this.studentList, this.context)
        this.unitScores[i] = unitScore
        if (unit.rule.priority === RulePriority.REQUIRED) this.requiredScore += unitScore
        else this.softScore += unitScore
      }
      this.totalScore = this.requiredScore + this.softScore
    }

    getAffectedUnitIndexes(studentIds: number[]) {
      if (!this.context?.scoringUnits) return null
      const affected = new Set(this.context.globalUnitIndexes)
      for (const studentId of studentIds) {
        const indexes = this.context.unitIndexesByStudentId.get(studentId)
        if (!indexes) continue
        for (let i = 0; i < indexes.length; i++) {
          affected.add(indexes[i])
        }
      }
      return affected
    }

    previewScore(assignment: AssignmentMap, studentIds: number[]): AssignmentScorePreview {
      const affected = this.getAffectedUnitIndexes(studentIds)
      if (!affected) {
        const parts = evaluateScoreParts(assignment, this.activeRules, this.studentList, this.context)
        return {
          score: parts.requiredScore + parts.softScore,
          requiredScore: parts.requiredScore,
          softScore: parts.softScore,
          updates: null
        }
      }

      const context = this.context
      if (!context) {
        const parts = evaluateScoreParts(assignment, this.activeRules, this.studentList, null)
        return {
          score: parts.requiredScore + parts.softScore,
          requiredScore: parts.requiredScore,
          softScore: parts.softScore,
          updates: null
        }
      }
      let requiredScore = this.requiredScore
      let softScore = this.softScore
      const updates: Array<[number, number]> = []
      for (const unitIndex of affected) {
        const unit = context.scoringUnits[unitIndex]
        if (!unit) continue
        const newUnitScore = scoreUnit(unit, assignment, this.studentList, context)
        const oldUnitScore = this.unitScores[unitIndex] ?? 0
        if (unit.rule.priority === RulePriority.REQUIRED) {
          requiredScore += newUnitScore - oldUnitScore
        } else {
          softScore += newUnitScore - oldUnitScore
        }
        updates.push([unitIndex, newUnitScore])
      }
      return {
        score: requiredScore + softScore,
        requiredScore,
        softScore,
        updates
      }
    }

    commitPreview(preview: AssignmentScorePreview) {
      this.totalScore = preview.score
      this.requiredScore = preview.requiredScore
      this.softScore = preview.softScore
      if (!preview.updates) return
      for (let i = 0; i < preview.updates.length; i++) {
        const [unitIndex, unitScore] = preview.updates[i]
        this.unitScores[unitIndex] = unitScore
      }
    }
  }

  class AnnealingState {
    current: AssignmentMap
    best: AssignmentMap
    tracker: ScoreTracker
    currentScore: number
    bestScore: number
    currentRequiredScore: number
    currentSoftScore: number
    bestRequiredScore: number
    bestSoftScore: number
    currentReverse: Map<string, number>
    emptySeats: string[]
    stagnationCounter: number
    stagnationSinceBest: number

    constructor(
      initialAssignment: AssignmentMap,
      activeRules: AssignmentRule[],
      studentList: Student[],
      availableSeats: Seat[],
      context: AssignmentContext | null = null
    ) {
      this.current = new Map(initialAssignment)
      this.best = new Map(initialAssignment)
      this.tracker = new ScoreTracker(this.current, activeRules, studentList, context)
      this.currentScore = this.tracker.totalScore
      this.bestScore = this.currentScore
      this.currentRequiredScore = this.tracker.requiredScore
      this.currentSoftScore = this.tracker.softScore
      this.bestRequiredScore = this.currentRequiredScore
      this.bestSoftScore = this.currentSoftScore
      this.currentReverse = this.buildReverse(this.current)
      this.emptySeats = this.buildEmptySeats(availableSeats)
      this.stagnationCounter = 0
      this.stagnationSinceBest = 0
    }

    buildReverse(assignment: AssignmentMap) {
      const rev = new Map<string, number>()
      for (const [sid, seat] of assignment.entries()) {
        rev.set(seat, sid)
      }
      return rev
    }

    buildEmptySeats(availableSeats: Seat[]) {
      return availableSeats
        .map(s => s.id)
        .filter(id => !this.currentReverse.has(id))
    }

    updateBestIfBetter() {
      if (compareLexicographicScores(
        this.currentRequiredScore,
        this.currentSoftScore,
        this.bestRequiredScore,
        this.bestSoftScore
      ) > 0) {
        this.bestScore = this.currentScore
        this.bestRequiredScore = this.currentRequiredScore
        this.bestSoftScore = this.currentSoftScore
        this.best = new Map(this.current)
        this.stagnationCounter = 0
        this.stagnationSinceBest = 0
        return true
      }
      return false
    }

    incrementStagnation() {
      this.stagnationCounter++
      this.stagnationSinceBest++
    }

    rebuildScore(activeRules: AssignmentRule[], studentList: Student[], context: AssignmentContext | null) {
      this.tracker = new ScoreTracker(this.current, activeRules, studentList, context)
      this.currentScore = this.tracker.totalScore
      this.currentRequiredScore = this.tracker.requiredScore
      this.currentSoftScore = this.tracker.softScore
    }
  }

  class ReheatStrategy {
    config: ReheatConfig

    constructor(config: ReheatConfig) {
      this.config = config
    }

    shouldTrigger(_state: AnnealingState, _reheatCount: number): boolean {
      throw new Error('Must implement shouldTrigger')
    }

    execute(
      _state: AnnealingState,
      _reheatCount: number,
      _activeRules: AssignmentRule[],
      _studentList: Student[],
      _availableSeats: Seat[],
      _context: AssignmentContext | null
    ): { newTemp: number; reheatType: string } {
      throw new Error('Must implement execute')
    }
  }

  class SoftJitterReheat extends ReheatStrategy {
    shouldTrigger(state: AnnealingState, reheatCount: number) {
      return state.stagnationCounter > this.config.baseThreshold && 
             reheatCount < this.config.maxReheats &&
             state.stagnationSinceBest <= this.config.baseThreshold * 4
    }

    execute(
      state: AnnealingState,
      reheatCount: number,
      activeRules: AssignmentRule[],
      studentList: Student[],
      availableSeats: Seat[],
      context: AssignmentContext | null
    ) {
      const intensity = 0.5 * Math.pow(0.7, reheatCount - 1)
      const newTemp = this.config.tStart * intensity
      
      state.current = new Map(state.best)
      state.currentReverse = state.buildReverse(state.current)
      
      const pStrength = Math.max(1, Math.floor(state.current.size * 0.05))
      const ids = [...state.current.keys()]
      for (let p = 0; p < pStrength; p++) {
        const s1 = ids[Math.floor(Math.random() * ids.length)]
        const s2 = ids[Math.floor(Math.random() * ids.length)]
        if (s1 === s2) continue
        
        const seat1 = state.current.get(s1)
        const seat2 = state.current.get(s2)
        if (!seat1 || !seat2) continue
        state.current.set(s1, seat2)
        state.current.set(s2, seat1)
        state.currentReverse.set(seat1, s2)
        state.currentReverse.set(seat2, s1)
      }
      
      state.stagnationCounter = 0
      state.rebuildScore(activeRules, studentList, context)
      state.emptySeats = state.buildEmptySeats(availableSeats)
      return { newTemp, reheatType: 'soft_jitter' }
    }
  }

  class GlobalShakeupReheat extends ReheatStrategy {
    shouldTrigger(state: AnnealingState, reheatCount: number) {
      return state.stagnationCounter > this.config.baseThreshold && 
             reheatCount < this.config.maxReheats &&
             state.stagnationSinceBest > this.config.baseThreshold * 4
    }

    execute(
      state: AnnealingState,
      reheatCount: number,
      activeRules: AssignmentRule[],
      studentList: Student[],
      availableSeats: Seat[],
      context: AssignmentContext | null
    ) {
      const intensity = 0.8 * Math.pow(0.8, reheatCount / 2)
      const newTemp = this.config.tStart * intensity
      
      const shuffleCount = Math.max(2, Math.floor(state.current.size * 0.15))
      const ids = [...state.current.keys()]
      for (let p = 0; p < shuffleCount; p++) {
        const s1 = ids[Math.floor(Math.random() * ids.length)]
        const s2 = ids[Math.floor(Math.random() * ids.length)]
        if (s1 === s2) continue
        
        const seat1 = state.current.get(s1)
        const seat2 = state.current.get(s2)
        if (!seat1 || !seat2) continue
        state.current.set(s1, seat2)
        state.current.set(s2, seat1)
        state.currentReverse.set(seat1, s2)
        state.currentReverse.set(seat2, s1)
      }
      
      state.stagnationSinceBest = 0
      state.stagnationCounter = 0
      state.rebuildScore(activeRules, studentList, context)
      state.emptySeats = state.buildEmptySeats(availableSeats)
      return { newTemp, reheatType: 'global_shakeup' }
    }
  }

  class ReheatManager {
    strategies: ReheatStrategy[]
    reheatCount: number

    constructor(strategies: ReheatStrategy[]) {
      this.strategies = strategies
      this.reheatCount = 0
    }

    tryReheat(
      state: AnnealingState,
      activeRules: AssignmentRule[],
      studentList: Student[],
      availableSeats: Seat[],
      context: AssignmentContext | null
    ): ReheatResult {
      for (const strategy of this.strategies) {
        if (strategy.shouldTrigger(state, this.reheatCount)) {
          this.reheatCount++
          const result = strategy.execute(state, this.reheatCount, activeRules, studentList, availableSeats, context)
          return { shouldReheat: true, ...result }
        }
      }
      return { shouldReheat: false }
    }
  }

  class ProbabilityAdjuster {
    config: ProbabilityConfig

    constructor(config: ProbabilityConfig) {
      this.config = config
    }

    getViolatingStudentProbability(stagnationSinceBest: number) {
      return this.config.baseProbViolating + 
             Math.min(this.config.maxProbIncrease, stagnationSinceBest / this.config.stagnationScale)
    }

    getEmptySeatProbability(stagnationSinceBest: number) {
      const baseProb = this.config.baseProbEmpty
      const bonus = stagnationSinceBest > this.config.stagnationThreshold 
        ? this.config.emptySeatBonus 
        : 0
      return baseProb + bonus
    }
  }

  const buildPartnerMap = (activeRules: AssignmentRule[], studentList: Student[]) => {
    const partnerMap = new Map<number, number>()

    const addRulePairs = (rule: AssignmentRule) => {
      const subjects = getCompiledSubjects(rule, studentList)
      subjects.forEach(subject => {
        if (subject.type === 'pair') {
          partnerMap.set(subject.studentId1, subject.studentId2)
          partnerMap.set(subject.studentId2, subject.studentId1)
        }
      })
    }

    activeRules.forEach(rule => {
      if (rule.priority !== RulePriority.REQUIRED || rule.not) return

      if (rule.subRules && rule.subRules.length > 1) {
        if (rule.logicOperator !== 'AND') return
        rule.subRules.forEach(subRule => {
          if (subRule.predicate === 'MUST_BE_SEATMATES' && !subRule.not) addRulePairs(subRule)
        })
        return
      }

      if (rule.predicate === 'MUST_BE_SEATMATES') addRulePairs(rule)
    })
    return partnerMap
  }

  const buildRuleAffectedStudentIds = (
    activeRules: AssignmentRule[],
    studentList: Student[],
    assignedStudentIds: number[]
  ) => {
    const affected = new Set<number>()
    for (const rule of activeRules) {
      for (const subject of getCompiledSubjects(rule, studentList)) {
        for (const studentId of getSubjectStudentIds(subject)) {
          affected.add(studentId)
        }
      }
      if (Array.isArray(rule.subRules)) {
        for (const subRule of rule.subRules) {
          for (const subject of getCompiledSubjects(subRule, studentList)) {
            for (const studentId of getSubjectStudentIds(subject)) {
              affected.add(studentId)
            }
          }
        }
      }
    }

    const assigned = new Set(assignedStudentIds)
    return [...affected].filter(studentId => assigned.has(studentId))
  }

  const computeViolatingStudents = (
    assignment: AssignmentMap,
    activeRules: AssignmentRule[],
    studentList: Student[],
    context: AssignmentContext | null = null
  ): number[] => {
    const violating = new Set<number>()
    for (const rule of activeRules) {
      // 支持复合规则（多规则组合）
      if (rule.subRules && rule.subRules.length > 1) {
        for (const subRule of rule.subRules) {
          if (!subRule.predicate) continue
          const subSubjects = getCompiledSubjects(subRule, studentList)
          if (subRule.predicate === 'DISTRIBUTE_EVENLY' || subRule.predicate === 'CLUSTER_TOGETHER') {
            const groupPenalty = checkGroupViolation(subRule, subSubjects, assignment)
            const penaltyValue = typeof groupPenalty === 'object' ? groupPenalty.penalties : groupPenalty
            if (penaltyValue > 0) {
              const groupViolatingIds = getGroupRuleViolatingStudentIds(subRule, subSubjects, assignment)
              for (const studentId of groupViolatingIds) violating.add(studentId)
            }
            continue
          }
          for (const subj of subSubjects) {
            const { violated } = fastCheckViolation(subRule, subj, assignment, context)
            if (violated) {
              if (subj.type === 'single') violating.add(subj.studentId)
              if (subj.type === 'pair') {
                violating.add(subj.studentId1)
                violating.add(subj.studentId2)
              }
            }
          }
        }
        continue
      }

      // 单条规则评估（原有逻辑）
      const subjects = getCompiledSubjects(rule, studentList)
      if (rule.predicate === 'DISTRIBUTE_EVENLY' || rule.predicate === 'CLUSTER_TOGETHER') {
        const groupPenalty = checkGroupViolation(rule, subjects, assignment)
        const penaltyValue = typeof groupPenalty === 'object' ? groupPenalty.penalties : groupPenalty
        if (penaltyValue > 0) {
          const groupViolatingIds = getGroupRuleViolatingStudentIds(rule, subjects, assignment)
          for (const studentId of groupViolatingIds) violating.add(studentId)
        }
        continue
      }
      for (const subj of subjects) {
        const { violated } = fastCheckViolation(rule, subj, assignment, context)
        if (violated) {
          if (subj.type === 'single') violating.add(subj.studentId)
          if (subj.type === 'pair') {
            violating.add(subj.studentId1)
            violating.add(subj.studentId2)
          }
        }
      }
    }
    return [...violating]
  }

  const randomizePlateauSolution = (
    state: AnnealingState,
    activeRules: AssignmentRule[],
    studentList: Student[],
    availableSeats: Seat[],
    context: AssignmentContext | null,
    config: PlateauOptions = {}
  ) => {
    const {
      assignedStudentIds = [...state.best.keys()],
      partnerMap = new Map(),
      iterations = 50000,
      shouldCancel = null
    } = config

    if (assignedStudentIds.length < 2) return

    state.current = new Map(state.best)
    state.currentReverse = state.buildReverse(state.current)
    state.emptySeats = state.buildEmptySeats(availableSeats)
    state.rebuildScore(activeRules, studentList, context)

    const moves = Math.max(200, Math.min(3000, Math.floor(iterations * 0.08)))
    for (let i = 0; i < moves; i++) {
      if (shouldCancel && shouldCancel()) break

      const studentA = assignedStudentIds[Math.floor(Math.random() * assignedStudentIds.length)]
      const seatA = state.current.get(studentA)
      if (!seatA) continue
      const useEmptySeat = state.emptySeats.length > 0 && Math.random() < 0.15
      const isPairMove = partnerMap.has(studentA) && !useEmptySeat && Math.random() < 0.25
      const moveResult = isPairMove
        ? tryPairMove(state, studentA, partnerMap, assignedStudentIds, 0, activeRules, studentList)
        : trySingleMove(state, studentA, assignedStudentIds, useEmptySeat, 0, activeRules, studentList)

      if (!moveResult || !moveResult.accepted) continue

      state.currentScore = moveResult.newScore
      state.currentRequiredScore = moveResult.newRequiredScore
      state.currentSoftScore = moveResult.newSoftScore
      if (moveResult.useEmptySeat && moveResult.emptySeatIdx >= 0) {
        state.emptySeats[moveResult.emptySeatIdx] = seatA
      }
      if (compareLexicographicScores(
        state.currentRequiredScore,
        state.currentSoftScore,
        state.bestRequiredScore,
        state.bestSoftScore
      ) >= 0) {
        state.bestScore = state.currentScore
        state.bestRequiredScore = state.currentRequiredScore
        state.bestSoftScore = state.currentSoftScore
        state.best = new Map(state.current)
      }
    }
  }

  // ==================== 新引擎：模拟退火主循环 ====================

  /**
   * 模拟退火主循环
   * @param {Map} initialAssignment - 初始解 studentId -> seatId
   * @param {Array} activeRules - 有效规则
   * @param {Array} studentList - 学生列表
   * @param {object} config - 配置参数
   */
  const runAnnealingLoop = async (
    initialAssignment: AssignmentMap,
    activeRules: AssignmentRule[],
    studentList: Student[],
    config: AnnealingLoopOptions = {}
  ) => {
    const {
      iterations = 50000,
      tStart = 1000,
      tEnd = 0.01,
      availableSeats = [],
      context = null,
      onProgress = null,
      shouldCancel = null
    } = config

    const state = new AnnealingState(initialAssignment, activeRules, studentList, availableSeats, context)

    const baseReheatThreshold = Math.max(800, Math.floor(iterations * 0.05))
    
    const reheatManager = new ReheatManager([
      new SoftJitterReheat({ tStart, baseThreshold: baseReheatThreshold, maxReheats: 20 }),
      new GlobalShakeupReheat({ tStart, baseThreshold: baseReheatThreshold, maxReheats: 20 })
    ])
    
    const probAdjuster = new ProbabilityAdjuster({
      baseProbViolating: 0.7,
      maxProbIncrease: 0.25,
      stagnationScale: 10000,
      baseProbEmpty: 0.2,
      stagnationThreshold: 5000,
      emptySeatBonus: 0.15
    })

    const partnerMap = buildPartnerMap(activeRules, studentList)
    const assignedStudentIds = [...state.current.keys()]
    const ruleAffectedStudentIds = buildRuleAffectedStudentIds(activeRules, studentList, assignedStudentIds)
    let violatingStudents = computeViolatingStudents(state.current, activeRules, studentList, context)

    if (state.bestRequiredScore === 0 && state.bestSoftScore === 0) {
      randomizePlateauSolution(state, activeRules, studentList, availableSeats, context, {
        assignedStudentIds,
        partnerMap,
        iterations,
        shouldCancel
      })
      return { solution: state.best, score: state.bestScore, reheatCount: reheatManager.reheatCount }
    }
    
    const cooling = Math.pow(tEnd / tStart, 1 / iterations)
    let T = tStart

    for (let i = 0; i < iterations; i++) {
      if (shouldCancel && shouldCancel()) {
        return { solution: state.best, score: state.bestScore, reheatCount: reheatManager.reheatCount, canceled: true }
      }

      T *= cooling

      const reheatResult = reheatManager.tryReheat(state, activeRules, studentList, availableSeats, context)
      if (reheatResult.shouldReheat) {
        T = reheatResult.newTemp
        violatingStudents = computeViolatingStudents(state.current, activeRules, studentList, context)
      }

      const probViolating = probAdjuster.getViolatingStudentProbability(state.stagnationSinceBest)
      const probEmpty = probAdjuster.getEmptySeatProbability(state.stagnationSinceBest)
      
      const useEmptySeat = state.emptySeats.length > 0 && Math.random() < probEmpty
      
      let studentA: number
      if (violatingStudents.length > 0 && Math.random() < probViolating) {
        studentA = violatingStudents[Math.floor(Math.random() * violatingStudents.length)]
      } else if (ruleAffectedStudentIds.length > 0 && Math.random() < 0.65) {
        studentA = ruleAffectedStudentIds[Math.floor(Math.random() * ruleAffectedStudentIds.length)]
      } else {
        studentA = assignedStudentIds[Math.floor(Math.random() * assignedStudentIds.length)]
      }

      const isPairMove = partnerMap.has(studentA) && Math.random() < 0.3
      const seatA = state.current.get(studentA)
      if (!seatA) continue
      let moveResult = null
      
      if (isPairMove && !useEmptySeat) {
        moveResult = tryPairMove(
          state, studentA, partnerMap, assignedStudentIds, 
          T, activeRules, studentList
        )
      } else {
        moveResult = trySingleMove(
          state, studentA, assignedStudentIds, useEmptySeat, 
          T, activeRules, studentList
        )
      }

      if (moveResult) {
        if (moveResult.accepted) {
          state.currentScore = moveResult.newScore
          state.currentRequiredScore = moveResult.newRequiredScore
          state.currentSoftScore = moveResult.newSoftScore
          if (moveResult.useEmptySeat && moveResult.emptySeatIdx >= 0) {
            state.emptySeats[moveResult.emptySeatIdx] = seatA
          }
          if (state.updateBestIfBetter()) {
            if (state.bestRequiredScore === 0 && state.bestSoftScore === 0) {
              if (onProgress) onProgress(100)
              break
            }
          } else {
            state.incrementStagnation()
          }
        } else {
          state.incrementStagnation()
        }
      } else {
        state.incrementStagnation()
      }

      if (i % 500 === 0) {
        violatingStudents = computeViolatingStudents(state.current, activeRules, studentList, context)
      }

      if (onProgress && i % 1000 === 0) {
        onProgress(Math.round((i / iterations) * 100), {
          i,
          iterations,
          score: state.currentScore,
          bestScore: state.bestScore,
          reheatCount: reheatManager.reheatCount,
          algorithm: 'SA'
        })
        await new Promise(r => setTimeout(r, 0))
        if (shouldCancel && shouldCancel()) {
          return { solution: state.best, score: state.bestScore, reheatCount: reheatManager.reheatCount, canceled: true }
        }
      }
    }

    if (!shouldCancel || !shouldCancel()) {
      randomizePlateauSolution(state, activeRules, studentList, availableSeats, context, {
        assignedStudentIds,
        partnerMap,
        iterations,
        shouldCancel
      })
    }

    return { solution: state.best, score: state.bestScore, reheatCount: reheatManager.reheatCount }
  }

  const tryPairMove = (
    state: AnnealingState,
    studentA: number,
    partnerMap: Map<number, number>,
    assignedStudentIds: number[],
    T: number,
    _activeRules: AssignmentRule[],
    _studentList: Student[]
  ): AssignmentMoveResult | null => {
    const partner = partnerMap.get(studentA)
    if (partner === undefined) return null
    const seatPartner = state.current.get(partner)
    const seatA = state.current.get(studentA)
    if (!seatPartner || !seatA) return null
    
    const studentC = assignedStudentIds[Math.floor(Math.random() * assignedStudentIds.length)]
    if (studentC === studentA || studentC === partner) {
      return null
    }
    
    const seatC = state.current.get(studentC)
    if (!seatC) return null
    const adjC = getAdjacentSeats(seatC)
    const seatDId = adjC.length > 0
      ? adjC[Math.floor(Math.random() * adjC.length)].id
      : state.current.get(assignedStudentIds[Math.floor(Math.random() * assignedStudentIds.length)])
    
    if (!seatDId) return null
    const studentD = state.currentReverse.get(seatDId)
    
    if (!studentD || studentD === studentA || studentD === partner || studentD === studentC) {
      return null
    }
    
    const seatD = state.current.get(studentD)
    if (!seatD) return null
    
    state.current.set(studentA, seatC)
    state.current.set(partner, seatD)
    state.current.set(studentC, seatA)
    state.current.set(studentD, seatPartner)
    state.currentReverse.set(seatC, studentA)
    state.currentReverse.set(seatD, partner)
    state.currentReverse.set(seatA, studentC)
    state.currentReverse.set(seatPartner, studentD)
    
    const movedStudents = [studentA, partner, studentC, studentD]
    const scorePreview = state.tracker.previewScore(state.current, movedStudents)
    const newScore = scorePreview.score
    const requiredDelta = scorePreview.requiredScore - state.currentRequiredScore
    const delta = requiredDelta !== 0
      ? requiredDelta
      : scorePreview.softScore - state.currentSoftScore
    const accepted = delta >= 0 || Math.random() < Math.exp(delta / T)
    
    if (!accepted) {
      state.current.set(studentA, seatA)
      state.current.set(partner, seatPartner)
      state.current.set(studentC, seatC)
      state.current.set(studentD, seatD)
      state.currentReverse.set(seatA, studentA)
      state.currentReverse.set(seatPartner, partner)
      state.currentReverse.set(seatC, studentC)
      state.currentReverse.set(seatD, studentD)
    } else {
      state.tracker.commitPreview(scorePreview)
    }
    
    return {
      accepted,
      newScore,
      newRequiredScore: scorePreview.requiredScore,
      newSoftScore: scorePreview.softScore,
      useEmptySeat: false,
      emptySeatIdx: -1
    }
  }

  const trySingleMove = (
    state: AnnealingState,
    studentA: number,
    assignedStudentIds: number[],
    useEmptySeat: boolean,
    T: number,
    _activeRules: AssignmentRule[],
    _studentList: Student[]
  ): AssignmentMoveResult | null => {
    const seatA = state.current.get(studentA)
    if (!seatA) return null
    let seatB: string
    let studentB: number | undefined
    let emptySeatIdx = -1
    
    if (useEmptySeat) {
      emptySeatIdx = Math.floor(Math.random() * state.emptySeats.length)
      seatB = state.emptySeats[emptySeatIdx]
      if (!seatB) return null
      state.current.set(studentA, seatB)
      state.currentReverse.delete(seatA)
      state.currentReverse.set(seatB, studentA)
    } else {
      studentB = assignedStudentIds[Math.floor(Math.random() * assignedStudentIds.length)]
      if (studentB === undefined) return null
      if (studentA === studentB) {
        return null
      }
      const selectedSeat = state.current.get(studentB)
      if (!selectedSeat) return null
      seatB = selectedSeat
      state.current.set(studentA, seatB)
      state.current.set(studentB, seatA)
      state.currentReverse.set(seatA, studentB)
      state.currentReverse.set(seatB, studentA)
    }
    
    const movedStudents = useEmptySeat || studentB === undefined ? [studentA] : [studentA, studentB]
    const scorePreview = state.tracker.previewScore(state.current, movedStudents)
    const newScore = scorePreview.score
    const requiredDelta = scorePreview.requiredScore - state.currentRequiredScore
    const delta = requiredDelta !== 0
      ? requiredDelta
      : scorePreview.softScore - state.currentSoftScore
    const accepted = delta >= 0 || Math.random() < Math.exp(delta / T)
    
    if (!accepted) {
      if (useEmptySeat) {
        state.current.set(studentA, seatA)
        state.currentReverse.delete(seatB)
        state.currentReverse.set(seatA, studentA)
      } else {
        if (studentB === undefined) return null
        state.current.set(studentA, seatA)
        state.current.set(studentB, seatB)
        state.currentReverse.set(seatA, studentA)
        state.currentReverse.set(seatB, studentB)
      }
    } else {
      state.tracker.commitPreview(scorePreview)
    }
    
    return {
      accepted,
      newScore,
      newRequiredScore: scorePreview.requiredScore,
      newSoftScore: scorePreview.softScore,
      useEmptySeat,
      emptySeatIdx
    }
  }

  // ==================== 新引擎：穷举 + 剪枝回溯 ====================



  // ==================== 新引擎：生成审计报告 ====================


  const generateReport = (
    solution: AssignmentMap,
    activeRules: AssignmentRule[],
    studentList: Student[]
  ): AssignmentReport => {
    const satisfied: AssignmentRule[] = []
    const violated: AssignmentViolationReport[] = []
    const distributeEvenlyDetails: DistributeEvenlyReport[] = []

    for (const rule of activeRules) {
      if (rule.subRules && rule.subRules.length > 1) {
        let allSubSatisfied = true
        const anySubSatisfied: boolean[] = []
        const subViolationDetails: string[] = []

        for (const subRule of rule.subRules) {
          if (!subRule.predicate) continue
          const subSubjects = getCompiledSubjects(subRule, studentList)
          let subSatisfied = true
          const subRuleViolations: string[] = []

          if (subRule.predicate === 'DISTRIBUTE_EVENLY' || subRule.predicate === 'CLUSTER_TOGETHER') {
            const result = checkGroupViolation(subRule, subSubjects, solution, true)
            const penalty = typeof result === 'object' ? result.penalties : result
            const details = typeof result === 'object' ? result.details : null

            if (subRule.predicate === 'DISTRIBUTE_EVENLY' && details) {
              distributeEvenlyDetails.push({
                rule: subRule,
                minDistance: details.minDistance,
                avgDistance: details.avgDistance,
                positionedCount: details.positionedCount,
                idealMinDistance: details.idealMinDistance,
                isIdeal: details.isIdeal
              })
            }

            // 对于均匀分散规则：当最小距离理想且互不相邻时就返回成功
            let ruleSatisfied = false
            if (!subRule.not && subRule.predicate === 'DISTRIBUTE_EVENLY' && details?.isIdeal) {
              ruleSatisfied = true
            } else if (penalty <= 0) {
              ruleSatisfied = true
            }

            if (!ruleSatisfied) {
              subSatisfied = false
              
              if (subRule.predicate === 'DISTRIBUTE_EVENLY' && details) {
                // 显示最小距离信息
                const minDistFormatted = details.minDistance === Infinity ? 'N/A' : details.minDistance.toFixed(2)
                const idealDistFormatted = details.idealMinDistance.toFixed(2)
                subRuleViolations.push(`最小距离 ${minDistFormatted}（理想≥${idealDistFormatted}）`)
                
                // 显示距离为1的学生对（最高优先级）
                if (details.distanceOnePairs && details.distanceOnePairs.length > 0) {
                  const oneNames = details.distanceOnePairs.slice(0, 3).map(pair => {
                    const s1 = studentList.find(st => st.id === pair.studentId1)?.name ?? `ID:${pair.studentId1}`
                    const s2 = studentList.find(st => st.id === pair.studentId2)?.name ?? `ID:${pair.studentId2}`
                    return `${s1} & ${s2}`
                  })
                  subRuleViolations.push(`距离为1的学生对：${oneNames.join('、')}${details.distanceOnePairs.length > 3 ? `…等${details.distanceOnePairs.length}对` : ''}`)
                }
                
                // 显示相邻的学生对
                if (details.adjacentPairs && details.adjacentPairs.length > 0) {
                  const adjNames = details.adjacentPairs.slice(0, 3).map(pair => {
                    const s1 = studentList.find(st => st.id === pair.studentId1)?.name ?? `ID:${pair.studentId1}`
                    const s2 = studentList.find(st => st.id === pair.studentId2)?.name ?? `ID:${pair.studentId2}`
                    return `${s1} & ${s2}`
                  })
                  subRuleViolations.push(`相邻学生对：${adjNames.join('、')}${details.adjacentPairs.length > 3 ? `…等${details.adjacentPairs.length}对` : ''}`)
                }
              } else {
                // 原有逻辑
                const focusedStudentIds = getGroupRuleViolatingStudentIds(subRule, subSubjects, solution)
                const names = focusedStudentIds
                  .map(studentId => studentList.find(st => st.id === studentId)?.name ?? `ID:${studentId}`)
                  .slice(0, 3)
                if (names.length > 0) {
                  subRuleViolations.push(`重点定位学生：${names.join('、')}${focusedStudentIds.length > 3 ? `…等${focusedStudentIds.length}人` : ''}`)
                }
              }
            }
          } else if (isAttributePredicate(subRule.predicate)) {
            if (subRule.predicate === 'ATTRIBUTE_PAIR_DELTA') {
              for (const subj of subSubjects) {
                if (subj.type !== 'pair') continue
                const { violated: v } = checkAttributePairViolation(subRule, subj, studentList)
                if (v) {
                  subSatisfied = false
                  const s1 = studentList.find(st => st.id === subj.studentId1)
                  const s2 = studentList.find(st => st.id === subj.studentId2)
                  subRuleViolations.push(`${s1?.name ?? subj.studentId1} & ${s2?.name ?? subj.studentId2}`)
                }
              }
            } else {
              const result = checkAttributeGroupViolation(subRule, subSubjects, solution, studentList, true)
              const penalty = typeof result === 'object' ? result.penalties : result
              if (penalty > 0) {
                subSatisfied = false
                subRuleViolations.push('数值分布偏差')
              }
            }
          } else {
            for (const subj of subSubjects) {
              const { violated: v } = checkViolation(subRule, subj, solution)
              if (v) {
                subSatisfied = false
                if (subj.type === 'single') {
                  const s = studentList.find(st => st.id === subj.studentId)
                  subRuleViolations.push(s?.name ?? `ID:${subj.studentId}`)
                } else if (subj.type === 'pair') {
                  const s1 = studentList.find(st => st.id === subj.studentId1)
                  const s2 = studentList.find(st => st.id === subj.studentId2)
                  subRuleViolations.push(`${s1?.name ?? subj.studentId1} & ${s2?.name ?? subj.studentId2}`)
                }
              }
            }
          }

          anySubSatisfied.push(subSatisfied)
          if (!subSatisfied) {
            allSubSatisfied = false
            subViolationDetails.push(...subRuleViolations)
          }
        }

        let finalSatisfied = false
        if (rule.logicOperator === 'OR') {
          finalSatisfied = anySubSatisfied.some(s => s)
        } else {
          finalSatisfied = allSubSatisfied
        }

        if (finalSatisfied) {
          satisfied.push(rule)
        } else {
          violated.push({
            rule,
            violatingSubjects: [...new Set(subViolationDetails)],
            reason: subViolationDetails.length > 0
              ? `复合规则未满足：${subViolationDetails.slice(0, 3).join('；')}${subViolationDetails.length > 3 ? `…等${subViolationDetails.length}处` : ''}`
              : '复合规则未满足'
          })
        }
        continue
      }

      const subjects = getCompiledSubjects(rule, studentList)
      if (rule.predicate === 'DISTRIBUTE_EVENLY' || rule.predicate === 'CLUSTER_TOGETHER') {
        const result = checkGroupViolation(rule, subjects, solution, true)
        const penalty = typeof result === 'object' ? result.penalties : result
        const details = typeof result === 'object' ? result.details : null

        if (rule.predicate === 'DISTRIBUTE_EVENLY' && details) {
          distributeEvenlyDetails.push({
            rule,
            minDistance: details.minDistance,
            avgDistance: details.avgDistance,
            positionedCount: details.positionedCount,
            idealMinDistance: details.idealMinDistance,
            isIdeal: details.isIdeal
          })
        }

        // 对于均匀分散规则：当最小距离理想且互不相邻时就返回成功
        if (!rule.not && rule.predicate === 'DISTRIBUTE_EVENLY' && details?.isIdeal) {
          satisfied.push(rule)
        } else if (penalty <= 0) {
          satisfied.push(rule)
        } else {
          // 失败时给出不满足的具体学生
          const violationReasons: string[] = []
          
          if (rule.predicate === 'DISTRIBUTE_EVENLY' && details) {
            // 显示最小距离信息
            const minDistFormatted = details.minDistance === Infinity ? 'N/A' : details.minDistance.toFixed(2)
            const idealDistFormatted = details.idealMinDistance.toFixed(2)
            violationReasons.push(`最小距离 ${minDistFormatted}（理想≥${idealDistFormatted}）`)
            
            // 显示距离为1的学生对（最高优先级）
            if (details.distanceOnePairs && details.distanceOnePairs.length > 0) {
              const oneNames = details.distanceOnePairs.slice(0, 3).map(pair => {
                const s1 = studentList.find(st => st.id === pair.studentId1)?.name ?? `ID:${pair.studentId1}`
                const s2 = studentList.find(st => st.id === pair.studentId2)?.name ?? `ID:${pair.studentId2}`
                return `${s1} & ${s2}`
              })
              violationReasons.push(`距离为1的学生对：${oneNames.join('、')}${details.distanceOnePairs.length > 3 ? `…等${details.distanceOnePairs.length}对` : ''}`)
            }
            
            // 显示相邻的学生对
            if (details.adjacentPairs && details.adjacentPairs.length > 0) {
              const adjNames = details.adjacentPairs.slice(0, 3).map(pair => {
                const s1 = studentList.find(st => st.id === pair.studentId1)?.name ?? `ID:${pair.studentId1}`
                const s2 = studentList.find(st => st.id === pair.studentId2)?.name ?? `ID:${pair.studentId2}`
                return `${s1} & ${s2}`
              })
              violationReasons.push(`相邻学生对：${adjNames.join('、')}${details.adjacentPairs.length > 3 ? `…等${details.adjacentPairs.length}对` : ''}`)
            }
            
            // 显示距离过近的学生对
            if (details.closePairs && details.closePairs.length > 0) {
              const closeNames = details.closePairs.slice(0, 3).map(pair => {
                const s1 = studentList.find(st => st.id === pair.studentId1)?.name ?? `ID:${pair.studentId1}`
                const s2 = studentList.find(st => st.id === pair.studentId2)?.name ?? `ID:${pair.studentId2}`
                return `${s1} & ${s2}(${pair.distance.toFixed(1)})`
              })
              violationReasons.push(`过近学生对：${closeNames.join('、')}${details.closePairs.length > 3 ? `…等${details.closePairs.length}对` : ''}`)
            }
          } else {
            // 原有逻辑
            const focusedStudentIds = getGroupRuleViolatingStudentIds(rule, subjects, solution)
            const names = focusedStudentIds
              .map(studentId => studentList.find(st => st.id === studentId)?.name ?? `ID:${studentId}`)
              .slice(0, 3)
            if (names.length > 0) {
              violationReasons.push(`重点定位学生：${names.join('、')}${focusedStudentIds.length > 3 ? `…等${focusedStudentIds.length}人` : ''}`)
            }
          }
          
          violated.push({
            rule,
            violatingSubjects: [],
            reason: violationReasons.length > 0
              ? violationReasons.join('；')
              : '分组约束未满足（存在明显分散/不均衡）'
          })
        }
        continue
      }

      if (isAttributePredicate(rule.predicate)) {
        let isSatisfied = true
        const violationReasons: string[] = []
        if (rule.predicate === 'ATTRIBUTE_PAIR_DELTA') {
          for (const subj of subjects) {
            if (subj.type !== 'pair') continue
            const { violated: v } = checkAttributePairViolation(rule, subj, studentList)
            if (v) {
              isSatisfied = false
              const s1 = studentList.find(st => st.id === subj.studentId1)
              const s2 = studentList.find(st => st.id === subj.studentId2)
              violationReasons.push(`${s1?.name ?? subj.studentId1} & ${s2?.name ?? subj.studentId2}`)
            }
          }
        } else {
          const result = checkAttributeGroupViolation(rule, subjects, solution, studentList, true)
          const penalty = typeof result === 'object' ? result.penalties : result
          if (penalty > 0) {
            isSatisfied = false
            violationReasons.push('数值分布偏差')
          }
        }

        if (isSatisfied) {
          satisfied.push(rule)
        } else {
          violated.push({
            rule,
            violatingSubjects: violationReasons,
            reason: violationReasons.length > 0 ? violationReasons.slice(0, 3).join('、') : '数值规则未满足'
          })
        }
        continue
      }
      let isFullySatisfied = true
      const violationDetails: string[] = []

      for (const subj of subjects) {
        const { violated: v } = checkViolation(rule, subj, solution)
        if (v) {
          isFullySatisfied = false
          if (subj.type === 'single') {
            const s = studentList.find(st => st.id === subj.studentId)
            violationDetails.push(s?.name ?? `ID:${subj.studentId}`)
          } else if (subj.type === 'pair') {
            const s1 = studentList.find(st => st.id === subj.studentId1)
            const s2 = studentList.find(st => st.id === subj.studentId2)
            violationDetails.push(`${s1?.name ?? subj.studentId1} & ${s2?.name ?? subj.studentId2}`)
          }
        }
      }

      if (isFullySatisfied) {
        satisfied.push(rule)
      } else {
        violated.push({
          rule,
          violatingSubjects: violationDetails,
          reason: violationDetails.length > 0
            ? `以下学生未满足：${violationDetails.slice(0, 3).join('、')}${violationDetails.length > 3 ? `…等${violationDetails.length}处` : ''}`
            : '约束未满足'
        })
      }
    }

    const satRate = activeRules.length > 0 ? satisfied.length / activeRules.length : 1

    return { satisfied, violated, satRate, distributeEvenlyDetails }
  }



  // ==================== 主入口：智能排位 ====================

  const createAssignmentInputSignature = (activeRules: readonly RuleInput[]) => JSON.stringify({
    students: students.value,
    seatConfig: seatConfig.value,
    seats: seats.value,
    zones: zones.value,
    activeRules
  })

  const ownsAssignmentRun = (run: AssignmentRunToken) => (
    currentAssignmentRun === run && !run.canceled
  )

  /**
   * 运行智能排位（模拟退火）
   * @param {object} options
   */
  const cancelSmartAssignment = () => {
    if (!currentAssignmentRun || currentAssignmentRun.canceled) return false
    currentAssignmentRun.canceled = true
    isAssignmentCancelRequested.value = true
    return true
  }

  const runSmartAssignment = async (options: SmartAssignmentOptions = {}) => {
    const {
      useRules = true,
      iterations = 100000,
      onProgress = null,
      algorithm = 'SA', // SA, LEGACY_GREEDY, EXHAUSTIVE
      nodeLimit = 2000000
    } = options

    if (isAssigning.value) {
      if (currentAssignmentRun) {
        currentAssignmentRun.canceled = true
      } else {
        isAssigning.value = false
      }
      isAssignmentCancelRequested.value = true
      return { success: false, canceled: true, message: '已请求中断智能排位' }
    }
    const run: AssignmentRunToken = {
      id: ++assignmentRunSequence,
      canceled: false
    }
    currentAssignmentRun = run

    isAssigning.value = true
    isAssignmentCancelRequested.value = false
    assignmentProgress.value = 0
    const startTime = Date.now()

    try {
      const studentList = students.value.map(s => ({ ...s }))
      const availableSeats = getAvailableSeats(seatConfig.value.guardSeats?.includeInAutoAssignment === true)

      if (studentList.length === 0) {
        return { success: false, message: '没有学生数据' }
      }
      if (availableSeats.length === 0) {
        return { success: false, message: '没有可用座位' }
      }
      if (studentList.length > availableSeats.length) {
        return {
          success: false,
          message: `可用座位不足：${studentList.length} 名学生仅有 ${availableSeats.length} 个可用座位，原座位未修改`
        }
      }

      // 收集规则
      const { getActiveRules } = useSeatRules()
      const rawActiveRules = useRules ? [...getActiveRules()] : []
      const inputSignature = createAssignmentInputSignature(rawActiveRules)
      const { rules: activeRules, context: assignmentContext } = useRules
        ? compileRulesForAssignment(rawActiveRules, studentList, availableSeats)
        : { rules: [], context: buildAssignmentContext([], studentList, availableSeats) }

      let solution
      let score = 0
      let finalReheatCount = 0

      // 默认 SA
      const initial = generateInitialSolution(studentList, availableSeats, activeRules)
      assignmentIterationInfo.value = {
        i: 0,
        iterations: activeRules.length > 0 ? iterations : 0,
        score: 0,
        bestScore: 0,
        reheatCount: 0,
        algorithm: 'SA'
      }

      if (activeRules.length > 0) {
        const result = await runAnnealingLoop(initial, activeRules, studentList, {
          iterations,
          availableSeats,
          context: assignmentContext,
          onProgress: (pct, info) => {
            if (!ownsAssignmentRun(run)) return
            assignmentProgress.value = pct
            if (info) assignmentIterationInfo.value = info
            if (onProgress) onProgress(pct)
          },
          shouldCancel: () => !ownsAssignmentRun(run)
        })
        if (result.canceled || !ownsAssignmentRun(run)) {
          return {
            success: false,
            canceled: true,
            message: '已中断智能排位，座位未更改',
            duration: Date.now() - startTime
          }
        }
        solution = result.solution
        score = result.score
        finalReheatCount = result.reheatCount
      } else {
        solution = initial
      }

      const report = generateReport(solution, activeRules, studentList)
      const duration = Date.now() - startTime
      if (!ownsAssignmentRun(run)) {
        return {
          success: false,
          canceled: true,
          message: '已中断智能排位，座位未更改',
          duration: Date.now() - startTime
        }
      }

      const currentRawActiveRules = useRules ? [...getActiveRules()] : []
      if (createAssignmentInputSignature(currentRawActiveRules) !== inputSignature) {
        return {
          success: false,
          canceled: true,
          message: '排位期间输入已变化，结果未应用',
          duration: Date.now() - startTime
        }
      }

      const requiredViolations = report.violated.filter(item => item.rule.priority === RulePriority.REQUIRED)
      if (requiredViolations.length > 0) {
        assignmentProgress.value = 100
        return {
          success: false,
          message: `排位失败：仍有 ${requiredViolations.length} 条必须规则未满足，原座位未修改`,
          score,
          satRate: report.satRate,
          report,
          duration,
          reheatCount: finalReheatCount
        }
      }

      // 必须规则验收通过后再一次性写入结果
      const { recordBatch, createSnapshot } = useUndo()
      const beforeSnapshot = createSnapshot()

      if (!ownsAssignmentRun(run)) {
        return {
          success: false,
          canceled: true,
          message: '已中断智能排位，座位未更改',
          duration: Date.now() - startTime
        }
      }
      clearAllSeats()
      for (const [studentId, seatId] of solution.entries()) {
        assignStudent(seatId, studentId, false)  // recordUndo=false
      }

      const afterSnapshot = createSnapshot()
      recordBatch(beforeSnapshot, afterSnapshot)

      assignmentProgress.value = 100

      // 构建消息，包含均匀分散规则的最小距离信息
      let message = `排位完成 · 满足度 ${Math.round(report.satRate * 100)}% · 耗时 ${duration}ms${finalReheatCount > 0 ? ` · 重加热 ${finalReheatCount} 次` : ''}`
      
      if (report.distributeEvenlyDetails && report.distributeEvenlyDetails.length > 0) {
        const distDetails = report.distributeEvenlyDetails
        if (distDetails.length === 1) {
          const d = distDetails[0]
          const minDistFormatted = d.minDistance === Infinity ? 'N/A' : d.minDistance.toFixed(2)
          message += ` · 最小距离 ${minDistFormatted}`
        } else {
          const minDists = distDetails.map(d => d.minDistance === Infinity ? Infinity : d.minDistance)
          const overallMin = Math.min(...minDists)
          const overallMinFormatted = overallMin === Infinity ? 'N/A' : overallMin.toFixed(2)
          message += ` · ${distDetails.length} 个分散规则 · 最小距离 ${overallMinFormatted}`
        }
      }

      return {
        success: true,
        message,
        solution,
        score,
        satRate: report.satRate,
        report,
        duration,
        reheatCount: finalReheatCount
      }
    } catch (error) {
      return {
        success: false,
        message: `排位失败: ${error instanceof Error ? error.message : String(error)}`
      }
    } finally {
      if (currentAssignmentRun === run) {
        currentAssignmentRun = null
        isAssigning.value = false
        isAssignmentCancelRequested.value = false
      }
    }
  }

  
  return {
    isAssigning,
    isAssignmentCancelRequested,
    assignmentProgress,
    assignmentIterationInfo,
    runSmartAssignment,
    cancelSmartAssignment
  }
}
