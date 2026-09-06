<script setup lang="ts">
import { computed, ref, useId, type CSSProperties } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { NCard, NDrawer, NDrawerContent, NModal } from 'naive-ui'

const props = withDefaults(defineProps<{
  show: boolean
  title: string
  busy?: boolean
  maskClosable?: boolean
  closeOnEsc?: boolean
  desktopWidth?: number | string
  mobileHeight?: number | string
  beforeClose?: () => boolean | Promise<boolean>
}>(), {
  busy: false,
  maskClosable: true,
  closeOnEsc: true,
  desktopWidth: 680,
  mobileHeight: 'min(82dvh, 760px)'
})

const emit = defineEmits<{ 'update:show': [value: boolean] }>()
const titleId = `${useId()}-title`
const isMobile = useMediaQuery('(max-width: 768px)')
const drawerHeight = computed(() => typeof props.mobileHeight === 'number' ? `${props.mobileHeight}px` : props.mobileHeight)
const desktopCardStyle = computed<CSSProperties>(() => ({
  width: typeof props.desktopWidth === 'number' ? `${props.desktopWidth}px` : props.desktopWidth,
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100dvh - 32px)',
  overflow: 'hidden'
}))
const overlayContentStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'auto'
}
const isClosing = ref(false)

const requestClose = async () => {
  if (props.busy || isClosing.value) return
  isClosing.value = true
  try {
    if (props.beforeClose && !await props.beforeClose()) return
    emit('update:show', false)
  } finally {
    isClosing.value = false
  }
}

const handleUpdateShow = (value: boolean) => {
  if (!value) void requestClose()
}
</script>

<template>
  <NDrawer
    v-if="isMobile"
    :show="show"
    placement="bottom"
    :height="drawerHeight"
    :mask-closable="maskClosable && !busy"
    :close-on-esc="closeOnEsc && !busy"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
    :aria-busy="busy"
    @update:show="handleUpdateShow"
  >
    <NDrawerContent
      :closable="!busy"
      :native-scrollbar="false"
      :body-content-style="overlayContentStyle"
    >
      <template #header><span :id="titleId">{{ title }}</span></template>
      <slot />
      <template v-if="$slots.footer" #footer><slot name="footer" /></template>
    </NDrawerContent>
  </NDrawer>

  <NModal
    v-else
    :show="show"
    :mask-closable="maskClosable && !busy"
    :close-on-esc="closeOnEsc && !busy"
    @update:show="handleUpdateShow"
  >
    <NCard
      :style="desktopCardStyle"
      :content-style="overlayContentStyle"
      :closable="!busy"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-busy="busy"
      @close="requestClose"
    >
      <template #header><span :id="titleId">{{ title }}</span></template>
      <slot />
      <template v-if="$slots.footer" #footer><slot name="footer" /></template>
    </NCard>
  </NModal>
</template>
