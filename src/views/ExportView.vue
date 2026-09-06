<template>
  <AppPageShell title="导出" eyebrow="图片与 Excel">
    <ExportPreview
      :visible="true"
      :initial-tab="initialTab"
    />
  </AppPageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppPageShell from '@/components/layout/AppPageShell.vue'
import ExportPreview from '@/components/layout/ExportPreview.vue'

const route = useRoute()

const initialTab = computed(() => route.query.tab === 'excel' ? 'excel' : 'image')
</script>
