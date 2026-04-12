<?php
header('Content-Type: application/json; charset=utf-8');

function respond($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);
    exit($code >= 400 ? 1 : 0);
}

$results = [];
$overallSuccess = true;

try {
    $results[] = [
        'test' => 'Database class existence',
        'status' => class_exists('Database') ? 'pass' : 'fail',
        'message' => class_exists('Database') ? 'Database class is available' : 'Database class not found'
    ];
    
    if (!class_exists('Database')) {
        $overallSuccess = false;
        respond([
            'success' => false,
            'message' => 'Database class not available',
            'tests' => $results
        ], 500);
    }

    $db = new Database("test_db");
    $results[] = [
        'test' => 'Database connection',
        'status' => 'pass',
        'message' => 'Successfully connected to test_db'
    ];

    $testKey = 'test_key_' . time();
    $testValue = 'Hello from test at ' . date('Y-m-d H:i:s');
    
    $db->set($testKey, $testValue);
    $results[] = [
        'test' => 'Database write',
        'status' => 'pass',
        'message' => 'Successfully wrote to database'
    ];

    $readValue = $db->get($testKey);
    $results[] = [
        'test' => 'Database read',
        'status' => $readValue === $testValue ? 'pass' : 'fail',
        'message' => $readValue === $testValue ? 'Successfully read from database' : 'Read value does not match written value',
        'expected' => $testValue,
        'actual' => $readValue
    ];
    
    if ($readValue !== $testValue) {
        $overallSuccess = false;
    }

    $keys = $db->list_keys();
    $results[] = [
        'test' => 'List keys',
        'status' => is_array($keys) ? 'pass' : 'fail',
        'message' => is_array($keys) ? 'Successfully listed keys' : 'Failed to list keys',
        'keyCount' => is_array($keys) ? count($keys) : 0
    ];

    $db->delete($testKey);
    $results[] = [
        'test' => 'Database delete',
        'status' => 'pass',
        'message' => 'Successfully deleted test key'
    ];

    $deletedValue = $db->get($testKey);
    $results[] = [
        'test' => 'Verify deletion',
        'status' => $deletedValue === null ? 'pass' : 'fail',
        'message' => $deletedValue === null ? 'Test key successfully deleted' : 'Test key still exists after deletion'
    ];
    
    if ($deletedValue !== null) {
        $overallSuccess = false;
    }

    $arrayKey = 'test_array_' . time();
    $db->push($arrayKey, 'item1');
    $db->push($arrayKey, 'item2');
    $db->push($arrayKey, 'item3');
    $results[] = [
        'test' => 'Array push',
        'status' => 'pass',
        'message' => 'Successfully pushed items to array'
    ];

    $arrayValue = $db->get_array($arrayKey);
    $results[] = [
        'test' => 'Get array',
        'status' => is_array($arrayValue) && count($arrayValue) === 3 ? 'pass' : 'fail',
        'message' => is_array($arrayValue) && count($arrayValue) === 3 ? 'Successfully retrieved array' : 'Array retrieval failed or incorrect count',
        'expectedCount' => 3,
        'actualCount' => is_array($arrayValue) ? count($arrayValue) : 0
    ];

    $db->delete($arrayKey);
    $results[] = [
        'test' => 'Cleanup',
        'status' => 'pass',
        'message' => 'Test data cleaned up successfully'
    ];

    respond([
        'success' => $overallSuccess,
        'message' => $overallSuccess ? 'All database tests passed' : 'Some database tests failed',
        'tests' => $results
    ]);

} catch (Exception $e) {
    $results[] = [
        'test' => 'Exception',
        'status' => 'fail',
        'message' => 'Exception occurred: ' . $e->getMessage(),
        'exception' => $e->__toString()
    ];
    respond([
        'success' => false,
        'message' => 'Exception occurred during testing',
        'tests' => $results
    ], 500);
}
?>