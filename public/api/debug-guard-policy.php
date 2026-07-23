<?php
const DEBUG_GUARD_MIN_TOKEN_BYTES = 32;

function debugGuardEnvValue($name) {
    if (!function_exists('getenv')) {
        return '';
    }

    $value = getenv($name);
    return is_string($value) ? trim($value) : '';
}

function debugGuardEnvEnabled($name) {
    $value = debugGuardEnvValue($name);
    return $value === '1' || strtolower((string)$value) === 'true';
}

function debugGuardRequestHeaderValue($name) {
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return isset($_SERVER[$key]) && is_string($_SERVER[$key]) ? trim($_SERVER[$key]) : '';
}

function debugGuardCredentialsAuthorized($environment, $enabled, $expectedToken, $providedToken) {
    $normalizedEnvironment = strtolower(trim((string)$environment));
    if (!in_array($normalizedEnvironment, ['development', 'test'], true) || $enabled !== true) {
        return false;
    }
    if (
        strlen((string)$expectedToken) < DEBUG_GUARD_MIN_TOKEN_BYTES ||
        (string)$providedToken === '' ||
        !function_exists('hash_equals')
    ) {
        return false;
    }

    return hash_equals((string)$expectedToken, (string)$providedToken);
}

function debugGuardIsAuthorized() {
    return debugGuardCredentialsAuthorized(
        debugGuardEnvValue('SCE_RUNTIME_ENV'),
        debugGuardEnvEnabled('SCE_DEBUG_ENDPOINTS_ENABLED'),
        debugGuardEnvValue('SCE_DEBUG_ENDPOINT_TOKEN'),
        debugGuardRequestHeaderValue('X-SCE-Debug-Token')
    );
}
