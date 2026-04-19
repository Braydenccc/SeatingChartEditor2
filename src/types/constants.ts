import type { RulePriority, RulePredicate } from './models'

// 常量相关类型定义

// 优先级权重映射
export type PenaltyWeights = Record<RulePriority, number>

// 优先级标签映射
export type PriorityLabels = Record<RulePriority, string>

// 优先级颜色映射
export type PriorityColors = Record<RulePriority, string>

// 优先级图标映射
export type PriorityIcons = Record<RulePriority, string>

// 规则类型标签映射
export type RuleTypeLabels = Record<RulePredicate, string>

// 谓词元数据
export interface PredicateMeta {
  label: string
  category: 'position' | 'relation' | 'distribution'
  requiresSubjects: number
  paramFields: ParamField[]
}

export interface ParamField {
  key: string
  label: string
  type: 'number' | 'select' | 'zone'
  options?: Array<{ value: string | number; label: string }>
  min?: number
  max?: number
  required?: boolean
}

// 标签颜色定义
export interface TagColorDefinition {
  name: string
  color: string
}

// 列类型
export type ColumnType = 'left' | 'middle' | 'right'

// 作用域类型
export type ScopeType = 'global' | 'group'
