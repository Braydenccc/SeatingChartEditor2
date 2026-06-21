<template>
  <Transition name="dialog-fade">
    <div v-if="previewDialogVisible" class="import-overlay" @mousedown.self="cancelExcelRosterImport">
      <section class="import-dialog">
        <header class="dialog-header">
          <div>
            <h3>确认导入 Excel 名单</h3>
            <p>{{ importFileName }} · {{ totalStudents }} 行学生 · {{ importableStudents.length }} 行可导入</p>
          </div>
          <button class="icon-button" type="button" aria-label="关闭" @click="cancelExcelRosterImport">
            <X :size="18" />
          </button>
        </header>

        <div class="dialog-body">
          <aside class="summary-panel">
            <div class="mode-card">
              <span class="panel-label">导入方式</span>
              <div class="segmented">
                <button type="button" :class="{ active: importMode === 'replace' }" @click="importMode = 'replace'">
                  覆盖所有
                </button>
                <button type="button" :class="{ active: importMode === 'append' }" @click="importMode = 'append'">
                  新增
                </button>
              </div>
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
                      <input
                        class="cell-input number-input"
                        type="number"
                        :value="student.studentNumber ?? ''"
                        @input="handleStudentNumberInput(student.rowNumber, $event.target.value)"
                      />
                    </td>
                    <td>
                      <input
                        class="cell-input"
                        :value="student.name"
                        @input="updatePreviewStudent(student.rowNumber, { name: $event.target.value })"
                      />
                    </td>
                    <td v-for="attribute in numericAttributes" :key="attribute.id">
                      <input
                        class="cell-input number-input"
                        type="number"
                        :value="formatNumericValue(student.numericAttributes?.[attribute.id])"
                        @input="handleNumericInput(student.rowNumber, attribute.id, $event.target.value)"
                      />
                    </td>
                    <td>
                      <input
                        class="cell-input"
                        :value="student.tagNames.join('、')"
                        placeholder="用顿号或逗号分隔"
                        @change="updatePreviewTagNames(student.rowNumber, $event.target.value)"
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

        <footer class="dialog-footer">
          <span v-if="skippedRowNumbers.size > 0" class="footer-warning">
            有 {{ skippedRowNumbers.size }} 行存在问题，确认后会自动跳过这些行。
          </span>
          <span v-else class="footer-ok">所有识别到的学生都可导入。</span>
          <div class="footer-actions">
            <button class="secondary-btn" type="button" @click="cancelExcelRosterImport">取消</button>
            <button class="primary-btn" type="button" :disabled="!canCommitImport || isCommittingImport" @click="handleCommit">
              <Loader2 v-if="isCommittingImport" :size="15" class="spin-icon" />
              <Check v-else :size="15" />
              <span>{{ isCommittingImport ? '导入中' : '确认导入' }}</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, BarChart3, Check, Loader2, Tag, X } from 'lucide-vue-next'
import { useRosterExcelImport } from '@/composables/useRosterExcelImport'

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

const isSkipped = (rowNumber) => skippedRowNumbers.value.has(rowNumber)
const formatNumericValue = (value) => value === null || value === undefined ? '' : value

const parseOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : value
}

const handleStudentNumberInput = (rowNumber, value) => {
  updatePreviewStudent(rowNumber, { studentNumber: parseOptionalNumber(value) })
}

const handleNumericInput = (rowNumber, attributeId, value) => {
  const parsed = value === '' ? null : Number(value)
  updatePreviewNumericValue(rowNumber, attributeId, Number.isFinite(parsed) || parsed === null ? parsed : null)
}

const handleCommit = async () => {
  const imported = await commitExcelRosterImport()
  if (imported) router.push('/students')
}
</script>

<style scoped>
.import-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--color-bg-overlay);
}

.import-dialog {
  width: min(1180px, 96vw);
  height: min(780px, 92vh);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: 0 18px 40px var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header,
.dialog-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-subtle);
}

.dialog-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 18px;
}

.dialog-header p {
  margin: 4px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.icon-button {
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
}

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

.segmented button,
.secondary-btn,
.primary-btn {
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-weight: 600;
  cursor: pointer;
}

.segmented button.active,
.primary-btn {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-text-inverse);
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

.tag-text {
  color: var(--color-primary);
}

.cell-input {
  width: 100%;
  min-height: 30px;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  padding: 0 8px;
  font-size: 13px;
}

.cell-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 14%, transparent);
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
  border-top: 1px solid var(--color-border);
  border-bottom: none;
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

.secondary-btn,
.primary-btn {
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.primary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.18s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

@media (max-width: 860px) {
  .import-overlay {
    padding: 0;
  }

  .import-dialog {
    width: 100vw;
    height: 100dvh;
    border-radius: 0;
  }

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
