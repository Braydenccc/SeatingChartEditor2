// 类型定义统一导出

// 核心模型
export type {
  Student,
  Tag,
  Seat,
  SeatConfig,
  GroupConfig,
  Zone,
  Rule,
  RuleSubject,
  RulePriority,
  RulePredicate,
  RuleParams,
  Workspace,
  WorkspaceMeta,
  ExportSettings,
  TagSettings,
  SeatPosition,
  AssignmentIterationInfo,
  SubjectType
} from './models'

// Composable 返回类型
export type {
  UseStudentDataReturn,
  UseTagDataReturn,
  UseZoneDataReturn,
  UseSeatChartReturn,
  UseSeatRulesReturn,
  UseAssignmentReturn,
  UseUndoReturn
} from './composables'

// 常量类型
export type {
  PenaltyWeights,
  PriorityLabels,
  PriorityColors,
  PriorityIcons,
  RuleTypeLabels,
  PredicateMeta,
  ParamField,
  TagColorDefinition,
  ColumnType,
  ScopeType
} from './constants'

// 工具类型
export type {
  DeepPartial,
  DeepReadonly,
  ExtractFunctionParams,
  ExtractFunctionReturn,
  Nullable,
  Optional,
  ArrayElement
} from './utils'
