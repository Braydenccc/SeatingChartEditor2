# AGENTS.md

This file provides guidance to Codex and other coding agents when working with code in this repository.

## 本 Agent 专属规则

- 修改文件优先使用局部 diff；Codex 优先使用 `apply_patch`。
- 搜索文件和文本优先使用 `rg` / `rg --files`；读取多个文件时可以并行读取。
- 修改既有文件前先读取相关上下文，不用全量覆盖替代小范围编辑。
- 需要网络、GUI、越权写入、部署、删除文件或潜在破坏性操作时，必须遵守当前工具的权限机制。
- 除非用户明确要求，不自动启动 dev server，不自动运行完整构建，不自动部署。
- 除非用户明确要求，不自动创建 Git 提交、分支、PR、Issue。
- 遇到用户已有改动时不要回滚；先判断是否相关，相关则合并处理，不相关则绕开。
- Bug 修复任务优先按 `.agents/skills/bugfix/SKILL.md` 执行。

## 多 Agent 共享指南

本项目的 agent 文档建议采用“一个真源、多入口”的结构：

- `.agents/project/shared-agent-guide.md`：项目公共规则真源。
- `AGENTS.md`：Codex 入口。
- `CLAUDE.md`、`.trae/rules/project-architecture.md` 等：其他工具入口。
- `.agents/features/`：复杂功能、领域模型、排查经验的沉淀目录。
- `.agents/skills/`：可复用工作流，例如 bugfix、release、deploy。

入口文档只放工具专属规则和指向共享真源的说明；不要在多个入口里手动维护同一份完整规则。

## 开发命令

按新项目实际情况填写：

| 命令 | 说明 |
| --- | --- |
| `<开发命令>` | 启动开发服务器 |
| `<测试命令>` | 运行测试 |
| `<类型检查命令>` | 运行类型检查 |
| `<构建命令>` | 构建生产版本 |
| `<文档同步命令>` | 从真源同步 agent 入口文档 |

运行规则：

- 优先运行和改动相关的最小测试。
- 完整构建、开发服务器、部署命令只在用户明确要求或当前任务明确需要时执行。
- 如果某个命令不存在，不要在文档、回复或流程里假设它存在。

## 核心准则

- 禁止在代码、注释或 UI 中使用 Emoji，除非项目明确允许。
- 新文件优先使用项目当前主语言和主目录约定。
- 不直接修改构建产物目录，例如 `dist/`、`build/`、`.next/`。
- 临时测试脚本放到约定的临时目录，不放进正式源码目录。
- 用户可见功能、入口、工作流、限制条件或排查步骤变化时，同步更新用户文档或应用内帮助。
- 功能变更优先更新对应功能文档，不新建临时的 `*-UPDATE.md`、`*-REPORT.md`、`*-SUMMARY.md` 作为长期文档。
- 图标、颜色、命名、目录等风格约定必须跟随项目已有设计系统。

## 深度文档

复杂模块修改前优先查阅：

- `.agents/features/README.md`
- `.agents/features/<feature-name>.md`
- `.agents/rules/<project-rule>.md`

当新项目出现稳定模块时，及时把模块职责、数据流、常见陷阱和测试入口沉淀到 `.agents/features/`。

## GitHub Issue 规范

只有用户明确要求创建 Issue 时才创建。

建议标签：

- `agent`
- `Bug` 或 `功能建议`

建议标题格式：

```text
[<严重程度>] <简短描述>
```

严重程度建议使用：`严重`、`高危`、`中等`、`低`。

