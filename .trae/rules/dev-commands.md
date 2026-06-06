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
- 不自动 build：开发完成后不自动运行 npm run build 测试
- 不自动启动 dev：开发完成后不自动运行 npm run dev 打开开发服务器

## GitHub Issue 提交规范

发现项目问题时，需提交到 GitHub Issues。必须遵循以下规范：

### 标签要求

每个 Issue 必须包含 **两个标签**：
- **`agent`** — 必须添加，标识为 Agent 发现的问题
- **`Bug`** 或 **`功能建议`** — 二选一
  - `Bug`：代码缺陷、功能异常
  - `功能建议`：功能建议、优化改进

### 提交方式

使用 `github-operator` 智能体提交 Issue：

```javascript
Task({
  subagent_type: "github-operator",
  query: "创建 GitHub Issue：title: <标题>, body: <问题描述>, labels: agent,Bug",
  description: "创建 GitHub Issue"
})
```

### Issue 模板要求

- **标题格式**：`[<严重程度>] <简短描述>`
  - 严重程度：`严重`/`高危`/`中等`/`低`
  - 示例：`[严重] EditorWorkbench 移动抽屉状态未同步`
- **正文结构**：
  1. 问题描述
  2. 影响范围
  3. 代码位置（具体文件和行号）
  4. 修复建议（可选）
