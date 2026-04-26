<?php
header('Content-Type: application/json; charset=utf-8');

$httpsChecks = [
    'HTTPS' => isset($_SERVER['HTTPS']) ? $_SERVER['HTTPS'] : 'not set',
    'HTTP_X_FORWARDED_PROTO' => isset($_SERVER['HTTP_X_FORWARDED_PROTO']) ? $_SERVER['HTTP_X_FORWARDED_PROTO'] : 'not set',
    'HTTP_X_FORWARDED_SSL' => isset($_SERVER['HTTP_X_FORWARDED_SSL']) ? $_SERVER['HTTP_X_FORWARDED_SSL'] : 'not set',
    'REQUEST_SCHEME' => isset($_SERVER['REQUEST_SCHEME']) ? $_SERVER['REQUEST_SCHEME'] : 'not set',
    'SERVER_PORT' => isset($_SERVER['SERVER_PORT']) ? $_SERVER['SERVER_PORT'] : 'not set',
    'HTTP_CF_VISITOR' => isset($_SERVER['HTTP_CF_VISITOR']) ? $_SERVER['HTTP_CF_VISITOR'] : 'not set',
];

$currentUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://" . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];

echo json_encode([
    'current_url' => $currentUrl,
    'checks' => $httpsChecks,
    'all_server_vars' => array_filter($_SERVER, function($key) {
        return strpos($key, 'HTTP') === 0 || in_array($key, ['HTTPS', 'REQUEST_SCHEME', 'SERVER_PORT']);
    }, ARRAY_FILTER_USE_KEY)
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
?>
