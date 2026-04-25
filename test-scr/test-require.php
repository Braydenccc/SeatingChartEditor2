<?php
header('Content-Type: application/json; charset=utf-8');

$result = [
    'php_version' => phpversion(),
    'current_file' => __FILE__ ?? 'N/A',
    'script_filename' => $_SERVER['SCRIPT_FILENAME'] ?? 'N/A',
    'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'N/A',
    'pwd' => getcwd(),
];

// 测试不同的 require 路径
$paths_to_test = [
    'common.php',
    'api/common.php',
    '../common.php',
    './common.php',
];

foreach ($paths_to_test as $path) {
    $result['paths'][$path] = [
        'exists' => file_exists($path),
        'realpath' => realpath($path) ?: 'not found'
    ];
}

// 尝试加载 common.php
try {
    ob_start();
    require_once "common.php";
    $output = ob_get_clean();
    $result['require_common'] = 'success';
    $result['functions_defined'] = [
        'respond' => function_exists('respond'),
        'isValidUsername' => function_exists('isValidUsername'),
        'ensureCsrfMatched' => function_exists('ensureCsrfMatched'),
    ];
} catch (Throwable $e) {
    $result['require_common'] = 'failed';
    $result['error'] = $e->getMessage();
    $result['trace'] = $e->getTraceAsString();
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
