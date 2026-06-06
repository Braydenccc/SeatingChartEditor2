<?php
require_once "api/debug-guard.php";
require_once "api/common.php";
header('Content-Type: application/json; charset=utf-8');

$result = ['steps' => []];

try {
    // Step 1: Check Database class
    $result['steps'][] = 'Checking Database class';
    if (!class_exists('Database')) {
        $result['error'] = 'Database class not found';
        echo json_encode($result, JSON_PRETTY_PRINT);
        exit;
    }
    $result['database_exists'] = true;

    // Step 2: Parse input
    $result['steps'][] = 'Parsing input';
    $rawInput = file_get_contents('php://input');
    $result['raw_input'] = $rawInput;
    $input = json_decode($rawInput, true);
    $result['parsed_input'] = $input;

    if (!$input) {
        $input = $_POST ?: $_GET;
    }

    // Step 3: Check action
    $result['steps'][] = 'Checking action';
    $action = $input['action'] ?? 'none';
    $result['action'] = $action;

    // Step 4: Check CSRF
    $result['steps'][] = 'Checking CSRF';
    $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $bodyCsrf = $input['_csrf'] ?? '';
    $result['csrf_header'] = $csrfHeader;
    $result['csrf_body'] = $bodyCsrf;
    $result['csrf_match'] = ensureCsrfMatched($input);

    // Step 5: Try to create Database instances
    $result['steps'][] = 'Creating Database instances';
    try {
        $db = new Database("users");
        $result['users_db'] = 'created';
    } catch (Exception $e) {
        $result['users_db_error'] = $e->getMessage();
    }

    try {
        $sessionDb = new Database("users_sessions");
        $result['sessions_db'] = 'created';
    } catch (Exception $e) {
        $result['sessions_db_error'] = $e->getMessage();
    }

    // Step 6: Test password functions
    $result['steps'][] = 'Testing password functions';
    $result['password_hash_exists'] = function_exists('password_hash');
    $result['password_verify_exists'] = function_exists('password_verify');
    $result['random_bytes_exists'] = function_exists('random_bytes');

    if (function_exists('password_hash')) {
        try {
            $testHash = password_hash('test', PASSWORD_DEFAULT);
            $result['password_hash_test'] = 'success';
        } catch (Exception $e) {
            $result['password_hash_error'] = $e->getMessage();
        }
    }

    if (function_exists('random_bytes')) {
        try {
            $testBytes = random_bytes(32);
            $result['random_bytes_test'] = 'success';
        } catch (Exception $e) {
            $result['random_bytes_error'] = $e->getMessage();
        }
    }

    $result['status'] = 'all_checks_passed';

} catch (Exception $e) {
    $result['status'] = 'exception';
    $result['error'] = $e->getMessage();
    $result['file'] = $e->getFile();
    $result['line'] = $e->getLine();
    $result['trace'] = $e->getTraceAsString();
} catch (Error $e) {
    $result['status'] = 'fatal_error';
    $result['error'] = $e->getMessage();
    $result['file'] = $e->getFile();
    $result['line'] = $e->getLine();
    $result['trace'] = $e->getTraceAsString();
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
