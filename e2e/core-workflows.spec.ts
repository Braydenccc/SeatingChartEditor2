import { expect, test } from '@playwright/test'

const minimalSdes = {
  format: 'student-data-exchange-schema',
  version: 1,
  manifest: {
    producer: 'BraydenSCE E2E',
    producerVersion: 'vtest',
    exportedAt: '2026-07-15T00:00:00Z',
    locale: 'zh-CN'
  },
  classes: [
    {
      id: 'class:e2e',
      metadata: { name: '端到端测试班' },
      students: [
        { id: 'student:1', number: '1', name: { display: '测试学生' }, tags: [] }
      ],
      tags: [],
      attributeDefinitions: [],
      seatCharts: [
        {
          id: 'chart:e2e',
          name: '测试座位表',
          layoutModel: 'groupedColumns',
          platformPosition: 'top',
          groupedColumns: {
            groups: [{ id: 'group:0', columns: 1, rows: 1 }]
          },
          seats: [
            { id: 'seat:0:0:0', kind: 'seat', group: 0, column: 0, row: 0 }
          ],
          assignments: [
            { seatId: 'seat:0:0:0', studentId: 'student:1' }
          ]
        }
      ]
    }
  ]
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('sce-welcome-seen', 'v1')
  })
})

test('renders the main route pages', async ({ page }) => {
  const routes = [
    ['editor', 'BraydenSCE V2'],
    ['files', '文件'],
    ['students', '名单与属性'],
    ['export', '导出'],
    ['settings', '设置'],
    ['user', '账号中心']
  ] as const

  for (const [route, heading] of routes) {
    await page.goto(`/#/${route}`)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
})

test('enters, assigns, undoes, saves, reopens and reaches export', async ({ page }, testInfo) => {
  const studentName = '端到端流程学生'
  const isMobile = testInfo.project.name === 'mobile-chromium'
  const mobileStudentDrawer = page.getByRole('dialog', { name: '学生', exact: true })
  const findCandidate = async () => {
    if (isMobile) {
      await page.getByRole('button', { name: '候选学生', exact: true }).click()
      await expect(mobileStudentDrawer).toBeVisible()
      return mobileStudentDrawer.locator('.candidate-item').filter({ hasText: studentName })
    }
    return page.locator('.candidate-item').filter({ hasText: studentName })
  }
  const closeMobileStudentDrawer = async () => {
    if (!isMobile) return
    await page.keyboard.press('Escape')
    await expect(mobileStudentDrawer).toBeHidden()
  }

  await page.goto('/#/students')
  await page.getByRole('button', { name: '添加学生' }).click()
  const nameInput = page.locator('input.name-input').first()
  await nameInput.fill(studentName)
  await nameInput.press('Tab')

  await page.getByRole('button', { name: '返回编辑器' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'BraydenSCE V2' })).toBeVisible()

  const candidate = await findCandidate()
  await expect(candidate).toBeVisible()
  await candidate.click()
  if (isMobile) await expect(mobileStudentDrawer).toBeHidden()

  const targetSeat = page.locator('[data-seat-id]').filter({ hasText: '空位' }).first()
  await targetSeat.click()
  await expect(targetSeat).toContainText(studentName)
  await expect(candidate).toHaveCount(0)

  const undoButton = page.locator('button[title="撤销"]')
  await expect(undoButton).toBeEnabled()
  await undoButton.click()
  await expect(targetSeat).not.toContainText(studentName)
  await expect(await findCandidate()).toBeVisible()
  await closeMobileStudentDrawer()

  await page.getByRole('button', { name: '文件' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '文件' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '保存到本地' }).click()
  const download = await downloadPromise
  const downloadedWorkspacePath = await download.path()
  expect(downloadedWorkspacePath).not.toBeNull()

  await page.getByRole('button', { name: '新建工作区' }).click()
  const confirmation = page.getByRole('dialog').filter({ hasText: '新建工作区会清空当前未另行保存的编辑内容' })
  await confirmation.getByRole('button', { name: '新建', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'BraydenSCE V2' })).toBeVisible()
  await expect(page.locator('.candidate-item').filter({ hasText: studentName })).toHaveCount(0)

  await page.getByRole('button', { name: '文件' }).click()
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '加载本地' }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(downloadedWorkspacePath as string)

  await expect(page.getByRole('heading', { level: 1, name: 'BraydenSCE V2' })).toBeVisible()
  await expect(await findCandidate()).toBeVisible()
  await closeMobileStudentDrawer()

  await page.locator('button[title="导出"]').last().click()
  await expect(page.getByRole('heading', { level: 1, name: '导出' })).toBeVisible()
})

test('keeps the current roster when a malformed workspace is rejected', async ({ page }) => {
  await page.goto('/#/students')
  await page.getByRole('button', { name: '添加学生' }).click()
  const nameInput = page.locator('input.name-input').first()
  await nameInput.fill('需要保留的学生')
  await nameInput.press('Tab')

  await page.getByRole('button', { name: '到文件页导入' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '文件' })).toBeVisible()

  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '加载本地' }).click()
  const chooser = await chooserPromise
  await chooser.setFiles({
    name: 'broken.sce',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ students: [], layout: {} }), 'utf8')
  })

  await expect(page).toHaveURL(/#\/files$/)
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: '名单与属性' })).toBeVisible()
  await expect(page.locator('input.name-input').first()).toHaveValue('需要保留的学生')
})

test('opens an SDES import preview from a selected file', async ({ page }) => {
  await page.goto('/#/files')

  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '导入 SDES' }).click()
  const chooser = await chooserPromise
  await chooser.setFiles({
    name: 'sample.sdes.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(minimalSdes), 'utf8')
  })

  await expect(page.getByRole('dialog', { name: '导入 SDES' })).toBeVisible()
  await expect(page.getByRole('button', { name: /端到端测试班 \/ 测试座位表/ })).toBeVisible()
})
