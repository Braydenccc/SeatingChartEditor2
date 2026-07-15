import { describe, expect, it } from 'vitest'
import type { Workspace } from '@/types/models'
import { validateWorkspaceDocument } from '../workspaceValidation'

const createWorkspace = (): Workspace => ({
  meta: { version: '2.2', app: 'SeatingChartEditor', createdAt: '2026-07-15T00:00:00.000Z' },
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
})
