import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  executeDeploymentPlan,
  orderDeploymentUploads
} from '../scripts/deploy-staging.js'

const uploads = [
  { localFile: 'index.html', remoteKey: 'index.html' },
  { localFile: 'assets/app.js', remoteKey: 'assets/app.js' },
  { localFile: 'admin/index.html', remoteKey: 'admin/index.html' },
  { localFile: 'assets/app.css', remoteKey: 'assets/app.css' }
]

test('所有入口文档排在普通资源之后，并在上传完成后才删除旧文件', async () => {
  assert.deepEqual(
    orderDeploymentUploads(uploads).map(item => item.remoteKey),
    ['assets/app.js', 'assets/app.css', 'index.html', 'admin/index.html']
  )

  const calls = []
  await executeDeploymentPlan({
    uploads,
    staleKeys: new Set(['assets/old.js']),
    cleanupEnabled: true,
    uploadFile: async item => calls.push(`upload:${item.remoteKey}`),
    deleteStaleFiles: async keys => calls.push(`delete:${Array.from(keys).join(',')}`)
  })

  assert.deepEqual(calls, [
    'upload:assets/app.js',
    'upload:assets/app.css',
    'upload:index.html',
    'upload:admin/index.html',
    'delete:assets/old.js'
  ])
})

test('任一上传失败时不删除任何远端文件', async () => {
  const calls = []

  await assert.rejects(
    executeDeploymentPlan({
      uploads,
      staleKeys: new Set(['assets/old.js']),
      cleanupEnabled: true,
      uploadFile: async item => {
        calls.push(`upload:${item.remoteKey}`)
        if (item.remoteKey === 'index.html') throw new Error('注入的上传失败')
      },
      deleteStaleFiles: async () => calls.push('delete')
    }),
    /注入的上传失败/
  )

  assert.deepEqual(calls, [
    'upload:assets/app.js',
    'upload:assets/app.css',
    'upload:index.html'
  ])
})

test('远端清单降级模式即使收到旧文件集合也不执行清理', async () => {
  const calls = []

  await executeDeploymentPlan({
    uploads: [{ localFile: 'index.html', remoteKey: 'index.html' }],
    staleKeys: new Set(['assets/old.js']),
    cleanupEnabled: false,
    uploadFile: async item => calls.push(`upload:${item.remoteKey}`),
    deleteStaleFiles: async () => calls.push('delete')
  })

  assert.deepEqual(calls, ['upload:index.html'])
})
