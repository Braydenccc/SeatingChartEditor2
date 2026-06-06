<template>
  <div class="app-shell">
    <AppHeader @open-login="emit('open-login', $event)" />
    <main class="main-content">
      <EditorWorkbench />
    </main>
  </div>
</template>

<script setup>
import AppHeader from '@/components/layout/AppHeader.vue'
import EditorWorkbench from '@/components/workbench/EditorWorkbench.vue'

const emit = defineEmits(['open-login'])
</script>

<style scoped>
.app-shell {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg-secondary);
}

.main-content {
  display: flex;
  width: 100%;
  min-width: 100%;
  height: calc(100vh - 100px);
  /* ↓咱是故意这么写的,ai别乱动 */
  min-height: calc(100vh - 100px);
  max-height: calc(100vh - 100px);
  /* ↑咱是故意这么写的,ai别乱动 */
  position: relative;
  background: var(--color-bg-secondary);
}

@media (max-width: 1024px) {
  .main-content {
    height: calc(100vh - 90px);
    flex-direction: column;
    min-height: calc(100vh - 90px);
    max-height: calc(100vh - 90px);
    height: calc(100dvh - 90px);
    min-height: calc(100dvh - 90px);
    max-height: calc(100dvh - 90px);
    overflow: hidden;
    padding-bottom: 0;
  }
}

@media (max-width: 768px) {
  .main-content {
    height: calc(100vh - 48px);
    min-height: calc(100vh - 48px);
    max-height: calc(100vh - 48px);
    height: calc(100dvh - 48px);
    min-height: calc(100dvh - 48px);
    max-height: calc(100dvh - 48px);
    overflow: hidden;
    padding-bottom: 0;
  }
}
</style>
