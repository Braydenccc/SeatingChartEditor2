import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  defaultTestHost,
  patchTestEnvironment,
  testEnvironmentFiles
} from './patch-test-env.js'

export class TestBuildInterruptedError extends Error {
  constructor(signal, options = {}) {
    const restoreDetail = options.cause instanceof Error ? `；${options.cause.message}` : ''
    super(`测试环境构建被 ${signal} 中断${restoreDetail}`, options)
    this.name = 'TestBuildInterruptedError'
    this.signal = signal
  }
}

export class TestBuildRestoreConflictError extends Error {
  constructor(conflictingFiles) {
    super(`检测到构建期间文件被并发修改，已保留当前内容且未覆盖：${conflictingFiles.join('、')}`)
    this.name = 'TestBuildRestoreConflictError'
    this.conflictingFiles = conflictingFiles
  }
}

export class TestBuildFailedError extends Error {
  constructor({ code, signal }) {
    const detail = signal ? `信号 ${signal}` : `退出码 ${code}`
    super(`Vite 测试环境构建失败：${detail}`)
    this.name = 'TestBuildFailedError'
    this.code = code
    this.signal = signal
  }
}

const snapshotFiles = repositoryRoot => new Map(
  testEnvironmentFiles.map(relativePath => [
    relativePath,
    fs.readFileSync(path.join(repositoryRoot, relativePath))
  ])
)

const restoreFilesIfUnchanged = (repositoryRoot, snapshots, patchedContents) => {
  const conflictingFiles = []

  for (const [relativePath, originalContent] of snapshots) {
    const target = path.join(repositoryRoot, relativePath)
    const patchedContent = patchedContents.get(relativePath)
    let currentContent

    try {
      currentContent = fs.readFileSync(target)
    } catch {
      conflictingFiles.push(relativePath)
      continue
    }

    if (currentContent.equals(originalContent)) continue
    if (!patchedContent || !currentContent.equals(patchedContent)) {
      conflictingFiles.push(relativePath)
      continue
    }

    // 尽量缩短检测与恢复之间的窗口；若内容已变化则保留当前文件。
    const latestContent = fs.readFileSync(target)
    if (latestContent.equals(originalContent)) continue
    if (!latestContent.equals(patchedContent)) {
      conflictingFiles.push(relativePath)
      continue
    }
    fs.writeFileSync(target, originalContent)
  }

  if (conflictingFiles.length > 0) {
    throw new TestBuildRestoreConflictError(conflictingFiles)
  }
}

const signalsForPlatform = platform => (
  platform === 'win32'
    ? ['SIGINT', 'SIGTERM', 'SIGBREAK']
    : ['SIGINT', 'SIGTERM', 'SIGHUP']
)

const startViteBuild = repositoryRoot => {
  const viteEntry = path.join(repositoryRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(process.execPath, [viteEntry, 'build'], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit'
  })

  const completed = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal }))
  })

  return { child, completed }
}

export const runTestBuild = async ({
  repositoryRoot = process.cwd(),
  testHost = defaultTestHost,
  signalSource = process,
  platform = process.platform,
  startBuild = startViteBuild
} = {}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const snapshots = snapshotFiles(resolvedRoot)
  let buildController = null
  let patchedContents = null
  let rejectInterruption
  let interruptedSignal = null
  let restoreAttemptedBySignal = false

  const interruption = new Promise((_, reject) => {
    rejectInterruption = reject
  })

  const signalHandlers = new Map(
    signalsForPlatform(platform).map(signal => [signal, () => {
      if (interruptedSignal) return
      interruptedSignal = signal
      restoreAttemptedBySignal = true

      let restoreError
      try {
        if (patchedContents) {
          restoreFilesIfUnchanged(resolvedRoot, snapshots, patchedContents)
        }
      } catch (error) {
        restoreError = error
      }

      try {
        buildController?.child?.kill(signal)
      } catch (error) {
        restoreError ??= error
      }

      rejectInterruption(new TestBuildInterruptedError(signal, { cause: restoreError }))
    }])
  )

  for (const [signal, handler] of signalHandlers) {
    signalSource.on(signal, handler)
  }

  try {
    patchedContents = patchTestEnvironment({ repositoryRoot: resolvedRoot, testHost })
    buildController = startBuild(resolvedRoot)
    const result = await Promise.race([buildController.completed, interruption])

    if (result.code !== 0) {
      throw new TestBuildFailedError(result)
    }

    return result
  } finally {
    for (const [signal, handler] of signalHandlers) {
      signalSource.off(signal, handler)
    }
    if (patchedContents && !restoreAttemptedBySignal) {
      restoreFilesIfUnchanged(resolvedRoot, snapshots, patchedContents)
    }
  }
}

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  try {
    await runTestBuild()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    if (error instanceof TestBuildInterruptedError) {
      process.exitCode = {
        SIGHUP: 129,
        SIGINT: 130,
        SIGTERM: 143,
        SIGBREAK: 149
      }[error.signal] ?? 1
    } else {
      process.exitCode = 1
    }
  }
}
