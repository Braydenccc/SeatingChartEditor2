import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { useDragPreview } from '../useDragPreview'
import { useSeatChart } from '../useSeatChart'
import { useStudentData } from '../useStudentData'

describe('useDragPreview', () => {
  beforeEach(() => {
    const seatChart = useSeatChart()
    seatChart.updateConfig({
      groupCount: 1,
      columnsPerGroup: 1,
      seatsPerColumn: 1,
      groups: [{ columns: 1, rows: 1 }]
    })
    seatChart.seats.value.forEach(seat => {
      seat.studentId = null
      seat.isEmpty = false
    })
    useStudentData().clearAllStudents()
  })

  afterEach(() => {
    const { endDragPreview, registerChartElement, registerPreviewElement } = useDragPreview()
    endDragPreview()
    registerChartElement(null)
    registerPreviewElement(null)
    document.body.innerHTML = ''
  })

  it('positions preview element when it is registered after drag starts', () => {
    const { startDragPreview, registerPreviewElement } = useDragPreview()
    const previewEl = document.createElement('div')

    startDragPreview('seat-0-0-0', ['seat-0-0-0'], 120, 80)
    registerPreviewElement(previewEl)

    expect(previewEl.style.left).toBe('120px')
    expect(previewEl.style.top).toBe('80px')
    expect(previewEl.style.transform).toBe('translate(-50%, -50%)')
    expect(previewEl.style.transition).toBe('none')
  })

  it('returns structured student data for preview items', () => {
    const { assignStudent } = useSeatChart()
    const studentData = useStudentData()
    const { registerChartElement, startDragPreview, previewItems } = useDragPreview()
    const chartEl = document.createElement('div')
    const seatEl = document.createElement('div')
    const studentId = studentData.addStudent()

    studentData.updateStudent(studentId, { name: '张三', studentNumber: 7 })
    assignStudent('seat-0-0-0', studentId, false)

    seatEl.className = 'seat-item occupied'
    seatEl.dataset.seatId = 'seat-0-0-0'
    chartEl.appendChild(seatEl)
    registerChartElement(chartEl)

    startDragPreview('seat-0-0-0', ['seat-0-0-0'], 120, 80)

    expect(previewItems.value[0].student).toMatchObject({ name: '张三', studentNumber: 7 })
    expect(previewItems.value[0].studentId).toBe(studentId)
    expect(previewItems.value[0].isEmptySeat).toBe(false)
    expect(previewItems.value[0].contentHtml).toBeUndefined()
  })
})
