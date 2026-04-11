---
trigger: conditional
globs:
  - "src/composables/useImageExport.js"
  - "src/composables/useExportSettings.js"
  - "src/components/layout/ExportPreview.vue"
---

# 导出系统

Canvas 2D API 手写渲染，输出 PNG/JPEG 和带样式 XLSX。

## 关键实现

- exportToImage()：返回 Blob Object URL
- A4 逼近：内容宽度对比 A4(3508/2480)，fitScale 一次性 ctx.scale()
- 灰度降级：luminance=0.299R+0.587G+0.114B，深灰时字反相白色
- 讲台反转：exportSettings.reverseOrder 控制渲染顺序和行号

## 防坑

- 内存溢出：MAX_CANVAS_PIXELS=64MB 上限，不能无限延伸画布
- 不用 html2canvas：已弃用，全部 Canvas 2D API 手写。UI 样式变更需**手写对应 Canvas 渲染语句**，CSS 不会自动反映到导出图片