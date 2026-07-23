<?php
require_once "api/debug-guard-policy.php";

if (!debugGuardIsAuthorized()) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode(['success' => false, 'message' => 'Debug endpoint disabled'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);
    exit(1);
}
