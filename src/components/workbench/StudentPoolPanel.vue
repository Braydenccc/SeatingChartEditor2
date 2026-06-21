<template>
  <section class="student-pool-panel">
    <header class="pool-header">
      <div>
        <h2>候选学生</h2>
        <p>{{ poolSubtitle }}</p>
      </div>
      <button class="icon-action" title="名单与属性" @click="router.push('/students')">
        <Users :size="16" stroke-width="2" />
      </button>
    </header>

    <div class="pool-controls">
      <label class="search-field">
        <Search :size="15" stroke-width="2" />
        <input v-model="searchText" type="search" placeholder="搜索姓名或学号" />
      </label>

      <div class="filter-row">
        <div class="filter-tabs" role="tablist" aria-label="学生过滤">
          <button :class="{ active: filterMode === 'unassigned' }" @click="filterMode = 'unassigned'">未入座</button>
          <button :class="{ active: filterMode === 'all' }" @click="filterMode = 'all'">全部</button>
          <button :class="{ active: filterMode === 'assigned' }" @click="filterMode = 'assigned'">已入座</button>
        </div>
        <button
          v-if="hasActiveFilters"
          class="reset-filters-button"
          type="button"
          title="清空入座状态和标签筛选"
          @click="resetFilters"
        >
          清空筛选
        </button>
      </div>

      <div v-if="visibleTags.length > 0" class="tag-filter-list">
        <button
          v-for="tag in visibleTags"
          :key="tag.id"
          class="tag-filter"
          :class="{ active: activeTagIds.includes(tag.id) }"
          @click="toggleTag(tag.id)"
        >
          <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
          <span>{{ tag.name }}</span>
        </button>
      </div>
    </div>

    <div class="pool-list">
      <StudentList
        display-mode="compact"
        :filter-mode="filterMode"
        :search-text="searchText"
        :active-tag-ids="activeTagIds"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Users } from 'lucide-vue-next'
import StudentList from '@/components/student/StudentList.vue'
import { useStudentData } from '@/composables/useStudentData'
import { useSeatChart } from '@/composables/useSeatChart'
import { useTagData } from '@/composables/useTagData'

const router = useRouter()
const { students } = useStudentData()
const { findSeatByStudent } = useSeatChart()
const { tags } = useTagData()

const searchText = ref('')
const filterMode = ref('unassigned')
const activeTagIds = ref([])

const unassignedCount = computed(() => (
  students.value.filter(student => !findSeatByStudent(student.id)).length
))

const visibleTags = computed(() => tags.value.filter(tag => tag.showInSeatChart !== false))
const hasActiveFilters = computed(() => (
  filterMode.value !== 'unassigned' ||
  activeTagIds.value.length > 0
))
const visibleStudentCount = computed(() => {
  const search = searchText.value.trim().toLowerCase()
  return students.value.filter(student => {
    const seat = findSeatByStudent(student.id)
    if (filterMode.value === 'unassigned' && seat) return false
    if (filterMode.value === 'assigned' && !seat) return false
    if (activeTagIds.value.length > 0 && !activeTagIds.value.every(tagId => (student.tags || []).includes(tagId))) return false
    if (!search) return true
    const name = String(student.name || '').toLowerCase()
    const number = String(student.studentNumber || '').toLowerCase()
    return name.includes(search) || number.includes(search)
  }).length
})

const poolSubtitle = computed(() => {
  if (!searchText.value.trim() && activeTagIds.value.length === 0 && filterMode.value === 'unassigned') {
    return `${unassignedCount.value} 名未入座`
  }
  const modeLabel = {
    unassigned: '未入座',
    all: '全部',
    assigned: '已入座'
  }[filterMode.value]
  const parts = [modeLabel]
  if (searchText.value.trim()) parts.push('搜索中')
  if (activeTagIds.value.length > 0) parts.push(`${activeTagIds.value.length} 个标签`)
  return `当前显示 ${visibleStudentCount.value} 名 · ${parts.join(' · ')}`
})

const toggleTag = (tagId) => {
  if (activeTagIds.value.includes(tagId)) {
    activeTagIds.value = activeTagIds.value.filter(id => id !== tagId)
  } else {
    activeTagIds.value = [...activeTagIds.value, tagId]
  }
}

const resetFilters = () => {
  filterMode.value = 'unassigned'
  activeTagIds.value = []
}
</script>

<style scoped>
.student-pool-panel {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
}

.pool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.pool-header h2 {
  margin: 0;
  font-size: 15px;
  line-height: 1.4;
  color: var(--color-text-primary);
}

.pool-header p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.icon-action {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.icon-action:hover {
  color: var(--color-primary);
  border-color: var(--color-border-strong);
}

.pool-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-input-bg);
  color: var(--color-text-secondary);
}

.search-field input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 13px;
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
}

.filter-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 3px;
  border-radius: 6px;
  background: var(--color-bg-secondary);
}

.filter-tabs button {
  min-height: 30px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.filter-tabs button.active {
  background: var(--color-surface);
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.reset-filters-button {
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.reset-filters-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.tag-filter-list {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.tag-filter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  max-width: 160px;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.tag-filter span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-filter.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pool-list {
  min-height: 0;
  flex: 1;
}

@media (max-width: 768px) {
  .student-pool-panel {
    border-left: none;
  }

  .pool-header {
    padding: 10px 12px 8px;
  }

  .pool-header h2 {
    font-size: 14px;
  }

  .pool-controls {
    gap: 8px;
    padding: 10px 12px;
  }

  .search-field {
    min-height: 40px;
  }

  .search-field input {
    font-size: 15px;
  }

  .filter-tabs button {
    min-height: 36px;
  }

  .tag-filter-list {
    scrollbar-width: none;
  }

  .tag-filter-list::-webkit-scrollbar {
    display: none;
  }

  .tag-filter {
    min-height: 34px;
  }
}

@media (max-width: 1024px) and (orientation: landscape) and (max-height: 540px) {
  .student-pool-panel {
    min-height: 0;
    height: 100%;
  }

  .pool-header {
    padding: 8px 10px 6px;
  }

  .pool-header h2 {
    font-size: 13px;
  }

  .pool-header p {
    font-size: 11px;
  }

  .icon-action {
    width: 30px;
    height: 30px;
  }

  .pool-controls {
    gap: 6px;
    padding: 8px 10px;
  }

  .search-field {
    min-height: 32px;
  }

  .filter-tabs button {
    min-height: 30px;
  }

  .tag-filter {
    min-height: 28px;
  }
}
</style>
