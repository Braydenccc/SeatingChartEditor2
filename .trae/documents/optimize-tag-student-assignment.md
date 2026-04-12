# 优化标签创建逻辑 - 允许在标签管理中给学生添加标签

## 需求分析

当前标签与学生是单向关联：只能从学生侧（StudentItem）给单个学生添加/移除标签。用户希望从标签侧也能批量给学生分配标签，即创建或编辑标签时，可以直接选择哪些学生拥有该标签。

## 现状

- **TagManager.vue**：编辑名单对话框内的标签管理，新建/编辑对话框仅有「名称 + 颜色」
- **TagSettingsDialog.vue**：侧边栏标签设置，新建/编辑对话框同样仅有「名称 + 颜色」
- **StudentItem.vue**：学生行内可添加/移除标签（学生 -> 标签方向）
- **useStudentData.js**：已有 `removeTagFromStudents(tagId)` 批量移除，但缺少批量添加

## 实现方案

### 1. useStudentData.js - 新增批量操作函数

在 `useStudentData` 中新增：

- `addTagToStudents(tagId, studentIds)` - 将标签批量添加到指定学生
- `removeTagFromStudent(tagId, studentId)` - 从单个学生移除标签（已有 `removeTagFromStudents` 批量版，补充单学生版）

### 2. 新建 TagStudentSelector.vue 组件

创建可复用的学生选择器组件，用于在标签对话框中选择学生。

**位置**：`src/components/student/TagStudentSelector.vue`

**Props**：
- `modelValue`: `Number[]` - 已选中的学生ID数组（v-model）
- `tagId`: `Number | null` - 当前标签ID（编辑时用于显示已有分配）

**功能**：
- 搜索框：按姓名/学号过滤学生
- 学生列表：每行显示复选框 + 姓名 + 学号，已选中打勾
- 底部显示已选人数统计
- 最大高度 200px，超出滚动
- 无学生时显示空状态提示

**样式**：
- 品牌色 #23587b 作为复选框选中色
- 圆角 6px，阴影 0 2px 4px rgba(0,0,0,0.08)
- 过渡 all 0.2s ease

### 3. 修改 TagManager.vue

在新建/编辑标签对话框中集成 TagStudentSelector：

**数据层**：
- 引入 `useStudentData` 获取 `students`
- 新增 `selectedStudentIds` ref 追踪选中学生
- 编辑标签时，初始化 `selectedStudentIds` 为当前拥有该标签的学生ID列表

**模板层**：
- 在颜色选择器下方、对话框操作按钮上方，插入 TagStudentSelector
- 对话框标题区分：「新建标签」/「编辑标签」

**逻辑层**：
- 新建标签：emit `add-tag` 事件携带 `{ name, color, studentIds }`
- 编辑标签：emit `edit-tag` 事件携带 `{ id, name, color, studentIds }`
- 新增 emit：`assign-tag-students(tagId, studentIds)` 用于批量分配

### 4. 修改 StudentRosterDialog.vue

处理 TagManager 新增的事件：

- `handleAddTag`：创建标签后，调用 `addTagToStudents(tagId, studentIds)` 批量分配
- `handleEditTag`：编辑标签后，计算学生差异（新增/移除），分别调用对应函数

### 5. 修改 TagSettingsDialog.vue

在新建/编辑标签子对话框中集成 TagStudentSelector：

**数据层**：
- 引入 `useStudentData` 获取 `students`、`addTagToStudents`、`removeTagFromStudent`
- 新增 `selectedStudentIds` ref

**模板层**：
- 在颜色选择器下方插入 TagStudentSelector

**逻辑层**：
- `saveTag`：新建标签后调用 `addTagToStudents`；编辑标签后计算差异并更新
- `editTagHandler`：初始化 `selectedStudentIds` 为当前拥有该标签的学生ID列表

### 6. 学生差异计算逻辑

编辑标签保存时，需要计算新增和移除的学生：

```
新增 = newStudentIds - oldStudentIds
移除 = oldStudentIds - newStudentIds
```

- 新增的学生：`addTagToStudents(tagId, addedIds)`
- 移除的学生：逐个调用 `removeTagFromStudent(tagId, studentId)` 或新增批量函数

## 涉及文件

| 文件 | 操作 |
|---|---|
| `src/composables/useStudentData.js` | 修改 - 新增 `addTagToStudents`、`removeTagFromStudent` |
| `src/components/student/TagStudentSelector.vue` | 新建 - 学生选择器组件 |
| `src/components/student/TagManager.vue` | 修改 - 集成学生选择器 |
| `src/components/student/StudentRosterDialog.vue` | 修改 - 处理学生分配事件 |
| `src/components/student/TagSettingsDialog.vue` | 修改 - 集成学生选择器 |

## 不涉及的文件

- useTagData.js - 标签数据结构不变
- StudentItem.vue - 现有学生侧标签操作保持不变
- 其他组件 - 无需修改
