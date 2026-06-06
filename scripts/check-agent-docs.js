import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath))
const normalize = (content) => (content.endsWith('\n') ? content : `${content}\n`)
const render = (template, values) => template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key] ?? '')

const walk = (relativeDir) => {
  const dir = path.join(root, relativeDir)
  if (!fs.existsSync(dir)) return []
  const result = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const rel = path.relative(root, full).replaceAll(path.sep, '/')
    if (entry.isDirectory()) {
      result.push(...walk(rel))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      result.push(rel)
    }
  }
  return result
}

const activeDocs = [
  'AGENTS.md',
  'CLAUDE.md',
  ...walk('.agents'),
  ...walk('.trae/rules'),
  ...walk('.claude/skills')
].filter((item, index, all) => all.indexOf(item) === index)

const errors = []
const warnings = []

const packageJson = JSON.parse(read('package.json'))
const scriptNames = new Set(Object.keys(packageJson.scripts || {}))

const stalePatterns = [
  { pattern: /\bSidebarPanel\.vue\b/, message: '引用了已移除的 SidebarPanel.vue' },
  { pattern: /\buseSidebar\b/, message: '引用了已移除的 useSidebar' },
  { pattern: /\buseStudentData\.js\b/, message: '学生数据文件已迁移为 useStudentData.ts' },
  { pattern: /\buseTagData\.js\b/, message: '标签数据文件已迁移为 useTagData.ts' },
  { pattern: /\buseZoneData\.js\b/, message: '区域数据文件已迁移为 useZoneData.ts' },
  { pattern: /单页应用，无路由/, message: '当前项目已使用 vue-router' },
  { pattern: /\bnpm run deploy:test\b/, message: 'package.json 中没有 deploy:test 脚本' }
]

for (const doc of activeDocs) {
  const content = read(doc)
  const lines = content.split(/\r?\n/)
  for (const stale of stalePatterns) {
    lines.forEach((line, index) => {
      if (stale.pattern.test(line)) {
        errors.push(`${doc}:${index + 1} ${stale.message}`)
      }
    })
  }

  const commandMatches = content.matchAll(/\bnpm run ([\w:-]+)/g)
  const isPlatformReference = doc.startsWith('.agents/retiehe_web_host/')
    || doc === '.agents/rules/Retinbox Web Hosting Documentation.md'
    || doc.startsWith('.trae/rules/rth-')
  for (const match of commandMatches) {
    if (!isPlatformReference && !scriptNames.has(match[1])) {
      errors.push(`${doc} 引用了不存在的 npm script: ${match[1]}`)
    }
  }
}

const sharedGuide = read('.agents/project/shared-agent-guide.md')
const agentTemplate = read('.agents/templates/agent-entry.md.tpl')
const traeTemplate = read('.agents/templates/trae-project-architecture.md.tpl')
const expectedGenerated = {
  'AGENTS.md': render(agentTemplate, {
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
  }),
  'CLAUDE.md': render(agentTemplate, {
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
  }),
  '.trae/rules/project-architecture.md': render(traeTemplate, {
    TRAE_RULES: [
      '- Trae 的 `.trae/rules/*` 作为薄入口使用，公共项目知识以 `.agents/project/shared-agent-guide.md` 和 `.agents/features/` 为准。',
      '- Trae 规则里的 `globs` 只负责触发范围，不代表唯一知识来源；复杂模块仍需读取对应 `.agents/features/*.md`。',
      '- 修改既有文件优先使用局部编辑工具，不要用全文件覆盖替代小 diff。',
      '- 不自动运行 `npm run dev`、构建、部署或 Git 提交；只有用户明确要求时才执行。',
      '- 旧 `.trae/documents/` 和 `.trae/specs/` 视为历史计划，除非用户点名，不作为当前实现依据。'
    ].join('\n'),
    SHARED_GUIDE: sharedGuide
  })
}

for (const [target, expected] of Object.entries(expectedGenerated)) {
  if (normalize(read(target)) !== normalize(expected)) {
    errors.push(`${target} 与统一模板不同步，请运行 npm run docs:sync`)
  }
}

if (!read('.agents/features/README.md').includes('09-security-enhancements.md')) {
  errors.push('.agents/features/README.md 未索引 09-security-enhancements.md')
}

if (!read('AGENTS.md').includes('09-security-enhancements.md')) {
  errors.push('AGENTS.md 未索引 09-security-enhancements.md')
}

const temporaryDocNames = fs.existsSync(path.join(root, 'docs'))
  ? fs.readdirSync(path.join(root, 'docs')).filter((name) => /(?:UPDATE|REPORT|SUMMARY|IMPLEMENTATION)\.md$/i.test(name))
  : []
for (const name of temporaryDocNames) {
  warnings.push(`docs/${name} 命名像临时文档，建议整合到 .agents/features/ 或长期 docs 中`)
}

if (!exists('src/router/index.ts')) {
  errors.push('共享指南声明使用 vue-router，但 src/router/index.ts 不存在')
}

for (const warning of warnings) {
  console.warn(`warning: ${warning}`)
}

if (errors.length > 0) {
  console.error(errors.map((error) => `error: ${error}`).join('\n'))
  process.exit(1)
}

console.log(`agent docs ok (${activeDocs.length} active docs checked, ${warnings.length} warnings)`)
