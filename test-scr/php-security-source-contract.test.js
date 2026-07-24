import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readSource = relativePath => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')

test('WebDAV proxy pins the validated address and verifies the connected peer', () => {
  const proxySource = readSource('public/api/dav-proxy.php')
  const securitySource = readSource('public/api/dav-proxy-security.php')
  const source = `${securitySource}\n${proxySource}`
  const resolveIndex = source.indexOf('CURLOPT_RESOLVE')
  const executeIndex = source.indexOf('curl_exec($ch)')
  const primaryIpIndex = source.indexOf('CURLINFO_PRIMARY_IP')
  const primaryIpCheckIndex = source.indexOf("ipAddressesMatch($primaryIp, $davTarget['pinnedIp'])")

  assert.match(proxySource, /require_once "api\/dav-proxy-security\.php";/)
  assert.doesNotMatch(securitySource, /\?>\s*$/)
  assert.match(source, /function resolvePublicHostAddresses\(/)
  assert.match(source, /function isDeniedIpv6TransitionAddress\(/)
  assert.match(source, /function packedIpMatchesCidr\(/)
  assert.match(source, /function isPublicIpv4AddressFallback\(/)
  assert.match(source, /function isPublicIpv6AddressFallback\(/)
  assert.match(source, /function isPublicIpAddressFallback\(/)
  assert.match(source, /function isPublicIpAddress\(\$ip, \$forceFallback = false\)/)
  assert.match(source, /00000000000000000000ffff/)
  assert.match(source, /0000000000000000ffff0000/)
  assert.match(source, /0064ff9b0000000000000000/)
  assert.match(source, /\['64400000', 10\]/)
  assert.match(source, /\['c6120000', 15\]/)
  assert.match(source, /\['20010db8000000000000000000000000', 32\]/)
  assert.match(source, /\['3fff0000000000000000000000000000', 20\]/)
  assert.match(source, /\['fc000000000000000000000000000000', 7\]/)
  assert.match(source, /defined\('FILTER_FLAG_GLOBAL_RANGE'\)/)
  assert.match(source, /constant\('FILTER_FLAG_GLOBAL_RANGE'\)/)
  const explicitPolicyIndex = source.indexOf('if (!isPublicIpAddressFallback($normalizedIp))')
  const nativePolicyIndex = source.indexOf('if (!$forceFallback && supportsGlobalIpRangeValidation())')
  assert.ok(
    explicitPolicyIndex >= 0 && explicitPolicyIndex < nativePolicyIndex,
    'the explicit deny-list must run before the PHP-version-dependent global-range check',
  )
  assert.match(source, /!\$forceFallback && supportsGlobalIpRangeValidation\(\)/)
  assert.doesNotMatch(source, /FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE/)
  assert.doesNotMatch(
    proxySource,
    /if \(!supportsGlobalIpRangeValidation\(\)\)\s*\{\s*jsonProxyError\([^;]+503\);\s*\}/,
  )
  const phpFixture = readSource('test-scr/dav-proxy-security-contract-fixture.php')
  assert.match(phpFixture, /'100\.64\.0\.1'/)
  assert.match(phpFixture, /'198\.18\.0\.1'/)
  assert.match(phpFixture, /isPublicIpAddress\(\$address, true\)/)
  assert.match(phpFixture, /'100\.63\.255\.255'/)
  assert.match(phpFixture, /'100\.128\.0\.0'/)
  assert.match(phpFixture, /'3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff'/)
  assert.match(source, /defined\('CURLOPT_RESOLVE'\)/)
  assert.ok(resolveIndex >= 0 && resolveIndex < executeIndex, 'the DNS pin must be installed before the request')
  assert.ok(primaryIpIndex >= 0 && primaryIpCheckIndex > executeIndex, 'the connected peer must be checked after the request')
  assert.match(source, /\$normalizedBase = 'https:\/\/' \. \$urlHost/)
  assert.match(source, /CURLOPT_SSL_VERIFYPEER, true/)
  assert.match(source, /CURLOPT_SSL_VERIFYHOST, 2/)
  assert.match(source, /CURLOPT_FOLLOWLOCATION, false/)
  assert.match(source, /CURLOPT_PROXY, ''/)
})

test('WebDAV request limit is enforced against bytes read from the input stream', () => {
  const proxySource = readSource('public/api/dav-proxy.php')
  const source = `${readSource('public/api/dav-proxy-security.php')}\n${proxySource}`

  assert.match(source, /fopen\('php:\/\/input', 'rb'\)/)
  assert.match(source, /fread\(\$stream, DAV_PROXY_READ_CHUNK_BYTES\)/)
  assert.match(source, /\$bytesRead > \$maxBytes - \$chunkBytes/)
  assert.match(source, /\$bodyResult\['tooLarge'\]/)
  assert.doesNotMatch(source, /file_get_contents\('php:\/\/input'\)/)
  assert.ok(
    proxySource.indexOf('readLimitedRequestBody($inputStream') < proxySource.indexOf('curl_exec($ch)'),
    'the bounded read must finish before forwarding the body',
  )
})

test('debug endpoints require an explicit non-production environment and independent token', () => {
  const guardEntry = readSource('public/api/debug-guard.php')
  const guardPolicy = readSource('public/api/debug-guard-policy.php')
  const guard = `${guardPolicy}\n${guardEntry}`

  assert.match(guardEntry, /require_once "api\/debug-guard-policy\.php";/)
  assert.doesNotMatch(guardEntry, /\?>\s*$/)
  assert.doesNotMatch(guardPolicy, /\?>\s*$/)
  assert.match(guard, /SCE_RUNTIME_ENV/)
  assert.match(guard, /SCE_DEBUG_ENDPOINTS_ENABLED/)
  assert.match(guard, /SCE_DEBUG_ENDPOINT_TOKEN/)
  assert.match(guard, /X-SCE-Debug-Token/)
  assert.match(guard, /hash_equals\(/)
  assert.doesNotMatch(guard, /HTTP_HOST|REMOTE_ADDR|ALLOW_PUBLIC_DEBUG_ENDPOINTS|debugGuardIsLocalRequest/)

  const apiDirectory = path.join(repositoryRoot, 'public/api')
  const debugEndpoints = fs.readdirSync(apiDirectory)
    .filter(fileName => /^test-.*\.php$/.test(fileName))
    .concat('check-https.php')

  assert.ok(debugEndpoints.length > 1, 'expected deployed debug endpoints to be discovered')
  for (const fileName of debugEndpoints) {
    const source = readSource(`public/api/${fileName}`).replace(/^\uFEFF?<\?php\s*/, '')
    assert.match(
      source,
      /^require_once\s+"api\/debug-guard\.php";/,
      `${fileName} must invoke the guard before any debug output`,
    )
  }
})

const readAuthActionBranch = (authSource, action, nextAction = null) => {
  const startMarker = action === 'register'
    ? "if ($action === 'register') {"
    : `} elseif ($action === '${action}') {`
  const startIndex = authSource.indexOf(startMarker)
  assert.ok(startIndex >= 0, `expected the ${action} action branch`)

  const endMarker = nextAction === null
    ? '\n} catch'
    : `} elseif ($action === '${nextAction}') {`
  const endIndex = authSource.indexOf(endMarker, startIndex + startMarker.length)
  assert.ok(endIndex > startIndex, `expected the end of the ${action} action branch`)
  return authSource.slice(startIndex, endIndex)
}

const assertMarkersAreOrdered = (source, markers) => {
  let previousIndex = -1
  for (const marker of markers) {
    const markerIndex = source.indexOf(marker)
    assert.ok(markerIndex > previousIndex, `expected ${marker} after the previous security control`)
    previousIndex = markerIndex
  }
}

test('auth rejects invalid requests and rate limits callers before password decryption', () => {
  const authSource = readSource('public/api/auth.php')
  const allowedActionIndex = authSource.indexOf("$allowedActions = ['register', 'login'")
  const csrfIndex = authSource.indexOf('if (!ensureCsrfMatched($input))')
  const registerUsernameIndex = authSource.indexOf("if ($action === 'register' && !isValidUsername($username))")
  const loginUsernameIndex = authSource.indexOf("if ($action === 'login' && !isValidUsername($username))")
  const registerBranch = readAuthActionBranch(authSource, 'register', 'login')
  const loginBranch = readAuthActionBranch(authSource, 'login', 'verify')
  const changePasswordBranch = readAuthActionBranch(authSource, 'change_password', 'set_settings')

  assert.ok(allowedActionIndex >= 0 && allowedActionIndex < csrfIndex)
  assert.ok(csrfIndex < registerUsernameIndex)
  assert.ok(registerUsernameIndex < loginUsernameIndex)
  assert.doesNotMatch(authSource.slice(allowedActionIndex, csrfIndex), /get_public_key/)
  assertMarkersAreOrdered(registerBranch, [
    'ensureHttps()',
    'checkIpRateLimit()',
    'checkRateLimit($username)',
    "$password = readPasswordField($input, 'password', 'encryptedPassword', $username)",
  ])
  assertMarkersAreOrdered(loginBranch, [
    'ensureHttps()',
    'checkIpRateLimit()',
    'checkRateLimit($username)',
    "$password = readPasswordField($input, 'password', 'encryptedPassword', $username)",
  ])
  assertMarkersAreOrdered(changePasswordBranch, [
    'ensureHttps()',
    '$authUsername = requireAuthenticatedUsername($sessionDb)',
    "checkRateLimitGeneric('change_password_' . $authUsername",
    "$currentPassword = readPasswordField($input, 'currentPassword', 'encryptedCurrentPassword', $authUsername)",
    "$newPassword = readPasswordField($input, 'newPassword', 'encryptedNewPassword', $authUsername)",
  ])

  for (const [action, nextAction] of [
    ['verify', 'logout'],
    ['logout', 'change_password'],
    ['set_settings', 'get_settings'],
    ['get_settings', null],
  ]) {
    assert.doesNotMatch(
      readAuthActionBranch(authSource, action, nextAction),
      /readPasswordField\(/,
      `${action} must not decrypt a password`,
    )
  }
  assert.match(authSource, /function readPasswordField[\s\S]+密码解密失败/)
})

test('auth cookies preserve their security attributes on PHP 7.2 and newer runtimes', () => {
  const commonSource = readSource('public/api/common.php')
  const authSource = readSource('public/api/auth.php')

  assert.match(commonSource, /function buildAppCookieOptions\([\s\S]+['"]samesite['"]\s*=>\s*['"]Lax['"]/)
  assert.match(commonSource, /if \(PHP_VERSION_ID >= 70300\)[\s\S]+buildAppCookieOptions\(/)
  assert.match(commonSource, /function getLegacySameSiteCookiePath\(\)[\s\S]+return ['"]\/; SameSite=Lax['"]/)
  assert.match(commonSource, /getLegacySameSiteCookiePath\(\),[\s\S]+\$secure,[\s\S]+\$httpOnly/)
  assert.match(commonSource, /function setAppCookie\([\s\S]+return writeAppCookie\(/)
  assert.match(commonSource, /function clearAppCookie\([\s\S]+return writeAppCookie\(/)
  assert.match(authSource, /\$usernameWritten = setAppCookie\([\s\S]+authentication cookie write failed/)
  assert.match(authSource, /\$usernameCleared = clearAppCookie\([\s\S]+authentication cookie clear failed/)
})

test('auth cookie failures restore only state committed by the failed request', () => {
  const commonSource = readSource('public/api/common.php')
  const authSource = readSource('public/api/auth.php')
  const registerBranch = readAuthActionBranch(authSource, 'register', 'login')
  const loginBranch = readAuthActionBranch(authSource, 'login', 'verify')
  const changePasswordBranch = readAuthActionBranch(authSource, 'change_password', 'set_settings')

  assert.match(commonSource, /function restoreDatabaseValueIfOwned\(/)
  assert.match(commonSource, /databaseValueMatchesExpected\(\$currentValue, \$ownedValue\)/)
  assert.match(commonSource, /'outcome'\s*=>\s*'ownership_changed'/)

  const committedRegistration = registerBranch.slice(registerBranch.indexOf('$committedState'))
  assertMarkersAreOrdered(committedRegistration, [
    'registrationStateMatchesExpected',
    'setAuthCookies($username, $issuedToken)',
    "'cookie_write_failed'",
    'releaseRegistrationLease($registrationLockDb, $lease)',
  ])

  assertMarkersAreOrdered(loginBranch, [
    '$loginSecurityLockDb = new Database',
    '$loginSecurityLease = acquireUserSecurityLease($loginSecurityLockDb, $username)',
    '$existingHash = $db->get($username)',
    '$previousSessionValue = $sessionDb->get($username)',
    '$issuedToken = issueSessionToken',
    'setAuthCookies($username, $issuedToken)',
    'restoreDatabaseValueIfOwned(',
    "'login_complete'",
    "logSecurityEvent('login_success'",
  ])
  for (const context of [
    'login_user_not_found',
    'login_invalid_password',
    'login_disabled',
    'login_invalid_epoch',
    'login_complete',
    'login_exception',
  ]) {
    assert.match(
      loginBranch,
      new RegExp(`releaseUserSecurityLease\\(\\$loginSecurityLockDb, \\$loginSecurityLease, \\$username, '${context}'\\)`),
      `login path ${context} must release the shared user lease`,
    )
  }
  assert.match(
    loginBranch,
    /catch \(Throwable \$error\)\s*\{\s*releaseUserSecurityLease\([^;]+'login_exception'\);\s*throw \$error;/,
  )

  assertMarkersAreOrdered(changePasswordBranch, [
    '$previousSessionValue = $sessionDb->get($authUsername)',
    'revokeUserSessionVerified($sessionDb, $authUsername)',
    '$issuedToken = issueSessionToken',
    'setAuthCookies($authUsername, $issuedToken)',
    'restoreDatabaseValueIfOwned(',
    "'change_password_complete'",
  ])
  assert.match(changePasswordBranch, /restoreDatabaseValueIfOwned\([\s\S]+\$newPasswordHash,[\s\S]+\$existingHash/)
  assert.match(changePasswordBranch, /restoreDatabaseValueIfOwned\([\s\S]+\$issuedToken\['storedValue'\],[\s\S]+\$previousSessionValue/)
})

test('logout cannot revoke a session rotated by a concurrent account operation', () => {
  const commonSource = readSource('public/api/common.php')
  const authSource = readSource('public/api/auth.php')
  const logoutBranch = readAuthActionBranch(authSource, 'logout', 'change_password')
  const expiredSessionBranch = commonSource.slice(
    commonSource.indexOf("if (time() > (int)$data['expiry'])"),
    commonSource.indexOf('// 新格式：比对 Token', commonSource.indexOf("if (time() > (int)$data['expiry'])")),
  )

  assert.doesNotMatch(
    expiredSessionBranch,
    /\$sessionDb->delete\(/,
    'an authorization read must not delete a newly rotated session without the user lease',
  )
  assertMarkersAreOrdered(logoutBranch, [
    '$authUsername = getAuthenticatedUsername($sessionDb)',
    "$logoutSecurityLockDb = new Database('registration_locks')",
    '$logoutSecurityLease = acquireUserSecurityLease($logoutSecurityLockDb, $authUsername)',
    '$confirmedAuthUsername = getAuthenticatedUsername($sessionDb)',
    'databaseDeleteVerified($sessionDb, $authUsername)',
    "'logout_complete'",
    "logSecurityEvent('logout_success'",
  ])
  assert.match(
    logoutBranch,
    /databaseDeleteVerified\(\$sessionDb, \$authUsername\)[\s\S]+clearAuthCookies\(\);[\s\S]+releaseUserSecurityLease\([^;]+'logout_complete'\)/,
  )
  for (const context of [
    'logout_token_rotated',
    'logout_revoke_failed',
    'logout_complete',
    'logout_exception',
  ]) {
    assert.match(
      logoutBranch,
      new RegExp(`releaseUserSecurityLease\\(\\$logoutSecurityLockDb, \\$logoutSecurityLease, \\$authUsername, '${context}'\\)`),
      `logout path ${context} must release the shared user lease`,
    )
  }
  assert.match(
    logoutBranch,
    /catch \(Throwable \$error\)\s*\{\s*releaseUserSecurityLease\([^;]+'logout_exception'\);\s*throw \$error;/,
  )
})
