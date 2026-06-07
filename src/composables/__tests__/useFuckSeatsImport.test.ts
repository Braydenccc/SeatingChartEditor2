import { describe, expect, it } from 'vitest'
import {
  buildWorkspaceFromFuckSeatsState,
  parseClassroomsFromIndexHtml,
  type FuckSeatsClassroomSummary
} from '../useFuckSeatsImport'

describe('useFuckSeatsImport', () => {
  it('parses classroom summaries from fuckseats index html', () => {
    const html = `
      <section class="classrooms-grid">
        <a href="/classroom/7/" class="classroom-card-link">
          <article class="card classroom-card">
            <header class="classroom-card-header">
              <h3>三年级一班</h3>
            </header>
            <div class="classroom-metrics">
              <div><strong>6 × 8</strong><span>座位网格</span></div>
              <div><strong>42</strong><span>学生人数</span></div>
              <div><strong>48</strong><span>总座位</span></div>
            </div>
          </article>
        </a>
      </section>
    `

    const classrooms = parseClassroomsFromIndexHtml(html, 'http://127.0.0.1:23948')

    expect(classrooms).toEqual([
      {
        id: 7,
        name: '三年级一班',
        baseUrl: 'http://127.0.0.1:23948',
        href: '/classroom/7/',
        gridLabel: '6 × 8',
        studentCount: 42,
        seatCount: 48
      }
    ])
  })

  it('builds a workspace payload from fuckseats classroom state', () => {
    const classroom: FuckSeatsClassroomSummary = {
      id: 7,
      name: '三年级一班',
      baseUrl: 'http://127.0.0.1:23948',
      href: '/classroom/7/',
      gridLabel: '2 × 2',
      studentCount: 2,
      seatCount: 4
    }
    const workspace = buildWorkspaceFromFuckSeatsState(classroom, {
      tags: [{ id: 3, name: '近视', color: '#0a59f7' }],
      seats: [
        {
          row: 1,
          col: 1,
          cell_type: 'seat',
          student: {
            id: 11,
            name: '张三',
            student_id: '1',
            score_display: 96,
            tags: [{ id: 3, name: '近视', color: '#0a59f7' }]
          }
        },
        { row: 1, col: 2, cell_type: 'aisle', student: null },
        { row: 2, col: 1, cell_type: 'seat', student: null },
        { row: 2, col: 2, cell_type: 'seat', student: null }
      ],
      unseated: [
        {
          id: 12,
          name: '李四',
          student_id: '2',
          score: 88,
          tags: []
        }
      ],
      podium_guards: {
        left: null,
        right: null
      }
    })

    expect(workspace.layout.config).toMatchObject({
      groupCount: 1,
      columnsPerGroup: 2,
      seatsPerColumn: 2,
      groups: [{ columns: 2, rows: 2 }]
    })
    expect(workspace.tags).toEqual([
      { id: 3, name: '近视', color: '#0a59f7', showInSeatChart: true }
    ])
    expect(workspace.students).toEqual([
      {
        id: 11,
        name: '张三',
        studentNumber: 1,
        tags: [3],
        numericAttributes: { score: 96 }
      },
      {
        id: 12,
        name: '李四',
        studentNumber: 2,
        tags: [],
        numericAttributes: { score: 88 }
      }
    ])
    expect(workspace.layout.seats).toEqual([
      {
        id: 'seat-0-0-0',
        kind: 'regular',
        group: 0,
        col: 0,
        row: 0,
        studentId: 11,
        empty: false
      },
      {
        id: 'seat-0-1-0',
        kind: 'regular',
        group: 0,
        col: 1,
        row: 0,
        studentId: null,
        empty: true
      },
      {
        id: 'seat-0-0-1',
        kind: 'regular',
        group: 0,
        col: 0,
        row: 1,
        studentId: null,
        empty: false
      },
      {
        id: 'seat-0-1-1',
        kind: 'regular',
        group: 0,
        col: 1,
        row: 1,
        studentId: null,
        empty: false
      }
    ])
  })
})
