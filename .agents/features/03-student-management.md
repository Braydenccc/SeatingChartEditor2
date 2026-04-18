---
module_name: Student & Data Management
description: 提供学生数据的增删改查、以及与 Excel 双向互通的完整实现。
related_files:
  - src/composables/useStudentData.js
  - src/composables/useExcelData.js
---

# 03-学生与数据处理 (Student & Data Management)

## 1. 核心职责 (Core Purpose)
解耦学生数据与座位。提供对学生列表的排序、标签绑定以及利用 `xlsx-js-style` 来解析用户上传的表格并转换成内化数据模型。

## 2. 源代码入口 (Source Files)
- 学生数据 Store: `src/composables/useStudentData.js`
- 标签数据 Store: `src/composables/useTagData.js`
- Excel数据处理: `src/composables/useExcelData.js`

## 3. 核心 API 暴露 (Core Internal Logic)

```typescript
// useStudentData.js
export function useStudentData() {
  const students = ref<Student[]>([])
  
  // -> 这里的 sortedStudents 才是给 UI 用的
  // 排序规则：没有学号的空白人 -> 学号从小到大
  const sortedStudents = computed(...) 
  
  // 更新时自带防重机制
  const updateStudent = (studentId, studentData) => { ... }
}
```

```javascript
// useExcelData.js
// -> 巨无霸模块的“按需动态导入”优化点
export const xlsxInstance = shallowRef(null)
export const loadXlsx = async () => {
    if (xlsxInstance.value) return xlsxInstance.value
    const mod = await import('xlsx-js-style')
    xlsxInstance.value = mod.default || mod
    return xlsxInstance.value
}
```

## 4. 关键实现节点 (Implementation Details)
- **学号抢夺防冲突 (`updateStudent`)**: 如果发现修改的目标学号已被另一名同学拥有，系统不会拦截报错，而是**将另一个同学的 `studentNumber` 置为 null**，以此保证班级学号的唯一性。
- **动态列头解析 (`importFromExcel`)**: 第 1、2 列强绑定为【学号】【姓名】。第 3 列之后所有的列，会读取 Header 生成【标签】（Tag）。只要该行单元格值为 `1`、`是`、`✓` 等非空非 0 字符串，就认为该学生持有对应列的标签。
- **标签去重与防腐**: 导进来的所有标签均会被推入全局 `useTagData` 进行统一管理，并通过生成颜色给前端赋能。在存入时依赖 `new Set()` 和 `.filter(Boolean)` 清洗空值。

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **Lazy Load 依赖**: `useExcelData.js` 由于引入了 `xlsx-js-style` 这个非常巨大的包，绝不能使用顶层 `import`，必须通过封装好的 `loadXlsx()` 来异步获取它。如果你在这个文件里写了顶层导入，会导致首屏构建体积爆炸。
- **选中态悬空**: 如果您编写了一个批量删除学生的组件，务必调用 `clearSelection()` 防止 `selectedStudentId` 仍保留着被删除实体的 ID 造成组件崩溃。
- **标签显示模式**: 学生列表支持多种标签显示模式（完整显示、仅图标、隐藏等），通过 `useStudentData` 中的配置控制。修改标签渲染逻辑时需要考虑不同显示模式下的兼容性。
- **学号唯一性**: 系统通过"抢夺式"机制保证学号唯一性。当为学生A设置已被学生B占用的学号时，学生B的学号会被自动清空。这是设计行为，不是bug。
