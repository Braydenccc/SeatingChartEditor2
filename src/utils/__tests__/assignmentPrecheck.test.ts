import { describe, expect, it } from 'vitest'
import { createAssignmentPrecheck } from '../assignmentPrecheck'

const seats = [
  { id: 'seat-0-0-0', groupIndex: 0, columnIndex: 0, rowIndex: 0 },
  { id: 'seat-0-1-0', groupIndex: 0, columnIndex: 1, rowIndex: 0 },
  { id: 'seat-0-0-1', groupIndex: 0, columnIndex: 0, rowIndex: 1 }
]

const baseInput = {
  seats,
  availableSeats: seats,
  seatConfig: {
    groupCount: 1,
    columnsPerGroup: 2,
    seatsPerColumn: 2,
    groups: [{ columns: 2, rows: 2 }]
  },
  zones: [],
  detectConflicts: () => [],
  renderRuleText: (rule: any) => rule.name || rule.predicate,
  isInRowRange: (seatId: string, minRow: number, maxRow: number) => {
    const seat = seats.find(item => item.id === seatId)
    const row = (seat?.rowIndex ?? 0) + 1
    return row >= minRow && row <= maxRow
  },
  isColumnType: () => false,
  maxIterations: 100000
}

describe('assignmentPrecheck', () => {
  it('expands tag subjects before checking zone capacity', () => {
    const result = createAssignmentPrecheck({
      ...baseInput,
      students: [
        { id: 's1', name: '甲', tags: ['care'] },
        { id: 's2', name: '乙', tags: ['care'] },
        { id: 's3', name: '丙', tags: ['care'] }
      ],
      zones: [
        { id: 'front', name: '前排', seatIds: ['seat-0-0-0', 'seat-0-1-0'] }
      ],
      activeRules: [
        {
          predicate: 'IN_ZONE',
          priority: 'required',
          subjects: [{ type: 'tag', id: 'care' }],
          params: { zoneId: 'front' },
          name: '照顾标签必须在前排'
        }
      ]
    })

    expect(result.pass).toBe(false)
    expect(result.blockingReasons.join('\n')).toContain('需要 3 个座位')
  })

  it('detects hidden required position conflicts with bipartite matching', () => {
    const result = createAssignmentPrecheck({
      ...baseInput,
      students: [
        { id: 's1', name: '甲' },
        { id: 's2', name: '乙' },
        { id: 's3', name: '丙' }
      ],
      zones: [
        { id: 'limited-a', name: '受限A', seatIds: ['seat-0-0-0', 'seat-0-1-0'] },
        { id: 'limited-b', name: '受限B', seatIds: ['seat-0-0-0', 'seat-0-1-0'] }
      ],
      activeRules: [
        {
          predicate: 'IN_ZONE',
          priority: 'required',
          subjects: [{ type: 'person', id: 's1' }, { type: 'person', id: 's2' }],
          params: { zoneId: 'limited-a' },
          name: '甲乙必须在受限A'
        },
        {
          predicate: 'IN_ZONE',
          priority: 'required',
          subjects: [{ type: 'person', id: 's2' }, { type: 'person', id: 's3' }],
          params: { zoneId: 'limited-b' },
          name: '乙丙必须在受限B'
        }
      ]
    })

    expect(result.pass).toBe(false)
    expect(result.blockingReasons.join('\n')).toContain('必须级位置规则整体不可行')
    expect(result.blockingReasons.join('\n')).toContain('最多只能匹配 2 个座位')
  })

  it('checks position constraints inside AND composite rules', () => {
    const result = createAssignmentPrecheck({
      ...baseInput,
      students: [
        { id: 's1', name: '甲', tags: ['care'] },
        { id: 's2', name: '乙', tags: ['care'] },
        { id: 's3', name: '丙', tags: ['care'] }
      ],
      zones: [
        { id: 'front', name: '前排', seatIds: ['seat-0-0-0', 'seat-0-1-0'] }
      ],
      activeRules: [
        {
          predicate: 'NOT_IN_COLUMN_TYPE',
          priority: 'required',
          subjects: [{ type: 'tag', id: 'care' }],
          params: { columnType: 'wall' },
          logicOperator: 'AND',
          subRules: [
            {
              predicate: 'NOT_IN_COLUMN_TYPE',
              subjects: [{ type: 'tag', id: 'care' }],
              params: { columnType: 'wall' }
            },
            {
              predicate: 'IN_ZONE',
              subjects: [{ type: 'tag', id: 'care' }],
              params: { zoneId: 'front' }
            }
          ],
          name: '照顾标签组合规则'
        }
      ]
    })

    expect(result.pass).toBe(false)
    expect(result.blockingReasons.join('\n')).toContain('选区容量不足')
    expect(result.blockingReasons.join('\n')).toContain('需要 3 个座位')
  })

  it('does not treat negated IN_ZONE as a positive zone capacity requirement', () => {
    const result = createAssignmentPrecheck({
      ...baseInput,
      students: [
        { id: 's1', name: '甲', tags: ['care'] },
        { id: 's2', name: '乙', tags: ['care'] }
      ],
      zones: [
        { id: 'avoid', name: '避开区', seatIds: ['seat-0-0-0'] }
      ],
      activeRules: [
        {
          predicate: 'IN_ZONE',
          priority: 'required',
          subjects: [{ type: 'tag', id: 'care' }],
          params: { zoneId: 'avoid' },
          not: true,
          name: '照顾标签不在避开区'
        }
      ]
    })

    expect(result.pass).toBe(true)
    expect(result.blockingReasons.join('\n')).not.toContain('选区容量不足')
  })
})
