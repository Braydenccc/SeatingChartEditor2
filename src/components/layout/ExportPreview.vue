<template>
  <Teleport to="body">
    <div v-if="visible" class="export-dialog-overlay" @mousedown.self="overlayMouseDownSelf = true" @mouseup.self="handleOverlayMouseUp">
      <div class="export-dialog">
        <div class="dialog-header">
          <h3>导出设置</h3>
          <button class="close-btn" @click="$emit('close')">✕</button>
        </div>

        <div class="dialog-body">
          <!-- 左侧：设置面板 -->
          <div class="settings-panel">
            <div class="settings-section">
              <h4>基础设置</h4>
              <div class="setting-row">
                <label>标题:</label>
                <input v-model="exportSettings.title" type="text" placeholder="班级座位表" />
              </div>
              <label class="check-item">
                <input type="checkbox" v-model="exportSettings.showTitle" />
                <span>显示标题</span>
              </label>
              <label class="check-item">
                <input type="checkbox" v-model="exportSettings.showRowNumbers" />
                <span>显示行号</span>
              </label>
              <label class="check-item">
                <input type="checkbox" v-model="exportSettings.showGroupLabels" />
                <span>显示组号</span>
              </label>
              <label class="check-item">
                <input type="checkbox" v-model="exportSettings.showPodium" />
                <span>显示讲台</span>
              </label>
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
                <div class="num-input">
                  <label>列间距</label>
                  <input type="number" v-model.number="exportSettings.colGap" min="0" max="100" />
                </div>
                <div class="num-input">
                  <label>行间距</label>
                  <input type="number" v-model.number="exportSettings.rowGap" min="0" max="100" />
                </div>
                <div class="num-input">
                  <label>组间距</label>
                  <input type="number" v-model.number="exportSettings.groupGap" min="0" max="200" />
                </div>
                <div class="num-input">
                  <label>边距</label>
                  <input type="number" v-model.number="exportSettings.padding" min="0" max="100" />
                </div>
              </div>
            </div>

            <div class="settings-section">
              <h4>标签</h4>
              <label class="check-item">
                <input type="checkbox" v-model="exportSettings.enableTagLabels" />
                <span>启用标签</span>
              </label>
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
                <div class="num-input">
                  <label>姓名</label>
                  <input type="number" v-model.number="exportSettings.fontSizeName" min="8" max="60" />
                </div>
                <div class="num-input">
                  <label>学号</label>
                  <input type="number" v-model.number="exportSettings.fontSizeStudentId" min="8" max="60" />
                </div>
                <div class="num-input">
                  <label>标题</label>
                  <input type="number" v-model.number="exportSettings.fontSizeTitle" min="8" max="80" />
                </div>
                <div class="num-input">
                  <label>行号</label>
                  <input type="number" v-model.number="exportSettings.fontSizeRowNumber" min="8" max="40" />
                </div>
                <div class="num-input">
                  <label>组号</label>
                  <input type="number" v-model.number="exportSettings.fontSizeGroupLabel" min="8" max="40" />
                </div>
                <div class="num-input">
                  <label>讲台</label>
                  <input type="number" v-model.number="exportSettings.fontSizePodium" min="8" max="40" />
                </div>
                <div class="num-input">
                  <label>标签</label>
                  <input type="number" v-model.number="exportSettings.fontSizeTag" min="8" max="30" />
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧：实时预览 -->
          <div class="preview-panel">
            <div v-if="isGenerating" class="preview-loading">正在生成预览...</div>
            <img v-else-if="previewUrl" :src="previewUrl" alt="预览" class="preview-img" />
            <div v-else class="preview-empty">调整设置后自动生成预览</div>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn secondary" @click="$emit('close')">关闭</button>
          <button class="btn primary" :disabled="isGenerating" @click="handleDownload">下载图片</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useExportSettings } from '@/composables/useExportSettings'
import { useImageExport } from '@/composables/useImageExport'
import { useTagData } from '@/composables/useTagData'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'exported'])

const { exportSettings, initializeTagSettings, updateTagSetting } = useExportSettings()
const { exportToImage } = useImageExport()
const { tags } = useTagData()

const previewUrl = ref('')
const isGenerating = ref(false)
const tagSettingsLocal = ref({})
let debounceTimer = null

// 防止鼠标从弹窗内拖出后意外关闭：需要 mousedown 和 mouseup 都在 overlay 自身上才关闭
const overlayMouseDownSelf = ref(false)
const handleOverlayMouseUp = () => {
  if (overlayMouseDownSelf.value) {
    emit('close')
  }
  overlayMouseDownSelf.value = false
}

// 初始化标签本地副本
const initTagLocal = () => {
  const s = {}
  tags.value.forEach(tag => {
    s[tag.id] = {
      enabled: exportSettings.value.tagSettings[tag.id]?.enabled ?? true,
      displayText: exportSettings.value.tagSettings[tag.id]?.displayText ?? tag.name.substring(0, 2)
    }
  })
  tagSettingsLocal.value = s
}

// 同步标签设置到 store，并触发预览刷新
const syncTagSettings = () => {
  Object.keys(tagSettingsLocal.value).forEach(tagId => {
    updateTagSetting(parseInt(tagId), tagSettingsLocal.value[tagId])
  })
  // 手动触发预览更新（deep watch 不一定能捕获对 tagSettings 的就地修改）
  generatePreview()
}

// 生成预览（防抖）
const generatePreview = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    isGenerating.value = true
    try {
      previewUrl.value = await exportToImage()
    } catch {
      previewUrl.value = ''
    } finally {
      isGenerating.value = false
    }
  }, 300)
}

// 下载
const handleDownload = async () => {
  let url = previewUrl.value
  if (!url) {
    isGenerating.value = true
    try {
      url = await exportToImage()
      previewUrl.value = url
    } catch {
      return
    } finally {
      isGenerating.value = false
    }
  }
  const link = document.createElement('a')
  link.href = url
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  link.download = `座位表_${ts}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  emit('exported', url)
}

// 监听所有设置变化 → 实时预览
watch(
  () => [
    exportSettings.value.title,
    exportSettings.value.showTitle,
    exportSettings.value.showRowNumbers,
    exportSettings.value.showGroupLabels,
    exportSettings.value.showPodium,
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
  ],
  () => {
    if (props.visible) generatePreview()
  },
  { deep: true }
)

// 弹窗打开时初始化
watch(() => props.visible, (v) => {
  if (v) {
    initializeTagSettings(tags.value)
    initTagLocal()
    generatePreview()
  }
})

// tags 变化
watch(tags, () => {
  initializeTagSettings(tags.value)
  initTagLocal()
}, { deep: true })

onMounted(() => {
  initializeTagSettings(tags.value)
  initTagLocal()
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style scoped>
.export-dialog-overlay {
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

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

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

@keyframes slideUp {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #e8eef2;
  flex-shrink: 0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #23587b;
}

.close-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: #f0f0f0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.close-btn:hover {
  background: #e0e0e0;
  color: #333;
}

.dialog-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

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

.settings-section {
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: #23587b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
}

.setting-row label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.setting-row input[type="text"] {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  transition: border-color 0.2s;
}

.setting-row input[type="text"]:focus {
  outline: none;
  border-color: #23587b;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  cursor: pointer;
  font-size: 13px;
  color: #444;
}

.check-item input[type="checkbox"] {
  width: 15px;
  height: 15px;
  cursor: pointer;
}

.mode-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  flex-wrap: wrap;
}

.mode-label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  font-size: 13px;
  color: #444;
}

.radio-item input[type="radio"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.spacing-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.num-input {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.num-input label {
  font-size: 11px;
  color: #888;
}

.num-input input[type="number"] {
  padding: 5px 8px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
}

.num-input input[type="number"]:focus {
  outline: none;
  border-color: #23587b;
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.tag-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  background: #fafbfc;
  border-radius: 6px;
  border: 1px solid #eee;
}

.tag-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.15);
  flex-shrink: 0;
}

.tag-input {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
}

.tag-input:focus {
  outline: none;
  border-color: #23587b;
}

/* 右侧预览 */
.preview-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  overflow: auto;
  padding: 20px;
  min-height: 300px;
}

.preview-img {
  max-width: 100%;
  max-height: 60vh;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}

.preview-loading,
.preview-empty {
  color: #999;
  font-size: 14px;
}

.preview-loading {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 底部 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid #e8eef2;
  flex-shrink: 0;
}

.btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}

.btn.secondary {
  background: #f0f0f0;
  color: #555;
}

.btn.secondary:hover {
  background: #e0e0e0;
}

.btn.primary {
  background: #23587b;
  color: white;
}

.btn.primary:hover {
  background: #1a4460;
  box-shadow: 0 3px 10px rgba(35,88,123,0.3);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 滚动条 */
.settings-panel::-webkit-scrollbar {
  width: 5px;
}

.settings-panel::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

/* 响应式 */
@media (max-width: 768px) {
  .export-dialog {
    width: 98vw;
    max-height: 92vh;
    border-radius: 12px;
  }

  .dialog-body {
    flex-direction: column;
  }

  .settings-panel {
    width: 100%;
    max-height: 45vh;
    border-right: none;
    border-bottom: 1px solid #e8eef2;
  }

  .preview-panel {
    min-height: 160px;
    padding: 14px;
  }

  .preview-img {
    max-height: 28vh;
  }

  /* 触摸友好的表单控件 */
  .setting-row input[type="text"] {
    min-height: 44px;
    padding: 10px 12px;
    font-size: 15px;
  }

  .check-item {
    min-height: 40px;
    padding: 8px 0;
    font-size: 14px;
  }

  .check-item input[type="checkbox"] {
    width: 18px;
    height: 18px;
  }

  .radio-item {
    font-size: 14px;
  }

  .radio-item input[type="radio"] {
    width: 18px;
    height: 18px;
  }

  .num-input input[type="number"] {
    min-height: 44px;
    padding: 8px 10px;
    font-size: 15px;
  }

  .tag-input {
    min-height: 40px;
    padding: 8px 10px;
    font-size: 14px;
  }

  .btn {
    min-height: 44px;
    padding: 10px 20px;
    font-size: 14px;
  }

  .dialog-footer {
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0));
  }

  .dialog-header {
    padding: 12px 16px;
  }

  .close-btn {
    width: 36px;
    height: 36px;
  }
}
</style>
