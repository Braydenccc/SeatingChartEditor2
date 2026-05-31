import { shallowRef } from 'vue'
import { getOrderedIndices, getRowNumber, getSourceRowIndex } from '@/utils/exportLayout'

export const xlsxInstance = shallowRef(null)
export const loadXlsx = async () => {
    if (xlsxInstance.value) return xlsxInstance.value
    const mod = await import('xlsx-js-style')
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
  
  const parseInlineStyle = (styleStr) => {
    const style = {}
    if (!styleStr) return style
    const parts = styleStr.split(',')
    parts.forEach(part => {
      const [key, value] = part.split(':').map(s => s.trim())
      if (!key) return
      const lowerKey = key.toLowerCase()
      if (lowerKey === 'bold' || lowerKey === 'italic') {
        style[lowerKey] = value === undefined || value === '' || value === 'true'
      } else if (lowerKey === 'color') {
        style.color = normalizeHexColor(value || '000000', '000000')
      } else if (lowerKey === 'size' || lowerKey === 'sz') {
        const sz = parseInt(value)
        if (!isNaN(sz)) style.sz = sz
      }
    })
    return style
  }
  
  const formatWithStyles = (template, context) => {
    const parts = []
    let currentText = ''
    let index = 0
    while (index < template.length) {
      if (template[index] === '%') {
        if (index + 1 < template.length) {
          const token = template[index + 1]
          if (tokenMap.hasOwnProperty(token) || token === '%') {
            if (currentText) {
              parts.push({ type: 'text', content: currentText })
              currentText = ''
            }
            if (token === '%') {
              parts.push({ type: 'text', content: '%' })
              index += 2
            } else {
              let style = null
              let advance = 2
              if (index + 2 < template.length && template[index + 2] === '[') {
                const endBracket = template.indexOf(']', index + 3)
                if (endBracket !== -1) {
                  const styleStr = template.substring(index + 3, endBracket)
                  style = parseInlineStyle(styleStr)
                  advance = endBracket - index + 1
                }
              }
              const content = tokenMap[token] ?? ''
              if (content) {
                parts.push({ type: 'placeholder', token, content, style })
              }
              index += advance
            }
            continue
          }
        }
        currentText += '%'
        index++
      } else {
        currentText += template[index]
        index++
      }
    }
    if (currentText) {
      parts.push({ type: 'text', content: currentText })
    }
    return parts
  }
  
  const parts = formatWithStyles(source, context)
  const replaced = source.replace(/%([%nirgsj])(?:\[([^\]]*)\])?/g, (m, token) => {
    if (token === '%') return '%'
    return tokenMap[token] ?? ''
  })
  return {
    text: trimEdgeEmptyLines(replaced),
    richParts: parts
  }
}

const trimEdgeEmptyLines = (text) => {
  const lines = String(text || '').split('\n').map((line) => line.trimEnd())
  while (lines.length > 0 && lines[0] === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n').trim()
}

// ── Excel 导出配置管理 ──

const defaultExcelConfig = {
  layout: {
    showStudentId: true,
    showRowNumbers: true,
    showGroupLabels: true,
    showTitle: true,
    showPodium: true,
    flipHorizontal: false,
    flipVertical: false,
    reverseOrder: false,
    showGroupGap: true,
    showTagTable: false,
    tagTableNewSheet: false
  },
  sizing: {
    cellWidth: 10,
    seatRowHeight: 40,
    nameFontSize: 12,
    idFontSize: 10,
    seatFontSize: 12
  },
  content: {
    title: '班级座位表',
    cellFormat: '%n\n%i'
  },
  numbering: {
    rowNumberScheme: 'arabic',
    groupNumberScheme: 'arabic',
    serialNumberScheme: 'arabic'
  },
  border: {
    showBorders: true,
    borderStyle: 'thin',
    innerBorderStyle: 'thin',
    innerBorderColor: '#000000',
    outerBorderStyle: 'thin',
    outerBorderColor: '#000000',
    borderColor: '#000000'
  },
  fonts: {
    titleFontBold: true,
    titleFontSize: 16,
    titleFontColor: '#1F4E78',
    headerFontBold: true,
    headerFontSize: 12,
    headerFontColor: '#1F4E78',
    seatFontBold: false,
    seatFontColor: '#000000'
  },
  fills: {
    titleFillColor: '',
    headerFillColor: '',
    rowNumFillColor: '',
    podiumFillColor: '',
    seatFillColor: '',
    emptyFillColor: '',
    vacantFillColor: '',
    tagHeaderFillColor: ''
  }
}

const mergeExcelConfig = (base, override) => {
  const result = {}
  for (const key of Object.keys(base)) {
    result[key] = { ...base[key], ...(override[key] || {}) }
  }
  const overrideLayout = override.layout || {}
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(overrideLayout, key)
  if (!hasOwn('flipVertical') && hasOwn('reverseOrder')) {
    result.layout.flipVertical = !!overrideLayout.reverseOrder
  }
  result.layout.flipHorizontal = !!result.layout.flipHorizontal
  result.layout.flipVertical = !!result.layout.flipVertical
  result.layout.reverseOrder = result.layout.flipVertical
  return result
}

const convertLegacyExcelOptions = (legacy) => {
  if (!legacy || typeof legacy !== 'object') return {}
  if (legacy.layout || legacy.sizing || legacy.content) return legacy
  return {
    layout: {
      showStudentId: legacy.showStudentId,
      showRowNumbers: legacy.showRowNumbers,
      showGroupLabels: legacy.showGroupLabels,
      showTitle: legacy.showTitle,
      showPodium: legacy.showPodium,
      flipHorizontal: legacy.flipHorizontal,
      flipVertical: legacy.flipVertical !== undefined ? legacy.flipVertical : legacy.reverseOrder,
      reverseOrder: legacy.reverseOrder,
      showGroupGap: legacy.showGroupGap,
      showTagTable: legacy.showTagTable,
      tagTableNewSheet: legacy.tagTableNewSheet
    },
    sizing: {
      nameFontSize: legacy.nameFontSize,
      idFontSize: legacy.idFontSize,
      cellWidth: legacy.cellWidth,
      seatRowHeight: legacy.seatRowHeight,
      seatFontSize: legacy.seatFontSize
    },
    content: {
      title: legacy.title,
      cellFormat: legacy.cellFormat
    },
    numbering: {
      rowNumberScheme: legacy.rowNumberScheme,
      groupNumberScheme: legacy.groupNumberScheme,
      serialNumberScheme: legacy.serialNumberScheme
    },
    border: {
      showBorders: legacy.showBorders,
      borderStyle: legacy.borderStyle,
      innerBorderStyle: legacy.innerBorderStyle,
      innerBorderColor: legacy.innerBorderColor,
      outerBorderStyle: legacy.outerBorderStyle,
      outerBorderColor: legacy.outerBorderColor,
      borderColor: legacy.borderColor
    },
    fonts: {
      titleFontBold: legacy.titleFontBold,
      titleFontSize: legacy.titleFontSize,
      titleFontColor: legacy.titleFontColor,
      headerFontBold: legacy.headerFontBold,
      headerFontSize: legacy.headerFontSize,
      headerFontColor: legacy.headerFontColor,
      seatFontBold: legacy.seatFontBold,
      seatFontColor: legacy.seatFontColor
    },
    fills: {
      titleFillColor: legacy.titleFillColor,
      headerFillColor: legacy.headerFillColor,
      rowNumFillColor: legacy.rowNumFillColor,
      podiumFillColor: legacy.podiumFillColor,
      seatFillColor: legacy.seatFillColor,
      emptyFillColor: legacy.emptyFillColor,
      vacantFillColor: legacy.vacantFillColor,
      tagHeaderFillColor: legacy.tagHeaderFillColor
    }
  }
}

const buildExcelOptionsFromSettings = (es) => ({
  layout: {
    showStudentId: es.excelShowStudentId,
    showRowNumbers: es.excelShowRowNumbers,
    showGroupLabels: es.excelShowGroupLabels,
    showTitle: es.excelShowTitle,
    showPodium: es.excelShowPodium,
    flipHorizontal: es.excelFlipHorizontal,
    flipVertical: es.excelFlipVertical,
    reverseOrder: es.excelFlipVertical,
    showGroupGap: es.excelShowGroupGap,
    showTagTable: es.excelShowTagTable,
    tagTableNewSheet: es.excelTagTableNewSheet
  },
  sizing: {
    nameFontSize: es.excelNameFontSize,
    idFontSize: es.excelIdFontSize,
    cellWidth: es.excelCellWidth,
    seatRowHeight: es.excelSeatRowHeight
  },
  content: {
    title: es.title || '班级座位表',
    cellFormat: es.excelCellFormat
  },
  numbering: {
    rowNumberScheme: es.excelRowNumberScheme,
    groupNumberScheme: es.excelGroupNumberScheme,
    serialNumberScheme: es.excelSerialNumberScheme
  },
  border: {
    showBorders: es.excelShowBorders,
    borderStyle: es.excelBorderStyle,
    innerBorderStyle: es.excelInnerBorderStyle,
    innerBorderColor: es.excelInnerBorderColor,
    outerBorderStyle: es.excelOuterBorderStyle,
    outerBorderColor: es.excelOuterBorderColor,
    borderColor: es.excelBorderColor
  },
  fonts: {
    titleFontBold: es.excelTitleFontBold,
    titleFontSize: es.excelTitleFontSize,
    titleFontColor: es.excelTitleFontColor,
    headerFontBold: es.excelHeaderFontBold,
    headerFontSize: es.excelHeaderFontSize,
    headerFontColor: es.excelHeaderFontColor,
    seatFontBold: es.excelSeatCellFontBold,
    seatFontColor: es.excelSeatCellFontColor
  },
  fills: {
    titleFillColor: es.excelTitleFillColor,
    headerFillColor: es.excelHeaderFillColor,
    rowNumFillColor: es.excelRowNumFillColor,
    podiumFillColor: es.excelPodiumFillColor,
    seatFillColor: es.excelSeatFillColor,
    emptyFillColor: es.excelEmptyFillColor,
    vacantFillColor: es.excelVacantFillColor,
    tagHeaderFillColor: es.excelTagHeaderFillColor
  }
})

// ── Excel 样式构建器 ──

const createExcelStyleBuilder = (config) => {
  const { border: bc, fonts, fills, sizing } = config

  const borderRgb = normalizeHexColor(bc.borderColor, '000000')
  const innerBorderRgb = normalizeHexColor(bc.innerBorderColor, '000000')
  const outerBorderRgb = normalizeHexColor(bc.outerBorderColor, '000000')
  const titleFontRgb = normalizeHexColor(fonts.titleFontColor, '1F4E78')
  const headerFontRgb = normalizeHexColor(fonts.headerFontColor, '1F4E78')
  const seatFontRgb = normalizeHexColor(fonts.seatFontColor, '000000')

  const titleFillRgb = normalizeHexColor(fills.titleFillColor, '') || null
  const headerFillRgb = normalizeHexColor(fills.headerFillColor, '') || null
  const rowNumFillRgb = normalizeHexColor(fills.rowNumFillColor, '') || null
  const podiumFillRgb = normalizeHexColor(fills.podiumFillColor, '') || null
  const seatFillRgb = normalizeHexColor(fills.seatFillColor, '') || null
  const emptyFillRgb = normalizeHexColor(fills.emptyFillColor, '') || null
  const vacantFillRgb = normalizeHexColor(fills.vacantFillColor, '') || null
  const tagHeaderFillRgb = normalizeHexColor(fills.tagHeaderFillColor, '') || null

  const buildFill = (colorRgb) => {
    if (!colorRgb) return {}
    return { fill: { patternType: 'solid', fgColor: { rgb: colorRgb } } }
  }

  const createBorder = (style, color) => {
    if (!bc.showBorders) return {}
    return {
      top: { style, color: { rgb: color } },
      bottom: { style, color: { rgb: color } },
      left: { style, color: { rgb: color } },
      right: { style, color: { rgb: color } }
    }
  }

  const createBorderSide = (style, color) => {
    if (!bc.showBorders) return {}
    return { style, color: { rgb: color } }
  }

  const thinBorder = (clr = borderRgb) => createBorder(bc.borderStyle, clr)
  const innerBorder = () => createBorder(bc.innerBorderStyle, innerBorderRgb)

  const cellEdgeBorder = (isTop, isBottom, isLeft, isRight) => ({
    top: isTop ? createBorderSide(bc.outerBorderStyle, outerBorderRgb) : createBorderSide(bc.innerBorderStyle, innerBorderRgb),
    bottom: isBottom ? createBorderSide(bc.outerBorderStyle, outerBorderRgb) : createBorderSide(bc.innerBorderStyle, innerBorderRgb),
    left: isLeft ? createBorderSide(bc.outerBorderStyle, outerBorderRgb) : createBorderSide(bc.innerBorderStyle, innerBorderRgb),
    right: isRight ? createBorderSide(bc.outerBorderStyle, outerBorderRgb) : createBorderSide(bc.innerBorderStyle, innerBorderRgb)
  })

  const buildRichText = (parts, baseFont = {}) => {
    const rich = []
    parts.forEach(part => {
      if (part.type === 'text') {
        rich.push({ t: part.content, s: { font: baseFont } })
      } else if (part.type === 'placeholder') {
        const font = { ...baseFont }
        if (part.style) {
          if (part.style.bold !== undefined) font.bold = part.style.bold
          if (part.style.size !== undefined) font.sz = part.style.size
          if (part.style.color !== undefined) {
            font.color = { rgb: normalizeHexColor(part.style.color, '000000') }
          }
        }
        rich.push({ t: part.content, s: { font } })
      }
    })
    return rich
  }

  const center = { horizontal: 'center', vertical: 'center', wrapText: true }

  const styles = {
    header: {
      font: { bold: fonts.headerFontBold, sz: fonts.headerFontSize, color: { rgb: headerFontRgb } },
      alignment: center,
      border: thinBorder(),
      ...buildFill(headerFillRgb)
    },
    title: {
      font: { bold: fonts.titleFontBold, sz: fonts.titleFontSize, color: { rgb: titleFontRgb } },
      alignment: center,
      border: thinBorder(),
      ...buildFill(titleFillRgb)
    },
    rowNum: {
      font: { bold: fonts.headerFontBold, sz: fonts.headerFontSize, color: { rgb: headerFontRgb } },
      alignment: center,
      border: thinBorder(),
      ...buildFill(rowNumFillRgb)
    },
    seatName: {
      font: { bold: true, sz: sizing.seatFontSize, color: { rgb: seatFontRgb } },
      alignment: center,
      border: innerBorder(),
      ...buildFill(seatFillRgb)
    },
    seat: {
      font: { bold: fonts.seatFontBold, sz: sizing.seatFontSize, color: { rgb: seatFontRgb } },
      alignment: center,
      border: innerBorder(),
      ...buildFill(seatFillRgb)
    },
    empty: {
      font: { bold: fonts.seatFontBold, sz: sizing.seatFontSize, color: { rgb: seatFontRgb } },
      alignment: center,
      border: innerBorder(),
      ...buildFill(emptyFillRgb)
    },
    vacant: {
      font: { bold: fonts.seatFontBold, sz: sizing.seatFontSize, color: { rgb: seatFontRgb } },
      alignment: center,
      border: innerBorder(),
      ...buildFill(vacantFillRgb)
    },
    podium: {
      font: { bold: fonts.headerFontBold, sz: fonts.headerFontSize, color: { rgb: headerFontRgb } },
      alignment: center,
      border: thinBorder(),
      ...buildFill(podiumFillRgb)
    },
    tagHeader: {
      font: { bold: fonts.headerFontBold, sz: fonts.headerFontSize, color: { rgb: headerFontRgb } },
      alignment: center,
      border: thinBorder(),
      ...buildFill(tagHeaderFillRgb)
    }
  }

  return {
    styles,
    cellEdgeBorder,
    buildRichText,
    seatFontRgb,
    center
  }
}

// ── Excel 布局计算器 ──

const createExcelLayoutCalculator = (seatConfig, config) => {
  const { layout, numbering } = config
  const { groupCount, columnsPerGroup, seatsPerColumn } = seatConfig

  const groupGapCols = layout.showGroupGap ? 1 : 0
  const seatsPerGroup = columnsPerGroup * seatsPerColumn
  const precomputedGroupLabels = Array.from({ length: groupCount }, (_, i) => formatIndex(i + 1, numbering.groupNumberScheme))
  const dataColOffset = layout.showRowNumbers ? 1 : 0
  const groupStartCol = (g) => dataColOffset + g * (columnsPerGroup + groupGapCols)
  const totalCols = dataColOffset + groupCount * columnsPerGroup + (groupCount - 1) * groupGapCols
  const titleRowOffset = layout.showTitle ? 1 : 0
  const podiumTopOffset = layout.flipVertical && layout.showPodium ? 1 : 0
  const groupLabelOffset = layout.showGroupLabels ? 1 : 0
  const headerRowOffset = titleRowOffset + podiumTopOffset + groupLabelOffset
  const podiumRows = layout.showPodium ? 1 : 0
  const totalSeatRows = headerRowOffset + seatsPerColumn + (layout.flipVertical ? 0 : podiumRows)

  const isTopEdge = (r) => r === 0
  const isBottomEdge = (r) => r === totalSeatRows - 1
  const isLeftEdge = (c) => c === 0
  const isRightEdge = (c) => c === totalCols - 1

  return {
    groupCount,
    columnsPerGroup,
    seatsPerColumn,
    seatsPerGroup,
    precomputedGroupLabels,
    dataColOffset,
    groupStartCol,
    totalCols,
    titleRowOffset,
    podiumTopOffset,
    groupLabelOffset,
    headerRowOffset,
    podiumRows,
    totalSeatRows,
    groupGapCols,
    isTopEdge,
    isBottomEdge,
    isLeftEdge,
    isRightEdge
  }
}

export function useExcelData() {
  const downloadTemplate = async () => {
    const XLSX = await loadXlsx()
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

          const headers = jsonData[0]
          if (!headers || headers.length < 2) {
            reject(new Error('Excel文件格式不正确，至少需要学号和姓名列'))
            return
          }

          const firstColName = String(headers[0] || '').trim()
          const secondColName = String(headers[1] || '').trim()

          const hasStudentId = firstColName.includes('学号') || secondColName.includes('学号')
          const hasName = firstColName.includes('姓名') || secondColName.includes('姓名')

          if (!hasStudentId || !hasName) {
            reject(new Error('缺少必要字段：学号、姓名。请确保 Excel 第一行包含这些列名。'))
            return
          }

          const invalidRows = []
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            const nameValue = row[1]
            if (!nameValue || String(nameValue).trim() === '') {
              invalidRows.push(i + 1)
            }
          }

          if (invalidRows.length > 0) {
            const rowList = invalidRows.slice(0, 5).join('、')
            const more = invalidRows.length > 5 ? ` 等 ${invalidRows.length} 行` : ''
            reject(new Error(`第 ${rowList}${more} 的姓名为空，请检查数据`))
            return
          }

          const tagHeaders = headers.slice(2).filter(h => {
            if (h == null) return false
            const str = String(h).trim()
            return str.length > 0
          }).map(h => String(h).trim())

          const studentCount = jsonData.length - 1
          if (studentCount > 100) {
            resolve({
              students: [],
              tagNames: [],
              warning: `检测到 ${studentCount} 个学生，数量较多可能影响性能`
            })
            return
          }

          const validTagIndices = []
          const tagMap = {}
          const allTagNames = new Set()

          tagHeaders.forEach((tagName, index) => {
            const colIndex = index + 2
            let hasValidData = false

            for (let i = 1; i < jsonData.length; i++) {
              const cellValue = jsonData[i][colIndex]
              if (cellValue === 1 || cellValue === '1') {
                hasValidData = true
                allTagNames.add(tagName)
              } else if (cellValue != null && cellValue !== '' && cellValue !== '0' && cellValue !== 0) {
                hasValidData = true
                allTagNames.add(tagName)
                allTagNames.add(String(cellValue).trim())
              }
            }

            if (hasValidData) {
              validTagIndices.push(colIndex)
              tagMap[colIndex] = tagName
            }
          })

          if (validTagIndices.length > 20) {
            resolve({
              students: [],
              tagNames: [],
              warning: `检测到 ${validTagIndices.length} 个标签，数量较多可能影响性能`
            })
            return
          }

          const studentsData = []
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.length < 2) continue

            const studentNumber = row[0]
            const name = row[1]

            if (!name || !name.toString().trim()) continue

            const studentTagNames = []

            validTagIndices.forEach(colIndex => {
              const cellValue = row[colIndex]

              if (cellValue === 1 || cellValue === '1') {
                studentTagNames.push(tagMap[colIndex])
              } else if (cellValue != null && cellValue !== '' && cellValue !== '0' && cellValue !== 0) {
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

  const exportToExcel = async (students, tags) => {
    const XLSX = await loadXlsx()
    if (!students || students.length === 0) {
      alert('没有学生数据可导出')
      return
    }

    const headers = ['学号', '姓名']
    tags.forEach(tag => {
      headers.push(tag.name)
    })

    const data = [headers]

    students.forEach(student => {
      const row = [
        student.studentNumber || '',
        student.name || ''
      ]

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

  const generateSeatChartWorkbook = async (organizedSeats, students, tags = [], seatConfig, userOptions = {}) => {
    const XLSX = await loadXlsx()

    const legacyConfig = convertLegacyExcelOptions(userOptions)
    const config = mergeExcelConfig(defaultExcelConfig, legacyConfig)
    const { layout, sizing, content, numbering } = config

    const studentMap = new Map(students.map(s => [s.id, s]))
    const styleBuilder = createExcelStyleBuilder(config)
    const layoutCalc = createExcelLayoutCalculator(seatConfig, config)

    const { styles, cellEdgeBorder, buildRichText, seatFontRgb } = styleBuilder
    const {
      groupCount, columnsPerGroup, seatsPerColumn, seatsPerGroup,
      precomputedGroupLabels, dataColOffset, groupStartCol, totalCols,
      titleRowOffset, podiumTopOffset, headerRowOffset, totalSeatRows
    } = layoutCalc

    const ws = {}
    const merges = []

    const edgeBd = (r, c) => cellEdgeBorder(
      layoutCalc.isTopEdge(r), layoutCalc.isBottomEdge(r),
      layoutCalc.isLeftEdge(c), layoutCalc.isRightEdge(c)
    )

    const setCell = (r, c, v, s, t = 's', richText = null, borderOverride = null) => {
      const finalStyle = borderOverride ? { ...s, border: borderOverride } : s
      const cell = { s: finalStyle }
      if (richText) {
        cell.v = v
        cell.t = 'r'
        cell.r = richText
      } else {
        cell.v = v
        cell.t = t
      }
      ws[XLSX.utils.encode_cell({ r, c })] = cell
    }

    if (layout.showTitle) {
      for (let c = 0; c < totalCols; c++) setCell(0, c, c === 0 ? content.title : '', styles.title, 's', null, edgeBd(0, c))
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } })
    }

    if (layout.showPodium && layout.flipVertical) {
      const pRow = titleRowOffset
      for (let c = 0; c < totalCols; c++) setCell(pRow, c, c === 0 ? '讲台' : '', styles.podium, 's', null, edgeBd(pRow, c))
      merges.push({ s: { r: pRow, c: 0 }, e: { r: pRow, c: totalCols - 1 } })
    }

    if (layout.showGroupLabels) {
      const hRow = titleRowOffset + podiumTopOffset
      if (layout.showRowNumbers) setCell(hRow, 0, '', styles.header, 's', null, edgeBd(hRow, 0))
      const visualGroupIndices = getOrderedIndices(groupCount, layout.flipHorizontal)
      for (let visualG = 0; visualG < groupCount; visualG++) {
        const g = visualGroupIndices[visualG]
        const sc = groupStartCol(visualG)
        const groupLabel = precomputedGroupLabels[g]
        setCell(hRow, sc, `第 ${groupLabel} 组`, styles.header, 's', null, edgeBd(hRow, sc))
        for (let c = 1; c < columnsPerGroup; c++) setCell(hRow, sc + c, '', styles.header, 's', null, edgeBd(hRow, sc + c))
        if (columnsPerGroup > 1) merges.push({ s: { r: hRow, c: sc }, e: { r: hRow, c: sc + columnsPerGroup - 1 } })
      }
    }

    for (let r = 0; r < seatsPerColumn; r++) {
      const eRow = headerRowOffset + r
      const srcRow = getSourceRowIndex(r, seatsPerColumn, layout.flipVertical)
      const displayRow = getRowNumber(srcRow, seatsPerColumn, seatConfig.podiumPosition)
      const rowLabel = formatIndex(displayRow, numbering.rowNumberScheme)
      if (layout.showRowNumbers) setCell(eRow, 0, `第${rowLabel}排`, styles.rowNum, 's', null, edgeBd(eRow, 0))
      const visualGroupIndices = getOrderedIndices(groupCount, layout.flipHorizontal)
      for (let visualG = 0; visualG < groupCount; visualG++) {
        const g = visualGroupIndices[visualG]
        const groupLabel = precomputedGroupLabels[g]
        for (let c = 0; c < columnsPerGroup; c++) {
          const sourceCol = layout.flipHorizontal ? (columnsPerGroup - 1 - c) : c
          const eCol = groupStartCol(visualG) + c
          const seat = organizedSeats[g]?.[sourceCol]?.[srcRow]
          const serial = g * seatsPerGroup + sourceCol * seatsPerColumn + (srcRow + 1)
          const serialLabel = formatIndex(serial, numbering.serialNumberScheme)
          if (!seat) {
            setCell(eRow, eCol, '', styles.seat, 's', null, edgeBd(eRow, eCol))
          } else if (seat.isEmpty) {
            setCell(eRow, eCol, '空置', styles.empty, 's', null, edgeBd(eRow, eCol))
          } else if (seat.studentId) {
            const stu = studentMap.get(seat.studentId)
            if (stu) {
              const cellContent = formatCellContent(content.cellFormat, {
                name: stu.name || '未命名',
                studentId: layout.showStudentId ? (stu.studentNumber || '') : '',
                rowLabel,
                groupLabel,
                serialLabel
              })
              const baseFont = { bold: true, sz: sizing.seatFontSize, color: { rgb: seatFontRgb } }
              const richText = buildRichText(cellContent.richParts, baseFont)
              setCell(eRow, eCol, cellContent.text, styles.seatName, 's', richText, edgeBd(eRow, eCol))
            } else {
              setCell(eRow, eCol, '', styles.seat, 's', null, edgeBd(eRow, eCol))
            }
          } else {
            setCell(eRow, eCol, '', styles.vacant, 's', null, edgeBd(eRow, eCol))
          }
        }
        if (layout.showGroupGap && visualG < groupCount - 1) {
          const gapCol = groupStartCol(visualG) + columnsPerGroup
          setCell(eRow, gapCol, '', {}, 's', null, edgeBd(eRow, gapCol))
        }
      }
    }

    if (layout.showPodium && !layout.flipVertical) {
      const pRow = headerRowOffset + seatsPerColumn
      for (let c = 0; c < totalCols; c++) setCell(pRow, c, c === 0 ? '讲台' : '', styles.podium, 's', null, edgeBd(pRow, c))
      merges.push({ s: { r: pRow, c: 0 }, e: { r: pRow, c: totalCols - 1 } })
    }

    ws['!cols'] = Array.from({ length: totalCols }, (_, c) => {
      if (layout.showRowNumbers && c === 0) return { wch: 7 }
      const baseC = c - dataColOffset
      if (layout.showGroupGap) {
        if (baseC % (columnsPerGroup + 1) === columnsPerGroup) return { wch: 2 }
      }
      return { wch: sizing.cellWidth }
    })
    ws['!rows'] = Array.from({ length: totalSeatRows }, (_, r) => {
      if (layout.showTitle && r === 0) return { hpt: 28 }
      if (layout.showGroupLabels && r === titleRowOffset + podiumTopOffset) return { hpt: 22 }
      if (layout.flipVertical && layout.showPodium && r === titleRowOffset) return { hpt: 22 }
      if (!layout.flipVertical && r === totalSeatRows - 1 && layout.showPodium) return { hpt: 22 }
      return { hpt: sizing.seatRowHeight }
    })

    const buildTagTable = (targetWs, targetMerges, startRow, targetCols) => {
      if (!tags || tags.length === 0) return startRow
      const totalSpan = Math.max(3, targetCols)
      for (let c = 0; c < totalSpan; c++) {
        targetWs[XLSX.utils.encode_cell({ r: startRow, c })] = {
          v: c === 0 ? '标签统计' : '', t: 's', s: styles.tagHeader
        }
      }
      targetMerges.push({ s: { r: startRow, c: 0 }, e: { r: startRow, c: totalSpan - 1 } })

      const hRow = startRow + 1
      targetWs[XLSX.utils.encode_cell({ r: hRow, c: 0 })] = { v: '标签', t: 's', s: styles.tagHeader }
      targetWs[XLSX.utils.encode_cell({ r: hRow, c: 1 })] = { v: '人数', t: 's', s: styles.tagHeader }
      for (let c = 2; c < totalSpan; c++) {
        targetWs[XLSX.utils.encode_cell({ r: hRow, c })] = { v: c === 2 ? '学生名单' : '', t: 's', s: styles.tagHeader }
      }
      if (totalSpan > 3) {
        targetMerges.push({ s: { r: hRow, c: 2 }, e: { r: hRow, c: totalSpan - 1 } })
      }

      let dRow = hRow + 1
      for (const tag of tags) {
        const tagStus = students.filter(s => s.tags && s.tags.includes(tag.id))
        if (tagStus.length === 0) continue
        targetWs[XLSX.utils.encode_cell({ r: dRow, c: 0 })] = { v: tag.name, t: 's', s: styles.rowNum }
        targetWs[XLSX.utils.encode_cell({ r: dRow, c: 1 })] = { v: tagStus.length, t: 'n', s: styles.seat }
        for (let c = 2; c < totalSpan; c++) {
          targetWs[XLSX.utils.encode_cell({ r: dRow, c })] = {
            v: c === 2 ? tagStus.map(s => s.name).join('、 ') : '', t: 's',
            s: { ...styles.seat, alignment: { horizontal: 'left', vertical: 'center', wrapText: true } }
          }
        }
        if (totalSpan > 3) {
          targetMerges.push({ s: { r: dRow, c: 2 }, e: { r: dRow, c: totalSpan - 1 } })
        }
        dRow++
      }
      return dRow - 1
    }

    const wb = XLSX.utils.book_new()
    let maxRow = totalSeatRows - 1
    let maxCol = totalCols - 1

    if (layout.showTagTable && tags.length > 0) {
      if (layout.tagTableNewSheet) {
        const tagWs = {}
        const tagMerges = []
        const lastRow = buildTagTable(tagWs, tagMerges, 0, 3)
        tagWs['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: 2 } })
        tagWs['!merges'] = tagMerges
        tagWs['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 60 }]
        tagWs['!rows'] = Array.from({ length: lastRow + 1 }, (_, i) => ({ hpt: i < 2 ? 22 : 28 }))
        XLSX.utils.book_append_sheet(wb, tagWs, '标签统计')
      } else {
        const tagStart = totalSeatRows + 2
        const lastRow = buildTagTable(ws, merges, tagStart, totalCols)
        maxRow = lastRow
        maxCol = Math.max(maxCol, 2)
      }
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } })
    ws['!merges'] = merges

    XLSX.utils.book_append_sheet(wb, ws, content.title || '座位表')

    return {
      wb,
      ws,
      maxRow,
      maxCol
    }
  }

  const exportSeatChartToExcel = async (organizedSeats, students, tags = [], seatConfig, options = {}) => {
    const XLSX = await loadXlsx()
    const { wb } = await generateSeatChartWorkbook(organizedSeats, students, tags, seatConfig, options)
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    XLSX.writeFile(wb, `座位表_${timestamp}.xlsx`)
  }

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
    exportSeatChartToExcelBuffer,
    buildExcelOptionsFromSettings
  }
}
