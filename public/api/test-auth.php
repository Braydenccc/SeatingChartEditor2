<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json; charset=utf-8');

try {
    echo json_encode([
        'step' => 1,
        'message' => 'PHP is working',
        'php_version' => phpversion()
    ]);

    require_once "api/common.php";

    echo json_encode([
        'step' => 2,
        'message' => 'common.php loaded',
        'functions' => [
            'respond' => function_exists('respond'),
            'getClientIp' => function_exists('getClientIp'),
            'ensureCsrfMatched' => function_exists('ensureCsrfMatched'),
            'isValidUsername' => function_exists('isValidUsername'),
            'isAuthorized' => function_exists('isAuthorized'),
            'parseRequestInput' => function_exists('parseRequestInput')
        ]
    ]);

    if (class_exists('Database')) {
        echo json_encode([
            'step' => 3,
            'message' => 'Database class exists'
        ]);
    } else {
        echo json_encode([
            'step' => 3,
            'message' => 'Database class NOT found (expected in dev)'
        ]);
    }

    echo json_encode([
        'step' => 4,
        'message' => 'All checks passed',
        'success' => true
    ]);

} catch (Exception $e) {
    echo json_encode([
        'error' => true,
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ]);
} catch (Error $e) {
    echo json_encode([
        'error' => true,
        'type' => 'Error',
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ]);
}
