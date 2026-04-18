---
module_name: Export System
description: 极度复杂的高精度排版导出系统，包括 HTML5 Canvas 画布渲染与 Excel 特效输出。
related_files:
  - src/composables/useImageExport.js
  - src/composables/useExcelData.js
---

# 08-导出系统 (Export System)

## 1. 核心职责 (Core Purpose)
将屏幕上的纯 HTML 节点转化为无损/A4 贴合的高清位图 (PNG/JPEG) 和带颜色、带合并单元格的高级 XLSX 文件，供给班主任进行打印机直接落地。

## 2. 源代码入口 (Source Files)
- 画布渲染引擎: `src/composables/useImageExport.js`
- 专属设定表单数据: `src/composables/useExportSettings.js`

## 3. 极简 API 封装

```typescript
export function useImageExport() {
  /**
   * 生成图片数据（不污染DOM）
   * @returns {Promise<string>} Blob Object URL, e.g. "blob:http://..."
   */
  const exportToImage = () => Promise<string>
}
```

## 4. 关键实现节点 (Implementation Details)
- **A4 比例逼近推算**: 在 Canvas 初始化前，会计算出整个表到底有多宽（基于 `SEAT_WIDTH`, `GROUP_GAP`）。随后对比 A4 横纵向 (3508 / 2480) 的纸张长宽比。通过 `Math.min(availW / contentWidth, ...)` 计算出一个全局 `fitScale` 并使用 `ctx.scale()` 一次性缩放全体坐标系统，避免了繁琐的几何重算。
- **黑白/灰度智能对比降级**: 学校打印机绝大部分是黑白的。代码使用 `luminance = 0.299*R + 0.587*G + 0.114*B` 将彩色名牌自动转为灰度，如果深灰，则字自动反相变成 `#ffffff` 白色，防止糊成一团。
- **讲台反转陷阱**: 有些老师习惯看图讲台在自己眼前（排版在底部）；有些习惯贴黑板上（排版在顶部）。这是通过 `exportSettings.value.reverseOrder` 参数控制的，且它不仅影响渲染顺序，还影响行号 (`rowIndex`) 的左侧文本输出！

## 5. AI 开发提示 / 防坑指南 (Vibe Coding Caveats)
- **内存溢出防御**: 导出 Canvas 很容易发生 iPhone 崩溃问题。务必注意文件里的一行核心防御代码：`MAX_CANVAS_PIXELS = 64 * 1024 * 1024 / 4` (约 64MB 上限)。如果拓展画布尺寸，千万不能拿 `seatCount` 无限延伸。
- **不要用 html2canvas**: 这个工具库目前已经弃用。项目完全是通过 `Canvas 2D API`（如 `fillRect`, `fillText`）手写的一笔一划！当 UI 样式微调或者增加什么新图标时，记得**去此文件里手写对应 Canvas 渲染语句**！不要指望加了一段 CSS 导出的图片里就有。
