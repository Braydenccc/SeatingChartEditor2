<?php
header('Content-Type: application/json; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once "api/common.php";

$results = [];

// 测试 sanitizeDbKey 函数
$testCases = [
    '192.168.1.1' => '192_168_1_1',
    '2001:0db8:85a3::8a2e:0370:7334' => '2001_0db8_85a3__8a2e_0370_7334',
    'user@example.com' => 'user_example_com',
    'test-key_123' => 'test-key_123',
    'valid_key' => 'valid_key',
];

foreach ($testCases as $input => $expected) {
    $output = sanitizeDbKey($input);
    $results[] = [
        'input' => $input,
        'expected' => $expected,
        'output' => $output,
        'passed' => $output === $expected
    ];
}

// 测试实际数据库操作
try {
    $db = new Database('test_sanitization');

    // 测试 IPv4 地址
    $ipv4 = '192.168.1.100';
    $key1 = 'ip_' . sanitizeDbKey($ipv4);
    $db->set($key1, 'test_value_ipv4');
    $value1 = $db->get($key1);

    $results[] = [
        'test' => 'IPv4 database operation',
        'key' => $key1,
        'success' => $value1 === 'test_value_ipv4'
    ];

    // 测试 IPv6 地址
    $ipv6 = '2001:0db8:85a3::8a2e:0370:7334';
    $key2 = 'ip_' . sanitizeDbKey($ipv6);
    $db->set($key2, 'test_value_ipv6');
    $value2 = $db->get($key2);

    $results[] = [
        'test' => 'IPv6 database operation',
        'key' => $key2,
        'success' => $value2 === 'test_value_ipv6'
    ];

    // 清理
    $db->delete($key1);
    $db->delete($key2);

} catch (Exception $e) {
    $results[] = [
        'test' => 'Database operation',
        'error' => $e->getMessage()
    ];
}

echo json_encode([
    'status' => 'success',
    'results' => $results
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
