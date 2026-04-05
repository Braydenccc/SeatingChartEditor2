# CLAUDE.md

本文档提供该存储库的开发指南。详细的项目规范、架构和编码标准已迁移至 **[.agents/rules/项目规范.md](file:///.agents/rules/项目规范.md)**。

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器 (运行在 http://localhost:5173 或下一个可用端口)
npm run dev

# 构建生产版本
npm run build

# 预览生产构建结果
npm run preview
```

## 核心准则

- **共享状态**: 使用 Vue 3 组合式 API 的共享状态模式（单例模式），不使用 Pinia。
- **中文文档**: 所有项目规则和文档应使用中文编写。
- **禁止表情**: 严禁在代码、注释或 UI 中使用 Emoji 图标。
- **布局限制**: `App.vue` 具有严格的高度限制，不要随意修改。

更多详情请参阅 [.agents/rules/项目规范.md](file:///.agents/rules/项目规范.md)。

