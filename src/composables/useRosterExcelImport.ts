import { computed, ref } from 'vue'
import { useEditMode } from '@/composables/useEditMode'
import { useExcelData } from '@/composables/useExcelData'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'
import { useSeatRules } from '@/composables/useSeatRules'
import { useSelection } from '@/composables/useSelection'
import { useStudentData } from '@/composables/useStudentData'
import { useStudentAttributes } from '@/composables/useStudentAttributes'
import { useTagData } from '@/composables/useTagData'
import { useUndo } from '@/composables/useUndo'
import { useZoneData } from '@/composables/useZoneData'
import { useZoneRotation } from '@/composables/useZoneRotation'

type ImportableExcelFile = File | {
  name?: string
  bytes?: Uint8Array
  arrayBuffer?: () => Promise<ArrayBuffer>
}

export type RosterImportMode = 'replace' | 'append'

type ImportIssue = {
  severity: 'error' | 'conflict' | 'warning'
  message: string
  rowNumber?: number
  field?: string
}

type RosterImportPreview = {
  students: any[]
  tagNames: string[]
  attributes: Array<{
    id: string
    key: string
    name: string
    unit: string
    header: string
    existing?: boolean
  }>
  issues: ImportIssue[]
  hasErrors: boolean
}

const rosterTagColors = [
  'var(--tag-color-1)',
  'var(--tag-color-2)',
  'var(--tag-color-3)',
  'var(--tag-color-4)',
  'var(--tag-color-5)',
  'var(--tag-color-6)',
  'var(--tag-color-7)',
  'var(--tag-color-8)',
  'var(--tag-color-9)',
  'var(--tag-color-10)'
]

export const isExcelRosterFile = (file?: { name?: string } | null): boolean => {
  const name = String(file?.name || '').toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.xls')
}

const previewDialogVisible = ref(false)
const importPreview = ref<RosterImportPreview | null>(null)
const importFileName = ref('')
const importMode = ref<RosterImportMode>('replace')
const isPreparingImport = ref(false)
const isCommittingImport = ref(false)

export function useRosterExcelImport() {
  const { previewImportFromExcel } = useExcelData()
  const { students, addStudent, updateStudent, clearAllStudents } = useStudentData()
  const { tags, addTag, clearAllTags } = useTagData()
  const { ensureAttributeForHeader } = useStudentAttributes()
  const { seats, clearAllSeats } = useSeatChart()
  const { rules, clearAllRules } = useSeatRules()
  const { zones, clearAllZones } = useZoneData()
  const { rotGroups, clearAllRotData } = useZoneRotation()
  const { clearHistory } = useUndo()
  const { clearSelection: clearSeatSelection } = useSelection()
  const { resetEditMode } = useEditMode()
  const { success, warning, error } = useLogger()

  const getExistingStudentNumberMap = () => {
    const map = new Map<number, string>()
    students.value.forEach(student => {
      if (student.studentNumber === null || student.studentNumber === undefined) return
      map.set(Number(student.studentNumber), student.name || `学生#${student.id}`)
    })
    return map
  }

  const getModeIssues = (mode: RosterImportMode = importMode.value): ImportIssue[] => {
    const preview = importPreview.value
    if (!preview) return []
    const issues = (preview.issues || []).filter(issue =>
      !issue.rowNumber ||
      (issue.field !== 'name' && issue.field !== 'studentNumber')
    )
    const importedNumberRows = new Map<number, number>()

    preview.students.forEach(student => {
      if (!String(student.name || '').trim()) {
        issues.push({
          severity: 'error',
          rowNumber: student.rowNumber,
          field: 'name',
          message: '姓名为空'
        })
      }

      const studentNumber = student.studentNumber
      if (studentNumber === null || studentNumber === undefined || studentNumber === '') return
      const numberValue = Number(studentNumber)
      if (!Number.isFinite(numberValue)) {
        issues.push({
          severity: 'error',
          rowNumber: student.rowNumber,
          field: 'studentNumber',
          message: '学号不是有效数字'
        })
        return
      }

      const existingRow = importedNumberRows.get(numberValue)
      if (existingRow) {
        issues.push({
          severity: 'conflict',
          rowNumber: existingRow,
          field: 'studentNumber',
          message: `学号 ${numberValue} 在导入文件内重复`
        })
        issues.push({
          severity: 'conflict',
          rowNumber: student.rowNumber,
          field: 'studentNumber',
          message: `学号 ${numberValue} 在导入文件内重复`
        })
      } else {
        importedNumberRows.set(numberValue, student.rowNumber)
      }
    })

    if (mode === 'append') {
      const existingNumbers = getExistingStudentNumberMap()
      preview.students.forEach(student => {
        if (student.studentNumber === null || student.studentNumber === undefined) return
        const existingName = existingNumbers.get(Number(student.studentNumber))
        if (!existingName) return
        issues.push({
          severity: 'conflict',
          rowNumber: student.rowNumber,
          field: 'studentNumber',
          message: `学号 ${student.studentNumber} 已被现有学生「${existingName}」使用`
        })
      })
    }
    return issues
  }

  const hasBlockingIssues = (issues: ImportIssue[]) =>
    issues.some(issue => issue.severity === 'error' || issue.severity === 'conflict')

  const currentModeIssues = computed(() => getModeIssues(importMode.value))
  const skippedRowNumbers = computed(() => {
    const rows = new Set<number>()
    currentModeIssues.value.forEach(issue => {
      if ((issue.severity === 'error' || issue.severity === 'conflict') && issue.rowNumber) {
        rows.add(issue.rowNumber)
      }
    })
    return rows
  })
  const importableStudents = computed(() =>
    (importPreview.value?.students || []).filter(student => !skippedRowNumbers.value.has(student.rowNumber))
  )
  const canCommitImport = computed(() => !!importPreview.value && importableStudents.value.length > 0)

  const getRowIssues = (rowNumber: number, mode: RosterImportMode = importMode.value) =>
    getModeIssues(mode).filter(issue => issue.rowNumber === rowNumber)

  const updatePreviewStudent = (rowNumber: number, updates: Record<string, any>) => {
    if (!importPreview.value) return
    importPreview.value.students = importPreview.value.students.map(student => {
      if (student.rowNumber !== rowNumber) return student
      return {
        ...student,
        ...updates
      }
    })
  }

  const updatePreviewNumericValue = (rowNumber: number, attributeId: string, value: number | null) => {
    if (!importPreview.value) return
    importPreview.value.issues = (importPreview.value.issues || []).filter(issue =>
      !(issue.rowNumber === rowNumber && issue.field === attributeId)
    )
    importPreview.value.students = importPreview.value.students.map(student => {
      if (student.rowNumber !== rowNumber) return student
      return {
        ...student,
        numericAttributes: {
          ...(student.numericAttributes || {}),
          [attributeId]: value
        }
      }
    })
  }

  const updatePreviewTagNames = (rowNumber: number, value: string[] | string) => {
    const tagNames = Array.isArray(value)
      ? value
      : String(value || '')
        .split(/[、,，;；\s]+/)
        .map(item => item.trim())
        .filter(Boolean)
    updatePreviewStudent(rowNumber, { tagNames: [...new Set(tagNames)] })
    if (!importPreview.value) return
    const allTagNames = new Set<string>()
    importPreview.value.students.forEach(student => {
      ;(student.tagNames || []).forEach((name: string) => allTagNames.add(name))
    })
    importPreview.value.tagNames = Array.from(allTagNames)
  }

  const hasExistingRosterImportState = () =>
    students.value.length > 0 ||
    tags.value.length > 0 ||
    seats.value.some(seat => seat.studentId != null) ||
    zones.value.length > 0 ||
    rules.value.length > 0 ||
    rotGroups.value.length > 0

  const clearRosterImportState = () => {
    clearHistory()
    clearSeatSelection()
    resetEditMode()
    clearAllSeats()
    clearAllZones()
    clearAllRules()
    clearAllRotData()
    clearAllStudents()
    clearAllTags()
  }

  const beginExcelRosterImport = async (file: ImportableExcelFile) => {
    if (!isExcelRosterFile(file)) {
      warning('请导入 .xlsx 或 .xls 格式的 Excel 名单文件')
      return false
    }

    isPreparingImport.value = true
    try {
      const preview = await previewImportFromExcel(file) as RosterImportPreview
      importPreview.value = preview
      importFileName.value = file.name || 'Excel 名单'
      importMode.value = hasExistingRosterImportState() ? 'replace' : 'append'
      previewDialogVisible.value = true
      return true
    } catch (err: any) {
      error(`导入失败: ${err.message || err}`)
      return false
    } finally {
      isPreparingImport.value = false
    }
  }

  const cancelExcelRosterImport = () => {
    if (isCommittingImport.value) return
    previewDialogVisible.value = false
    importPreview.value = null
    importFileName.value = ''
  }

  const commitExcelRosterImport = async () => {
    const preview = importPreview.value
    if (!preview || isCommittingImport.value) return false
    const issues = getModeIssues(importMode.value)
    const skippedRows = new Set<number>()
    issues.forEach(issue => {
      if ((issue.severity === 'error' || issue.severity === 'conflict') && issue.rowNumber) {
        skippedRows.add(issue.rowNumber)
      }
    })
    const validStudents = preview.students.filter(student => !skippedRows.has(student.rowNumber))
    if (validStudents.length === 0) {
      warning('没有可导入的有效学生，请检查冲突或错误项')
      return false
    }

    isCommittingImport.value = true
    try {
      if (importMode.value === 'replace') {
        clearRosterImportState()
      }

      const tagNameToId: Record<string, number> = {}
      tags.value.forEach(tag => {
        tagNameToId[tag.name] = tag.id
      })

      preview.tagNames.forEach((tagName: string, index: number) => {
        if (tagNameToId[tagName] != null) return
        tagNameToId[tagName] = addTag({
          name: tagName,
          color: rosterTagColors[(tags.value.length + index) % rosterTagColors.length]
        })
      })

      const attributeKeyToId: Record<string, string> = {}
      preview.attributes.forEach(attribute => {
        const definition = ensureAttributeForHeader(attribute.header, { allowImplicit: true })
        if (definition) {
          attributeKeyToId[attribute.id] = definition.id
        }
      })

      validStudents.forEach((studentData: any) => {
        const studentTags = studentData.tagNames
          .map((tagName: string) => tagNameToId[tagName])
          .filter((id: number | undefined) => id != null)
        const numericAttributes: Record<string, number | null> = {}
        Object.entries(studentData.numericAttributes || {}).forEach(([key, value]) => {
          const attributeId = attributeKeyToId[key]
          if (!attributeId) return
          numericAttributes[attributeId] = value as number | null
        })
        const newStudentId = addStudent()
        updateStudent(newStudentId, {
          name: studentData.name,
          studentNumber: studentData.studentNumber,
          tags: studentTags,
          numericAttributes
        })
      })

      const skippedText = skippedRows.size > 0 ? `，已跳过 ${skippedRows.size} 行问题数据` : ''
      success(`成功导入 ${validStudents.length} 个学生，${preview.tagNames.length} 个标签${skippedText}`)
      previewDialogVisible.value = false
      importPreview.value = null
      importFileName.value = ''
      return true
    } catch (err: any) {
      error(`导入失败: ${err.message || err}`)
      return false
    } finally {
      isCommittingImport.value = false
    }
  }

  return {
    previewDialogVisible,
    importPreview,
    importFileName,
    importMode,
    isPreparingImport,
    isCommittingImport,
    currentModeIssues,
    skippedRowNumbers,
    importableStudents,
    canCommitImport,
    hasExistingRosterImportState,
    getModeIssues,
    getRowIssues,
    updatePreviewStudent,
    updatePreviewNumericValue,
    updatePreviewTagNames,
    beginExcelRosterImport,
    cancelExcelRosterImport,
    commitExcelRosterImport
  }
}
