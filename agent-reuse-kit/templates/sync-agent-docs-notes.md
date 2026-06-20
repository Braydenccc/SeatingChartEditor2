# 多入口 Agent 文档同步经验

当前项目采用过的有效模式是：一个共享真源，加多个薄入口。

## 推荐结构

```text
.agents/
├── project/
│   └── shared-agent-guide.md
├── templates/
│   ├── agent-entry.md.tpl
│   └── trae-project-architecture.md.tpl
├── features/
│   ├── README.md
│   └── <feature>.md
└── skills/
    └── bugfix/
        └── SKILL.md

AGENTS.md
CLAUDE.md
.trae/rules/project-architecture.md
scripts/sync-agent-docs.js
```

## 为什么这样做

- `AGENTS.md`、`CLAUDE.md`、Trae 规则等入口各有工具差异，但项目知识应该只有一个真源。
- 入口文档保持轻薄，可以减少漂移。
- 复杂功能知识放 `.agents/features/`，避免把入口文档变成巨大说明书。
- 工作流放 `.agents/skills/`，方便在特定任务触发，例如 Bug 修复。

## 同步脚本要点

- 读取 `.agents/project/shared-agent-guide.md`。
- 读取模板文件。
- 将工具专属规则填入模板占位符。
- 写出 `AGENTS.md`、`CLAUDE.md` 等入口文件。
- 提供 `docs:sync` 和 `docs:check` 两个命令：前者生成，后者检查漂移。

## 写文档时的边界

- 入口文档：工具专属规则、共享真源引用、关键禁令。
- 共享指南：项目架构、命令、通用准则。
- 功能文档：模块职责、数据结构、流程、坑点、测试入口。
- 技能文档：特定任务的操作流程，例如 bugfix、deploy、release。

## 迁移提醒

新项目不要直接复制旧项目的业务架构章节。应该只复制文档结构和规则表达方式，再用新项目实际事实填充。

