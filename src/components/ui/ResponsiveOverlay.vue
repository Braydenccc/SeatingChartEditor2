<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
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

const handleMask = () => {
  if (props.maskClosable) void requestClose()
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
    @mask-click="handleMask"
    @esc="requestClose"
    @update:show="value => !value && requestClose()"
  >
    <NDrawerContent
      :title="title"
      closable
      :native-scrollbar="false"
      :body-content-style="overlayContentStyle"
      @close="requestClose"
    >
      <slot />
      <template v-if="$slots.footer" #footer><slot name="footer" /></template>
    </NDrawerContent>
  </NDrawer>

  <NModal
    v-else
    :show="show"
    :mask-closable="maskClosable && !busy"
    :close-on-esc="closeOnEsc && !busy"
    @mask-click="handleMask"
    @esc="requestClose"
    @update:show="value => !value && requestClose()"
  >
    <NCard
      :title="title"
      :style="desktopCardStyle"
      :content-style="overlayContentStyle"
      closable
      role="dialog"
      aria-modal="true"
      @close="requestClose"
    >
      <slot />
      <template v-if="$slots.footer" #footer><slot name="footer" /></template>
    </NCard>
  </NModal>
</template>
