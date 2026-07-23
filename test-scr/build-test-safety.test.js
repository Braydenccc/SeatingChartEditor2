import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { afterEach, test } from 'node:test'
import {
  runTestBuild,
  TestBuildFailedError,
  TestBuildInterruptedError,
  TestBuildRestoreConflictError
} from '../scripts/build-test.js'
import { patchTestEnvironment, testEnvironmentFiles } from '../scripts/patch-test-env.js'

const fixtureRoots = []

const fixtureContents = {
  'index.html': Buffer.from('<!doctype html>\r\n<title>测试座位表</title>\r\n', 'utf8'),
  'src/components/auth/LoginDialog.vue': Buffer.from(
    '<template>本账号服务不保证可用性，请妥善备份您的数据</template>\r\n',
    'utf8'
  ),
  'src/components/layout/AppHeader.vue': Buffer.from(
    '<template><h1 class="header-text">BraydenSCE V2</h1></template>\r\n<style scoped>\r\n</style>\r\n',
    'utf8'
  )
}

const createFixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scev2-build-test-'))
  fixtureRoots.push(root)

  for (const [relativePath, content] of Object.entries(fixtureContents)) {
    const target = path.join(root, relativePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }

  return root
}

const snapshotFixture = root => new Map(
  testEnvironmentFiles.map(relativePath => [
    relativePath,
    fs.readFileSync(path.join(root, relativePath))
  ])
)

const assertFixtureRestored = (root, expected) => {
  for (const [relativePath, content] of expected) {
    assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), content, relativePath)
  }
}

afterEach(() => {
  while (fixtureRoots.length > 0) {
    fs.rmSync(fixtureRoots.pop(), { recursive: true, force: true })
  }
})

test('成功构建后逐字节恢复三个临时 patch 文件', async () => {
  const root = createFixture()
  const expected = snapshotFixture(root)

  await runTestBuild({
    repositoryRoot: root,
    startBuild: () => {
      assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /\[test\] 测试座位表/)
      assert.match(fs.readFileSync(path.join(root, 'src/components/layout/AppHeader.vue'), 'utf8'), /test-badge/)
      return {
        child: { kill: () => true },
        completed: Promise.resolve({ code: 0, signal: null })
      }
    }
  })

  assertFixtureRestored(root, expected)
})

test('构建失败后逐字节恢复三个临时 patch 文件', async () => {
  const root = createFixture()
  const expected = snapshotFixture(root)

  await assert.rejects(
    runTestBuild({
      repositoryRoot: root,
      startBuild: () => ({
        child: { kill: () => true },
        completed: Promise.resolve({ code: 7, signal: null })
      })
    }),
    TestBuildFailedError
  )

  assertFixtureRestored(root, expected)
})

for (const [signal, platform] of [
  ['SIGINT', 'win32'],
  ['SIGTERM', 'win32'],
  ['SIGHUP', 'linux'],
  ['SIGBREAK', 'win32']
]) {
  test(`${platform} 的 ${signal} 会立即恢复文件并转发给构建子进程`, async () => {
    const root = createFixture()
    const expected = snapshotFixture(root)
    const signalSource = new EventEmitter()
    const forwardedSignals = []

    const buildPromise = runTestBuild({
      repositoryRoot: root,
      signalSource,
      platform,
      startBuild: () => ({
        child: { kill: receivedSignal => forwardedSignals.push(receivedSignal) },
        completed: new Promise(() => {})
      })
    })

    signalSource.emit(signal)
    assertFixtureRestored(root, expected)
    await assert.rejects(buildPromise, error => {
      assert.ok(error instanceof TestBuildInterruptedError)
      assert.equal(error.signal, signal)
      return true
    })
    assert.deepEqual(forwardedSignals, [signal])
  })
}

test('构建期间并发编辑会被保留并让恢复明确失败', async () => {
  const root = createFixture()
  const expected = snapshotFixture(root)
  const indexPath = path.join(root, 'index.html')
  const concurrentContent = Buffer.from('<!doctype html>\n<title>用户正在编辑</title>\n', 'utf8')

  await assert.rejects(
    runTestBuild({
      repositoryRoot: root,
      startBuild: () => {
        fs.writeFileSync(indexPath, concurrentContent)
        return {
          child: { kill: () => true },
          completed: Promise.resolve({ code: 0, signal: null })
        }
      }
    }),
    error => {
      assert.ok(error instanceof TestBuildRestoreConflictError)
      assert.deepEqual(error.conflictingFiles, ['index.html'])
      return true
    }
  )

  assert.deepEqual(fs.readFileSync(indexPath), concurrentContent)
  for (const relativePath of testEnvironmentFiles.filter(item => item !== 'index.html')) {
    assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), expected.get(relativePath))
  }
})

test('任一 patch 锚点缺失时在写文件前失败', async () => {
  const root = createFixture()
  const loginPath = path.join(root, 'src/components/auth/LoginDialog.vue')
  fs.writeFileSync(loginPath, '<template>锚点已漂移</template>\n', 'utf8')
  const expected = snapshotFixture(root)
  let buildStarted = false

  await assert.rejects(
    runTestBuild({
      repositoryRoot: root,
      startBuild: () => {
        buildStarted = true
        return {
          child: { kill: () => true },
          completed: Promise.resolve({ code: 0, signal: null })
        }
      }
    }),
    /账号服务提示锚点/
  )

  assert.equal(buildStarted, false)
  assertFixtureRestored(root, expected)
})

test('三文件 patch 任一写入失败时回滚所有已尝试文件', () => {
  const root = createFixture()
  const expected = snapshotFixture(root)
  let writeCount = 0
  const injectedFileSystem = {
    readFileSync: (...args) => fs.readFileSync(...args),
    writeFileSync: (...args) => {
      writeCount += 1
      if (writeCount === 2) {
        throw new Error('注入的第二次写入失败')
      }
      return fs.writeFileSync(...args)
    }
  }

  assert.throws(
    () => patchTestEnvironment({ repositoryRoot: root, fileSystem: injectedFileSystem }),
    /事务写入失败，已回滚所有尝试写入的文件/
  )
  assert.equal(writeCount, 4)
  assertFixtureRestored(root, expected)
})
