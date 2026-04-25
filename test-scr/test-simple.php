<?php
header('Content-Type: application/json; charset=utf-8');

$result = [];

// 测试 Database 类
$result['database_exists'] = class_exists('Database');

// 测试不同的 require 路径
$paths = ['common.php', 'api/common.php'];
foreach ($paths as $path) {
    $result['file_exists'][$path] = file_exists($path);
}

// 尝试加载 common.php
try {
    require_once "common.php";
    $result['require_status'] = 'success';
    $result['respond_exists'] = function_exists('respond');
} catch (Throwable $e) {
    $result['require_status'] = 'failed';
    $result['error'] = $e->getMessage();
}

echo json_encode($result, JSON_UNESCAPED_UNICODE);
