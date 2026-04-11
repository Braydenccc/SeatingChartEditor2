---
trigger: always_on
---

# 开发命令与核心准则

## 命令

```bash
npm install      # 安装依赖
npm run dev      # 开发服务器 (localhost:5173)
npm run build    # 构建生产版本
npm run preview  # 预览构建结果
```

## 准则

- 共享状态：Composition API 单例，不用 Pinia
- 中文文档：规则和文档用中文
- 禁止表情：代码/注释/UI 严禁 Emoji
- 布局限制：App.vue 严格高度限制，勿随意修改
- 禁止 Base64：项目中任何地方不用 Base64，本地图片用 URL.createObjectURL()