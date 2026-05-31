// 核心数据模型类型定义

// 学生数据模型
export interface Student {
  id: number
  name: string
  studentNumber: number | null
  tags: number[]
}

// 标签数据模型
export interface Tag {
  id: number
  name: string
  color: string
  showInSeatChart: boolean
}

// 座位数据模型
export interface Seat {
  id: string
  groupIndex: number
  columnIndex: number
  rowIndex: number
  studentId: number | null
  isEmpty: boolean
}

// 座位配置模型
export interface SeatConfig {
  groupCount: number
  columnsPerGroup: number
  seatsPerColumn: number
  groups: GroupConfig[]
  shiftDistance: number
  podiumPosition: 'top' | 'bottom'
}

export interface GroupConfig {
  columns: number
  rows: number
}

// 选区数据模型
export interface Zone {
  id: number
  name: string
  tagIds: number[]
  seatIds: string[]
  visible: boolean
}

// 规则主体类型
export type SubjectType = 'person' | 'tag'

export interface RuleSubject {
  type: SubjectType
  id: number | null
}

// 规则优先级
export type RulePriority = 'required' | 'prefer' | 'optional'

// 规则谓词类型
export type RulePredicate =
  | 'IN_ROW_RANGE'
  | 'NOT_IN_COLUMN_TYPE'
  | 'IN_ZONE'
  | 'NOT_IN_ZONE'
  | 'IN_GROUP_RANGE'
  | 'MUST_BE_SEATMATES'
  | 'MUST_NOT_BE_SEATMATES'
  | 'DISTANCE_AT_MOST'
  | 'DISTANCE_AT_LEAST'
  | 'NOT_BLOCK_VIEW'
  | 'MUST_BE_SAME_GROUP'
  | 'MUST_NOT_BE_SAME_GROUP'
  | 'MUST_BE_ADJACENT_ROW'
  | 'DISTRIBUTE_EVENLY'
  | 'CLUSTER_TOGETHER'

// 规则参数类型
export interface RuleParams {
  rowStart?: number
  rowEnd?: number
  columnType?: 'left' | 'middle' | 'right'
  zoneId?: number
  groupStart?: number
  groupEnd?: number
  distance?: number
  scope?: 'global' | 'group'
  [key: string]: unknown
}

// 规则数据模型
export interface Rule {
  id: string
  priority: RulePriority
  subjects: RuleSubject[]
  predicates: RulePredicate[]
  params: RuleParams
  version: number
}

// 工作区元数据
export interface WorkspaceMeta {
  version: string
  app: string
  createdAt: string
}

// 工作区数据模型
export interface Workspace {
  meta: WorkspaceMeta
  students: Student[]
  tags: Tag[]
  seatConfig: SeatConfig
  seats: Seat[]
  zones: Zone[]
  rules: Rule[]
  exportSettings?: ExportSettings
  tagSettings?: TagSettings
}

// 导出设置
export interface ExportSettings {
  showStudentNumber: boolean
  showTags: boolean
  showEmptySeats: boolean
  fontSize: number
  cellPadding: number
}

// 标签设置
export interface TagSettings {
  showTagsInSeatChart: boolean
  tagDisplayMode: 'dot' | 'corner' | 'bottom'
}

// 座位位置解析结果
export interface SeatPosition {
  groupIndex: number
  columnIndex: number
  rowIndex: number
}

// 排位进度信息
export interface AssignmentIterationInfo {
  i: number
  iterations: number
  score: number
  bestScore: number
  reheatCount: number
  algorithm: string
}
