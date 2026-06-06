<?php
require_once "api/debug-guard.php";
header('Content-Type: application/json; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', 1);

$result = ['step' => 'start'];

try {
    $result['step'] = 'before_require';
    $result['file_exists'] = file_exists('api/common.php');
    $result['cwd'] = getcwd();

    require_once "api/common.php";

    $result['step'] = 'after_require';
    $result['respond_exists'] = function_exists('respond');
    $result['database_exists'] = class_exists('Database');

    $result['status'] = 'success';
} catch (Exception $e) {
    $result['status'] = 'error';
    $result['error'] = $e->getMessage();
    $result['file'] = $e->getFile();
    $result['line'] = $e->getLine();
} catch (Error $e) {
    $result['status'] = 'fatal_error';
    $result['error'] = $e->getMessage();
    $result['file'] = $e->getFile();
    $result['line'] = $e->getLine();
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
