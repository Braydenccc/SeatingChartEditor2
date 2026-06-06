<template>
  <div class="workbench-dialog-host">
    <SeatConfigDialog
      v-if="activeWorkbenchDialog === 'seatConfig'"
      :visible="activeWorkbenchDialog === 'seatConfig' && !isWorkbenchDialogHidden"
      :is-confirming="isConfirming('applyConfig').value"
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

<script setup>
import { defineAsyncComponent } from 'vue'
import SeatConfigDialog from '@/components/layout/SeatConfigDialog.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useEditorWorkbench } from '@/composables/useEditorWorkbench'
import { useLogger } from '@/composables/useLogger'
import { useSeatChart } from '@/composables/useSeatChart'

const ShiftRotationDialog = defineAsyncComponent(() => import('./dialogs/ShiftRotationDialog.vue'))
const ZoneRotationDialog = defineAsyncComponent(() => import('./dialogs/ZoneRotationDialog.vue'))
const AssignmentWorkbenchDialog = defineAsyncComponent(() => import('./dialogs/AssignmentWorkbenchDialog.vue'))

const {
  activeWorkbenchDialog,
  assignmentWorkbenchPanel,
  focusedRuleId,
  isWorkbenchDialogHidden,
  closeDialog
} = useEditorWorkbench()
const { requestConfirm, isConfirming } = useConfirmAction()
const { updateConfig } = useSeatChart()
const { success, warning } = useLogger()

const handleDialogVisible = (visible) => {
  if (!visible) closeDialog()
}

const handleSeatConfigConfirm = (newConfig) => {
  const confirmed = requestConfirm('applyConfig', () => {
    updateConfig(newConfig)
    closeDialog()
    success('座位配置已更新')
  }, '再次点击确认应用')

  if (!confirmed) {
    warning('再次点击"应用配置"按钮以确认更新座位布局')
  }
}
</script>

<style scoped>
.workbench-dialog-host {
  display: contents;
}
</style>
