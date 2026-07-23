import { useSeatChart } from './useSeatChart'
import { useStudentData } from './useStudentData'
import { useTagData } from './useTagData'
import { useExportSettings } from './useExportSettings'
import {
  createOrderedSeatGroups,
  getGuardSideForVisualSlot,
  getCenteredPodiumLayout,
  getEffectivePodiumPosition,
  getExportFlips,
  getImageExportVerticalLayout,
  getVisualRowNumber
} from '@/utils/exportLayout'
import type { Seat } from '@/types/models'

export interface ImageExportOptions {
  resolution?: 'preview' | 'print'
}

export interface ImageSeatTableGeometry {
  groupWidths: number[]
  seatTableWidth: number
  maxRowCount: number
}

export const calculateImageSeatTableGeometry = (
  groupColumnRowCounts: number[][],
  seatWidth: number,
  columnGap: number,
  groupGap: number,
  rowNumberWidth: number
): ImageSeatTableGeometry => {
  const groupWidths = groupColumnRowCounts.map(columns => (
    columns.length * seatWidth + Math.max(0, columns.length - 1) * columnGap
  ))
  const seatContentWidth = groupWidths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, groupWidths.length - 1) * groupGap
  const maxRowCount = groupColumnRowCounts.reduce((maxRows, columns) => (
    Math.max(maxRows, ...columns, 0)
  ), 0)

  return {
    groupWidths,
    seatTableWidth: rowNumberWidth * 2 + seatContentWidth,
    maxRowCount
  }
}

interface LatestImagePreviewRunnerOptions {
  generate: () => Promise<string>
  onLatest: (url: string) => void
  onDiscard: (url: string) => void
  onRunningChange: (running: boolean) => void
  onError: (error: unknown) => void
}

export const createLatestImagePreviewRunner = (options: LatestImagePreviewRunnerOptions) => {
  let requestedVersion = 0
  let completedVersion = 0
  let runningPromise: Promise<void> | null = null
  let disposed = false

  const run = async () => {
    options.onRunningChange(true)
    try {
      while (!disposed && completedVersion < requestedVersion) {
        const generationVersion = requestedVersion
        try {
          const url = await options.generate()
          if (disposed || generationVersion !== requestedVersion) {
            options.onDiscard(url)
          } else {
            options.onLatest(url)
          }
        } catch (error) {
          if (!disposed && generationVersion === requestedVersion) {
            options.onError(error)
          }
        }
        completedVersion = generationVersion
      }
    } finally {
      options.onRunningChange(false)
      runningPromise = null
    }
  }

  return {
    request: () => {
      if (disposed) return Promise.resolve()
      requestedVersion += 1
      if (!runningPromise) runningPromise = run()
      return runningPromise
    },
    dispose: () => {
      disposed = true
      requestedVersion += 1
    }
  }
}

export function useImageExport() {
  const { seatConfig, organizedSeats, visibleGuardSeats } = useSeatChart()
  const { students } = useStudentData()
  const { tags } = useTagData()
  const { exportSettings } = useExportSettings()

  // 颜色转灰度
  function toGrayscale(hexColor: string) {
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    return `rgb(${gray}, ${gray}, ${gray})`
  }

  // 计算文字颜色（根据背景亮度自动选黑/白）
  function getContrastColor(hexColor: string) {
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#ffffff'
  }

  // 灰度转 hex（用于对比度计算）
  function toGrayscaleHex(hexColor: string) {
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    const grayHex = gray.toString(16).padStart(2, '0')
    return `#${grayHex}${grayHex}${grayHex}`
  }

  // 绘制圆角矩形（兼容旧浏览器）
  function drawRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, r)
      ctx.closePath()
    } else {
      // Fallback for browsers without ctx.roundRect support
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
    }
  }

  // 导出为图片，返回 Promise<string> (blob object URL)
  const exportToImage = (options: ImageExportOptions = {}) => {
    return new Promise<string>((resolve, reject) => {
      try {
        const isBW = exportSettings.value.colorMode === 'bw' || exportSettings.value.colorMode === 'pureBw'
        const isPureBW = exportSettings.value.colorMode === 'pureBw'

        // 创建canvas
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          throw new Error('无法获取 Canvas 2D 上下文')
        }

        // 尺寸常量（从设置读取可调节间距）
        const SEAT_WIDTH = 140
        const SEAT_HEIGHT = 100
        const SEAT_RADIUS = 12
        const COL_GAP = exportSettings.value.colGap
        const GROUP_GAP = exportSettings.value.groupGap
        const PADDING = exportSettings.value.padding
        const ROW_GAP = exportSettings.value.rowGap
        const TITLE_HEIGHT = exportSettings.value.showTitle ? 60 : 0
        const ROW_NUMBER_WIDTH = exportSettings.value.showRowNumbers ? 40 : 0
        const GROUP_LABEL_HEIGHT = exportSettings.value.showGroupLabels ? 50 : 0
        const flips = getExportFlips(exportSettings.value)
        const visualPodiumSide = getEffectivePodiumPosition(seatConfig.value.podiumPosition, flips.flipVertical)
        const isPodiumTop = visualPodiumSide === 'top'
        const guardConfig = seatConfig.value.guardSeats
        const hideEmptyGuardSeats = guardConfig?.hideEmptyOnExport !== false
        const shouldDrawGuardSeats = exportSettings.value.showPodium && guardConfig?.enabled !== false
        const leftGuardSide = getGuardSideForVisualSlot('left', visualPodiumSide)
        const rightGuardSide = getGuardSideForVisualSlot('right', visualPodiumSide)
        const guardSeatLeft = shouldDrawGuardSeats
          ? visibleGuardSeats.value.find(seat => seat.guardSide === leftGuardSide && (seat.studentId || !hideEmptyGuardSeats))
          : null
        const guardSeatRight = shouldDrawGuardSeats
          ? visibleGuardSeats.value.find(seat => seat.guardSide === rightGuardSide && (seat.studentId || !hideEmptyGuardSeats))
          : null
        const hasGuardSeatInExport = !!guardSeatLeft || !!guardSeatRight
        const PODIUM_HEIGHT = exportSettings.value.showPodium ? (hasGuardSeatInExport ? SEAT_HEIGHT : 60) : 0

        // 计算内容尺寸。使用 organizedSeats 的真实列数和行数，兼容每组异构配置。
        const renderedGroups = createOrderedSeatGroups(organizedSeats.value, flips)
        const tableGeometry = calculateImageSeatTableGeometry(
          renderedGroups.map(group => group.columns.map(column => column.seats.length)),
          SEAT_WIDTH,
          COL_GAP,
          GROUP_GAP,
          ROW_NUMBER_WIDTH
        )
        const { groupWidths, seatTableWidth, maxRowCount } = tableGeometry
        const podiumWidth = SEAT_WIDTH * 4 + COL_GAP * 3
        const podiumLayout = getCenteredPodiumLayout({
          seatTableWidth,
          podiumWidth: exportSettings.value.showPodium ? podiumWidth : 0,
          sideSeatWidth: SEAT_WIDTH,
          gap: COL_GAP,
          hasLeftSideSeat: !!guardSeatLeft,
          hasRightSideSeat: !!guardSeatRight
        })
        const innerContentWidth = podiumLayout.innerContentWidth
        const contentWidth = innerContentWidth + 2 * PADDING
        const verticalLayout = getImageExportVerticalLayout({
          titleHeight: TITLE_HEIGHT,
          seatRowCount: maxRowCount,
          seatHeight: SEAT_HEIGHT,
          rowGap: ROW_GAP,
          groupLabelHeight: GROUP_LABEL_HEIGHT,
          podiumHeight: PODIUM_HEIGHT,
          padding: PADDING,
          showPodium: exportSettings.value.showPodium,
          showGroupLabels: exportSettings.value.showGroupLabels,
          isPodiumTop,
          areGroupLabelsAboveSeats: flips.flipVertical
        })
        const contentHeight = verticalLayout.contentHeight

        // 下载保持 A4 300 DPI；预览使用 150 DPI，显著降低 Canvas 与编码内存。
        const resolutionScale = options.resolution === 'preview' ? 0.5 : 1
        const A4_SHORT = 2480
        const A4_LONG = 3508
        // 根据内容比例自动选择横/纵向
        const isLandscape = contentWidth / contentHeight > 1
        const canvasWidth = Math.round((isLandscape ? A4_LONG : A4_SHORT) * resolutionScale)
        const canvasHeight = Math.round((isLandscape ? A4_SHORT : A4_LONG) * resolutionScale)

        // 内存安全：最大 64MB（每像素 4 字节），需在分配 canvas 前检查
        const MAX_CANVAS_PIXELS = 64 * 1024 * 1024 / 4
        if (canvasWidth * canvasHeight > MAX_CANVAS_PIXELS) {
          throw new Error(`Canvas 尺寸过大（${canvasWidth}×${canvasHeight}），可能导致内存溢出`)
        }

        canvas.width = canvasWidth
        canvas.height = canvasHeight

        // 白色背景
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)

        // 计算缩放使内容适配 A4（留 5% 页边距）
        const A4_MARGIN = 0.05
        const availW = canvasWidth * (1 - 2 * A4_MARGIN)
        const availH = canvasHeight * (1 - 2 * A4_MARGIN)
        const fitScale = Math.min(availW / contentWidth, availH / contentHeight)

        // 居中偏移
        const offsetX = (canvasWidth - contentWidth * fitScale) / 2
        const offsetY = (canvasHeight - contentHeight * fitScale) / 2

        ctx.save()
        ctx.translate(offsetX, offsetY)
        ctx.scale(fitScale, fitScale)

        // 颜色变量
        const primaryColor = isBW ? '#333333' : '#23587b'
        const borderColor = isBW ? '#666666' : '#23587b'
        const emptyBorderColor = isBW ? '#999999' : '#ddd'
        const vacantBorderColor = isBW ? '#888888' : '#bbb'

        // 绘制标题
        if (exportSettings.value.showTitle) {
          ctx.fillStyle = 'black'
          ctx.font = `bold ${exportSettings.value.fontSizeTitle}px Microsoft YaHei, Arial, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(exportSettings.value.title, contentWidth / 2, PADDING + 20)
        }

        // 座位表起始位置
        const seatStartY = verticalLayout.seatStartY
        const tableLeft = PADDING + podiumLayout.seatTableLeft
        const seatStartX = tableLeft + ROW_NUMBER_WIDTH

        // 绘制左右行号
        if (exportSettings.value.showRowNumbers) {
          ctx.fillStyle = primaryColor
          ctx.font = `${exportSettings.value.fontSizeRowNumber}px Microsoft YaHei, Arial, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          for (let i = 0; i < maxRowCount; i++) {
            const rowY = seatStartY + i * (SEAT_HEIGHT + ROW_GAP) + SEAT_HEIGHT / 2
            const rowNumber = getVisualRowNumber(
              i,
              maxRowCount,
              seatConfig.value.podiumPosition,
              flips.flipVertical
            )

            // 左侧行号
            ctx.fillText(rowNumber.toString(), tableLeft + ROW_NUMBER_WIDTH / 2, rowY)

            // 右侧行号
            ctx.fillText(rowNumber.toString(), tableLeft + seatTableWidth - ROW_NUMBER_WIDTH / 2, rowY)
          }
        }

        // 绘制座位
        let currentX = seatStartX
        renderedGroups.forEach((group, groupIndex) => {
          let columnX = currentX

          group.columns.forEach((column) => {
            let seatY = seatStartY

            column.seats.forEach((seat) => {
              drawSeat(ctx, columnX, seatY, SEAT_WIDTH, SEAT_HEIGHT, SEAT_RADIUS, seat, isBW, isPureBW, borderColor, emptyBorderColor, vacantBorderColor)
              seatY += SEAT_HEIGHT + ROW_GAP
            })

            columnX += SEAT_WIDTH + COL_GAP
          })

          currentX += (groupWidths[groupIndex] || 0) + GROUP_GAP
        })

        // 绘制组号（翻转时组号在顶部座位上方，正序时在底部下方）
        if (exportSettings.value.showGroupLabels) {
          const groupLabelY = flips.flipVertical
            ? seatStartY - 20  // 翻转：组号在座位最上方
            : seatStartY + maxRowCount * SEAT_HEIGHT + Math.max(0, maxRowCount - 1) * ROW_GAP + 30

          ctx.fillStyle = primaryColor
          ctx.font = `bold ${exportSettings.value.fontSizeGroupLabel}px Microsoft YaHei, Arial, sans-serif`
          ctx.textAlign = 'center'

          let groupLabelX = seatStartX
          renderedGroups.forEach((group, groupIndex) => {
            const groupWidth = groupWidths[groupIndex] || 0
            ctx.fillText(`第${group.groupIndex + 1}组`, groupLabelX + groupWidth / 2, groupLabelY)
            groupLabelX += groupWidth + GROUP_GAP
          })
        }

        // 绘制讲台（翻转时讲台在顶部，正序时在底部）
        if (exportSettings.value.showPodium && verticalLayout.podiumRowY !== null) {
          const podiumRowY = verticalLayout.podiumRowY
          const podiumBlockHeight = 40
          const guardY = podiumRowY + (PODIUM_HEIGHT - SEAT_HEIGHT) / 2
          const podiumY = podiumRowY + (PODIUM_HEIGHT - podiumBlockHeight) / 2
          const podiumX = PADDING + podiumLayout.podiumLeft

          if (guardSeatLeft && podiumLayout.leftSideSeatLeft !== null) {
            drawSeat(
              ctx,
              PADDING + podiumLayout.leftSideSeatLeft,
              guardY,
              SEAT_WIDTH,
              SEAT_HEIGHT,
              SEAT_RADIUS,
              guardSeatLeft,
              isBW,
              isPureBW,
              borderColor,
              emptyBorderColor,
              vacantBorderColor
            )
          }

          ctx.strokeStyle = primaryColor
          ctx.lineWidth = 3
          drawRoundRect(ctx, podiumX, podiumY, podiumWidth, podiumBlockHeight, 6)
          ctx.stroke()

          ctx.fillStyle = primaryColor
          ctx.font = `bold ${exportSettings.value.fontSizePodium}px Microsoft YaHei, Arial, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('讲台', podiumX + podiumWidth / 2, podiumY + podiumBlockHeight / 2)

          if (guardSeatRight && podiumLayout.rightSideSeatLeft !== null) {
            drawSeat(
              ctx,
              PADDING + podiumLayout.rightSideSeatLeft,
              guardY,
              SEAT_WIDTH,
              SEAT_HEIGHT,
              SEAT_RADIUS,
              guardSeatRight,
              isBW,
              isPureBW,
              borderColor,
              emptyBorderColor,
              vacantBorderColor
            )
          }
        }

        ctx.restore()

        // 转为 Blob URL（避免 base64）
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('图片导出失败：无法生成 Blob'))
            return
          }
          resolve(URL.createObjectURL(blob))
        }, 'image/png')
      } catch (err) {
        reject(err)
      }
    })
  }

  // 绘制单个座位
  function drawSeat(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    seat: Seat,
    isBW: boolean,
    isPureBW: boolean,
    borderColor: string,
    emptyBorderColor: string,
    vacantBorderColor: string
  ) {
    ctx.save()

    if (seat.isEmpty) {
      // 空置座位 — 虚线边框，无文字
      ctx.fillStyle = 'white'
      drawRoundRect(ctx, x, y, width, height, radius)
      ctx.fill()

      ctx.setLineDash([8, 4])
      ctx.strokeStyle = vacantBorderColor
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.setLineDash([])
    } else if (seat.studentId) {
      // 有学生 — 白色背景 + 实线边框
      ctx.fillStyle = 'white'
      drawRoundRect(ctx, x, y, width, height, radius)
      ctx.fill()

      ctx.strokeStyle = borderColor
      ctx.lineWidth = 3
      ctx.stroke()

      const student = students.value.find(s => s.id === seat.studentId)
      if (student) {
        // 绘制姓名和学号，垂直居中分布，叠加用户自定义 Y 偏移
        const studentNumber = student.studentNumber
        const nameFontSize = exportSettings.value.fontSizeName
        const idFontSize = exportSettings.value.fontSizeStudentId
        const offsetYName = exportSettings.value.offsetYName || 0
        const offsetYStudentId = exportSettings.value.offsetYStudentId || 0
        const cx = x + width / 2
        const cy = y + height / 2

        if (studentNumber) {
          // 两行文本：上方姓名，下方学号，以座位中心为基准均匀分布
          const gap = Math.round((nameFontSize + idFontSize) / 2) + 4
          const nameY = cy - gap / 2 + offsetYName
          const idY = cy + gap / 2 + offsetYStudentId

          ctx.fillStyle = 'black'
          ctx.font = `bold ${nameFontSize}px Microsoft YaHei, Arial, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(student.name || '未命名', cx, nameY)

          ctx.fillStyle = isBW ? '#444' : '#666'
          ctx.font = `${idFontSize}px Microsoft YaHei, Arial, sans-serif`
          ctx.fillText(studentNumber.toString(), cx, idY)
        } else {
          // 只有姓名，垂直居中
          ctx.fillStyle = 'black'
          ctx.font = `bold ${nameFontSize}px Microsoft YaHei, Arial, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(student.name || '未命名', cx, cy + offsetYName)
        }

        // 绘制标签
        if (exportSettings.value.enableTagLabels && student.tags && student.tags.length > 0) {
          drawTags(ctx, x, y, width, height, student.tags, isBW, isPureBW)
        }
      }
    } else {
      // 空位 — 浅色边框，无文字
      ctx.fillStyle = 'white'
      drawRoundRect(ctx, x, y, width, height, radius)
      ctx.fill()

      ctx.strokeStyle = emptyBorderColor
      ctx.lineWidth = 2
      ctx.stroke()
    }

    ctx.restore()
  }

  // 绘制标签
  function drawTags(
    ctx: CanvasRenderingContext2D,
    seatX: number,
    seatY: number,
    seatWidth: number,
    _seatHeight: number,
    studentTags: number[],
    isBW: boolean,
    isPureBW: boolean
  ) {
    const enabledTags = studentTags
      .map(tagId => {
        const tag = tags.value.find(t => t.id === tagId)
        const setting = exportSettings.value.tagSettings[tagId]
        if (tag && setting && setting.enabled && setting.displayText) {
          return {
            id: tag.id,
            text: setting.displayText,
            color: tag.color
          }
        }
        return null
      })
      .filter(t => t !== null)
      .sort((a, b) => a.id - b.id)

    if (enabledTags.length === 0) return

    ctx.save()

    const LABEL_HEIGHT = exportSettings.value.fontSizeTag + 10  // 字号 + 上下各5px内边距
    const LABEL_PADDING = 8
    const LABEL_GAP = 4
    const OFFSET_X = 8
    const OFFSET_Y = -8

    // 计算每个标签的宽度
    ctx.font = `bold ${exportSettings.value.fontSizeTag}px Microsoft YaHei, Arial, sans-serif`
    const labelWidths = enabledTags.map(tag => {
      const textWidth = ctx.measureText(tag.text).width
      return textWidth + LABEL_PADDING * 2
    })

    // 计算总宽度和起始位置
    const totalWidth = labelWidths.reduce((sum, w) => sum + w, 0) +
      LABEL_GAP * (enabledTags.length - 1)
    let currentX = seatX + seatWidth - totalWidth + OFFSET_X

    // 绘制所有标签
    enabledTags.forEach((tag, index) => {
      const labelWidth = labelWidths[index]
      if (labelWidth === undefined) return
      const labelX = currentX
      const labelY = seatY + OFFSET_Y

      // 背景颜色
      const bgColor = isPureBW ? 'white' : (isBW ? toGrayscale(tag.color) : tag.color)

      // 绘制标签背景（圆角矩形）
      ctx.fillStyle = bgColor
      ctx.beginPath()
      ctx.roundRect(labelX, labelY, labelWidth, LABEL_HEIGHT, 4)
      ctx.fill()

      // 绘制边框
      ctx.strokeStyle = isBW ? '#333' : 'black'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // 绘制文字
      if (isPureBW) {
        ctx.fillStyle = 'black'
      } else if (isBW) {
        ctx.fillStyle = getContrastColor(toGrayscaleHex(tag.color))
      } else {
        ctx.fillStyle = getContrastColor(tag.color)
      }
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(tag.text, labelX + labelWidth / 2, labelY + LABEL_HEIGHT / 2)

      currentX += labelWidth + LABEL_GAP
    })

    ctx.restore()
  }

  return {
    exportToImage
  }
}
