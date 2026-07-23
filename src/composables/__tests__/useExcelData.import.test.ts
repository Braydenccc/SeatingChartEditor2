import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadXlsx, useExcelData } from '../useExcelData'
import { useStudentAttributes } from '../useStudentAttributes'
import { useStudentData } from '../useStudentData'
import { requireDefined } from '@/test-utils/testHelpers'

const normalRosterFixtureUrl = new URL(
  '../../../test-scr/excel-fixtures/学生名单-测试样例-正常导入.xlsx',
  import.meta.url
)
const duplicateNumberFixtureUrl = new URL(
  '../../../test-scr/excel-fixtures/学生名单-测试样例-重复学号.xlsx',
  import.meta.url
)
const roster101FixtureUrl = new URL(
  '../../../test-scr/excel-fixtures/学生名单-测试样例-101人超限.xlsx',
  import.meta.url
)

const readFixtureBytes = async (url: URL) => {
  const fileUrl = url.protocol === 'file:'
    ? url
    : new URL(url.pathname.replace(/^\/+/, ''), pathToFileURL(`${process.cwd()}/`))
  return Uint8Array.from(await readFile(fileUrl))
}

const createWorkbookFile = async (rows: Array<Array<string | number | null | undefined>>) => {
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
  let attributes: ReturnType<typeof useStudentAttributes>
  let studentData: ReturnType<typeof useStudentData>

  beforeEach(() => {
    attributes = useStudentAttributes()
    studentData = useStudentData()
    studentData.clearAllStudents()
    attributes.replaceAttributeDefinitions()
  })

  it('imports the real normal roster fixture', async () => {
    const { importFromExcel } = useExcelData()
    const result = await importFromExcel(await readFixtureBytes(normalRosterFixtureUrl))

    expect(result.students).toHaveLength(10)
    expect(result.students[0]).toMatchObject({ studentNumber: 1, name: '张晓雨' })
    expect(result.students[9]).toMatchObject({ studentNumber: 10 })
  })

  it('rejects duplicate student numbers in the real conflict fixture', async () => {
    const { importFromExcel } = useExcelData()
    const fixture = await readFixtureBytes(duplicateNumberFixtureUrl)

    await expect(importFromExcel(fixture)).rejects.toThrow('重复学号')
  })

  it('imports the real 101-student fixture under the current 150-student limit', async () => {
    const { importFromExcel } = useExcelData()
    const result = await importFromExcel(await readFixtureBytes(roster101FixtureUrl))

    expect(result.students).toHaveLength(101)
    expect(result.students[0]).toMatchObject({ studentNumber: 1, name: '学生1' })
    expect(result.students[100]).toMatchObject({ studentNumber: 101, name: '学生101' })
    expect(result.warning).toBeUndefined()
  })

  it('imports numeric tag values while keeping flag and category columns as tags', async () => {
    const { importFromExcel } = useExcelData()
    const file = await createWorkbookFile([
      ['学号', '姓名', '纪律分', '标签数值:专注度(分)', '身高/cm', '住宿生', '性别'],
      ['1', '张三', '8', '4.5', '150 cm', '是', '男'],
      ['2', '李四', '10', '3,5', '１５２cm', '否', '女']
    ])

    const result = await importFromExcel(file)
    const discipline = requireDefined(attributes.attributeDefinitions.value.find(def => def.name === '纪律分'))
    const focus = requireDefined(attributes.attributeDefinitions.value.find(def => def.name === '专注度'))
    const firstStudent = requireDefined(result.students[0])
    const secondStudent = requireDefined(result.students[1])

    expect(result.tagNames).toEqual(expect.arrayContaining(['住宿生', '男', '女']))
    expect(result.tagNames).not.toEqual(expect.arrayContaining(['8', '10', '是', '否']))
    expect(discipline).toBeDefined()
    expect(focus).toBeDefined()
    expect(attributes.findAttributeByHeader('身高/cm')?.id).toBe('height')
    expect(firstStudent.numericAttributes[discipline.id]).toBe(8)
    expect(firstStudent.numericAttributes[focus.id]).toBe(4.5)
    expect(firstStudent.numericAttributes.height).toBe(150)
    expect(firstStudent.tagNames).toEqual(expect.arrayContaining(['住宿生', '男']))
    expect(secondStudent.tagNames).toEqual(['女'])
  })

  it('uses header positions instead of fixed first two columns', async () => {
    const { importFromExcel } = useExcelData()
    const file = await createWorkbookFile([
      ['姓名', '学号', '住宿生'],
      ['张三', '1', '是'],
      ['李四', '2', '']
    ])

    const result = await importFromExcel(file)

    expect(result.students).toMatchObject([
      { name: '张三', studentNumber: 1, tagNames: ['住宿生'] },
      { name: '李四', studentNumber: 2, tagNames: [] }
    ])
  })

  it('rejects duplicate student numbers instead of silently clearing earlier numbers', async () => {
    const { importFromExcel } = useExcelData()
    const file = await createWorkbookFile([
      ['学号', '姓名'],
      ['1', '张三'],
      ['1', '李四']
    ])

    await expect(importFromExcel(file)).rejects.toThrow('重复学号')
  })

  it('does not create attribute definitions when import is blocked by size limits', async () => {
    const { importFromExcel } = useExcelData()
    const rows = [
      ['学号', '姓名', '标签数值:专注度(分)'],
      ...Array.from({ length: 151 }, (_, index) => [index + 1, `学生${index + 1}`, index])
    ]
    const file = await createWorkbookFile(rows)

    const result = await importFromExcel(file)

    expect(result.warning).toContain('151 个学生')
    expect(attributes.attributeDefinitions.value.some(def => def.name === '专注度')).toBe(false)
  })
})
