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
  }
]

for (const target of targets) {
  write(target.path, render(target.template, target.values))
  console.log(`synced ${target.path}`)
}
