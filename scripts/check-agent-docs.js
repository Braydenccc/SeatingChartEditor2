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
  ...walk('.agents')
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
  for (const match of commandMatches) {
    if (!isPlatformReference && !scriptNames.has(match[1])) {
      errors.push(`${doc} 引用了不存在的 npm script: ${match[1]}`)
    }
  }
}

const sharedGuide = read('.agents/project/shared-agent-guide.md')
const featureIndex = read('.agents/features/README.md')
const featureDocs = fs.readdirSync(path.join(root, '.agents/features'), { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
  .map(entry => entry.name)
  .sort()

for (const featureDoc of featureDocs) {
  if (!featureIndex.includes(`(./${featureDoc})`)) {
    errors.push(`.agents/features/README.md 未索引 ${featureDoc}`)
  }

  if (/^\d{2}-/.test(featureDoc) && !sharedGuide.includes(`.agents/features/${featureDoc}`)) {
    errors.push(`.agents/project/shared-agent-guide.md 未索引 ${featureDoc}`)
  }
}

const agentTemplate = read('.agents/templates/agent-entry.md.tpl')
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
  })
}

for (const [target, expected] of Object.entries(expectedGenerated)) {
  if (normalize(read(target)) !== normalize(expected)) {
    errors.push(`${target} 与统一模板不同步，请运行 npm run docs:sync`)
  }
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
