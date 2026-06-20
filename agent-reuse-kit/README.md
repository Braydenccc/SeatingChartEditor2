# Agent 规则复用包

这个目录从当前项目的 agent 规则、开发约定和踩坑经验中提取了可复用内容，供新项目初始化时直接复制。这里刻意不包含座位表编辑器的业务模型、文件路径和功能文档，避免把旧项目的领域知识带进新项目。

## 建议复制方式

新项目刚开始时，建议按下面顺序使用：

1. 复制 `templates/AGENTS.template.md` 到新项目根目录，重命名为 `AGENTS.md`。
2. 复制 `templates/shared-agent-guide.template.md` 到新项目的 `.agents/project/shared-agent-guide.md`。
3. 按新项目实际技术栈替换模板中的占位符，例如 `<项目名称>`、`<开发命令>`、`<测试命令>`。
4. 如果需要稳定同步多种 agent 入口，参考 `templates/sync-agent-docs-notes.md` 建立“一个真源、多入口生成”的文档结构。
5. 如果项目会长期用 AI 协作修 Bug，复制 `workflows/bugfix-workflow.md` 到 `.agents/skills/bugfix/SKILL.md`，再替换项目相关路径。

## 文件说明

| 文件 | 用途 |
| --- | --- |
| `templates/AGENTS.template.md` | 新项目根目录 `AGENTS.md` 的可复制模板 |
| `templates/shared-agent-guide.template.md` | 多 Agent 共享规则真源模板 |
| `templates/sync-agent-docs-notes.md` | 多入口 agent 文档同步经验 |
| `workflows/bugfix-workflow.md` | 通用 Bug 修复工作流 |
| `guides/frontend-engineering.md` | 前端工程、UI、文档维护经验 |
| `guides/retinbox-web-hosting.md` | Retinbox Web Hosting 可复用后端经验 |
| `migration-checklist.md` | 新项目落地检查清单 |

## 提取原则

- 保留你的协作偏好：小 diff、先读代码、少自动化破坏、不擅自启动服务或提交 Git。
- 保留可迁移工程经验：文档真源、功能文档沉淀、用户手册同步、测试优先级、前端视觉规范。
- 移除旧项目强绑定内容：座位表领域模型、具体组件树、具体 composable 名称、旧项目命令细节。
- 对平台经验单独存放：Retinbox 规则独立成文，只有新项目也用该平台时再复制。

