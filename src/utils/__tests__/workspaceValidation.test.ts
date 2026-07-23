import { describe, expect, it } from 'vitest'
import { maxSeatGroupCount } from '@/constants/seatConfig'
import { WORKSPACE_SCHEMA_VERSION, type Workspace } from '@/types/models'
import { validateWorkspaceDocument } from '../workspaceValidation'

const createWorkspace = (): Workspace => ({
  meta: { version: WORKSPACE_SCHEMA_VERSION, app: 'SeatingChartEditor', createdAt: '2026-07-15T00:00:00.000Z' },
  students: [{ id: 1, name: '张三', studentNumber: 1, tags: [] }],
  tags: [],
  layout: {
    config: {
      groupCount: 1,
      columnsPerGroup: 1,
      seatsPerColumn: 1,
      groups: [{ columns: 1, rows: 1 }],
      shiftDistance: 1,
      podiumPosition: 'bottom',
      guardSeats: {
        enabled: false,
        leftEnabled: false,
        rightEnabled: false,
        includeInAutoAssignment: false,
        hideEmptyOnExport: true
      }
    },
    seats: [{ id: 'seat-0-0-0', kind: 'regular', group: 0, col: 0, row: 0, studentId: 1, empty: false }]
  },
  zones: [],
  rules: [],
  exportSettings: {}
})

describe('workspaceValidation', () => {
  it('accepts a complete current workspace', () => {
    expect(validateWorkspaceDocument(createWorkspace())).toMatchObject({ valid: true, errors: [] })
  })

  it('reports nested layout and tag contract violations', () => {
    const workspace = createWorkspace()
    workspace.tags = [
      { id: 1, name: '重点', color: '#000000', showInSeatChart: true },
      { id: 1, name: '重复', color: '#000000', showInSeatChart: true }
    ]
    workspace.layout.config.groups = []

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('tags[1].id'),
      expect.stringContaining('layout.config.groups')
    ]))
  })

  it('rejects out-of-range seats and dangling student references', () => {
    const workspace = createWorkspace()
    workspace.layout.seats[0].col = 4
    workspace.layout.seats[0].studentId = 99

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('col 超出大组列范围'),
      expect.stringContaining('不存在的学生 99')
    ]))
  })

  it('uses the shared 50-group limit for workspace data', () => {
    const workspace = createWorkspace()
    workspace.layout.config.groupCount = maxSeatGroupCount + 1
    workspace.layout.config.groups = Array.from(
      { length: maxSeatGroupCount + 1 },
      () => ({ columns: 1, rows: 1 })
    )

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      `layout.config.groupCount 不能超过 ${maxSeatGroupCount}`,
      `layout.config.groups 数量不能超过 ${maxSeatGroupCount}`
    ]))
  })

  it('rejects workspace versions newer than the supported contract', () => {
    const workspace = createWorkspace()
    workspace.meta!.version = '99.0'

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining(`高于当前支持的 ${WORKSPACE_SCHEMA_VERSION}`)
    ]))
  })

  it('validates rotation structure and seat references', () => {
    const workspace = createWorkspace()
    workspace.rotationGroups = [{
      id: 1,
      name: '轮换组',
      type: 'cycle',
      zones: [
        { id: 1, name: '有效选区', seatIds: ['seat-0-0-0'] },
        { id: 1, name: '无效选区', seatIds: ['seat-missing'] }
      ]
    }]

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('id 与其他轮换选区重复'),
      expect.stringContaining('引用了不存在的座位 seat-missing')
    ]))
  })

  it('rejects dangling rule subjects and params', () => {
    const workspace = createWorkspace()
    workspace.rules = [{
      priority: 'required',
      subjects: [{ type: 'person', id: 99 }],
      predicate: 'IN_ZONE',
      params: { zoneId: 88 }
    }]

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('引用了不存在的学生 99'),
      expect.stringContaining('引用了不存在的选区 88')
    ]))
  })

  it('rejects ambiguous seat identities and duplicate student assignments', () => {
    const workspace = createWorkspace()
    workspace.layout.config.seatsPerColumn = 2
    workspace.layout.config.groups = [{ columns: 1, rows: 2 }]
    workspace.layout.seats.push(
      { id: 'seat-0-0-0', kind: 'regular', group: 0, col: 0, row: 1, studentId: 1, empty: false },
      { id: 'seat-0-0-1', kind: 'regular', group: 0, col: 0, row: 0, studentId: null, empty: false }
    )

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('layout.seats[1].id 与其他条目重复'),
      expect.stringContaining('与其他普通座位坐标重复'),
      expect.stringContaining('id 与 group/col/row 不一致'),
      expect.stringContaining('将学生 1 同时分配到')
    ]))
  })

  it('requires canonical and unique guard seats for each side', () => {
    const workspace = createWorkspace()
    workspace.layout.seats.push(...([
      { id: 'guard-center', kind: 'guard', guardSide: 'center', studentId: null, empty: false },
      { id: 'guard-left', kind: 'guard', guardSide: 'right', studentId: null, empty: false },
      { id: 'guard-custom', kind: 'guard', guardSide: 'left', studentId: null, empty: false },
      { id: 'guard-another', kind: 'guard', guardSide: 'left', studentId: null, empty: false }
    ] as unknown as Workspace['layout']['seats']))

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'layout.seats[1].guardSide 必须是 left 或 right',
      expect.stringContaining('layout.seats[2].id 必须与 guardSide 一致'),
      expect.stringContaining('layout.seats[4].guardSide 与其他护法位重复，每侧最多一个')
    ]))
  })

  it('rejects invalid and duplicate student numbers', () => {
    const workspace = createWorkspace()
    workspace.students.push(...([
      { id: 2, name: '李四', studentNumber: 1, tags: [] },
      { id: 3, name: '王五', studentNumber: '2', tags: [] }
    ] as unknown as Workspace['students']))

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'students[1].studentNumber 与其他学生重复',
      'students[2].studentNumber 必须是有限数字或 null'
    ]))
  })

  it('requires boolean not flags for top-level and nested rules', () => {
    const workspace = createWorkspace()
    workspace.rules = [{
      priority: 'required',
      subjects: [{ type: 'person', id: 1 }],
      predicate: 'IN_ROW_RANGE',
      params: { minRow: 1, maxRow: 1 },
      not: 'false',
      subRules: [{
        predicate: 'IN_ROW_RANGE',
        params: { minRow: 1, maxRow: 1 },
        not: 1
      }]
    }] as unknown as Workspace['rules']

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'rules[0].not 必须是布尔值',
      'rules[0].subRules[0].not 必须是布尔值'
    ]))
  })

  it('rejects incomplete, duplicate and excessive numeric attribute definitions', () => {
    const workspace = createWorkspace()
    workspace.studentAttributeDefinitions = [
      {
        id: 'height',
        name: '',
        unit: 'cm',
        min: 200,
        max: 100,
        precision: -1,
        enabled: true
      },
      {
        id: 'height',
        name: '重复身高',
        unit: 'cm',
        min: null,
        max: null,
        precision: 0,
        enabled: true
      }
    ]

    const invalidResult = validateWorkspaceDocument(workspace)
    expect(invalidResult.valid).toBe(false)
    expect(invalidResult.errors).toEqual(expect.arrayContaining([
      'studentAttributeDefinitions[0].name 必须是非空字符串',
      'studentAttributeDefinitions[0].min 不能大于 max',
      'studentAttributeDefinitions[0].precision 必须是 0 到 10 的整数',
      'studentAttributeDefinitions[1].id 与其他数值属性重复'
    ]))

    workspace.studentAttributeDefinitions = Array.from({ length: 501 }, (_, index) => ({
      id: `attr-${index}`,
      name: `属性 ${index}`,
      unit: '',
      min: null,
      max: null,
      precision: 0,
      enabled: true
    }))
    const excessiveResult = validateWorkspaceDocument(workspace)
    expect(excessiveResult.valid).toBe(false)
    expect(excessiveResult.errors).toContain('studentAttributeDefinitions 数量不能超过 500')
  })

  it('validates numeric attribute keys, values, bounds and precision', () => {
    const workspace = createWorkspace()
    workspace.studentAttributeDefinitions = [{
      id: 'score',
      name: '成绩',
      unit: '分',
      min: 0,
      max: 100,
      precision: 1,
      enabled: true
    }]
    workspace.students = ([
      { id: 1, name: '张三', studentNumber: 1, tags: [], numericAttributes: { score: '95', unknown: 1 } },
      { id: 2, name: '李四', studentNumber: 2, tags: [], numericAttributes: { score: -1 } },
      { id: 3, name: '王五', studentNumber: 3, tags: [], numericAttributes: { score: 100.12 } }
    ] as unknown as Workspace['students'])

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'students[0].numericAttributes.score 必须是有限数字或 null',
      'students[0].numericAttributes.unknown 没有对应的数值属性定义',
      'students[1].numericAttributes.score 不能小于 0',
      'students[2].numericAttributes.score 不能大于 100',
      'students[2].numericAttributes.score 小数位数不能超过 1'
    ]))
  })

  it('rejects numeric attribute definitions without a representable precision value', () => {
    const workspace = createWorkspace()
    workspace.studentAttributeDefinitions = [{
      id: 'narrow',
      name: '窄区间',
      unit: '',
      min: 1.21,
      max: 1.25,
      precision: 1,
      enabled: true
    }]

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'studentAttributeDefinitions[0] 在当前 min、max 和 precision 下没有可表示值'
    )
  })

  it('rejects numeric attribute definitions outside the reliable precision tick domain', () => {
    const workspace = createWorkspace()
    workspace.studentAttributeDefinitions = [{
      id: 'unsafe-scale',
      name: '超出可靠刻度',
      unit: '',
      min: 1000000,
      max: 1000000,
      precision: 10,
      enabled: true
    }]

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'studentAttributeDefinitions[0] 在当前 min、max 和 precision 下没有可表示值'
    )
  })

  it('rejects unsafe numeric attribute values that would change during load', () => {
    const workspace = createWorkspace()
    workspace.studentAttributeDefinitions = [{
      id: 'unsafe-value',
      name: '不安全值',
      unit: '',
      min: null,
      max: null,
      precision: 0,
      enabled: true
    }]
    workspace.students[0].numericAttributes = { 'unsafe-value': 1e20 }

    const result = validateWorkspaceDocument(workspace)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'students[0].numericAttributes.unsafe-value 无法按数值属性定义无损重载'
    )
  })
})
