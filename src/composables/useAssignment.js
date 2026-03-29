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
import { PENALTY_WEIGHTS, RulePriority } from '../constants/ruleTypes.js'

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

  /**
   * 将规则 subject 展开为具体的 { studentId } 或 { studentId1, studentId2 } 数组
   */
  const expandSubject = (subject, studentList) => {
    if (subject.kind === 'student') {
      return [{ type: 'single', studentId: subject.id }]
    }

    if (subject.kind === 'pair') {
      return [{ type: 'pair', studentId1: subject.id1, studentId2: subject.id2 }]
    }

    if (subject.kind === 'tag') {
      const taggedStudents = studentList.filter(s =>
        s.tags && s.tags.includes(subject.tagId)
      )
      return taggedStudents.map(s => ({ type: 'single', studentId: s.id }))
    }

    if (subject.kind === 'tag_pair') {
      const group1 = studentList.filter(s => s.tags && s.tags.includes(subject.tagId1))
      const group2 = studentList.filter(s => s.tags && s.tags.includes(subject.tagId2))
      const pairs = []
      for (const s1 of group1) {
        for (const s2 of group2) {
          if (s1.id !== s2.id) {
            pairs.push({ type: 'pair', studentId1: s1.id, studentId2: s2.id })
          }
        }
      }
      return pairs
    }

    return []
  }

  // ==================== 新引擎：违规检测 ====================

  /**
   * 检查单条规则是否违规
   * @param {object} rule - 规则对象
   * @param {object} subject - 已展开的 subject（{ type, studentId } 或 { type, studentId1, studentId2 }）
   * @param {Map} assignment - studentId -> seatId 的映射
   * @returns {{ violated: boolean, excess?: number }} 违规信息
   */
  const checkViolation = (rule, subject, assignment) => {
    const { predicate, params } = rule

    const getSeat = (studentId) => assignment.get(studentId)

    if (subject.type === 'single') {
      const seatId = getSeat(subject.studentId)
      if (!seatId) return { violated: false } // 未分配，跳过

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
          // id1 不能在 id2 后方（id1 遮挡 id2）
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

  /**
   * 检查分组分散/聚集谓词（需要整体视角）
   */
  const checkGroupViolation = (rule, expandedSubjects, assignment) => {
    const { predicate, params } = rule
    let penalties = 0

    if (predicate === 'DISTRIBUTE_EVENLY') {
      // 统计各大组/排的标签学生数量，方差越大违规越重
      const counts = new Map()
      for (const subj of expandedSubjects) {
        const seatId = assignment.get(subj.studentId)
        if (!seatId) continue
        const key = params.scope === 'group'
          ? parseSeatId(seatId).groupIndex
          : parseSeatId(seatId).rowIndex
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      const values = [...counts.values()]
      if (values.length > 1) {
        const max = Math.max(...values)
        const min = Math.min(...values)
        penalties = (max - min) * PENALTY_WEIGHTS[rule.priority] * 0.1
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
      const subjects = expandSubject(rule.subject, studentList)

      // 分组谓词单独处理
      if (rule.predicate === 'DISTRIBUTE_EVENLY' || rule.predicate === 'CLUSTER_TOGETHER') {
        score -= checkGroupViolation(rule, subjects, assignment)
        continue
      }

      for (const subject of subjects) {
        const { violated, excess = 0 } = checkViolation(rule, subject, assignment)
        if (violated) {
          score -= weight
          // 梯度惩罚：对于距离类规则，违反程度越深惩罚越多
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

      const subjects = expandSubject(rule.subject, studentList)
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

      const subjects = expandSubject(rule.subject, studentList)
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

  // ==================== 新引擎：模拟退火主循环 ====================

  /**
   * 模拟退火主循环
   * @param {Map} initialAssignment - 初始解 studentId -> seatId
   * @param {Array} activeRules - 有效规则
   * @param {Array} studentList - 学生列表
   * @param {object} config - 配置参数
   */
  const runAnnealingLoop = (initialAssignment, activeRules, studentList, config = {}) => {
    const {
      iterations = 15000,
      tStart = 1000,
      tEnd = 0.01,
      onProgress = null
    } = config

    let current = new Map(initialAssignment)
    let currentScore = evaluateScore(current, activeRules, studentList)
    let best = new Map(current)
    let bestScore = currentScore

    // 构建 seat -> student 反向映射（加速交换操作）
    const buildReverse = (assignment) => {
      const rev = new Map()
      for (const [sid, seat] of assignment.entries()) {
        rev.set(seat, sid)
      }
      return rev
    }
    let currentReverse = buildReverse(current)

    const assignedStudentIds = [...current.keys()]
    const n = assignedStudentIds.length

    const cooling = Math.pow(tEnd / tStart, 1 / iterations)

    // 预先计算哪些学生当前违规（用于偏向选择）
    const computeViolatingStudents = (assignment) => {
      const violating = new Set()
      for (const rule of activeRules) {
        const subjects = expandSubject(rule.subject, studentList)
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

    let violatingStudents = computeViolatingStudents(current)
    let T = tStart

    for (let i = 0; i < iterations; i++) {
      T *= cooling

      // 偏向选择违规学生
      let studentA
      if (violatingStudents.length > 0 && Math.random() < 0.7) {
        studentA = violatingStudents[Math.floor(Math.random() * violatingStudents.length)]
      } else {
        studentA = assignedStudentIds[Math.floor(Math.random() * n)]
      }

      // 随机选交换目标（另一个已分配的学生）
      const studentB = assignedStudentIds[Math.floor(Math.random() * n)]
      if (studentA === studentB) continue

      const seatA = current.get(studentA)
      const seatB = current.get(studentB)

      // 执行交换
      current.set(studentA, seatB)
      current.set(studentB, seatA)
      currentReverse.set(seatA, studentB)
      currentReverse.set(seatB, studentA)

      const newScore = evaluateScore(current, activeRules, studentList)
      const delta = newScore - currentScore

      if (delta >= 0 || Math.random() < Math.exp(delta / T)) {
        // 接受新解
        currentScore = newScore
        if (currentScore > bestScore) {
          bestScore = currentScore
          best = new Map(current)
          // 更新违规列表（每 500 步更新一次，减少开销）
          if (i % 500 === 0) {
            violatingStudents = computeViolatingStudents(current)
          }
        }
      } else {
        // 回滚
        current.set(studentA, seatA)
        current.set(studentB, seatB)
        currentReverse.set(seatA, studentA)
        currentReverse.set(seatB, studentB)
      }

      // 进度回调
      if (onProgress && i % 1000 === 0) {
        onProgress(Math.round((i / iterations) * 100))
      }
    }

    return { solution: best, score: bestScore }
  }

  // ==================== 新引擎：生成审计报告 ====================

  const generateReport = (solution, activeRules, studentList) => {
    const satisfied = []
    const violated = []

    for (const rule of activeRules) {
      const subjects = expandSubject(rule.subject, studentList)
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
      iterations = 15000,
      onProgress = null
    } = options

    if (isAssigning.value) {
      return { success: false, message: '正在排位中，请稍候...' }
    }

    isAssigning.value = true
    assignmentProgress.value = 0
    const startTime = Date.now()

    try {
      clearAllSeats()

      const studentList = students.value.map(s => ({ ...s }))
      const availableSeats = getAvailableSeats()

      if (studentList.length === 0) {
        return { success: false, message: '没有学生数据' }
      }
      if (availableSeats.length === 0) {
        return { success: false, message: '没有可用座位' }
      }

      // 收集规则
      let activeRules = []
      if (useRules) {
        const { getActiveRules } = useSeatRules()
        activeRules = [...getActiveRules()]
      }

      // 生成初始解
      const initial = generateInitialSolution(studentList, availableSeats, activeRules)

      // 若规则为空，直接用初始解
      let solution = initial
      let score = 0
      if (activeRules.length > 0) {
        const result = runAnnealingLoop(initial, activeRules, studentList, {
          iterations,
          onProgress: (pct) => {
            assignmentProgress.value = pct
            if (onProgress) onProgress(pct)
          }
        })
        solution = result.solution
        score = result.score
      }

      // 将结果写入座位表
      for (const [studentId, seatId] of solution.entries()) {
        assignStudent(seatId, studentId)
      }

      assignmentProgress.value = 100

      // 生成审计报告
      const report = generateReport(solution, activeRules, studentList)
      const duration = Date.now() - startTime

      return {
        success: true,
        message: `排位完成 · 满足度 ${Math.round(report.satRate * 100)}% · 耗时 ${duration}ms`,
        solution,
        score,
        satRate: report.satRate,
        report,
        duration
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
    runSmartAssignment
  }
}

