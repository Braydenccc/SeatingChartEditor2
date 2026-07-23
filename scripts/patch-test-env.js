import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const defaultTestHost = 'https://testsce.jbyc.cc'

export const testEnvironmentFiles = [
  'index.html',
  'src/components/auth/LoginDialog.vue',
  'src/components/layout/AppHeader.vue'
]

const loginWarning = '本账号服务不保证可用性，请妥善备份您的数据'
const headerTitle = '<h1 class="header-text" data-route-heading tabindex="-1">BraydenSCE V2</h1>'

const countOccurrences = (content, anchor) => content.split(anchor).length - 1

const replaceSingleAnchor = (content, anchor, replacement, description) => {
  const count = countOccurrences(content, anchor)
  if (count !== 1) {
    throw new Error(`${description} 应恰好出现 1 次，实际为 ${count} 次`)
  }
  return content.replace(anchor, replacement)
}

const createPatchPlan = ({ repositoryRoot, testHost, fileSystem }) => {
  const originalContents = new Map(
    testEnvironmentFiles.map(relativePath => [
      relativePath,
      Buffer.from(fileSystem.readFileSync(path.join(repositoryRoot, relativePath)))
    ])
  )
  const contents = new Map(
    [...originalContents].map(([relativePath, content]) => [relativePath, content.toString('utf8')])
  )

  const indexHtml = contents.get('index.html')
  const titlePattern = /(<title(?:\s[^>]*)?>)([\s\S]*?)(<\/title>)/gi
  const titleMatches = [...indexHtml.matchAll(titlePattern)]
  if (titleMatches.length !== 1) {
    throw new Error(`index.html 的 title 标签应恰好出现 1 次，实际为 ${titleMatches.length} 次`)
  }
  const patchedIndexHtml = indexHtml.replace(titlePattern, (_, openTag, title, closeTag) => {
    const cleanedTitle = String(title).trim().replace(/^\[test\]\s*/i, '')
    return `${openTag}[test] ${cleanedTitle}${closeTag}`
  })

  const loginPath = 'src/components/auth/LoginDialog.vue'
  const patchedLogin = replaceSingleAnchor(
    contents.get(loginPath),
    loginWarning,
    `测试环境（${testHost}）：账号与正式版不互通，用户数据可能随时被清除，请勿使用真实账号`,
    `${loginPath} 的账号服务提示锚点`
  )

  const headerPath = 'src/components/layout/AppHeader.vue'
  let patchedHeader = replaceSingleAnchor(
    contents.get(headerPath),
    headerTitle,
    '<h1 class="header-text" data-route-heading tabindex="-1">BraydenSCE V2<span class="test-badge">测试版</span></h1>',
    `${headerPath} 的标题锚点`
  )

  if (!patchedHeader.includes('.test-badge')) {
    patchedHeader = replaceSingleAnchor(
      patchedHeader,
      '</style>',
      `.test-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-warning);
  color: var(--color-text-inverse);
  border: 1px solid color-mix(in srgb, var(--color-text-inverse) 30%, transparent);
  border-radius: 6px;
  padding: 4px 10px;
  margin-left: 12px;
  vertical-align: middle;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  letter-spacing: 0.5px;
}

@media (max-width: 1366px) and (min-width: 1025px) {
  .test-badge {
    font-size: 11px;
    padding: 3px 8px;
    margin-left: 10px;
  }
}

@media (max-height: 820px) and (min-width: 1025px) {
  .test-badge {
    font-size: 10px;
    padding: 3px 7px;
    margin-left: 8px;
  }
}

@media (max-width: 1024px) {
  .test-badge {
    font-size: 11px;
    padding: 3px 8px;
    margin-left: 10px;
  }
}

@media (max-width: 768px) {
  .test-badge {
    font-size: 9px;
    padding: 2px 6px;
    margin-left: 6px;
  }
}
</style>`,
      `${headerPath} 的 style 结束标签`
    )
  }

  return {
    originalContents,
    patchedContents: new Map([
      ['index.html', Buffer.from(patchedIndexHtml, 'utf8')],
      [loginPath, Buffer.from(patchedLogin, 'utf8')],
      [headerPath, Buffer.from(patchedHeader, 'utf8')]
    ])
  }
}

export const patchTestEnvironment = ({
  repositoryRoot = process.cwd(),
  testHost = defaultTestHost,
  fileSystem = fs
} = {}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const { originalContents, patchedContents } = createPatchPlan({
    repositoryRoot: resolvedRoot,
    testHost,
    fileSystem
  })
  const attemptedFiles = []

  // 所有锚点均验证完成后再写入，避免锚点漂移导致部分文件被修改。
  try {
    for (const [relativePath, content] of patchedContents) {
      attemptedFiles.push(relativePath)
      fileSystem.writeFileSync(path.join(resolvedRoot, relativePath), content)
    }
  } catch (writeError) {
    const rollbackErrors = []
    for (const relativePath of [...attemptedFiles].reverse()) {
      try {
        fileSystem.writeFileSync(
          path.join(resolvedRoot, relativePath),
          originalContents.get(relativePath)
        )
      } catch (rollbackError) {
        rollbackErrors.push(new Error(`${relativePath} 回滚失败`, { cause: rollbackError }))
      }
    }

    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [writeError, ...rollbackErrors],
        `测试环境 patch 事务写入失败，且 ${rollbackErrors.length} 个文件回滚失败`
      )
    }
    throw new Error('测试环境 patch 事务写入失败，已回滚所有尝试写入的文件', {
      cause: writeError
    })
  }

  return patchedContents
}

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  try {
    console.log(`Patching test environment markers for ${defaultTestHost}`)
    patchTestEnvironment()
    console.log('Successfully patched files for test environment.')
  } catch (error) {
    console.error('Failed to patch test environment:', error)
    process.exitCode = 1
  }
}
