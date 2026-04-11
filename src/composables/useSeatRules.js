/**
 * useSeatRules.js — 规则系统状态管理
 * 提供规则 CRUD、冲突检测、自然语言渲染、导入导出
 */
import { ref, computed } from 'vue'
import { useStudentData } from './useStudentData'
import { useTagData } from './useTagData'
import { useZoneData } from './useZoneData'
import {
  RulePriority,
  PRIORITY_ICONS,
  PRIORITY_LABELS,
  RULE_TYPE_LABELS,
  COLUMN_TYPE_LABELS,
  SCOPE_LABELS,
  PREDICATE_META,
  getDefaultParams
} from '../constants/ruleTypes.js'

const rules = ref([])
let _idCounter = 1
// 规则数据模型版本：
// v3: legacy subject.kind（student/pair/tag/tag_pair）
// v4: subjectMode + subjectsA/subjectsB（兼容层）
// v5: subjects（统一多对象）
const CURRENT_RULE_VERSION = 5

function genId() {
  return `rule-${Date.now()}-${_idCounter++}`
}

const normalizeSubjectEntry = (entry) => {
  if (!entry) return null
  if (entry.type === 'person' || entry.type === 'tag') {
    return { type: entry.type, id: entry.id ?? null }
  }
  return null
}

const normalizeRuleShape = (ruleData) => {
  if (!ruleData) {
    return {
      subjects: []
    }
  }

  if (Array.isArray(ruleData.subjects)) {
    return {
      subjects: ruleData.subjects.map(normalizeSubjectEntry).filter(Boolean)
    }
  }

  if (ruleData.subjectMode === 'single' || ruleData.subjectMode === 'dual') {
    const subjectsA = (ruleData.subjectsA || []).map(normalizeSubjectEntry).filter(Boolean)
    const subjectsB = (ruleData.subjectsB || []).map(normalizeSubjectEntry).filter(Boolean)
    return {
      subjects: [...subjectsA, ...subjectsB]
    }
  }

  const subject = ruleData.subject || {}
  if (subject.kind === 'student') {
    return {
      subjects: [{ type: 'person', id: subject.id ?? null }]
    }
  }
  if (subject.kind === 'tag') {
    return {
      subjects: [{ type: 'tag', id: subject.tagId ?? null }]
    }
  }
  if (subject.kind === 'pair') {
    return {
      subjects: [
        { type: 'person', id: subject.id1 ?? null },
        { type: 'person', id: subject.id2 ?? null }
      ]
    }
  }
  if (subject.kind === 'tag_pair') {
    return {
      subjects: [
        { type: 'tag', id: subject.tagId1 ?? null },
        { type: 'tag', id: subject.tagId2 ?? null }
      ]
    }
  }

  return {
    subjects: []
  }
}

export function useSeatRules() {
  const { students } = useStudentData()
  const { tags } = useTagData()
  const { zones } = useZoneData()

  const getStudentName = (id) => {
    const s = students.value.find(s => s.id === id)
    if (!s) return `学生#${id}`
    return s.name || `学生#${id}`
  }

  const getTagName = (id) => {
    const t = tags.value.find(t => t.id === id)
    if (!t) return `标签#${id}`
    return t.name || `标签#${id}`
  }

  const getZoneName = (id) => {
    const z = zones.value.find(z => z.id === id)
    if (!z) return `选区#${id}`
    return z.name || `选区#${id}`
  }

  const getSubjectsText = (subjects) => {
    return (subjects || [])
      .map(entry => {
        if (entry.type === 'person') return getStudentName(entry.id)
        if (entry.type === 'tag') return `[${getTagName(entry.id)}]全体`
        return ''
      })
      .filter(Boolean)
      .join('、')
  }

  const renderRuleText = (rule) => {
    const priorityLabel = PRIORITY_LABELS[rule.priority] ?? ''
    const normalized = normalizeRuleShape(rule)

    // 支持复合规则（多规则组合）
    if (rule.subRules && rule.subRules.length > 1) {
      const logicOp = rule.logicOperator === 'OR' ? ' 或 ' : ' 且 '
      const subTexts = rule.subRules.map((sr, idx) => {
        const text = renderSingleRuleText(sr.predicate, sr.params, sr.not, normalized.subjects, priorityLabel)
        return sr.not ? `[非]${text}` : text
      })
      return `${getSubjectsText(normalized.subjects)} · (${subTexts.join(logicOp)})`
    }

    // 单条规则（支持 not 取反）
    return renderSingleRuleText(rule.predicate, rule.params, rule.not, normalized.subjects, priorityLabel)
  }

  /**
   * 渲染单条规则的文本
   */
  const renderSingleRuleText = (predicate, params, not, subjects, priorityLabel) => {
    const relation = PREDICATE_META[predicate]?.relation || 'single'
    const subjectText = relation === 'single'
      ? getSubjectsText(subjects)
      : `对象集合(${getSubjectsText(subjects)})`

    let predicateText = ''
    switch (predicate) {
      case 'IN_ROW_RANGE':
        predicateText = `${priorityLabel}坐在第 ${params.minRow}～${params.maxRow} 排`
        break
      case 'NOT_IN_COLUMN_TYPE':
        predicateText = `${priorityLabel}不坐在${COLUMN_TYPE_LABELS[params.columnType] ?? params.columnType}`
        break
      case 'IN_ZONE':
        predicateText = `${priorityLabel}在「${getZoneName(params.zoneId)}」选区`
        break
      case 'NOT_IN_ZONE':
        predicateText = `${priorityLabel}不在「${getZoneName(params.zoneId)}」选区`
        break
      case 'IN_GROUP_RANGE':
        predicateText = `${priorityLabel}在第 ${params.minGroup}～${params.maxGroup} 大组`
        break
      case 'MUST_BE_SEATMATES':
        predicateText = '必须同桌'
        break
      case 'MUST_NOT_BE_SEATMATES':
        predicateText = '禁止同桌'
        break
      case 'DISTANCE_AT_MOST':
        predicateText = `${priorityLabel}距离不超过 ${params.distance} 个座位`
        break
      case 'DISTANCE_AT_LEAST':
        predicateText = `${priorityLabel}距离至少 ${params.distance} 个座位`
        break
      case 'NOT_BLOCK_VIEW': {
        const tol = params.tolerance === 1 ? '（含斜向）' : ''
        predicateText = `不可遮挡视线${tol}`
        break
      }
      case 'MUST_BE_SAME_GROUP':
        predicateText = '必须同大组'
        break
      case 'MUST_NOT_BE_SAME_GROUP':
        predicateText = '必须不同大组'
        break
      case 'MUST_BE_ADJACENT_ROW':
        predicateText = `${priorityLabel}相邻排`
        break
      case 'DISTRIBUTE_EVENLY':
        predicateText = `${priorityLabel}互相保持距离（最大化直线距离）`
        break
      case 'CLUSTER_TOGETHER':
        predicateText = `${priorityLabel}聚集在同一${SCOPE_LABELS[params.scope] ?? params.scope}`
        break
      default:
        predicateText = RULE_TYPE_LABELS[predicate] ?? predicate
    }

    // 应用 NOT 取反前缀
    if (not) {
      predicateText = `[非]${predicateText}`
    }

    return `${subjectText} · ${predicateText}`
  }

  const renderRuleTextWithoutPriority = (rule) => {
    const priorityLabel = PRIORITY_LABELS[rule.priority] ?? ''
    const { predicate, params } = rule
    const normalized = normalizeRuleShape(rule)

    const relation = PREDICATE_META[predicate]?.relation || 'single'
    const subjectText = relation === 'single'
      ? getSubjectsText(normalized.subjects)
      : `对象集合(${getSubjectsText(normalized.subjects)})`

    let predicateText = ''
    switch (predicate) {
      case 'IN_ROW_RANGE':
        predicateText = `${priorityLabel}坐在第 ${params.minRow}～${params.maxRow} 排`
        break
      case 'NOT_IN_COLUMN_TYPE':
        predicateText = `${priorityLabel}不坐在${COLUMN_TYPE_LABELS[params.columnType] ?? params.columnType}`
        break
      case 'IN_ZONE':
        predicateText = `${priorityLabel}在「${getZoneName(params.zoneId)}」选区`
        break
      case 'NOT_IN_ZONE':
        predicateText = `${priorityLabel}不在「${getZoneName(params.zoneId)}」选区`
        break
      case 'IN_GROUP_RANGE':
        predicateText = `${priorityLabel}在第 ${params.minGroup}～${params.maxGroup} 大组`
        break
      case 'MUST_BE_SEATMATES':
        predicateText = '必须同桌'
        break
      case 'MUST_NOT_BE_SEATMATES':
        predicateText = '禁止同桌'
        break
      case 'DISTANCE_AT_MOST':
        predicateText = `${priorityLabel}距离不超过 ${params.distance} 个座位`
        break
      case 'DISTANCE_AT_LEAST':
        predicateText = `${priorityLabel}距离至少 ${params.distance} 个座位`
        break
      case 'NOT_BLOCK_VIEW': {
        const tol = params.tolerance === 1 ? '（含斜向）' : ''
        predicateText = `不可遮挡视线${tol}`
        break
      }
      case 'MUST_BE_SAME_GROUP':
        predicateText = '必须同大组'
        break
      case 'MUST_NOT_BE_SAME_GROUP':
        predicateText = '必须不同大组'
        break
      case 'MUST_BE_ADJACENT_ROW':
        predicateText = `${priorityLabel}相邻排`
        break
      case 'DISTRIBUTE_EVENLY':
        predicateText = `${priorityLabel}互相保持距离（最大化直线距离）`
        break
      case 'CLUSTER_TOGETHER':
        predicateText = `${priorityLabel}聚集在同一${SCOPE_LABELS[params.scope] ?? params.scope}`
        break
      default:
        predicateText = RULE_TYPE_LABELS[predicate] ?? predicate
    }

    return `${subjectText} · ${predicateText}`
  }

  const validateRule = (ruleData) => {
    const warnings = []
    if (!ruleData.predicate) {
      return { valid: false, warnings: ['请选择规则类型'] }
    }

    const meta = PREDICATE_META[ruleData.predicate]
    if (!meta) {
      return { valid: false, warnings: [`未知谓词: ${ruleData.predicate}`] }
    }

    const normalized = normalizeRuleShape(ruleData)
    const { subjects } = normalized

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return { valid: false, warnings: ['对象集合不能为空'] }
    }

    if (subjects.length < (meta.minSubjects ?? 1)) {
      return { valid: false, warnings: [`谓词「${RULE_TYPE_LABELS[ruleData.predicate]}」至少需要 ${meta.minSubjects} 个对象`] }
    }

    const validateEntry = (entry, label) => {
      if (!entry?.type || !['person', 'tag'].includes(entry.type)) {
        warnings.push(`集合 ${label} 存在无效对象类型`)
        return
      }
      if (!entry.id) {
        warnings.push(`集合 ${label} 存在未选择对象`)
      }
    }

    subjects.forEach(entry => validateEntry(entry, '对象集合'))

    const getEntryKey = (e) => `${e.type}:${e.id}`
    const selected = subjects.filter(e => e?.id !== null && e?.id !== undefined)
    const unique = new Set(selected.map(getEntryKey))
    if (unique.size !== selected.length) warnings.push('对象集合存在重复对象')

    for (const paramSpec of meta.params) {
      const val = ruleData.params?.[paramSpec.key]
      if (val === null || val === undefined || val === '') {
        warnings.push(`参数「${paramSpec.label}」不能为空`)
      }
      if (paramSpec.type === 'number' && typeof val === 'number') {
        if (paramSpec.min !== undefined && val < paramSpec.min) {
          warnings.push(`参数「${paramSpec.label}」最小值为 ${paramSpec.min}`)
        }
      }
    }

    if (ruleData.predicate === 'IN_ROW_RANGE' && ruleData.params?.minRow > ruleData.params?.maxRow) {
      warnings.push('最前排不能大于最后排')
    }
    if (ruleData.predicate === 'IN_GROUP_RANGE' && ruleData.params?.minGroup > ruleData.params?.maxGroup) {
      warnings.push('最左大组不能大于最右大组')
    }

    return { valid: warnings.length === 0, warnings }
  }

  const expandEntriesToStudentIds = (entries = []) => {
    const ids = new Set()
    for (const e of entries) {
      if (!e?.id) continue
      if (e.type === 'person') {
        ids.add(e.id)
        continue
      }
      if (e.type === 'tag') {
        for (const s of students.value) {
          if (s.tags?.includes(e.id)) ids.add(s.id)
        }
      }
    }
    return ids
  }

  const getExpandedSubjectIds = (ruleLike) => {
    const normalized = normalizeRuleShape(ruleLike)
    return {
      subjects: expandEntriesToStudentIds(normalized.subjects || [])
    }
  }

  const hasOverlap = (setA, setB) => {
    for (const id of setA) {
      if (setB.has(id)) return true
    }
    return false
  }

  const buildPairKeys = (subjects, ordered = false) => {
    const keys = new Set()
    const list = [...subjects]
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        keys.add(ordered ? `${a}>${b}` : (a < b ? `${a}:${b}` : `${b}:${a}`))
        if (ordered) keys.add(`${b}>${a}`)
      }
    }
    return keys
  }

  const hasPairScopeOverlap = (r1, r2) => {
    const s1 = getExpandedSubjectIds(r1)
    const s2 = getExpandedSubjectIds(r2)
    const ordered1 = !!PREDICATE_META[r1.predicate]?.ordered
    const ordered2 = !!PREDICATE_META[r2.predicate]?.ordered
    const keys1 = buildPairKeys(s1.subjects, ordered1)
    const keys2 = buildPairKeys(s2.subjects, ordered2)
    return hasOverlap(keys1, keys2)
  }

  const hasSingleScopeOverlap = (r1, r2) => {
    const s1 = getExpandedSubjectIds(r1)
    const s2 = getExpandedSubjectIds(r2)
    return hasOverlap(s1.subjects, s2.subjects)
  }

  const detectConflicts = (zoneHelper = null, seatChartHelper = null) => {
    const conflicts = []
    const activeRules = rules.value.filter(r => r.enabled)

    for (let i = 0; i < activeRules.length; i++) {
      for (let j = i + 1; j < activeRules.length; j++) {
        const r1 = activeRules[i]
        const r2 = activeRules[j]
        if (
          (r1.predicate === 'MUST_BE_SEATMATES' && r2.predicate === 'MUST_NOT_BE_SEATMATES') ||
          (r1.predicate === 'MUST_NOT_BE_SEATMATES' && r2.predicate === 'MUST_BE_SEATMATES')
        ) {
          if (!hasPairScopeOverlap(r1, r2)) continue
          conflicts.push({
            type: 'contradiction',
            ruleIds: [r1.id, r2.id],
            message: `规则冲突：「${renderRuleText(r1)}」与「${renderRuleText(r2)}」逻辑矛盾`
          })
        }

        if (
          (r1.predicate === 'MUST_BE_SAME_GROUP' && r2.predicate === 'MUST_NOT_BE_SAME_GROUP') ||
          (r1.predicate === 'MUST_NOT_BE_SAME_GROUP' && r2.predicate === 'MUST_BE_SAME_GROUP')
        ) {
          if (!hasPairScopeOverlap(r1, r2)) continue
          conflicts.push({
            type: 'contradiction',
            ruleIds: [r1.id, r2.id],
            message: `规则冲突：「${renderRuleText(r1)}」与「${renderRuleText(r2)}」逻辑矛盾`
          })
        }

        if (
          (r1.predicate === 'MUST_BE_SEATMATES' && r2.predicate === 'MUST_NOT_BE_SAME_GROUP') ||
          (r1.predicate === 'MUST_NOT_BE_SAME_GROUP' && r2.predicate === 'MUST_BE_SEATMATES')
        ) {
          if (!hasPairScopeOverlap(r1, r2)) continue
          conflicts.push({
            type: 'infeasible',
            ruleIds: [r1.id, r2.id],
            message: '不可行冲突：「必须同桌」要求同大组，与「必须不同大组」矛盾'
          })
        }

        if (
          (r1.predicate === 'IN_ZONE' && r2.predicate === 'NOT_IN_ZONE') ||
          (r1.predicate === 'NOT_IN_ZONE' && r2.predicate === 'IN_ZONE')
        ) {
          if (!hasSingleScopeOverlap(r1, r2)) continue
          if (r1.params?.zoneId === r2.params?.zoneId) {
            conflicts.push({
              type: 'contradiction',
              ruleIds: [r1.id, r2.id],
              message: `规则冲突：「${renderRuleText(r1)}」与「${renderRuleText(r2)}」逻辑矛盾`
            })
          }
        }

        if (r1.predicate === 'IN_ROW_RANGE' && r2.predicate === 'IN_ROW_RANGE') {
          if (!hasSingleScopeOverlap(r1, r2)) continue
          const disjoint = r1.params?.maxRow < r2.params?.minRow || r2.params?.maxRow < r1.params?.minRow
          if (disjoint) {
            conflicts.push({
              type: 'infeasible',
              ruleIds: [r1.id, r2.id],
              message: `不可行冲突：「${renderRuleText(r1)}」与「${renderRuleText(r2)}」排范围不相交`
            })
          }
        }

        if (r1.predicate === 'IN_GROUP_RANGE' && r2.predicate === 'IN_GROUP_RANGE') {
          if (!hasSingleScopeOverlap(r1, r2)) continue
          const disjoint = r1.params?.maxGroup < r2.params?.minGroup || r2.params?.maxGroup < r1.params?.minGroup
          if (disjoint) {
            conflicts.push({
              type: 'infeasible',
              ruleIds: [r1.id, r2.id],
              message: `不可行冲突：「${renderRuleText(r1)}」与「${renderRuleText(r2)}」大组范围不相交`
            })
          }
        }

        if (
          (r1.predicate === 'DISTANCE_AT_MOST' && r2.predicate === 'DISTANCE_AT_LEAST') ||
          (r1.predicate === 'DISTANCE_AT_LEAST' && r2.predicate === 'DISTANCE_AT_MOST')
        ) {
          if (!hasPairScopeOverlap(r1, r2)) continue
          const maxRule = r1.predicate === 'DISTANCE_AT_MOST' ? r1 : r2
          const minRule = r1.predicate === 'DISTANCE_AT_LEAST' ? r1 : r2
          if ((minRule.params?.distance ?? 0) > (maxRule.params?.distance ?? 0)) {
            conflicts.push({
              type: 'infeasible',
              ruleIds: [r1.id, r2.id],
              message: `不可行冲突：「${renderRuleText(r1)}」与「${renderRuleText(r2)}」距离上下界互斥`
            })
          }
        }

        if (
          (r1.predicate === 'MUST_BE_SEATMATES' && r2.predicate === 'DISTANCE_AT_LEAST') ||
          (r1.predicate === 'DISTANCE_AT_LEAST' && r2.predicate === 'MUST_BE_SEATMATES')
        ) {
          if (!hasPairScopeOverlap(r1, r2)) continue
          const distRule = r1.predicate === 'DISTANCE_AT_LEAST' ? r1 : r2
          if ((distRule.params?.distance ?? 0) > 1) {
            conflicts.push({
              type: 'infeasible',
              ruleIds: [r1.id, r2.id],
              message: `不可行冲突：「必须同桌」要求距离≤1，与「${renderRuleText(distRule)}」矛盾`
            })
          }
        }

        if (zoneHelper && seatChartHelper) {
          checkZoneRangeConflicts(r1, r2, zoneHelper, seatChartHelper, conflicts)
          checkZoneZoneConflicts(r1, r2, zoneHelper, conflicts)
        }
      }
    }

    return conflicts
  }

  const checkZoneRangeConflicts = (r1, r2, zoneHelper, seatChartHelper, conflicts) => {
    const isZoneRule = (r) => r.predicate === 'IN_ZONE' || r.predicate === 'NOT_IN_ZONE'
    const isRangeRule = (r) => r.predicate === 'IN_ROW_RANGE' || r.predicate === 'IN_GROUP_RANGE'

    if (!((isZoneRule(r1) && isRangeRule(r2)) || (isZoneRule(r2) && isRangeRule(r1)))) {
      return
    }

    const zoneRule = isZoneRule(r1) ? r1 : r2
    const rangeRule = isRangeRule(r1) ? r1 : r2

    if (!hasSingleScopeOverlap(zoneRule, rangeRule)) return

    const zone = zoneHelper.zones.find(z => z.id === zoneRule.params?.zoneId)
    if (!zone || zone.seatIds.length === 0) return

    const seats = seatChartHelper.seats
    const zoneSeats = zone.seatIds.map(id => seats.find(s => s.id === id)).filter(Boolean)

    if (rangeRule.predicate === 'IN_ROW_RANGE') {
      const { minRow, maxRow } = rangeRule.params
      const seatsInRange = zoneSeats.filter(seat => {
        const totalRows = seatChartHelper.seatConfig.seatsPerColumn
        const rowFromPodium = totalRows - seat.rowIndex
        return rowFromPodium >= minRow && rowFromPodium <= maxRow
      })
      if (zoneRule.predicate === 'IN_ZONE' && seatsInRange.length === 0) {
        conflicts.push({
          type: 'infeasible',
          ruleIds: [zoneRule.id, rangeRule.id],
          message: `不可行冲突：选区与排范围无交集，「${renderRuleText(zoneRule)}」无法满足「${renderRuleText(rangeRule)}」`
        })
      }
    } else if (rangeRule.predicate === 'IN_GROUP_RANGE') {
      const { minGroup, maxGroup } = rangeRule.params
      const seatsInRange = zoneSeats.filter(seat => {
        const group1 = seat.groupIndex + 1
        return group1 >= minGroup && group1 <= maxGroup
      })
      if (zoneRule.predicate === 'IN_ZONE' && seatsInRange.length === 0) {
        conflicts.push({
          type: 'infeasible',
          ruleIds: [zoneRule.id, rangeRule.id],
          message: `不可行冲突：选区与大组范围无交集，「${renderRuleText(zoneRule)}」无法满足「${renderRuleText(rangeRule)}」`
        })
      }
    }
  }

  const checkZoneZoneConflicts = (r1, r2, zoneHelper, conflicts) => {
    if (r1.predicate !== 'IN_ZONE' || r2.predicate !== 'IN_ZONE') return
    if (!hasSingleScopeOverlap(r1, r2)) return

    const zone1 = zoneHelper.zones.find(z => z.id === r1.params?.zoneId)
    const zone2 = zoneHelper.zones.find(z => z.id === r2.params?.zoneId)
    if (!zone1 || !zone2) return

    const set1 = new Set(zone1.seatIds)
    const hasOverlap = zone2.seatIds.some(id => set1.has(id))
    if (!hasOverlap) {
      conflicts.push({
        type: 'infeasible',
        ruleIds: [r1.id, r2.id],
        message: `不可行冲突：两个选区无交集，无法同时满足「${renderRuleText(r1)}」和「${renderRuleText(r2)}」`
      })
    }
  }

  const toStoredRule = (ruleData) => {
    const normalized = normalizeRuleShape(ruleData)
    const meta = PREDICATE_META[ruleData.predicate] || {}
    const subjectMode = meta.relation === 'single' ? 'single' : 'dual'
    const subjectsA = [...normalized.subjects]
    const subjectsB = []
    return {
      id: genId(),
      version: CURRENT_RULE_VERSION,
      enabled: ruleData.enabled ?? true,
      priority: ruleData.priority ?? RulePriority.PREFER,
      subjects: [...normalized.subjects],
      // 兼容旧字段
      subjectMode,
      subjectsA,
      subjectsB,
      predicate: ruleData.predicate,
      params: { ...(ruleData.params ?? getDefaultParams(ruleData.predicate)) },
      description: ruleData.description ?? '',
      createdAt: ruleData.createdAt ?? Date.now(),
      // 新增字段：NOT 取反 和 多规则组合
      not: ruleData.not ?? false,
      logicOperator: ruleData.logicOperator ?? null,
      subRules: ruleData.subRules ? ruleData.subRules.map(sr => ({
        predicate: sr.predicate,
        not: sr.not ?? false,
        subjects: sr.subjects || [],
        params: { ...sr.params }
      })) : null
    }
  }

  const addRule = (ruleData) => {
    const { valid, warnings } = validateRule(ruleData)
    const normalized = normalizeRuleShape(ruleData)
    const hasRequiredFields = ruleData.predicate

    if (!hasRequiredFields || !valid) {
      return { success: false, warnings }
    }

    const newRule = toStoredRule(ruleData)
    rules.value.push(newRule)
    return { success: true, rule: newRule, warnings }
  }

  const deleteRule = (ruleId) => {
    const idx = rules.value.findIndex(r => r.id === ruleId)
    if (idx !== -1) {
      rules.value.splice(idx, 1)
      return true
    }
    return false
  }

  const updateRule = (ruleId, patch) => {
    const rule = rules.value.find(r => r.id === ruleId)
    if (!rule) return false
    Object.assign(rule, patch)
    return true
  }

  const toggleRule = (ruleId) => {
    const rule = rules.value.find(r => r.id === ruleId)
    if (!rule) return false
    rule.enabled = !rule.enabled
    return rule.enabled
  }

  const clearAllRules = () => {
    rules.value = []
  }

  const getAllRules = () => rules.value
  const getActiveRules = () => rules.value.filter(r => r.enabled)

  const getRulesForStudent = (studentId) => {
    const student = students.value.find(s => s.id === studentId)
    return rules.value.filter(r => {
      const normalized = normalizeRuleShape(r)
      const allEntries = [...(normalized.subjects || [])]
      const byPerson = allEntries.some(e => e.type === 'person' && e.id === studentId)
      if (byPerson) return true
      const byTag = allEntries.some(e => e.type === 'tag' && student?.tags?.includes(e.id))
      return !!byTag
    })
  }

  const getPairRulesFor = (id1, id2) => {
    return rules.value.filter(r => {
      const normalized = normalizeRuleShape(r)
      const people = normalized.subjects.filter(e => e.type === 'person').map(e => e.id)
      return people.includes(id1) && people.includes(id2)
    })
  }

  const exportRules = () => {
    return JSON.stringify({ version: CURRENT_RULE_VERSION, rules: rules.value }, null, 2)
  }

  const importRules = (jsonString) => {
    try {
      const data = JSON.parse(jsonString)
      const imported = []
      const errors = []
      const list = Array.isArray(data) ? data : (data.rules ?? [])

      for (const item of list) {
        const normalizedItem = {
          ...item,
          ...normalizeRuleShape(item)
        }
        const { valid, warnings } = validateRule(normalizedItem)
        if (!valid) {
          errors.push({ item, warnings })
          continue
        }
        const rule = toStoredRule(normalizedItem)
        rules.value.push(rule)
        imported.push(rule)
      }

      return { success: true, imported: imported.length, errors }
    } catch (e) {
      return { success: false, imported: 0, errors: [{ message: `JSON 解析失败: ${e.message}` }] }
    }
  }

  const ruleCount = computed(() => rules.value.length)
  const activeRuleCount = computed(() => rules.value.filter(r => r.enabled).length)
  const requiredRuleCount = computed(() =>
    rules.value.filter(r => r.enabled && r.priority === RulePriority.REQUIRED).length
  )

  return {
    rules,
    ruleCount,
    activeRuleCount,
    requiredRuleCount,

    addRule,
    deleteRule,
    updateRule,
    toggleRule,
    clearAllRules,

    getAllRules,
    getActiveRules,
    getRulesForStudent,
    getPairRulesFor,

    renderRuleText,
    renderRuleTextWithoutPriority,

    validateRule,
    detectConflicts,

    exportRules,
    importRules,

    normalizeRuleShape
  }
}
