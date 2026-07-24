<template>
  <div class="workbench-dialog-host">
    <SeatConfigDialog
      v-if="activeWorkbenchDialog === 'seatConfig'"
      :visible="activeWorkbenchDialog === 'seatConfig' && !isWorkbenchDialogHidden"
      :initial-config="seatConfigDialogInitialConfig"
      @update:visible="handleDialogVisible"
      @confirm="handleSeatConfigConfirm"
    />

    <ShiftRotationDialog
      v-if="activeWorkbenchDialog === 'shiftRotation'"
      :visible="activeWorkbenchDialog === 'shiftRotation' && !isWorkbenchDialogHidden"
      @close="closeDialog"
    />

    <ZoneRotationDialog
      v-if="activeWorkbenchDialog === 'zoneRotation'"
      :visible="activeWorkbenchDialog === 'zoneRotation' && !isWorkbenchDialogHidden"
      @close="closeDialog"
    />

    <AssignmentWorkbenchDialog
      v-if="activeWorkbenchDialog === 'assignment'"
      :visible="activeWorkbenchDialog === 'assignment' && !isWorkbenchDialogHidden"
      :initial-panel="assignmentWorkbenchPanel"
      :focus-rule-id="focusedRuleId"
      @close="closeDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import SeatConfigDialog from '@/components/layout/SeatConfigDialog.vue'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'
import type { SeatConfig } from '@/types'

const ShiftRotationDialog = defineAsyncComponent(() => import('./dialogs/ShiftRotationDialog.vue'))
const ZoneRotationDialog = defineAsyncComponent(() => import('./dialogs/ZoneRotationDialog.vue'))
const AssignmentWorkbenchDialog = defineAsyncComponent(() => import('./dialogs/AssignmentWorkbenchDialog.vue'))

const {
  activeWorkbenchDialog,
  assignmentWorkbenchPanel,
  focusedRuleId,
  seatConfigDialogInitialConfig,
  isWorkbenchDialogHidden,
  closeDialog
} = useEditorWorkbench()
const { updateConfig } = useSeatChart()
const { success, confirm } = useLogger()

const handleDialogVisible = (visible: boolean) => {
  if (!visible) closeDialog()
}

const handleSeatConfigConfirm = async (newConfig: Partial<SeatConfig>) => {
  const confirmed = await confirm({
    title: '应用座位配置',
    content: '修改座位布局会保留兼容座位的状态，使不兼容座位上的学生回到候选区，并清空撤销/重做历史。是否继续？',
    positiveText: '应用配置',
    type: 'warning'
  })
  if (!confirmed) return
  const configToApply: Partial<SeatConfig> = {
    ...(seatConfigDialogInitialConfig.value ?? {}),
    ...newConfig
  }
  if (newConfig.groups) {
    configToApply.groups = newConfig.groups.map(group => ({ ...group }))
  }
  updateConfig(configToApply)
  closeDialog()
  success('座位配置已更新')
}
</script>

<style scoped>
.workbench-dialog-host {
  display: contents;
}
</style>
