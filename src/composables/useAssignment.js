/**
 * useAssignment.js — 智能排位引擎 v2（模拟退火）
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
import { PENALTY_WEIGHTS, RulePriority, PREDICATE_META } from '../constants/ruleTypes.js'

export function useAssignment() {
  const { students } = useStudentData()
  const {
    seats,
    seatConfig,
    clearAllSeats,
    assignStudent,
    areDeskmates,
    getAvailableSeats,
    getEmptySeats,
    getSeatDistance,
    getAdjacentSeats,
    validateRepulsion,
    parseSeatId,
    isInRowRange,
    isColumnType,
    isDirectlyBehind,
    isAdjacentRow,
    isInGroupRange,
    getTotalRows,
    getSeatGroup
  } = useSeatChart()
  const { zones, getZoneForSeat } = useZoneData()

  const isAssigning = ref(false)
  const assignmentProgress = ref(0) // 0~100
  const assignmentIterationInfo = ref({
    i: 0,
    iterations: 0,
    score: 0,
    bestScore: 0,
    reheatCount: 0,
    algorithm: 'SA'
  })

  // ==================== 随机工具 ====================

  const shuffleArray = (array) => {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  const pickRandom = (array) => {
    if (array.length === 0) return null
    return array[Math.floor(Math.random() * array.length)]
  }

  const pickRandomPair = (array) => {
    if (array.length < 2) return null
    const shuffled = shuffleArray(array)
    return [shuffled[0], shuffled[1]]
  }

  // ==================== 新引擎：主体展开 ====================

  const normalizeRuleSubjects = (rule) => {
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
      return { subjects: [{ type: 'person', id: subject.id }] }
    }
    if (subject.kind === 'tag') {
      return { subjects: [{ type: 'tag', id: subject.tagId }] }
    }
    if (subject.kind === 'pair') {
      return {
        subjects: [{ type: 'person', id: subject.id1 }, { type: 'person', id: subject.id2 }]
      }
    }
    if (subject.kind === 'tag_pair') {
      return {
        subjects: [{ type: 'tag', id: subject.tagId1 }, { type: 'tag', id: subject.tagId2 }]
      }
    }
    return { subjects: [] }
  }

  const expandEntriesToStudentIds = (entries, studentList) => {
    const ids = new Set()
    for (const entry of entries || []) {
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

  /**
   * 将规则主体展开为具体的 { studentId } 或 { studentId1, studentId2 } 数组
   */
  const expandSubject = (rule, studentList) => {
    const normalized = normalizeRuleSubjects(rule)
    const expanded = expandEntriesToStudentIds(normalized.subjects, studentList)
    const relation = PREDICATE_META[rule.predicate]?.relation || 'single'
    const maxSuggestedSubjects = 20

    if (expanded.length > maxSuggestedSubjects) {
      console.warn(`Rule "${rule.predicate}" has ${expanded.length} subjects; pair expansion may be expensive.`)
    }

    if (relation === 'single') {
      return expanded.map(studentId => ({ type: 'single', studentId }))
    }

    const pairs = []
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

  // ==================== 新引擎：违规检测 ====================

  /**
   * 检查单条规则是否违规
   * @param {object} rule - 规则对象（支持 not 字段取反）
   * @param {object} subject - 已展开的 subject（{ type, studentId } 或 { type, studentId1, studentId2 }）
   * @param {Map} assignment - studentId -> seatId 的映射
   * @returns {{ violated: boolean, excess?: number }} 违规信息
   */
  const checkViolation = (rule, subject, assignment) => {
    const { predicate, params, not } = rule

    const getSeat = (studentId) => assignment.get(studentId)

    // 内部检测函数
    const detect = () => {
      if (subject.type === 'single') {
        const seatId = getSeat(subject.studentId)
        if (!seatId) return { violated: false }

        switch (predicate) {
          case 'IN_ROW_RANGE':
            return { violated: !isInRowRange(seatId, params.minRow, params.maxRow) }
          case 'NOT_IN_COLUMN_TYPE':
            return { violated: isColumnType(seatId, params.columnType) }
          case 'IN_ZONE': {
            const zone = getZoneForSeat(seatId)
            return { violated: !zone || zone.id !== params.zoneId }
          }
          case 'NOT_IN_ZONE': {
            const zone = getZoneForSeat(seatId)
            return { violated: zone?.id === params.zoneId }
          }
          case 'IN_GROUP_RANGE':
            return { violated: !isInGroupRange(seatId, params.minGroup, params.maxGroup) }
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
            return { violated: !areDeskmates(seatId1, seatId2) }
          case 'MUST_NOT_BE_SEATMATES':
            return { violated: areDeskmates(seatId1, seatId2) }
          case 'DISTANCE_AT_MOST': {
            const dist = getSeatDistance(seatId1, seatId2)
            const violated = dist > params.distance
            const excess = violated ? dist - params.distance : 0
            return { violated, excess }
          }
          case 'DISTANCE_AT_LEAST': {
            const dist = getSeatDistance(seatId1, seatId2)
            const violated = dist < params.distance
            const excess = violated ? params.distance - dist : 0
            return { violated, excess }
          }
          case 'NOT_BLOCK_VIEW': {
            const tolerance = params.tolerance ?? 0
            return { violated: isDirectlyBehind(seatId1, seatId2, tolerance) }
          }
          case 'MUST_BE_SAME_GROUP': {
            const p1 = parseSeatId(seatId1)
            const p2 = parseSeatId(seatId2)
            return { violated: p1.groupIndex !== p2.groupIndex }
          }
          case 'MUST_NOT_BE_SAME_GROUP': {
            const p1 = parseSeatId(seatId1)
            const p2 = parseSeatId(seatId2)
            return { violated: p1.groupIndex === p2.groupIndex }
          }
          case 'MUST_BE_ADJACENT_ROW':
            return { violated: !isAdjacentRow(seatId1, seatId2) }
          default:
            return { violated: false }
        }
      }

      return { violated: false }
    }

    // 执行检测并应用 NOT 取反
    const result = detect()
    if (not) {
      // 取反：violated 变为 !violated
      return { ...result, violated: !result.violated, excess: undefined }
    }
    return result
  }

  /**
   * 检查分组分散/聚集谓词（需要整体视角）
   * DISTRIBUTE_EVENLY: 基于直线距离的两两分散（最大化最小距离）
   * CLUSTER_TOGETHER: 基于区域聚集
   */
  const checkGroupViolation = (rule, expandedSubjects, assignment) => {
    const { predicate, params } = rule
    let penalties = 0

    if (predicate === 'DISTRIBUTE_EVENLY') {
      // 收集已分配学生的座位信息
      const positioned = []
      for (const subj of expandedSubjects) {
        const seatId = assignment.get(subj.studentId)
        if (!seatId) continue
        const parsed = parseSeatId(seatId)
        // 计算全局列号：跨大组的连续坐标
        const { columnsPerGroup } = seatConfig.value
        const globalCol = parsed.groupIndex * columnsPerGroup + parsed.columnIndex
        positioned.push({
          studentId: subj.studentId,
          seatId,
          globalCol,
          row: parsed.rowIndex
        })
      }

      if (positioned.length <= 1) return 0

      // 计算所有学生两两之间的欧几里得距离
      let minDistance = Infinity
      let totalDistance = 0
      let pairCount = 0
      const closePairs = [] // 记录距离过近的学生对

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

          // 距离小于阈值时记录（阈值=2，约等于"相邻或隔一个座位"）
          if (distance < 2) {
            closePairs.push({ studentId1: a.studentId, studentId2: b.studentId, distance })
          }
        }
      }

      const avgDistance = pairCount > 0 ? totalDistance / pairCount : 0

      // 惩罚策略：
      // 1. 最小距离惩罚：如果最近的一对学生坐得太近（<2），按不足程度惩罚
      if (minDistance < 2) {
        penalties += (2 - minDistance) * PENALTY_WEIGHTS[rule.priority] * 0.5
      }

      // 2. 过近pair惩罚：每对距离<2的学生对都额外惩罚
      for (const pair of closePairs) {
        penalties += (2 - pair.distance) * PENALTY_WEIGHTS[rule.priority] * 0.3
      }

      // 3. 平均距离奖励/惩罚：鼓励整体分布均匀
      // 理想平均距离与座位布局相关，这里用经验值
      const idealMinAvg = Math.sqrt(positioned.length) * 1.5
      if (avgDistance < idealMinAvg && positioned.length > 2) {
        penalties += (idealMinAvg - avgDistance) * PENALTY_WEIGHTS[rule.priority] * 0.1
      }
    }

    if (predicate === 'CLUSTER_TOGETHER') {
      // 统计不同大组/区域的数量，越多违规越重
      const keySet = new Set()
      for (const subj of expandedSubjects) {
        const seatId = assignment.get(subj.studentId)
        if (!seatId) continue
        const key = params.scope === 'group'
          ? parseSeatId(seatId).groupIndex
          : (getZoneForSeat(seatId)?.id ?? 'none')
        keySet.add(key)
      }
      // keySet.size > 1 表示分散，惩罚分散程度
      if (keySet.size > 1) {
        penalties = (keySet.size - 1) * PENALTY_WEIGHTS[rule.priority] * 0.2
      }
    }

    return penalties
  }

  /**
   * 细粒度定位分组规则违规学生（避免整组粗标记）
   * DISTRIBUTE_EVENLY: 返回距离过近的学生（参与近距离pair的学生）
   * CLUSTER_TOGETHER: 返回不在聚集区域的学生
   */
  const getGroupRuleViolatingStudentIds = (rule, expandedSubjects, assignment) => {
    const { predicate, params } = rule

    if (predicate === 'DISTRIBUTE_EVENLY') {
      // 收集已分配学生的座位信息
      const positioned = []
      for (const subj of expandedSubjects) {
        if (subj.type !== 'single') continue
        const seatId = assignment.get(subj.studentId)
        if (!seatId) continue
        const parsed = parseSeatId(seatId)
        const { columnsPerGroup } = seatConfig.value
        const globalCol = parsed.groupIndex * columnsPerGroup + parsed.columnIndex
        positioned.push({
          studentId: subj.studentId,
          globalCol,
          row: parsed.rowIndex
        })
      }

      if (positioned.length <= 1) return []

      // 找出所有距离过近的pair（距离<2）
      const violatingStudentIds = new Set()
      const threshold = 2

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
        const key = params.scope === 'group' ? parseSeatId(seatId).groupIndex : (getZoneForSeat(seatId)?.id ?? 'none')
        positioned.push({ studentId: subj.studentId, key })
      }

      if (positioned.length <= 1) return []

      const counts = new Map()
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

  // ==================== 新引擎：评分函数 ====================

  /**
   * 计算当前分配方案的得分（越接近 0 越好，负数表示违规程度）
   * @param {Map} assignment - studentId -> seatId
   * @param {Array} activeRules - 已启用的规则列表
   * @param {Array} studentList - 学生列表
   */
  const evaluateScore = (assignment, activeRules, studentList) => {
    let score = 0

    for (const rule of activeRules) {
      const weight = PENALTY_WEIGHTS[rule.priority] ?? PENALTY_WEIGHTS.optional

      // 支持复合规则（多规则组合）
      if (rule.subRules && rule.subRules.length > 1) {
        // 对每条子规则分别评估
        const subScores = []
        for (const subRule of rule.subRules) {
          if (!subRule.predicate) continue
          const subSubjects = expandSubject(subRule, studentList)
          let subScore = 0

          // 分组谓词单独处理
          if (subRule.predicate === 'DISTRIBUTE_EVENLY' || subRule.predicate === 'CLUSTER_TOGETHER') {
            subScore = -checkGroupViolation(subRule, subSubjects, assignment)
          } else {
            for (const subject of subSubjects) {
              const { violated, excess = 0 } = checkViolation(subRule, subject, assignment)
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
      const subjects = expandSubject(rule, studentList)

      // 分组谓词单独处理
      if (rule.predicate === 'DISTRIBUTE_EVENLY' || rule.predicate === 'CLUSTER_TOGETHER') {
        score -= checkGroupViolation(rule, subjects, assignment)
        continue
      }

      for (const subject of subjects) {
        const { violated, excess = 0 } = checkViolation(rule, subject, assignment)
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

  // ==================== 新引擎：智能初始解 ====================

  /**
   * 基于 required 规则生成质量较好的初始解
   * 返回 Map<studentId, seatId>
   */
  const generateInitialSolution = (studentList, availableSeats, activeRules) => {
    const assignment = new Map() // studentId -> seatId
    const occupiedSeats = new Set()
    const assignedStudents = new Set()

    const allZones = zones.value || []

    // 辅助：将学生分配到满足行范围约束的随机座位
    const tryAssignWithRowConstraint = (studentId, minRow, maxRow) => {
      const candidates = availableSeats.filter(s =>
        !occupiedSeats.has(s.id) &&
        isInRowRange(s.id, minRow, maxRow)
      )
      if (candidates.length > 0) {
        const seat = pickRandom(candidates)
        assignment.set(studentId, seat.id)
        occupiedSeats.add(seat.id)
        assignedStudents.add(studentId)
        return true
      }
      return false
    }

    // Step 1: 处理 required 的 IN_ROW_RANGE 和 IN_GROUP_RANGE 规则
    for (const rule of activeRules) {
      if (rule.priority !== RulePriority.REQUIRED) continue
      if (!['IN_ROW_RANGE', 'IN_GROUP_RANGE'].includes(rule.predicate)) continue

      const subjects = expandSubject(rule, studentList)
      for (const subj of subjects) {
        if (subj.type !== 'single') continue
        if (assignedStudents.has(subj.studentId)) continue

        if (rule.predicate === 'IN_ROW_RANGE') {
          tryAssignWithRowConstraint(subj.studentId, rule.params.minRow, rule.params.maxRow)
        } else if (rule.predicate === 'IN_GROUP_RANGE') {
          const candidates = availableSeats.filter(s =>
            !occupiedSeats.has(s.id) &&
            isInGroupRange(s.id, rule.params.minGroup, rule.params.maxGroup)
          )
          if (candidates.length > 0) {
            const seat = pickRandom(candidates)
            assignment.set(subj.studentId, seat.id)
            occupiedSeats.add(seat.id)
            assignedStudents.add(subj.studentId)
          }
        }
      }
    }

    // Step 2: 处理 required 的 MUST_BE_SEATMATES（同桌绑定）
    for (const rule of activeRules) {
      if (rule.priority !== RulePriority.REQUIRED) continue
      if (rule.predicate !== 'MUST_BE_SEATMATES') continue

      const subjects = expandSubject(rule, studentList)
      for (const subj of subjects) {
        if (subj.type !== 'pair') continue
        if (assignedStudents.has(subj.studentId1) || assignedStudents.has(subj.studentId2)) continue

        // 找一对同桌空座位
        const deskmatingPairs = []
        for (let i = 0; i < availableSeats.length; i++) {
          if (occupiedSeats.has(availableSeats[i].id)) continue
          for (let j = i + 1; j < availableSeats.length; j++) {
            if (occupiedSeats.has(availableSeats[j].id)) continue
            if (areDeskmates(availableSeats[i].id, availableSeats[j].id)) {
              deskmatingPairs.push([availableSeats[i], availableSeats[j]])
            }
          }
        }
        if (deskmatingPairs.length > 0) {
          const pair = pickRandom(deskmatingPairs)
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
    const zoneSeatMap = new Map()
    for (const seat of availableSeats) {
      if (occupiedSeats.has(seat.id)) continue
      const zone = getZoneForSeat(seat.id)
      if (zone) {
        if (!zoneSeatMap.has(zone.id)) zoneSeatMap.set(zone.id, [])
        zoneSeatMap.get(zone.id).push(seat)
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

  class AnnealingState {
    constructor(initialAssignment, activeRules, studentList, availableSeats) {
      this.current = new Map(initialAssignment)
      this.best = new Map(initialAssignment)
      this.currentScore = evaluateScore(this.current, activeRules, studentList)
      this.bestScore = this.currentScore
      this.currentReverse = this.buildReverse(this.current)
      this.emptySeats = this.buildEmptySeats(availableSeats)
      this.stagnationCounter = 0
      this.stagnationSinceBest = 0
    }

    buildReverse(assignment) {
      const rev = new Map()
      for (const [sid, seat] of assignment.entries()) {
        rev.set(seat, sid)
      }
      return rev
    }

    buildEmptySeats(availableSeats) {
      return availableSeats
        .map(s => s.id)
        .filter(id => !this.currentReverse.has(id))
    }

    updateBestIfBetter() {
      if (this.currentScore > this.bestScore) {
        this.bestScore = this.currentScore
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
  }

  class ReheatStrategy {
    constructor(config) {
      this.config = config
    }

    shouldTrigger(state, reheatCount) {
      throw new Error('Must implement shouldTrigger')
    }

    execute(state, reheatCount, activeRules, studentList, availableSeats) {
      throw new Error('Must implement execute')
    }
  }

  class SoftJitterReheat extends ReheatStrategy {
    shouldTrigger(state, reheatCount) {
      return state.stagnationCounter > this.config.baseThreshold && 
             reheatCount < this.config.maxReheats &&
             state.stagnationSinceBest <= this.config.baseThreshold * 4
    }

    execute(state, reheatCount, activeRules, studentList, availableSeats) {
      const intensity = 0.5 * Math.pow(0.7, reheatCount - 1)
      const newTemp = this.config.tStart * intensity
      
      state.current = new Map(state.best)
      state.currentReverse = state.buildReverse(state.current)
      
      const pStrength = Math.max(1, Math.floor(state.current.size * 0.05))
      for (let p = 0; p < pStrength; p++) {
        const ids = [...state.current.keys()]
        const s1 = ids[Math.floor(Math.random() * ids.length)]
        const s2 = ids[Math.floor(Math.random() * ids.length)]
        if (s1 === s2) continue
        
        const seat1 = state.current.get(s1)
        const seat2 = state.current.get(s2)
        state.current.set(s1, seat2)
        state.current.set(s2, seat1)
        state.currentReverse.set(seat1, s2)
        state.currentReverse.set(seat2, s1)
      }
      
      state.stagnationCounter = 0
      state.currentScore = evaluateScore(state.current, activeRules, studentList)
      state.emptySeats = state.buildEmptySeats(availableSeats)
      return { newTemp, reheatType: 'soft_jitter' }
    }
  }

  class GlobalShakeupReheat extends ReheatStrategy {
    shouldTrigger(state, reheatCount) {
      return state.stagnationCounter > this.config.baseThreshold && 
             reheatCount < this.config.maxReheats &&
             state.stagnationSinceBest > this.config.baseThreshold * 4
    }

    execute(state, reheatCount, activeRules, studentList, availableSeats) {
      const intensity = 0.8 * Math.pow(0.8, reheatCount / 2)
      const newTemp = this.config.tStart * intensity
      
      const shuffleCount = Math.max(2, Math.floor(state.current.size * 0.15))
      for (let p = 0; p < shuffleCount; p++) {
        const ids = [...state.current.keys()]
        const s1 = ids[Math.floor(Math.random() * ids.length)]
        const s2 = ids[Math.floor(Math.random() * ids.length)]
        if (s1 === s2) continue
        
        const seat1 = state.current.get(s1)
        const seat2 = state.current.get(s2)
        state.current.set(s1, seat2)
        state.current.set(s2, seat1)
        state.currentReverse.set(seat1, s2)
        state.currentReverse.set(seat2, s1)
      }
      
      state.stagnationSinceBest = 0
      state.stagnationCounter = 0
      state.currentScore = evaluateScore(state.current, activeRules, studentList)
      state.emptySeats = state.buildEmptySeats(availableSeats)
      return { newTemp, reheatType: 'global_shakeup' }
    }
  }

  class ReheatManager {
    constructor(strategies) {
      this.strategies = strategies
      this.reheatCount = 0
    }

    tryReheat(state, activeRules, studentList, availableSeats) {
      for (const strategy of this.strategies) {
        if (strategy.shouldTrigger(state, this.reheatCount)) {
          this.reheatCount++
          const result = strategy.execute(state, this.reheatCount, activeRules, studentList, availableSeats)
          return { shouldReheat: true, ...result }
        }
      }
      return { shouldReheat: false }
    }
  }

  class ProbabilityAdjuster {
    constructor(config) {
      this.config = config
    }

    getViolatingStudentProbability(stagnationSinceBest) {
      return this.config.baseProbViolating + 
             Math.min(this.config.maxProbIncrease, stagnationSinceBest / this.config.stagnationScale)
    }

    getEmptySeatProbability(stagnationSinceBest) {
      const baseProb = this.config.baseProbEmpty
      const bonus = stagnationSinceBest > this.config.stagnationThreshold 
        ? this.config.emptySeatBonus 
        : 0
      return baseProb + bonus
    }
  }

  const buildPartnerMap = (activeRules, studentList) => {
    const partnerMap = new Map()
    activeRules.forEach(r => {
      if (r.priority === RulePriority.REQUIRED && r.predicate === 'MUST_BE_SEATMATES') {
        const subjects = expandSubject(r, studentList)
        subjects.forEach(s => {
          if (s.type === 'pair') {
            partnerMap.set(s.studentId1, s.studentId2)
            partnerMap.set(s.studentId2, s.studentId1)
          }
        })
      }
    })
    return partnerMap
  }

  const computeViolatingStudents = (assignment, activeRules, studentList) => {
    const violating = new Set()
    for (const rule of activeRules) {
      // 支持复合规则（多规则组合）
      if (rule.subRules && rule.subRules.length > 1) {
        for (const subRule of rule.subRules) {
          if (!subRule.predicate) continue
          const subSubjects = expandSubject(subRule, studentList)
          if (subRule.predicate === 'DISTRIBUTE_EVENLY' || subRule.predicate === 'CLUSTER_TOGETHER') {
            const groupPenalty = checkGroupViolation(subRule, subSubjects, assignment)
            if (groupPenalty > 0) {
              const groupViolatingIds = getGroupRuleViolatingStudentIds(subRule, subSubjects, assignment)
              for (const studentId of groupViolatingIds) violating.add(studentId)
            }
            continue
          }
          for (const subj of subSubjects) {
            const { violated } = checkViolation(subRule, subj, assignment)
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
      const subjects = expandSubject(rule, studentList)
      if (rule.predicate === 'DISTRIBUTE_EVENLY' || rule.predicate === 'CLUSTER_TOGETHER') {
        const groupPenalty = checkGroupViolation(rule, subjects, assignment)
        if (groupPenalty > 0) {
          const groupViolatingIds = getGroupRuleViolatingStudentIds(rule, subjects, assignment)
          for (const studentId of groupViolatingIds) violating.add(studentId)
        }
        continue
      }
      for (const subj of subjects) {
        const { violated } = checkViolation(rule, subj, assignment)
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

  // ==================== 新引擎：模拟退火主循环 ====================

  /**
   * 模拟退火主循环
   * @param {Map} initialAssignment - 初始解 studentId -> seatId
   * @param {Array} activeRules - 有效规则
   * @param {Array} studentList - 学生列表
   * @param {object} config - 配置参数
   */
  const runAnnealingLoop = async (initialAssignment, activeRules, studentList, config = {}) => {
    const {
      iterations = 50000,
      tStart = 1000,
      tEnd = 0.01,
      availableSeats = [],
      onProgress = null
    } = config

    const state = new AnnealingState(initialAssignment, activeRules, studentList, availableSeats)
    
    if (state.bestScore === 0) {
      return { solution: state.best, score: state.bestScore, reheatCount: 0 }
    }

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
    let violatingStudents = computeViolatingStudents(state.current, activeRules, studentList)
    
    const cooling = Math.pow(tEnd / tStart, 1 / iterations)
    let T = tStart

    for (let i = 0; i < iterations; i++) {
      T *= cooling

      const reheatResult = reheatManager.tryReheat(state, activeRules, studentList, availableSeats)
      if (reheatResult.shouldReheat) {
        T = reheatResult.newTemp
        violatingStudents = computeViolatingStudents(state.current, activeRules, studentList)
      }

      const probViolating = probAdjuster.getViolatingStudentProbability(state.stagnationSinceBest)
      const probEmpty = probAdjuster.getEmptySeatProbability(state.stagnationSinceBest)
      
      const useEmptySeat = state.emptySeats.length > 0 && Math.random() < probEmpty
      
      let studentA
      if (violatingStudents.length > 0 && Math.random() < probViolating) {
        studentA = violatingStudents[Math.floor(Math.random() * violatingStudents.length)]
      } else {
        studentA = assignedStudentIds[Math.floor(Math.random() * assignedStudentIds.length)]
      }

      const isPairMove = partnerMap.has(studentA) && Math.random() < 0.3
      const seatA = state.current.get(studentA)
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
          if (moveResult.useEmptySeat && moveResult.emptySeatIdx >= 0) {
            state.emptySeats[moveResult.emptySeatIdx] = seatA
          }
          if (state.updateBestIfBetter()) {
            if (state.bestScore === 0) {
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
        violatingStudents = computeViolatingStudents(state.current, activeRules, studentList)
      }

      if (onProgress && i % 1000 === 0) {
        onProgress(Math.round((i / iterations) * 100), {
          i,
          iterations,
          score: state.currentScore,
          bestScore: state.bestScore,
          reheatCount: reheatManager.reheatCount
        })
        await new Promise(r => setTimeout(r, 0))
      }
    }

    return { solution: state.best, score: state.bestScore, reheatCount: reheatManager.reheatCount }
  }

  const tryPairMove = (state, studentA, partnerMap, assignedStudentIds, T, activeRules, studentList) => {
    const partner = partnerMap.get(studentA)
    const seatPartner = state.current.get(partner)
    const seatA = state.current.get(studentA)
    
    const studentC = assignedStudentIds[Math.floor(Math.random() * assignedStudentIds.length)]
    if (studentC === studentA || studentC === partner) {
      return null
    }
    
    const seatC = state.current.get(studentC)
    const adjC = getAdjacentSeats(seatC)
    const seatDId = adjC.length > 0
      ? adjC[Math.floor(Math.random() * adjC.length)].id
      : [...state.current.values()][Math.floor(Math.random() * state.current.size)]
    
    const studentD = state.currentReverse.get(seatDId)
    
    if (!studentD || studentD === studentA || studentD === partner || studentD === studentC) {
      return null
    }
    
    const seatD = state.current.get(studentD)
    
    state.current.set(studentA, seatC)
    state.current.set(partner, seatD)
    state.current.set(studentC, seatA)
    state.current.set(studentD, seatPartner)
    state.currentReverse.set(seatC, studentA)
    state.currentReverse.set(seatD, partner)
    state.currentReverse.set(seatA, studentC)
    state.currentReverse.set(seatPartner, studentD)
    
    const newScore = evaluateScore(state.current, activeRules, studentList)
    const delta = newScore - state.currentScore
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
    }
    
    return { accepted, newScore, useEmptySeat: false, emptySeatIdx: -1 }
  }

  const trySingleMove = (state, studentA, assignedStudentIds, useEmptySeat, T, activeRules, studentList) => {
    const seatA = state.current.get(studentA)
    let seatB, studentB, emptySeatIdx = -1
    
    if (useEmptySeat) {
      emptySeatIdx = Math.floor(Math.random() * state.emptySeats.length)
      seatB = state.emptySeats[emptySeatIdx]
      state.current.set(studentA, seatB)
      state.currentReverse.delete(seatA)
      state.currentReverse.set(seatB, studentA)
    } else {
      studentB = assignedStudentIds[Math.floor(Math.random() * assignedStudentIds.length)]
      if (studentA === studentB) {
        return null
      }
      seatB = state.current.get(studentB)
      state.current.set(studentA, seatB)
      state.current.set(studentB, seatA)
      state.currentReverse.set(seatA, studentB)
      state.currentReverse.set(seatB, studentA)
    }
    
    const newScore = evaluateScore(state.current, activeRules, studentList)
    const delta = newScore - state.currentScore
    const accepted = delta >= 0 || Math.random() < Math.exp(delta / T)
    
    if (!accepted) {
      if (useEmptySeat) {
        state.current.set(studentA, seatA)
        state.currentReverse.delete(seatB)
        state.currentReverse.set(seatA, studentA)
      } else {
        state.current.set(studentA, seatA)
        state.current.set(studentB, seatB)
        state.currentReverse.set(seatA, studentA)
        state.currentReverse.set(seatB, studentB)
      }
    }
    
    return { accepted, newScore, useEmptySeat, emptySeatIdx }
  }

  // ==================== 新引擎：穷举 + 剪枝回溯 ====================



  // ==================== 新引擎：生成审计报告 ====================


  const generateReport = (solution, activeRules, studentList) => {
    const satisfied = []
    const violated = []

    for (const rule of activeRules) {
      if (rule.subRules && rule.subRules.length > 1) {
        let allSubSatisfied = true
        const anySubSatisfied = []
        const subViolationDetails = []

        for (const subRule of rule.subRules) {
          if (!subRule.predicate) continue
          const subSubjects = expandSubject(subRule, studentList)
          let subSatisfied = true
          const subRuleViolations = []

          if (subRule.predicate === 'DISTRIBUTE_EVENLY' || subRule.predicate === 'CLUSTER_TOGETHER') {
            const penalty = checkGroupViolation(subRule, subSubjects, solution)
            if (penalty > 0) {
              subSatisfied = false
              const focusedStudentIds = getGroupRuleViolatingStudentIds(subRule, subSubjects, solution)
              const names = focusedStudentIds
                .map(studentId => studentList.find(st => st.id === studentId)?.name ?? `ID:${studentId}`)
                .slice(0, 3)
              subRuleViolations.push(names.length > 0
                ? `重点定位学生：${names.join('、')}${focusedStudentIds.length > 3 ? `…等${focusedStudentIds.length}人` : ''}`
                : '分组约束未满足（存在明显分散/不均衡）'
              )
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

      const subjects = expandSubject(rule, studentList)
      if (rule.predicate === 'DISTRIBUTE_EVENLY' || rule.predicate === 'CLUSTER_TOGETHER') {
        const penalty = checkGroupViolation(rule, subjects, solution)
        if (penalty <= 0) {
          satisfied.push(rule)
        } else {
          const focusedStudentIds = getGroupRuleViolatingStudentIds(rule, subjects, solution)
          const names = focusedStudentIds
            .map(studentId => studentList.find(st => st.id === studentId)?.name ?? `ID:${studentId}`)
            .slice(0, 3)
          violated.push({
            rule,
            violatingSubjects: names,
            reason: names.length > 0
              ? `重点定位学生：${names.join('、')}${focusedStudentIds.length > 3 ? `…等${focusedStudentIds.length}人` : ''}`
              : '分组约束未满足（存在明显分散/不均衡）'
          })
        }
        continue
      }
      let isFullySatisfied = true
      const violationDetails = []

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

    return { satisfied, violated, satRate }
  }



  // ==================== 主入口：智能排位 ====================

  /**
   * 运行智能排位（模拟退火）
   * @param {object} options
   */
  const runSmartAssignment = async (options = {}) => {
    const {
      useRules = true,
      iterations = 100000,
      onProgress = null,
      algorithm = 'SA', // SA, LEGACY_GREEDY, EXHAUSTIVE
      nodeLimit = 2000000
    } = options

    if (isAssigning.value) {
      return { success: false, message: '正在排位中，请稍候...' }
    }

    isAssigning.value = true
    assignmentProgress.value = 0
    const startTime = Date.now()

    try {
      const studentList = students.value.map(s => ({ ...s }))
      const availableSeats = getAvailableSeats()

      if (studentList.length === 0) {
        isAssigning.value = false
        return { success: false, message: '没有学生数据' }
      }
      if (availableSeats.length === 0) {
        isAssigning.value = false
        return { success: false, message: '没有可用座位' }
      }

      // 收集规则
      const { getActiveRules } = useSeatRules()
      const activeRules = useRules ? [...getActiveRules()] : []

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
          onProgress: (pct, info) => {
            assignmentProgress.value = pct
            if (info) assignmentIterationInfo.value = info
            if (onProgress) onProgress(pct)
          }
        })
        solution = result.solution
        score = result.score
        finalReheatCount = result.reheatCount
      } else {
        solution = initial
      }

      // 写入结果
      clearAllSeats()
      for (const [studentId, seatId] of solution.entries()) {
        assignStudent(seatId, studentId)
      }

      assignmentProgress.value = 100

      // 生成审计报告
      const report = generateReport(solution, activeRules, studentList)
      const duration = Date.now() - startTime

      return {
        success: true,
        message: `排位完成 · 满足度 ${Math.round(report.satRate * 100)}% · 耗时 ${duration}ms${finalReheatCount > 0 ? ` · 重加热 ${finalReheatCount} 次` : ''}`,
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
        message: `排位失败: ${error.message}`
      }
    } finally {
      isAssigning.value = false
    }
  }

  
  return {
    isAssigning,
    assignmentProgress,
    assignmentIterationInfo,
    runSmartAssignment
  }
}
