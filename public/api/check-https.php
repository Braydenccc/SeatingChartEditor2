<?php
header('Content-Type: application/json; charset=utf-8');

$httpsDetection = [
    'HTTPS' => isset($_SERVER['HTTPS']) ? $_SERVER['HTTPS'] : 'not set',
    'HTTP_X_FORWARDED_PROTO' => isset($_SERVER['HTTP_X_FORWARDED_PROTO']) ? $_SERVER['HTTP_X_FORWARDED_PROTO'] : 'not set',
    'HTTP_X_FORWARDED_SSL' => isset($_SERVER['HTTP_X_FORWARDED_SSL']) ? $_SERVER['HTTP_X_FORWARDED_SSL'] : 'not set',
    'SERVER_PORT' => isset($_SERVER['SERVER_PORT']) ? $_SERVER['SERVER_PORT'] : 'not set',
    'REQUEST_SCHEME' => isset($_SERVER['REQUEST_SCHEME']) ? $_SERVER['REQUEST_SCHEME'] : 'not set',
];

$isHttps = false;
if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
    $isHttps = true;
}
if (!$isHttps && isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
    $isHttps = true;
}
if (!$isHttps && isset($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on') {
    $isHttps = true;
}
if (!$isHttps && isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) {
    $isHttps = true;
}
if (!$isHttps && isset($_SERVER['REQUEST_SCHEME']) && $_SERVER['REQUEST_SCHEME'] === 'https') {
    $isHttps = true;
}

echo json_encode([
    'success' => true,
    'isHttps' => $isHttps,
    'detection' => $httpsDetection,
    'server' => [
        'SERVER_NAME' => isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : 'not set',
        'HTTP_HOST' => isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'not set',
    ]
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
