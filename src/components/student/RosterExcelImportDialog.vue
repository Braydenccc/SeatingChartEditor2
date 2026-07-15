<template>
  <ResponsiveOverlay :show="previewDialogVisible" title="确认导入 Excel 名单" :busy="isCommittingImport" :desktop-width="1180" mobile-height="94dvh" @update:show="value => !value && cancelExcelRosterImport()">
        <p class="dialog-description">{{ importFileName }} · {{ totalStudents }} 行学生 · {{ importableStudents.length }} 行可导入</p>
        <div class="dialog-body">
          <aside class="summary-panel">
            <div class="mode-card">
              <span class="panel-label">导入方式</span>
              <NRadioGroup v-model:value="importMode" class="segmented" size="small">
                <NRadioButton value="replace">覆盖所有</NRadioButton>
                <NRadioButton value="append">新增</NRadioButton>
              </NRadioGroup>
              <p>{{ modeHint }}</p>
            </div>

            <div class="metric-grid">
              <div class="metric">
                <strong>{{ totalStudents }}</strong>
                <span>识别学生</span>
              </div>
              <div class="metric">
                <strong>{{ importableStudents.length }}</strong>
                <span>可导入</span>
              </div>
              <div class="metric warning">
                <strong>{{ skippedRowNumbers.size }}</strong>
                <span>将跳过</span>
              </div>
            </div>

            <section class="field-section">
              <h4>数值属性</h4>
              <div v-if="numericAttributes.length === 0" class="empty-text">未识别到数值属性</div>
              <div v-else class="pill-list">
                <span v-for="attribute in numericAttributes" :key="attribute.id" class="field-pill">
                  <BarChart3 :size="13" />
                  {{ attribute.name }}{{ attribute.unit ? `(${attribute.unit})` : '' }}
                </span>
              </div>
            </section>

            <section class="field-section">
              <h4>标签属性</h4>
              <div v-if="tagNames.length === 0" class="empty-text">未识别到标签</div>
              <div v-else class="pill-list">
                <span v-for="tagName in tagNames" :key="tagName" class="field-pill tag-pill">
                  <Tag :size="13" />
                  {{ tagName }}
                </span>
              </div>
            </section>

            <section class="field-section">
              <h4>问题项</h4>
              <div v-if="currentModeIssues.length === 0" class="empty-text">未发现冲突或错误</div>
              <div v-else class="issue-list">
                <div v-for="(issue, index) in currentModeIssues" :key="`${issue.rowNumber || 'global'}-${index}`" :class="['issue-item', issue.severity]">
                  <AlertTriangle :size="14" />
                  <span>{{ issue.rowNumber ? `第 ${issue.rowNumber} 行：` : '' }}{{ issue.message }}</span>
                </div>
              </div>
            </section>
          </aside>

          <section class="preview-panel">
            <div class="table-wrap">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>行</th>
                    <th>学号</th>
                    <th>姓名</th>
                    <th v-for="attribute in numericAttributes" :key="attribute.id">
                      {{ attribute.name }}
                    </th>
                    <th>标签</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="student in previewStudents" :key="student.rowNumber" :class="{ skipped: isSkipped(student.rowNumber) }">
                    <td>{{ student.rowNumber }}</td>
                    <td>
                      <NInputNumber
                        class="cell-input number-input"
                        size="small"
                        :value="student.studentNumber ?? null"
                        :show-button="false"
                        @update:value="value => handleStudentNumberInput(student.rowNumber, value)"
                      />
                    </td>
                    <td>
                      <NInput
                        class="cell-input"
                        size="small"
                        :value="student.name"
                        @update:value="value => updatePreviewStudent(student.rowNumber, { name: value })"
                      />
                    </td>
                    <td v-for="attribute in numericAttributes" :key="attribute.id">
                      <NInputNumber
                        class="cell-input number-input"
                        size="small"
                        :value="student.numericAttributes?.[attribute.id] ?? null"
                        :show-button="false"
                        @update:value="value => handleNumericInput(student.rowNumber, attribute.id, value)"
                      />
                    </td>
                    <td>
                      <NInput
                        class="cell-input"
                        size="small"
                        :value="student.tagNames.join('、')"
                        placeholder="用顿号或逗号分隔"
                        @update:value="value => updatePreviewTagNames(student.rowNumber, value)"
                      />
                    </td>
                    <td>
                      <span v-if="isSkipped(student.rowNumber)" class="status-badge skipped">跳过</span>
                      <span v-else class="status-badge ready">导入</span>
                      <div v-if="getRowIssues(student.rowNumber).length > 0" class="row-issues">
                        {{ getRowIssues(student.rowNumber).map(issue => issue.message).join('；') }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <template #footer><footer class="dialog-footer">
          <span v-if="skippedRowNumbers.size > 0" class="footer-warning">
            有 {{ skippedRowNumbers.size }} 行存在问题，确认后会自动跳过这些行。
          </span>
          <span v-else class="footer-ok">所有识别到的学生都可导入。</span>
          <div class="footer-actions">
            <NButton secondary attr-type="button" @click="cancelExcelRosterImport">取消</NButton>
            <NButton type="primary" attr-type="button" :disabled="!canCommitImport" :loading="isCommittingImport" @click="handleCommit">
              <span>{{ isCommittingImport ? '导入中' : '确认导入' }}</span>
            </NButton>
          </div>
        </footer></template>
  </ResponsiveOverlay>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NInput, NInputNumber, NRadioButton, NRadioGroup } from 'naive-ui'
import { useRouter } from 'vue-router'
import { AlertTriangle, BarChart3, Tag } from 'lucide-vue-next'
import ResponsiveOverlay from '@/components/ui/ResponsiveOverlay.vue'
import { useRosterExcelImport } from '@/composables/useRosterExcelImport'
import { normalizeNumberInput } from '@/utils/inputNormalization'

const router = useRouter()
const {
  previewDialogVisible,
  importPreview,
  importFileName,
  importMode,
  isCommittingImport,
  currentModeIssues,
  skippedRowNumbers,
  importableStudents,
  canCommitImport,
  getRowIssues,
  updatePreviewStudent,
  updatePreviewNumericValue,
  updatePreviewTagNames,
  cancelExcelRosterImport,
  commitExcelRosterImport
} = useRosterExcelImport()

const previewStudents = computed(() => importPreview.value?.students || [])
const totalStudents = computed(() => previewStudents.value.length)
const numericAttributes = computed(() => importPreview.value?.attributes || [])
const tagNames = computed(() => importPreview.value?.tagNames || [])
const modeHint = computed(() => importMode.value === 'replace'
  ? '导入后会清空当前名单、标签、旧座位分配、规则、选区和轮换数据。'
  : '导入后会保留当前名单，只新增无冲突的学生、标签和数值属性。'
)

const isSkipped = (rowNumber: number) => skippedRowNumbers.value.has(rowNumber)
const formatNumericValue = (value: number | null | undefined) => value === null || value === undefined ? '' : value

const handleStudentNumberInput = (rowNumber: number, value: number | null) => {
  updatePreviewStudent(rowNumber, { studentNumber: normalizeNumberInput(value) })
}

const handleNumericInput = (rowNumber: number, attributeId: string, value: number | null) => {
  updatePreviewNumericValue(rowNumber, attributeId, normalizeNumberInput(value))
}

const handleCommit = async () => {
  const imported = await commitExcelRosterImport()
  if (imported) router.push('/students')
}
</script>

<style scoped>

.dialog-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 310px minmax(0, 1fr);
  background: var(--color-surface);
}

.summary-panel {
  min-width: 0;
  overflow: auto;
  padding: 14px;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-card,
.field-section,
.metric {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.mode-card,
.field-section {
  padding: 12px;
}

.panel-label {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin: 8px 0;
}

.mode-card p,
.empty-text {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.metric {
  padding: 10px;
}

.metric strong {
  display: block;
  color: var(--color-primary);
  font-size: 22px;
}

.metric.warning strong {
  color: var(--color-warning);
}

.metric span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.field-section h4 {
  margin: 0 0 8px;
  color: var(--color-text-primary);
  font-size: 13px;
}

.pill-list,
.issue-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-pill,
.issue-item {
  min-height: 28px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border-radius: 6px;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  font-size: 12px;
}

.tag-pill {
  color: var(--color-primary);
}

.issue-item.error,
.issue-item.conflict {
  color: var(--color-danger);
  background: var(--color-danger-bg);
}

.issue-item.warning {
  color: var(--color-warning);
  background: var(--color-warning-bg);
}

.preview-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
}

.table-wrap {
  flex: 1;
  min-width: 0;
  overflow: auto;
}

.preview-table {
  width: 100%;
  min-width: 780px;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}

.preview-table th,
.preview-table td {
  min-height: 36px;
  padding: 8px;
  border-right: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
  text-align: left;
  vertical-align: top;
}

.preview-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.preview-table tr.skipped td {
  background: var(--color-danger-bg);
}


.cell-input {
  width: 100%;
}

.number-input {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 7px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
}

.status-badge.ready {
  color: var(--color-success);
  background: var(--color-success-bg);
}

.status-badge.skipped {
  color: var(--color-danger);
  background: var(--color-danger-bg);
}

.row-issues {
  margin-top: 5px;
  color: var(--color-danger);
  font-size: 12px;
  line-height: 1.4;
}

.dialog-footer {
  min-width: 0;
}

.footer-warning {
  color: var(--color-warning);
  font-size: 13px;
}

.footer-ok {
  color: var(--color-success);
  font-size: 13px;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}


@media (max-width: 860px) {

  .dialog-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .summary-panel {
    max-height: 300px;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }

}
</style>
