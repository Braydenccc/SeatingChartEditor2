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
  --app-header-height: 100px;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg-secondary);
}

.main-content {
  display: flex;
  width: 100%;
  min-width: 100%;
  height: calc(100vh - var(--app-header-height));
  /* ↓咱是故意这么写的,ai别乱动 */
  min-height: calc(100vh - var(--app-header-height));
  max-height: calc(100vh - var(--app-header-height));
  /* ↑咱是故意这么写的,ai别乱动 */
  position: relative;
  background: var(--color-bg-secondary);
}

@media (max-width: 1024px) {
  .app-shell {
    --app-header-height: 90px;
  }

  .main-content {
    height: calc(100vh - var(--app-header-height));
    flex-direction: column;
    min-height: calc(100vh - var(--app-header-height));
    max-height: calc(100vh - var(--app-header-height));
    height: calc(100dvh - var(--app-header-height));
    min-height: calc(100dvh - var(--app-header-height));
    max-height: calc(100dvh - var(--app-header-height));
    overflow: hidden;
    padding-bottom: 0;
  }
}

@media (max-width: 768px) {
  .app-shell {
    --app-header-height: calc(54px + env(safe-area-inset-top, 0px));
  }

  .main-content {
    height: calc(100vh - var(--app-header-height));
    min-height: calc(100vh - var(--app-header-height));
    max-height: calc(100vh - var(--app-header-height));
    height: calc(100dvh - var(--app-header-height));
    min-height: calc(100dvh - var(--app-header-height));
    max-height: calc(100dvh - var(--app-header-height));
    overflow: hidden;
    padding-bottom: 0;
  }
}

@media (max-width: 1024px) and (orientation: landscape) and (max-height: 540px) {
  .app-shell {
    --app-header-height: calc(50px + env(safe-area-inset-top, 0px));
  }
}
</style>
