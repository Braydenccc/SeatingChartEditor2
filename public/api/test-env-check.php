<?php
header('Content-Type: application/json; charset=utf-8');

$host = $_SERVER['HTTP_HOST'] ?? '';
$isTestEnv = strpos($host, 'test') !== false || strpos($host, 'localhost') !== false;

$result = [
    'host' => $host,
    'isTestEnv' => $isTestEnv,
    'strpos_result' => strpos($host, 'test'),
    'all_server_vars' => [
        'HTTP_HOST' => $_SERVER['HTTP_HOST'] ?? 'not set',
        'SERVER_NAME' => $_SERVER['SERVER_NAME'] ?? 'not set',
        'REQUEST_URI' => $_SERVER['REQUEST_URI'] ?? 'not set'
    ]
];

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
