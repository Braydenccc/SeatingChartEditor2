---
trigger: conditional
globs:
  - "src/components/**/*.vue"
  - "src/composables/*.js"
---

# 图标库规范

统一使用 **lucide-vue-next**，按需具名导入，禁止全量导入。

## 原则

- 必须：所有图形符号用 Lucide 图标组件
- 禁止：内联 `<svg>`、Unicode 字符（×+−等）充当图标

## 推荐图标

| 场景 | 图标 | 尺寸 |
|------|------|------|
| 关闭/取消 | X | 14–18px |
| 添加 | Plus | 14–16px |
| 编辑 | Pencil | 12–14px |
| 删除 | Trash2 | 14px |
| 缩小/放大 | Minus/Plus | 16px |
| 搜索 | Search | 15px |
| 下载 | Download | 14px |
| 上传 | CloudUpload / Upload | 14px |
| 导出 | FileOutput | 14px |
| 导入 | FileInput | 14px |
| 警告 | AlertTriangle | 16px |
| 展开/收起 | ChevronDown | 14px |
| 空状态 | ClipboardList | 40px |

## Prop 规范

- :size 通过 prop 指定，不用 CSS width/height
- stroke-width：细节2 / 强调2.5 / 装饰1.5
- color 优先父元素继承

## 动态图标

存组件对象用 `<component :is>` 渲染，非字符串。

## 图标按钮

必须 padding:0; display:flex; align-items:center; justify-content:center