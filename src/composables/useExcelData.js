import { shallowRef } from 'vue'

// 移除了顶层 eager 导入：import * as XLSX from 'xlsx-js-style'
// 该重型组件通过 loadXlsx() 函数按需动态加载，显著减小初始包大小。

export const xlsxInstance = shallowRef(null)
export const loadXlsx = async () => {
    if (xlsxInstance.value) return xlsxInstance.value
    const mod = await import('xlsx-js-style')
    // 处理 CJS/ESM 混合情况下的 .default 导出
    xlsxInstance.value = mod.default || mod
    return xlsxInstance.value
}

const DIGITS_LOWER = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const DIGITS_UPPER = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
const SMALL_UNITS_LOWER = ['', '十', '百', '千']
const SMALL_UNITS_UPPER = ['', '拾', '佰', '仟']
const LARGE_UNITS = ['', '万', '亿']
const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳']

const toAlpha = (num) => {
  let n = Math.max(1, Math.floor(num))
  let result = ''
  while (n > 0) {
    n -= 1
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26)
  }
  return result
}

const toRoman = (num) => {
  const n = Math.max(1, Math.floor(num))
  const map = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ]
  let rest = n
  let out = ''
  for (const [value, symbol] of map) {
    while (rest >= value) {
      out += symbol
      rest -= value
    }
  }
  return out
}

const toChineseNumber = (num, digits, smallUnits) => {
  const n = Math.max(0, Math.floor(num))
  if (n === 0) return digits[0]
  const groups = []
  let rest = n
  while (rest > 0) {
    groups.push(rest % 10000)
    rest = Math.floor(rest / 10000)
  }

  const convertGroup = (group) => {
    if (group === 0) return ''
    let text = ''
    let zeroPending = false
    for (let i = 3; i >= 0; i--) {
      const divisor = 10 ** i
      const digit = Math.floor(group / divisor) % 10
      if (digit === 0) {
        if (text) zeroPending = true
        continue
      }
      if (zeroPending) {
        text += digits[0]
        zeroPending = false
      }
      text += digits[digit] + smallUnits[i]
    }
    return text
  }

  let output = ''
  let needZeroBetween = false
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]
    if (group === 0) {
      needZeroBetween = output.length > 0
      continue
    }
    if (needZeroBetween || (output && group < 1000)) output += digits[0]
    output += convertGroup(group) + LARGE_UNITS[i]
    needZeroBetween = false
  }

  if (digits === DIGITS_LOWER && output.startsWith('一十')) {
    output = output.slice(1)
  }
  return output
}

const formatIndex = (num, scheme = 'arabic') => {
  const n = Math.max(1, Math.floor(num))
  switch (scheme) {
    case 'alpha':
      return toAlpha(n)
    case 'roman':
      return toRoman(n)
    case 'circled':
      return CIRCLED_NUMBERS[n - 1] || String(n)
    case 'chineseLower':
      return toChineseNumber(n, DIGITS_LOWER, SMALL_UNITS_LOWER)
    case 'chineseUpper':
      return toChineseNumber(n, DIGITS_UPPER, SMALL_UNITS_UPPER)
    case 'arabic':
    default:
      return String(n)
  }
}

const normalizeHexColor = (color, fallback = '000000') => {
  const raw = String(color || '').trim().replace('#', '')
  if (/^[\da-fA-F]{6}$/.test(raw)) return raw.toUpperCase()
  if (/^[\da-fA-F]{3}$/.test(raw)) {
    return raw.split('').map((c) => c + c).join('').toUpperCase()
  }
  return fallback
}

const formatCellContent = (template, context) => {
  const source = String(template || '')
  const tokenMap = {
    n: context.name,
    i: context.studentId,
    r: context.rowLabel,
    g: context.groupLabel,
    s: context.serialLabel,
    j: context.serialLabel
  }
  const replaced = source.replace(/%([%nirgsj])/g, (m, token) => {
    if (token === '%') return '%'
    return tokenMap[token] ?? ''
  })
  return replaced
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, arr) => line !== '' || (index > 0 && index < arr.length - 1))
    .join('\n')
    .trim()
}

export function useExcelData() {
  // 下载空白模板
  const downloadTemplate = async () => {
    const XLSX = await loadXlsx()
    // 创建示例数据
    const templateData = [
      ['学号', '姓名', '性别', '不修', '830', '住宿生', '午休', '周五走'],
      ['1', '示例学生1', '男', '1', '', '', '1', ''],
      ['2', '示例学生2', '女', '', '1', '1', '', ''],
      ['3', '示例学生3', '男', '', '1', '', '1', '']
    ]

    const ws = XLSX.utils.aoa_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '学生名单')

    XLSX.writeFile(wb, '学生名单模板.xlsx')
  }

  // 从Excel导入 - 返回原始数据供调用者处理
  const importFromExcel = async (file) => {
    const XLSX = await loadXlsx()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

          if (!jsonData || jsonData.length < 2) {
            reject(new Error('Excel文件格式不正确，至少需要标题行和一行数据'))
            return
          }

          // 解析标题行
          const headers = jsonData[0]
          if (!headers || headers.length < 2) {
            reject(new Error('Excel文件格式不正确，至少需要学号和姓名列'))
            return
          }

          // 从第三列开始是标签列
          const tagHeaders = headers.slice(2).filter(h => {
            if (h == null) return false
            // 转换为字符串并去除空白
            const str = String(h).trim()
            return str.length > 0
          }).map(h => String(h).trim())

          // 检查学生数量
          const studentCount = jsonData.length - 1
          if (studentCount > 100) {
            // 返回警告信息，由调用者处理
            resolve({
              students: [],
              tagNames: [],
              warning: `检测到 ${studentCount} 个学生，数量较多可能影响性能`
            })
            return
          }

          // 分析哪些标签列包含有效数据
          const validTagIndices = []
          const tagMap = {}

          tagHeaders.forEach((tagName, index) => {
            const colIndex = index + 2
            let hasValidData = false

            for (let i = 1; i < jsonData.length; i++) {
              const cellValue = jsonData[i][colIndex]
              if (cellValue === 1 || cellValue === '1') {
                hasValidData = true
                break
              } else if (cellValue != null && cellValue !== '' && cellValue !== '0' && cellValue !== 0) {
                // 支持任何非空值（包括纯数字）
                hasValidData = true
                break
              }
            }

            if (hasValidData) {
              validTagIndices.push(colIndex)
              tagMap[colIndex] = tagName
            }
          })

          // 检查标签数量
          if (validTagIndices.length > 20) {
            // 返回警告信息，由调用者处理
            resolve({
              students: [],
              tagNames: [],
              warning: `检测到 ${validTagIndices.length} 个标签，数量较多可能影响性能`
            })
            return
          }

          // 收集所有需要创建的标签名称
          const allTagNames = new Set()
          validTagIndices.forEach(colIndex => {
            allTagNames.add(tagMap[colIndex])
          })

          // 收集特殊标签
          for (let i = 1; i < jsonData.length; i++) {
            validTagIndices.forEach(colIndex => {
              const cellValue = jsonData[i][colIndex]
              if (cellValue != null && cellValue !== '' && cellValue !== '0' && cellValue !== 0 && cellValue !== 1 && cellValue !== '1') {
                // 将值转换为字符串作为标签名
                allTagNames.add(String(cellValue).trim())
              }
            })
          }

          // 准备学生数据
          const studentsData = []
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.length < 2) continue

            const studentNumber = row[0]
            const name = row[1]

            if (!name || !name.toString().trim()) continue

            // 收集学生的标签名称
            const studentTagNames = []

            validTagIndices.forEach(colIndex => {
              const cellValue = row[colIndex]

              if (cellValue === 1 || cellValue === '1') {
                studentTagNames.push(tagMap[colIndex])
              } else if (cellValue != null && cellValue !== '' && cellValue !== '0' && cellValue !== 0) {
                // 将值转换为字符串作为标签名
                studentTagNames.push(String(cellValue).trim())
              }
            })

            studentsData.push({
              studentNumber: studentNumber ? studentNumber.toString() : null,
              name: name.toString().trim(),
              tagNames: studentTagNames
            })
          }

          resolve({
            students: studentsData,
            tagNames: Array.from(allTagNames)
          })
        } catch (error) {
          reject(new Error(`解析Excel文件失败: ${error.message}`))
        }
      }

      reader.onerror = () => {
        reject(new Error('读取文件失败'))
      }

      reader.readAsArrayBuffer(file)
    })
  }

  // 导出到Excel
  const exportToExcel = async (students, tags) => {
    const XLSX = await loadXlsx()
    if (!students || students.length === 0) {
      alert('没有学生数据可导出')
      return
    }

    // 准备标题行
    const headers = ['学号', '姓名']
    tags.forEach(tag => {
      headers.push(tag.name)
    })

    // 准备数据行
    const data = [headers]

    students.forEach(student => {
      const row = [
        student.studentNumber || '',
        student.name || ''
      ]

      // 为每个标签列添加值
      tags.forEach(tag => {
        const hasTag = student.tags && student.tags.includes(tag.id)
        row.push(hasTag ? '1' : '0')
      })

      data.push(row)
    })

    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '学生名单')

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    XLSX.writeFile(wb, `学生名单_${timestamp}.xlsx`)
  }

  /**
   * 核心函数：生成用于导出的 Excel 工作簿和主工作表（用于直接渲染高保真预览或文件导出）
   */
  const generateSeatChartWorkbook = async (organizedSeats, students, tags = [], seatConfig, options = {}) => {
    const XLSX = await loadXlsx()
    const {
      showStudentId    = true,
      showRowNumbers   = true,
      showGroupLabels  = true,
      showTitle        = true,
      showPodium       = true,
      colorMode        = 'color',
      nameFontSize     = 12,
      idFontSize       = 10,
      cellWidth        = 10,
      seatRowHeight    = 40,
      showTagTable     = false,
      tagTableNewSheet = false,
      reverseOrder     = false,
      showGroupGap     = true,
      title            = '班级座位表',
      borderColor      = '#000000',
      cellFormat       = '%n\n%i',
      rowNumberScheme  = 'arabic',
      groupNumberScheme = 'arabic',
      serialNumberScheme = 'arabic'
    } = options

    const { groupCount, columnsPerGroup, seatsPerColumn } = seatConfig
    const studentMap = new Map(students.map(s => [s.id, s]))

    // ── 纯净无底色排版 (完全贴合普通表格预览，只做对齐和描边) ──
    const borderRgb = normalizeHexColor(borderColor, '000000')
    const thinBorder = (clr = borderRgb) => ({
      top:    { style: 'thin', color: { rgb: clr } },
      bottom: { style: 'thin', color: { rgb: clr } },
      left:   { style: 'thin', color: { rgb: clr } },
      right:  { style: 'thin', color: { rgb: clr } }
    })
    // 居中对齐参数
    const center = { horizontal: 'center', vertical: 'center', wrapText: true }

    // 原生单元格属性
    const styleHeader = {
      font: { bold: true, sz: nameFontSize, color: { rgb: '000000' } },
      alignment: center,
      border: thinBorder()
    }
    const styleTitle = {
      font: { bold: true, sz: nameFontSize + 4, color: { rgb: '000000' } },
      alignment: center,
       border: thinBorder()
    }
    const styleRowNum = {
      font: { bold: true, sz: nameFontSize - 1, color: { rgb: '000000' } },
      alignment: center,
      border: thinBorder()
    }
    const styleSeatName = {
      font: { bold: true, sz: nameFontSize, color: { rgb: '000000' } },
      alignment: center,
      border: thinBorder()
    }
    const styleSeat = {
      font: { sz: nameFontSize, color: { rgb: '000000' } },
      alignment: center,
      border: thinBorder()
    }
    const styleEmpty = {
      font: { sz: nameFontSize, color: { rgb: '000000' } },
      alignment: center,
      border: thinBorder()
    }
    const styleVacant = {
      font: { sz: nameFontSize, color: { rgb: '000000' } },
      alignment: center,
      border: thinBorder()
    }
    const stylePodium = {
      font: { bold: true, sz: nameFontSize, color: { rgb: '000000' } },
      alignment: center,
      border: thinBorder()
    }
    const styleTagHeader = {
      font: { bold: true, sz: nameFontSize, color: { rgb: '000000' } },
      alignment: center,
      border: thinBorder()
    }

    // ── 布局计算 ──
    const groupGapCols     = showGroupGap ? 1 : 0
    const dataColOffset    = showRowNumbers ? 1 : 0
    const groupStartCol    = (g) => dataColOffset + g * (columnsPerGroup + groupGapCols)
    const totalCols        = dataColOffset + groupCount * columnsPerGroup + (groupCount - 1) * groupGapCols
    const titleRowOffset   = showTitle ? 1 : 0
    // 翻转时讲台在最前；正序时在最后
    const podiumTopOffset  = reverseOrder && showPodium ? 1 : 0
    const groupLabelOffset = showGroupLabels ? 1 : 0
    const headerRowOffset  = titleRowOffset + podiumTopOffset + groupLabelOffset
    const podiumRows       = showPodium ? 1 : 0
    const totalSeatRows    = headerRowOffset + seatsPerColumn + (reverseOrder ? 0 : podiumRows)

    const ws = {}
    const merges = []

    const setCell = (r, c, v, s, t = 's') => {
      ws[XLSX.utils.encode_cell({ r, c })] = { v, t, s }
    }

    // ── 标题行 ──
    if (showTitle) {
      for (let c = 0; c < totalCols; c++) setCell(0, c, c === 0 ? title : '', styleTitle)
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } })
    }

    // ── 讲台行（翻转时，放在组号上方） ──
    if (showPodium && reverseOrder) {
      const pRow = titleRowOffset
      for (let c = 0; c < totalCols; c++) setCell(pRow, c, c === 0 ? '讲台' : '', stylePodium)
      merges.push({ s: { r: pRow, c: 0 }, e: { r: pRow, c: totalCols - 1 } })
    }

    // ── 组号行 ──
    if (showGroupLabels) {
      const hRow = titleRowOffset + podiumTopOffset
      if (showRowNumbers) setCell(hRow, 0, '', styleHeader)
      for (let g = 0; g < groupCount; g++) {
        const sc = groupStartCol(g)
        const groupLabel = formatIndex(g + 1, groupNumberScheme)
        setCell(hRow, sc, `第 ${groupLabel} 组`, styleHeader)
        for (let c = 1; c < columnsPerGroup; c++) setCell(hRow, sc + c, '', styleHeader)
        if (columnsPerGroup > 1) merges.push({ s: { r: hRow, c: sc }, e: { r: hRow, c: sc + columnsPerGroup - 1 } })
      }
    }

    // ── 座位行 ──
    for (let r = 0; r < seatsPerColumn; r++) {
      const eRow = headerRowOffset + r
      // 翻转时：读取数据源行索引反向
      const srcRow = reverseOrder ? (seatsPerColumn - 1 - r) : r
      // 行号显示：前端座位(srcRow=N-1)显示1，最后端(srcRow=0)显示N
      const displayRow = seatsPerColumn - srcRow
      const rowLabel = formatIndex(displayRow, rowNumberScheme)
      if (showRowNumbers) setCell(eRow, 0, `第${rowLabel}排`, styleRowNum)
      for (let g = 0; g < groupCount; g++) {
        for (let c = 0; c < columnsPerGroup; c++) {
          const eCol = groupStartCol(g) + c
          const seat = organizedSeats[g]?.[c]?.[srcRow]
          const groupLabel = formatIndex(g + 1, groupNumberScheme)
          const serial = g * columnsPerGroup * seatsPerColumn + c * seatsPerColumn + displayRow
          const serialLabel = formatIndex(serial, serialNumberScheme)
          if (!seat) {
            setCell(eRow, eCol, '', styleSeat)
          } else if (seat.isEmpty) {
            setCell(eRow, eCol, '空置', styleEmpty)
          } else if (seat.studentId) {
            const stu = studentMap.get(seat.studentId)
            if (stu) {
              const txt = formatCellContent(cellFormat, {
                name: stu.name || '未命名',
                studentId: showStudentId ? (stu.studentNumber || '') : '',
                rowLabel,
                groupLabel,
                serialLabel
              })
              setCell(eRow, eCol, txt, styleSeatName)
            } else {
              setCell(eRow, eCol, '', styleSeat)
            }
          } else {
            setCell(eRow, eCol, '', styleVacant)
          }
        }
        // 组间空列
        if (showGroupGap && g < groupCount - 1) {
          const gapCol = groupStartCol(g) + columnsPerGroup
          setCell(eRow, gapCol, '', {}) // 纯空白无样式
        }
      }
    }

    // ── 讲台行（正序时，放在最后） ──
    if (showPodium && !reverseOrder) {
      const pRow = headerRowOffset + seatsPerColumn
      for (let c = 0; c < totalCols; c++) setCell(pRow, c, c === 0 ? '讲台' : '', stylePodium)
      merges.push({ s: { r: pRow, c: 0 }, e: { r: pRow, c: totalCols - 1 } })
    }

    // ── 列宽 / 行高 ──
    ws['!cols'] = Array.from({ length: totalCols }, (_, c) => {
      if (showRowNumbers && c === 0) return { wch: 7 }
      const baseC = c - dataColOffset
      if (showGroupGap) {
        if (baseC % (columnsPerGroup + 1) === columnsPerGroup) return { wch: 2 }
      }
      return { wch: cellWidth }
    })
    ws['!rows'] = Array.from({ length: totalSeatRows }, (_, r) => {
      if (showTitle && r === 0) return { hpt: 28 }
      if (showGroupLabels && r === titleRowOffset + podiumTopOffset) return { hpt: 22 }
      // 翻转：讲台行在 titleRowOffset 
      if (reverseOrder && showPodium && r === titleRowOffset) return { hpt: 22 }
      // 正序：讲台行在最后
      if (!reverseOrder && r === totalSeatRows - 1 && showPodium) return { hpt: 22 }
      return { hpt: seatRowHeight }
    })

    // ── 标签统计表构建函数 ──
    const buildTagTable = (targetWs, targetMerges, startRow, targetCols) => {
      if (!tags || tags.length === 0) return startRow
      const totalSpan = Math.max(3, targetCols)
      // 标题
      for (let c = 0; c < totalSpan; c++) {
        targetWs[XLSX.utils.encode_cell({ r: startRow, c })] = {
          v: c === 0 ? '标签统计' : '', t: 's', s: styleTagHeader
        }
      }
      targetMerges.push({ s: { r: startRow, c: 0 }, e: { r: startRow, c: totalSpan - 1 } })
      
      // 表头
      const hRow = startRow + 1
      targetWs[XLSX.utils.encode_cell({ r: hRow, c: 0 })] = { v: '标签', t: 's', s: styleTagHeader }
      targetWs[XLSX.utils.encode_cell({ r: hRow, c: 1 })] = { v: '人数', t: 's', s: styleTagHeader }
      for (let c = 2; c < totalSpan; c++) {
        targetWs[XLSX.utils.encode_cell({ r: hRow, c })] = { v: c === 2 ? '学生名单' : '', t: 's', s: styleTagHeader }
      }
      if (totalSpan > 3) {
        targetMerges.push({ s: { r: hRow, c: 2 }, e: { r: hRow, c: totalSpan - 1 } })
      }
      
      let dRow = hRow + 1
      for (const tag of tags) {
        const tagStus = students.filter(s => s.tags && s.tags.includes(tag.id))
        if (tagStus.length === 0) continue
        targetWs[XLSX.utils.encode_cell({ r: dRow, c: 0 })] = { v: tag.name, t: 's', s: styleRowNum }
        targetWs[XLSX.utils.encode_cell({ r: dRow, c: 1 })] = { v: tagStus.length, t: 'n', s: styleSeat }
        for (let c = 2; c < totalSpan; c++) {
          targetWs[XLSX.utils.encode_cell({ r: dRow, c })] = {
            v: c === 2 ? tagStus.map(s => s.name).join('、 ') : '', t: 's',
            s: { ...styleSeat, alignment: { horizontal: 'left', vertical: 'center', wrapText: true } }
          }
        }
        if (totalSpan > 3) {
          targetMerges.push({ s: { r: dRow, c: 2 }, e: { r: dRow, c: totalSpan - 1 } })
        }
        dRow++
      }
      return dRow - 1
    }

    // ── 确定范围 & 处理标签表 ──
    const wb = XLSX.utils.book_new()
    let maxRow = totalSeatRows - 1
    let maxCol = totalCols - 1

    if (showTagTable && tags.length > 0) {
      if (tagTableNewSheet) {
        // 独立工作表
        const tagWs = {}
        const tagMerges = []
        const lastRow = buildTagTable(tagWs, tagMerges, 0, 3)
        tagWs['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: 2 } })
        tagWs['!merges'] = tagMerges
        tagWs['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 60 }]
        tagWs['!rows'] = Array.from({ length: lastRow + 1 }, (_, i) => ({ hpt: i < 2 ? 22 : 28 }))
        XLSX.utils.book_append_sheet(wb, tagWs, '标签统计')
      } else {
        // 同 Sheet，空 2 行后追加
        const tagStart = totalSeatRows + 2
        const lastRow = buildTagTable(ws, merges, tagStart, totalCols)
        maxRow = lastRow
        maxCol = Math.max(maxCol, 2)
      }
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } })
    ws['!merges'] = merges

    XLSX.utils.book_append_sheet(wb, ws, title || '座位表')
    
    return {
      wb,
      ws,     // 主工作表
      maxRow, // 主工作表最大行索引
      maxCol  // 主工作表最大列索引
    }
  }

  /**
   * 将座位表导出为 Excel 并触发下载
   */
  const exportSeatChartToExcel = async (organizedSeats, students, tags = [], seatConfig, options = {}) => {
    const XLSX = await loadXlsx()
    const { wb } = await generateSeatChartWorkbook(organizedSeats, students, tags, seatConfig, options)
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    XLSX.writeFile(wb, `座位表_${timestamp}.xlsx`)
  }

  /**
   * 将座位表导出为 ArrayBuffer, 供上传云端使用
   */
  const exportSeatChartToExcelBuffer = async (organizedSeats, students, tags = [], seatConfig, options = {}) => {
    const XLSX = await loadXlsx()
    const { wb } = await generateSeatChartWorkbook(organizedSeats, students, tags, seatConfig, options)
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  }

  return {
    xlsxInstance,
    loadXlsx,
    downloadTemplate,
    importFromExcel,
    exportToExcel,
    generateSeatChartWorkbook,
    exportSeatChartToExcel,
    exportSeatChartToExcelBuffer
  }
}
