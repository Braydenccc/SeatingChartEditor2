---
module_name: Student & Data Management
description: 提供学生数据的增删改查、以及与 Excel 双向互通的完整实现。
related_files:
  - src/composables/useStudentData.ts
  - src/composables/useExcelData.js
---

# 03-学生与数据处理 (Student & Data Management)

## 1. 核心职责 (Core Purpose)
解耦学生数据与座位。提供对学生列表的排序、标签绑定以及利用 `xlsx-js-style` 来解析用户上传的表格并转换成内化数据模型。

## 2. 源代码入口 (Source Files)
- 学生数据 Store: `src/composables/useStudentData.ts`
- 标签数据 Store: `src/composables/useTagData.ts`
- Excel数据处理: `src/composables/useExcelData.js`

## 3. 核心 API 暴露 (Core Internal Logic)

```typescript
// useStudentData.ts
export function useStudentData() {
  const students = ref<Student[]>([])
  
  // -> 这里的 sortedStudents 才是给 UI 用的
  // 排序规则：没有学号的空白人 -> 学号从小到大
  const sortedStudents = computed(...) 
  
  // 更新时自带防重机制
  const updateStudent = (studentId, studentData) => { ... }
}
```

```typescript
interface Student {
  id: number
  name: string
  studentNumber: number | null
  tags: number[]
  numericAttributes: Record<string, number | null>
}

interface NumericAttributeDefinition {
  id: string
  name: string
  unit: string
  min: number | null
  max: number | null
  precision: number
  enabled: boolean
  builtInKey?: 'height' | 'score'
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
- **数值属性 (`useStudentAttributes`)**: 学生支持 `numericAttributes`，属性定义由独立 composable 管理。默认内置“身高 cm”和“成绩 分”，用户可新增自定义数值属性。删除属性时会同步清理所有学生上的对应值。
- **动态列头解析 (`importFromExcel` / `previewImportFromExcel`)**: 通过表头定位【学号】【姓名】，不要求固定在第 1、2 列。其他列会先判断数值属性列，再按标签列解析。标签列支持 `1`、`是`、`有`、`√`、`true` 等真值标记，`0`、`否`、`无`、`false` 等假值标记会被忽略；非真值/假值文本按分类标签导入（如“男”“女”）。
- **Excel 预览确认 (`useRosterExcelImport`)**: 文件页选择 Excel 或拖拽 Excel 到应用任意位置时，先打开确认窗口，列出识别到的学生、数值属性、标签和问题项。确认前可修改学号、姓名、数值和标签；可选择覆盖所有或新增。存在空姓名、重复学号、追加时与现有学号冲突等问题的行会高亮，确认时跳过问题行并导入其余有效行。
- **数值列解析**: Excel 第 3 列以后默认仍按标签解析；表头匹配已有数值属性、内置别名（身高、成绩等），使用 `数值:` / `属性:` / `标签数值:` 等前缀，或整列明显是非 0/1 数字值时，会解析为 `numericAttributes`。表头兼容 `身高(cm)`、`身高/cm`、`标签数值-纪律分` 等格式，单元格兼容 `150cm`、全角数字和逗号小数。
- **本地 fuckseats 导入**: `src/composables/useFuckSeatsImport.ts` 通过当前同源服务的 `/api/fuckseats-proxy` 探测 `http://127.0.0.1:23948`、`http://localhost:23948`、`http://127.0.0.1:8000`、`http://localhost:8000`，解析 fuckseats 首页班级列表，再读取 `/classroom/<id>/state/` 转成当前工作区结构。导入会覆盖当前名单、标签、座位配置和座位分配；已有数据、非默认座位配置、选区、规则、数值属性或导出设置时 UI 会要求再次点击确认。grid 转大组时优先读取 state 中每格的 `group.id/name`，若显式小组不能形成物理列带，则按整列 `aisle`/`empty`/`podium` 等非普通座位推断大组分隔；组间分隔列折叠为当前编辑器的大组间距，组内非普通座位和源数据缺失的网格坐标会补为不可用座位。若这些格子带有学生则只导入到名单、不绑定到空置座位；重复坐标会拒绝导入。UI 入口在文件页的名单管理区域，编辑页空名单状态和名单弹窗入口会跳转到文件页导入。
- **SDES 交换格式**: `src/composables/useSdesExchange.ts` 支持 SDES v1 JSON 导入导出，入口在文件页。`.sce` 仍是完整工作区备份格式，SDES 只作为跨软件交换格式。导入弹窗会列出文件内所有可导入的 `class/seatChart`，第一版一次只能选择一个并覆盖当前工作区；导入 `groupedColumns` 时按大组、列、行映射，导入 `grid` 时通过 `src/utils/gridToGroupedColumns.ts` 尽量转换为大组列行：优先使用座位 `group`，否则按整列走廊/空列推断分组；组间分隔列会折叠，组内 `aisle`、`empty`、`platform`、`door` 和缺失格会作为空置座位。当前只支持数值属性，字符串/布尔/颜色属性会跳过；当前学号模型是数字，SDES 字符串学号的前导零会在导入报告中提示；左右护法仅支持每侧 `guardPos.index = 0`。导出标准字段包含学生、标签、数值属性、`groupedColumns` 座位表、座位分配、讲台位置和护法位，规则、选区、导出设置等私有数据写入 `extensions.app.bsce`。
- **删除学生清理座位**: `deleteStudent()`、`setStudentCount()` 删除空白学生和 `clearAllStudents()` 会同步清理这些学生在座位表上的 `studentId`，避免座位显示为已删除学生或“未知”。
- **标签去重与防腐**: 导进来的所有标签均会被推入全局 `useTagData` 进行统一管理，并通过生成颜色给前端赋能。在存入时依赖 `new Set()` 和 `.filter(Boolean)` 清洗空值。

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **Lazy Load 依赖**: `useExcelData.js` 由于引入了 `xlsx-js-style` 这个非常巨大的包，绝不能使用顶层 `import`，必须通过封装好的 `loadXlsx()` 来异步获取它。如果你在这个文件里写了顶层导入，会导致首屏构建体积爆炸。
- **本地代理边界**: `server.cjs` 与 `vite.mock.plugin.js` 都实现了 `/api/fuckseats-proxy`，共享 `fuckseats-proxy.config.json` 与 `fuckseatsProxyHelper.cjs` 的校验；仅允许 GET 到本机 `23948` / `8000` 的 `/` 和 `/classroom/<id>/state/`，避免浏览器 CORS 失败，也避免任意 URL 代理。
- **SDES 不是工作区备份**: SDES 导出为了互通只保证标准字段可读；`extensions.app.bsce` 中的规则、选区和导出配置是私有扩展，其他软件可以忽略。修改 SDES 支持时要同步维护 `src/constants/userManual.ts` 中的交换格式限制说明。
- **选中态悬空**: 如果您编写了一个批量删除学生的组件，应复用 `useStudentData` 的删除/清空入口，避免绕过选中态与座位占用清理。
- **标签显示模式**: 学生列表支持多种标签显示模式（完整显示、仅图标、隐藏等），通过 `useStudentData` 中的配置控制。修改标签渲染逻辑时需要考虑不同显示模式下的兼容性。
- **学号唯一性**: 系统通过"抢夺式"机制保证学号唯一性。当为学生A设置已被学生B占用的学号时，学生B的学号会被自动清空。这是设计行为，不是bug。
- **属性字段兼容**: 旧工作区和旧测试数据可能没有 `numericAttributes` 字段，读取或更新学生时必须兜底为空对象。
