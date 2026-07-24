import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MainDeploySafetyError, runSafeMainDeploy } from '../scripts/deploy-main.js'

const sourceSha = '2'.repeat(40)
const remoteSha = '1'.repeat(40)
const defaultEndpoint = 'https://example.test/repository.git'
const mainFetchRefspec = '+refs/heads/main:refs/remotes/origin/main'

const createRunner = ({
  branch = 'feature/safe-deploy',
  status = '',
  ancestorStatus = 0,
  pushStatus = 0,
  publishedSha = sourceSha,
  readbackStatus = 0,
  readbackError = 'remote readback failed',
  pushError = 'lease rejected',
  operationRef = null,
  fetchUrls = [defaultEndpoint],
  pushUrls = fetchUrls,
  replaceRefs = ''
} = {}) => {
  const calls = []
  const runner = ({ args }) => {
    calls.push(args)
    const command = args.join(' ')

    if (command === 'rev-parse --is-inside-work-tree') return { status: 0, stdout: 'true\n' }
    if (command === 'symbolic-ref --quiet --short HEAD') {
      return branch
        ? { status: 0, stdout: `${branch}\n` }
        : { status: 1, stderr: 'not a symbolic ref' }
    }
    if (command === 'remote get-url --all origin') {
      return { status: 0, stdout: `${fetchUrls.join('\n')}\n` }
    }
    if (command === 'remote get-url --push --all origin') {
      return { status: 0, stdout: `${pushUrls.join('\n')}\n` }
    }
    if (command === 'replace -l') return { status: 0, stdout: replaceRefs }
    if (args[0] === 'rev-parse' && args[1] === '--git-path') {
      return { status: 0, stdout: `.git/${args[2]}\n` }
    }
    if (args[0] === 'rev-parse' && args[1] === '--quiet' && args[2] === '--verify') {
      return args[3] === operationRef
        ? { status: 0, stdout: '3'.repeat(40) }
        : { status: 1, stdout: '' }
    }
    if (command === 'status --porcelain=v1 --untracked-files=all') return { status: 0, stdout: status }
    if (command === 'rev-parse HEAD') return { status: 0, stdout: `${sourceSha}\n` }
    if (command === `fetch --prune -- ${fetchUrls[0]} ${mainFetchRefspec}`) {
      return { status: 0, stdout: '' }
    }
    if (command === 'rev-parse refs/remotes/origin/main') return { status: 0, stdout: `${remoteSha}\n` }
    if (args[0] === '--no-replace-objects' && args[1] === 'merge-base' && args[2] === '--is-ancestor') {
      return { status: ancestorStatus, stderr: ancestorStatus ? 'not an ancestor' : '' }
    }
    if (args[0] === 'push') return { status: pushStatus, stderr: pushStatus ? pushError : '' }
    if (command === `ls-remote --heads -- ${fetchUrls[0]} refs/heads/main`) {
      return readbackStatus === 0
        ? { status: 0, stdout: `${publishedSha}\trefs/heads/main\n` }
        : { status: readbackStatus, stderr: readbackError }
    }
    throw new Error(`Unexpected git command: ${command}`)
  }
  return { runner, calls }
}

test('从当前分支将精确提交快进发布到 main，且不切换本地分支', () => {
  const { runner, calls } = createRunner()
  const logs = []

  const result = runSafeMainDeploy({
    repositoryRoot: '.',
    runner,
    log: message => logs.push(message)
  })

  assert.deepEqual(result, {
    sourceBranch: 'feature/safe-deploy',
    sourceSha,
    remoteSha,
    pushed: true
  })
  assert.ok(calls.some(args => args[0] === 'push'))
  assert.ok(calls.every(args => !['checkout', 'switch', 'merge'].includes(args[0])))
  assert.ok(calls.some(args => args[0] === '--no-replace-objects' && args[1] === 'merge-base'))
  assert.ok(calls.some(args => args.join(' ') === `fetch --prune -- ${defaultEndpoint} ${mainFetchRefspec}`))
  assert.ok(calls.some(args => args[0] === 'push' && args[2] === '--' && args[3] === defaultEndpoint))
  assert.ok(calls.some(args => args.join(' ') === `ls-remote --heads -- ${defaultEndpoint} refs/heads/main`))
  assert.match(logs.at(-1), /当前仍停留在 feature\/safe-deploy/)
})

test('选项形态的固定 endpoint 只能出现在参数终止符之后', () => {
  const optionLikeEndpoint = '--upload-pack=local-helper'
  const { runner, calls } = createRunner({ fetchUrls: [optionLikeEndpoint] })

  const result = runSafeMainDeploy({ repositoryRoot: '.', runner, log: () => {} })
  assert.equal(result.pushed, true)

  const fetchCall = calls.find(args => args[0] === 'fetch')
  const pushCall = calls.find(args => args[0] === 'push')
  const readbackCall = calls.find(args => args[0] === 'ls-remote')
  assert.deepEqual(fetchCall, ['fetch', '--prune', '--', optionLikeEndpoint, mainFetchRefspec])
  assert.deepEqual(pushCall, [
    'push',
    `--force-with-lease=refs/heads/main:${remoteSha}`,
    '--',
    optionLikeEndpoint,
    `${sourceSha}:refs/heads/main`
  ])
  assert.deepEqual(readbackCall, [
    'ls-remote',
    '--heads',
    '--',
    optionLikeEndpoint,
    'refs/heads/main'
  ])
})

test('替换引用或 legacy graft 存在时在 fetch 和 push 前拒绝部署', () => {
  const replaced = createRunner({ replaceRefs: `${remoteSha}\n` })
  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner: replaced.runner }),
    /replace/
  )
  assert.ok(replaced.calls.every(args => !['fetch', 'push'].includes(args[0])))

  const grafted = createRunner()
  assert.throws(
    () => runSafeMainDeploy({
      repositoryRoot: '.',
      runner: grafted.runner,
      fileHasContent: () => true
    }),
    /graft/
  )
  assert.ok(grafted.calls.every(args => !['fetch', 'push'].includes(args[0])))
})

test('fetch 与 push 不是同一实际 endpoint 时拒绝部署', () => {
  const mismatched = createRunner({
    fetchUrls: ['https://read.example.test/repository.git'],
    pushUrls: ['ssh://write.example.test/repository.git']
  })
  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner: mismatched.runner }),
    /同一.*endpoint/
  )
  assert.ok(mismatched.calls.every(args => !['fetch', 'push', 'ls-remote'].includes(args[0])))

  const multiple = createRunner({
    pushUrls: [
      'https://example.test/repository.git',
      'https://mirror.example.test/repository.git'
    ]
  })
  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner: multiple.runner }),
    /唯一.*endpoint/
  )
  assert.ok(multiple.calls.every(args => !['fetch', 'push', 'ls-remote'].includes(args[0])))

  const whitespaceMismatch = createRunner({
    pushUrls: [`${defaultEndpoint} `]
  })
  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner: whitespaceMismatch.runner }),
    /同一.*endpoint/
  )
  assert.ok(whitespaceMismatch.calls.every(args => !['fetch', 'push', 'ls-remote'].includes(args[0])))
})

test('包含凭据的固定 endpoint 不会出现在 Git 失败消息中', () => {
  const credentialedEndpoint = 'https://deploy-user:super-secret@example.test/repository.git'
  const { runner } = createRunner({
    fetchUrls: [credentialedEndpoint],
    pushStatus: 1,
    pushError: `lease rejected for ${credentialedEndpoint}`,
    publishedSha: remoteSha
  })

  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner, log: () => {} }),
    error => error instanceof MainDeploySafetyError
      && /lease rejected/.test(error.message)
      && !error.message.includes(credentialedEndpoint)
      && !error.message.includes('deploy-user')
      && !error.message.includes('super-secret')
  )
})

test('工作树不干净时在 fetch 和 push 前拒绝部署', () => {
  const { runner, calls } = createRunner({ status: ' M src/App.vue\n?? local.txt\n' })

  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner }),
    error => error instanceof MainDeploySafetyError && /未提交修改/.test(error.message)
  )
  assert.ok(calls.every(args => !['fetch', 'push'].includes(args[0])))
})

test('detached HEAD 或未完成 Git 操作会被拒绝', () => {
  const detached = createRunner({ branch: '' })
  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner: detached.runner }),
    /detached HEAD/
  )

  const merging = createRunner({ operationRef: 'MERGE_HEAD' })
  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner: merging.runner }),
    /MERGE_HEAD/
  )

  for (const operationPath of ['rebase-merge', 'rebase-apply', 'sequencer']) {
    const operation = createRunner()
    assert.throws(
      () => runSafeMainDeploy({
        repositoryRoot: '.',
        runner: operation.runner,
        pathExists: filePath => filePath.replace(/\\/g, '/').endsWith(`/.git/${operationPath}`)
      }),
      new RegExp(operationPath)
    )
    assert.ok(operation.calls.every(args => !['fetch', 'push'].includes(args[0])))
  }

  const bisecting = createRunner({ operationRef: 'BISECT_START' })
  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner: bisecting.runner }),
    /BISECT_START/
  )
  assert.ok(bisecting.calls.every(args => !['fetch', 'push'].includes(args[0])))

  const bisectMarker = createRunner()
  assert.throws(
    () => runSafeMainDeploy({
      repositoryRoot: '.',
      runner: bisectMarker.runner,
      pathExists: filePath => filePath.replace(/\\/g, '/').endsWith('/.git/BISECT_START')
    }),
    /BISECT_START/
  )
  assert.ok(bisectMarker.calls.every(args => !['fetch', 'push'].includes(args[0])))
})

test('源提交不能快进 origin/main 时拒绝 push', () => {
  const { runner, calls } = createRunner({ ancestorStatus: 1 })

  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner }),
    /不是 origin\/main 的快进后继/
  )
  assert.ok(calls.every(args => args[0] !== 'push'))
})

test('push 成功但远端读回不一致时报告失败', () => {
  const mismatched = createRunner({ publishedSha: '4'.repeat(40) })
  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner: mismatched.runner }),
    /远端 main 校验不一致/
  )
})

test('push 返回失败但远端已是源提交时确认部署成功', () => {
  const { runner, calls } = createRunner({ pushStatus: 1 })
  const logs = []

  const result = runSafeMainDeploy({
    repositoryRoot: '.',
    runner,
    log: message => logs.push(message)
  })

  assert.equal(result.pushed, true)
  assert.ok(calls.some(args => args[0] === 'ls-remote'))
  assert.match(logs.at(-1), /但 origin\/main 已确认更新/)
})

test('push 返回失败且远端仍是旧提交时确认未应用并保留 Git 错误', () => {
  const { runner, calls } = createRunner({ pushStatus: 1, publishedSha: remoteSha })

  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner, log: () => {} }),
    error => error instanceof MainDeploySafetyError
      && /确认本次部署未应用/.test(error.message)
      && /lease rejected/.test(error.message)
  )
  assert.ok(calls.some(args => args[0] === 'ls-remote'))
})

test('push 返回失败且远端变为其他提交时报告结果不确定', () => {
  const otherSha = '4'.repeat(40)
  const { runner } = createRunner({ pushStatus: 1, publishedSha: otherSha })

  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner, log: () => {} }),
    error => error instanceof MainDeploySafetyError
      && /结果不确定/.test(error.message)
      && error.message.includes(otherSha.slice(0, 12))
  )
})

test('push 返回失败且远端读回失败时报告结果不确定', () => {
  const { runner } = createRunner({
    pushStatus: 1,
    readbackStatus: 128,
    readbackError: 'network unavailable'
  })

  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner, log: () => {} }),
    error => error instanceof MainDeploySafetyError
      && /结果不确定/.test(error.message)
      && /network unavailable/.test(error.message)
  )
})

test('push 返回成功但远端读回失败时明确报告结果不确定', () => {
  const { runner } = createRunner({
    readbackStatus: 128,
    readbackError: 'network unavailable'
  })

  assert.throws(
    () => runSafeMainDeploy({ repositoryRoot: '.', runner, log: () => {} }),
    error => error instanceof MainDeploySafetyError
      && /结果不确定/.test(error.message)
      && /git push 已返回成功/.test(error.message)
      && /network unavailable/.test(error.message)
  )
})

test('origin/main 已等于当前提交时不重复 push', () => {
  const calls = []
  const base = createRunner()
  const runner = input => {
    const command = input.args.join(' ')
    calls.push(input.args)
    if (command === 'rev-parse refs/remotes/origin/main') {
      return { status: 0, stdout: `${sourceSha}\n` }
    }
    if (command === `merge-base --is-ancestor ${sourceSha} ${sourceSha}`) {
      return { status: 0, stdout: '' }
    }
    return base.runner(input)
  }

  const result = runSafeMainDeploy({ repositoryRoot: '.', runner, log: () => {} })
  assert.equal(result.pushed, false)
  assert.ok(calls.every(args => args[0] !== 'push'))
})
