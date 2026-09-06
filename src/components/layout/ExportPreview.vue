<template>
  <div v-show="visible" class="export-workspace">

        <!-- ── Tab 栏 ── -->
        <div class="tab-bar">
          <NButton class="export-tab-button" size="small" :type="activeTab === 'image' ? 'primary' : 'default'" :secondary="activeTab !== 'image'" @click="activeTab = 'image'">
            图片导出
          </NButton>
          <NButton class="export-tab-button" size="small" :type="activeTab === 'excel' ? 'primary' : 'default'" :secondary="activeTab !== 'excel'" @click="activeTab = 'excel'">
            Excel 导出
          </NButton>
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
                  <NInput v-model:value="exportSettings.title" placeholder="班级座位表" />
                </div>
                <NCheckbox v-model:checked="exportSettings.showTitle">显示标题</NCheckbox>
                <NCheckbox v-model:checked="exportSettings.showRowNumbers">显示行号</NCheckbox>
                <NCheckbox v-model:checked="exportSettings.showGroupLabels">显示组号</NCheckbox>
                <NCheckbox v-model:checked="exportSettings.showPodium">显示讲台</NCheckbox>
                <NCheckbox v-model:checked="exportSettings.flipVertical">上下翻转座位表</NCheckbox>
                <NCheckbox v-model:checked="exportSettings.flipHorizontal">左右翻转座位表</NCheckbox>
                <div class="mode-row">
                  <span class="mode-label">模式:</span>
                  <NRadioGroup v-model:value="exportSettings.colorMode" name="image-color-mode">
                    <NRadio value="color">彩色</NRadio>
                    <NRadio value="bw">灰度</NRadio>
                    <NRadio value="pureBw">黑白</NRadio>
                  </NRadioGroup>
                </div>
              </div>

              <div class="settings-section">
                <h4>间距</h4>
                <div class="spacing-grid">
                  <div class="num-input"><label>列间距</label><NInputNumber :value="exportSettings.colGap" :min="0" :max="100" @update:value="value => updateExportNumber('colGap', value, 0, 100)" /></div>
                  <div class="num-input"><label>行间距</label><NInputNumber :value="exportSettings.rowGap" :min="0" :max="100" @update:value="value => updateExportNumber('rowGap', value, 0, 100)" /></div>
                  <div class="num-input"><label>组间距</label><NInputNumber :value="exportSettings.groupGap" :min="0" :max="200" @update:value="value => updateExportNumber('groupGap', value, 0, 200)" /></div>
                  <div class="num-input"><label>边距</label><NInputNumber :value="exportSettings.padding" :min="0" :max="100" @update:value="value => updateExportNumber('padding', value, 0, 100)" /></div>
                </div>
              </div>

              <div class="settings-section">
                <h4>标签</h4>
                <NCheckbox v-model:checked="exportSettings.enableTagLabels">启用标签</NCheckbox>
                <div v-if="exportSettings.enableTagLabels && tags.length > 0" class="tag-list">
                  <div v-for="tag in tags" :key="tag.id" class="tag-row">
                    <NCheckbox
                      v-if="tagSettingsLocal[tag.id]"
                      v-model:checked="tagSettingsLocal[tag.id].enabled"
                      @update:checked="syncTagSettings"
                    >
                      <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
                      <span>{{ tag.name }}</span>
                    </NCheckbox>
                    <NInput v-if="tagSettingsLocal[tag.id] && tagSettingsLocal[tag.id].enabled"
                      v-model:value="tagSettingsLocal[tag.id].displayText"
                      @update:value="syncTagSettings" class="tag-input"
                      placeholder="显示文本" maxlength="4" />
                  </div>
                </div>
              </div>

              <div class="settings-section">
                <h4>字号</h4>
                <div class="spacing-grid">
                  <div class="num-input"><label>姓名</label><NInputNumber :value="exportSettings.fontSizeName" :min="8" :max="60" @update:value="value => updateExportNumber('fontSizeName', value, 8, 60)" /></div>
                  <div class="num-input"><label>学号</label><NInputNumber :value="exportSettings.fontSizeStudentId" :min="8" :max="60" @update:value="value => updateExportNumber('fontSizeStudentId', value, 8, 60)" /></div>
                  <div class="num-input"><label>标题</label><NInputNumber :value="exportSettings.fontSizeTitle" :min="8" :max="80" @update:value="value => updateExportNumber('fontSizeTitle', value, 8, 80)" /></div>
                  <div class="num-input"><label>行号</label><NInputNumber :value="exportSettings.fontSizeRowNumber" :min="8" :max="40" @update:value="value => updateExportNumber('fontSizeRowNumber', value, 8, 40)" /></div>
                  <div class="num-input"><label>组号</label><NInputNumber :value="exportSettings.fontSizeGroupLabel" :min="8" :max="40" @update:value="value => updateExportNumber('fontSizeGroupLabel', value, 8, 40)" /></div>
                  <div class="num-input"><label>讲台</label><NInputNumber :value="exportSettings.fontSizePodium" :min="8" :max="40" @update:value="value => updateExportNumber('fontSizePodium', value, 8, 40)" /></div>
                  <div class="num-input"><label>标签</label><NInputNumber :value="exportSettings.fontSizeTag" :min="8" :max="30" @update:value="value => updateExportNumber('fontSizeTag', value, 8, 30)" /></div>
                </div>
              </div>

              <div class="settings-section">
                <h4>位置微调</h4>
                <div class="spacing-grid">
                  <div class="num-input"><label>姓名 Y 偏移</label><NInputNumber :value="exportSettings.offsetYName" :min="-100" :max="100" @update:value="value => updateExportNumber('offsetYName', value, -100, 100)" /></div>
                  <div class="num-input"><label>学号 Y 偏移</label><NInputNumber :value="exportSettings.offsetYStudentId" :min="-100" :max="100" @update:value="value => updateExportNumber('offsetYStudentId', value, -100, 100)" /></div>
                </div>
              </div>
            </template>

            <!-- ======== WebDAV 导出设置 ======== -->
            <div class="settings-section" v-if="authType === 'webdav'">
              <h4>云端保存</h4>
              <div class="setting-row">
                <label>保存路径(网盘):</label>
                <NInput v-model:value="exportSettings.webdavExportDir" placeholder="/sce_data" title="为空则默认使用 /sce_data" />
              </div>
            </div>

            <!-- ======== Excel 设置 ======== -->
            <template v-if="activeTab === 'excel'">
              <div class="settings-section">
                <h4>内容</h4>
                <div class="setting-row">
                  <label>标题文字:</label>
                  <NInput v-model:value="exportSettings.title" placeholder="班级座位表" />
                </div>
                <NCheckbox v-model:checked="exportSettings.excelShowTitle">显示标题行</NCheckbox>
                <NCheckbox v-model:checked="exportSettings.excelShowGroupLabels">显示组号行</NCheckbox>
                <NCheckbox v-model:checked="exportSettings.excelShowRowNumbers">显示行号列</NCheckbox>
                <NCheckbox v-model:checked="exportSettings.excelShowStudentId">格子内显示学号</NCheckbox>
                <NCheckbox v-model:checked="exportSettings.excelShowPodium">显示讲台行</NCheckbox>
                <NCheckbox v-model:checked="exportSettings.excelFlipVertical">上下翻转座位表</NCheckbox>
                <NCheckbox v-model:checked="exportSettings.excelFlipHorizontal">左右翻转座位表</NCheckbox>
                <NCheckbox v-model:checked="exportSettings.excelShowGroupGap">保留大组间空列</NCheckbox>
              </div>

              <div class="settings-section">
                <h4>外观</h4>
                <div class="mode-row">
                  <span class="mode-label">配色:</span>
                  <NRadioGroup v-model:value="exportSettings.excelColorMode" name="excel-color-mode">
                    <NRadio value="color">彩色</NRadio>
                    <NRadio value="bw">单色</NRadio>
                  </NRadioGroup>
                </div>
                <NCheckbox v-model:checked="exportSettings.excelShowBorders">显示边框</NCheckbox>
              </div>

              <div class="settings-section" v-if="exportSettings.excelShowBorders">
                <h4>边框设置</h4>
                <div class="font-style-section">
                  <h5 class="subsection-title">外边框</h5>
                  <div class="spacing-grid">
                    <div class="num-input"><label>样式</label><NSelect v-model:value="exportSettings.excelOuterBorderStyle" :options="borderStyleOptions" /></div>
                    <div class="color-input"><label>颜色</label><NColorPicker v-model:value="exportSettings.excelOuterBorderColor" :modes="['hex']" :show-alpha="false" /></div>
                  </div>
                </div>
                <div class="font-style-section">
                  <h5 class="subsection-title">内边框</h5>
                  <div class="spacing-grid">
                    <div class="num-input"><label>样式</label><NSelect v-model:value="exportSettings.excelInnerBorderStyle" :options="borderStyleOptions" /></div>
                    <div class="color-input"><label>颜色</label><NColorPicker v-model:value="exportSettings.excelInnerBorderColor" :modes="['hex']" :show-alpha="false" /></div>
                  </div>
                </div>
              </div>
              <div class="settings-section">
                <h4>样式</h4>
                <div class="font-style-section">
                  <h5 class="subsection-title">标题</h5>
                  <div class="spacing-grid">
                    <div class="num-input"><label>字号(pt)</label><NInputNumber :value="exportSettings.excelTitleFontSize" :min="8" :max="36" @update:value="value => updateExportNumber('excelTitleFontSize', value, 8, 36)" /></div>
                    <div class="color-input"><label>字体颜色</label><NColorPicker v-model:value="exportSettings.excelTitleFontColor" :modes="['hex']" :show-alpha="false" /></div>
                    <div class="color-input fill-color"><label>背景颜色</label><NColorPicker v-model:value="exportSettings.excelTitleFillColor" :modes="['hex']" :show-alpha="false" :actions="['clear']" /></div>
                  </div>
                  <div class="font-style-row">
                    <NCheckbox v-model:checked="exportSettings.excelTitleFontBold">粗体</NCheckbox>
                    <NCheckbox v-model:checked="exportSettings.excelTitleFontItalic">斜体</NCheckbox>
                  </div>
                </div>
                <div class="font-style-section">
                  <h5 class="subsection-title">表头（组号/行号/讲台）</h5>
                  <div class="spacing-grid">
                    <div class="num-input"><label>字号(pt)</label><NInputNumber :value="exportSettings.excelHeaderFontSize" :min="6" :max="24" @update:value="value => updateExportNumber('excelHeaderFontSize', value, 6, 24)" /></div>
                    <div class="color-input"><label>字体颜色</label><NColorPicker v-model:value="exportSettings.excelHeaderFontColor" :modes="['hex']" :show-alpha="false" /></div>
                  </div>
                  <div class="font-style-row">
                    <NCheckbox v-model:checked="exportSettings.excelHeaderFontBold">粗体</NCheckbox>
                    <NCheckbox v-model:checked="exportSettings.excelHeaderFontItalic">斜体</NCheckbox>
                  </div>
                  <div class="sub-fill-row">
                    <div class="color-input fill-color"><label>组号背景</label><NColorPicker v-model:value="exportSettings.excelHeaderFillColor" :modes="['hex']" :show-alpha="false" :actions="['clear']" /></div>
                    <div class="color-input fill-color"><label>行号背景</label><NColorPicker v-model:value="exportSettings.excelRowNumFillColor" :modes="['hex']" :show-alpha="false" :actions="['clear']" /></div>
                    <div class="color-input fill-color"><label>讲台背景</label><NColorPicker v-model:value="exportSettings.excelPodiumFillColor" :modes="['hex']" :show-alpha="false" :actions="['clear']" /></div>
                  </div>
                </div>
                <div class="font-style-section">
                  <h5 class="subsection-title">座位格</h5>
                  <div class="spacing-grid">
                    <div class="num-input"><label>姓名字号(pt)</label><NInputNumber :value="exportSettings.excelNameFontSize" :min="8" :max="24" @update:value="value => updateExportNumber('excelNameFontSize', value, 8, 24)" /></div>
                    <div class="num-input"><label>学号字号(pt)</label><NInputNumber :value="exportSettings.excelIdFontSize" :min="6" :max="18" @update:value="value => updateExportNumber('excelIdFontSize', value, 6, 18)" /></div>
                    <div class="color-input"><label>字体颜色</label><NColorPicker v-model:value="exportSettings.excelSeatCellFontColor" :modes="['hex']" :show-alpha="false" /></div>
                    <div class="color-input fill-color"><label>背景颜色</label><NColorPicker v-model:value="exportSettings.excelSeatFillColor" :modes="['hex']" :show-alpha="false" :actions="['clear']" /></div>
                  </div>
                  <div class="font-style-row">
                    <NCheckbox v-model:checked="exportSettings.excelSeatCellFontBold">粗体</NCheckbox>
                    <NCheckbox v-model:checked="exportSettings.excelSeatCellFontItalic">斜体</NCheckbox>
                  </div>
                </div>
              </div>

              <div class="settings-section">
                <h4>尺寸</h4>
                <div class="spacing-grid">
                  <div class="num-input"><label>列宽(字符)</label><NInputNumber :value="exportSettings.excelCellWidth" :min="6" :max="30" @update:value="value => updateExportNumber('excelCellWidth', value, 6, 30)" /></div>
                  <div class="num-input"><label>行高(点)</label><NInputNumber :value="exportSettings.excelSeatRowHeight" :min="20" :max="100" @update:value="value => updateExportNumber('excelSeatRowHeight', value, 20, 100)" /></div>
                </div>
              </div>

              <div class="settings-section">
                <h4>格式化</h4>
                <div class="setting-row">
                  <label>单元格内容模板:</label>
                  <NInput
                    v-model:value="exportSettings.excelCellFormat"
                    type="textarea"
                    :rows="4"
                    class="format-textarea"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder="%n[color:#ff0000,bold]&#10;%i[size:10]"
                  />
                  <div class="format-hint">支持占位符：%n 姓名，%i 学号，%r 行号，%g 组号，%s/%j 序号，%% 百分号</div>
                  <div class="format-hint">内联样式语法：%n[color:#ff0000,bold,italic,size:14]</div>
                  <div class="format-hint">说明：关闭“格子内显示学号”后，模板中的 %i 会输出空文本。</div>
                </div>
                <div class="spacing-grid">
                  <div class="num-input">
                    <label>行号方案</label>
                    <NSelect v-model:value="exportSettings.excelRowNumberScheme" :options="numberSchemeOptions" />
                  </div>
                  <div class="num-input">
                    <label>组号方案</label>
                    <NSelect v-model:value="exportSettings.excelGroupNumberScheme" :options="numberSchemeOptions" />
                  </div>
                  <div class="num-input">
                    <label>序号方案</label>
                    <NSelect v-model:value="exportSettings.excelSerialNumberScheme" :options="numberSchemeOptions" />
                  </div>
                </div>
                <div class="format-hint" style="margin-top:6px">提示：带圈数字仅支持 1-20，超过范围会自动回退为阿拉伯数字。</div>
              </div>

              <div class="settings-section">
                <h4>标签统计表</h4>
                <NCheckbox v-model:checked="exportSettings.excelShowTagTable">导出标签统计</NCheckbox>
                <div v-if="exportSettings.excelShowTagTable" class="tag-table-options">
                  <div class="sub-fill-row" style="margin-top:6px">
                    <div class="color-input fill-color"><label>表头背景</label><NColorPicker v-model:value="exportSettings.excelTagHeaderFillColor" :modes="['hex']" :show-alpha="false" :actions="['clear']" /></div>
                  </div>
                  <div class="mode-row" style="margin-top:6px">
                    <span class="mode-label">位置:</span>
                    <NRadioGroup v-model:value="exportSettings.excelTagTableNewSheet" name="tag-table-location">
                      <NRadio :value="false">座位下方</NRadio>
                      <NRadio :value="true">新工作表</NRadio>
                    </NRadioGroup>
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
                  <NSpin size="large" description="正在生成 Excel 预览..." />
                </div>
                <div v-else class="excel-preview-scroll" ref="excelScrollRef">
                  <div class="excel-preview-scale-wrapper" :style="{ zoom: Math.min(1, excelScale) }">
                    <div v-html="excelPreviewHtml" class="excel-preview-content" ref="excelContentRef"></div>
                  </div>
                </div>
                <!-- Excel 工作表选项卡 -->
                <div class="excel-preview-tabs" v-if="excelSheetNames.length > 1">
                  <NButton
                    v-for="(name, index) in excelSheetNames"
                    :key="name"
                    class="excel-tab-btn"
                    size="tiny"
                    :type="excelActiveSheetIndex === index ? 'success' : 'default'"
                    :secondary="excelActiveSheetIndex !== index"
                    @click="excelActiveSheetIndex = index"
                  >
                    {{ name }}
                  </NButton>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- ── 底部按钮 ── -->
        <div class="dialog-footer">
          <template v-if="activeTab === 'image'">
            <NButton v-if="authType === 'webdav'" type="info" :loading="isUploading" :disabled="isGenerating || isImageExporting || isUploading" @click="handleCloudExportImage">
              <CloudUpload v-if="!isUploading" :size="14" stroke-width="2" />
              {{ isUploading ? '上传中...' : '保存至云盘' }}
            </NButton>
            <NButton type="primary" :loading="isImageExporting && !isUploading" :disabled="isGenerating || isImageExporting || isUploading" @click="handleDownload">
              <Download v-if="!isImageExporting || isUploading" :size="14" stroke-width="2" />
              {{ isImageExporting && !isUploading ? '生成中...' : '下载图片' }}
            </NButton>
          </template>
          <template v-if="activeTab === 'excel'">
            <NButton v-if="authType === 'webdav'" type="success" :loading="isUploading" :disabled="isExcelDownloading || isUploading" @click="handleCloudExportExcel">
              <CloudUpload v-if="!isUploading" :size="14" stroke-width="2" />
              {{ isUploading ? '上传中...' : '保存至云盘' }}
            </NButton>
            <NButton type="success" :loading="isExcelDownloading" :disabled="isExcelDownloading || isUploading" @click="handleExcelDownload">
              <Download v-if="!isExcelDownloading" :size="14" stroke-width="2" />
              {{ isExcelDownloading ? '生成中...' : '下载 Excel' }}
            </NButton>
          </template>
        </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  NButton,
  NCheckbox,
  NColorPicker,
  NInput,
  NInputNumber,
  NRadio,
  NRadioGroup,
  NSpin,
  NSelect
} from 'naive-ui'
import { CloudUpload, Download } from 'lucide-vue-next'
import { useExportSettings, type ExportSettingsState } from '@/composables/useExportSettings'
import { createLatestImagePreviewRunner, useImageExport } from '@/composables/useImageExport'
import { useTagData } from '@/composables/useTagData'
import { useExcelData } from '@/composables/useExcelData'
import { useSeatChart } from '@/composables/useSeatChart'
import { useStudentData } from '@/composables/useStudentData'
import { useAuth } from '@/composables/useAuth'
import { useWebDav } from '@/composables/useWebDav'
import { useCloudWorkspace } from '@/composables/useCloudWorkspace'
import { useLogger } from '@/composables/useLogger'
import { escapeHtmlWithBreaks } from '@/utils/xss'
import { saveBinaryFile } from '@/platform/files'
import { normalizeRequiredNumberInput } from '@/utils/inputNormalization'
import type { WorkBook } from 'xlsx-js-style'

interface ExcelCellStyle {
  font?: {
    bold?: boolean
    italic?: boolean
    sz?: number
    color?: { rgb?: string }
  }
  alignment?: {
    horizontal?: string
    vertical?: string
    wrapText?: boolean
  }
  border?: Partial<Record<'top' | 'bottom' | 'left' | 'right', {
    style?: string
    color?: { rgb?: string }
  }>>
  fill?: { fgColor?: { rgb?: string } }
}

interface RichTextPart {
  t?: string
  s?: {
    font?: {
      bold?: boolean
      italic?: boolean
      sz?: number
      color?: { rgb?: string }
    }
  }
}

interface LocalTagSetting {
  enabled: boolean
  displayText: string
}

const props = withDefaults(defineProps<{
  visible?: boolean
  initialTab?: 'image' | 'excel'
}>(), {
  visible: false,
  initialTab: 'image'
})
const emit = defineEmits<{
  exported: [value: Blob | null]
}>()

const { exportSettings, initializeTagSettings, updateTagSetting } = useExportSettings()
const { exportToImage } = useImageExport()
const { tags } = useTagData()
const { exportSeatChartToExcel, exportSeatChartToExcelBuffer, generateSeatChartWorkbook, loadXlsx, xlsxInstance, buildExcelOptionsFromSettings } = useExcelData()
const { organizedSeats, seatConfig, visibleGuardSeats } = useSeatChart()
const { students } = useStudentData()
const { authType, webdavConfig } = useAuth()
const { putFile } = useWebDav()
const { loadCloudSettings, saveCloudSettings } = useCloudWorkspace()
const { success, error } = useLogger()

type NumericExportSettingKey = {
  [Key in keyof ExportSettingsState]: ExportSettingsState[Key] extends number ? Key : never
}[keyof ExportSettingsState]

const updateExportNumber = (
  key: NumericExportSettingKey,
  value: number | null,
  min: number,
  max: number
) => {
  exportSettings.value[key] = normalizeRequiredNumberInput(
    value,
    exportSettings.value[key],
    { min, max, precision: 0 }
  )
}

const activeTab = ref<'image' | 'excel'>(props.initialTab === 'excel' ? 'excel' : 'image')
const previewUrl = ref('')
const isGenerating = ref(false)
const isImageExporting = ref(false)
const isExcelGenerating = ref(false)
const isExcelDownloading = ref(false)
const tagSettingsLocal = ref<Record<number, LocalTagSetting>>({})
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const isUploading = ref(false)

const excelScrollRef = ref<HTMLElement | null>(null)
const excelContentRef = ref<HTMLElement | null>(null)
const excelScale = ref(1)
let excelResizeObserver: ResizeObserver | null = null
let removeExcelResizeListener: (() => void) | null = null
let lastPreviewObjectUrl = ''
let previewRefreshPending = false

const revokeObjectUrl = (url: string) => {
  if (url) URL.revokeObjectURL(url)
}

const previewRunner = createLatestImagePreviewRunner({
  generate: () => exportToImage({ resolution: 'preview' }),
  onLatest: (url) => {
    revokeObjectUrl(lastPreviewObjectUrl)
    lastPreviewObjectUrl = url
    previewUrl.value = url
  },
  onDiscard: revokeObjectUrl,
  onRunningChange: (running) => {
    isGenerating.value = running
  },
  onError: () => {
    revokeObjectUrl(lastPreviewObjectUrl)
    lastPreviewObjectUrl = ''
    previewUrl.value = ''
  }
})

const updateExcelScale = () => {
  if (!excelScrollRef.value || !excelContentRef.value || activeTab.value !== 'excel') return
  const contentEl = excelContentRef.value.firstElementChild
  if (!(contentEl instanceof HTMLElement)) return
  const scrollWidth = excelScrollRef.value.clientWidth
  const contentWidth = contentEl.offsetWidth
  if (contentWidth > 0 && contentWidth > scrollWidth - 30) {
    excelScale.value = (scrollWidth - 30) / contentWidth
  } else {
    excelScale.value = 1
  }
}

const excelActiveSheetIndex = ref(0)
const excelSheetNames = ref<string[]>([])
const numberSchemeOptions = [
  { value: 'arabic', label: '12' },
  { value: 'alpha', label: 'AB' },
  { value: 'chineseUpper', label: '壹贰' },
  { value: 'chineseLower', label: '一二' },
  { value: 'roman', label: 'I II' },
  { value: 'circled', label: '①②（1-20）' }
]

const borderStyleOptions = [
  { value: 'thin', label: '细 (Thin)' },
  { value: 'medium', label: '中 (Medium)' },
  { value: 'thick', label: '粗 (Thick)' },
  { value: 'dashed', label: '虚线 (Dashed)' },
  { value: 'dotted', label: '点线 (Dotted)' },
  { value: 'double', label: '双线条 (Double)' }
]

// ── 标签人数统计 ──
const getTagStudentCount = (tagId: number) => {
  return students.value.filter(s => s.tags && s.tags.includes(tagId)).length
}

// ── HTML 转义（防止学生名字中含有 < > & 等字符破坏预览）
const esc = (str: unknown) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const excelWorkbook = ref<WorkBook | null>(null)

const buildCurrentExcelOptions = () => ({
  ...buildExcelOptionsFromSettings(exportSettings.value),
  guardSeats: visibleGuardSeats.value
})

const updateExcelWorkbook = async () => {
  if (activeTab.value !== 'excel' || !props.visible) return
  
  isExcelGenerating.value = true
  try {
    const { wb } = await generateSeatChartWorkbook(
      organizedSeats.value,
      students.value,
      tags.value,
      seatConfig.value,
      buildCurrentExcelOptions()
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
    exportSettings.value.excelFlipVertical,
    exportSettings.value.excelFlipHorizontal,
    exportSettings.value.excelShowGroupGap,
    exportSettings.value.excelColorMode,
    exportSettings.value.excelShowBorders,
    exportSettings.value.excelBorderStyle,
    exportSettings.value.excelBorderColor,
    exportSettings.value.excelInnerBorderStyle,
    exportSettings.value.excelInnerBorderColor,
    exportSettings.value.excelOuterBorderStyle,
    exportSettings.value.excelOuterBorderColor,
    exportSettings.value.excelTitleFontBold,
    exportSettings.value.excelTitleFontItalic,
    exportSettings.value.excelTitleFontColor,
    exportSettings.value.excelTitleFontSize,
    exportSettings.value.excelHeaderFontBold,
    exportSettings.value.excelHeaderFontItalic,
    exportSettings.value.excelHeaderFontColor,
    exportSettings.value.excelHeaderFontSize,
    exportSettings.value.excelSeatCellFontBold,
    exportSettings.value.excelSeatCellFontItalic,
    exportSettings.value.excelSeatCellFontColor,
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
    exportSettings.value.title,
    exportSettings.value.excelTitleFillColor,
    exportSettings.value.excelHeaderFillColor,
    exportSettings.value.excelRowNumFillColor,
    exportSettings.value.excelPodiumFillColor,
    exportSettings.value.excelSeatFillColor,
    exportSettings.value.excelEmptyFillColor,
    exportSettings.value.excelVacantFillColor,
    exportSettings.value.excelTagHeaderFillColor,
    seatConfig.value.podiumPosition,
    seatConfig.value.guardSeats?.enabled,
    seatConfig.value.guardSeats?.leftEnabled,
    seatConfig.value.guardSeats?.rightEnabled,
    seatConfig.value.guardSeats?.hideEmptyOnExport,
    visibleGuardSeats.value.map(seat => `${seat.id}:${seat.studentId ?? ''}`).join('|')
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
  const getCssFromStyle = (style: ExcelCellStyle = {}) => {
    let css = ''
    if (style.font) {
      if (style.font.bold) css += 'font-weight:bold;'
      if (style.font.italic) css += 'font-style:italic;'
      if (style.font.sz) css += `font-size:${Math.round(style.font.sz * 1.33)}px;`
      css += `color:#${style.font.color?.rgb || '000000'};`
    }
    if (style.alignment) {
      if (style.alignment.horizontal) css += `text-align:${style.alignment.horizontal};`
      if (style.alignment.vertical) {
        const vMap: Record<string, string> = { top: 'top', center: 'middle', bottom: 'bottom' }
        css += `vertical-align:${vMap[style.alignment.vertical] || 'middle'};`
      }
      if (style.alignment.wrapText) css += 'white-space:pre-wrap;word-break:break-all;'
    } else {
      css += 'vertical-align:middle;'
    }
    if (style.border) {
      const borderEdges: Array<keyof NonNullable<ExcelCellStyle['border']>> = ['top', 'bottom', 'left', 'right']
      for (const edge of borderEdges) {
        if (style.border[edge]) {
          const bs = style.border[edge].style
          const bc = style.border[edge].color?.rgb || '000000'
          
          let cssStyle = 'solid'
          if (bs === 'dashed') cssStyle = 'dashed'
          else if (bs === 'dotted') cssStyle = 'dotted'
          else if (bs === 'double') cssStyle = 'double'
          
          let cssWidth = '1px'
          if (bs === 'medium') cssWidth = '2px'
          else if (bs === 'thick') cssWidth = '3px'
          else if (bs === 'double') cssWidth = '3px'
          
          css += `border-${edge}:${cssWidth} ${cssStyle} #${bc} !important;`
        }
      }
    }
    if (style.fill && style.fill.fgColor && style.fill.fgColor.rgb) {
      css += `background-color:#${style.fill.fgColor.rgb} !important;`
    }
    return css
  }

  // 辅助：渲染富文本
  const renderRichText = (richParts: RichTextPart[]) => {
    if (!richParts || !Array.isArray(richParts)) return ''

    let html = ''
    richParts.forEach(part => {
      let partStyle = ''
      const font = part.s?.font || {}

      if (font.bold) partStyle += 'font-weight:bold;'
      if (font.italic) partStyle += 'font-style:italic;'
      if (font.sz) partStyle += `font-size:${Math.round(font.sz * 1.33)}px;`
      if (font.color?.rgb) partStyle += `color:#${font.color.rgb};`

      const text = escapeHtmlWithBreaks(part.t || '')

      if (partStyle) {
        html += `<span style="${partStyle}">${text}</span>`
      } else {
        html += text
      }
    })

    return html
  }

  // 辅助：坐标转换
  const encode_cell = (r: number, c: number) => {
    const colStr = c < 26 ? String.fromCharCode(65 + c) : String.fromCharCode(64 + Math.floor(c / 26)) + String.fromCharCode(65 + c % 26)
    return colStr + (r + 1)
  }

  // 3. 构建单元格合并映射字典，用于 <td colspan/rowspan> 计算并跳过被覆盖的单元格
  const mergeMap = new Map<string, { r: number; c: number }>()
  const skipMap = new Set<string>()
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
  let html = `<div style="font-family:Calibri,'Microsoft YaHei',sans-serif;display:flex;flex-direction:column;width:max-content;border:1px solid var(--color-border-strong);background:var(--color-surface);">`
  html += `<div style="overflow:auto;background:var(--color-bg-soft);max-height:65vh;">`
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
  html += `<th style="background:var(--color-bg-secondary);border-right:1px solid var(--color-border-strong);border-bottom:1px solid var(--color-border-strong);position:sticky;top:0;left:0;z-index:2;"></th>`
  for (let c = 0; c <= maxCol; c++) {
    const colStr = c < 26 ? String.fromCharCode(65 + c) : String.fromCharCode(64 + Math.floor(c / 26)) + String.fromCharCode(65 + c % 26)
    html += `<th style="background:var(--color-bg-secondary);border-right:1px solid var(--color-border-strong);border-bottom:1px solid var(--color-border-strong);font-size:12px;font-weight:normal;color:var(--color-text-secondary);position:sticky;top:0;z-index:1;">${colStr}</th>`
  }
  html += `</tr></thead><tbody>`

  // `<tbody>` 填充真实数据
  for (let r = 0; r <= maxRow; r++) {
    const rowDef = rows[r]
    const h = rowDef && rowDef.hpt ? Math.ceil(rowDef.hpt * 1.33) : 24
    html += `<tr style="height:${h}px;">`
    
    // 左侧的 1, 2, 3 行标
    html += `<td style="background:var(--color-bg-secondary);border-right:1px solid var(--color-border-strong);border-bottom:1px solid var(--color-border-strong);text-align:center;font-size:12px;color:var(--color-text-secondary);position:sticky;left:0;z-index:1;user-select:none;">${r + 1}</td>`
    
    // 遍历每一个单元格
    for (let c = 0; c <= maxCol; c++) {
      if (skipMap.has(`${r},${c}`)) continue
      
      const cellId = encode_cell(r, c)
      const cell = ws[cellId]
      const merge = mergeMap.get(`${r},${c}`)
      
      let tdAttr = `style="`
      // Excel 单元格基础重置样式
      tdAttr += `padding:0 4px;box-sizing:border-box;background:var(--color-surface);overflow:hidden;`
      if (!exportSettings.value.excelShowBorders) {
        tdAttr += `border:1px solid var(--color-border);`
      }
      let v = ''
      
      if (cell) {
        if (cell.s) tdAttr += getCssFromStyle(cell.s)
        
        if (cell.t === 'r' && cell.r) {
          v = renderRichText(cell.r)
        } else {
          v = cell.v !== undefined && cell.v !== null ? String(cell.v) : ''
          v = escapeHtmlWithBreaks(v)
        }
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
  const s: Record<number, LocalTagSetting> = {}
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
    const numericTagId = parseInt(tagId)
    const setting = tagSettingsLocal.value[numericTagId]
    if (setting) updateTagSetting(numericTagId, setting)
  })
  generatePreview()
}

const generatePreviewNow = async () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (isImageExporting.value) {
    previewRefreshPending = true
    return
  }
  await previewRunner.request()
}

// ── 图片预览（防抖）──
const generatePreview = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    generatePreviewNow()
  }, 300)
}

// ── 下载图片 ──
const handleDownload = async () => {
  isImageExporting.value = true
  let printUrl = ''
  try {
    printUrl = await exportToImage({ resolution: 'print' })
    const exportedBlob = await fetch(printUrl).then((res) => res.blob())
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const filename = `座位表_${ts}.png`
    await saveBinaryFile(exportedBlob, {
      title: '保存座位表图片',
      defaultPath: filename,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }],
      extension: '.png',
      mimeType: 'image/png'
    })
    emit('exported', exportedBlob)
  } catch (err) {
    console.warn('图片导出失败:', err)
    emit('exported', null)
  } finally {
    revokeObjectUrl(printUrl)
    isImageExporting.value = false
    if (previewRefreshPending && props.visible && activeTab.value === 'image') {
      previewRefreshPending = false
      generatePreview()
    }
  }
}

// ── 下载 Excel ──
const handleExcelDownload = async () => {
  isExcelDownloading.value = true
  try {
    await exportSeatChartToExcel(
      organizedSeats.value,
      students.value,
      tags.value,
      seatConfig.value,
      buildCurrentExcelOptions()
    )
  } catch (e) {
    console.error('Excel 导出失败', e)
  } finally {
    isExcelDownloading.value = false
  }
}

// ── WebDAV 上传 ──
const getWebdavPath = (filename: string) => {
  let dir = (exportSettings.value.webdavExportDir || '').trim()
  if (!dir) dir = '/sce_data'
  if (!dir.endsWith('/')) dir += '/'
  if (!dir.startsWith('/')) dir = '/' + dir
  return `${dir}${filename}`
}

const handleCloudExportImage = async () => {
  isImageExporting.value = true
  isUploading.value = true
  let printUrl = ''
  try {
    const config = webdavConfig.value
    if (!config) throw new Error('请先配置 WebDAV')
    printUrl = await exportToImage({ resolution: 'print' })
    const res = await fetch(printUrl)
    const blob = await res.blob()
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const filename = `座位表_${ts}.png`
    const path = getWebdavPath(filename)
    await putFile(config, path, blob, 'image/png')
    success(`图片已保存到云盘：${path}`)
    
    // Save settings back
    saveCloudSettings({
      webdavExportDir: exportSettings.value.webdavExportDir
    })
  } catch (err) {
    error(`保存到云盘失败：${err instanceof Error ? err.message : '未知错误，请确保存储目录存在。'}`)
  } finally {
    revokeObjectUrl(printUrl)
    isImageExporting.value = false
    isUploading.value = false
    if (previewRefreshPending && props.visible && activeTab.value === 'image') {
      previewRefreshPending = false
      generatePreview()
    }
  }
}

const handleCloudExportExcel = async () => {
  isUploading.value = true
  try {
    const config = webdavConfig.value
    if (!config) throw new Error('请先配置 WebDAV')
    const buffer = await exportSeatChartToExcelBuffer(
      organizedSeats.value,
      students.value,
      tags.value,
      seatConfig.value,
      buildCurrentExcelOptions()
    )
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const filename = `座位表_${ts}.xlsx`
    const path = getWebdavPath(filename)
    await putFile(config, path, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    success(`Excel 已保存到云盘：${path}`)
    
    saveCloudSettings({
      webdavExportDir: exportSettings.value.webdavExportDir
    })
  } catch (err) {
    error(`保存到云盘失败：${err instanceof Error ? err.message : '未知错误，请确保存储目录存在。'}`)
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
    exportSettings.value.flipVertical,
    exportSettings.value.flipHorizontal,
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
    seatConfig.value.podiumPosition,
    seatConfig.value.guardSeats?.enabled,
    seatConfig.value.guardSeats?.leftEnabled,
    seatConfig.value.guardSeats?.rightEnabled,
    seatConfig.value.guardSeats?.hideEmptyOnExport,
    visibleGuardSeats.value.map(seat => `${seat.id}:${seat.studentId ?? ''}`).join('|')
  ],
  () => { if (props.visible && activeTab.value === 'image') generatePreview() },
  { deep: true }
)

// ── 切换到 Tab 时触发预览或缩放 ──
watch(activeTab, (v) => {
  if (v === 'image' && props.visible) generatePreview()
  if (v === 'excel' && props.visible) nextTick(updateExcelScale)
})

watch(() => props.initialTab, (tab) => {
  activeTab.value = tab === 'excel' ? 'excel' : 'image'
})

watch(() => excelPreviewHtml.value, () => {
  if (activeTab.value === 'excel' && props.visible) nextTick(updateExcelScale)
})

// ── 弹窗打开时初始化 ──
watch(() => props.visible, async (v) => {
  if (v) {
    initializeTagSettings(tags.value)
    initTagLocal()

    if (activeTab.value === 'image') {
      generatePreviewNow()
    }
    
    if (authType.value === 'webdav') {
      const cloudSettings = await loadCloudSettings()
      if (cloudSettings && cloudSettings.webdavExportDir !== undefined) {
        exportSettings.value.webdavExportDir = cloudSettings.webdavExportDir
      }
    }
  }
}, { immediate: true })

watch(tags, () => {
  initializeTagSettings(tags.value)
  initTagLocal()
}, { deep: true })

onMounted(() => {
  initializeTagSettings(tags.value)
  initTagLocal()
  if (excelScrollRef.value) {
    if (typeof window.ResizeObserver === 'function') {
      excelResizeObserver = new ResizeObserver(() => updateExcelScale())
      excelResizeObserver.observe(excelScrollRef.value)
    } else {
      const handleWindowResize = () => updateExcelScale()
      window.addEventListener('resize', handleWindowResize)
      removeExcelResizeListener = () => {
        window.removeEventListener('resize', handleWindowResize)
      }
    }
  }
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  previewRunner.dispose()
  if (excelResizeObserver) excelResizeObserver.disconnect()
  removeExcelResizeListener?.()
  if (lastPreviewObjectUrl) {
    revokeObjectUrl(lastPreviewObjectUrl)
    lastPreviewObjectUrl = ''
  }
})
</script>

<style scoped>
.export-workspace {
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.export-workspace .tab-bar {
  padding: 8px 16px 0;
}

.export-workspace .settings-panel {
  width: 340px;
}

.export-workspace .preview-panel {
  min-height: 0;
}

/* ── Tab 栏 ── */
.tab-bar {
  display: flex;
  gap: 2px;
  padding: 10px 20px 0;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
  background: var(--color-bg-subtle);
}
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
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.settings-panel::-webkit-scrollbar { width: 5px; }
.settings-panel::-webkit-scrollbar-track { background: var(--scrollbar-track); }
.settings-panel::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
.settings-panel::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }

.settings-section { padding-bottom: 12px; border-bottom: 1px solid var(--color-bg-secondary); }
.settings-section:last-child { border-bottom: none; }
.settings-section h4 {
  margin: 0 0 8px 0; font-size: 12px; font-weight: 600;
  color: var(--color-text-secondary);
}

.setting-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.setting-row label { font-size: 12px; color: var(--color-text-secondary); font-weight: 500; }
.format-textarea { resize: vertical; min-height: 64px; }
.format-hint { color: var(--color-text-muted); font-size: 11px; line-height: 1.4; }

.mode-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; flex-wrap: wrap; }
.mode-label { font-size: 12px; color: var(--color-text-secondary); font-weight: 500; }

.spacing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.num-input { display: flex; flex-direction: column; gap: 2px; }
.num-input label { font-size: 11px; color: var(--color-text-muted); }
.num-input > :not(label) { width: 100%; }

.tag-list { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
.tag-row {
  display: flex; flex-direction: column; gap: 4px; padding: 6px 8px;
  background: var(--color-bg-subtle); border-radius: 6px; border: 1px solid var(--color-border);
}
.tag-dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid var(--shadow-lg); flex-shrink: 0; }
.tag-input {
  width: 100%;
}

/* 标签统计预览列表 */
.tag-table-options { margin-top: 4px; }
.tag-empty-hint { color: var(--color-text-disabled); font-size: 12px; margin-top: 6px; }
.tag-preview-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.tag-preview-item {
  display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-secondary);
  padding: 4px 8px; background: var(--color-bg-subtle); border-radius: 5px; border: 1px solid var(--color-border-light);
}
.tag-count { margin-left: auto; color: var(--color-primary); font-weight: 600; font-size: 11px; }

/* 字体样式子区域 */
.subsection-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0 0 8px 0;
}

/* 字体样式区域 */
.font-style-section {
  background: var(--color-bg-subtle);
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 8px;
}
.font-style-section:last-child {
  margin-bottom: 0;
}

.font-style-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.color-input {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.color-input label {
  font-size: 11px;
  color: var(--color-text-muted);
}


.sub-fill-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

/* ── 预览面板 ── */
.preview-panel {
  flex: 1; display: flex; align-items: center; justify-content: center;
  background: var(--color-bg-secondary); overflow: auto; padding: 20px; min-height: 300px;
}

/* 图片预览 */
.preview-img { max-width: 100%; max-height: 60vh; border-radius: 6px; box-shadow: 0 2px 12px var(--shadow-md); }
.preview-loading, .preview-empty { color: var(--color-text-disabled); font-size: 14px; }
.preview-loading { animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

/* Excel 预览 */
.excel-preview-wrap { display: flex; flex-direction: column; width: 100%; height: 100%; }
.excel-preview-hint {
  font-size: 11px; color: var(--color-text-disabled); text-align: center;
  margin-bottom: 8px; flex-shrink: 0;
}
.excel-preview-scroll {
  flex: 1; overflow: auto; display: flex; align-items: flex-start; justify-content: center; background: var(--color-bg-secondary); padding: 10px; border-radius: 4px;
}
.excel-preview-content {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

/* Excel Sheet 标签页 */
.excel-preview-tabs {
  display: flex;
  gap: 2px;
  background: var(--color-bg-secondary);
  padding: 4px 10px 0;
  border-top: 1px solid var(--color-border-strong);
  border-radius: 0 0 4px 4px;
}
.excel-tab-btn {
  z-index: 1;
  position: relative;
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
  background: var(--color-surface);
  gap: 12px;
  color: var(--color-primary);
  font-size: 14px;
}

/* ── 底部 ── */
.dialog-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 12px 20px; border-top: 1px solid var(--color-border-light); flex-shrink: 0;
}
/* ── 响应式 ── */
@media (max-width: 768px) {
  .export-workspace .tab-bar { padding: 6px 10px 0; overflow-x: auto; scrollbar-width: none; }
  .export-workspace .tab-bar::-webkit-scrollbar { display: none; }
  .dialog-body { flex-direction: column; }
  .settings-panel { width: 100%; max-height: 34vh; border-right: none; border-bottom: 1px solid var(--color-border-light); padding: 12px; }
  .preview-panel { flex: 1; min-height: 0; padding: 12px; }
  .preview-img { max-height: 30vh; }
  .export-tab-button { white-space: nowrap; }
  .dialog-footer { flex-wrap: wrap; padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0)); }
}
</style>
