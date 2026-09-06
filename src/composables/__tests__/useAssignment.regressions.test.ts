import { beforeEach, describe, expect, it } from 'vitest'
import { useAssignment } from '../useAssignment'
import { useSeatChart } from '../useSeatChart'
import { useSeatRules } from '../useSeatRules'
import { useStudentData } from '../useStudentData'
import { useZoneData } from '../useZoneData'

describe('useAssignment regressions', () => {
  const studentData = useStudentData()
  const seatChart = useSeatChart()
  const seatRules = useSeatRules()
  const zoneData = useZoneData()

  beforeEach(() => {
    useAssignment().cancelSmartAssignment()
    studentData.clearAllStudents()
    seatRules.clearAllRules()
    zoneData.clearAllZones()
    seatChart.updateConfig({
      groupCount: 2,
      columnsPerGroup: 1,
      seatsPerColumn: 1,
      groups: [{ columns: 1, rows: 1 }, { columns: 1, rows: 1 }],
      podiumPosition: 'bottom'
    })
    seatChart.clearAllSeats()
  })

  const addStudentWithScore = (score: number) => {
    const studentId = studentData.addStudent()
    const student = studentData.students.value.find(item => item.id === studentId)
    if (!student) throw new Error('student setup failed')
    student.numericAttributes = { score }
    return studentId
  }

  const prepareLongRunningAssignment = () => {
    seatChart.updateConfig({
      groupCount: 1,
      columnsPerGroup: 4,
      seatsPerColumn: 1,
      groups: [{ columns: 4, rows: 1 }]
    })
    const studentIds = Array.from({ length: 4 }, () => studentData.addStudent())
    seatRules.addRule({
      predicate: 'CLUSTER_TOGETHER',
      priority: 'prefer',
      enabled: true,
      subjects: studentIds.map(id => ({ type: 'person' as const, id })),
      params: { scope: 'zone' } as any
    })
    return studentIds
  }

  it.each(['sum', 'average'] as const)(
    'does not ignore a participating group with zero numeric-rule targets in %s mode',
    async aggregate => {
      const studentId = addStudentWithScore(10)
      seatRules.addRule({
        predicate: 'ATTRIBUTE_GROUP_BALANCE',
        priority: 'required',
        enabled: true,
        subjects: [{ type: 'person', id: studentId }],
        params: { attributeId: 'score', aggregate }
      })

      const result = await useAssignment().runSmartAssignment({ useRules: true, iterations: 10 })

      expect(result.success).toBe(false)
      expect(result.report?.violated.some(item => item.rule.predicate === 'ATTRIBUTE_GROUP_BALANCE')).toBe(true)
    }
  )

  it('rejects an empty balance group even when a zero-valued sum has no raw penalty', async () => {
    const studentId = addStudentWithScore(0)
    seatRules.addRule({
      predicate: 'ATTRIBUTE_GROUP_BALANCE',
      priority: 'required',
      enabled: true,
      subjects: [{ type: 'person', id: studentId }],
      params: { attributeId: 'score', aggregate: 'sum' }
    })

    const result = await useAssignment().runSmartAssignment({ useRules: true, iterations: 10 })

    expect(result.success).toBe(false)
    expect(result.report?.violated.some(item => item.rule.predicate === 'ATTRIBUTE_GROUP_BALANCE')).toBe(true)
  })

  it('rejects an empty balance group when positive and negative sums cancel in one group', async () => {
    seatChart.updateConfig({
      groupCount: 2,
      columnsPerGroup: 2,
      seatsPerColumn: 1,
      groups: [{ columns: 2, rows: 1 }, { columns: 2, rows: 1 }]
    })
    const positiveId = addStudentWithScore(10)
    const negativeId = addStudentWithScore(-10)
    for (const studentId of [positiveId, negativeId]) {
      seatRules.addRule({
        predicate: 'IN_GROUP_RANGE',
        priority: 'required',
        enabled: true,
        subjects: [{ type: 'person', id: studentId }],
        params: { minGroup: 1, maxGroup: 1 }
      })
    }
    seatRules.addRule({
      predicate: 'ATTRIBUTE_GROUP_BALANCE',
      priority: 'required',
      enabled: true,
      subjects: [
        { type: 'person', id: positiveId },
        { type: 'person', id: negativeId }
      ],
      params: { attributeId: 'score', aggregate: 'sum' }
    })

    const result = await useAssignment().runSmartAssignment({ useRules: true, iterations: 10 })

    expect(result.success).toBe(false)
    expect(result.report?.violated.some(item => item.rule.predicate === 'ATTRIBUTE_GROUP_BALANCE')).toBe(true)
  })

  it('keeps a balance rule non-blocking when a targeted group only has missing numeric values', async () => {
    const valuedId = addStudentWithScore(10)
    const missingId = studentData.addStudent()
    seatRules.addRule({
      predicate: 'ATTRIBUTE_GROUP_BALANCE',
      priority: 'required',
      enabled: true,
      subjects: [
        { type: 'person', id: valuedId },
        { type: 'person', id: missingId }
      ],
      params: { attributeId: 'score', aggregate: 'average' }
    })

    const result = await useAssignment().runSmartAssignment({ useRules: true, iterations: 10 })

    expect(result.success).toBe(true)
    expect(result.report?.violated).toEqual([])
  })

  it('treats a zero-range row gradient as unevaluable instead of forcing every student to one edge', async () => {
    seatChart.updateConfig({
      groupCount: 1,
      columnsPerGroup: 1,
      seatsPerColumn: 2,
      groups: [{ columns: 1, rows: 2 }],
      podiumPosition: 'top'
    })
    const firstId = addStudentWithScore(10)
    const secondId = addStudentWithScore(10)
    seatRules.addRule({
      predicate: 'ATTRIBUTE_ROW_GRADIENT',
      priority: 'required',
      enabled: true,
      subjects: [
        { type: 'person', id: firstId },
        { type: 'person', id: secondId }
      ],
      params: { attributeId: 'score', direction: 'lowFront' }
    })

    const result = await useAssignment().runSmartAssignment({ useRules: true, iterations: 10 })

    expect(result.success).toBe(true)
    expect(result.report?.violated).toEqual([])
  })

  it('normalizes group-balance acceptance by the actual sub-unit attribute range', async () => {
    seatChart.updateConfig({
      groupCount: 2,
      columnsPerGroup: 2,
      seatsPerColumn: 1,
      groups: [{ columns: 2, rows: 1 }, { columns: 2, rows: 1 }]
    })
    const studentIds = [0, 0.06, 0.04, 0.1].map(addStudentWithScore)
    for (let index = 0; index < studentIds.length; index++) {
      seatRules.addRule({
        predicate: 'IN_GROUP_RANGE',
        priority: 'required',
        enabled: true,
        subjects: [{ type: 'person', id: studentIds[index] }],
        params: {
          minGroup: index < 2 ? 1 : 2,
          maxGroup: index < 2 ? 1 : 2
        }
      })
    }
    seatRules.addRule({
      predicate: 'ATTRIBUTE_GROUP_BALANCE',
      priority: 'required',
      enabled: true,
      subjects: studentIds.map(id => ({ type: 'person' as const, id })),
      params: { attributeId: 'score', aggregate: 'average' }
    })

    const result = await useAssignment().runSmartAssignment({ useRules: true, iterations: 10 })

    expect(result.success).toBe(false)
    expect(result.report?.violated.some(item => item.rule.predicate === 'ATTRIBUTE_GROUP_BALANCE')).toBe(true)
  })

  it('does not collapse separate unassigned seats into one implicit zone', async () => {
    const firstId = studentData.addStudent()
    const secondId = studentData.addStudent()
    seatRules.addRule({
      predicate: 'CLUSTER_TOGETHER',
      priority: 'required',
      enabled: true,
      subjects: [
        { type: 'person', id: firstId },
        { type: 'person', id: secondId }
      ],
      params: { scope: 'zone' } as any
    })

    const result = await useAssignment().runSmartAssignment({ useRules: true, iterations: 10 })

    expect(result.success).toBe(false)
    expect(result.report?.violated.some(item => item.rule.predicate === 'CLUSTER_TOGETHER')).toBe(true)
  })

  it('treats seats in the same explicit zone as one cluster bucket', async () => {
    const firstId = studentData.addStudent()
    const secondId = studentData.addStudent()
    const zoneId = zoneData.addZone()
    zoneData.updateZone(zoneId, {
      name: '集中区',
      seatIds: seatChart.seats.value.map(seat => seat.id)
    })
    seatRules.addRule({
      predicate: 'CLUSTER_TOGETHER',
      priority: 'required',
      enabled: true,
      subjects: [
        { type: 'person', id: firstId },
        { type: 'person', id: secondId }
      ],
      params: { scope: 'zone' } as any
    })

    const result = await useAssignment().runSmartAssignment({ useRules: true, iterations: 10 })

    expect(result.success).toBe(true)
    expect(result.report?.violated).toEqual([])
  })

  it('does not commit a result after assignment inputs change', async () => {
    const studentIds = prepareLongRunningAssignment()
    const seatStateBefore = seatChart.seats.value.map(seat => ({
      id: seat.id,
      studentId: seat.studentId
    }))
    let notifyProgress!: () => void
    const progressReached = new Promise<void>(resolve => {
      notifyProgress = resolve
    })
    let notified = false

    const running = useAssignment().runSmartAssignment({
      useRules: true,
      iterations: 1001,
      onProgress: () => {
        if (notified) return
        notified = true
        notifyProgress()
      }
    })
    await progressReached
    studentData.updateStudent(studentIds[0], { name: '运行中变更' })

    const result = await running

    expect(result.success).toBe(false)
    expect(result.canceled).toBe(true)
    expect(result.message).toContain('输入已变化')
    expect(seatChart.seats.value.map(seat => ({ id: seat.id, studentId: seat.studentId }))).toEqual(seatStateBefore)
  })

  it('serializes callers so a canceled older run cannot overwrite the next run', async () => {
    prepareLongRunningAssignment()
    const firstAssignment = useAssignment()
    const secondAssignment = useAssignment()
    expect(secondAssignment.isAssigning).toBe(firstAssignment.isAssigning)

    let notifyProgress!: () => void
    const progressReached = new Promise<void>(resolve => {
      notifyProgress = resolve
    })
    let notified = false
    const olderRun = firstAssignment.runSmartAssignment({
      useRules: true,
      iterations: 5000,
      onProgress: () => {
        if (notified) return
        notified = true
        notifyProgress()
      }
    })
    await progressReached

    const interruptResult = await secondAssignment.runSmartAssignment({ useRules: true, iterations: 2 })
    const olderResult = await olderRun
    const newerResult = await secondAssignment.runSmartAssignment({ useRules: true, iterations: 2 })

    expect(interruptResult.success).toBe(false)
    expect(interruptResult.canceled).toBe(true)
    expect(olderResult.success).toBe(false)
    expect(olderResult.canceled).toBe(true)
    expect(newerResult.success).toBe(true)
    expect(newerResult.solution).toBeInstanceOf(Map)
    for (const [studentId, seatId] of newerResult.solution || []) {
      expect(seatChart.seats.value.find(seat => seat.id === seatId)?.studentId).toBe(studentId)
    }
  })
})
