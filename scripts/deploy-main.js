import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export class MainDeploySafetyError extends Error {
  constructor(message, options = {}) {
    super(message, options)
    this.name = 'MainDeploySafetyError'
  }
}

const normalizeOutput = value => String(value ?? '').trim()

const defaultRunGit = ({ args, repositoryRoot }) => spawnSync('git', args, {
  cwd: repositoryRoot,
  encoding: 'utf8',
  windowsHide: true
})

const redactEndpoint = (value, endpoint) => {
  let redacted = String(value ?? '')
  if (!endpoint) return redacted

  redacted = redacted.split(endpoint).join('<origin-endpoint>')
  return redacted.replace(
    /([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi,
    '$1<redacted>@'
  )
}

const describeGitFailure = (args, result, sensitiveEndpoint = '') => {
  const safeArgs = args.map(argument => redactEndpoint(argument, sensitiveEndpoint))
  const detail = normalizeOutput(redactEndpoint(result.stderr, sensitiveEndpoint))
    || normalizeOutput(redactEndpoint(result.stdout, sensitiveEndpoint))
  const suffix = detail ? `：${detail}` : ''
  return `Git 命令失败（git ${safeArgs.join(' ')}）${suffix}`
}

const runGit = ({
  args,
  repositoryRoot,
  runner,
  acceptedStatuses = [0],
  sensitiveEndpoint = ''
}) => {
  const result = runner({ args, repositoryRoot })
  const status = typeof result?.status === 'number' ? result.status : 1
  if (acceptedStatuses !== null && !acceptedStatuses.includes(status)) {
    throw new MainDeploySafetyError(describeGitFailure(args, result, sensitiveEndpoint))
  }
  return { ...result, status }
}

const readGit = options => normalizeOutput(runGit(options).stdout)

const splitOutputLines = value => {
  const output = String(value ?? '')
  if (!output) return []

  const lines = output.split(/\r\n|\n|\r/)
  if (lines.at(-1) === '') lines.pop()
  return lines
}

const defaultFileHasContent = filePath => {
  try {
    return statSync(filePath).size > 0
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return false
    throw new MainDeploySafetyError('无法确认 Git 历史替换状态，已拒绝部署', { cause: error })
  }
}

const defaultPathExists = filePath => {
  try {
    statSync(filePath)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return false
    throw new MainDeploySafetyError('无法确认 Git 操作状态，已拒绝部署', { cause: error })
  }
}

const assertNoInProgressOperation = ({ repositoryRoot, runner, pathExists }) => {
  for (const refName of [
    'MERGE_HEAD',
    'REBASE_HEAD',
    'CHERRY_PICK_HEAD',
    'REVERT_HEAD',
    'BISECT_START'
  ]) {
    const result = runGit({
      args: ['rev-parse', '--quiet', '--verify', refName],
      repositoryRoot,
      runner,
      acceptedStatuses: [0, 1]
    })
    if (result.status === 0) {
      throw new MainDeploySafetyError(`检测到未完成的 Git 操作（${refName}），已拒绝部署`)
    }
  }

  for (const operationPathName of [
    'rebase-merge',
    'rebase-apply',
    'sequencer',
    'BISECT_START'
  ]) {
    const operationPathValue = readGit({
      args: ['rev-parse', '--git-path', operationPathName],
      repositoryRoot,
      runner
    })
    if (!operationPathValue) {
      throw new MainDeploySafetyError('无法确认 Git 操作状态，已拒绝部署')
    }
    const operationPath = path.isAbsolute(operationPathValue)
      ? operationPathValue
      : path.resolve(repositoryRoot, operationPathValue)
    let operationExists
    try {
      operationExists = pathExists(operationPath)
    } catch (error) {
      if (error instanceof MainDeploySafetyError) throw error
      throw new MainDeploySafetyError('无法确认 Git 操作状态，已拒绝部署', { cause: error })
    }
    if (operationExists !== false) {
      throw new MainDeploySafetyError(
        `检测到未完成的 Git 操作（${operationPathName}），已拒绝部署`
      )
    }
  }
}

const assertSingleOriginEndpoint = ({ repositoryRoot, runner }) => {
  const fetchUrls = splitOutputLines(runGit({
    args: ['remote', 'get-url', '--all', 'origin'],
    repositoryRoot,
    runner
  }).stdout)
  const pushUrls = splitOutputLines(runGit({
    args: ['remote', 'get-url', '--push', '--all', 'origin'],
    repositoryRoot,
    runner
  }).stdout)

  if (
    fetchUrls.length !== 1 ||
    pushUrls.length !== 1 ||
    fetchUrls[0].length === 0 ||
    pushUrls[0].length === 0
  ) {
    throw new MainDeploySafetyError('origin 必须配置唯一的 fetch/push endpoint，已拒绝部署')
  }
  if (fetchUrls[0] !== pushUrls[0]) {
    throw new MainDeploySafetyError('origin 的 fetch 与 push 必须绑定同一实际 endpoint，已拒绝部署')
  }
  return fetchUrls[0]
}

const assertNoHistoryOverrides = ({ repositoryRoot, runner, fileHasContent }) => {
  const replacements = readGit({
    args: ['replace', '-l'],
    repositoryRoot,
    runner
  })
  if (replacements) {
    throw new MainDeploySafetyError('检测到 Git replace 历史替换，已拒绝部署')
  }

  const graftPathValue = readGit({
    args: ['rev-parse', '--git-path', 'info/grafts'],
    repositoryRoot,
    runner
  })
  if (!graftPathValue) {
    throw new MainDeploySafetyError('无法确认 Git graft 状态，已拒绝部署')
  }
  const graftPath = path.isAbsolute(graftPathValue)
    ? graftPathValue
    : path.resolve(repositoryRoot, graftPathValue)
  if (fileHasContent(graftPath)) {
    throw new MainDeploySafetyError('检测到 legacy Git graft 历史替换，已拒绝部署')
  }
}

const parseRemoteHead = output => {
  const firstLine = normalizeOutput(output).split(/\r?\n/, 1)[0]
  const [sha, refName] = firstLine.split(/\s+/)
  if (!/^[0-9a-f]{40}$/i.test(sha || '') || refName !== 'refs/heads/main') {
    throw new MainDeploySafetyError('无法确认 origin/main 的远端提交，已拒绝报告部署成功')
  }
  return sha.toLowerCase()
}

export const runSafeMainDeploy = ({
  repositoryRoot = process.cwd(),
  runner = defaultRunGit,
  fileHasContent = defaultFileHasContent,
  pathExists = defaultPathExists,
  log = message => console.log(message)
} = {}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const isWorkTree = readGit({
    args: ['rev-parse', '--is-inside-work-tree'],
    repositoryRoot: resolvedRoot,
    runner
  })
  if (isWorkTree !== 'true') {
    throw new MainDeploySafetyError('当前目录不是 Git 工作树，已拒绝部署')
  }

  const branchResult = runGit({
    args: ['symbolic-ref', '--quiet', '--short', 'HEAD'],
    repositoryRoot: resolvedRoot,
    runner,
    acceptedStatuses: [0, 1]
  })
  const sourceBranch = normalizeOutput(branchResult.stdout)
  if (branchResult.status !== 0 || !sourceBranch) {
    throw new MainDeploySafetyError('当前处于 detached HEAD，无法确认部署来源分支')
  }

  assertNoInProgressOperation({ repositoryRoot: resolvedRoot, runner, pathExists })
  const originEndpoint = assertSingleOriginEndpoint({ repositoryRoot: resolvedRoot, runner })
  assertNoHistoryOverrides({ repositoryRoot: resolvedRoot, runner, fileHasContent })

  const worktreeStatus = readGit({
    args: ['status', '--porcelain=v1', '--untracked-files=all'],
    repositoryRoot: resolvedRoot,
    runner
  })
  if (worktreeStatus) {
    throw new MainDeploySafetyError('工作树存在未提交修改；请先提交或妥善处理后再部署')
  }

  const sourceSha = readGit({
    args: ['rev-parse', 'HEAD'],
    repositoryRoot: resolvedRoot,
    runner
  }).toLowerCase()
  if (!/^[0-9a-f]{40}$/i.test(sourceSha)) {
    throw new MainDeploySafetyError('无法解析当前提交，已拒绝部署')
  }

  const remoteMainRef = 'refs/heads/main'
  const remoteTrackingRef = 'refs/remotes/origin/main'
  const mainFetchRefspec = `+${remoteMainRef}:${remoteTrackingRef}`
  runGit({
    args: ['fetch', '--prune', '--', originEndpoint, mainFetchRefspec],
    repositoryRoot: resolvedRoot,
    runner,
    sensitiveEndpoint: originEndpoint
  })
  const remoteSha = readGit({
    args: ['rev-parse', remoteTrackingRef],
    repositoryRoot: resolvedRoot,
    runner
  }).toLowerCase()
  if (!/^[0-9a-f]{40}$/i.test(remoteSha)) {
    throw new MainDeploySafetyError('无法解析 origin/main，已拒绝部署')
  }

  const ancestry = runGit({
    args: ['--no-replace-objects', 'merge-base', '--is-ancestor', remoteSha, sourceSha],
    repositoryRoot: resolvedRoot,
    runner,
    acceptedStatuses: [0, 1]
  })
  if (ancestry.status !== 0) {
    throw new MainDeploySafetyError(
      '当前提交不是 origin/main 的快进后继；请先在当前分支合并或变基 main，并完成冲突处理'
    )
  }

  if (sourceSha === remoteSha) {
    log(`origin/main 已是当前提交 ${sourceSha.slice(0, 12)}，无需推送`)
    return { sourceBranch, sourceSha, remoteSha, pushed: false }
  }

  log(`准备将 ${sourceBranch}@${sourceSha.slice(0, 12)} 快进发布到 origin/main`)
  const pushArgs = [
    'push',
    `--force-with-lease=${remoteMainRef}:${remoteSha}`,
    '--',
    originEndpoint,
    `${sourceSha}:${remoteMainRef}`
  ]
  const pushResult = runGit({
    args: pushArgs,
    repositoryRoot: resolvedRoot,
    runner,
    acceptedStatuses: null,
    sensitiveEndpoint: originEndpoint
  })
  const pushFailure = pushResult.status === 0
    ? null
    : new MainDeploySafetyError(describeGitFailure(pushArgs, pushResult, originEndpoint))

  let publishedSha
  try {
    publishedSha = parseRemoteHead(readGit({
      args: ['ls-remote', '--heads', '--', originEndpoint, remoteMainRef],
      repositoryRoot: resolvedRoot,
      runner,
      sensitiveEndpoint: originEndpoint
    }))
  } catch (error) {
    const readbackFailure = error instanceof Error ? error.message : String(error)
    if (pushFailure === null) {
      throw new MainDeploySafetyError(
        `部署结果不确定：git push 已返回成功，但无法读回 origin/main 确认远端状态：${readbackFailure}`,
        { cause: error }
      )
    }
    throw new MainDeploySafetyError(
      `部署结果不确定：${pushFailure.message}；远端读回失败：${readbackFailure}`,
      { cause: error }
    )
  }

  if (pushFailure !== null) {
    if (publishedSha === sourceSha) {
      log(`${pushFailure.message}；但 origin/main 已确认更新到 ${sourceSha.slice(0, 12)}`)
      return { sourceBranch, sourceSha, remoteSha, pushed: true }
    }
    if (publishedSha === remoteSha) {
      throw new MainDeploySafetyError(
        `确认本次部署未应用：origin/main 仍为 ${remoteSha.slice(0, 12)}；${pushFailure.message}`,
        { cause: pushFailure }
      )
    }
    throw new MainDeploySafetyError(
      `部署结果不确定：${pushFailure.message}；origin/main 当前为 ${publishedSha.slice(0, 12)}`,
      { cause: pushFailure }
    )
  }

  if (publishedSha !== sourceSha) {
    throw new MainDeploySafetyError(
      `远端 main 校验不一致：期望 ${sourceSha.slice(0, 12)}，实际 ${publishedSha.slice(0, 12)}`
    )
  }

  log(`origin/main 已安全更新到 ${sourceSha.slice(0, 12)}；当前仍停留在 ${sourceBranch}`)
  return { sourceBranch, sourceSha, remoteSha, pushed: true }
}

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  try {
    runSafeMainDeploy()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
