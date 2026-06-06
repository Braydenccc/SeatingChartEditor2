<template>
  <AppPageShell title="导出" eyebrow="图片与 Excel">
    <ExportPreview
      :visible="true"
      presentation="embedded"
      :initial-tab="initialTab"
      @close="router.push('/editor')"
    />
  </AppPageShell>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppPageShell from '@/components/layout/AppPageShell.vue'
import ExportPreview from '@/components/layout/ExportPreview.vue'

const route = useRoute()
const router = useRouter()

const initialTab = computed(() => route.query.tab === 'excel' ? 'excel' : 'image')
</script>
