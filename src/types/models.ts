// 核心数据模型类型定义

// 学生数据模型
export interface Student {
  id: number
  name: string
  studentNumber: number | null
  tags: number[]
  numericAttributes?: Record<string, number | null>
}

// 学生数值属性定义
export interface NumericAttributeDefinition {
  id: string
  name: string
  unit: string
  min: number | null
  max: number | null
  precision: number
  enabled: boolean
  showInEditor?: boolean
  builtInKey?: 'height' | 'score'
  createdFrom?: 'default' | 'manual' | 'excel'
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
  kind?: 'regular' | 'guard'
  guardSide?: 'left' | 'right'
}

// 座位配置模型
export interface SeatConfig {
  groupCount: number
  columnsPerGroup: number
  seatsPerColumn: number
  groups: GroupConfig[]
  shiftDistance: number
  podiumPosition: 'top' | 'bottom'
  guardSeats?: GuardSeatsConfig
  shiftColShift?: number
  shiftDirection?: number
  alignment?: 'top' | 'bottom'
  seatAlignment?: 'top' | 'bottom'
}

export interface GroupConfig {
  columns: number
  rows: number
}

export interface GuardSeatsConfig {
  enabled: boolean
  leftEnabled: boolean
  rightEnabled: boolean
  includeInAutoAssignment: boolean
  hideEmptyOnExport: boolean
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
export type SubjectType = 'person' | 'tag' | 'all'

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
  | 'ATTRIBUTE_ROW_GRADIENT'
  | 'ATTRIBUTE_GROUP_BALANCE'
  | 'ATTRIBUTE_PAIR_DELTA'
  | 'ATTRIBUTE_DISTRIBUTE_BANDS'

// 规则参数类型
export interface RuleParams {
  minRow?: number
  maxRow?: number
  minGroup?: number
  maxGroup?: number
  rowStart?: number
  rowEnd?: number
  columnType?: 'left' | 'middle' | 'right' | 'edge' | 'aisle' | 'wall' | 'center'
  zoneId?: number
  groupStart?: number
  groupEnd?: number
  distance?: number
  scope?: 'global' | 'group'
  attributeId?: string
  direction?: 'lowFront' | 'highFront'
  aggregate?: 'average' | 'sum'
  bandCount?: number
  maxDelta?: number
  minDelta?: number
  tolerance?: number
  [key: string]: unknown
}

export interface RotationZone {
  id: number
  name: string
  seatIds: string[]
}

export interface RotationGroup {
  id: number
  name: string
  type: 'cycle' | 'swap'
  zones: RotationZone[]
}

export interface RuleSubRule {
  predicate: RulePredicate | string
  not: boolean
  params: RuleParams
  subjects?: RuleSubject[]
}

export interface LegacyRuleSubject {
  kind?: 'student' | 'tag' | 'pair' | 'tag_pair'
  id?: number | null
  id1?: number | null
  id2?: number | null
  tagId?: number | null
  tagId1?: number | null
  tagId2?: number | null
}

export interface RuleInput {
  id?: string
  priority?: RulePriority
  subjects?: RuleSubject[]
  subjectMode?: 'single' | 'dual'
  subjectsA?: RuleSubject[]
  subjectsB?: RuleSubject[]
  subject?: LegacyRuleSubject
  predicate?: RulePredicate | string
  params?: RuleParams
  version?: number
  not?: boolean
  enabled?: boolean
  description?: string
  logicOperator?: 'AND' | 'OR' | null
  subRules?: Array<Partial<RuleSubRule>> | null
  createdAt?: number
  updatedAt?: number
}

// 规则数据模型
export interface Rule {
  id: string
  priority: RulePriority
  subjects: RuleSubject[]
  subjectMode: 'single' | 'dual'
  subjectsA: RuleSubject[]
  subjectsB: RuleSubject[]
  predicate: RulePredicate | string
  params: RuleParams
  version: number
  not: boolean
  enabled: boolean
  description: string
  logicOperator: 'AND' | 'OR' | null
  subRules: RuleSubRule[] | null
  createdAt: number
  updatedAt: number
  predicates?: RulePredicate[]
}

export type RuleReferencedEntityType = 'student' | 'tag' | 'numericAttribute' | 'zone'

export interface RuleEntityReference {
  entityType: RuleReferencedEntityType
  entityId: number | string
  ruleId: string
  ruleDescription: string
  predicate: string
  locations: string[]
}

export interface EntityDeletionResult {
  success: boolean
  reason?: 'not-found' | 'referenced-by-rules'
  references: RuleEntityReference[]
}

// 工作区元数据
export interface WorkspaceMeta {
  version: string
  app: string
  createdAt: string
}

export interface WorkspaceSeat {
  id: string
  kind?: 'regular' | 'guard'
  guardSide?: 'left' | 'right'
  group?: number
  col?: number
  row?: number
  studentId: number | string | null
  empty: boolean
}

export interface WorkspaceLayout {
  config: SeatConfig
  seats: WorkspaceSeat[]
}

export type WorkspaceIdentifier = number | string

export interface WorkspaceStudent extends Omit<Student, 'id' | 'tags'> {
  id: WorkspaceIdentifier
  tags: WorkspaceIdentifier[]
}

export interface WorkspaceTag extends Omit<Tag, 'id'> {
  id: WorkspaceIdentifier
}

export interface WorkspaceZone extends Omit<Zone, 'id' | 'tagIds'> {
  id: WorkspaceIdentifier
  tagIds: WorkspaceIdentifier[]
}

export interface WorkspaceRuleSubject extends Omit<RuleSubject, 'id'> {
  id: WorkspaceIdentifier | null
}

export interface WorkspaceRuleParams extends Omit<RuleParams, 'zoneId'> {
  zoneId?: WorkspaceIdentifier
  tagId?: WorkspaceIdentifier
}

export interface WorkspaceLegacyRuleSubject extends Omit<LegacyRuleSubject, 'id' | 'id1' | 'id2' | 'tagId' | 'tagId1' | 'tagId2'> {
  id?: WorkspaceIdentifier | null
  id1?: WorkspaceIdentifier | null
  id2?: WorkspaceIdentifier | null
  tagId?: WorkspaceIdentifier | null
  tagId1?: WorkspaceIdentifier | null
  tagId2?: WorkspaceIdentifier | null
}

export interface WorkspaceRuleSubRule extends Omit<RuleSubRule, 'params' | 'subjects'> {
  params: WorkspaceRuleParams
  subjects?: WorkspaceRuleSubject[]
}

export interface WorkspaceRuleInput extends Omit<RuleInput, 'subjects' | 'subjectsA' | 'subjectsB' | 'subject' | 'params' | 'subRules'> {
  subjects?: WorkspaceRuleSubject[]
  subjectsA?: WorkspaceRuleSubject[]
  subjectsB?: WorkspaceRuleSubject[]
  subject?: WorkspaceLegacyRuleSubject
  params?: WorkspaceRuleParams
  subRules?: Array<Partial<WorkspaceRuleSubRule>> | null
}

export const WORKSPACE_SCHEMA_VERSION = '2.3'

// 工作区数据模型
export interface Workspace {
  meta?: WorkspaceMeta
  students: WorkspaceStudent[]
  studentAttributeDefinitions?: NumericAttributeDefinition[]
  studentAttributeSettings?: StudentAttributeSettings
  tags: WorkspaceTag[]
  tagSettings?: TagSettings
  layout: WorkspaceLayout
  zones: WorkspaceZone[]
  rotationGroups?: RotationGroup[]
  rules: WorkspaceRuleInput[]
  exportSettings?: Partial<ExportSettings>
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

// 学生数值属性显示设置
export interface StudentAttributeSettings {
  showNumericAttributesInEditor: boolean
}

export interface AuthUser {
  username: string
}

export type AuthType = 'retiehe' | 'webdav'

export interface WebDavConfig {
  url: string
  username?: string
  password?: string
  encryptedPassword?: string
  authorization?: string
  useProxy?: boolean
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
