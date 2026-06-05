<template>
  <div class="settings-panel">
    <div class="setting-section">
      <h3 class="section-title">工作区概览</h3>
      <p class="section-desc">查看当前工作区的基本信息和统计数据</p>

      <div class="info-grid">
        <div class="info-item">
          <div class="info-icon">
            <Users :size="20" />
          </div>
          <div class="info-content">
            <span class="info-label">学生总数</span>
            <span class="info-value">{{ studentCount }}</span>
          </div>
        </div>

        <div class="info-item">
          <div class="info-icon">
            <CheckCircle :size="20" />
          </div>
          <div class="info-content">
            <span class="info-label">已分配座位</span>
            <span class="info-value">{{ assignedSeats }}</span>
          </div>
        </div>

        <div class="info-item">
          <div class="info-icon">
            <Circle :size="20" />
          </div>
          <div class="info-content">
            <span class="info-label">空座位</span>
            <span class="info-value">{{ emptySeats }}</span>
          </div>
        </div>

        <div class="info-item">
          <div class="info-icon">
            <Tag :size="20" />
          </div>
          <div class="info-content">
            <span class="info-label">标签数量</span>
            <span class="info-value">{{ tagCount }}</span>
          </div>
        </div>

        <div class="info-item">
          <div class="info-icon">
            <Grid :size="20" />
          </div>
          <div class="info-content">
            <span class="info-label">座位总数</span>
            <span class="info-value">{{ totalSeats }}</span>
          </div>
        </div>

        <div class="info-item">
          <div class="info-icon">
            <Wand2 :size="20" />
          </div>
          <div class="info-content">
            <span class="info-label">规则数量</span>
            <span class="info-value">{{ ruleCount }}</span>
          </div>
        </div>
      </div>

      <div class="section-divider"></div>

      <h3 class="section-title">名单与属性管理</h3>
      <p class="section-desc">管理学生名单、数值属性和标签系统</p>

      <div class="action-buttons">
        <button class="action-button" @click="openStudentRoster">
          <Users :size="18" />
          <div class="button-content">
            <span class="button-title">名单与属性</span>
            <span class="button-desc">添加、编辑学生、数值属性和标签</span>
          </div>
        </button>
      </div>
    </div>

    <!-- 学生名单对话框 -->
    <StudentRosterDialog
      v-if="showStudentRoster"
      :visible="showStudentRoster"
      @update:visible="showStudentRoster = $event"
    />

  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Users, CheckCircle, Circle, Tag, Grid, Wand2 } from 'lucide-vue-next'
import { useStudentData } from '@/composables/useStudentData'
import { useTagData } from '@/composables/useTagData'
import { useSeatChart } from '@/composables/useSeatChart'
import { useSeatRules } from '@/composables/useSeatRules'
import StudentRosterDialog from '@/components/student/StudentRosterDialog.vue'

const { students } = useStudentData()
const { tags } = useTagData()
const { seats } = useSeatChart()
const { rules } = useSeatRules()

const showStudentRoster = ref(false)

const studentCount = computed(() => students.value.length)
const tagCount = computed(() => tags.value.length)
const totalSeats = computed(() => seats.value.length)
const assignedSeats = computed(() => seats.value.filter(s => s.studentId && !s.isEmpty).length)
const emptySeats = computed(() => seats.value.filter(s => s.isEmpty).length)
const ruleCount = computed(() => rules.value?.length || 0)

const openStudentRoster = () => {
  showStudentRoster.value = true
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
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 20px 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.info-item {
  background: var(--color-bg-secondary);
  padding: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s;
}

.info-item:hover {
  background: var(--color-bg-secondary);
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.info-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--color-info-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  flex-shrink: 0;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.info-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.info-value {
  font-size: 24px;
  color: var(--color-primary);
  font-weight: 600;
  line-height: 1;
}

.section-divider {
  height: 1px;
  background: var(--color-border);
  margin: 32px 0;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  color: var(--color-primary);
}

.action-button:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-secondary);
  transform: translateX(4px);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 10%, transparent);
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
  color: var(--color-text-primary);
}

.button-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
