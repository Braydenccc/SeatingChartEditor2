<?php
function debugGuardNormalizeHost($host) {
    if (!is_string($host)) {
        return '';
    }

    $host = strtolower(trim($host));
    $host = trim($host, '[]');
    return preg_replace('/:\d+$/', '', $host);
}

function debugGuardEnvEnabled($name) {
    if (!function_exists('getenv')) {
        return false;
    }

    $value = getenv($name);
    return $value === '1' || strtolower((string)$value) === 'true';
}

function debugGuardIsLocalRequest() {
    $rawHost = isset($_SERVER['HTTP_HOST']) ? strtolower(trim((string)$_SERVER['HTTP_HOST'])) : '';
    $host = debugGuardNormalizeHost(trim($rawHost, '[]'));
    $remoteAddr = isset($_SERVER['REMOTE_ADDR']) ? trim((string)$_SERVER['REMOTE_ADDR']) : '';

    return strpos($rawHost, '[::1]') === 0 ||
        in_array(trim($rawHost, '[]'), ['localhost', '127.0.0.1', '::1'], true) ||
        in_array($host, ['localhost', '127.0.0.1', '::1'], true) ||
        in_array($remoteAddr, ['127.0.0.1', '::1'], true);
}

if (!debugGuardIsLocalRequest() && !debugGuardEnvEnabled('ALLOW_PUBLIC_DEBUG_ENDPOINTS')) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Debug endpoint disabled'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);
    exit(1);
}
?>
