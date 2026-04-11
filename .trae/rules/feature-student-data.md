---
trigger: conditional
globs:
  - "src/components/student/**"
  - "src/composables/useStudentData.js"
  - "src/composables/useExcelData.js"
  - "src/composables/useTagData.js"
---

# 学生与数据处理

学生数据与座位解耦，排序/标签绑定/Excel 双向互通。

## 关键实现

- sortedStudents：无学号→学号升序
- 学号抢夺：updateStudent 中目标学号已占时，另一同学 studentNumber 置 null
- Excel 列头：1-2列=学号+姓名，3+列=标签(值非空则持有)
- 标签去重：推入 useTagData，Set + filter(Boolean) 清洗
- xlsx-js-style 必须通过 loadXlsx() 异步获取

## 防坑

- Lazy Load：xlsx-js-style 极大，禁止顶层 import
- 选中态悬空：批量删除后务必 clearSelection()