<?php
require_once "api/common.php";
require_once "api/dav-proxy-security.php";

const DAV_PROXY_MAX_REQUEST_BYTES = 10 * 1024 * 1024;
const DAV_PROXY_MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
const DAV_PROXY_RATE_WINDOW = 60;
const DAV_PROXY_RATE_MAX = 120;

function jsonProxyError($message, $code = 400) {
    header('Content-Type: application/json; charset=utf-8');
    respond(['success' => false, 'message' => $message], $code);
}

function getRequestHeaderValue($name) {
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return isset($_SERVER[$key]) && is_string($_SERVER[$key]) ? trim($_SERVER[$key]) : '';
}

function isSameOriginRequest() {
    $origin = getRequestHeaderValue('Origin');
    if ($origin === '') {
        return true;
    }

    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    if ($host === '') {
        return false;
    }

    $scheme = isHttpsRequest() ? 'https' : 'http';
    return strtolower($origin) === strtolower($scheme . '://' . $host);
}

function resolvePublicHostAddresses($host) {
    $host = trim($host, "[] \t\n\r\0\x0B");
    $lowerHost = strtolower($host);

    if ($lowerHost === 'localhost' || $lowerHost === 'localhost.localdomain') {
        jsonProxyError('WebDAV 中转不允许访问本机地址', 403);
    }

    if (filter_var($host, FILTER_VALIDATE_IP)) {
        if (!isPublicIpAddress($host)) {
            jsonProxyError('WebDAV 中转不允许访问内网或保留地址', 403);
        }
        return [$host];
    }

    $addresses = [];
    $ipv4 = gethostbynamel($host);
    if (is_array($ipv4)) {
        $addresses = array_merge($addresses, $ipv4);
    }

    if (function_exists('dns_get_record')) {
        $aaaaRecords = @dns_get_record($host, DNS_AAAA);
        if (is_array($aaaaRecords)) {
            foreach ($aaaaRecords as $record) {
                if (isset($record['ipv6'])) {
                    $addresses[] = $record['ipv6'];
                }
            }
        }
    }

    if (count($addresses) === 0) {
        jsonProxyError('无法解析 WebDAV 服务器地址', 400);
    }

    $normalizedAddresses = [];
    foreach ($addresses as $address) {
        $normalizedAddress = normalizeIpAddress($address);
        if ($normalizedAddress === null || !isPublicIpAddress($normalizedAddress)) {
            jsonProxyError('WebDAV 中转不允许访问内网或保留地址', 403);
        }
        $normalizedAddresses[$normalizedAddress] = true;
    }

    return array_keys($normalizedAddresses);
}

function buildDavTarget($baseUrl, $path) {
    if (!supportsGlobalIpRangeValidation()) {
        jsonProxyError('当前运行环境不支持安全的 WebDAV 地址校验', 503);
    }

    if ($baseUrl === '' || $path === '') {
        jsonProxyError('缺少 WebDAV 地址或路径', 400);
    }

    if (preg_match('/[\x00-\x20\x7F\\\\]/', $baseUrl . $path)) {
        jsonProxyError('WebDAV 地址格式无效', 400);
    }

    if (preg_match('/^[a-z][a-z0-9+.-]*:/i', $path)) {
        jsonProxyError('WebDAV 路径不能是完整 URL', 400);
    }

    $parts = parse_url($baseUrl);
    if (!$parts || !isset($parts['scheme']) || strtolower($parts['scheme']) !== 'https' || !isset($parts['host'])) {
        jsonProxyError('WebDAV 中转仅允许 HTTPS 地址', 400);
    }
    if (isset($parts['user']) || isset($parts['pass'])) {
        jsonProxyError('WebDAV 根地址不能包含凭据', 400);
    }
    if (isset($parts['query']) || isset($parts['fragment'])) {
        jsonProxyError('WebDAV 根地址不能包含查询参数或片段', 400);
    }

    $host = trim($parts['host'], '[]');
    $port = isset($parts['port']) ? (int)$parts['port'] : 443;
    if ($port < 1 || $port > 65535) {
        jsonProxyError('WebDAV 端口无效', 400);
    }

    $resolvedAddresses = resolvePublicHostAddresses($host);
    if (count($resolvedAddresses) === 0) {
        jsonProxyError('无法解析 WebDAV 服务器地址', 400);
    }

    $urlHost = filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) ? '[' . $host . ']' : $host;
    $urlPort = $port === 443 ? '' : ':' . $port;
    $basePath = isset($parts['path']) ? rtrim($parts['path'], '/') : '';
    $normalizedBase = 'https://' . $urlHost . $urlPort . $basePath;
    $normalizedPath = '/' . ltrim($path, '/');
    $url = $normalizedBase . $normalizedPath;

    $targetParts = parse_url($url);
    if (!$targetParts || !isset($targetParts['host']) || strtolower($targetParts['host']) !== strtolower($parts['host'])) {
        jsonProxyError('WebDAV 地址格式无效', 400);
    }

    return [
        'url' => $url,
        'host' => strtolower($host),
        'port' => $port,
        'pinnedIp' => $resolvedAddresses[0],
        'requiresResolve' => filter_var($host, FILTER_VALIDATE_IP) === false
    ];
}

function checkProxyRateLimit($username) {
    $rateDb = new Database('dav_proxy_rate_limit');
    $key = sanitizeDbKey('dav_' . $username . '_' . getClientIp());
    $now = time();
    $attempts = $rateDb->get($key);
    $timestamps = $attempts ? json_decode($attempts, true) : [];
    if (!is_array($timestamps)) {
        $timestamps = [];
    }

    $timestamps = array_filter($timestamps, function($timestamp) use ($now) {
        return ($now - (int)$timestamp) < DAV_PROXY_RATE_WINDOW;
    });

    if (count($timestamps) >= DAV_PROXY_RATE_MAX) {
        jsonProxyError('WebDAV 中转请求过于频繁，请稍后重试', 429);
    }

    $timestamps[] = $now;
    $rateDb->set($key, json_encode(array_values($timestamps)));
}

if (!isSameOriginRequest()) {
    jsonProxyError('WebDAV 中转仅允许同源调用', 403);
}

if (!ensureCsrfHeaderCookieMatched()) {
    jsonProxyError('CSRF 校验失败', 403);
}

$sessionDb = new Database('users_sessions');
$username = requireAuthenticatedUsername($sessionDb);
checkProxyRateLimit($username);

$method = $_SERVER['REQUEST_METHOD'];
$allowedMethods = ['GET', 'PUT', 'DELETE', 'PROPFIND', 'MKCOL', 'OPTIONS'];
if (!in_array($method, $allowedMethods, true)) {
    jsonProxyError('WebDAV 中转不支持该请求方法', 405);
}

$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
if ($contentLength > DAV_PROXY_MAX_REQUEST_BYTES) {
    jsonProxyError('WebDAV 上传内容超过限制', 413);
}

$davTarget = buildDavTarget(getRequestHeaderValue('x-dav-base-url'), getRequestHeaderValue('x-dav-path'));
$headers = [];

$authorization = getRequestHeaderValue('Authorization');
if ($authorization !== '' && !preg_match('/[\r\n]/', $authorization)) {
    $headers[] = 'Authorization: ' . $authorization;
}

$depth = getRequestHeaderValue('Depth');
if ($depth !== '' && in_array($depth, ['0', '1', 'infinity'], true)) {
    $headers[] = 'Depth: ' . $depth;
}

if (isset($_SERVER['CONTENT_TYPE']) && !preg_match('/[\r\n]/', $_SERVER['CONTENT_TYPE'])) {
    $headers[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
}

$inputStream = @fopen('php://input', 'rb');
if ($inputStream === false) {
    jsonProxyError('无法读取 WebDAV 请求内容', 400);
}
$bodyResult = readLimitedRequestBody($inputStream, DAV_PROXY_MAX_REQUEST_BYTES);
fclose($inputStream);
if ($bodyResult['tooLarge']) {
    jsonProxyError('WebDAV 上传内容超过限制', 413);
}
if (!$bodyResult['success']) {
    jsonProxyError('无法读取 WebDAV 请求内容', 400);
}
$body = $bodyResult['body'];

$ch = curl_init();
if ($ch === false) {
    jsonProxyError('WebDAV 中转初始化失败', 502);
}
if (!defined('CURLINFO_PRIMARY_IP')) {
    curl_close($ch);
    jsonProxyError('当前运行环境不支持安全的 WebDAV 中转', 503);
}
if ($davTarget['requiresResolve']) {
    if (!defined('CURLOPT_RESOLVE')) {
        curl_close($ch);
        jsonProxyError('当前运行环境不支持安全的 WebDAV 中转', 503);
    }
    $resolveEntry = buildCurlResolveEntry($davTarget['host'], $davTarget['port'], $davTarget['pinnedIp']);
    if (!curl_setopt($ch, CURLOPT_RESOLVE, [$resolveEntry])) {
        curl_close($ch);
        jsonProxyError('无法锁定 WebDAV 服务器地址', 502);
    }
}
$responseHeaders = '';
$responseBody = '';
$responseTooLarge = false;
curl_setopt($ch, CURLOPT_URL, $davTarget['url']);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
curl_setopt($ch, CURLOPT_HEADER, false);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
if (!curl_setopt($ch, CURLOPT_PROXY, '')) {
    curl_close($ch);
    jsonProxyError('无法禁用 WebDAV 中转代理', 502);
}
if (defined('CURLOPT_NOPROXY') && !curl_setopt($ch, CURLOPT_NOPROXY, '*')) {
    curl_close($ch);
    jsonProxyError('无法禁用 WebDAV 中转代理', 502);
}
curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($ch, $header) use (&$responseHeaders) {
    $responseHeaders .= $header;
    return strlen($header);
});
curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $chunk) use (&$responseBody, &$responseTooLarge) {
    if (strlen($responseBody) + strlen($chunk) > DAV_PROXY_MAX_RESPONSE_BYTES) {
        $responseTooLarge = true;
        return 0;
    }
    $responseBody .= $chunk;
    return strlen($chunk);
});

if ($body !== '') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$curlResult = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$primaryIp = curl_getinfo($ch, CURLINFO_PRIMARY_IP);
$error = curl_error($ch);
curl_close($ch);

if ($responseTooLarge) {
    jsonProxyError('WebDAV 响应内容超过限制', 502);
}

if ($curlResult === false || $error) {
    jsonProxyError('WebDAV 中转请求失败', 502);
}

if (!is_string($primaryIp) || !isPublicIpAddress($primaryIp) || !ipAddressesMatch($primaryIp, $davTarget['pinnedIp'])) {
    jsonProxyError('WebDAV 中转连接地址校验失败', 502);
}

$headerLines = explode("\r\n", $responseHeaders);
foreach ($headerLines as $line) {
    if (stripos($line, 'Content-Type:') === 0 && !preg_match('/[\r\n]/', $line)) {
        header($line);
    }
}

http_response_code($httpCode);
echo $responseBody;
?>
