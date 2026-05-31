import { ref } from 'vue'

// 默认导出设置
const DEFAULT_EXPORT_SETTINGS = {
  title: '班级座位表',
  showTitle: true,
  showRowNumbers: true,
  showGroupLabels: true,
  showPodium: true,
  flipHorizontal: false,     // 左右翻转导出视图
  flipVertical: false,       // 上下翻转导出视图
  reverseOrder: false,       // 旧字段：等价于 flipVertical
  enableTagLabels: true,
  colorMode: 'color', // 'color' | 'bw' | 'pureBw'
  // 间距设置
  colGap: 20,      // 列间距
  rowGap: 15,      // 行间距
  groupGap: 60,    // 大组间距
  padding: 40,     // 边距
  // 字号设置
  fontSizeTitle: 28,       // 标题
  fontSizeRowNumber: 18,   // 行号
  fontSizeGroupLabel: 20,  // 组号
  fontSizePodium: 20,      // 讲台
  fontSizeName: 28,        // 姓名（调高）
  fontSizeStudentId: 20,   // 学号（调高）
  fontSizeTag: 14,         // 标签
  // Y轴偏移（额外微调，在自动居中的基础上叠加）
  offsetYName: 0,          // 姓名 Y 偏移
  offsetYStudentId: 0,     // 学号 Y 偏移
  // Excel 导出选项
  excelShowStudentId: true,      // 格子内显示学号
  excelShowRowNumbers: true,     // 显示行号列
  excelShowGroupLabels: true,    // 显示组号行
  excelShowTitle: true,          // 顶部标题行
  excelShowPodium: true,         // 讲台行
  excelFlipHorizontal: false,    // 左右翻转 Excel 视图
  excelFlipVertical: false,      // 上下翻转 Excel 视图
  excelReverseOrder: false,      // 旧字段：等价于 excelFlipVertical
  excelShowGroupGap: true,       // 保留组间空列
  excelColorMode: 'color',       // 'color' | 'bw'
  excelShowBorders: true,        // 显示边框
  excelBorderStyle: 'thin',      // 边框样式: 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted'
  excelBorderColor: '#000000',   // Excel 边框颜色
  excelCellFormat: '%n\n%i',     // 单元格内容模板：%n姓名 %i学号 %r行号 %g组号 %s序号 %j序号 %%百分号
  excelRowNumberScheme: 'arabic',    // 行号编号方案
  excelGroupNumberScheme: 'arabic',  // 组号编号方案
  excelSerialNumberScheme: 'arabic', // 序号编号方案
  excelNameFontSize: 12,         // 姓名字号 (pt)
  excelIdFontSize: 10,           // 学号字号 (pt)
  excelCellWidth: 10,            // 座位列宽 (wch)
  excelSeatRowHeight: 40,        // 座位行高 (hpt)
  excelShowTagTable: false,      // 导出标签统计表
  excelTagTableNewSheet: false,  // 标签表放在独立工作表
  // 新增：内边框和外边框独立样式
  excelInnerBorderStyle: 'thin',  // 内边框样式
  excelInnerBorderColor: '#000000', // 内边框颜色
  excelOuterBorderStyle: 'medium',  // 外边框样式
  excelOuterBorderColor: '#000000', // 外边框颜色
  // 新增：标题字体样式
  excelTitleFontBold: true,      // 标题粗体
  excelTitleFontItalic: false,   // 标题斜体
  excelTitleFontColor: '#000000', // 标题颜色
  excelTitleFontSize: 16,        // 标题字号 (pt)
  // 新增：表头字体样式
  excelHeaderFontBold: true,      // 表头粗体
  excelHeaderFontItalic: false,   // 表头斜体
  excelHeaderFontColor: '#000000', // 表头颜色
  excelHeaderFontSize: 11,        // 表头字号 (pt)
  // 新增：座位单元格字体样式
  excelSeatCellFontBold: false,    // 座位单元格粗体
  excelSeatCellFontItalic: false,   // 座位单元格斜体
  excelSeatCellFontColor: '#000000', // 座位单元格颜色
  // 新增：各模块背景颜色（默认无填充）
  excelTitleFillColor: '',
  excelHeaderFillColor: '',
  excelRowNumFillColor: '',
  excelPodiumFillColor: '',
  excelSeatFillColor: '',
  excelEmptyFillColor: '',
  excelVacantFillColor: '',
  excelTagHeaderFillColor: '',
  tagSettings: {}, // 格式: { tagId: { enabled: true, displayText: '文本' } }
  webdavExportDir: '' // 云端导出的自定义路径, 为空表示跟目录或系统默认
}

const deepClone = (value) => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }
  // JSON fallback: 仅适用于纯 JSON 兼容数据（不支持 undefined/Date/Symbol/函数/循环引用）
  // DEFAULT_EXPORT_SETTINGS 必须只包含 JSON 兼容类型，否则 fallback 会丢失数据
  return JSON.parse(JSON.stringify(value))
}

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

export const normalizeExportSettings = (settings = {}) => {
  const merged = { ...deepClone(DEFAULT_EXPORT_SETTINGS), ...settings }

  if (!hasOwn(settings, 'flipVertical') && hasOwn(settings, 'reverseOrder')) {
    merged.flipVertical = !!settings.reverseOrder
  }
  if (!hasOwn(settings, 'excelFlipVertical') && hasOwn(settings, 'excelReverseOrder')) {
    merged.excelFlipVertical = !!settings.excelReverseOrder
  }

  merged.flipHorizontal = !!merged.flipHorizontal
  merged.flipVertical = !!merged.flipVertical
  merged.excelFlipHorizontal = !!merged.excelFlipHorizontal
  merged.excelFlipVertical = !!merged.excelFlipVertical
  merged.reverseOrder = merged.flipVertical
  merged.excelReverseOrder = merged.excelFlipVertical

  return merged
}

// 导出设置
const exportSettings = ref(normalizeExportSettings())

export function useExportSettings() {
  // 更新标题
  const updateTitle = (title) => {
    exportSettings.value.title = title
  }

  // 切换标题显示
  const toggleTitleDisplay = (enabled) => {
    exportSettings.value.showTitle = enabled
  }

  // 切换行号显示
  const toggleRowNumbers = (enabled) => {
    exportSettings.value.showRowNumbers = enabled
  }

  // 切换组号显示
  const toggleGroupLabels = (enabled) => {
    exportSettings.value.showGroupLabels = enabled
  }

  // 切换讲台显示
  const togglePodium = (enabled) => {
    exportSettings.value.showPodium = enabled
  }

  const setImageFlipHorizontal = (enabled) => {
    exportSettings.value.flipHorizontal = !!enabled
  }

  const setImageFlipVertical = (enabled) => {
    exportSettings.value.flipVertical = !!enabled
    exportSettings.value.reverseOrder = !!enabled
  }

  const setExcelFlipHorizontal = (enabled) => {
    exportSettings.value.excelFlipHorizontal = !!enabled
  }

  const setExcelFlipVertical = (enabled) => {
    exportSettings.value.excelFlipVertical = !!enabled
    exportSettings.value.excelReverseOrder = !!enabled
  }

  // 切换标签显示
  const toggleTagLabels = (enabled) => {
    exportSettings.value.enableTagLabels = enabled
  }

  // 切换黑白/彩色模式
  const toggleColorMode = (mode) => {
    exportSettings.value.colorMode = mode
  }

  // 更新单个标签设置
  const updateTagSetting = (tagId, setting) => {
    exportSettings.value.tagSettings[tagId] = setting
  }

  // 初始化标签设置
  const initializeTagSettings = (tags) => {
    tags.forEach(tag => {
      if (!exportSettings.value.tagSettings[tag.id]) {
        exportSettings.value.tagSettings[tag.id] = {
          enabled: true,
          displayText: tag.name.substring(0, 2) // 默认取前两个字
        }
      }
    })
  }

  const applyExportSettings = (settings) => {
    const normalized = normalizeExportSettings(settings || {})
    normalized.tagSettings = {
      ...(exportSettings.value.tagSettings || {}),
      ...(normalized.tagSettings || {})
    }
    exportSettings.value = normalized
  }

  // 重置导出设置为默认值（工作区切换时调用）
  const resetExportSettings = () => {
    exportSettings.value = normalizeExportSettings()
  }

  return {
    exportSettings,
    updateTitle,
    toggleTitleDisplay,
    toggleRowNumbers,
    toggleGroupLabels,
    togglePodium,
    setImageFlipHorizontal,
    setImageFlipVertical,
    setExcelFlipHorizontal,
    setExcelFlipVertical,
    toggleTagLabels,
    toggleColorMode,
    updateTagSetting,
    initializeTagSettings,
    applyExportSettings,
    resetExportSettings
  }
}
