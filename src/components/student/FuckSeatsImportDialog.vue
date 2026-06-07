<template>
  <transition name="fs-import-fade">
    <div v-if="visible" class="fs-import-overlay" @mousedown.self="close">
      <section class="fs-import-dialog" role="dialog" aria-modal="true" aria-labelledby="fuckseats-import-title">
        <header class="fs-import-header">
          <div>
            <h3 id="fuckseats-import-title">fuckseats导入</h3>
            <p>{{ headerText }}</p>
          </div>
          <button class="fs-icon-btn" type="button" aria-label="关闭" @click="close">
            <X :size="18" />
          </button>
        </header>

        <div class="fs-import-body">
          <div v-if="isLoading" class="fs-import-state">
            <Loader2 class="fs-spin" :size="24" />
            <strong>正在检测本地服务</strong>
            <span>会依次检查 23948 和 8000 端口</span>
          </div>

          <div v-else-if="errorText" class="fs-import-state">
            <ServerOff :size="24" />
            <strong>{{ errorText }}</strong>
            <span>请先启动 fuckseats，再重新检测</span>
            <div class="fs-state-actions">
              <button class="fs-secondary-btn" type="button" @click="loadClassrooms">
                <RefreshCcw :size="15" />
                <span>重新检测</span>
              </button>
              <button v-if="showExcelFallback" class="fs-primary-btn" type="button" @click="fallbackExcel">
                <FileInput :size="15" />
                <span>导入 Excel</span>
              </button>
            </div>
          </div>

          <div v-else-if="classrooms.length === 0" class="fs-import-state">
            <Server :size="24" />
            <strong>已连接本地服务</strong>
            <span>当前 fuckseats 没有可导入的班级</span>
            <button class="fs-secondary-btn" type="button" @click="loadClassrooms">
              <RefreshCcw :size="15" />
              <span>刷新</span>
            </button>
          </div>

          <div v-else class="fs-classroom-list">
            <button
              v-for="classroom in classrooms"
              :key="`${classroom.baseUrl}:${classroom.id}`"
              class="fs-classroom-item"
              :class="{ active: selectedKey === getClassroomKey(classroom) }"
              type="button"
              @click="selectedKey = getClassroomKey(classroom)"
            >
              <span class="fs-classroom-main">
                <span class="fs-classroom-name">{{ classroom.name }}</span>
                <span class="fs-classroom-source">{{ formatBaseUrl(classroom.baseUrl) }}</span>
              </span>
              <span class="fs-classroom-meta">
                <span>{{ classroom.gridLabel || '座位网格' }}</span>
                <span>{{ formatCount(classroom.studentCount, '学生') }}</span>
                <span>{{ formatCount(classroom.seatCount, '座位') }}</span>
              </span>
            </button>
          </div>
        </div>

        <footer class="fs-import-footer">
          <button class="fs-secondary-btn" type="button" @click="close">取消</button>
          <button class="fs-secondary-btn" type="button" :disabled="isLoading || isImporting" @click="loadClassrooms">
            <RefreshCcw :size="15" />
            <span>刷新</span>
          </button>
          <button
            class="fs-primary-btn"
            type="button"
            :disabled="!selectedClassroom || isLoading || isImporting"
            @click="handleImport"
          >
            <Loader2 v-if="isImporting" class="fs-spin" :size="15" />
            <Download v-else :size="15" />
            <span>{{ isImporting ? 'fuckseats导入中' : 'fuckseats导入' }}</span>
          </button>
        </footer>
      </section>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Download, FileInput, Loader2, RefreshCcw, Server, ServerOff, X } from 'lucide-vue-next'
import { useFuckSeatsImport } from '@/composables/useFuckSeatsImport'
import { useLogger } from '@/composables/useLogger'

const props = defineProps({
  visible: Boolean,
  showExcelFallback: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'fallback-excel', 'imported'])

const { discoverLocalFuckSeats, importClassroom } = useFuckSeatsImport()
const { success, error } = useLogger()

const isLoading = ref(false)
const isImporting = ref(false)
const errorText = ref('')
const serviceBaseUrl = ref('')
const classrooms = ref([])
const selectedKey = ref('')

const getClassroomKey = (classroom) => `${classroom.baseUrl}:${classroom.id}`

const selectedClassroom = computed(() => (
  classrooms.value.find(classroom => getClassroomKey(classroom) === selectedKey.value) || null
))

const headerText = computed(() => {
  if (isLoading.value) return '检测本机是否正在运行 fuckseats'
  if (errorText.value) return '未检测到可读取的本地服务'
  if (!serviceBaseUrl.value) return '选择一个本地班级进行 fuckseats导入'
  return `已连接 ${formatBaseUrl(serviceBaseUrl.value)}`
})

const formatBaseUrl = (value) => String(value || '').replace(/^https?:\/\//, '')

const formatCount = (value, label) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return label
  return `${value} ${label}`
}

const close = () => {
  emit('update:visible', false)
}

const fallbackExcel = () => {
  close()
  emit('fallback-excel')
}

const loadClassrooms = async () => {
  isLoading.value = true
  errorText.value = ''
  serviceBaseUrl.value = ''
  classrooms.value = []
  selectedKey.value = ''

  try {
    const result = await discoverLocalFuckSeats()
    if (!result.available) {
      errorText.value = '未检测到本地 fuckseats 服务'
      return
    }

    serviceBaseUrl.value = result.baseUrl
    classrooms.value = result.classrooms || []
    if (classrooms.value.length > 0) {
      selectedKey.value = getClassroomKey(classrooms.value[0])
    }
  } catch (err) {
    errorText.value = err?.message || '检测本地服务失败'
  } finally {
    isLoading.value = false
  }
}

const handleImport = async () => {
  if (!selectedClassroom.value || isImporting.value) return
  isImporting.value = true

  try {
    const result = await importClassroom(selectedClassroom.value)
    success(`fuckseats导入完成：${selectedClassroom.value.name}，${result.students} 名学生，${result.assignedSeats} 个座位`)
    emit('imported', result)
    close()
  } catch (err) {
    error(err?.message || 'fuckseats导入失败')
  } finally {
    isImporting.value = false
  }
}

watch(() => props.visible, (visible) => {
  if (visible) {
    loadClassrooms()
  }
})
</script>

<style scoped>
.fs-import-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: var(--color-bg-overlay);
}

.fs-import-dialog {
  width: min(560px, 100%);
  max-height: min(680px, 92vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: 0 18px 45px var(--shadow-lg);
}

.fs-import-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-subtle);
}

.fs-import-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 18px;
  line-height: 1.35;
}

.fs-import-header p {
  margin: 5px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.fs-icon-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.fs-icon-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.fs-import-body {
  min-height: 260px;
  overflow: auto;
  padding: 14px;
  background: var(--color-bg-secondary);
}

.fs-import-state {
  min-height: 232px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  text-align: center;
  color: var(--color-text-secondary);
}

.fs-import-state strong {
  color: var(--color-text-primary);
  font-size: 15px;
}

.fs-import-state span {
  font-size: 13px;
}

.fs-state-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.fs-classroom-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fs-classroom-item {
  width: 100%;
  min-height: 74px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fs-classroom-item:hover,
.fs-classroom-item.active {
  border-color: var(--color-primary);
  background: var(--color-bg-selected);
}

.fs-classroom-main,
.fs-classroom-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.fs-classroom-main {
  justify-content: space-between;
}

.fs-classroom-name {
  min-width: 0;
  color: var(--color-text-primary);
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fs-classroom-source {
  color: var(--color-text-muted);
  font-size: 12px;
  flex-shrink: 0;
}

.fs-classroom-meta {
  color: var(--color-text-secondary);
  font-size: 12px;
  flex-wrap: wrap;
}

.fs-classroom-meta span {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--color-bg-subtle);
}

.fs-import-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.fs-primary-btn,
.fs-secondary-btn {
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  white-space: nowrap;
}

.fs-primary-btn {
  border: none;
  background: var(--color-primary);
  color: var(--color-surface);
}

.fs-secondary-btn {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.fs-primary-btn:disabled,
.fs-secondary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.fs-primary-btn:not(:disabled):hover {
  background: var(--color-primary-hover);
}

.fs-secondary-btn:not(:disabled):hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.fs-spin {
  animation: fs-spin 0.9s linear infinite;
}

.fs-import-fade-enter-active,
.fs-import-fade-leave-active {
  transition: opacity 0.16s ease;
}

.fs-import-fade-enter-from,
.fs-import-fade-leave-to {
  opacity: 0;
}

@keyframes fs-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .fs-import-overlay {
    align-items: stretch;
    padding: 10px;
  }

  .fs-import-dialog {
    max-height: none;
  }

  .fs-import-footer {
    justify-content: stretch;
    flex-wrap: wrap;
  }

  .fs-primary-btn,
  .fs-secondary-btn {
    flex: 1;
  }
}
</style>
