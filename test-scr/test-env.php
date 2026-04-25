<?php
header('Content-Type: application/json; charset=utf-8');

$result = [
    'php_version' => phpversion(),
    'database_class_exists' => class_exists('Database'),
    'password_hash_exists' => function_exists('password_hash'),
    'random_bytes_exists' => function_exists('random_bytes'),
    'json_encode_exists' => function_exists('json_encode'),
];

// Test require_once
try {
    require_once "common.php";
    $result['common_loaded'] = true;
    $result['respond_exists'] = function_exists('respond');
    $result['isValidUsername_exists'] = function_exists('isValidUsername');
} catch (Exception $e) {
    $result['common_loaded'] = false;
    $result['error'] = $e->getMessage();
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
