/**
 * useSeatRules.ts - 规则系统状态管理
 * 提供规则 CRUD、冲突检测、自然语言渲染、导入导出
 */
import { ref, computed } from 'vue'
import { useStudentData } from './useStudentData'
import { useTagData } from './useTagData'
import { useZoneData } from './useZoneData'
import { useStudentAttributes } from './useStudentAttributes'
import {
  RulePriority,
  RULE_TYPE_LABELS,
  COLUMN_TYPE_LABELS,
  SCOPE_LABELS,
  PREDICATE_META,
  getDefaultParams
} from '../constants/ruleTypes'
import type {
  Rule,
  RuleInput,
  RuleParams,
  RulePriority as RulePriorityValue,
  RuleSubject,
  Seat,
  SeatConfig,
  Zone
} from '@/types/models'

interface RuleValidationResult {
  valid: boolean
  warnings: string[]
}

interface RuleConflict {
  type: 'contradiction' | 'infeasible'
  ruleIds: string[]
  message: string
}

interface RuleZoneHelper {
  zones: Zone[]
}

interface RuleSeatChartHelper {
  seats: Seat[]
  seatConfig: SeatConfig
}

interface ExpandedRuleSubjects {
  subjects: Set<number>
}

type SubjectOverlap = (first: Rule, second: Rule) => boolean

const rules = ref<Rule[]>([])
let _idCounter = 1
// 规则数据模型版本：
// v3: legacy subject.kind（student/pair/tag/tag_pair）
// v4: subjectMode + subjectsA/subjectsB（兼容层）
// v5: subjects（统一多对象）
const CURRENT_RULE_VERSION = 5

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const parseRuleParams = (value: unknown): RuleParams => {
  if (!isRecord(value)) return {}
  return { ...value } as RuleParams
}

function genId() {
  return `rule-${Date.now()}-${_idCounter++}`
}

const normalizeSubjectEntry = (entry: unknown): RuleSubject | null => {
  if (!entry || typeof entry !== 'object') return null
  const subject = entry as { type?: unknown; id?: unknown }
  if (subject.type === 'person' || subject.type === 'tag') {
    return {
      type: subject.type,
      id: typeof subject.id === 'number' ? subject.id : null
    }
  }
  if (subject.type === 'all') {
    return { type: 'all', id: null }
  }
  return null
}

const normalizeRuleShape = (ruleData?: RuleInput | null): { subjects: RuleSubject[] } => {
  if (!ruleData) {
    return {
      subjects: []
    }
  }

  if (Array.isArray(ruleData.subjects)) {
    return {
      subjects: ruleData.subjects.map(normalizeSubjectEntry).filter((entry): entry is RuleSubject => entry !== null)
    }
  }

  if (ruleData.subjectMode === 'single' || ruleData.subjectMode === 'dual') {
    const subjectsA = (ruleData.subjectsA || []).map(normalizeSubjectEntry).filter((entry): entry is RuleSubject => entry !== null)
    const subjectsB = (ruleData.subjectsB || []).map(normalizeSubjectEntry).filter((entry): entry is RuleSubject => entry !== null)
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

const parseRuleInput = (value: unknown): RuleInput | null => {
  if (!isRecord(value)) return null

  const readSubjects = (candidate: unknown): RuleSubject[] => Array.isArray(candidate)
    ? candidate.map(normalizeSubjectEntry).filter((entry): entry is RuleSubject => entry !== null)
    : []
  const subject = isRecord(value.subject) ? value.subject : undefined
  const parsedSubject = subject ? {
    kind: typeof subject.kind === 'string' ? subject.kind : undefined,
    id: typeof subject.id === 'number' ? subject.id : null,
    id1: typeof subject.id1 === 'number' ? subject.id1 : null,
    id2: typeof subject.id2 === 'number' ? subject.id2 : null,
    tagId: typeof subject.tagId === 'number' ? subject.tagId : null,
    tagId1: typeof subject.tagId1 === 'number' ? subject.tagId1 : null,
    tagId2: typeof subject.tagId2 === 'number' ? subject.tagId2 : null
  } as RuleInput['subject'] : undefined
  const subRules = Array.isArray(value.subRules)
    ? value.subRules.flatMap(subRule => {
        if (!isRecord(subRule) || typeof subRule.predicate !== 'string') return []
        return [{
          predicate: subRule.predicate,
          not: subRule.not === true,
          subjects: readSubjects(subRule.subjects),
          params: parseRuleParams(subRule.params)
        }]
      })
    : null

  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    priority: value.priority === 'required' || value.priority === 'prefer' || value.priority === 'optional'
      ? value.priority
      : undefined,
    subjects: readSubjects(value.subjects),
    subjectMode: value.subjectMode === 'single' || value.subjectMode === 'dual' ? value.subjectMode : undefined,
    subjectsA: readSubjects(value.subjectsA),
    subjectsB: readSubjects(value.subjectsB),
    subject: parsedSubject,
    predicate: typeof value.predicate === 'string' ? value.predicate : undefined,
    params: parseRuleParams(value.params),
    version: typeof value.version === 'number' ? value.version : undefined,
    not: value.not === true,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : undefined,
    description: typeof value.description === 'string' ? value.description : undefined,
    logicOperator: value.logicOperator === 'AND' || value.logicOperator === 'OR' ? value.logicOperator : null,
    subRules,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : undefined
  }
}

export function useSeatRules() {
  const { students } = useStudentData()
  const { tags } = useTagData()
  const { zones } = useZoneData()
  const { attributeDefinitions, getAttributeById } = useStudentAttributes()

  const studentNameMap = computed(() => {
    const map = new Map<number, string>()
    for (const student of students.value) {
      map.set(student.id, student.name || `学生#${student.id}`)
    }
    return map
  })

  const tagNameMap = computed(() => {
    const map = new Map<number, string>()
    for (const tag of tags.value) {
      map.set(tag.id, tag.name || `标签#${tag.id}`)
    }
    return map
  })

  const zoneNameMap = computed(() => {
    const map = new Map<number, string>()
    for (const zone of zones.value) {
      map.set(zone.id, zone.name || `选区#${zone.id}`)
    }
    return map
  })

  const attributeNameMap = computed(() => {
    const map = new Map<string, string>()
    for (const attribute of attributeDefinitions?.value || []) {
      const label = attribute.unit ? `${attribute.name}（${attribute.unit}）` : attribute.name
      map.set(attribute.id, label)
    }
    return map
  })

  const getStudentName = (id: number) => {
    return studentNameMap.value.get(id) || `学生#${id}`
  }

  const getTagName = (id: number) => {
    return tagNameMap.value.get(id) || `标签#${id}`
  }

  const getZoneName = (id?: number) => {
    if (id === undefined) return '未设置选区'
    return zoneNameMap.value.get(id) || `选区#${id}`
  }

  const getAttributeName = (id?: string) => {
    if (!id) return '未设置属性'
    const cached = attributeNameMap.value.get(id)
    if (cached) return cached
    const attribute = getAttributeById(id)
    if (!attribute) return `属性#${id}`
    return attribute.unit ? `${attribute.name}（${attribute.unit}）` : attribute.name
  }

  const getEntryText = (entry?: RuleSubject) => {
    if (!entry) return '未选择对象'
    if (entry.type === 'person') {
      return entry.id ? getStudentName(entry.id) : '未选择学生的对象'
    }
    if (entry.type === 'tag') {
      return entry.id ? `带有「${getTagName(entry.id)}」标签的学生` : '未选择标签的对象'
    }
    if (entry.type === 'all') return '全体学生'
    return '未选择对象'
  }

  const joinNatural = (items: string[]) => {
    const list = (items || []).filter(Boolean)
    if (list.length === 0) return '未选择对象'
    if (list.length === 1) return list[0]
    if (list.length === 2) return `${list[0]}和${list[1]}`
    return `${list.slice(0, -1).join('、')}和${list[list.length - 1]}`
  }

  const getSubjectsText = (subjects: RuleSubject[] = []) => joinNatural(subjects.map(getEntryText))
  const getSubjectPhrase = (subjects: RuleSubject[] = []) => getSubjectsText(subjects)

  const getPairPhrase = (subjects: RuleSubject[] = []) => {
    const entries = subjects || []
    if (entries.length < 2) return `${getSubjectsText(entries)}之间`
    return joinNatural(entries.map(getEntryText))
  }

  const getOrderedPairPhrase = (subjects: RuleSubject[] = []) => {
    const entries = subjects || []
    return {
      first: getEntryText(entries[0]),
      second: getEntryText(entries[1])
    }
  }

  const getPriorityWord = (priority: RulePriorityValue, negative = false) => {
    if (priority === RulePriority.REQUIRED) return negative ? '不能' : '必须'
    if (priority === RulePriority.OPTIONAL) return negative ? '可作为参考，尽量不要' : '可作为参考，尽量'
    return negative ? '尽量不要' : '尽量'
  }

  const getRangeText = (min?: number, max?: number) => `${min ?? '未设置'} 至 ${max ?? '未设置'}`
  const finishSentence = (text: string) => text.endsWith('。') ? text : `${text}。`

  const renderConditionPhrase = (predicate: string, params: RuleParams = {}, not = false, subjects: RuleSubject[] = []) => {
    const subject = getSubjectPhrase(subjects)
    const pair = getPairPhrase(subjects)
    switch (predicate) {
      case 'IN_ROW_RANGE':
        return `${not ? '不要' : ''}坐在第 ${getRangeText(params.minRow, params.maxRow)} 排`
      case 'NOT_IN_COLUMN_TYPE':
        const columnTypeLabel = params.columnType ? COLUMN_TYPE_LABELS[params.columnType] : undefined
        return not
          ? `可以坐在${columnTypeLabel ?? params.columnType ?? '未设置列类型'}`
          : `避开${columnTypeLabel ?? params.columnType ?? '未设置列类型'}`
      case 'IN_ZONE':
        return `${not ? '不要' : ''}坐在「${getZoneName(params.zoneId)}」选区内`
      case 'NOT_IN_ZONE':
        return not
          ? `可以坐在「${getZoneName(params.zoneId)}」选区内`
          : `避开「${getZoneName(params.zoneId)}」选区`
      case 'IN_GROUP_RANGE':
        return `${not ? '不要' : ''}坐在第 ${getRangeText(params.minGroup, params.maxGroup)} 大组`
      case 'MUST_BE_SEATMATES':
        return not ? '不要安排为同桌' : '安排为同桌'
      case 'MUST_NOT_BE_SEATMATES':
        return not ? '可以成为同桌' : '不要成为同桌'
      case 'DISTANCE_AT_MOST':
        return `${not ? '不要' : ''}让彼此距离不超过 ${params.distance ?? '未设置'} 个座位`
      case 'DISTANCE_AT_LEAST':
        return `${not ? '不要' : ''}让彼此至少相隔 ${params.distance ?? '未设置'} 个座位`
      case 'NOT_BLOCK_VIEW': {
        const { first, second } = getOrderedPairPhrase(subjects)
        const tolerance = params.tolerance === 1 ? '（含斜向）' : ''
        return not ? `允许${first}遮挡${second}的视线${tolerance}` : `避免${first}遮挡${second}的视线${tolerance}`
      }
      case 'MUST_BE_SAME_GROUP':
        return not ? '不要安排在同一大组' : '安排在同一大组'
      case 'MUST_NOT_BE_SAME_GROUP':
        return not ? '可以安排在同一大组' : '安排在不同大组'
      case 'MUST_BE_ADJACENT_ROW':
        return not ? '不要安排在相邻排' : '安排在相邻排'
      case 'DISTRIBUTE_EVENLY':
        return not ? '不要刻意均匀分散' : '均匀分散并尽量拉开彼此距离'
      case 'CLUSTER_TOGETHER':
        const scopeLabel = params.scope ? SCOPE_LABELS[params.scope] : undefined
        return not
          ? `不要聚集在同一${scopeLabel ?? params.scope ?? '范围'}`
          : `聚集在同一${scopeLabel ?? params.scope ?? '范围'}`
      case 'ATTRIBUTE_ROW_GRADIENT':
        return not
          ? `不要按${getAttributeName(params.attributeId)}形成${params.direction === 'highFront' ? '高值靠前' : '低值靠前'}的前后梯度`
          : `按${getAttributeName(params.attributeId)}形成${params.direction === 'highFront' ? '高值靠前' : '低值靠前'}的前后梯度`
      case 'ATTRIBUTE_GROUP_BALANCE':
        return not
          ? `不要让各大组${params.aggregate === 'sum' ? '合计' : '平均'}${getAttributeName(params.attributeId)}接近`
          : `让各大组${params.aggregate === 'sum' ? '合计' : '平均'}${getAttributeName(params.attributeId)}尽量接近`
      case 'ATTRIBUTE_PAIR_DELTA':
        return not
          ? `不要限制${pair}的${getAttributeName(params.attributeId)}差值`
          : `让${pair}的${getAttributeName(params.attributeId)}差值不超过 ${params.maxDelta ?? '未设置'}`
      case 'ATTRIBUTE_DISTRIBUTE_BANDS':
        return not
          ? `不要按${getAttributeName(params.attributeId)}分层分散`
          : `按${getAttributeName(params.attributeId)}分 ${params.bandCount ?? '未设置'} 层均匀分散`
      default:
        return RULE_TYPE_LABELS[predicate] ?? predicate ?? '未选择规则类型'
    }
  }

  const renderSingleRuleText = (ruleLike: RuleInput, { includePriority = true }: { includePriority?: boolean } = {}) => {
    const normalized = normalizeRuleShape(ruleLike)
    const subjects = normalized.subjects || []
    const params = ruleLike.params || {}
    const priority = ruleLike.priority || RulePriority.PREFER
    const subject = getSubjectPhrase(subjects)
    const pair = getPairPhrase(subjects)
    const priorityWord = includePriority ? getPriorityWord(priority, ruleLike.not) : (ruleLike.not ? '不要' : '')
    const positivePriorityWord = includePriority ? getPriorityWord(priority, false) : ''
    const negativePriorityWord = includePriority ? getPriorityWord(priority, true) : '不要'

    switch (ruleLike.predicate) {
      case 'IN_ROW_RANGE':
        return finishSentence(`${subject}${priorityWord}坐在第 ${getRangeText(params.minRow, params.maxRow)} 排`)
      case 'NOT_IN_COLUMN_TYPE':
        return finishSentence(`${subject}${ruleLike.not ? positivePriorityWord : negativePriorityWord}坐在${params.columnType ? COLUMN_TYPE_LABELS[params.columnType] : '未设置列类型'}`)
      case 'IN_ZONE':
        return finishSentence(`${subject}${priorityWord}坐在「${getZoneName(params.zoneId)}」选区内`)
      case 'NOT_IN_ZONE':
        return finishSentence(`${subject}${ruleLike.not ? positivePriorityWord : negativePriorityWord}坐在「${getZoneName(params.zoneId)}」选区内`)
      case 'IN_GROUP_RANGE':
        return finishSentence(`${subject}${priorityWord}坐在第 ${getRangeText(params.minGroup, params.maxGroup)} 大组`)
      case 'MUST_BE_SEATMATES':
        return finishSentence(`${pair}${ruleLike.not ? negativePriorityWord : positivePriorityWord}安排为同桌`)
      case 'MUST_NOT_BE_SEATMATES':
        return finishSentence(`${pair}${ruleLike.not ? positivePriorityWord : negativePriorityWord}成为同桌`)
      case 'DISTANCE_AT_MOST':
        return finishSentence(`${pair}${priorityWord}距离不超过 ${params.distance ?? '未设置'} 个座位`)
      case 'DISTANCE_AT_LEAST':
        return finishSentence(`${pair}${priorityWord}至少相隔 ${params.distance ?? '未设置'} 个座位`)
      case 'NOT_BLOCK_VIEW': {
        const { first, second } = getOrderedPairPhrase(subjects)
        const tolerance = params.tolerance === 1 ? '（含斜向）' : ''
        if (ruleLike.not) return finishSentence(`${first}可以遮挡${second}的视线${tolerance}`)
        if (!includePriority || priority === RulePriority.REQUIRED) {
          return finishSentence(`${first}${negativePriorityWord}遮挡${second}的视线${tolerance}`)
        }
        return finishSentence(`${negativePriorityWord}让${first}遮挡${second}的视线${tolerance}`)
      }
      case 'MUST_BE_SAME_GROUP':
        return finishSentence(`${pair}${ruleLike.not ? negativePriorityWord : positivePriorityWord}安排在同一大组`)
      case 'MUST_NOT_BE_SAME_GROUP':
        return finishSentence(`${pair}${ruleLike.not ? positivePriorityWord : negativePriorityWord}安排在同一大组`)
      case 'MUST_BE_ADJACENT_ROW':
        return finishSentence(`${pair}${ruleLike.not ? negativePriorityWord : positivePriorityWord}安排在相邻排`)
      case 'DISTRIBUTE_EVENLY':
        return finishSentence(`${subject}${ruleLike.not ? negativePriorityWord : positivePriorityWord}均匀分散，尽量拉开彼此距离`)
      case 'CLUSTER_TOGETHER':
        return finishSentence(`${subject}${priorityWord}聚集在同一${params.scope ? SCOPE_LABELS[params.scope] : '范围'}`)
      case 'ATTRIBUTE_ROW_GRADIENT':
        return finishSentence(`${subject}${priorityWord}按${getAttributeName(params.attributeId)}形成${params.direction === 'highFront' ? '高值靠前' : '低值靠前'}的前后梯度`)
      case 'ATTRIBUTE_GROUP_BALANCE':
        return finishSentence(`${subject}${priorityWord}让各大组${params.aggregate === 'sum' ? '合计' : '平均'}${getAttributeName(params.attributeId)}接近`)
      case 'ATTRIBUTE_PAIR_DELTA':
        return finishSentence(`${pair}${priorityWord}让${getAttributeName(params.attributeId)}差值不超过 ${params.maxDelta ?? '未设置'}`)
      case 'ATTRIBUTE_DISTRIBUTE_BANDS':
        return finishSentence(`${subject}${priorityWord}按${getAttributeName(params.attributeId)}分 ${params.bandCount ?? '未设置'} 层均匀分散`)
      default:
        return finishSentence(`${subject}${positivePriorityWord}${ruleLike.predicate ? RULE_TYPE_LABELS[ruleLike.predicate] ?? ruleLike.predicate : '未选择规则类型'}`)
    }
  }

  const renderCompositeRuleText = (rule: RuleInput, { includePriority = true }: { includePriority?: boolean } = {}) => {
    const normalized = normalizeRuleShape(rule)
    const subject = getSubjectPhrase(normalized.subjects)
    const operator = rule.logicOperator === 'OR' ? '满足其中一项' : '同时满足'
    const joiner = rule.logicOperator === 'OR' ? '，或者' : '，并且'
    const priority = rule.priority ?? RulePriority.PREFER
    const priorityText = includePriority
      ? (priority === RulePriority.REQUIRED ? '要求' : getPriorityWord(priority, false))
      : '需要'
    const subTexts = (rule.subRules || [])
      .filter((sr): sr is typeof sr & { predicate: string } => typeof sr?.predicate === 'string')
      .map(sr => renderConditionPhrase(sr.predicate, sr.params, sr.not, normalized.subjects))

    if (subTexts.length === 0) {
      return finishSentence(`对${subject}，尚未选择规则条件`)
    }
    return finishSentence(`对${subject}，${priorityText}${operator}：${subTexts.join(joiner)}`)
  }

  const renderRuleText = (rule: RuleInput) => {
    if (rule?.subRules && rule.subRules.length > 1) {
      return renderCompositeRuleText(rule)
    }
    return renderSingleRuleText(rule)
  }

  const renderRuleTextWithoutPriority = (rule: RuleInput) => {
    if (rule?.subRules && rule.subRules.length > 1) {
      return renderCompositeRuleText(rule, { includePriority: false })
    }
    return renderSingleRuleText(rule, { includePriority: false })
  }

  const validateRule = (ruleData: RuleInput): RuleValidationResult => {
    const warnings: string[] = []
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

    const validateEntry = (entry: RuleSubject, label: string) => {
      if (!entry?.type || !['person', 'tag', 'all'].includes(entry.type)) {
        warnings.push(`集合 ${label} 存在无效对象类型`)
        return
      }
      if (entry.type === 'all') return
      if (!entry.id) {
        warnings.push(`集合 ${label} 存在未选择对象`)
      }
    }

    subjects.forEach(entry => validateEntry(entry, '对象集合'))

    const getEntryKey = (entry: RuleSubject) => `${entry.type}:${entry.id}`
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
      if (paramSpec.type === 'attribute' && (typeof val !== 'string' || !getAttributeById(val))) {
        warnings.push(`参数「${paramSpec.label}」未选择有效数值属性`)
      }
    }

    if (ruleData.predicate === 'IN_ROW_RANGE' &&
      ruleData.params?.minRow !== undefined &&
      ruleData.params.maxRow !== undefined &&
      ruleData.params.minRow > ruleData.params.maxRow) {
      warnings.push('最前排不能大于最后排')
    }
    if (ruleData.predicate === 'IN_GROUP_RANGE' &&
      ruleData.params?.minGroup !== undefined &&
      ruleData.params.maxGroup !== undefined &&
      ruleData.params.minGroup > ruleData.params.maxGroup) {
      warnings.push('最左大组不能大于最右大组')
    }

    return { valid: warnings.length === 0, warnings }
  }

  const expandEntriesToStudentIds = (entries: RuleSubject[] = []) => {
    const ids = new Set<number>()
    for (const e of entries) {
      if (e.type === 'all') {
        for (const s of students.value) ids.add(s.id)
        continue
      }
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

  const getExpandedSubjectIds = (ruleLike: RuleInput): ExpandedRuleSubjects => {
    const normalized = normalizeRuleShape(ruleLike)
    return {
      subjects: expandEntriesToStudentIds(normalized.subjects || [])
    }
  }

  const hasOverlap = <T>(setA: Set<T>, setB: Set<T>) => {
    for (const id of setA) {
      if (setB.has(id)) return true
    }
    return false
  }

  const buildPairKeys = (subjects: Set<number>, ordered = false) => {
    const keys = new Set<string>()
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

  const hasPairScopeOverlap = (r1: Rule, r2: Rule) => {
    const s1 = getExpandedSubjectIds(r1)
    const s2 = getExpandedSubjectIds(r2)
    const ordered1 = !!PREDICATE_META[r1.predicate]?.ordered
    const ordered2 = !!PREDICATE_META[r2.predicate]?.ordered
    const keys1 = buildPairKeys(s1.subjects, ordered1)
    const keys2 = buildPairKeys(s2.subjects, ordered2)
    return hasOverlap(keys1, keys2)
  }

  const hasSingleScopeOverlap = (r1: Rule, r2: Rule) => {
    const s1 = getExpandedSubjectIds(r1)
    const s2 = getExpandedSubjectIds(r2)
    return hasOverlap(s1.subjects, s2.subjects)
  }

  const detectConflicts = (zoneHelper: RuleZoneHelper | null = null, seatChartHelper: RuleSeatChartHelper | null = null) => {
    const conflicts: RuleConflict[] = []
    const negatedPredicateMap: Record<string, string> = {
      IN_ZONE: 'NOT_IN_ZONE',
      NOT_IN_ZONE: 'IN_ZONE',
      MUST_BE_SEATMATES: 'MUST_NOT_BE_SEATMATES',
      MUST_NOT_BE_SEATMATES: 'MUST_BE_SEATMATES',
      MUST_BE_SAME_GROUP: 'MUST_NOT_BE_SAME_GROUP',
      MUST_NOT_BE_SAME_GROUP: 'MUST_BE_SAME_GROUP'
    }
    const canonicalizeRule = (rule: Rule) => {
      if (!rule.not) return [rule]
      const effectivePredicate = negatedPredicateMap[rule.predicate]
      if (!effectivePredicate) return []
      return [{ ...rule, predicate: effectivePredicate, not: false }]
    }
    const activeRules = rules.value.flatMap(rule => {
      if (!rule.enabled) return []
      if ((rule.subRules?.length ?? 0) <= 1) return canonicalizeRule(rule)
      if (rule.not || rule.logicOperator !== 'AND') return []

      return (rule.subRules || []).flatMap(subRule => canonicalizeRule({
        ...rule,
        predicate: subRule.predicate,
        params: { ...(subRule.params || {}) },
        not: subRule.not,
        logicOperator: null,
        subRules: null
      }))
    })
    const expandedSubjectCache = new WeakMap<Rule, ExpandedRuleSubjects>()
    const pairKeyCache = new WeakMap<Rule, Partial<Record<'ordered' | 'unordered', Set<string>>>>()

    const getCachedExpandedSubjectIds = (ruleLike: Rule) => {
      const cached = expandedSubjectCache.get(ruleLike)
      if (cached) return cached
      const expanded = getExpandedSubjectIds(ruleLike)
      expandedSubjectCache.set(ruleLike, expanded)
      return expanded
    }

    const getCachedPairKeys = (ruleLike: Rule) => {
      const ordered = !!PREDICATE_META[ruleLike.predicate]?.ordered
      const cacheKey = ordered ? 'ordered' : 'unordered'
      const cached = pairKeyCache.get(ruleLike)
      if (cached?.[cacheKey]) return cached[cacheKey]

      const expanded = getCachedExpandedSubjectIds(ruleLike)
      const keys = buildPairKeys(expanded.subjects, ordered)
      pairKeyCache.set(ruleLike, {
        ...(cached || {}),
        [cacheKey]: keys
      })
      return keys
    }

    const hasCachedPairScopeOverlap = (r1: Rule, r2: Rule) => {
      return hasOverlap(getCachedPairKeys(r1), getCachedPairKeys(r2))
    }

    const hasCachedSingleScopeOverlap = (r1: Rule, r2: Rule) => {
      const s1 = getCachedExpandedSubjectIds(r1)
      const s2 = getCachedExpandedSubjectIds(r2)
      return hasOverlap(s1.subjects, s2.subjects)
    }

    for (let i = 0; i < activeRules.length; i++) {
      for (let j = i + 1; j < activeRules.length; j++) {
        const r1 = activeRules[i]
        const r2 = activeRules[j]
        if (
          (r1.predicate === 'MUST_BE_SEATMATES' && r2.predicate === 'MUST_NOT_BE_SEATMATES') ||
          (r1.predicate === 'MUST_NOT_BE_SEATMATES' && r2.predicate === 'MUST_BE_SEATMATES')
        ) {
          if (!hasCachedPairScopeOverlap(r1, r2)) continue
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
          if (!hasCachedPairScopeOverlap(r1, r2)) continue
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
          if (!hasCachedPairScopeOverlap(r1, r2)) continue
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
          if (!hasCachedSingleScopeOverlap(r1, r2)) continue
          if (r1.params?.zoneId === r2.params?.zoneId) {
            conflicts.push({
              type: 'contradiction',
              ruleIds: [r1.id, r2.id],
              message: `规则冲突：「${renderRuleText(r1)}」与「${renderRuleText(r2)}」逻辑矛盾`
            })
          }
        }

        if (r1.predicate === 'IN_ROW_RANGE' && r2.predicate === 'IN_ROW_RANGE') {
          if (!hasCachedSingleScopeOverlap(r1, r2)) continue
          const { minRow: minRow1, maxRow: maxRow1 } = r1.params
          const { minRow: minRow2, maxRow: maxRow2 } = r2.params
          const disjoint = minRow1 !== undefined && maxRow1 !== undefined &&
            minRow2 !== undefined && maxRow2 !== undefined &&
            (maxRow1 < minRow2 || maxRow2 < minRow1)
          if (disjoint) {
            conflicts.push({
              type: 'infeasible',
              ruleIds: [r1.id, r2.id],
              message: `不可行冲突：「${renderRuleText(r1)}」与「${renderRuleText(r2)}」排范围不相交`
            })
          }
        }

        if (r1.predicate === 'IN_GROUP_RANGE' && r2.predicate === 'IN_GROUP_RANGE') {
          if (!hasCachedSingleScopeOverlap(r1, r2)) continue
          const { minGroup: minGroup1, maxGroup: maxGroup1 } = r1.params
          const { minGroup: minGroup2, maxGroup: maxGroup2 } = r2.params
          const disjoint = minGroup1 !== undefined && maxGroup1 !== undefined &&
            minGroup2 !== undefined && maxGroup2 !== undefined &&
            (maxGroup1 < minGroup2 || maxGroup2 < minGroup1)
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
          if (!hasCachedPairScopeOverlap(r1, r2)) continue
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
          if (!hasCachedPairScopeOverlap(r1, r2)) continue
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
          checkZoneRangeConflicts(r1, r2, zoneHelper, seatChartHelper, conflicts, hasCachedSingleScopeOverlap)
          checkZoneZoneConflicts(r1, r2, zoneHelper, conflicts, hasCachedSingleScopeOverlap)
        }
      }
    }

    return conflicts
  }

  const checkZoneRangeConflicts = (
    r1: Rule,
    r2: Rule,
    zoneHelper: RuleZoneHelper,
    seatChartHelper: RuleSeatChartHelper,
    conflicts: RuleConflict[],
    hasSingleScopeOverlapFn: SubjectOverlap = hasSingleScopeOverlap
  ) => {
    const isZoneRule = (rule: Rule) => rule.predicate === 'IN_ZONE' || rule.predicate === 'NOT_IN_ZONE'
    const isRangeRule = (rule: Rule) => rule.predicate === 'IN_ROW_RANGE' || rule.predicate === 'IN_GROUP_RANGE'

    if (!((isZoneRule(r1) && isRangeRule(r2)) || (isZoneRule(r2) && isRangeRule(r1)))) {
      return
    }

    const zoneRule = isZoneRule(r1) ? r1 : r2
    const rangeRule = isRangeRule(r1) ? r1 : r2

    if (!hasSingleScopeOverlapFn(zoneRule, rangeRule)) return

    const zone = zoneHelper.zones.find(z => z.id === zoneRule.params?.zoneId)
    if (!zone || zone.seatIds.length === 0) return

    const seats = seatChartHelper.seats
    const zoneSeats = zone.seatIds
      .map(id => seats.find(seat => seat.id === id))
      .filter((seat): seat is Seat => seat !== undefined)

    if (rangeRule.predicate === 'IN_ROW_RANGE') {
      const { minRow, maxRow } = rangeRule.params
      if (minRow === undefined || maxRow === undefined) return
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
      if (minGroup === undefined || maxGroup === undefined) return
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

  const checkZoneZoneConflicts = (
    r1: Rule,
    r2: Rule,
    zoneHelper: RuleZoneHelper,
    conflicts: RuleConflict[],
    hasSingleScopeOverlapFn: SubjectOverlap = hasSingleScopeOverlap
  ) => {
    if (r1.predicate !== 'IN_ZONE' || r2.predicate !== 'IN_ZONE') return
    if (!hasSingleScopeOverlapFn(r1, r2)) return

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

  const toStoredRule = (ruleData: RuleInput): Rule => {
    const normalized = normalizeRuleShape(ruleData)
    const predicate = ruleData.predicate || ''
    const meta = PREDICATE_META[predicate]
    const subjectMode = meta?.relation === 'single' ? 'single' : 'dual'
    const subjectsA = [...normalized.subjects]
    const subjectsB: RuleSubject[] = []
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
      predicate,
      params: { ...(ruleData.params ?? getDefaultParams(predicate)) },
      description: ruleData.description ?? '',
      createdAt: ruleData.createdAt ?? Date.now(),
      updatedAt: ruleData.updatedAt ?? Date.now(),
      // 新增字段：NOT 取反 和 多规则组合
      not: ruleData.not ?? false,
      logicOperator: ruleData.logicOperator ?? null,
      subRules: ruleData.subRules ? ruleData.subRules
        .filter((subRule): subRule is typeof subRule & { predicate: string } => typeof subRule.predicate === 'string')
        .map(sr => ({
        predicate: sr.predicate,
        not: sr.not ?? false,
        subjects: sr.subjects || [],
        params: { ...(sr.params || {}) }
      })) : null
    }
  }

  const addRule = (ruleData: RuleInput) => {
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

  const deleteRule = (ruleId: string) => {
    const idx = rules.value.findIndex(r => r.id === ruleId)
    if (idx !== -1) {
      rules.value.splice(idx, 1)
      return true
    }
    return false
  }

  const updateRule = (ruleId: string, patch: RuleInput) => {
    const rule = rules.value.find(r => r.id === ruleId)
    if (!rule) return false
    Object.assign(rule, patch)
    rule.updatedAt = Date.now()
    return true
  }

  const toggleRule = (ruleId: string) => {
    const rule = rules.value.find(r => r.id === ruleId)
    if (!rule) return false
    rule.enabled = !rule.enabled
    rule.updatedAt = Date.now()
    return rule.enabled
  }

  const clearAllRules = () => {
    rules.value = []
    _idCounter = 1
  }

  const getAllRules = () => rules.value
  const getActiveRules = () => rules.value.filter(r => r.enabled)

  const getRulesForStudent = (studentId: number) => {
    const student = students.value.find(s => s.id === studentId)
    return rules.value.filter(r => {
      const normalized = normalizeRuleShape(r)
      const allEntries = [...(normalized.subjects || [])]
      const byPerson = allEntries.some(e => e.type === 'person' && e.id === studentId)
      if (byPerson) return true
      const byAll = allEntries.some(e => e.type === 'all')
      if (byAll) return true
      const byTag = allEntries.some(entry => entry.type === 'tag' && entry.id !== null && student?.tags?.includes(entry.id))
      return !!byTag
    })
  }

  const getPairRulesFor = (id1: number, id2: number) => {
    return rules.value.filter(r => {
      const normalized = normalizeRuleShape(r)
      const people = normalized.subjects.filter(e => e.type === 'person').map(e => e.id)
      return people.includes(id1) && people.includes(id2)
    })
  }

  const exportRules = () => {
    return JSON.stringify({ version: CURRENT_RULE_VERSION, rules: rules.value }, null, 2)
  }

  const importRules = (jsonString: string) => {
    try {
      const data: unknown = JSON.parse(jsonString)
      const imported: Rule[] = []
      const errors: Array<{ item?: unknown; warnings?: string[]; message?: string }> = []
      const list = Array.isArray(data)
        ? data
        : (isRecord(data) && Array.isArray(data.rules) ? data.rules : [])

      for (const item of list) {
        const parsedItem = parseRuleInput(item)
        if (!parsedItem) {
          errors.push({ item, warnings: ['规则必须是对象'] })
          continue
        }
        const normalizedItem = {
          ...parsedItem,
          ...normalizeRuleShape(parsedItem)
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, imported: 0, errors: [{ message: `JSON 解析失败: ${message}` }] }
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
