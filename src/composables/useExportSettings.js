import { ref } from 'vue'

// 导出设置
const exportSettings = ref({
  title: '班级座位表',
  showTitle: true,
  showRowNumbers: true,
  showGroupLabels: true,
  showPodium: true,
  reverseOrder: false,       // 翻转行序（讲台置顶）
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
  excelReverseOrder: false,      // 翻转行序（讲台置顶）
  excelShowGroupGap: true,       // 保留组间空列
  excelColorMode: 'color',       // 'color' | 'bw'
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
  tagSettings: {}, // 格式: { tagId: { enabled: true, displayText: '文本' } }
  webdavExportDir: '' // 云端导出的自定义路径, 为空表示跟目录或系统默认
})

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

  return {
    exportSettings,
    updateTitle,
    toggleTitleDisplay,
    toggleRowNumbers,
    toggleGroupLabels,
    togglePodium,
    toggleTagLabels,
    toggleColorMode,
    updateTagSetting,
    initializeTagSettings
  }
}
