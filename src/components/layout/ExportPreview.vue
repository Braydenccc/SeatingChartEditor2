<template>
  <Teleport to="body">
    <div v-if="visible" class="export-overlay"
      @mousedown.self="overlayMouseDownSelf = true"
      @mouseup.self="handleOverlayMouseUp">
      <div class="export-dialog">

        <!-- ── 标题栏 ── -->
        <div class="dialog-header">
          <h3>导出设置</h3>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>

        <!-- ── Tab 栏 ── -->
        <div class="tab-bar">
          <button :class="['tab-btn', { active: activeTab === 'image' }]" @click="activeTab = 'image'">
            图片导出
          </button>
          <button :class="['tab-btn', { active: activeTab === 'excel' }]" @click="activeTab = 'excel'">
            Excel 导出
          </button>
        </div>

        <!-- ── 主体 ── -->
        <div class="dialog-body">

          <!-- 设置面板 -->
          <div class="settings-panel">

            <!-- ======== 图片设置 ======== -->
            <template v-if="activeTab === 'image'">
              <div class="settings-section">
                <h4>基础设置</h4>
                <div class="setting-row">
                  <label>标题:</label>
                  <input v-model="exportSettings.title" type="text" placeholder="班级座位表" />
                </div>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.showTitle" /><span>显示标题</span></label>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.showRowNumbers" /><span>显示行号</span></label>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.showGroupLabels" /><span>显示组号</span></label>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.showPodium" /><span>显示讲台</span></label>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.reverseOrder" /><span>翻转行序（讲台置顶）</span></label>
                <div class="mode-row">
                  <span class="mode-label">模式:</span>
                  <label class="radio-item"><input type="radio" value="color" v-model="exportSettings.colorMode" /><span>彩色</span></label>
                  <label class="radio-item"><input type="radio" value="bw" v-model="exportSettings.colorMode" /><span>灰度</span></label>
                  <label class="radio-item"><input type="radio" value="pureBw" v-model="exportSettings.colorMode" /><span>黑白</span></label>
                </div>
              </div>

              <div class="settings-section">
                <h4>间距</h4>
                <div class="spacing-grid">
                  <div class="num-input"><label>列间距</label><input type="number" v-model.number="exportSettings.colGap" min="0" max="100" /></div>
                  <div class="num-input"><label>行间距</label><input type="number" v-model.number="exportSettings.rowGap" min="0" max="100" /></div>
                  <div class="num-input"><label>组间距</label><input type="number" v-model.number="exportSettings.groupGap" min="0" max="200" /></div>
                  <div class="num-input"><label>边距</label><input type="number" v-model.number="exportSettings.padding" min="0" max="100" /></div>
                </div>
              </div>

              <div class="settings-section">
                <h4>标签</h4>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.enableTagLabels" /><span>启用标签</span></label>
                <div v-if="exportSettings.enableTagLabels && tags.length > 0" class="tag-list">
                  <div v-for="tag in tags" :key="tag.id" class="tag-row">
                    <label class="check-item" v-if="tagSettingsLocal[tag.id]">
                      <input type="checkbox" v-model="tagSettingsLocal[tag.id].enabled" @change="syncTagSettings" />
                      <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
                      <span>{{ tag.name }}</span>
                    </label>
                    <input v-if="tagSettingsLocal[tag.id] && tagSettingsLocal[tag.id].enabled"
                      type="text" v-model="tagSettingsLocal[tag.id].displayText"
                      @input="syncTagSettings" class="tag-input"
                      placeholder="显示文本" maxlength="4" />
                  </div>
                </div>
              </div>

              <div class="settings-section">
                <h4>字号</h4>
                <div class="spacing-grid">
                  <div class="num-input"><label>姓名</label><input type="number" v-model.number="exportSettings.fontSizeName" min="8" max="60" /></div>
                  <div class="num-input"><label>学号</label><input type="number" v-model.number="exportSettings.fontSizeStudentId" min="8" max="60" /></div>
                  <div class="num-input"><label>标题</label><input type="number" v-model.number="exportSettings.fontSizeTitle" min="8" max="80" /></div>
                  <div class="num-input"><label>行号</label><input type="number" v-model.number="exportSettings.fontSizeRowNumber" min="8" max="40" /></div>
                  <div class="num-input"><label>组号</label><input type="number" v-model.number="exportSettings.fontSizeGroupLabel" min="8" max="40" /></div>
                  <div class="num-input"><label>讲台</label><input type="number" v-model.number="exportSettings.fontSizePodium" min="8" max="40" /></div>
                  <div class="num-input"><label>标签</label><input type="number" v-model.number="exportSettings.fontSizeTag" min="8" max="30" /></div>
                </div>
              </div>

              <div class="settings-section">
                <h4>位置微调</h4>
                <div class="spacing-grid">
                  <div class="num-input"><label>姓名 Y 偏移</label><input type="number" v-model.number="exportSettings.offsetYName" min="-100" max="100" /></div>
                  <div class="num-input"><label>学号 Y 偏移</label><input type="number" v-model.number="exportSettings.offsetYStudentId" min="-100" max="100" /></div>
                </div>
              </div>
            </template>

            <!-- ======== WebDAV 导出设置 ======== -->
            <div class="settings-section" v-if="authType === 'webdav'">
              <h4>云端保存</h4>
              <div class="setting-row">
                <label>保存路径(网盘):</label>
                <input v-model="exportSettings.webdavExportDir" type="text" placeholder="/sce_data" title="为空则默认使用 /sce_data" />
              </div>
            </div>

            <!-- ======== Excel 设置 ======== -->
            <template v-if="activeTab === 'excel'">
              <div class="settings-section">
                <h4>内容</h4>
                <div class="setting-row">
                  <label>标题文字:</label>
                  <input v-model="exportSettings.title" type="text" placeholder="班级座位表" />
                </div>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.excelShowTitle" /><span>显示标题行</span></label>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.excelShowGroupLabels" /><span>显示组号行</span></label>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.excelShowRowNumbers" /><span>显示行号列</span></label>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.excelShowStudentId" /><span>格子内显示学号</span></label>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.excelShowPodium" /><span>显示讲台行</span></label>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.excelReverseOrder" /><span>翻转行序（讲台置顶）</span></label>
                <label class="check-item"><input type="checkbox" v-model="exportSettings.excelShowGroupGap" /><span>保留大组间空列</span></label>
              </div>

              <div class="settings-section">
                <h4>外观</h4>
                <div class="mode-row">
                  <span class="mode-label">配色:</span>
                  <label class="radio-item"><input type="radio" value="color" v-model="exportSettings.excelColorMode" /><span>彩色</span></label>
                  <label class="radio-item"><input type="radio" value="bw" v-model="exportSettings.excelColorMode" /><span>单色</span></label>
                </div>
                <div class="setting-row" style="margin-top:6px">
                  <label>边框颜色:</label>
                  <input v-model="exportSettings.excelBorderColor" type="color" />
                </div>
                <div class="spacing-grid" style="margin-top:8px">
                  <div class="num-input"><label>姓名字号(pt)</label><input type="number" v-model.number="exportSettings.excelNameFontSize" min="8" max="24" /></div>
                  <div class="num-input"><label>学号字号(pt)</label><input type="number" v-model.number="exportSettings.excelIdFontSize" min="6" max="18" /></div>
                  <div class="num-input"><label>列宽(字符)</label><input type="number" v-model.number="exportSettings.excelCellWidth" min="6" max="30" /></div>
                  <div class="num-input"><label>行高(点)</label><input type="number" v-model.number="exportSettings.excelSeatRowHeight" min="20" max="100" /></div>
                </div>
              </div>

              <div class="settings-section">
                <h4>格式化</h4>
                <div class="setting-row">
                  <label>单元格内容模板:</label>
                  <textarea
                    v-model="exportSettings.excelCellFormat"
                    rows="3"
                    class="format-textarea"
                    placeholder="%n&#10;%i"
                  ></textarea>
                  <div class="format-hint">支持占位符：%n 姓名，%i 学号，%r 行号，%g 组号，%s/%j 序号，%% 百分号</div>
                </div>
                <div class="spacing-grid">
                  <div class="num-input">
                    <label>行号方案</label>
                    <select v-model="exportSettings.excelRowNumberScheme">
                      <option v-for="item in numberSchemeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                    </select>
                  </div>
                  <div class="num-input">
                    <label>组号方案</label>
                    <select v-model="exportSettings.excelGroupNumberScheme">
                      <option v-for="item in numberSchemeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                    </select>
                  </div>
                  <div class="num-input">
                    <label>序号方案</label>
                    <select v-model="exportSettings.excelSerialNumberScheme">
                      <option v-for="item in numberSchemeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="settings-section">
                <h4>标签统计表</h4>
                <label class="check-item">
                  <input type="checkbox" v-model="exportSettings.excelShowTagTable" />
                  <span>导出标签统计</span>
                </label>
                <div v-if="exportSettings.excelShowTagTable" class="tag-table-options">
                  <div class="mode-row" style="margin-top:6px">
                    <span class="mode-label">位置:</span>
                    <label class="radio-item"><input type="radio" :value="false" v-model="exportSettings.excelTagTableNewSheet" /><span>座位下方</span></label>
                    <label class="radio-item"><input type="radio" :value="true" v-model="exportSettings.excelTagTableNewSheet" /><span>新工作表</span></label>
                  </div>
                  <div v-if="tags.length === 0" class="tag-empty-hint">暂无标签数据</div>
                  <div v-else class="tag-preview-list">
                    <div v-for="tag in tags" :key="tag.id" class="tag-preview-item">
                      <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
                      <span>{{ tag.name }}</span>
                      <span class="tag-count">{{ getTagStudentCount(tag.id) }}人</span>
                    </div>
                  </div>
                </div>
              </div>
              <!-- WebDAV 设置在这里也可以显示，移动到外面了 -->
            </template>
          </div>

          <!-- 预览面板 -->
          <div class="preview-panel">
            <!-- 图片预览 -->
            <template v-if="activeTab === 'image'">
              <div v-if="isGenerating" class="preview-loading">正在生成预览...</div>
              <img v-else-if="previewUrl" :src="previewUrl" alt="预览" class="preview-img" />
              <div v-else class="preview-empty">调整设置后自动生成预览</div>
            </template>

            <!-- Excel 预览 -->
            <template v-if="activeTab === 'excel'">
              <div class="excel-preview-wrap">
                <div class="excel-preview-hint">预览（与实际 Excel 文件布局一致）</div>
                <div v-if="isExcelGenerating" class="excel-preview-loading">
                  <div class="spinner"></div>
                  <span>正在生成 Excel 预览...</span>
                </div>
                <div v-else class="excel-preview-scroll" ref="excelScrollRef">
                  <div class="excel-preview-scale-wrapper" :style="{ zoom: Math.min(1, excelScale) }">
                    <div v-html="excelPreviewHtml" class="excel-preview-content" ref="excelContentRef"></div>
                  </div>
                </div>
                <!-- Excel 工作表选项卡 -->
                <div class="excel-preview-tabs" v-if="excelSheetNames.length > 1">
                  <button 
                    v-for="(name, index) in excelSheetNames" 
                    :key="name" 
                    :class="['excel-tab-btn', { active: excelActiveSheetIndex === index }]"
                    @click="excelActiveSheetIndex = index"
                  >
                    {{ name }}
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- ── 底部按钮 ── -->
        <div class="dialog-footer">
          <button class="btn secondary" @click="$emit('close')">关闭</button>
          <template v-if="activeTab === 'image'">
            <button v-if="authType === 'webdav'" class="btn primary" style="background:#0ea5e9;" :disabled="isGenerating || isUploading" @click="handleCloudExportImage">
              {{ isUploading ? '上传中...' : '保存至云盘' }}
            </button>
            <button class="btn primary" :disabled="isGenerating || isUploading" @click="handleDownload">下载图片</button>
          </template>
          <template v-if="activeTab === 'excel'">
            <button v-if="authType === 'webdav'" class="btn excel" style="background:#059669;" :disabled="isExcelDownloading || isUploading" @click="handleCloudExportExcel">
              {{ isUploading ? '上传中...' : '保存至云盘' }}
            </button>
            <button class="btn excel" :disabled="isExcelDownloading || isUploading" @click="handleExcelDownload">
              {{ isExcelDownloading ? '生成中...' : '下载 Excel' }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useExportSettings } from '@/composables/useExportSettings'
import { useImageExport } from '@/composables/useImageExport'
import { useTagData } from '@/composables/useTagData'
import { useExcelData } from '@/composables/useExcelData'
import { useSeatChart } from '@/composables/useSeatChart'
import { useStudentData } from '@/composables/useStudentData'
import { useAuth } from '@/composables/useAuth'
import { useWebDav } from '@/composables/useWebDav'
import { useCloudWorkspace } from '@/composables/useCloudWorkspace'

const props = defineProps({ visible: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'exported'])

const { exportSettings, initializeTagSettings, updateTagSetting } = useExportSettings()
const { exportToImage } = useImageExport()
const { tags } = useTagData()
const { exportSeatChartToExcel, exportSeatChartToExcelBuffer, generateSeatChartWorkbook, loadXlsx, xlsxInstance } = useExcelData()
const { organizedSeats, seatConfig } = useSeatChart()
const { students } = useStudentData()
const { authType, webdavConfig } = useAuth()
const { putFile } = useWebDav()
const { loadCloudSettings, saveCloudSettings } = useCloudWorkspace()

const activeTab = ref('image')
const previewUrl = ref('')
const isGenerating = ref(false)
const isExcelGenerating = ref(false)
const isExcelDownloading = ref(false)
const tagSettingsLocal = ref({})
let debounceTimer = null
const isUploading = ref(false)

const excelScrollRef = ref(null)
const excelContentRef = ref(null)
const excelScale = ref(1)
let excelResizeObserver = null
let lastPreviewObjectUrl = ''

const updateExcelScale = () => {
  if (!excelScrollRef.value || !excelContentRef.value || activeTab.value !== 'excel') return
  const contentEl = excelContentRef.value.firstElementChild
  if (!contentEl) return
  const scrollWidth = excelScrollRef.value.clientWidth
  const contentWidth = contentEl.offsetWidth
  if (contentWidth > 0 && contentWidth > scrollWidth - 30) {
    excelScale.value = (scrollWidth - 30) / contentWidth
  } else {
    excelScale.value = 1
  }
}

const excelActiveSheetIndex = ref(0)
const excelSheetNames = ref([])
const numberSchemeOptions = [
  { value: 'arabic', label: '12' },
  { value: 'alpha', label: 'AB' },
  { value: 'chineseUpper', label: '壹贰' },
  { value: 'chineseLower', label: '一二' },
  { value: 'roman', label: 'I II' },
  { value: 'circled', label: '①②' }
]

// overlay 点击关闭保护（防止从弹窗内拖出后关闭）
const overlayMouseDownSelf = ref(false)
const handleOverlayMouseUp = () => {
  if (overlayMouseDownSelf.value) emit('close')
  overlayMouseDownSelf.value = false
}

// ── 标签人数统计 ──
const getTagStudentCount = (tagId) => {
  return students.value.filter(s => s.tags && s.tags.includes(tagId)).length
}

// ── HTML 转义（防止学生名字中含有 < > & 等字符破坏预览）
const esc = (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const excelWorkbook = ref(null)

const updateExcelWorkbook = async () => {
  if (activeTab.value !== 'excel' || !props.visible) return
  
  isExcelGenerating.value = true
  try {
    const es = exportSettings.value
    const { wb } = await generateSeatChartWorkbook(
      organizedSeats.value,
      students.value,
      tags.value,
      seatConfig.value,
      {
        showStudentId:    es.excelShowStudentId,
        showRowNumbers:   es.excelShowRowNumbers,
        showGroupLabels:  es.excelShowGroupLabels,
        showTitle:        es.excelShowTitle,
        showPodium:       es.excelShowPodium,
        reverseOrder:     es.excelReverseOrder,
        showGroupGap:     es.excelShowGroupGap,
        colorMode:        es.excelColorMode,
        borderColor:      es.excelBorderColor,
        cellFormat:       es.excelCellFormat,
        rowNumberScheme:   es.excelRowNumberScheme,
        groupNumberScheme: es.excelGroupNumberScheme,
        serialNumberScheme: es.excelSerialNumberScheme,
        nameFontSize:     es.excelNameFontSize,
        idFontSize:       es.excelIdFontSize,
        cellWidth:        es.excelCellWidth,
        seatRowHeight:    es.excelSeatRowHeight,
        showTagTable:     es.excelShowTagTable,
        tagTableNewSheet: es.excelTagTableNewSheet,
        title:            es.title || '班级座位表'
      }
    )
    excelWorkbook.value = wb
  } catch (e) {
    console.error('Failed to generate excel workbook:', e)
  } finally {
    isExcelGenerating.value = false
  }
}

// 监听设置变化以更新工作簿
watch(
  () => [
    activeTab.value,
    props.visible,
    exportSettings.value.excelShowStudentId,
    exportSettings.value.excelShowRowNumbers,
    exportSettings.value.excelShowGroupLabels,
    exportSettings.value.excelShowTitle,
    exportSettings.value.excelShowPodium,
    exportSettings.value.excelReverseOrder,
    exportSettings.value.excelShowGroupGap,
    exportSettings.value.excelColorMode,
    exportSettings.value.excelBorderColor,
    exportSettings.value.excelCellFormat,
    exportSettings.value.excelRowNumberScheme,
    exportSettings.value.excelGroupNumberScheme,
    exportSettings.value.excelSerialNumberScheme,
    exportSettings.value.excelNameFontSize,
    exportSettings.value.excelIdFontSize,
    exportSettings.value.excelCellWidth,
    exportSettings.value.excelSeatRowHeight,
    exportSettings.value.excelShowTagTable,
    exportSettings.value.excelTagTableNewSheet,
    exportSettings.value.title
  ],
  () => {
    if (activeTab.value === 'excel' && props.visible) {
      updateExcelWorkbook()
    }
  },
  { deep: true }
)

// 监听 workbook 变化以更新选项卡
watch(() => excelWorkbook.value?.SheetNames, (names) => {
  excelSheetNames.value = names || []
  if (excelActiveSheetIndex.value >= (names?.length || 0)) {
    excelActiveSheetIndex.value = 0
  }
}, { immediate: true })

// ── Excel 预览（仿真 Excel 界面，支持切换工作表）──
const excelPreviewHtml = computed(() => {
  const wb = excelWorkbook.value
  if (!wb) return ''
  
  const names = wb.SheetNames || []
  if (names.length === 0) return ''
  
  const idx = Math.min(excelActiveSheetIndex.value, names.length - 1)
  const ws = wb.Sheets[names[idx]]
  if (!ws) return ''
  
  // 由于 XLSX 现在是异步加载的，我们需要通过 loadXlsx 动态获取，但 computed 不能异步
  // 幸好预览逻辑主入口在 updateExcelWorkbook，那里已经加载过了全局单例
  // 但为了安全，我们还是在渲染函数内部通过 ref 或者是缓存来处理
  // 此处假设 xlsxInstance 已经在 generateSeatChartWorkbook 内部被初始化
  // 我们可以通过一个同步的获取方式拿到缓存的实例
  const XLSX_READY = xlsxInstance.value; 
  if (!XLSX_READY) return '<div class="preview-loading">正在初始化 Excel 组件...</div>'

  const range = ws['!ref'] ? XLSX_READY.utils.decode_range(ws['!ref']) : { e: { r: 0, c: 0 } }
  const maxRow = range.e.r
  const maxCol = range.e.c

  // 2. 解析样式并转为原生 CSS
  const getCssFromStyle = (style = {}) => {
    let css = ''
    if (style.font) {
      if (style.font.bold) css += 'font-weight:bold;'
      if (style.font.sz) css += `font-size:${Math.round(style.font.sz * 1.33)}px;`
      css += `color:#${style.font.color?.rgb || '000000'};`
    }
    if (style.alignment) {
      if (style.alignment.horizontal) css += `text-align:${style.alignment.horizontal};`
      if (style.alignment.vertical) {
        const vMap = { top: 'top', center: 'middle', bottom: 'bottom' }
        css += `vertical-align:${vMap[style.alignment.vertical] || 'middle'};`
      }
      if (style.alignment.wrapText) css += 'white-space:pre-wrap;word-break:break-all;'
    } else {
      css += 'vertical-align:middle;' // 默认
    }
    if (style.border) {
      for (const edge of ['top', 'bottom', 'left', 'right']) {
        if (style.border[edge]) {
          const bs = style.border[edge].style
          const bc = style.border[edge].color?.rgb || '000000'
          const cssStyle = bs === 'dashed' ? 'dashed' : 'solid'
          const cssWidth = bs === 'medium' ? '2px' : '1px'
          css += `border-${edge}:${cssWidth} ${cssStyle} #${bc};`
        }
      }
    }
    return css
  }

  // 辅助：坐标转换
  const encode_cell = (r, c) => {
    const colStr = c < 26 ? String.fromCharCode(65 + c) : String.fromCharCode(64 + Math.floor(c / 26)) + String.fromCharCode(65 + c % 26)
    return colStr + (r + 1)
  }

  // 3. 构建单元格合并映射字典，用于 <td colspan/rowspan> 计算并跳过被覆盖的单元格
  const mergeMap = new Map() // 'r,c' -> { r, c }
  const skipMap = new Set()  // 'r,c'
  if (ws['!merges']) {
    ws['!merges'].forEach(m => {
      const rs = m.e.r - m.s.r + 1
      const cs = m.e.c - m.s.c + 1
      mergeMap.set(`${m.s.r},${m.s.c}`, { r: rs, c: cs })
      for (let r = m.s.r; r <= m.e.r; r++) {
        for (let c = m.s.c; c <= m.e.c; c++) {
          if (r === m.s.r && c === m.s.c) continue
          skipMap.add(`${r},${c}`)
        }
      }
    })
  }

  // 行高列宽映射 (wch: 字符宽 ~8px; hpt: 磅高 ~1.33px)
  const cols = ws['!cols'] || []
  const rows = ws['!rows'] || []

  // 4. 开始构建 HTML 表格（含 Excel 式的外层标号 A, B, 1, 2）
  let html = `<div style="font-family:Calibri,'Microsoft YaHei',sans-serif;display:flex;flex-direction:column;width:max-content;border:1px solid #d0d0d0;background:#fff;">`
  html += `<div style="overflow:auto;background:#e6e6e6;max-height:65vh;">`
  html += `<table style="border-collapse:collapse;font-family:inherit;margin:0;table-layout:fixed;">`

  // `<colgroup>` 精确设置列宽
  html += `<colgroup>`
  html += `<col style="width:36px;min-width:36px;" />` // 行标的宽度
  for (let c = 0; c <= maxCol; c++) {
    const colDef = cols[c]
    const w = colDef && colDef.wch ? Math.round(colDef.wch * 8 + 4) : 64
    html += `<col style="width:${w}px;" />`
  }
  html += `</colgroup>`

  // `<thead>` 顶部的 A, B, C 列标
  html += `<thead><tr style="height:22px;">`
  html += `<th style="background:#f0f0f0;border-right:1px solid #d0d0d0;border-bottom:1px solid #d0d0d0;position:sticky;top:0;left:0;z-index:2;"></th>`
  for (let c = 0; c <= maxCol; c++) {
    const colStr = c < 26 ? String.fromCharCode(65 + c) : String.fromCharCode(64 + Math.floor(c / 26)) + String.fromCharCode(65 + c % 26)
    html += `<th style="background:#f0f0f0;border-right:1px solid #d0d0d0;border-bottom:1px solid #d0d0d0;font-size:12px;font-weight:normal;color:#444;position:sticky;top:0;z-index:1;">${colStr}</th>`
  }
  html += `</tr></thead><tbody>`

  // `<tbody>` 填充真实数据
  for (let r = 0; r <= maxRow; r++) {
    const rowDef = rows[r]
    const h = rowDef && rowDef.hpt ? Math.ceil(rowDef.hpt * 1.33) : 24
    html += `<tr style="height:${h}px;">`
    
    // 左侧的 1, 2, 3 行标
    html += `<td style="background:#f0f0f0;border-right:1px solid #d0d0d0;border-bottom:1px solid #d0d0d0;text-align:center;font-size:12px;color:#444;position:sticky;left:0;z-index:1;user-select:none;">${r + 1}</td>`
    
    // 遍历每一个单元格
    for (let c = 0; c <= maxCol; c++) {
      if (skipMap.has(`${r},${c}`)) continue
      
      const cellId = encode_cell(r, c)
      const cell = ws[cellId]
      const merge = mergeMap.get(`${r},${c}`)
      
      let tdAttr = `style="`
      // Excel 单元格基础重置样式（默认添加网格线占位）
      tdAttr += `padding:0 4px;box-sizing:border-box;background:#fff;overflow:hidden;border:1px solid #d4d4d4;`
      let v = ''
      
      if (cell) {
        if (cell.s) tdAttr += getCssFromStyle(cell.s)
        
        // 提取值并转义
        v = cell.v !== undefined && cell.v !== null ? String(cell.v) : ''
        v = v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
      }
      
      tdAttr += `"`
      if (merge) {
        if (merge.r > 1) tdAttr += ` rowspan="${merge.r}"`
        if (merge.c > 1) tdAttr += ` colspan="${merge.c}"`
      }
      
      html += `<td ${tdAttr}>${v}</td>`
    }
    html += `</tr>`
  }
  
  html += `</tbody></table></div></div>`
  return html
})

// 监听 tab 切换，如果切到 excel 则根据当前状态看是否需要更新
watch(() => [activeTab.value, props.visible], ([tab, vis]) => {
  if (tab === 'excel' && vis && !excelWorkbook.value) {
    updateExcelWorkbook()
  }
}, { immediate: true })


// ── 标签本地副本 ──
const initTagLocal = () => {
  const s = {}
  tags.value.forEach(tag => {
    s[tag.id] = {
      enabled:     exportSettings.value.tagSettings[tag.id]?.enabled ?? true,
      displayText: exportSettings.value.tagSettings[tag.id]?.displayText ?? tag.name.substring(0, 2)
    }
  })
  tagSettingsLocal.value = s
}

const syncTagSettings = () => {
  Object.keys(tagSettingsLocal.value).forEach(tagId => {
    updateTagSetting(parseInt(tagId), tagSettingsLocal.value[tagId])
  })
  generatePreview()
}

// ── 图片预览（防抖）──
const generatePreview = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    isGenerating.value = true
    try {
      const nextUrl = await exportToImage()
      if (lastPreviewObjectUrl) {
        URL.revokeObjectURL(lastPreviewObjectUrl)
      }
      lastPreviewObjectUrl = nextUrl
      previewUrl.value = nextUrl
    } catch {
      previewUrl.value = ''
    } finally {
      isGenerating.value = false
    }
  }, 300)
}

// ── 下载图片 ──
const handleDownload = async () => {
  let url = previewUrl.value
  if (!url) {
    isGenerating.value = true
    try {
      url = await exportToImage()
      previewUrl.value = url
      if (lastPreviewObjectUrl) {
        URL.revokeObjectURL(lastPreviewObjectUrl)
      }
      lastPreviewObjectUrl = url
    }
    catch { return }
    finally { isGenerating.value = false }
  }
  const link = document.createElement('a')
  link.href = url
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  link.download = `座位表_${ts}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  try {
    const exportedBlob = await fetch(url).then((res) => res.blob())
    emit('exported', exportedBlob)
  } catch (err) {
    console.warn('导出后更新侧边栏预览失败:', err)
    emit('exported', null)
  }
}

// ── 下载 Excel ──
const handleExcelDownload = async () => {
  // ... existing options format ...
  isExcelDownloading.value = true
  try {
    const es = exportSettings.value
    await exportSeatChartToExcel(
      organizedSeats.value,
      students.value,
      tags.value,
      seatConfig.value,
      {
        showStudentId:    es.excelShowStudentId,
        showRowNumbers:   es.excelShowRowNumbers,
        showGroupLabels:  es.excelShowGroupLabels,
        showTitle:        es.excelShowTitle,
        showPodium:       es.excelShowPodium,
        reverseOrder:     es.excelReverseOrder,
        showGroupGap:     es.excelShowGroupGap,
        colorMode:        es.excelColorMode,
        borderColor:      es.excelBorderColor,
        cellFormat:       es.excelCellFormat,
        rowNumberScheme:   es.excelRowNumberScheme,
        groupNumberScheme: es.excelGroupNumberScheme,
        serialNumberScheme: es.excelSerialNumberScheme,
        nameFontSize:     es.excelNameFontSize,
        idFontSize:       es.excelIdFontSize,
        cellWidth:        es.excelCellWidth,
        seatRowHeight:    es.excelSeatRowHeight,
        showTagTable:     es.excelShowTagTable,
        tagTableNewSheet: es.excelTagTableNewSheet,
        title:            es.title || '班级座位表'
      }
    )
  } catch (e) {
    console.error('Excel 导出失败', e)
  } finally {
    isExcelDownloading.value = false
  }
}

// ── WebDAV 上传 ──
const getWebdavPath = (filename) => {
  let dir = (exportSettings.value.webdavExportDir || '').trim()
  if (!dir) dir = '/sce_data'
  if (!dir.endsWith('/')) dir += '/'
  if (!dir.startsWith('/')) dir = '/' + dir
  return `${dir}${filename}`
}

const handleCloudExportImage = async () => {
  let url = previewUrl.value
  if (!url) {
    isGenerating.value = true
    try { url = await exportToImage(); previewUrl.value = url }
    catch { return }
    finally { isGenerating.value = false }
  }
  
  isUploading.value = true
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const filename = `座位表_${ts}.png`
    const path = getWebdavPath(filename)
    await putFile(webdavConfig.value, path, blob, 'image/png')
    alert(`图片已成功保存到云盘: ${path}`)
    
    // Save settings back
    saveCloudSettings({
      webdavExportDir: exportSettings.value.webdavExportDir
    })
  } catch (err) {
    alert('保存到云盘失败: ' + (err.message || '未知错误，请确保存储目录存在。'))
  } finally {
    isUploading.value = false
  }
}

const handleCloudExportExcel = async () => {
  isUploading.value = true
  try {
    const es = exportSettings.value
    const buffer = await exportSeatChartToExcelBuffer(
      organizedSeats.value,
      students.value,
      tags.value,
      seatConfig.value,
      {
        showStudentId:    es.excelShowStudentId,
        showRowNumbers:   es.excelShowRowNumbers,
        showGroupLabels:  es.excelShowGroupLabels,
        showTitle:        es.excelShowTitle,
        showPodium:       es.excelShowPodium,
        reverseOrder:     es.excelReverseOrder,
        showGroupGap:     es.excelShowGroupGap,
        colorMode:        es.excelColorMode,
        borderColor:      es.excelBorderColor,
        cellFormat:       es.excelCellFormat,
        rowNumberScheme:   es.excelRowNumberScheme,
        groupNumberScheme: es.excelGroupNumberScheme,
        serialNumberScheme: es.excelSerialNumberScheme,
        nameFontSize:     es.excelNameFontSize,
        idFontSize:       es.excelIdFontSize,
        cellWidth:        es.excelCellWidth,
        seatRowHeight:    es.excelSeatRowHeight,
        showTagTable:     es.excelShowTagTable,
        tagTableNewSheet: es.excelTagTableNewSheet,
        title:            es.title || '班级座位表'
      }
    )
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const filename = `座位表_${ts}.xlsx`
    const path = getWebdavPath(filename)
    await putFile(webdavConfig.value, path, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    alert(`Excel已成功保存到云盘: ${path}`)
    
    saveCloudSettings({
      webdavExportDir: exportSettings.value.webdavExportDir
    })
  } catch (err) {
    alert('保存到云盘失败: ' + (err.message || '未知错误，请确保存储目录存在。'))
  } finally {
    isUploading.value = false
  }
}

// ── 监听图片设置变化 → 触发图片预览 ──
watch(
  () => [
    exportSettings.value.title,
    exportSettings.value.showTitle,
    exportSettings.value.showRowNumbers,
    exportSettings.value.showGroupLabels,
    exportSettings.value.showPodium,
    exportSettings.value.reverseOrder,
    exportSettings.value.colorMode,
    exportSettings.value.enableTagLabels,
    exportSettings.value.colGap,
    exportSettings.value.rowGap,
    exportSettings.value.groupGap,
    exportSettings.value.padding,
    exportSettings.value.tagSettings,
    exportSettings.value.fontSizeTitle,
    exportSettings.value.fontSizeRowNumber,
    exportSettings.value.fontSizeGroupLabel,
    exportSettings.value.fontSizePodium,
    exportSettings.value.fontSizeName,
    exportSettings.value.fontSizeStudentId,
    exportSettings.value.fontSizeTag,
    exportSettings.value.offsetYName,
    exportSettings.value.offsetYStudentId,
  ],
  () => { if (props.visible && activeTab.value === 'image') generatePreview() },
  { deep: true }
)

// ── 切换到 Tab 时触发预览或缩放 ──
watch(activeTab, (v) => {
  if (v === 'image' && props.visible) generatePreview()
  if (v === 'excel' && props.visible) nextTick(updateExcelScale)
})

watch(() => excelPreviewHtml.value, () => {
  if (activeTab.value === 'excel' && props.visible) nextTick(updateExcelScale)
})

// ── 弹窗打开时初始化 ──
watch(() => props.visible, async (v) => {
  if (v) {
    initializeTagSettings(tags.value)
    initTagLocal()
    
    if (authType.value === 'webdav') {
      const cloudSettings = await loadCloudSettings()
      if (cloudSettings && cloudSettings.webdavExportDir !== undefined) {
        exportSettings.value.webdavExportDir = cloudSettings.webdavExportDir
      }
    }

    if (activeTab.value === 'image') generatePreview()
  }
})

watch(tags, () => {
  initializeTagSettings(tags.value)
  initTagLocal()
}, { deep: true })

onMounted(() => {
  initializeTagSettings(tags.value)
  initTagLocal()
  if (excelScrollRef.value) {
    excelResizeObserver = new ResizeObserver(() => updateExcelScale())
    excelResizeObserver.observe(excelScrollRef.value)
  }
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (excelResizeObserver) excelResizeObserver.disconnect()
  if (lastPreviewObjectUrl) {
    URL.revokeObjectURL(lastPreviewObjectUrl)
    lastPreviewObjectUrl = ''
  }
})
</script>

<style scoped>
/* ── 遮罩 ── */
.export-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(3px);
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* ── 对话框 ── */
.export-dialog {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  width: 1100px;
  max-width: 95vw;
  max-height: 90vh;
  animation: slideUp 0.2s ease;
}
@keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* ── 标题栏 ── */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #e8eef2;
  flex-shrink: 0;
}
.dialog-header h3 { margin: 0; font-size: 17px; font-weight: 600; color: #23587b; }
.close-btn {
  width: 30px; height: 30px; border: none; background: #f0f0f0;
  border-radius: 8px; cursor: pointer; font-size: 15px; color: #666;
  display: flex; align-items: center; justify-content: center; transition: all 0.15s;
}
.close-btn:hover { background: #e0e0e0; color: #333; }

/* ── Tab 栏 ── */
.tab-bar {
  display: flex;
  gap: 2px;
  padding: 10px 20px 0;
  border-bottom: 1px solid #e8eef2;
  flex-shrink: 0;
  background: #fafbfc;
}
.tab-btn {
  padding: 8px 20px;
  border: none;
  background: transparent;
  border-radius: 8px 8px 0 0;
  font-size: 13px;
  font-weight: 500;
  color: #888;
  cursor: pointer;
  transition: all 0.15s;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tab-btn:hover { color: #23587b; background: #edf3f8; }
.tab-btn.active { color: #23587b; font-weight: 700; border-bottom: 2px solid #23587b; background: white; }

/* ── 主体 ── */
.dialog-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* ── 设置面板 ── */
.settings-panel {
  width: 300px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 16px;
  border-right: 1px solid #e8eef2;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.settings-panel::-webkit-scrollbar { width: 5px; }
.settings-panel::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }

.settings-section { padding-bottom: 12px; border-bottom: 1px solid #f0f0f0; }
.settings-section:last-child { border-bottom: none; }
.settings-section h4 {
  margin: 0 0 8px 0; font-size: 12px; font-weight: 700;
  color: #23587b; text-transform: uppercase; letter-spacing: 0.5px;
}

.setting-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.setting-row label { font-size: 12px; color: #666; font-weight: 500; }
.setting-row input[type="text"] {
  padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; transition: border-color 0.2s;
}
.setting-row textarea,
.num-input select {
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
  background: #fff;
}
.setting-row input[type="color"] {
  width: 100%;
  height: 34px;
  padding: 2px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
}
.setting-row input[type="text"]:focus { outline: none; border-color: #23587b; }
.setting-row textarea:focus,
.num-input select:focus,
.setting-row input[type="color"]:focus { outline: none; border-color: #23587b; }
.format-textarea { resize: vertical; min-height: 64px; }
.format-hint { color: #888; font-size: 11px; line-height: 1.4; }

.check-item { display: flex; align-items: center; gap: 6px; padding: 4px 0; cursor: pointer; font-size: 13px; color: #444; }
.check-item input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; }

.mode-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; flex-wrap: wrap; }
.mode-label { font-size: 12px; color: #666; font-weight: 500; }
.radio-item { display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 13px; color: #444; }
.radio-item input[type="radio"] { width: 14px; height: 14px; cursor: pointer; }

.spacing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.num-input { display: flex; flex-direction: column; gap: 2px; }
.num-input label { font-size: 11px; color: #888; }
.num-input input[type="number"] {
  padding: 5px 8px; border: 1px solid #ddd; border-radius: 5px; font-size: 13px; width: 100%; box-sizing: border-box;
}
.num-input input[type="number"]:focus { outline: none; border-color: #23587b; }

.tag-list { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
.tag-row {
  display: flex; flex-direction: column; gap: 4px; padding: 6px 8px;
  background: #fafbfc; border-radius: 6px; border: 1px solid #eee;
}
.tag-dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.15); flex-shrink: 0; }
.tag-input {
  padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px;
  font-size: 12px; width: 100%; box-sizing: border-box;
}
.tag-input:focus { outline: none; border-color: #23587b; }

/* 标签统计预览列表 */
.tag-table-options { margin-top: 4px; }
.tag-empty-hint { color: #999; font-size: 12px; margin-top: 6px; }
.tag-preview-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.tag-preview-item {
  display: flex; align-items: center; gap: 6px; font-size: 12px; color: #555;
  padding: 4px 8px; background: #f5f8fb; border-radius: 5px; border: 1px solid #e8eef2;
}
.tag-count { margin-left: auto; color: #23587b; font-weight: 600; font-size: 11px; }

/* ── 预览面板 ── */
.preview-panel {
  flex: 1; display: flex; align-items: center; justify-content: center;
  background: #f5f5f5; overflow: auto; padding: 20px; min-height: 300px;
}

/* 图片预览 */
.preview-img { max-width: 100%; max-height: 60vh; border-radius: 6px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
.preview-loading, .preview-empty { color: #999; font-size: 14px; }
.preview-loading { animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

/* Excel 预览 */
.excel-preview-wrap { display: flex; flex-direction: column; width: 100%; height: 100%; }
.excel-preview-hint {
  font-size: 11px; color: #aaa; text-align: center;
  margin-bottom: 8px; flex-shrink: 0;
}
.excel-preview-scroll {
  flex: 1; overflow: auto; display: flex; align-items: flex-start; justify-content: center; background: #e0e4e8; padding: 10px; border-radius: 4px;
}
.excel-preview-content {
  display: flex;
  flex-direction: column;
  background: #fff;
}

/* Excel Sheet 标签页 */
.excel-preview-tabs {
  display: flex;
  gap: 2px;
  background: #e0e4e8;
  padding: 4px 10px 0;
  border-top: 1px solid #ccc;
  border-radius: 0 0 4px 4px;
}
.excel-tab-btn {
  padding: 6px 16px;
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  font-size: 12px;
  color: #555;
  cursor: pointer;
  z-index: 1;
  position: relative;
  margin-bottom: -1px;
}
.excel-tab-btn:hover {
  background: #fafafa;
}
.excel-preview-scale-wrapper {
  transform-origin: top center;
}

.excel-preview-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff;
  gap: 12px;
  color: #23587b;
  font-size: 14px;
}

.excel-preview-loading .spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(35, 88, 123, 0.1);
  border-top: 3px solid #23587b;
  border-radius: 50%;
  animation: excel-spin 1s linear infinite;
}

@keyframes excel-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.excel-tab-btn.active {
  background: #fff;
  border-bottom: 1px solid #fff;
  font-weight: 600;
  color: #1d6b3a;
  z-index: 3;
}


/* ── 底部 ── */
.dialog-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 12px 20px; border-top: 1px solid #e8eef2; flex-shrink: 0;
}
.btn {
  padding: 8px 20px; border-radius: 8px; font-size: 13px;
  font-weight: 600; cursor: pointer; border: none; transition: all 0.15s;
}
.btn.secondary { background: #f0f0f0; color: #555; }
.btn.secondary:hover { background: #e0e0e0; }
.btn.primary { background: #23587b; color: white; }
.btn.primary:hover { background: #1a4460; box-shadow: 0 3px 10px rgba(35,88,123,0.3); }
.btn.excel { background: #1d6b3a; color: white; }
.btn.excel:hover { background: #155229; box-shadow: 0 3px 10px rgba(29,107,58,0.3); }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── 响应式 ── */
@media (max-width: 768px) {
  .export-dialog { width: 98vw; max-height: 92vh; border-radius: 12px; }
  .dialog-body { flex-direction: column; }
  .settings-panel { width: 100%; max-height: 45vh; border-right: none; border-bottom: 1px solid #e8eef2; }
  .preview-panel { min-height: 160px; padding: 14px; }
  .preview-img { max-height: 28vh; }
  .setting-row input[type="text"] { min-height: 44px; padding: 10px 12px; font-size: 15px; }
  .check-item { min-height: 40px; padding: 8px 0; font-size: 14px; }
  .check-item input[type="checkbox"] { width: 18px; height: 18px; }
  .radio-item { font-size: 14px; }
  .radio-item input[type="radio"] { width: 18px; height: 18px; }
  .num-input input[type="number"] { min-height: 44px; padding: 8px 10px; font-size: 15px; }
  .tag-input { min-height: 40px; padding: 8px 10px; font-size: 14px; }
  .btn { min-height: 44px; padding: 10px 20px; font-size: 14px; }
  .dialog-footer { padding-bottom: calc(12px + env(safe-area-inset-bottom, 0)); }
  .dialog-header { padding: 12px 16px; }
  .close-btn { width: 36px; height: 36px; }
}
</style>
