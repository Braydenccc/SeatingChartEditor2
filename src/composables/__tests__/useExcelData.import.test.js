import { beforeEach, describe, expect, it } from 'vitest'
import { loadXlsx, useExcelData } from '../useExcelData'
import { useStudentAttributes } from '../useStudentAttributes'
import { useStudentData } from '../useStudentData'

const createWorkbookFile = async (rows) => {
  const XLSX = await loadXlsx()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '学生名单')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new File([buffer], '学生名单.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
}

describe('useExcelData import', () => {
  let attributes
  let studentData

  beforeEach(() => {
    attributes = useStudentAttributes()
    studentData = useStudentData()
    studentData.clearAllStudents()
    attributes.replaceAttributeDefinitions()
  })

  it('imports numeric tag values while keeping flag and category columns as tags', async () => {
    const { importFromExcel } = useExcelData()
    const file = await createWorkbookFile([
      ['学号', '姓名', '纪律分', '标签数值:专注度(分)', '身高/cm', '住宿生', '性别'],
      ['1', '张三', '8', '4.5', '150 cm', '是', '男'],
      ['2', '李四', '10', '3,5', '１５２cm', '否', '女']
    ])

    const result = await importFromExcel(file)
    const discipline = attributes.attributeDefinitions.value.find(def => def.name === '纪律分')
    const focus = attributes.attributeDefinitions.value.find(def => def.name === '专注度')

    expect(result.tagNames).toEqual(expect.arrayContaining(['住宿生', '男', '女']))
    expect(result.tagNames).not.toEqual(expect.arrayContaining(['8', '10', '是', '否']))
    expect(discipline).toBeDefined()
    expect(focus).toBeDefined()
    expect(attributes.findAttributeByHeader('身高/cm')?.id).toBe('height')
    expect(result.students[0].numericAttributes[discipline.id]).toBe(8)
    expect(result.students[0].numericAttributes[focus.id]).toBe(4.5)
    expect(result.students[0].numericAttributes.height).toBe(150)
    expect(result.students[0].tagNames).toEqual(expect.arrayContaining(['住宿生', '男']))
    expect(result.students[1].tagNames).toEqual(['女'])
  })
})
