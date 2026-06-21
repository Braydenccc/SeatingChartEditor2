import { shallowRef } from 'vue'
import { getEffectivePodiumPosition, getGuardSideForVisualSlot, getOrderedIndices, getRowNumber, getSourceRowIndex } from '@/utils/exportLayout'
import { useStudentAttributes } from './useStudentAttributes'
import { useLogger } from './useLogger'
import { saveBinaryFile } from '@/platform/files'

export const xlsxInstance = shallowRef(null)
const MAX_EXCEL_ROSTER_STUDENTS = 150
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

const getRenderableGuardSeats = (seatConfig, options, layout = {}) => {
  const config = seatConfig.guardSeats || {}
  if (config.enabled === false) return { left: null, right: null }
  const guardSeats = Array.isArray(options.guardSeats) ? options.guardSeats : []
  const hideEmpty = config.hideEmptyOnExport !== false
  const shouldRender = (seat, side) => {
    if (!seat) return false
    if (side === 'left' && config.leftEnabled === false) return false
    if (side === 'right' && config.rightEnabled === false) return false
    return !!seat.studentId || !hideEmpty
  }
  const visualPodiumSide = getEffectivePodiumPosition(seatConfig.podiumPosition, layout.flipVertical)
  const leftSourceSide = getGuardSideForVisualSlot('left', visualPodiumSide)
  const rightSourceSide = getGuardSideForVisualSlot('right', visualPodiumSide)
  const left = guardSeats.find(seat => seat.guardSide === leftSourceSide) || null
  const right = guardSeats.find(seat => seat.guardSide === rightSourceSide) || null
  return {
    left: shouldRender(left, leftSourceSide) ? left : null,
    right: shouldRender(right, rightSourceSide) ? right : null
  }
}

const createExcelLayoutCalculator = (seatConfig, config) => {
  const { layout, numbering } = config
  const { groupCount, columnsPerGroup, seatsPerColumn } = seatConfig

  const groupGapCols = layout.showGroupGap ? 1 : 0
  const hasGuardSeatSlots = layout.showPodium && !!(config.guardSeats?.left || config.guardSeats?.right)
  const seatsPerGroup = columnsPerGroup * seatsPerColumn
  const precomputedGroupLabels = Array.from({ length: groupCount }, (_, i) => formatIndex(i + 1, numbering.groupNumberScheme))
  const seatTableCols = (layout.showRowNumbers ? 1 : 0) + groupCount * columnsPerGroup + (groupCount - 1) * groupGapCols
  const extraGuardSlotCols = hasGuardSeatSlots ? Math.max(0, 3 - seatTableCols) : 0
  const leadingGuardSlotCols = Math.ceil(extraGuardSlotCols / 2)
  const trailingGuardSlotCols = extraGuardSlotCols - leadingGuardSlotCols
  const dataColOffset = leadingGuardSlotCols + (layout.showRowNumbers ? 1 : 0)
  const rowNumberCol = leadingGuardSlotCols
  const groupStartCol = (g) => dataColOffset + g * (columnsPerGroup + groupGapCols)
  const totalCols = leadingGuardSlotCols + seatTableCols + trailingGuardSlotCols
  const guardLeftCol = hasGuardSeatSlots ? 0 : null
  const guardRightCol = hasGuardSeatSlots ? totalCols - 1 : null
  const podiumStartCol = hasGuardSeatSlots ? 1 : 0
  const podiumEndCol = hasGuardSeatSlots ? totalCols - 2 : totalCols - 1
  const titleRowOffset = layout.showTitle ? 1 : 0
  const visualPodiumSide = getEffectivePodiumPosition(seatConfig.podiumPosition, layout.flipVertical)
  const podiumTopOffset = visualPodiumSide === 'top' && layout.showPodium ? 1 : 0
  const groupLabelOffset = layout.showGroupLabels ? 1 : 0
  const headerRowOffset = titleRowOffset + podiumTopOffset + groupLabelOffset
  const podiumRows = layout.showPodium ? 1 : 0
  const totalSeatRows = headerRowOffset + seatsPerColumn + (visualPodiumSide === 'top' ? 0 : podiumRows)

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
    hasGuardSeatSlots,
    guardLeftCol,
    guardRightCol,
    podiumStartCol,
    podiumEndCol,
    rowNumberCol,
    dataColOffset,
    groupStartCol,
    totalCols,
    titleRowOffset,
    podiumTopOffset,
    groupLabelOffset,
    headerRowOffset,
    podiumRows,
    visualPodiumSide,
    totalSeatRows,
    groupGapCols,
    isTopEdge,
    isBottomEdge,
    isLeftEdge,
    isRightEdge
  }
}

const normalizeImportText = (value) => String(value ?? '')
  .trim()
  .replace(/[　]/g, ' ')
  .replace(/\s+/g, '')
  .replace(/[０-９Ａ-Ｚａ-ｚ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
  .toLowerCase()

const isBlankImportValue = (value) => value == null || String(value).trim() === ''

const tagTruthyValues = new Set(['1', '是', '有', '√', '✓', 'true', 'yes', 'y', '对', '勾'])
const tagFalsyValues = new Set(['0', '否', '无', '×', 'x', 'false', 'no', 'n', '不', '没有'])

const isTruthyTagMarker = (value) => tagTruthyValues.has(normalizeImportText(value))
const isFalsyTagMarker = (value) => isBlankImportValue(value) || tagFalsyValues.has(normalizeImportText(value))

const categoricalHeaderKeywords = [
  '性别', '类别', '分类', '类型', '组别', '分组', '小组', '班级', '住宿', '午休', '晚修', '走读'
]

const numericHeaderKeywords = [
  '数值', '属性', '标签数值', '成绩', '分数', '总分', '得分', '评分', '均分', '身高', '体重',
  '年龄', '纪律分', '专注度', '等级', '排名', '名次', '次数', '积分', '分值', 'value', 'score',
  'height', 'weight', 'age', 'rank'
]

const normalizeHeaderForImport = (header) => normalizeImportText(header)
  .replace(/[：:]/g, '')
  .replace(/[（）()\[\]【】\/／_\-－—–]/g, '')

const headerLooksCategorical = (header) => {
  const normalized = normalizeHeaderForImport(header)
  return categoricalHeaderKeywords.some(keyword => normalized.includes(keyword))
}

const headerLooksNumeric = (header) => {
  const normalized = normalizeHeaderForImport(header)
  if (numericHeaderKeywords.some(keyword => normalized.includes(keyword.toLowerCase()))) return true
  return /[（(【\[][^（）()\]】]*(cm|厘米|米|分|kg|公斤|千克|岁|次|名|%)[）)】\]]/i.test(String(header || '')) ||
    /[/／](cm|厘米|米|分|kg|公斤|千克|岁|次|名|%)$/i.test(String(header || '').trim())
}

const getColumnValues = (rows, colIndex) => rows
  .slice(1)
  .map(row => row?.[colIndex])
  .filter(value => !isBlankImportValue(value))

const attributeHeaderPrefixPattern = /^(数值属性|标签数值|数值|属性|numeric|attribute|number|value)(?:\s*[:：_\-－—–/／]\s*|\s+)/i

const looksLikeStudentNumberHeader = (header) => {
  const normalized = normalizeHeaderForImport(header)
  return normalized.includes('学号') || normalized.includes('studentnumber') || normalized === 'id'
}

const looksLikeStudentNameHeader = (header) => {
  const normalized = normalizeHeaderForImport(header)
  return normalized.includes('姓名') || normalized.includes('名字') || normalized === 'name'
}

const normalizeImportedStudentNumber = (value) => {
  if (isBlankImportValue(value)) return null
  const normalized = normalizeImportText(value)
  const numberValue = Number(normalized)
  if (!Number.isFinite(numberValue)) return undefined
  return numberValue
}

const buildDataRows = (rows) => rows
  .slice(1)
  .map((row, index) => ({ row, rowNumber: index + 2 }))
  .filter(({ row }) => Array.isArray(row) && row.some(value => !isBlankImportValue(value)))

const parseAttributeHeaderLabelForImport = (header) => {
  const rawName = String(header || '')
    .replace(attributeHeaderPrefixPattern, '')
    .trim()
  const unitMatch = rawName.match(/^(.+?)[（(]([^（）()]+)[）)]$/) ||
    rawName.match(/^(.+?)[\[【]([^\]】]+)[\]】]$/) ||
    rawName.match(/^(.+?)[/／]([^/／]+)$/)
  if (!unitMatch) {
    return { name: rawName, unit: '' }
  }
  return {
    name: unitMatch[1].trim(),
    unit: unitMatch[2].trim()
  }
}

const buildRowIssue = (severity, message, rowNumber, field = '') => ({
  severity,
  message,
  rowNumber,
  field
})

const hasBlockingImportIssues = (issues) =>
  issues.some(issue => issue.severity === 'error' || issue.severity === 'conflict')

const shouldInferNumericAttributeColumn = (header, rows, colIndex, parseNumericValue) => {
  if (headerLooksCategorical(header)) return false
  const values = getColumnValues(rows, colIndex)
  if (values.length === 0) return false

  const parsedValues = values
    .map(value => parseNumericValue(value, null))
    .filter(value => value !== null)
  const numericRatio = parsedValues.length / values.length
  if (numericRatio < 0.85) return false

  const hasNonBinaryValue = parsedValues.some(value => value !== 0 && value !== 1)
  return hasNonBinaryValue || headerLooksNumeric(header)
}

const getTagNamesForCell = (tagName, cellValue) => {
  if (isTruthyTagMarker(cellValue)) return [tagName]
  if (isFalsyTagMarker(cellValue)) return []
  return [String(cellValue).trim()]
}

export function useExcelData() {
  const saveWorkbook = async (XLSX, wb, filename) => {
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    return await saveBinaryFile(buffer, {
      title: '保存 Excel 文件',
      defaultPath: filename,
      filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
      extension: '.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
  }

  const downloadTemplate = async () => {
    const XLSX = await loadXlsx()
    const templateData = [
      ['学号', '姓名', '身高(cm)', '成绩', '标签数值:纪律分', '性别', '不修', '830', '住宿生', '午休', '周五走'],
      ['1', '示例学生1', '150', '92', '8', '男', '1', '', '', '1', ''],
      ['2', '示例学生2', '158', '86', '9', '女', '', '1', '1', '', ''],
      ['3', '示例学生3', '146', '95', '7', '男', '', '1', '', '1', '']
    ]

    const ws = XLSX.utils.aoa_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '学生名单')

    return await saveWorkbook(XLSX, wb, '学生名单模板.xlsx')
  }

  const buildExcelRosterPreview = async (file, options = {}) => {
    const XLSX = await loadXlsx()
    try {
      const data = file instanceof Uint8Array
        ? file
        : file?.bytes instanceof Uint8Array
          ? file.bytes
          : new Uint8Array(await file.arrayBuffer())
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

      if (!jsonData || jsonData.length < 2) {
        throw new Error('Excel文件格式不正确，至少需要标题行和一行数据')
      }

      const headers = jsonData[0]
      if (!headers || headers.length < 2) {
        throw new Error('Excel文件格式不正确，至少需要学号和姓名列')
      }

      const headerColumns = headers.map((h, index) => ({
        name: h == null ? '' : String(h).trim(),
        colIndex: index
      }))
      const studentNumberColumn = headerColumns.find(header => looksLikeStudentNumberHeader(header.name))
      const nameColumn = headerColumns.find(header => looksLikeStudentNameHeader(header.name))

      if (!studentNumberColumn || !nameColumn) {
        throw new Error('缺少必要字段：学号、姓名。请确保 Excel 第一行包含这些列名。')
      }

      if (studentNumberColumn.colIndex === nameColumn.colIndex) {
        throw new Error('学号和姓名不能使用同一列，请检查表头。')
      }

      const dataRows = buildDataRows(jsonData)
      if (dataRows.length === 0) {
        throw new Error('Excel文件格式不正确，至少需要一行学生数据')
      }

      const invalidRows = []
      const invalidStudentNumberRows = []
      const studentNumberRows = new Map()
      const duplicateStudentNumberRows = new Map()
      const rowIssues = new Map()
      const issues = []

      const addIssue = (issue) => {
        issues.push(issue)
        if (issue.rowNumber) {
          const rowIssueList = rowIssues.get(issue.rowNumber) || []
          rowIssueList.push(issue)
          rowIssues.set(issue.rowNumber, rowIssueList)
        }
      }

      for (const { row, rowNumber } of dataRows) {
        const nameValue = row[nameColumn.colIndex]
        if (!nameValue || String(nameValue).trim() === '') {
          invalidRows.push(rowNumber)
          addIssue(buildRowIssue('error', '姓名为空', rowNumber, 'name'))
        }

        const rawStudentNumber = row[studentNumberColumn.colIndex]
        const studentNumber = normalizeImportedStudentNumber(rawStudentNumber)
        if (studentNumber === undefined) {
          invalidStudentNumberRows.push(rowNumber)
          addIssue(buildRowIssue('error', '学号不是有效数字', rowNumber, 'studentNumber'))
          continue
        }
        if (studentNumber !== null) {
          const key = String(studentNumber)
          if (studentNumberRows.has(key)) {
            const firstRow = studentNumberRows.get(key)
            duplicateStudentNumberRows.set(key, [firstRow, ...(duplicateStudentNumberRows.get(key) || []), rowNumber])
            addIssue(buildRowIssue('conflict', `学号 ${studentNumber} 在导入文件内重复`, rowNumber, 'studentNumber'))
          } else {
            studentNumberRows.set(key, rowNumber)
          }
        }
      }

      duplicateStudentNumberRows.forEach((rows, number) => {
        const firstRow = rows[0]
        if (firstRow) {
          addIssue(buildRowIssue('conflict', `学号 ${number} 在导入文件内重复`, firstRow, 'studentNumber'))
        }
      })

      if (!options.collectIssues) {
        if (invalidRows.length > 0) {
          const rowList = invalidRows.slice(0, 5).join('、')
          const more = invalidRows.length > 5 ? ` 等 ${invalidRows.length} 行` : ''
          throw new Error(`第 ${rowList}${more} 的姓名为空，请检查数据`)
        }

        if (invalidStudentNumberRows.length > 0) {
          const rowList = invalidStudentNumberRows.slice(0, 5).join('、')
          const more = invalidStudentNumberRows.length > 5 ? ` 等 ${invalidStudentNumberRows.length} 行` : ''
          throw new Error(`第 ${rowList}${more} 的学号不是有效数字，请检查数据`)
        }

        if (duplicateStudentNumberRows.size > 0) {
          const duplicateRows = Array.from(duplicateStudentNumberRows.values())
            .map(rows => rows.join('、'))
          const rowList = duplicateRows.slice(0, 5).join('；')
          const more = duplicateRows.length > 5 ? ` 等 ${duplicateRows.length} 组` : ''
          throw new Error(`检测到重复学号，涉及行：${rowList}${more}`)
        }
      }

      const studentCount = dataRows.length
      if (studentCount > MAX_EXCEL_ROSTER_STUDENTS) {
        const warningMessage = `检测到 ${studentCount} 个学生，数量较多可能影响性能`
        if (options.collectIssues) {
          issues.push({ severity: 'warning', message: warningMessage })
        } else {
          return {
            students: [],
            tagNames: [],
            warning: warningMessage
          }
        }
      }

      const { ensureAttributeForHeader, findAttributeByHeader, parseNumericValue } = useStudentAttributes()
      const materializeAttributes = options.materializeAttributes !== false && !hasBlockingImportIssues(issues)

      if (!options.collectIssues && studentCount > MAX_EXCEL_ROSTER_STUDENTS) {
        return {
          students: [],
          tagNames: [],
          warning: `检测到 ${studentCount} 个学生，数量较多可能影响性能`
        }
      }

      const importHeaders = headerColumns
        .filter(header =>
          header.colIndex !== studentNumberColumn.colIndex &&
          header.colIndex !== nameColumn.colIndex &&
          header.name.length > 0
        )

      const attributeCandidates = []
      const tagColumns = []

      importHeaders.forEach(header => {
        const hasAttributePrefix = attributeHeaderPrefixPattern.test(header.name)
        const existingAttribute = findAttributeByHeader(header.name)
        const inferredAttribute = shouldInferNumericAttributeColumn(header.name, jsonData, header.colIndex, parseNumericValue)
        if (existingAttribute || hasAttributePrefix || inferredAttribute) {
          attributeCandidates.push({
            ...header,
            allowImplicit: inferredAttribute && !hasAttributePrefix && !existingAttribute
          })
        } else {
          tagColumns.push(header)
        }
      })

      const validTagIndices = []
      const tagMap = {}
      const allTagNames = new Set()

      tagColumns.forEach(({ name: tagName, colIndex }) => {
        let hasValidData = false

        for (const { row } of dataRows) {
          const cellValue = row[colIndex]
          const cellTagNames = getTagNamesForCell(tagName, cellValue)
          if (cellTagNames.length === 0) continue
          hasValidData = true
          cellTagNames.forEach(name => allTagNames.add(name))
        }

        if (hasValidData) {
          validTagIndices.push(colIndex)
          tagMap[colIndex] = tagName
        }
      })

      if (validTagIndices.length > 20) {
        const warningMessage = `检测到 ${validTagIndices.length} 个标签，数量较多可能影响性能`
        if (options.collectIssues) {
          issues.push({ severity: 'warning', message: warningMessage })
        } else {
          return {
            students: [],
            tagNames: [],
            warning: warningMessage
          }
        }
      }

      const attributeColumns = attributeCandidates
        .map(header => {
          const existingAttribute = findAttributeByHeader(header.name)
          const attribute = materializeAttributes
            ? ensureAttributeForHeader(header.name, { allowImplicit: header.allowImplicit })
            : existingAttribute
          const fallback = parseAttributeHeaderLabelForImport(header.name)
          const key = attribute?.id || `__excel_attr_${header.colIndex}`
          return {
            ...header,
            key,
            attribute: attribute || {
              id: key,
              name: fallback.name,
              unit: fallback.unit,
              min: null,
              max: null,
              precision: 1
            },
            existing: !!existingAttribute
          }
        })
        .filter(Boolean)

      const studentsData = []
      for (const { row, rowNumber } of dataRows) {
        if (!row || row.length < 2) continue

        const studentNumber = normalizeImportedStudentNumber(row[studentNumberColumn.colIndex])
        const name = row[nameColumn.colIndex]

        if (!name || !name.toString().trim()) continue

        const studentTagNames = []
        const numericAttributes = {}

        validTagIndices.forEach(colIndex => {
          const cellValue = row[colIndex]
          studentTagNames.push(...getTagNamesForCell(tagMap[colIndex], cellValue))
        })

        attributeColumns.forEach(({ colIndex, attribute }) => {
          const numericValue = parseNumericValue(row[colIndex], attribute)
          numericAttributes[attribute.id] = numericValue
          if (!isBlankImportValue(row[colIndex]) && numericValue === null) {
            const issue = buildRowIssue('error', `${attribute.name} 不是有效数值`, rowNumber, attribute.id)
            addIssue(issue)
          }
        })

        studentsData.push({
          rowNumber,
          studentNumber,
          name: name.toString().trim(),
          tagNames: studentTagNames,
          numericAttributes,
          issues: rowIssues.get(rowNumber) || []
        })
      }

      return {
        students: studentsData,
        tagNames: Array.from(allTagNames),
        attributes: attributeColumns.map(({ attribute, key, name, colIndex, existing }) => ({
          id: attribute.id,
          key,
          name: attribute.name,
          unit: attribute.unit || '',
          header: name,
          colIndex,
          existing
        })),
        issues,
        hasErrors: hasBlockingImportIssues(issues)
      }
    } catch (error) {
      throw new Error(`解析Excel文件失败: ${error.message}`)
    }
  }

  const previewImportFromExcel = async (file) => buildExcelRosterPreview(file, {
    collectIssues: true,
    materializeAttributes: false
  })

  const importFromExcel = async (file) => {
    const result = await buildExcelRosterPreview(file, {
      collectIssues: false,
      materializeAttributes: true
    })
    if (result.hasErrors) {
      const firstIssue = result.issues?.find(issue => issue.severity === 'error' || issue.severity === 'conflict')
      throw new Error(firstIssue?.message || '导入数据存在错误')
    }
    return result
  }

  const exportToExcel = async (students, tags, numericAttributes = null) => {
    if (!students || students.length === 0) {
      const { warning } = useLogger()
      warning('没有学生数据可导出')
      return
    }

    const XLSX = await loadXlsx()
    const { enabledAttributeDefinitions } = useStudentAttributes()
    const attributeDefinitions = numericAttributes || enabledAttributeDefinitions.value

    const headers = ['学号', '姓名']
    attributeDefinitions.forEach(attribute => {
      headers.push(`数值:${attribute.name}${attribute.unit ? `(${attribute.unit})` : ''}`)
    })
    tags.forEach(tag => {
      headers.push(tag.name)
    })

    const data = [headers]

    students.forEach(student => {
      const row = [
        student.studentNumber || '',
        student.name || ''
      ]

      attributeDefinitions.forEach(attribute => {
        const value = student.numericAttributes?.[attribute.id]
        row.push(value ?? '')
      })

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
    return await saveWorkbook(XLSX, wb, `学生名单_${timestamp}.xlsx`)
  }

  const generateSeatChartWorkbook = async (organizedSeats, students, tags = [], seatConfig, userOptions = {}) => {
    const XLSX = await loadXlsx()

    const legacyConfig = convertLegacyExcelOptions(userOptions)
    const config = mergeExcelConfig(defaultExcelConfig, legacyConfig)
    config.guardSeats = getRenderableGuardSeats(seatConfig, userOptions, config.layout)
    const { layout, sizing, content, numbering } = config

    const studentMap = new Map(students.map(s => [s.id, s]))
    const styleBuilder = createExcelStyleBuilder(config)
    const layoutCalc = createExcelLayoutCalculator(seatConfig, config)

    const { styles, cellEdgeBorder, buildRichText, seatFontRgb } = styleBuilder
    const {
      groupCount, columnsPerGroup, seatsPerColumn, seatsPerGroup,
      precomputedGroupLabels, dataColOffset, groupStartCol, totalCols,
      titleRowOffset, podiumTopOffset, headerRowOffset, totalSeatRows,
      hasGuardSeatSlots, guardLeftCol, guardRightCol, podiumStartCol, podiumEndCol,
      rowNumberCol, visualPodiumSide
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

    const setSeatLikeCell = (r, c, seat, context, borderOverride = null) => {
      if (!seat) {
        setCell(r, c, '', styles.seat, 's', null, borderOverride)
      } else if (seat.isEmpty) {
        setCell(r, c, '空置', styles.empty, 's', null, borderOverride)
      } else if (seat.studentId) {
        const stu = studentMap.get(seat.studentId)
        if (stu) {
          const cellContent = formatCellContent(content.cellFormat, {
            name: stu.name || '未命名',
            studentId: layout.showStudentId ? (stu.studentNumber || '') : '',
            rowLabel: context.rowLabel,
            groupLabel: context.groupLabel,
            serialLabel: context.serialLabel
          })
          const baseFont = { bold: true, sz: sizing.seatFontSize, color: { rgb: seatFontRgb } }
          const richText = buildRichText(cellContent.richParts, baseFont)
          setCell(r, c, cellContent.text, styles.seatName, 's', richText, borderOverride)
        } else {
          setCell(r, c, '', styles.seat, 's', null, borderOverride)
        }
      } else {
        setCell(r, c, '', styles.vacant, 's', null, borderOverride)
      }
    }

    if (layout.showTitle) {
      for (let c = 0; c < totalCols; c++) setCell(0, c, c === 0 ? content.title : '', styles.title, 's', null, edgeBd(0, c))
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } })
    }

    const setPodiumRow = (pRow) => {
      if (hasGuardSeatSlots && config.guardSeats.left) {
        setSeatLikeCell(pRow, guardLeftCol, config.guardSeats.left, {
          rowLabel: '',
          groupLabel: '护法',
          serialLabel: 'L'
        }, edgeBd(pRow, guardLeftCol))
      }
      const podiumStart = podiumStartCol
      const podiumEnd = podiumEndCol
      for (let c = podiumStart; c <= podiumEnd; c++) {
        setCell(pRow, c, c === podiumStart ? '讲台' : '', styles.podium, 's', null, edgeBd(pRow, c))
      }
      if (podiumEnd > podiumStart) {
        merges.push({ s: { r: pRow, c: podiumStart }, e: { r: pRow, c: podiumEnd } })
      }
      if (hasGuardSeatSlots && config.guardSeats.right) {
        setSeatLikeCell(pRow, guardRightCol, config.guardSeats.right, {
          rowLabel: '',
          groupLabel: '护法',
          serialLabel: 'R'
        }, edgeBd(pRow, guardRightCol))
      }
    }

    if (layout.showPodium && visualPodiumSide === 'top') {
      setPodiumRow(titleRowOffset)
    }

    if (layout.showGroupLabels) {
      const hRow = titleRowOffset + podiumTopOffset
      if (layout.showRowNumbers) setCell(hRow, rowNumberCol, '', styles.header, 's', null, edgeBd(hRow, rowNumberCol))
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
      if (layout.showRowNumbers) setCell(eRow, rowNumberCol, `第${rowLabel}排`, styles.rowNum, 's', null, edgeBd(eRow, rowNumberCol))
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
          setSeatLikeCell(eRow, eCol, seat, { rowLabel, groupLabel, serialLabel }, edgeBd(eRow, eCol))
        }
        if (layout.showGroupGap && visualG < groupCount - 1) {
          const gapCol = groupStartCol(visualG) + columnsPerGroup
          setCell(eRow, gapCol, '', {}, 's', null, edgeBd(eRow, gapCol))
        }
      }
    }

    if (layout.showPodium && visualPodiumSide === 'bottom') {
      setPodiumRow(headerRowOffset + seatsPerColumn)
    }

    ws['!cols'] = Array.from({ length: totalCols }, (_, c) => {
      if (hasGuardSeatSlots && (c === guardLeftCol || c === guardRightCol)) return { wch: sizing.cellWidth }
      if (layout.showRowNumbers && c === rowNumberCol) return { wch: 7 }
      const baseC = c - dataColOffset
      if (layout.showGroupGap) {
        if (baseC % (columnsPerGroup + 1) === columnsPerGroup) return { wch: 2 }
      }
      return { wch: sizing.cellWidth }
    })
    ws['!rows'] = Array.from({ length: totalSeatRows }, (_, r) => {
      if (layout.showTitle && r === 0) return { hpt: 28 }
      if (layout.showGroupLabels && r === titleRowOffset + podiumTopOffset) return { hpt: 22 }
      if (visualPodiumSide === 'top' && layout.showPodium && r === titleRowOffset) return { hpt: config.guardSeats.left || config.guardSeats.right ? sizing.seatRowHeight : 22 }
      if (visualPodiumSide === 'bottom' && r === totalSeatRows - 1 && layout.showPodium) return { hpt: config.guardSeats.left || config.guardSeats.right ? sizing.seatRowHeight : 22 }
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
    return await saveWorkbook(XLSX, wb, `座位表_${timestamp}.xlsx`)
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
    previewImportFromExcel,
    exportToExcel,
    generateSeatChartWorkbook,
    exportSeatChartToExcel,
    exportSeatChartToExcelBuffer,
    buildExcelOptionsFromSettings
  }
}
