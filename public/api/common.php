<?php

const MIN_TOKEN_LENGTH = 32;

// Database 类存根（仅用于本地开发，生产环境由 Retinbox 平台提供）
if (!class_exists('Database')) {
    class Database {
        public function __construct($name) {}
        public function get($key) { return null; }
        public function set($key, $value) { return true; }
        public function delete($key, $value = null) { return true; }
        public function list_keys() { return []; }
        public function search_value($pattern) { return []; }
        public function push($key, $value) { return true; }
        public function get_array($key) { return null; }
    }
}

function respond($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);
    exit($code >= 400 ? 1 : 0);
}

function isLocalRequest() {
    $remoteAddress = isset($_SERVER['REMOTE_ADDR']) ? strtolower(trim((string)$_SERVER['REMOTE_ADDR'])) : '';
    if ($remoteAddress === '::1') {
        return true;
    }

    if (preg_match('/^::ffff:(127(?:\.\d{1,3}){3})$/', $remoteAddress, $matches)) {
        $remoteAddress = $matches[1];
    }

    return filter_var($remoteAddress, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false &&
        strpos($remoteAddress, '127.') === 0;
}

function envFlagEnabled($name) {
    if (!function_exists('getenv')) {
        return false;
    }

    $value = getenv($name);
    return $value === '1' || strtolower((string)$value) === 'true';
}

function normalizeUtf8String($value) {
    $stringValue = (string)$value;
    if (preg_match('//u', $stringValue) === 1) {
        return $stringValue;
    }

    $encoded = json_encode($stringValue, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if (!is_string($encoded)) {
        return '[invalid utf-8]';
    }

    $decoded = json_decode($encoded, true);
    return is_string($decoded) ? $decoded : '[invalid utf-8]';
}

function truncateUtf8String($value, $maxBytes, $suffix = '') {
    $normalized = normalizeUtf8String($value);
    $normalizedSuffix = normalizeUtf8String($suffix);
    if ($maxBytes <= 0 || strlen($normalized) <= $maxBytes) {
        return $maxBytes <= 0 ? '' : $normalized;
    }

    if (strlen($normalizedSuffix) >= $maxBytes) {
        $normalized = $normalizedSuffix;
        $normalizedSuffix = '';
    } else {
        $maxBytes -= strlen($normalizedSuffix);
    }

    if (function_exists('mb_strcut')) {
        return mb_strcut($normalized, 0, $maxBytes, 'UTF-8') . $normalizedSuffix;
    }

    $truncated = substr($normalized, 0, $maxBytes);
    while ($truncated !== '' && preg_match('//u', $truncated) !== 1) {
        $truncated = substr($truncated, 0, -1);
    }
    return $truncated . $normalizedSuffix;
}

function sanitizeSingleLineLogText($value, $maxBytes = 512) {
    $normalized = normalizeUtf8String($value);
    $singleLine = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $normalized);
    if (!is_string($singleLine)) {
        $singleLine = '[invalid log text]';
    }
    return truncateUtf8String($singleLine, max(0, (int)$maxBytes), '...');
}

function sanitizeStructuredLogValue($value, $depth = 0) {
    if ($depth > 4) {
        return '[truncated]';
    }
    if (is_string($value)) {
        $normalized = normalizeUtf8String($value);
        return strlen($normalized) > 512 ? truncateUtf8String($normalized, 512, '...') : $normalized;
    }
    if ($value === null || is_bool($value) || is_int($value)) {
        return $value;
    }
    if (is_float($value)) {
        return is_finite($value) ? $value : '[non-finite number]';
    }
    if (!is_array($value)) {
        return '[' . gettype($value) . ']';
    }

    $sanitized = [];
    $count = 0;
    foreach ($value as $key => $item) {
        if ($count >= 25) {
            $sanitized['__truncated'] = true;
            break;
        }
        $safeKey = is_string($key) ? truncateUtf8String($key, 80, '...') : $key;
        $sanitized[$safeKey] = sanitizeStructuredLogValue($item, $depth + 1);
        $count++;
    }
    return $sanitized;
}

function encodeBoundedSecurityLogEntry($event, $username, $ip, $details, $maxBytes = 4096) {
    $maxBytes = max(512, (int)$maxBytes);
    $safeEvent = truncateUtf8String($event, 80, '...');
    $safeUsername = truncateUtf8String($username, 80, '...');
    $safeIp = truncateUtf8String($ip, 64, '...');
    $jsonFlags = JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_INVALID_UTF8_SUBSTITUTE;
    $entry = [
        'event' => $safeEvent,
        'username' => $safeUsername,
        'ip' => $safeIp,
        'time' => time(),
        'timestamp' => date('c'),
        'details' => sanitizeStructuredLogValue($details)
    ];
    $encoded = json_encode($entry, $jsonFlags);
    if (is_string($encoded) && strlen($encoded) <= $maxBytes) {
        return $encoded;
    }

    error_log("Security log entry used bounded fallback for {$safeEvent}");
    $fallback = json_encode([
        'event' => $safeEvent ?: 'security_log_encode_failure',
        'username' => $safeUsername,
        'ip' => $safeIp,
        'time' => time(),
        'timestamp' => date('c'),
        'details' => [
            'truncated' => true,
            'reason' => is_string($encoded) ? 'entry_too_large' : 'json_encode_failed'
        ]
    ], $jsonFlags);
    if (is_string($fallback) && strlen($fallback) <= $maxBytes) {
        return $fallback;
    }

    return '{"event":"security_log_encode_failure","username":"","ip":"","details":{"truncated":true}}';
}

function isValidUsername($username) {
    return is_string($username) && preg_match('/^[A-Za-z0-9_-]{1,32}$/', $username);
}

function isValidFileId($fileId) {
    return is_string($fileId) && preg_match('/^[A-Za-z0-9_-]{1,64}$/', $fileId);
}

function validatePasswordStrength($password) {
    if (!is_string($password) || strlen($password) < 8) {
        return ['valid' => false, 'message' => '密码至少需要 8 个字符'];
    }

    if (!preg_match('/[A-Z]/', $password)) {
        return ['valid' => false, 'message' => '密码必须包含至少一个大写字母'];
    }

    if (!preg_match('/[a-z]/', $password)) {
        return ['valid' => false, 'message' => '密码必须包含至少一个小写字母'];
    }

    if (!preg_match('/[0-9]/', $password)) {
        return ['valid' => false, 'message' => '密码必须包含至少一个数字'];
    }

    return ['valid' => true, 'message' => ''];
}

function getUserProfile($profileDb, $username) {
    if (!isValidUsername($username)) {
        return ['status' => 'disabled'];
    }

    $rawProfile = $profileDb->get($username);
    $profile = $rawProfile ? json_decode($rawProfile, true) : [];
    if (!is_array($profile)) {
        $profile = [];
    }

    $status = isset($profile['status']) && $profile['status'] === 'disabled' ? 'disabled' : 'active';
    $profile['username'] = $username;
    $profile['status'] = $status;

    return $profile;
}

function isUserDisabled($profileDb, $username) {
    $profile = getUserProfile($profileDb, $username);
    return isset($profile['status']) && $profile['status'] === 'disabled';
}

function createUserSessionEpoch() {
    return bin2hex(random_bytes(16));
}

function getUserSessionEpoch($profile) {
    if (!is_array($profile) || !array_key_exists('sessionEpoch', $profile)) {
        return '';
    }

    $sessionEpoch = $profile['sessionEpoch'];
    return is_string($sessionEpoch) && preg_match('/^[a-f0-9]{32}$/', $sessionEpoch)
        ? $sessionEpoch
        : null;
}

function getPasswordHashFingerprint($passwordHash) {
    return is_string($passwordHash) && $passwordHash !== ''
        ? hash('sha256', $passwordHash)
        : null;
}

function ensureCsrfMatched($input = null) {
    if ($input === null) {
        global $input;
    }

    $csrfHeader = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? trim($_SERVER['HTTP_X_CSRF_TOKEN']) : '';
    $bodyCsrf = (is_array($input) && isset($input['_csrf']) && is_string($input['_csrf'])) ? trim($input['_csrf']) : '';
    $cookieCsrf = isset($_COOKIE['sce_csrf']) && is_string($_COOKIE['sce_csrf']) ? trim($_COOKIE['sce_csrf']) : '';

    if (
        $csrfHeader !== '' &&
        $bodyCsrf !== '' &&
        $cookieCsrf !== '' &&
        hash_equals($csrfHeader, $bodyCsrf) &&
        hash_equals($csrfHeader, $cookieCsrf)
    ) {
        return true;
    }

    return false;
}

function ensureCsrfHeaderCookieMatched() {
    $csrfHeader = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? trim($_SERVER['HTTP_X_CSRF_TOKEN']) : '';
    $cookieCsrf = isset($_COOKIE['sce_csrf']) && is_string($_COOKIE['sce_csrf']) ? trim($_COOKIE['sce_csrf']) : '';

    return $csrfHeader !== '' && $cookieCsrf !== '' && hash_equals($csrfHeader, $cookieCsrf);
}

function isAuthorized($sessionDb, $profileDb, $usersDb, $username, $token) {
    if (!is_string($username) || !is_string($token) || strlen($token) < MIN_TOKEN_LENGTH) {
        return false;
    }
    $savedData = $sessionDb->get($username);
    if (!$savedData) {
        return false;
    }

    $data = json_decode($savedData, true);
    // 兼容旧格式（token）和新格式（tokenHash）
    if (!is_array($data) || (!isset($data['token']) && !isset($data['tokenHash'])) || !isset($data['expiry'])) {
        return false;
    }

    if (time() > (int)$data['expiry']) {
        // 认证读路径不能无锁删除：读取旧会话后，登录或改密可能已经写入了新会话。
        // 新登录会覆盖这个过期值；显式登出和账号安全操作负责在用户租约内删除。
        return false;
    }

    // 新格式：比对 Token 的 SHA-256 哈希
    if (isset($data['tokenHash'])) {
        $tokenHash = hash('sha256', $token);
        $tokenMatches = is_string($data['tokenHash']) && hash_equals($data['tokenHash'], $tokenHash);
    } else {
        // 旧格式：比对明文 Token（向后兼容）
        $tokenMatches = is_string($data['token']) && hash_equals($data['token'], $token);
    }

    if (!$tokenMatches) {
        return false;
    }

    $profile = getUserProfile($profileDb, $username);
    if (isset($profile['status']) && $profile['status'] === 'disabled') {
        return false;
    }

    $profileEpoch = getUserSessionEpoch($profile);
    $sessionEpoch = array_key_exists('sessionEpoch', $data) ? $data['sessionEpoch'] : '';
    if ($profileEpoch === null || !is_string($sessionEpoch) || !hash_equals($profileEpoch, $sessionEpoch)) {
        return false;
    }

    if (array_key_exists('credentialFingerprint', $data)) {
        $storedFingerprint = $data['credentialFingerprint'];
        $currentFingerprint = getPasswordHashFingerprint($usersDb->get($username));
        if (
            !is_string($storedFingerprint) ||
            $currentFingerprint === null ||
            !hash_equals($storedFingerprint, $currentFingerprint)
        ) {
            return false;
        }
    }

    return true;
}

function getAuthenticatedUsername($sessionDb) {
    $username = isset($_COOKIE['sce_username']) && is_string($_COOKIE['sce_username']) ? trim($_COOKIE['sce_username']) : '';
    $token = isset($_COOKIE['sce_token']) && is_string($_COOKIE['sce_token']) ? trim($_COOKIE['sce_token']) : '';

    $profileDb = new Database('user_profiles');
    $usersDb = new Database('users');

    if (!isValidUsername($username) || !isAuthorized($sessionDb, $profileDb, $usersDb, $username, $token)) {
        return null;
    }

    return $username;
}

function requireAuthenticatedUsername($sessionDb) {
    $username = getAuthenticatedUsername($sessionDb);
    if ($username === null) {
        respond(['success' => false, 'message' => '未授权的访问'], 401);
    }
    return $username;
}

function normalizeRequestHost($host) {
    if (!is_string($host)) {
        return '';
    }

    $host = strtolower(trim($host));
    if ($host === '') {
        return '';
    }

    return preg_replace('/:\d+$/', '', $host);
}

function isHttpsSameHostUrl($url) {
    if (!is_string($url) || trim($url) === '') {
        return false;
    }

    $parts = parse_url($url);
    if (!is_array($parts) || !isset($parts['scheme']) || !isset($parts['host'])) {
        return false;
    }

    if (strtolower($parts['scheme']) !== 'https') {
        return false;
    }

    $requestHost = isset($_SERVER['HTTP_HOST']) ? normalizeRequestHost($_SERVER['HTTP_HOST']) : '';
    $sourceHost = normalizeRequestHost($parts['host']);

    return $requestHost !== '' && $sourceHost !== '' && hash_equals($requestHost, $sourceHost);
}

function isHttpsRequest() {
    if (isset($_SERVER['HTTPS']) && in_array(strtolower(trim((string)$_SERVER['HTTPS'])), ['on', '1', 'https'], true)) {
        return true;
    }
    if (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) {
        return true;
    }
    if (isset($_SERVER['REQUEST_SCHEME']) && strtolower((string)$_SERVER['REQUEST_SCHEME']) === 'https') {
        return true;
    }

    if (envFlagEnabled('TRUST_PROXY_PROTO_HEADERS')) {
        $forwardedProto = isset($_SERVER['HTTP_X_FORWARDED_PROTO'])
            ? strtolower(trim(explode(',', (string)$_SERVER['HTTP_X_FORWARDED_PROTO'])[0]))
            : '';
        if ($forwardedProto === 'https') {
            return true;
        }
        if (isset($_SERVER['HTTP_X_FORWARDED_SSL']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_SSL']) === 'on') {
            return true;
        }
        if (isset($_SERVER['HTTP_CF_VISITOR'])) {
            $cfVisitor = json_decode((string)$_SERVER['HTTP_CF_VISITOR'], true);
            if (is_array($cfVisitor) && isset($cfVisitor['scheme']) && strtolower($cfVisitor['scheme']) === 'https') {
                return true;
            }
        }
    }

    return false;
}

function buildAppCookieOptions($expires, $httpOnly, $secure) {
    return [
        'expires' => $expires,
        'path' => '/',
        'secure' => $secure,
        'httponly' => $httpOnly,
        'samesite' => 'Lax'
    ];
}

function getLegacySameSiteCookiePath() {
    return '/; SameSite=Lax';
}

function writeAppCookie($name, $value, $expires, $httpOnly = true) {
    $secure = isHttpsRequest();
    if (PHP_VERSION_ID >= 70300) {
        return setcookie(
            $name,
            $value,
            buildAppCookieOptions($expires, $httpOnly, $secure)
        );
    }

    return setcookie(
        $name,
        $value,
        $expires,
        getLegacySameSiteCookiePath(),
        '',
        $secure,
        $httpOnly
    );
}

function setAppCookie($name, $value, $days, $httpOnly = true) {
    return writeAppCookie($name, $value, time() + ($days * 86400), $httpOnly);
}

function clearAppCookie($name, $httpOnly = true) {
    return writeAppCookie($name, '', time() - 3600, $httpOnly);
}

function sanitizeDbKey($key) {
    return preg_replace('/[^a-zA-Z0-9_-]/', '_', $key);
}

function databaseSetVerified($db, $key, $value) {
    if (!is_string($value)) {
        return false;
    }

    try {
        $result = $db->set($key, $value);
        if ($result === false) {
            return false;
        }

        $savedValue = $db->get($key);
    } catch (Throwable $error) {
        $safeKey = sanitizeSingleLineLogText($key, 128);
        $safeError = sanitizeSingleLineLogText($error->getMessage(), 512);
        error_log("Verified database write failed for {$safeKey}: {$safeError}");
        return false;
    }

    return is_string($savedValue) &&
        strlen($savedValue) === strlen($value) &&
        hash_equals(hash('sha256', $value), hash('sha256', $savedValue));
}

function databaseDeleteVerified($db, $key) {
    $result = $db->delete($key);
    if ($result === false) {
        return false;
    }

    return $db->get($key) === null;
}

function revokeUserSessionVerified($sessionDb, $username) {
    try {
        if ($sessionDb->get($username) === null) {
            return true;
        }
        return databaseDeleteVerified($sessionDb, $username);
    } catch (Throwable $error) {
        $safeUsername = sanitizeSingleLineLogText($username, 80);
        $safeError = sanitizeSingleLineLogText($error->getMessage(), 512);
        error_log("Session revocation failed for {$safeUsername}: {$safeError}");
        return false;
    }
}

function databaseValueMatchesExpected($value, $expectedValues) {
    if (!is_string($value)) {
        return false;
    }

    $candidates = is_array($expectedValues) ? $expectedValues : [$expectedValues];
    foreach ($candidates as $candidate) {
        if (
            is_string($candidate) &&
            strlen($candidate) === strlen($value) &&
            hash_equals(hash('sha256', $candidate), hash('sha256', $value))
        ) {
            return true;
        }
    }
    return false;
}

function restoreDatabaseValueIfOwned($db, $key, $ownedValue, $previousValue) {
    if (!is_string($ownedValue) || ($previousValue !== null && !is_string($previousValue))) {
        return ['success' => false, 'outcome' => 'invalid_restore_value'];
    }

    try {
        $currentValue = $db->get($key);
        if ($currentValue === null) {
            return ['success' => true, 'outcome' => 'absent'];
        }
        if (!databaseValueMatchesExpected($currentValue, $ownedValue)) {
            return ['success' => true, 'outcome' => 'ownership_changed'];
        }

        $confirmedValue = $db->get($key);
        if (!databaseValueMatchesExpected($confirmedValue, $ownedValue)) {
            return ['success' => true, 'outcome' => 'ownership_changed'];
        }

        if ($previousValue === null) {
            if ($db->delete($key) === false) {
                return ['success' => false, 'outcome' => 'delete_failed'];
            }
            $remainingValue = $db->get($key);
            return [
                'success' => $remainingValue === null,
                'outcome' => $remainingValue === null ? 'deleted' : 'delete_unconfirmed'
            ];
        }

        if (!databaseSetVerified($db, $key, $previousValue)) {
            return ['success' => false, 'outcome' => 'restore_failed'];
        }
        return ['success' => true, 'outcome' => 'restored'];
    } catch (Throwable $error) {
        $safeKey = sanitizeSingleLineLogText($key, 128);
        $safeError = sanitizeSingleLineLogText($error->getMessage(), 512);
        error_log("Owned database value restore failed for {$safeKey}: {$safeError}");
        return ['success' => false, 'outcome' => 'exception'];
    }
}

function databaseDeleteExpectedValueVerified($db, $key, $expectedValues) {
    $currentValue = $db->get($key);
    if ($currentValue === null) {
        return ['success' => true, 'outcome' => 'absent'];
    }
    if (!databaseValueMatchesExpected($currentValue, $expectedValues)) {
        return ['success' => true, 'outcome' => 'ownership_changed'];
    }

    $confirmedValue = $db->get($key);
    if (!databaseValueMatchesExpected($confirmedValue, $expectedValues)) {
        return ['success' => true, 'outcome' => 'ownership_changed'];
    }
    if ($db->delete($key) === false) {
        return ['success' => false, 'outcome' => 'delete_failed'];
    }
    $remainingValue = $db->get($key);
    return [
        'success' => $remainingValue === null,
        'outcome' => $remainingValue === null ? 'deleted' : 'delete_unconfirmed'
    ];
}

function registrationStateMatchesExpected($usersDb, $profileDb, $sessionDb, $username, $expectedValues) {
    try {
        $steps = [
            'account' => isset($expectedValues['account']) && databaseValueMatchesExpected($usersDb->get($username), $expectedValues['account']),
            'profile' => isset($expectedValues['profile']) && databaseValueMatchesExpected($profileDb->get($username), $expectedValues['profile']),
            'session' => isset($expectedValues['session']) && databaseValueMatchesExpected($sessionDb->get($username), $expectedValues['session'])
        ];
    } catch (Throwable $error) {
        $safeUsername = sanitizeSingleLineLogText($username, 80);
        $safeError = sanitizeSingleLineLogText($error->getMessage(), 512);
        error_log("Registration state verification failed for {$safeUsername}: {$safeError}");
        $steps = ['account' => false, 'profile' => false, 'session' => false];
    }
    return [
        'success' => !in_array(false, $steps, true),
        'steps' => $steps
    ];
}

function rollbackRegistrationSaga($usersDb, $profileDb, $sessionDb, $username, $expectedValues) {
    $steps = [];
    $outcomes = [];
    foreach ([
        'session' => $sessionDb,
        'profile' => $profileDb,
        'account' => $usersDb
    ] as $step => $db) {
        try {
            if (!array_key_exists($step, $expectedValues)) {
                $steps[$step] = true;
                $outcomes[$step] = 'not_owned';
                continue;
            }
            $result = databaseDeleteExpectedValueVerified($db, $username, $expectedValues[$step]);
            $steps[$step] = $result['success'];
            $outcomes[$step] = $result['outcome'];
        } catch (Throwable $error) {
            $steps[$step] = false;
            $outcomes[$step] = 'exception';
            error_log("Registration rollback {$step} step failed for {$username}: " . $error->getMessage());
        }
    }

    return [
        'success' => !in_array(false, $steps, true),
        'steps' => $steps,
        'outcomes' => $outcomes
    ];
}

function databasePushVerified($db, $key, $value) {
    $result = $db->push($key, $value);
    if ($result === false) {
        return false;
    }

    $savedValues = $db->get_array($key);
    return is_array($savedValues) && in_array($value, $savedValues, true);
}

function databasePushBounded($db, $key, $value, $maxEntries) {
    if ($maxEntries < 1 || !databasePushVerified($db, $key, $value)) {
        return false;
    }

    $savedValues = $db->get_array($key);
    if (!is_array($savedValues)) {
        return false;
    }

    $overflow = count($savedValues) - $maxEntries;
    for ($index = 0; $index < $overflow; $index++) {
        $deleteResult = $db->delete($key, $savedValues[$index]);
        if ($deleteResult === false) {
            return false;
        }
    }

    $boundedValues = $db->get_array($key);
    return is_array($boundedValues) &&
        count($boundedValues) <= $maxEntries &&
        in_array($value, $boundedValues, true);
}

function parseRateLimitEntryTimestamp($entry) {
    if (is_int($entry) || (is_string($entry) && ctype_digit($entry))) {
        return (int)$entry;
    }

    if (!is_string($entry)) {
        return null;
    }

    $separator = strpos($entry, ':');
    if ($separator === false) {
        return null;
    }

    $timestamp = substr($entry, 0, $separator);
    return ctype_digit($timestamp) ? (int)$timestamp : null;
}

function acquireRegistrationLease($lockDb, $username, $ownerId, $ttlSeconds = 300) {
    if (!isValidUsername($username) || !is_string($ownerId) || !preg_match('/^[a-f0-9]{16,128}$/', $ownerId)) {
        return null;
    }

    $key = sanitizeDbKey('registration_' . $username);
    $now = time();
    $entry = $now . ':' . $ownerId;
    if (!databasePushVerified($lockDb, $key, $entry)) {
        return null;
    }

    $entries = $lockDb->get_array($key);
    if (!is_array($entries) || !in_array($entry, $entries, true)) {
        return null;
    }

    $activeEntries = [];
    foreach ($entries as $savedEntry) {
        $timestamp = parseRateLimitEntryTimestamp($savedEntry);
        if ($timestamp === null || ($now - $timestamp) >= $ttlSeconds) {
            if ($lockDb->delete($key, $savedEntry) === false) {
                $activeEntries[] = $savedEntry;
            }
            continue;
        }
        $activeEntries[] = $savedEntry;
    }

    if (count($activeEntries) === 0 || $activeEntries[0] !== $entry) {
        $lockDb->delete($key, $entry);
        return null;
    }

    return ['key' => $key, 'entry' => $entry, 'ownerId' => $ownerId];
}

function releaseRegistrationLease($lockDb, $lease) {
    if (!is_array($lease) || !isset($lease['key'], $lease['entry'])) {
        return false;
    }
    if ($lockDb->delete($lease['key'], $lease['entry']) === false) {
        return false;
    }
    $remaining = $lockDb->get_array($lease['key']);
    return !is_array($remaining) || !in_array($lease['entry'], $remaining, true);
}

function acquireUserSecurityLease($lockDb, $username, $ttlSeconds = 300) {
    return acquireRegistrationLease($lockDb, $username, bin2hex(random_bytes(16)), $ttlSeconds);
}

function releaseUserSecurityLease($lockDb, $lease, $username, $context) {
    $safeUsername = sanitizeSingleLineLogText($username, 80);
    $safeContext = sanitizeSingleLineLogText($context, 80);
    try {
        $released = releaseRegistrationLease($lockDb, $lease);
    } catch (Throwable $error) {
        $released = false;
        $safeError = sanitizeSingleLineLogText($error->getMessage(), 512);
        error_log("User security lease release failed for {$safeUsername} during {$safeContext}: {$safeError}");
    }

    if (!$released) {
        error_log("User security lease remained for {$safeUsername} during {$safeContext}");
    }
    return $released;
}

function consumeAtomicRateLimitAttempt($db, $key, $windowSeconds, $maxAttempts) {
    $now = time();
    $entry = $now . ':' . bin2hex(random_bytes(8));
    $pushResult = $db->push($key, $entry);
    if ($pushResult === false) {
        return ['ok' => false, 'allowed' => false, 'retryAfter' => $windowSeconds];
    }

    $entries = $db->get_array($key);
    if (!is_array($entries) || !in_array($entry, $entries, true)) {
        return ['ok' => false, 'allowed' => false, 'retryAfter' => $windowSeconds];
    }

    $recentTimestamps = [];
    foreach ($entries as $savedEntry) {
        $timestamp = parseRateLimitEntryTimestamp($savedEntry);
        if ($timestamp === null || ($now - $timestamp) >= $windowSeconds) {
            $db->delete($key, $savedEntry);
            continue;
        }
        $recentTimestamps[] = $timestamp;
    }

    $allowed = count($recentTimestamps) <= $maxAttempts;
    $retryAfter = $windowSeconds;
    if (!$allowed && count($recentTimestamps) > 0) {
        $retryAfter = max(1, $windowSeconds - ($now - min($recentTimestamps)));
    }

    if (!$allowed && $db->delete($key, $entry) === false) {
        return ['ok' => false, 'allowed' => false, 'retryAfter' => $retryAfter];
    }

    return ['ok' => true, 'allowed' => $allowed, 'retryAfter' => $retryAfter];
}

function getClientIp() {
    static $cachedIp = null;

    if ($cachedIp !== null) {
        return $cachedIp;
    }

    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';

    if (envFlagEnabled('TRUST_PROXY_IP_HEADERS')) {
        $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ??
              $_SERVER['HTTP_X_REAL_IP'] ??
              $_SERVER['HTTP_X_FORWARDED_FOR'] ??
              $ip;
    }

    if (strpos($ip, ',') !== false) {
        $ip = explode(',', $ip)[0];
    }

    $cachedIp = trim($ip);
    return $cachedIp;
}

function parseRequestInput() {
    // 仅接受 POST 请求，拒绝 GET 请求以防止 CSRF 绕过
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond([
            'success' => false,
            'message' => 'Only POST requests are allowed'
        ], 405);
    }

    // 优先解析 JSON 请求体（前端使用 Content-Type: application/json）
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);

    // 回退到 $_POST（表单提交）
    if (!$input && !empty($_POST)) {
        $input = $_POST;
    }

    if (!$input || !isset($input['action'])) {
        respond([
            'success' => false,
            'message' => 'Invalid Request'
        ], 400);
    }

    return $input;
}
