<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useDialog, useLoadingBar, useMessage, useNotification } from 'naive-ui'
import { useRouteLoading } from '@/composables/useRouteLoading'
import { clearUiApis, registerUiApis } from '@/services/uiFeedback'

const message = useMessage()
const dialog = useDialog()
const notification = useNotification()
const loadingBar = useLoadingBar()
const { isRouteLoading } = useRouteLoading()

registerUiApis({ message, dialog, notification, loadingBar })

watch(isRouteLoading, loading => {
  if (loading) loadingBar.start()
  else loadingBar.finish()
}, { immediate: true })

onBeforeUnmount(clearUiApis)
</script>

<template><span class="ui-api-bridge" aria-hidden="true"></span></template>

<style scoped>
.ui-api-bridge { display: none; }
</style>

