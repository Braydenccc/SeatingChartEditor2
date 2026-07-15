import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..')

const pad2 = value => String(value).padStart(2, '0')

export const createReleaseVersionInfo = (timestamp = new Date()) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`无效时间戳: ${timestamp}`)
  }

  const year = date.getUTCFullYear()
  const shortYear = year % 100
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hour = date.getUTCHours()
  const minute = date.getUTCMinutes()
  const second = date.getUTCSeconds()
  const compactDate = `${year}${pad2(month)}${pad2(day)}`
  const compactTime = `${pad2(hour)}${pad2(minute)}${pad2(second)}`

  return {
    buildTime: date.toISOString().replace('.000Z', 'Z'),
    releaseVersion: `v${compactDate}-${compactTime}`,
    packageVersion: `${shortYear}.${month}.${Number(`${pad2(day)}${pad2(hour)}`)}-${Number(`${pad2(minute)}${pad2(second)}`)}`,
    wixVersion: `${shortYear}.${month}.${Number(`${pad2(day)}${pad2(hour)}`)}.${Number(`${pad2(minute)}${pad2(second)}`)}`
  }
}

export const parseReleaseVersionTimestamp = releaseVersion => {
  const match = /^v(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(String(releaseVersion || ''))
  if (!match) throw new Error(`无法解析时间戳发布版本: ${releaseVersion}`)
  const [, year, month, day, hour, minute, second] = match
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
}

const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'))

const stringifyJson = value => `${JSON.stringify(value, null, 2)}\n`

const buildUpdatedFiles = versionInfo => {
  const packageJson = readJson('package.json')
  packageJson.version = versionInfo.packageVersion
  packageJson.releaseVersion = versionInfo.releaseVersion

  const packageLock = readJson('package-lock.json')
  packageLock.version = versionInfo.packageVersion
  if (packageLock.packages?.['']) {
    packageLock.packages[''].version = versionInfo.packageVersion
  }

  const tauriConfig = readJson('src-tauri/tauri.conf.json')
  tauriConfig.version = '../package.json'
  tauriConfig.bundle ||= {}
  tauriConfig.bundle.windows ||= {}
  tauriConfig.bundle.windows.wix ||= {}
  tauriConfig.bundle.windows.wix.version = versionInfo.wixVersion

  const cargoTomlPath = path.join(repositoryRoot, 'src-tauri/Cargo.toml')
  const cargoToml = fs.readFileSync(cargoTomlPath, 'utf8').replace(
    /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+("\s*\r?\n)/,
    `$1${versionInfo.packageVersion}$2`
  )

  const cargoLockPath = path.join(repositoryRoot, 'src-tauri/Cargo.lock')
  const cargoLock = fs.readFileSync(cargoLockPath, 'utf8').replace(
    /(\[\[package\]\]\s*\r?\nname\s*=\s*"app"\s*\r?\nversion\s*=\s*")[^"]+("\s*\r?\n)/,
    `$1${versionInfo.packageVersion}$2`
  )
  if (!cargoToml.includes(`version = "${versionInfo.packageVersion}"`)) {
    throw new Error('无法更新 src-tauri/Cargo.toml 版本')
  }
  if (!cargoLock.includes(`name = "app"\nversion = "${versionInfo.packageVersion}"`) &&
      !cargoLock.includes(`name = "app"\r\nversion = "${versionInfo.packageVersion}"`)) {
    throw new Error('无法更新 src-tauri/Cargo.lock 版本')
  }

  return new Map([
    ['package.json', stringifyJson(packageJson)],
    ['package-lock.json', stringifyJson(packageLock)],
    ['src-tauri/tauri.conf.json', stringifyJson(tauriConfig)],
    ['src-tauri/Cargo.toml', cargoToml],
    ['src-tauri/Cargo.lock', cargoLock]
  ])
}

export const updateReleaseVersions = (versionInfo, { check = false } = {}) => {
  const updatedFiles = buildUpdatedFiles(versionInfo)
  const changedFiles = []

  for (const [relativePath, content] of updatedFiles) {
    const absolutePath = path.join(repositoryRoot, relativePath)
    const currentContent = fs.readFileSync(absolutePath, 'utf8')
    if (currentContent === content) continue
    changedFiles.push(relativePath)
    if (!check) fs.writeFileSync(absolutePath, content)
  }

  if (check && changedFiles.length > 0) {
    throw new Error(`版本文件未同步: ${changedFiles.join(', ')}`)
  }
  return changedFiles
}

const readArgument = name => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  try {
    const check = process.argv.includes('--check')
    const timestampArgument = readArgument('--timestamp')
    const timestamp = timestampArgument || (
      check
        ? parseReleaseVersionTimestamp(readJson('package.json').releaseVersion)
        : new Date().toISOString()
    )
    const writeGithubEnv = process.argv.includes('--github-env')
    const versionInfo = createReleaseVersionInfo(timestamp)
    const changedFiles = updateReleaseVersions(versionInfo, { check })

    if (writeGithubEnv) {
      const githubEnvPath = process.env.GITHUB_ENV
      if (!githubEnvPath) throw new Error('缺少 GITHUB_ENV，无法写入 GitHub Actions 环境变量')
      fs.appendFileSync(githubEnvPath, [
        `VITE_APP_BUILD_TIME=${versionInfo.buildTime}`,
        `VITE_APP_RELEASE_VERSION=${versionInfo.releaseVersion}`,
        `RELEASE_VERSION=${versionInfo.releaseVersion}`,
        `PACKAGE_VERSION=${versionInfo.packageVersion}`,
        `WIX_VERSION=${versionInfo.wixVersion}`,
        ''
      ].join('\n'))
    }

    console.log(JSON.stringify({ ...versionInfo, changedFiles }, null, 2))
  } catch (error) {
    console.error(error.message || error)
    process.exit(1)
  }
}
