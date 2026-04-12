# 统一确认操作机制

## 概述

项目中所有危险操作（如删除、清空数据、应用配置等）必须使用统一的两次点击确认机制，以防止误操作。

## 使用规则

### 1. 引入 useConfirmAction

```javascript
import { useConfirmAction } from '@/composables/useConfirmAction'

const { requestConfirm, isConfirming, cancelConfirm } = useConfirmAction()
```

### 2. 操作流程

- **第一次点击**：进入确认状态，按钮变红并显示确认提示，同时输出 warning 日志
- **第二次点击**：执行实际操作，输出 success/error 日志
- **超时取消**：3秒内未再次点击则自动取消确认状态
- **点击取消/关闭**：取消确认状态

### 3. 代码实现示例

#### 基本用法

```javascript
const handleDeleteItem = (itemId) => {
  const confirmed = requestConfirm(
    `deleteItem-${itemId}`, // 唯一的操作 key
    () => {
      // 确认后执行的实际操作
      deleteItem(itemId)
      success('删除成功')
    },
    '再次点击确认删除' // 确认状态的按钮文字
  )
  
  if (!confirmed) {
    warning('再次点击按钮以确认操作')
  }
}
```

#### 对话框内使用（按钮变红）

```vue
<template>
  <MyDialog :isConfirming="isConfirming('applyConfig').value">
    <template #footer>
      <button 
        class="confirm-btn" 
        :class="{ 'confirming': isConfirming('applyConfig').value }"
        @click="handleApply"
      >
        <span v-if="isConfirming('applyConfig').value">再次点击确认</span>
        <span v-else>应用</span>
      </button>
    </template>
  </MyDialog>
</template>

<script setup>
const handleApply = () => {
  const confirmed = requestConfirm(
    'applyConfig',
    () => {
      applyConfig()
      dialogVisible.value = false
      success('配置已应用')
    },
    '再次点击确认'
  )
  
  if (!confirmed) {
    warning('再次点击按钮以确认操作')
  }
}
</script>

<style scoped>
.confirm-btn {
  background: linear-gradient(135deg, #23587b, #2d6a94);
  color: white;
}

.confirm-btn.confirming {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
}
</style>
```

### 4. 操作 Key 命名规范

- 格式：`操作名-唯一标识`（如 `deleteTag-123`、`applyConfig`）
- 同一类型的操作使用相同前缀
- 单个操作可以直接使用操作名

### 5. 日志输出规范

- **第一次点击（未确认）**：只输出 warning 日志，不输出其他日志
- **第二次点击（已确认）**：执行操作后输出 success/error 日志
- **失败场景**：无论是否确认，都输出 error 日志

### 6. 样式规范

确认状态按钮样式：

- 背景：红色渐变 `linear-gradient(135deg, #dc2626, #b91c1c)`
- 动画：无（禁用脉冲动画）
- 文字：确认提示文字

### 7. 注意事项

- 操作 key 必须唯一，避免冲突
- 对话框关闭时要调用 `cancelConfirm(key)` 清理状态
- 对话框组件应接受 `isConfirming` prop 并传递给按钮
- 按钮文字应清晰说明操作后果

## 现有使用示例

参考以下组件了解正确的使用方式：

- `src/components/student/TagManager.vue` - 删除标签
- `src/components/layout/SidebarPanel.vue` - 应用座位配置
- `src/components/rule/RuleList.vue` - 删除规则
