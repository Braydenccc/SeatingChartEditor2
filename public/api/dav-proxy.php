<?php
require_once "api/common.php";

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

function isPublicIpAddress($ip) {
    return filter_var(
        $ip,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    ) !== false;
}

function assertPublicHost($host) {
    $host = trim($host, "[] \t\n\r\0\x0B");
    $lowerHost = strtolower($host);

    if ($lowerHost === 'localhost' || $lowerHost === 'localhost.localdomain') {
        jsonProxyError('WebDAV 中转不允许访问本机地址', 403);
    }

    if (filter_var($host, FILTER_VALIDATE_IP)) {
        if (!isPublicIpAddress($host)) {
            jsonProxyError('WebDAV 中转不允许访问内网或保留地址', 403);
        }
        return;
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

    foreach ($addresses as $address) {
        if (!isPublicIpAddress($address)) {
            jsonProxyError('WebDAV 中转不允许访问内网或保留地址', 403);
        }
    }
}

function buildDavUrl($baseUrl, $path) {
    if ($baseUrl === '' || $path === '') {
        jsonProxyError('缺少 WebDAV 地址或路径', 400);
    }

    if (preg_match('/[\r\n]/', $baseUrl . $path)) {
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

    assertPublicHost($parts['host']);

    $normalizedBase = rtrim($baseUrl, '/');
    $normalizedPath = '/' . ltrim($path, '/');
    $url = $normalizedBase . $normalizedPath;

    $targetParts = parse_url($url);
    if (!$targetParts || !isset($targetParts['host']) || strtolower($targetParts['host']) !== strtolower($parts['host'])) {
        jsonProxyError('WebDAV 地址格式无效', 400);
    }

    return $url;
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

$davUrl = buildDavUrl(getRequestHeaderValue('x-dav-base-url'), getRequestHeaderValue('x-dav-path'));
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

$body = file_get_contents('php://input');

$ch = curl_init();
$responseHeaders = '';
$responseBody = '';
$responseTooLarge = false;
curl_setopt($ch, CURLOPT_URL, $davUrl);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
curl_setopt($ch, CURLOPT_HEADER, false);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
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
$error = curl_error($ch);
curl_close($ch);

if ($responseTooLarge) {
    jsonProxyError('WebDAV 响应内容超过限制', 502);
}

if ($curlResult === false || $error) {
    jsonProxyError('WebDAV 中转请求失败', 502);
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
