<script setup lang="ts">
import {
  NConfigProvider,
  NDialogProvider,
  NLoadingBarProvider,
  NMessageProvider,
  NNotificationProvider,
  dateZhCN,
  zhCN
} from 'naive-ui'
import { useNaiveTheme } from '@/theme/useNaiveTheme'
import UiApiBridge from './UiApiBridge.vue'

const { theme, themeOverrides } = useNaiveTheme()
</script>

<template>
  <NConfigProvider :theme="theme" :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN">
    <NLoadingBarProvider>
      <NDialogProvider>
        <NNotificationProvider placement="top-right">
          <NMessageProvider placement="top-right" :max="4">
            <UiApiBridge />
            <slot />
          </NMessageProvider>
        </NNotificationProvider>
      </NDialogProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>

