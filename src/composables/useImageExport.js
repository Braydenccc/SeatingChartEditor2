import { useSeatChart } from './useSeatChart'
import { useStudentData } from './useStudentData'
import { useTagData } from './useTagData'
import { useExportSettings } from './useExportSettings'

export function useImageExport() {
  const { seatConfig, organizedSeats } = useSeatChart()
  const { students } = useStudentData()
  const { tags } = useTagData()
  const { exportSettings } = useExportSettings()

  // 颜色转灰度
  function toGrayscale(hexColor) {
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    return `rgb(${gray}, ${gray}, ${gray})`
  }

  // 计算文字颜色（根据背景亮度自动选黑/白）
  function getContrastColor(hexColor) {
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#ffffff'
  }

  // 灰度转 hex（用于对比度计算）
  function toGrayscaleHex(hexColor) {
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    const grayHex = gray.toString(16).padStart(2, '0')
    return `#${grayHex}${grayHex}${grayHex}`
  }

  // 绘制圆角矩形
  function drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.closePath()
  }

  // 导出为图片，返回 Promise<string> (data URL)
  const exportToImage = () => {
    return new Promise((resolve, reject) => {
      try {
        const isBW = exportSettings.value.colorMode === 'bw' || exportSettings.value.colorMode === 'pureBw'
        const isPureBW = exportSettings.value.colorMode === 'pureBw'

        // 创建canvas
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

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
        const PODIUM_HEIGHT = exportSettings.value.showPodium ? 60 : 0

        // 计算内容尺寸
        const groupWidth = seatConfig.value.columnsPerGroup * SEAT_WIDTH +
          (seatConfig.value.columnsPerGroup - 1) * COL_GAP
        const contentWidth = ROW_NUMBER_WIDTH * 2 +
          seatConfig.value.groupCount * groupWidth +
          (seatConfig.value.groupCount - 1) * GROUP_GAP +
          2 * PADDING
        const contentHeight = TITLE_HEIGHT +
          seatConfig.value.seatsPerColumn * SEAT_HEIGHT +
          (seatConfig.value.seatsPerColumn - 1) * ROW_GAP +
          GROUP_LABEL_HEIGHT +
          PODIUM_HEIGHT +
          2 * PADDING

        // A4 尺寸 (300 DPI): 2480 × 3508
        const A4_SHORT = 2480
        const A4_LONG = 3508
        // 根据内容比例自动选择横/纵向
        const isLandscape = contentWidth / contentHeight > 1
        const canvasWidth = isLandscape ? A4_LONG : A4_SHORT
        const canvasHeight = isLandscape ? A4_SHORT : A4_LONG

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
          ctx.font = 'bold 28px Microsoft YaHei, Arial, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(exportSettings.value.title, contentWidth / 2, PADDING + 20)
        }

        // 座位表起始位置
        const seatStartY = PADDING + TITLE_HEIGHT
        const seatStartX = PADDING + ROW_NUMBER_WIDTH

        // 绘制左右行号
        if (exportSettings.value.showRowNumbers) {
          ctx.fillStyle = primaryColor
          ctx.font = '18px Microsoft YaHei, Arial, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          for (let i = 0; i < seatConfig.value.seatsPerColumn; i++) {
            const rowY = seatStartY + i * (SEAT_HEIGHT + ROW_GAP) + SEAT_HEIGHT / 2
            const rowNumber = seatConfig.value.seatsPerColumn - i

            // 左侧行号
            ctx.fillText(rowNumber.toString(), PADDING + ROW_NUMBER_WIDTH / 2, rowY)

            // 右侧行号
            ctx.fillText(rowNumber.toString(), contentWidth - PADDING - ROW_NUMBER_WIDTH / 2, rowY)
          }
        }

        // 绘制座位
        let currentX = seatStartX
        organizedSeats.value.forEach((group) => {
          let columnX = currentX

          group.forEach((column) => {
            let seatY = seatStartY

            column.forEach((seat) => {
              drawSeat(ctx, columnX, seatY, SEAT_WIDTH, SEAT_HEIGHT, SEAT_RADIUS, seat, isBW, isPureBW, borderColor, emptyBorderColor, vacantBorderColor)
              seatY += SEAT_HEIGHT + ROW_GAP
            })

            columnX += SEAT_WIDTH + COL_GAP
          })

          currentX += groupWidth + GROUP_GAP
        })

        // 绘制组号
        if (exportSettings.value.showGroupLabels) {
          const groupLabelY = seatStartY +
            seatConfig.value.seatsPerColumn * SEAT_HEIGHT +
            (seatConfig.value.seatsPerColumn - 1) * ROW_GAP + 30

          ctx.fillStyle = primaryColor
          ctx.font = 'bold 20px Microsoft YaHei, Arial, sans-serif'
          ctx.textAlign = 'center'

          let groupLabelX = seatStartX
          for (let g = 0; g < seatConfig.value.groupCount; g++) {
            ctx.fillText(`第${g + 1}组`, groupLabelX + groupWidth / 2, groupLabelY)
            groupLabelX += groupWidth + GROUP_GAP
          }
        }

        // 绘制讲台
        if (exportSettings.value.showPodium) {
          const podiumY = contentHeight - PADDING - PODIUM_HEIGHT + 10
          const podiumWidth = SEAT_WIDTH * 4 + COL_GAP * 3
          const podiumX = (contentWidth - podiumWidth) / 2

          ctx.strokeStyle = primaryColor
          ctx.lineWidth = 3
          drawRoundRect(ctx, podiumX, podiumY, podiumWidth, 40, 6)
          ctx.stroke()

          ctx.fillStyle = primaryColor
          ctx.font = 'bold 20px Microsoft YaHei, Arial, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('讲台', podiumX + podiumWidth / 2, podiumY + 20)
        }

        ctx.restore()

        // 转为 data URL
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    })
  }

  // 绘制单个座位
  function drawSeat(ctx, x, y, width, height, radius, seat, isBW, isPureBW, borderColor, emptyBorderColor, vacantBorderColor) {
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
        // 绘制姓名
        ctx.fillStyle = 'black'
        ctx.font = 'bold 24px Microsoft YaHei, Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(student.name || '未命名', x + width / 2, y + height / 2 - 10)

        // 绘制学号
        if (student.studentNumber) {
          ctx.fillStyle = isBW ? '#444' : '#666'
          ctx.font = '16px Microsoft YaHei, Arial, sans-serif'
          ctx.fillText(student.studentNumber.toString(), x + width / 2, y + height / 2 + 18)
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
  function drawTags(ctx, seatX, seatY, seatWidth, _seatHeight, studentTags, isBW, isPureBW) {
    const enabledTags = studentTags
      .map(tagId => {
        const tag = tags.value.find(t => t.id === tagId)
        const setting = exportSettings.value.tagSettings[tagId]
        if (tag && setting && setting.enabled && setting.displayText) {
          return {
            text: setting.displayText,
            color: tag.color
          }
        }
        return null
      })
      .filter(t => t !== null)

    if (enabledTags.length === 0) return

    ctx.save()

    const LABEL_HEIGHT = 24
    const LABEL_PADDING = 8
    const LABEL_GAP = 4
    const OFFSET_X = 8
    const OFFSET_Y = -8

    // 计算每个标签的宽度
    ctx.font = 'bold 14px Microsoft YaHei, Arial, sans-serif'
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
