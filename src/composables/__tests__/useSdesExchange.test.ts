import { describe, expect, it } from 'vitest'
import { WORKSPACE_SCHEMA_VERSION } from '@/types/models'
import {
  BSCE_EXTENSION_KEY,
  buildSdesDocumentFromState,
  buildWorkspaceFromSdes,
  getSdesImportTargets,
  parseSdesText,
  SDES_FORMAT,
  type SdesDocument
} from '../useSdesExchange'

const createOfficialLikeSdes = (): SdesDocument => ({
  format: SDES_FORMAT,
  version: 1,
  manifest: {
    producer: 'BSCE',
    producerVersion: '2.3.0',
    exportedAt: '2026-07-05T10:00:00+08:00',
    locale: 'zh-CN'
  },
  classes: [
    {
      id: 'class:3-2',
      metadata: {
        name: '三年级二班',
        description: '三年级二班的学生数据',
        class: 3,
        grade: 3
      },
      floor: 2,
      building: '1',
      room: '201',
      students: [
        {
          id: 'student:001',
          number: '001',
          gender: 'male',
          name: { display: '李华' },
          tags: ['tag:group-a'],
          attributes: {
            'attr:score': 92,
            'attr:height': 168
          }
        },
        {
          id: 'student:002',
          number: '2',
          gender: 'female',
          name: { display: '王芳' },
          tags: ['tag:group-b'],
          attributes: {
            'attr:score': 88,
            'attr:height': 162
          }
        }
      ],
      tags: [
        { id: 'tag:group-a', name: 'A组', color: '#FF0000' },
        { id: 'tag:group-b', name: 'B组', color: '#00FF0080' }
      ],
      attributeDefinitions: [
        { id: 'attr:score', name: '成绩', type: 'number', unit: '分' },
        { id: 'attr:height', name: '身高', type: 'number', unit: 'cm' },
        { id: 'attr:memo', name: '备注', type: 'string' }
      ],
      seatCharts: [
        {
          id: 'chart:grid-main',
          name: '网格座位表',
          layoutModel: 'grid',
          platformPosition: 'top',
          coordinateSystem: {
            origin: 'front-left',
            xDirection: 'left-to-right',
            yDirection: 'front-to-back'
          },
          grid: { rows: 2, columns: 2 },
          seats: [
            { id: 'seat:grid:0:0', x: 0, y: 0, kind: 'seat', capacity: 1 },
            { id: 'aisle:grid:1:0', x: 1, y: 0, kind: 'aisle' }
          ],
          assignments: [
            { seatId: 'seat:grid:0:0', studentId: 'student:001' }
          ]
        },
        {
          id: 'chart:grouped-main',
          name: '大组座位表',
          layoutModel: 'groupedColumns',
          platformPosition: 'top',
          coordinateSystem: {
            origin: 'front-left',
            xDirection: 'left-to-right',
            yDirection: 'front-to-back'
          },
          groupedColumns: {
            groups: [
              { id: 'group:0', columns: 2, rows: 2 },
              { id: 'group:1', columns: 1, rows: 2 }
            ]
          },
          seats: [
            { id: 'seat:grouped:0:0:0', kind: 'seat', group: 0, column: 0, row: 0 },
            { id: 'seat:grouped:0:1:0', kind: 'seat', group: 0, column: 1, row: 0 },
            { id: 'guard:left:0', kind: 'guard', guardPos: { side: 'left', index: 0 } },
            { id: 'guard:left:1', kind: 'guard', guardPos: { side: 'left', index: 1 } }
          ],
          assignments: [
            { seatId: 'seat:grouped:0:0:0', studentId: 'student:001' },
            { seatId: 'guard:left:0', studentId: 'student:002' },
            { seatId: 'guard:left:1', studentId: 'student:002' }
          ]
        }
      ]
    }
  ],
  extensions: {
    'app.bsce': {
      customLayoutMode: 'compact'
    }
  }
})

describe('useSdesExchange', () => {
  it('parses an official-like SDES document and lists import targets', () => {
    const document = parseSdesText(JSON.stringify(createOfficialLikeSdes()))
    const targets = getSdesImportTargets(document)

    expect(document.format).toBe(SDES_FORMAT)
    expect(targets).toHaveLength(2)
    expect(targets[0]).toMatchObject({
      className: '三年级二班',
      chartName: '网格座位表',
      layoutModel: 'grid',
      studentCount: 2
    })
    expect(targets[0].warnings).toContain('grid 座位表会按显式分组或走廊列转换为大组列行')
    expect(targets[1].warnings).toContain('1 个非数值属性将跳过')
    expect(targets[1].warnings).toContain('1 个额外护法位将跳过')
  })

  it('rejects non-SDES and unsupported SDES versions', () => {
    expect(() => parseSdesText(JSON.stringify({ format: 'other', version: 1, classes: [] })))
      .toThrow('文件格式标识不匹配')
    expect(() => parseSdesText(JSON.stringify({ format: SDES_FORMAT, version: 2, classes: [{}] })))
      .toThrow('当前仅支持 SDES v1')
  })

  it('imports groupedColumns charts with students, tags, numeric attributes and first guard seats', () => {
    const document = createOfficialLikeSdes()
    const { workspace: rawWorkspace, report } = buildWorkspaceFromSdes(document, {
      classIndex: 0,
      seatChartIndex: 1
    })
    const workspace = rawWorkspace as any

    expect(workspace.meta.version).toBe(WORKSPACE_SCHEMA_VERSION)
    expect(workspace.students).toEqual([
      {
        id: 1,
        name: '李华',
        studentNumber: 1,
        tags: [1],
        numericAttributes: {
          'attr:score': 92,
          'attr:height': 168
        }
      },
      {
        id: 2,
        name: '王芳',
        studentNumber: 2,
        tags: [2],
        numericAttributes: {
          'attr:score': 88,
          'attr:height': 162
        }
      }
    ])
    expect(workspace.studentAttributeDefinitions).toEqual([
      expect.objectContaining({ id: 'attr:score', name: '成绩', unit: '分' }),
      expect.objectContaining({ id: 'attr:height', name: '身高', unit: 'cm' })
    ])
    expect(workspace.tags).toEqual([
      { id: 1, name: 'A组', color: '#FF0000', showInSeatChart: true },
      { id: 2, name: 'B组', color: '#00FF0080', showInSeatChart: true }
    ])
    expect(workspace.layout.config).toMatchObject({
      groupCount: 2,
      columnsPerGroup: 2,
      groups: [
        { columns: 2, rows: 2 },
        { columns: 1, rows: 2 }
      ],
      podiumPosition: 'top'
    })
    expect(workspace.layout.seats).toContainEqual({
      id: 'seat-0-0-0',
      kind: 'regular',
      group: 0,
      col: 0,
      row: 0,
      studentId: 1,
      empty: false
    })
    expect(workspace.layout.seats).toContainEqual({
      id: 'guard-left',
      kind: 'guard',
      guardSide: 'left',
      group: -1,
      col: -1,
      row: -1,
      studentId: 2,
      empty: false
    })
    expect(report.skippedAttributes).toBe(1)
    expect(report.unsupportedGuards).toBe(1)
    expect(report.skippedAssignments).toBe(1)
    expect(report.lostLeadingZeroNumbers).toBe(1)
  })

  it('imports grid charts as grouped columns and treats edge markers as unavailable seats', () => {
    const document = createOfficialLikeSdes()
    const { workspace: rawWorkspace, report } = buildWorkspaceFromSdes(document, {
      classIndex: 0,
      seatChartIndex: 0
    })
    const workspace = rawWorkspace as any

    expect(workspace.layout.config).toMatchObject({
      groupCount: 1,
      columnsPerGroup: 2,
      seatsPerColumn: 2,
      groups: [{ columns: 2, rows: 2 }],
      podiumPosition: 'top'
    })
    expect(workspace.layout.seats).toContainEqual({
      id: 'seat-0-0-0',
      kind: 'regular',
      group: 0,
      col: 0,
      row: 0,
      studentId: 1,
      empty: false
    })
    expect(workspace.layout.seats).toContainEqual({
      id: 'seat-0-1-0',
      kind: 'regular',
      group: 0,
      col: 1,
      row: 0,
      studentId: null,
      empty: true
    })
    expect(report.gridMarkers).toBe(1)
    expect(report.warnings.some(warning => warning.code === 'grid-groups-inferred')).toBe(true)
  })

  it('infers groupedColumns from grid separator columns', () => {
    const document = createOfficialLikeSdes()
    document.classes[0].seatCharts![0] = {
      id: 'chart:grid-with-aisle',
      name: '带走廊网格',
      layoutModel: 'grid',
      platformPosition: 'top',
      coordinateSystem: {
        origin: 'front-left',
        xDirection: 'left-to-right',
        yDirection: 'front-to-back'
      },
      grid: { rows: 2, columns: 5 },
      seats: [
        { id: 'seat:left:0', x: 0, y: 0, kind: 'seat' },
        { id: 'seat:left:1', x: 1, y: 0, kind: 'seat' },
        { id: 'aisle:2:0', x: 2, y: 0, kind: 'aisle' },
        { id: 'aisle:2:1', x: 2, y: 1, kind: 'aisle' },
        { id: 'seat:right:0', x: 3, y: 0, kind: 'seat' },
        { id: 'seat:right:1', x: 4, y: 0, kind: 'seat' }
      ],
      assignments: [
        { seatId: 'seat:right:0', studentId: 'student:001' }
      ]
    }

    const { workspace: rawWorkspace, report } = buildWorkspaceFromSdes(document, {
      classIndex: 0,
      seatChartIndex: 0
    })
    const workspace = rawWorkspace as any

    expect(workspace.layout.config).toMatchObject({
      groupCount: 2,
      columnsPerGroup: 2,
      seatsPerColumn: 2,
      groups: [
        { columns: 2, rows: 2 },
        { columns: 2, rows: 2 }
      ]
    })
    expect(workspace.layout.seats).toContainEqual({
      id: 'seat-1-0-0',
      kind: 'regular',
      group: 1,
      col: 0,
      row: 0,
      studentId: 1,
      empty: false
    })
    expect(workspace.layout.seats.some((seat: any) => seat.id === 'seat-0-2-0')).toBe(false)
    expect(report.gridCollapsedColumns).toBe(1)
    expect(report.gridInferredGroups).toBe(2)
  })

  it('uses explicit grid group metadata when it maps to column bands', () => {
    const document = createOfficialLikeSdes()
    document.classes[0].seatCharts![0] = {
      id: 'chart:grid-explicit-groups',
      name: '显式分组网格',
      layoutModel: 'grid',
      platformPosition: 'top',
      coordinateSystem: {
        origin: 'front-left',
        xDirection: 'left-to-right',
        yDirection: 'front-to-back'
      },
      grid: { rows: 1, columns: 5 },
      seats: [
        { id: 'seat:left:0', x: 0, y: 0, kind: 'seat', group: 'left' },
        { id: 'seat:left:1', x: 1, y: 0, kind: 'seat', group: 'left' },
        { id: 'empty:middle', x: 2, y: 0, kind: 'empty' },
        { id: 'seat:right:0', x: 3, y: 0, kind: 'seat', group: 'right' },
        { id: 'seat:right:1', x: 4, y: 0, kind: 'seat', group: 'right' }
      ],
      assignments: [
        { seatId: 'seat:right:1', studentId: 'student:002' }
      ]
    }

    const { workspace: rawWorkspace, report } = buildWorkspaceFromSdes(document, {
      classIndex: 0,
      seatChartIndex: 0
    })
    const workspace = rawWorkspace as any

    expect(workspace.layout.config).toMatchObject({
      groupCount: 2,
      groups: [
        { columns: 2, rows: 1 },
        { columns: 2, rows: 1 }
      ]
    })
    expect(workspace.layout.seats).toContainEqual({
      id: 'seat-1-1-0',
      kind: 'regular',
      group: 1,
      col: 1,
      row: 0,
      studentId: 2,
      empty: false
    })
    expect(report.gridExplicitGroups).toBe(2)
    expect(report.gridCollapsedColumns).toBe(1)
  })

  it('reports unresolved SDES assignments instead of guessing mappings', () => {
    const document = createOfficialLikeSdes()
    document.classes[0].seatCharts![1].assignments = [
      { seatId: 'seat:missing', studentId: 'student:001' },
      { seatId: 'seat:grouped:0:0:0', studentId: 'student:missing' }
    ]

    const { report, workspace: rawWorkspace } = buildWorkspaceFromSdes(document, {
      classIndex: 0,
      seatChartIndex: 1
    })
    const workspace = rawWorkspace as any

    expect(report.skippedAssignments).toBe(2)
    expect(workspace.layout.seats.find((seat: any) => seat.id === 'seat-0-0-0').studentId).toBeNull()
  })

  it.each([
    { seatChartIndex: 0, label: 'grid' },
    { seatChartIndex: 1, label: 'groupedColumns' }
  ])('rejects $label charts with duplicate seat IDs before resolving assignments', ({ seatChartIndex }) => {
    const document = createOfficialLikeSdes()
    const chart = document.classes[0].seatCharts![seatChartIndex]
    const firstSeat = chart.seats![0]
    chart.seats!.push({
      ...firstSeat,
      x: firstSeat.x === undefined ? undefined : firstSeat.x + 1,
      row: firstSeat.row === undefined ? undefined : firstSeat.row + 1
    })

    const targets = getSdesImportTargets(document)
    expect(targets[seatChartIndex].warnings).toContain('1 个 seat.id 重复，当前座位表无法导入')
    expect(() => buildWorkspaceFromSdes(document, { classIndex: 0, seatChartIndex }))
      .toThrow(/包含重复 seat\.id.*无法安全解析座位分配/)
  })

  it('exports the current workspace shape with resolvable seat and student references', () => {
    const document = buildSdesDocumentFromState({
      students: [
        {
          id: 7,
          name: '张三',
          studentNumber: 1,
          tags: [3],
          numericAttributes: { score: 95 }
        }
      ],
      tags: [
        { id: 3, name: '近视', color: '#336699', showInSeatChart: true }
      ],
      attributeDefinitions: [
        {
          id: 'score',
          name: '成绩',
          unit: '分',
          min: 0,
          max: 150,
          precision: 1,
          enabled: true,
          showInEditor: true
        }
      ],
      seatConfig: {
        groupCount: 1,
        columnsPerGroup: 2,
        seatsPerColumn: 1,
        groups: [{ columns: 2, rows: 1 }],
        shiftDistance: 4,
        podiumPosition: 'bottom',
        guardSeats: {
          enabled: true,
          leftEnabled: true,
          rightEnabled: true,
          includeInAutoAssignment: false,
          hideEmptyOnExport: true
        }
      },
      seats: [
        {
          id: 'seat-0-0-0',
          groupIndex: 0,
          columnIndex: 0,
          rowIndex: 0,
          studentId: 7,
          isEmpty: false,
          kind: 'regular'
        },
        {
          id: 'guard-left',
          groupIndex: -1,
          columnIndex: -1,
          rowIndex: -1,
          studentId: null,
          isEmpty: false,
          kind: 'guard',
          guardSide: 'left'
        }
      ],
      zones: [],
      rules: [],
      exportSettings: {},
      tagSettings: {
        showTagsInSeatChart: true,
        tagDisplayMode: 'dot'
      },
      studentAttributeSettings: {
        showNumericAttributesInEditor: true
      }
    })

    const chart = document.classes[0].seatCharts![0]
    const seatIds = new Set(chart.seats!.map(seat => seat.id))
    const studentIds = new Set(document.classes[0].students!.map(student => student.id))

    expect(document.format).toBe(SDES_FORMAT)
    expect(chart.layoutModel).toBe('groupedColumns')
    expect(chart.coordinateSystem).toMatchObject({
      origin: 'back-left',
      yDirection: 'back-to-front'
    })
    expect(chart.assignments).toEqual([
      { seatId: 'seat:grouped:0:0:0', studentId: 'student:7' }
    ])
    expect(chart.assignments!.every(assignment => seatIds.has(assignment.seatId))).toBe(true)
    expect(chart.assignments!.every(assignment => studentIds.has(assignment.studentId))).toBe(true)
    expect(document.extensions?.['app.bsce']).toBeTruthy()
    expect((document.extensions?.[BSCE_EXTENSION_KEY] as { workspaceVersion?: string }).workspaceVersion)
      .toBe(WORKSPACE_SCHEMA_VERSION)
  })
})
