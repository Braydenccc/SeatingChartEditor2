<template>
  <div class="page-shell">
    <header class="page-header">
      <div class="page-title-group">
        <p v-if="eyebrow" class="page-eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
      </div>
      <div class="page-actions">
        <slot name="actions"></slot>
        <button class="back-button" type="button" aria-label="返回编辑器" title="返回编辑器" @click="goEditor">
          <ArrowLeft :size="17" stroke-width="2.2" />
          <span>返回编辑器</span>
        </button>
      </div>
    </header>
    <main class="page-body">
      <slot></slot>
    </main>
  </div>
</template>

<script setup>
import { ArrowLeft } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

defineProps({
  title: {
    type: String,
    required: true
  },
  eyebrow: {
    type: String,
    default: ''
  }
})

const router = useRouter()
const goEditor = () => router.push('/editor')
</script>

<style scoped>
.page-shell {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.page-header {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 18px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.page-title-group {
  min-width: 0;
}

.page-eyebrow {
  margin: 0 0 3px;
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 600;
}

.page-title-group h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  color: var(--color-primary);
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.back-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-surface);
}

.page-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0;
}

@media (max-width: 768px) {
  .page-header {
    min-height: 52px;
    align-items: center;
    flex-direction: row;
    padding: calc(8px + env(safe-area-inset-top, 0px)) 10px 8px;
    gap: 8px;
  }

  .page-actions {
    width: auto;
    justify-content: flex-end;
    flex-wrap: nowrap;
  }

  .page-eyebrow {
    display: none;
  }

  .page-title-group h1 {
    font-size: 17px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .back-button span {
    display: none;
  }

  .back-button {
    min-width: 44px;
    min-height: 40px;
    padding: 0 10px;
  }

  .page-body {
    min-height: 0;
    overscroll-behavior: contain;
  }
}
</style>
