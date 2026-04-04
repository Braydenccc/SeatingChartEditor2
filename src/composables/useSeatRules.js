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
// v4: subjectMode + subjectsA/subjectsB（支持个人/标签混合多对象）
const CURRENT_RULE_VERSION = 4

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
      subjectMode: 'single',
      subjectsA: [],
      subjectsB: []
    }
  }

  if (ruleData.subjectMode === 'single' || ruleData.subjectMode === 'dual') {
    return {
      subjectMode: ruleData.subjectMode,
      subjectsA: (ruleData.subjectsA || []).map(normalizeSubjectEntry).filter(Boolean),
      subjectsB: (ruleData.subjectsB || []).map(normalizeSubjectEntry).filter(Boolean)
    }
  }

  const subject = ruleData.subject || {}
  if (subject.kind === 'student') {
    return {
      subjectMode: 'single',
      subjectsA: [{ type: 'person', id: subject.id ?? null }],
      subjectsB: []
    }
  }
  if (subject.kind === 'tag') {
    return {
      subjectMode: 'single',
      subjectsA: [{ type: 'tag', id: subject.tagId ?? null }],
      subjectsB: []
    }
  }
  if (subject.kind === 'pair') {
    return {
      subjectMode: 'dual',
      subjectsA: [{ type: 'person', id: subject.id1 ?? null }],
      subjectsB: [{ type: 'person', id: subject.id2 ?? null }]
    }
  }
  if (subject.kind === 'tag_pair') {
    return {
      subjectMode: 'dual',
      subjectsA: [{ type: 'tag', id: subject.tagId1 ?? null }],
      subjectsB: [{ type: 'tag', id: subject.tagId2 ?? null }]
    }
  }

  return {
    subjectMode: 'single',
    subjectsA: [],
    subjectsB: []
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
    const icon = PRIORITY_ICONS[rule.priority] ?? '❓'
    const priorityLabel = PRIORITY_LABELS[rule.priority] ?? ''
    const { predicate, params } = rule
    const normalized = normalizeRuleShape(rule)

    let subjectText = ''
    if (normalized.subjectMode === 'single') {
      subjectText = getSubjectsText(normalized.subjectsA)
    } else {
      const ordered = PREDICATE_META[predicate]?.ordered
      const left = getSubjectsText(normalized.subjectsA)
      const right = getSubjectsText(normalized.subjectsB)
      subjectText = ordered ? `${left} → ${right}` : `${left} ↔ ${right}`
    }

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
        predicateText = `${priorityLabel}分散到不同${SCOPE_LABELS[params.scope] ?? params.scope}`
        break
      case 'CLUSTER_TOGETHER':
        predicateText = `${priorityLabel}聚集在同一${SCOPE_LABELS[params.scope] ?? params.scope}`
        break
      default:
        predicateText = RULE_TYPE_LABELS[predicate] ?? predicate
    }

    return `${icon} ${subjectText} · ${predicateText}`
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
    const { subjectMode, subjectsA, subjectsB } = normalized

    if (!subjectMode) {
      return { valid: false, warnings: ['请选择针对对象模式'] }
    }
    if (!meta.subjectMode?.includes(subjectMode)) {
      return {
        valid: false,
        warnings: [`谓词「${RULE_TYPE_LABELS[ruleData.predicate]}」不支持对象模式「${subjectMode}」`]
      }
    }

    if (!Array.isArray(subjectsA) || subjectsA.length === 0) {
      return { valid: false, warnings: ['对象集合 A 不能为空'] }
    }

    if (subjectMode === 'dual' && (!Array.isArray(subjectsB) || subjectsB.length === 0)) {
      return { valid: false, warnings: ['双对象规则需要对象集合 B'] }
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

    subjectsA.forEach(entry => validateEntry(entry, 'A'))
    if (subjectMode === 'dual') subjectsB.forEach(entry => validateEntry(entry, 'B'))

    const getEntryKey = (e) => `${e.type}:${e.id}`
    const selectedA = subjectsA.filter(e => e?.id !== null && e?.id !== undefined)
    const uniqueA = new Set(selectedA.map(getEntryKey))
    if (uniqueA.size !== selectedA.length) warnings.push('集合 A 存在重复对象')
    if (subjectMode === 'dual') {
      const selectedB = subjectsB.filter(e => e?.id !== null && e?.id !== undefined)
      const uniqueB = new Set(selectedB.map(getEntryKey))
      if (uniqueB.size !== selectedB.length) warnings.push('集合 B 存在重复对象')
      const overlap = selectedA.filter(e => uniqueB.has(getEntryKey(e)))
      if (overlap.length > 0) warnings.push('集合 A 与集合 B 存在重复对象')
    }

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
      subjectMode: normalized.subjectMode || 'single',
      subjectsA: expandEntriesToStudentIds(normalized.subjectsA || []),
      subjectsB: expandEntriesToStudentIds(normalized.subjectsB || [])
    }
  }

  const hasOverlap = (setA, setB) => {
    for (const id of setA) {
      if (setB.has(id)) return true
    }
    return false
  }

  const buildPairKeys = (subjectsA, subjectsB, ordered = false) => {
    const keys = new Set()
    const listA = [...subjectsA]
    const listB = [...subjectsB]
    for (const a of listA) {
      for (const b of listB) {
        if (a === b) continue
        if (ordered) {
          keys.add(`${a}>${b}`)
        } else {
          keys.add(a < b ? `${a}:${b}` : `${b}:${a}`)
        }
      }
    }
    return keys
  }

  const hasPairScopeOverlap = (r1, r2) => {
    const s1 = getExpandedSubjectIds(r1)
    const s2 = getExpandedSubjectIds(r2)
    if (s1.subjectMode !== 'dual' || s2.subjectMode !== 'dual') return false

    const ordered1 = !!PREDICATE_META[r1.predicate]?.ordered
    const ordered2 = !!PREDICATE_META[r2.predicate]?.ordered
    const keys1 = buildPairKeys(s1.subjectsA, s1.subjectsB, ordered1)
    const keys2 = buildPairKeys(s2.subjectsA, s2.subjectsB, ordered2)
    return hasOverlap(keys1, keys2)
  }

  const hasSingleScopeOverlap = (r1, r2) => {
    const s1 = getExpandedSubjectIds(r1)
    const s2 = getExpandedSubjectIds(r2)
    if (s1.subjectMode !== 'single' || s2.subjectMode !== 'single') return false
    return hasOverlap(s1.subjectsA, s2.subjectsA)
  }

  const detectConflicts = () => {
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
      }
    }

    return conflicts
  }

  const toStoredRule = (ruleData) => {
    const normalized = normalizeRuleShape(ruleData)
    return {
      id: genId(),
      version: CURRENT_RULE_VERSION,
      enabled: ruleData.enabled ?? true,
      priority: ruleData.priority ?? RulePriority.PREFER,
      subjectMode: normalized.subjectMode,
      subjectsA: [...normalized.subjectsA],
      subjectsB: [...normalized.subjectsB],
      predicate: ruleData.predicate,
      params: { ...(ruleData.params ?? getDefaultParams(ruleData.predicate)) },
      description: ruleData.description ?? '',
      createdAt: ruleData.createdAt ?? Date.now()
    }
  }

  const addRule = (ruleData) => {
    const { valid, warnings } = validateRule(ruleData)
    const normalized = normalizeRuleShape(ruleData)
    const hasRequiredFields = ruleData.predicate && normalized.subjectMode

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
      const allEntries = [...(normalized.subjectsA || []), ...(normalized.subjectsB || [])]
      const byPerson = allEntries.some(e => e.type === 'person' && e.id === studentId)
      if (byPerson) return true
      const byTag = allEntries.some(e => e.type === 'tag' && student?.tags?.includes(e.id))
      return !!byTag
    })
  }

  const getPairRulesFor = (id1, id2) => {
    return rules.value.filter(r => {
      const normalized = normalizeRuleShape(r)
      if (normalized.subjectMode !== 'dual') return false
      const peopleA = normalized.subjectsA.filter(e => e.type === 'person').map(e => e.id)
      const peopleB = normalized.subjectsB.filter(e => e.type === 'person').map(e => e.id)
      return (
        (peopleA.includes(id1) && peopleB.includes(id2)) ||
        (peopleA.includes(id2) && peopleB.includes(id1))
      )
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

    validateRule,
    detectConflicts,

    exportRules,
    importRules,

    normalizeRuleShape
  }
}
