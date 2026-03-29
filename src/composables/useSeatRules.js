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

// ==================== 模块级单例状态 ====================
// 确保所有组件共享同一份规则列表
const rules = ref([])
let _idCounter = 1

function genId() {
  return `rule-${Date.now()}-${_idCounter++}`
}

// ==================== 核心 composable ====================

export function useSeatRules() {
  const { students } = useStudentData()
  const { tags } = useTagData()
  const { zones } = useZoneData()

  // ==================== 查询辅助 ====================

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

  // ==================== 自然语言渲染 ====================

  /**
   * 将一条规则渲染为人读中文描述
   */
  const renderRuleText = (rule) => {
    const icon = PRIORITY_ICONS[rule.priority] ?? '❓'
    const priorityLabel = PRIORITY_LABELS[rule.priority] ?? ''
    const { subject, predicate, params } = rule

    // 主体描述
    let subjectText = ''
    if (subject.kind === 'student') {
      subjectText = getStudentName(subject.id)
    } else if (subject.kind === 'pair') {
      const ordered = PREDICATE_META[predicate]?.ordered
      if (ordered) {
        subjectText = `${getStudentName(subject.id1)} → ${getStudentName(subject.id2)}`
      } else {
        subjectText = `${getStudentName(subject.id1)} & ${getStudentName(subject.id2)}`
      }
    } else if (subject.kind === 'tag') {
      subjectText = `[${getTagName(subject.tagId)}] 全体`
    } else if (subject.kind === 'tag_pair') {
      subjectText = `[${getTagName(subject.tagId1)}] & [${getTagName(subject.tagId2)}]`
    }

    // 谓词描述
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
        predicateText = `必须同桌`
        break
      case 'MUST_NOT_BE_SEATMATES':
        predicateText = `禁止同桌`
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
        predicateText = `必须同大组`
        break
      case 'MUST_NOT_BE_SAME_GROUP':
        predicateText = `必须不同大组`
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

  // ==================== 规则验证 ====================

  /**
   * 校验规则数据完整性，返回 { valid, warnings }
   */
  const validateRule = (ruleData) => {
    const warnings = []

    if (!ruleData.predicate) {
      return { valid: false, warnings: ['请选择规则类型'] }
    }
    if (!ruleData.subject?.kind) {
      return { valid: false, warnings: ['请选择主体类型'] }
    }

    const meta = PREDICATE_META[ruleData.predicate]
    if (!meta) {
      return { valid: false, warnings: [`未知谓词: ${ruleData.predicate}`] }
    }

    // 检查主体类型是否与谓词兼容
    if (!meta.subjectKinds.includes(ruleData.subject.kind)) {
      return {
        valid: false,
        warnings: [`谓词「${RULE_TYPE_LABELS[ruleData.predicate]}」不支持主体类型「${ruleData.subject.kind}」`]
      }
    }

    // 检查主体字段完整性
    const { subject } = ruleData
    if (subject.kind === 'student' && !subject.id) {
      return { valid: false, warnings: ['请选择学生'] }
    }
    if (subject.kind === 'pair' && (!subject.id1 || !subject.id2)) {
      return { valid: false, warnings: ['请选择两名学生'] }
    }
    if (subject.kind === 'pair' && subject.id1 === subject.id2) {
      return { valid: false, warnings: ['学生 A 和学生 B 不能是同一人'] }
    }
    if (subject.kind === 'tag' && !subject.tagId) {
      return { valid: false, warnings: ['请选择标签'] }
    }
    if (subject.kind === 'tag_pair' && (!subject.tagId1 || !subject.tagId2)) {
      return { valid: false, warnings: ['请选择两个标签'] }
    }

    // 检查参数完整性
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

    // 业务逻辑警告（不阻止添加）
    if (ruleData.predicate === 'IN_ROW_RANGE') {
      if (ruleData.params?.minRow > ruleData.params?.maxRow) {
        warnings.push('最前排不能大于最后排')
      }
    }
    if (ruleData.predicate === 'IN_GROUP_RANGE') {
      if (ruleData.params?.minGroup > ruleData.params?.maxGroup) {
        warnings.push('最左大组不能大于最右大组')
      }
    }

    return { valid: warnings.length === 0, warnings }
  }

  // ==================== 冲突检测 ====================

  /**
   * 检测当前规则集中的潜在逻辑冲突
   * 返回冲突报告数组
   */
  const detectConflicts = () => {
    const conflicts = []
    const activeRules = rules.value.filter(r => r.enabled)

    for (let i = 0; i < activeRules.length; i++) {
      for (let j = i + 1; j < activeRules.length; j++) {
        const r1 = activeRules[i]
        const r2 = activeRules[j]

        // 只检测涉及相同学生的规则
        const ids1 = getSubjectStudentIds(r1.subject)
        const ids2 = getSubjectStudentIds(r2.subject)
        const overlap = ids1.filter(id => ids2.includes(id))
        if (overlap.length === 0) continue

        // MUST_BE_SEATMATES + MUST_NOT_BE_SEATMATES
        if (
          (r1.predicate === 'MUST_BE_SEATMATES' && r2.predicate === 'MUST_NOT_BE_SEATMATES') ||
          (r1.predicate === 'MUST_NOT_BE_SEATMATES' && r2.predicate === 'MUST_BE_SEATMATES')
        ) {
          conflicts.push({
            type: 'contradiction',
            ruleIds: [r1.id, r2.id],
            message: `规则冲突：「${renderRuleText(r1)}」与「${renderRuleText(r2)}」逻辑矛盾`
          })
        }

        // MUST_BE_SAME_GROUP + MUST_NOT_BE_SAME_GROUP
        if (
          (r1.predicate === 'MUST_BE_SAME_GROUP' && r2.predicate === 'MUST_NOT_BE_SAME_GROUP') ||
          (r1.predicate === 'MUST_NOT_BE_SAME_GROUP' && r2.predicate === 'MUST_BE_SAME_GROUP')
        ) {
          conflicts.push({
            type: 'contradiction',
            ruleIds: [r1.id, r2.id],
            message: `规则冲突：「${renderRuleText(r1)}」与「${renderRuleText(r2)}」逻辑矛盾`
          })
        }

        // MUST_BE_SEATMATES + MUST_NOT_BE_SAME_GROUP（同桌需同组）
        if (
          (r1.predicate === 'MUST_BE_SEATMATES' && r2.predicate === 'MUST_NOT_BE_SAME_GROUP') ||
          (r1.predicate === 'MUST_NOT_BE_SAME_GROUP' && r2.predicate === 'MUST_BE_SEATMATES')
        ) {
          conflicts.push({
            type: 'infeasible',
            ruleIds: [r1.id, r2.id],
            message: `不可行冲突：「必须同桌」要求同大组，与「必须不同大组」矛盾`
          })
        }
      }
    }

    return conflicts
  }

  // 提取 subject 涉及的学生 ID（仅直接 student/pair，不展开 tag）
  const getSubjectStudentIds = (subject) => {
    if (subject.kind === 'student') return [subject.id]
    if (subject.kind === 'pair') return [subject.id1, subject.id2]
    return []
  }

  // ==================== CRUD ====================

  const addRule = (ruleData) => {
    const { valid, warnings } = validateRule(ruleData)
    // 始终允许添加（警告不阻止），只有 valid=false 且没有内容时阻止
    const hasRequiredFields = ruleData.predicate && ruleData.subject?.kind

    if (!hasRequiredFields) {
      return { success: false, warnings }
    }

    const newRule = {
      id: genId(),
      version: 3,
      enabled: true,
      priority: ruleData.priority ?? RulePriority.PREFER,
      subject: { ...ruleData.subject },
      predicate: ruleData.predicate,
      params: { ...(ruleData.params ?? getDefaultParams(ruleData.predicate)) },
      description: ruleData.description ?? '',
      createdAt: Date.now()
    }

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

  // ==================== 查询 ====================

  const getAllRules = () => rules.value

  const getActiveRules = () => rules.value.filter(r => r.enabled)

  const getRulesForStudent = (studentId) => {
    return rules.value.filter(r => {
      if (r.subject.kind === 'student') return r.subject.id === studentId
      if (r.subject.kind === 'pair') {
        return r.subject.id1 === studentId || r.subject.id2 === studentId
      }
      if (r.subject.kind === 'tag') {
        // 检查该学生是否有此标签
        const student = students.value.find(s => s.id === studentId)
        return student?.tags?.includes(r.subject.tagId)
      }
      return false
    })
  }

  const getPairRulesFor = (id1, id2) => {
    return rules.value.filter(r => {
      if (r.subject.kind !== 'pair') return false
      return (
        (r.subject.id1 === id1 && r.subject.id2 === id2) ||
        (r.subject.id1 === id2 && r.subject.id2 === id1)
      )
    })
  }

  // ==================== 导入导出 ====================

  const exportRules = () => {
    return JSON.stringify({ version: 3, rules: rules.value }, null, 2)
  }

  const importRules = (jsonString) => {
    try {
      const data = JSON.parse(jsonString)
      const imported = []
      const errors = []

      const list = Array.isArray(data) ? data : (data.rules ?? [])

      for (const item of list) {
        const { valid, warnings } = validateRule(item)
        if (!valid) {
          errors.push({ item, warnings })
          continue
        }
        const rule = {
          id: genId(),
          version: 3,
          enabled: item.enabled ?? true,
          priority: item.priority ?? RulePriority.PREFER,
          subject: { ...item.subject },
          predicate: item.predicate,
          params: { ...(item.params ?? {}) },
          description: item.description ?? '',
          createdAt: item.createdAt ?? Date.now()
        }
        rules.value.push(rule)
        imported.push(rule)
      }

      return { success: true, imported: imported.length, errors }
    } catch (e) {
      return { success: false, imported: 0, errors: [{ message: `JSON 解析失败: ${e.message}` }] }
    }
  }

  // ==================== 统计 ====================

  const ruleCount = computed(() => rules.value.length)
  const activeRuleCount = computed(() => rules.value.filter(r => r.enabled).length)
  const requiredRuleCount = computed(() =>
    rules.value.filter(r => r.enabled && r.priority === RulePriority.REQUIRED).length
  )

  return {
    // 状态
    rules,
    ruleCount,
    activeRuleCount,
    requiredRuleCount,

    // CRUD
    addRule,
    deleteRule,
    updateRule,
    toggleRule,
    clearAllRules,

    // 查询
    getAllRules,
    getActiveRules,
    getRulesForStudent,
    getPairRulesFor,

    // 渲染
    renderRuleText,

    // 验证与冲突
    validateRule,
    detectConflicts,

    // 导入导出
    exportRules,
    importRules
  }
}
