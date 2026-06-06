import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const write = (relativePath, content) => {
  const target = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content.endsWith('\n') ? content : `${content}\n`)
}

const render = (template, values) => template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key] ?? '')

const sharedGuide = read('.agents/project/shared-agent-guide.md')
const agentTemplate = read('.agents/templates/agent-entry.md.tpl')
const traeTemplate = read('.agents/templates/trae-project-architecture.md.tpl')

const targets = [
  {
    path: 'AGENTS.md',
    template: agentTemplate,
    values: {
      TITLE: 'AGENTS.md',
      INTRO: 'This file provides guidance to Codex when working with code in this repository.',
      AGENT_RULES: [
        '- Codex 修改文件优先使用 `apply_patch` 做局部 diff。',
        '- 搜索文件和文本优先使用 `rg` / `rg --files`；读取多个文件时可并行读取。',
        '- 运行命令使用 Codex shell 工具；需要网络、GUI、越权写入或潜在破坏性操作时，必须按 Codex 权限机制请求审批。',
        '- 不用 Write 类全量覆盖方式修改既有文件；除非用户明确要求，不自动启动 dev server 或构建。',
        '- 不自动创建 Git 提交、分支、PR 或 GitHub Issue，除非用户明确要求。',
        '- 执行 Bug 修复任务时使用 `.agents/skills/bugfix/SKILL.md`。'
      ].join('\n'),
      SHARED_GUIDE: sharedGuide
    }
  },
  {
    path: 'CLAUDE.md',
    template: agentTemplate,
    values: {
      TITLE: 'CLAUDE.md',
      INTRO: 'This file provides guidance to Claude Code when working with code in this repository.',
      AGENT_RULES: [
        '- Claude Code 修改现有文件前必须先读取文件内容。',
        '- 修改现有文件优先使用 Edit；仅在创建新文件或完整重写时使用 Write。',
        '- 使用 Bash/Read/Grep/Edit/Write 等 Claude 工具时，仍以本项目 `.agents/project/shared-agent-guide.md` 为准。',
        '- 搜索优先使用 Grep/Glob 或命令行 `rg`；不要因为工具名不同而跳过 `.agents/features/` 深度文档。',
        '- 需要执行构建、启动开发服务器、部署或提交 Git 时，必须先确认用户明确要求。',
        '- 不自动创建 Git 提交、分支、PR 或 GitHub Issue，除非用户明确要求。'
      ].join('\n'),
      SHARED_GUIDE: sharedGuide
    }
  },
  {
    path: '.trae/rules/project-architecture.md',
    template: traeTemplate,
    values: {
      TRAE_RULES: [
        '- Trae 的 `.trae/rules/*` 作为薄入口使用，公共项目知识以 `.agents/project/shared-agent-guide.md` 和 `.agents/features/` 为准。',
        '- Trae 规则里的 `globs` 只负责触发范围，不代表唯一知识来源；复杂模块仍需读取对应 `.agents/features/*.md`。',
        '- 修改既有文件优先使用局部编辑工具，不要用全文件覆盖替代小 diff。',
        '- 不自动运行 `npm run dev`、构建、部署或 Git 提交；只有用户明确要求时才执行。',
        '- 旧 `.trae/documents/` 和 `.trae/specs/` 视为历史计划，除非用户点名，不作为当前实现依据。'
      ].join('\n'),
      SHARED_GUIDE: sharedGuide
    }
  }
]

for (const target of targets) {
  write(target.path, render(target.template, target.values))
  console.log(`synced ${target.path}`)
}
