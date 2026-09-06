import type { Ref, ComputedRef } from 'vue'
import type {
  Student,
  Tag,
  Seat,
  SeatConfig,
  Zone,
  Rule,
  RulePriority,
  RuleSubject,
  RulePredicate,
  RuleParams,
  RuleReferencedEntityType,
  RuleEntityReference,
  EntityDeletionResult,
  GroupConfig,
  SeatPosition,
  AssignmentIterationInfo
} from './models'

// Composable 返回类型定义

export interface WorkspaceSaveResult {
  success: boolean
  canceled: boolean
  error?: string
}

// useStudentData 返回类型
export interface UseStudentDataReturn {
  students: ComputedRef<Student[]>
  selectedStudentId: Ref<number | null>
  selectStudent: (studentId: number) => void
  clearSelection: () => void
  getSelectedStudent: ComputedRef<Student | null>
  addStudent: () => number
  setStudentCount: (targetCount: number) => boolean
  updateStudent: (
    studentId: number,
    studentData: Partial<Omit<Student, 'tags' | 'numericAttributes'>> & {
      tags?: (number | null | undefined)[]
      numericAttributes?: Record<string, unknown>
    }
  ) => void
  deleteStudent: (studentId: number) => EntityDeletionResult
  lastStudentDeletionResult: Ref<EntityDeletionResult | null>
  addTagToStudents: (tagId: number, studentIds: number[]) => void
  removeTagFromStudent: (tagId: number, studentId: number) => void
  removeTagFromStudents: (tagId: number) => void
  clearAllStudents: () => void
  replaceStudentData: (students: Student[]) => void
  syncStudentIdCounter: () => void
}

// useTagData 返回类型
export interface UseTagDataReturn {
  tags: Ref<Tag[]>
  showTagsInSeatChart: Ref<boolean>
  tagDisplayMode: Ref<'dot' | 'corner' | 'bottom'>
  addTag: (tagData?: Partial<Tag>) => number
  editTag: (tagId: number, tagData: Partial<Tag>) => void
  updateTag: (tagId: number, tagData: Partial<Tag>) => void
  getTagById: (tagId: number) => Tag | undefined
  deleteTag: (tagId: number) => EntityDeletionResult
  clearAllTags: () => void
  replaceTagData: (tags: Tag[]) => void
  setShowTagsInSeatChart: (show: boolean) => void
  setTagDisplayMode: (mode: 'dot' | 'corner' | 'bottom') => void
}

// useZoneData 返回类型
export interface UseZoneDataReturn {
  zones: Ref<Zone[]>
  selectedZoneId: Ref<number | null>
  addZone: () => number
  updateZone: (zoneId: number, updates: Partial<Zone>) => void
  deleteZone: (zoneId: number) => EntityDeletionResult
  addTagToZone: (zoneId: number, tagId: number) => void
  removeTagFromZone: (zoneId: number, tagId: number) => void
  addSeatToZone: (zoneId: number, seatId: string) => void
  removeSeatFromZone: (zoneId: number, seatId: string) => void
  toggleSeatInZone: (zoneId: number, seatId: string) => void
  getZoneForSeat: (seatId: unknown) => Zone | null
  getZoneColor: (zoneId: number) => string
  selectZone: (zoneId: number) => void
  clearZoneSelection: () => void
  toggleZoneVisible: (zoneId: number) => void
  visibleZoneSeats: ComputedRef<Map<string, string>>
  removeTagFromAllZones: (tagId: number) => void
  cleanupInvalidSeats: (validSeatIds: string[]) => void
  clearAllZones: () => void
  replaceZoneData: (zones: Zone[]) => void
  syncZoneIdCounter: () => void
}

// useSeatChart 返回类型
export interface UseSeatChartReturn {
  seatConfig: Ref<SeatConfig>
  seats: Ref<Seat[]>
  organizedSeats: ComputedRef<Seat[][][]>
  seatMap: Ref<Map<string, Seat>>
  initializeSeats: () => void
  assignStudent: (seatId: string, studentId: number, recordUndo?: boolean) => void
  clearSeat: (seatId: string, recordUndo?: boolean) => void
  swapSeats: (seatId1: string, seatId2: string, recordUndo?: boolean) => boolean
  toggleEmpty: (seatId: string, recordUndo?: boolean) => void
  updateConfig: (newConfig: Partial<SeatConfig>) => void
  replaceSeatChartState: (config: SeatConfig, seats: Seat[]) => void
  getGroupConfig: (groupIndex: number) => GroupConfig
  parseSeatId: (seatId: string) => SeatPosition | null
  generateSeatId: (groupIndex: number, columnIndex: number, rowIndex: number) => string
  findSeatByStudent: (studentId: number) => Seat | null
  getStudentAtSeat: (seatId: string) => number | null
  areDeskmates: (seatId1: string, seatId2: string) => boolean
  getSeatDistance: (seatId1: string, seatId2: string) => number
  getAdjacentSeats: (seatId: string) => Seat[]
  clearAllSeats: () => void
  [key: string]: unknown
}

// useSeatRules 返回类型
export interface UseSeatRulesReturn {
  rules: Ref<Rule[]>
  addRule: (ruleData: Partial<Rule>) => string
  updateRule: (ruleId: string, updates: Partial<Rule>) => void
  deleteRule: (ruleId: string) => void
  clearAllRules: () => void
  getRuleText: (rule: Rule) => string
  validateRule: (rule: Rule) => { valid: boolean; errors: string[] }
  getRuleReferences: (
    entityType: RuleReferencedEntityType,
    entityId: number | string
  ) => RuleEntityReference[]
  [key: string]: unknown
}

// useAssignment 返回类型
export interface UseAssignmentReturn {
  isAssigning: Ref<boolean>
  assignmentProgress: Ref<number>
  assignmentIterationInfo: Ref<AssignmentIterationInfo>
  runSmartAssignment: () => Promise<void>
  runAssignment: () => Promise<void>
  runRandomAssignment: () => void
  stopAssignment: () => void
}

// useUndo 返回类型
export interface UseUndoReturn {
  canUndo: () => boolean
  canRedo: () => boolean
  undo: () => void
  redo: () => void
  recordAssign: (seatId: string, studentId: number, previousSeatId?: string | null) => void
  recordClear: (seatId: string, studentId: number) => void
  recordSwap: (seatId1: string, seatId2: string) => void
  recordToggleEmpty: (seatId: string) => void
  recordBatch: (description: string, action: () => void) => void
  createSnapshot: () => unknown[]
  clearHistory: () => void
  highlightedSeats: Ref<Set<string>>
}
