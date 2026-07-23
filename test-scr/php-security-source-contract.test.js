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
  assert.match(source, /00000000000000000000ffff/)
  assert.match(source, /0064ff9b0000000000000000/)
  assert.match(source, /defined\('FILTER_FLAG_GLOBAL_RANGE'\)/)
  assert.match(source, /constant\('FILTER_FLAG_GLOBAL_RANGE'\)/)
  assert.doesNotMatch(source, /FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE/)
  const phpFixture = readSource('test-scr/dav-proxy-security-contract-fixture.php')
  assert.match(phpFixture, /'100\.64\.0\.1'/)
  assert.match(phpFixture, /'198\.18\.0\.1'/)
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
