<?php
header('Content-Type: application/json; charset=utf-8');

$result = [
    'step' => 'init',
    'errors' => []
];

try {
    // Step 1: Check basic PHP functions
    $result['step'] = 'checking_php_functions';
    $result['php_version'] = phpversion();
    $result['password_hash_exists'] = function_exists('password_hash');
    $result['random_bytes_exists'] = function_exists('random_bytes');
    $result['json_encode_exists'] = function_exists('json_encode');

    // Step 2: Load common.php
    $result['step'] = 'loading_common';
    require_once "api/common.php";
    $result['common_loaded'] = true;

    // Step 3: Check Database class
    $result['step'] = 'checking_database';
    $result['database_class_exists'] = class_exists('Database');

    // Step 4: Test parseRequestInput with simulated POST data
    $result['step'] = 'testing_parse_input';
    $_POST = [];
    $_GET = [];

    // Simulate JSON input
    $testInput = json_encode(['action' => 'register', 'username' => 'test', 'password' => 'Test1234', '_csrf' => 'test']);
    file_put_contents('php://input', $testInput);

    // Step 5: Test Database instantiation
    $result['step'] = 'testing_database_init';
    try {
        $db = new Database("test_users");
        $result['database_init'] = 'success';
    } catch (Exception $e) {
        $result['database_init'] = 'failed';
        $result['database_error'] = $e->getMessage();
    }

    // Step 6: Test CSRF check
    $result['step'] = 'testing_csrf';
    $_SERVER['HTTP_X_CSRF_TOKEN'] = 'test';
    $csrfResult = ensureCsrfMatched(['_csrf' => 'test']);
    $result['csrf_check'] = $csrfResult ? 'passed' : 'failed';

    // Step 7: Check if we can reach auth.php logic
    $result['step'] = 'checking_auth_file';
    $result['auth_file_exists'] = file_exists('api/auth.php');

    $result['step'] = 'complete';
    $result['status'] = 'success';

} catch (Exception $e) {
    $result['status'] = 'error';
    $result['error_message'] = $e->getMessage();
    $result['error_file'] = $e->getFile();
    $result['error_line'] = $e->getLine();
    $result['error_trace'] = $e->getTraceAsString();
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
