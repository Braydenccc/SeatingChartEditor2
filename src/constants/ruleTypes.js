/**
 * ruleTypes.js — 智能排位规则系统常量与元数据
 * Rules DSL v3 — 完整谓词枚举、权重定义、UI 文本
 */

// ==================== 优先级 ====================

export const RulePriority = {
  REQUIRED: 'required',
  PREFER: 'prefer',
  OPTIONAL: 'optional'
}

export const PENALTY_WEIGHTS = {
  required: 100000,
  prefer: 1000,
  optional: 10
}

export const PRIORITY_LABELS = {
  required: '必须',
  prefer: '尽量',
  optional: '可选'
}

export const PRIORITY_COLORS = {
  required: '#ef4444',
  prefer: '#f59e0b',
  optional: '#94a3b8'
}

export const PRIORITY_ICONS = {
  required: '🔴',
  prefer: '🟡',
  optional: '⚪'
}

// ==================== 主体类型（兼容旧字段展示） ====================

export const SUBJECT_KIND_LABELS = {
  multi: '多对象',
  single: '单对象（旧）',
  dual: '双对象（旧）',
  student: '单个学生',
  pair: '学生对',
  tag: '标签分组',
  tag_pair: '标签对'
}

// ==================== 谓词（Predicate） ====================

export const RuleType = {
  // A. 单人位置谓词
  IN_ROW_RANGE: 'IN_ROW_RANGE',
  NOT_IN_COLUMN_TYPE: 'NOT_IN_COLUMN_TYPE',
  IN_ZONE: 'IN_ZONE',
  NOT_IN_ZONE: 'NOT_IN_ZONE',
  IN_GROUP_RANGE: 'IN_GROUP_RANGE',

  // B. 对关系谓词
  MUST_BE_SEATMATES: 'MUST_BE_SEATMATES',
  MUST_NOT_BE_SEATMATES: 'MUST_NOT_BE_SEATMATES',
  DISTANCE_AT_MOST: 'DISTANCE_AT_MOST',
  DISTANCE_AT_LEAST: 'DISTANCE_AT_LEAST',
  NOT_BLOCK_VIEW: 'NOT_BLOCK_VIEW',
  MUST_BE_SAME_GROUP: 'MUST_BE_SAME_GROUP',
  MUST_NOT_BE_SAME_GROUP: 'MUST_NOT_BE_SAME_GROUP',
  MUST_BE_ADJACENT_ROW: 'MUST_BE_ADJACENT_ROW',

  // C. 分组分散谓词
  DISTRIBUTE_EVENLY: 'DISTRIBUTE_EVENLY',
  CLUSTER_TOGETHER: 'CLUSTER_TOGETHER'
}

// 谓词中文标签
export const RULE_TYPE_LABELS = {
  IN_ROW_RANGE: '坐在指定行范围',
  NOT_IN_COLUMN_TYPE: '不坐在指定列类型',
  IN_ZONE: '必须在指定分区',
  NOT_IN_ZONE: '禁止在指定分区',
  IN_GROUP_RANGE: '坐在指定大组范围',
  MUST_BE_SEATMATES: '必须同桌',
  MUST_NOT_BE_SEATMATES: '禁止同桌',
  DISTANCE_AT_MOST: '距离上限',
  DISTANCE_AT_LEAST: '距离下限',
  NOT_BLOCK_VIEW: '不遮挡视线',
  MUST_BE_SAME_GROUP: '必须同大组',
  MUST_NOT_BE_SAME_GROUP: '必须不同大组',
  MUST_BE_ADJACENT_ROW: '必须相邻排',
  DISTRIBUTE_EVENLY: '均匀分散',
  CLUSTER_TOGETHER: '聚集在一起'
}

// 谓词描述（用于 UI 提示）
export const RULE_TYPE_DESCRIPTIONS = {
  IN_ROW_RANGE: '限定坐在第 N～M 排之间（1=最前排）',
  NOT_IN_COLUMN_TYPE: '避开特定列类型（边缘/过道/中间）',
  IN_ZONE: '必须坐在指定的选区范围内',
  NOT_IN_ZONE: '禁止坐在指定的选区范围内',
  IN_GROUP_RANGE: '限定在第 N～M 大组之间（1=最左组）',
  MUST_BE_SEATMATES: '对象集合内任意两者必须同桌',
  MUST_NOT_BE_SEATMATES: '对象集合内任意两者禁止同桌',
  DISTANCE_AT_MOST: '对象集合内任意两者曼哈顿距离不超过 N',
  DISTANCE_AT_LEAST: '对象集合内任意两者曼哈顿距离至少为 N',
  NOT_BLOCK_VIEW: '对象集合内前者不可坐在后者的视线正后方',
  MUST_BE_SAME_GROUP: '对象集合内任意两者必须同一大组',
  MUST_NOT_BE_SAME_GROUP: '对象集合内任意两者必须不同大组',
  MUST_BE_ADJACENT_ROW: '对象集合内任意两者在同大组内行数差为 1',
  DISTRIBUTE_EVENLY: '同标签学生尽量分散到不同大组/排',
  CLUSTER_TOGETHER: '同标签学生尽量聚集在同一区域'
}

// 谓词元数据：适用对象语义 + 参数规格
export const PREDICATE_META = {
  IN_ROW_RANGE: {
    relation: 'single',
    minSubjects: 1,
    params: [
      { key: 'minRow', label: '最前排', type: 'number', min: 1, default: 1 },
      { key: 'maxRow', label: '最后排', type: 'number', min: 1, default: 3 }
    ]
  },
  NOT_IN_COLUMN_TYPE: {
    relation: 'single',
    minSubjects: 1,
    params: [
      {
        key: 'columnType',
        label: '列类型',
        type: 'select',
        options: [
          { value: 'edge', label: '边缘列（过道+墙边）' },
          { value: 'aisle', label: '过道列' },
          { value: 'wall', label: '墙边列' },
          { value: 'center', label: '中间列' }
        ],
        default: 'aisle'
      }
    ]
  },
  IN_ZONE: {
    relation: 'single',
    minSubjects: 1,
    params: [
      { key: 'zoneId', label: '选区', type: 'zone', default: null }
    ]
  },
  NOT_IN_ZONE: {
    relation: 'single',
    minSubjects: 1,
    params: [
      { key: 'zoneId', label: '选区', type: 'zone', default: null }
    ]
  },
  IN_GROUP_RANGE: {
    relation: 'single',
    minSubjects: 1,
    params: [
      { key: 'minGroup', label: '最左大组', type: 'number', min: 1, default: 1 },
      { key: 'maxGroup', label: '最右大组', type: 'number', min: 1, default: 2 }
    ]
  },
  MUST_BE_SEATMATES: {
    relation: 'pair',
    minSubjects: 2,
    params: []
  },
  MUST_NOT_BE_SEATMATES: {
    relation: 'pair',
    minSubjects: 2,
    params: []
  },
  DISTANCE_AT_MOST: {
    relation: 'pair',
    minSubjects: 2,
    params: [
      { key: 'distance', label: '最大距离', type: 'number', min: 1, default: 2 }
    ]
  },
  DISTANCE_AT_LEAST: {
    relation: 'pair',
    minSubjects: 2,
    params: [
      { key: 'distance', label: '最小距离', type: 'number', min: 1, default: 3 }
    ]
  },
  NOT_BLOCK_VIEW: {
    relation: 'ordered_pair',
    minSubjects: 2,
    params: [
      {
        key: 'tolerance',
        label: '容忍角度',
        type: 'select',
        options: [
          { value: 0, label: '仅正后方（严格）' },
          { value: 1, label: '正后方±1列（宽松）' }
        ],
        default: 0
      }
    ],
    ordered: true // id1 不遮挡 id2（有序）
  },
  MUST_BE_SAME_GROUP: {
    relation: 'pair',
    minSubjects: 2,
    params: []
  },
  MUST_NOT_BE_SAME_GROUP: {
    relation: 'pair',
    minSubjects: 2,
    params: []
  },
  MUST_BE_ADJACENT_ROW: {
    relation: 'pair',
    minSubjects: 2,
    params: []
  },
  DISTRIBUTE_EVENLY: {
    relation: 'single',
    minSubjects: 1,
    params: [
      {
        key: 'scope',
        label: '分散维度',
        type: 'select',
        options: [
          { value: 'group', label: '分散到不同大组' },
          { value: 'row', label: '分散到不同排' }
        ],
        default: 'group'
      }
    ]
  },
  CLUSTER_TOGETHER: {
    relation: 'single',
    minSubjects: 1,
    params: [
      {
        key: 'scope',
        label: '聚集范围',
        type: 'select',
        options: [
          { value: 'group', label: '聚集在同一大组' },
          { value: 'zone', label: '聚集在同一区域' }
        ],
        default: 'group'
      }
    ]
  }
}

// 列类型标签（用于 UI 显示）
export const COLUMN_TYPE_LABELS = {
  edge: '边缘列',
  aisle: '过道列',
  wall: '墙边列',
  center: '中间列'
}

// 分散维度标签
export const SCOPE_LABELS = {
  group: '大组',
  row: '排',
  zone: '区域'
}

/**
 * 获取指定谓词适用的主体模式列表（兼容旧调用，内部已切到 relation 语义）
 */
export function getCompatibleSubjectModes(predicate) {
  const relation = PREDICATE_META[predicate]?.relation
  if (!relation) return []
  return relation === 'single' ? ['single'] : ['dual']
}

/**
 * 获取指定谓词的参数规格
 */
export function getPredicateParams(predicate) {
  return PREDICATE_META[predicate]?.params ?? []
}

/**
 * 生成谓词参数的默认值对象
 */
export function getDefaultParams(predicate) {
  const params = getPredicateParams(predicate)
  const result = {}
  for (const p of params) {
    result[p.key] = p.default
  }
  return result
}
