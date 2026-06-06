<template>
  <AppPageShell title="名单与属性" eyebrow="学生管理">
    <StudentRosterDialog
      :visible="true"
      presentation="embedded"
      @update:visible="handleVisibleChange"
    />
  </AppPageShell>
</template>

<script setup>
import { useRouter } from 'vue-router'
import AppPageShell from '@/components/layout/AppPageShell.vue'
import StudentRosterDialog from '@/components/student/StudentRosterDialog.vue'

const router = useRouter()

const handleVisibleChange = (visible) => {
  if (!visible) router.push('/editor')
}
</script>
