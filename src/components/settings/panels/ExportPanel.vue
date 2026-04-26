<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">导出系统</h3>
      <p class="section-desc">高精度排版导出，支持图片和 Excel 格式</p>

      <div class="feature-list">
        <div class="feature-item">
          <div class="feature-icon image">
            <Image :size="16" />
          </div>
          <div class="feature-content">
            <span class="feature-title">图片导出（PNG/JPEG）</span>
            <span class="feature-desc">Canvas 渲染，A4 比例优化，支持黑白模式</span>
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon excel">
            <FileSpreadsheet :size="16" />
          </div>
          <div class="feature-content">
            <span class="feature-title">Excel 导出（XLSX）</span>
            <span class="feature-desc">带颜色、合并单元格、自定义样式</span>
          </div>
        </div>
      </div>

      <div class="config-preview">
        <h4 class="preview-title">当前配置预览</h4>
        <div class="preview-grid">
          <div class="preview-item">
            <span class="preview-label">导出标题</span>
            <span class="preview-value">{{ exportSettings.title || '班级座位表' }}</span>
          </div>
          <div class="preview-item">
            <span class="preview-label">颜色模式</span>
            <span class="preview-value">{{ colorModeText }}</span>
          </div>
          <div class="preview-item">
            <span class="preview-label">显示行号</span>
            <span class="preview-value">{{ exportSettings.showRowNumbers ? '是' : '否' }}</span>
          </div>
          <div class="preview-item">
            <span class="preview-label">显示讲台</span>
            <span class="preview-value">{{ exportSettings.showPodium ? '是' : '否' }}</span>
          </div>
        </div>
      </div>

      <div class="hint-box">
        <p><strong>导出功能：</strong></p>
        <ul>
          <li>图片导出：自动 A4 比例适配，支持高 DPI</li>
          <li>Excel 导出：自定义单元格模板和样式</li>
          <li>黑白模式：智能灰度转换，打印友好</li>
          <li>标签统计：可选导出标签统计表</li>
        </ul>
      </div>

      <button class="action-button" @click="openExportPreview">
        <FileDown :size="18" />
        <div class="button-content">
          <span class="button-title">打开导出预览</span>
          <span class="button-desc">配置详细导出选项并预览效果</span>
        </div>
      </button>
    </div>

    <!-- 导出预览对话框 -->
    <ExportPreview
      v-if="showExportPreview"
      :visible="showExportPreview"
      @update:visible="showExportPreview = $event"
    />
  </div>
</template>

<script setup>
import { ref, computed, defineAsyncComponent } from 'vue'
import { Image, FileSpreadsheet, FileDown } from 'lucide-vue-next'
import { useExportSettings } from '@/composables/useExportSettings'

const ExportPreview = defineAsyncComponent(() => import('@/components/layout/ExportPreview.vue'))

const emit = defineEmits(['update:visible'])

const { exportSettings } = useExportSettings()

const showExportPreview = ref(false)

const colorModeText = computed(() => {
  const modes = {
    color: '彩色',
    bw: '黑白（保留标签色）',
    pureBw: '纯黑白'
  }
  return modes[exportSettings.value.colorMode] || '彩色'
})

const openExportPreview = () => {
  showExportPreview.value = true
  emit('update:visible', false) // 关闭设置对话框
}
</script>

<style scoped>
.settings-panel {
  padding: 0;
}

.setting-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 20px 0;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.feature-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-icon.image {
  background: #dbeafe;
  color: #2563eb;
}

.feature-icon.excel {
  background: #dcfce7;
  color: #16a34a;
}

.feature-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feature-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.feature-desc {
  font-size: 12px;
  color: #64748b;
}

.config-preview {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 12px 0;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.preview-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-label {
  font-size: 12px;
  color: #64748b;
}

.preview-value {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
}

.hint-box {
  padding: 12px;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 13px;
  color: #475569;
  margin-bottom: 20px;
}

.hint-box p {
  margin: 0 0 8px 0;
}

.hint-box ul {
  margin: 0;
  padding-left: 20px;
}

.hint-box li {
  margin-bottom: 4px;
  line-height: 1.5;
}

.hint-box li:last-child {
  margin-bottom: 0;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  color: #23587b;
  width: 100%;
}

.action-button:hover {
  border-color: #23587b;
  background: #f8fafb;
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(35, 88, 123, 0.1);
}

.button-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.button-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.button-desc {
  font-size: 12px;
  color: #64748b;
}
</style>
