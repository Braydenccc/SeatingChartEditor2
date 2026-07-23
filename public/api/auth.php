<?php
// 使用 Retinbox 平台规范：从网站根目录开始的绝对路径（省略开头的 /）
// auth.php 位于 api/ 目录下，所以需要引用同目录的 common.php
require_once "api/common.php";
header('Content-Type: application/json; charset=utf-8');

if (!class_exists('Database')) {
    respond(['success' => false, 'message' => 'Environment error: Database not supported.'], 503);
}
const MIN_PASSWORD_LENGTH = 6;
const RATE_LIMIT_WINDOW = 300;
const MAX_ATTEMPTS = 5;
const TOKEN_EXPIRY_DAYS = 30;
const TOKEN_EXPIRY_REMEMBER_ME = 90;
const SECURITY_LOG_MAX_ENTRIES = 500;
const SECURITY_LOG_MAX_ENTRY_BYTES = 4096;

// 生产环境强制 HTTPS，开发环境可通过环境变量禁用
// 默认要求 HTTPS，只有明确设置 REQUIRE_HTTPS=false 才禁用
function shouldRequireHttps() {
    static $cached = null;
    if ($cached === null) {
        // 默认为 true（要求 HTTPS）
        $cached = true;

        // 只有当环境变量明确设置为字符串 'false' 时才禁用
        if (function_exists('getenv')) {
            $envValue = getenv('REQUIRE_HTTPS');
            if ($envValue === 'false' || $envValue === '0') {
                $cached = false;
            }
        }
    }
    return $cached;
}

function logSecurityEvent($event, $username, $details = []) {
    $safeEvent = truncateUtf8String($event, 80, '...');
    $safeUsername = truncateUtf8String($username, 80, '...');
    try {
        $logDb = new Database('security_logs');
        $logEntry = encodeBoundedSecurityLogEntry(
            $safeEvent,
            $safeUsername,
            getClientIp(),
            $details,
            SECURITY_LOG_MAX_ENTRY_BYTES
        );
        if (!databasePushBounded($logDb, 'events', $logEntry, SECURITY_LOG_MAX_ENTRIES)) {
            throw new RuntimeException('security log write was not confirmed');
        }
    } catch (Throwable $e) {
        $logEvent = sanitizeSingleLineLogText($safeEvent, 80);
        $logUsername = sanitizeSingleLineLogText($safeUsername, 80);
        $safeError = sanitizeSingleLineLogText($e->getMessage(), 512);
        error_log("Security log failed: {$logEvent} for {$logUsername} - {$safeError}");
    }
}

function failRegistrationWithRollback(
    $usersDb,
    $profileDb,
    $sessionDb,
    $registrationLockDb,
    $lease,
    $username,
    $expectedValues,
    $reason,
    $message
) {
    $rollback = rollbackRegistrationSaga($usersDb, $profileDb, $sessionDb, $username, $expectedValues);
    try {
        $leaseReleased = releaseRegistrationLease($registrationLockDb, $lease);
    } catch (Throwable $error) {
        $leaseReleased = false;
        error_log("Registration lease release failed for {$username}: " . $error->getMessage());
    }
    logSecurityEvent('register_failed', $username, [
        'reason' => $reason,
        'rollback_success' => $rollback['success'],
        'rollback_steps' => $rollback['steps'],
        'rollback_outcomes' => $rollback['outcomes'],
        'lease_released' => $leaseReleased
    ]);

    if (!$rollback['success']) {
        $message .= '，且未能确认注册数据已完整清理，请联系管理员';
    }
    respond(['success' => false, 'message' => $message], 503);
}

function ensureHttps() {
    if (!shouldRequireHttps()) {
        return;
    }

    if (!isHttpsRequest()) {
        respond(['success' => false, 'message' => '必须使用 HTTPS 连接'], 403);
    }
}

function checkRateLimitGeneric($key, $maxAttempts, $errorMessage, $logEvent = null, $logUsername = null) {
    $rateLimitDb = new Database('users_rate_limit');
    $rateResult = consumeAtomicRateLimitAttempt(
        $rateLimitDb,
        sanitizeDbKey('v2_' . $key),
        RATE_LIMIT_WINDOW,
        $maxAttempts
    );

    if (!$rateResult['ok']) {
        respond(['success' => false, 'message' => '暂时无法确认请求频率，请稍后重试'], 503);
    }

    if (!$rateResult['allowed']) {
        $waitTime = $rateResult['retryAfter'];
        if ($logEvent && $logUsername) {
            logSecurityEvent($logEvent, $logUsername, ['wait_time' => $waitTime]);
        }
        respond(['success' => false, 'message' => $errorMessage . "，请在 {$waitTime} 秒后重试"], 429);
    }
}

function checkRateLimit($username) {
    checkRateLimitGeneric('login_' . $username, MAX_ATTEMPTS, '尝试次数过多', 'rate_limit_username', $username);
}

function checkIpRateLimit() {
    checkRateLimitGeneric('ip_' . sanitizeDbKey(getClientIp()), MAX_ATTEMPTS * 3, 'IP 请求过于频繁', 'rate_limit_ip', 'N/A');
}

function validatePassword($password) {
    $validation = validatePasswordStrength($password);
    if (!$validation['valid']) {
        respond(['success' => false, 'message' => $validation['message']]);
    }
}

function decryptPasswordFromTransport($encryptedPassword, $username) {
    if (!is_string($encryptedPassword) || $encryptedPassword === '' || !isValidUsername($username)) {
        return null;
    }

    if (!function_exists('openssl_decrypt') || !function_exists('hash_pbkdf2')) {
        return null;
    }

    $combined = base64_decode($encryptedPassword, true);
    if ($combined === false || strlen($combined) <= 28) {
        return null;
    }

    $iv = substr($combined, 0, 12);
    $tag = substr($combined, -16);
    $ciphertext = substr($combined, 12, -16);
    $key = hash_pbkdf2('sha256', 'sce-auth-' . $username, 'sce-transport-salt-v1', 100000, 32, true);
    $password = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);

    return is_string($password) ? $password : null;
}

function readPasswordField($input, $plainKey, $encryptedKey, $username) {
    if (isset($input[$encryptedKey]) && is_string($input[$encryptedKey]) && $input[$encryptedKey] !== '') {
        $password = decryptPasswordFromTransport($input[$encryptedKey], $username);
        if ($password === null) {
            respond(['success' => false, 'message' => '密码解密失败'], 400);
        }
        return $password;
    }

    return isset($input[$plainKey]) && is_string($input[$plainKey]) ? $input[$plainKey] : '';
}

function createSessionTokenData($rememberMe = false, $sessionEpoch = '', $passwordHash = null) {
    if (!is_string($sessionEpoch) || ($sessionEpoch !== '' && !preg_match('/^[a-f0-9]{32}$/', $sessionEpoch))) {
        throw new RuntimeException('invalid session epoch');
    }

    $token = bin2hex(random_bytes(32));
    $expiryDays = $rememberMe ? TOKEN_EXPIRY_REMEMBER_ME : TOKEN_EXPIRY_DAYS;
    $expiry = time() + ($expiryDays * 86400);

    $tokenHash = hash('sha256', $token);
    $sessionPayload = [
        'tokenHash' => $tokenHash,
        'expiry' => $expiry,
        'sessionEpoch' => $sessionEpoch
    ];
    $credentialFingerprint = getPasswordHashFingerprint($passwordHash);
    if ($credentialFingerprint !== null) {
        $sessionPayload['credentialFingerprint'] = $credentialFingerprint;
    }
    $sessionData = json_encode($sessionPayload);
    if (!is_string($sessionData)) {
        throw new RuntimeException('session token encoding failed');
    }
    return [
        'token' => $token,
        'expiryDays' => $expiryDays,
        'storedValue' => $sessionData
    ];
}

function persistSessionToken($sessionDb, $username, $tokenData) {
    if (!isset($tokenData['storedValue']) || !databaseSetVerified($sessionDb, $username, $tokenData['storedValue'])) {
        throw new RuntimeException('session token write was not confirmed');
    }
    return $tokenData;
}

function issueSessionToken($sessionDb, $username, $rememberMe = false, $sessionEpoch = '', $passwordHash = null) {
    return persistSessionToken(
        $sessionDb,
        $username,
        createSessionTokenData($rememberMe, $sessionEpoch, $passwordHash)
    );
}

function setAuthCookies($username, $tokenData) {
    setAppCookie('sce_username', $username, $tokenData['expiryDays'], true);
    setAppCookie('sce_token', $tokenData['token'], $tokenData['expiryDays'], true);
}

function clearAuthCookies() {
    clearAppCookie('sce_username', true);
    clearAppCookie('sce_token', true);
}

function sanitizeUserSettings($settings) {
    if (!is_array($settings)) {
        return [];
    }

    if (isset($settings['webdav']) && is_array($settings['webdav'])) {
        unset($settings['webdav']['password']);
        unset($settings['webdav']['authorization']);
    }

    return $settings;
}

try {
    $input = parseRequestInput();

    $action = $input['action'];
    $username = isset($input['username']) && is_string($input['username']) ? trim($input['username']) : '';
    $password = readPasswordField($input, 'password', 'encryptedPassword', $username);
    $currentPassword = isset($input['currentPassword']) && is_string($input['currentPassword']) ? $input['currentPassword'] : '';
    $newPassword = isset($input['newPassword']) && is_string($input['newPassword']) ? $input['newPassword'] : '';

    $allowedActions = ['register', 'login', 'verify', 'logout', 'change_password', 'set_settings', 'get_settings'];
    if (!in_array($action, $allowedActions, true)) {
        respond(['success' => false, 'message' => 'Unknown action'], 400);
    }

    if (!ensureCsrfMatched($input)) {
        respond(['success' => false, 'message' => 'CSRF 校验失败'], 403);
    }

    $db = new Database("users");
    $sessionDb = new Database("users_sessions");
    $profileDb = new Database("user_profiles");
    if ($action === 'register') {
        ensureHttps();
        checkIpRateLimit();

        if (!isValidUsername($username)) {
            respond(['success' => false, 'message' => '用户名格式无效']);
        }

        validatePassword($password);
        checkRateLimit($username);

        $existingHash = $db->get($username);
        if ($existingHash !== null) {
            logSecurityEvent('register_failed', $username, ['reason' => 'username_exists']);
            respond(['success' => false, 'message' => '注册失败，请检查输入或稍后重试']);
        }

        $registrationId = bin2hex(random_bytes(16));
        $registrationLockDb = new Database("registration_locks");
        $lease = acquireRegistrationLease($registrationLockDb, $username, $registrationId);
        if ($lease === null) {
            logSecurityEvent('register_failed', $username, ['reason' => 'registration_in_progress']);
            respond(['success' => false, 'message' => '同一用户名正在注册，请稍后重试'], 409);
        }

        $expectedValues = [];

        // 租约建立后重新检查，避免两个并发请求都通过首次存在性检查。
        try {
            $existingHash = $db->get($username);
        } catch (Throwable $error) {
            failRegistrationWithRollback(
                $db,
                $profileDb,
                $sessionDb,
                $registrationLockDb,
                $lease,
                $username,
                $expectedValues,
                'registration_recheck_failed',
                '注册状态确认失败，请稍后重试'
            );
        }
        if ($existingHash !== null) {
            $leaseReleased = releaseRegistrationLease($registrationLockDb, $lease);
            if (!$leaseReleased) {
                error_log("Registration lease release failed after username conflict for {$username}");
            }
            logSecurityEvent('register_failed', $username, [
                'reason' => 'username_exists',
                'lease_released' => $leaseReleased
            ]);
            respond(['success' => false, 'message' => '注册失败，请检查输入或稍后重试']);
        }

        try {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            if (!is_string($hash)) {
                throw new RuntimeException('password hash generation failed');
            }

            $createdAt = date('c');
            $sessionEpoch = createUserSessionEpoch();
            $pendingProfileData = json_encode([
                'status' => 'active',
                'createdAt' => $createdAt,
                'updatedAt' => $createdAt,
                'sessionEpoch' => $sessionEpoch,
                'registrationMarker' => $registrationId
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            $finalProfileData = json_encode([
                'status' => 'active',
                'createdAt' => $createdAt,
                'updatedAt' => $createdAt,
                'sessionEpoch' => $sessionEpoch
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            if (!is_string($pendingProfileData) || !is_string($finalProfileData)) {
                throw new RuntimeException('registration profile encoding failed');
            }

            $issuedToken = createSessionTokenData(false, $sessionEpoch, $hash);
            $expectedValues = [
                'account' => $hash,
                'profile' => [$pendingProfileData, $finalProfileData],
                'session' => $issuedToken['storedValue']
            ];
        } catch (Throwable $error) {
            failRegistrationWithRollback(
                $db,
                $profileDb,
                $sessionDb,
                $registrationLockDb,
                $lease,
                $username,
                $expectedValues,
                'registration_prepare_failed',
                '注册信息准备失败，请稍后重试'
            );
        }

        if (!databaseSetVerified($db, $username, $hash)) {
            failRegistrationWithRollback(
                $db,
                $profileDb,
                $sessionDb,
                $registrationLockDb,
                $lease,
                $username,
                $expectedValues,
                'account_write_failed',
                '注册信息写入失败，请稍后重试'
            );
        }
        if (!databaseSetVerified($profileDb, $username, $pendingProfileData)) {
            failRegistrationWithRollback(
                $db,
                $profileDb,
                $sessionDb,
                $registrationLockDb,
                $lease,
                $username,
                $expectedValues,
                'profile_write_failed',
                '用户资料写入失败，请稍后重试'
            );
        }

        try {
            persistSessionToken($sessionDb, $username, $issuedToken);
        } catch (Throwable $error) {
            failRegistrationWithRollback(
                $db,
                $profileDb,
                $sessionDb,
                $registrationLockDb,
                $lease,
                $username,
                $expectedValues,
                'session_write_failed',
                '登录会话写入失败，请稍后重试'
            );
        }

        $pendingState = registrationStateMatchesExpected($db, $profileDb, $sessionDb, $username, [
            'account' => $hash,
            'profile' => $pendingProfileData,
            'session' => $issuedToken['storedValue']
        ]);
        if (!$pendingState['success']) {
            failRegistrationWithRollback(
                $db,
                $profileDb,
                $sessionDb,
                $registrationLockDb,
                $lease,
                $username,
                $expectedValues,
                'registration_ownership_lost',
                '注册状态发生并发变化，请稍后重试'
            );
        }

        if (!databaseSetVerified($profileDb, $username, $finalProfileData)) {
            failRegistrationWithRollback(
                $db,
                $profileDb,
                $sessionDb,
                $registrationLockDb,
                $lease,
                $username,
                $expectedValues,
                'profile_commit_failed',
                '用户资料提交失败，请稍后重试'
            );
        }

        $committedState = registrationStateMatchesExpected($db, $profileDb, $sessionDb, $username, [
            'account' => $hash,
            'profile' => $finalProfileData,
            'session' => $issuedToken['storedValue']
        ]);
        if (!$committedState['success']) {
            failRegistrationWithRollback(
                $db,
                $profileDb,
                $sessionDb,
                $registrationLockDb,
                $lease,
                $username,
                $expectedValues,
                'registration_commit_unconfirmed',
                '注册状态确认失败，请稍后重试'
            );
        }

        try {
            $leaseReleased = releaseRegistrationLease($registrationLockDb, $lease);
        } catch (Throwable $error) {
            $leaseReleased = false;
        }
        if (!$leaseReleased) {
            error_log("Registration lease release failed after successful commit for {$username}");
        }
        setAuthCookies($username, $issuedToken);
        logSecurityEvent('register_success', $username, ['lease_released' => $leaseReleased]);
        respond([
            'success' => true,
            'message' => '注册成功',
            'data' => [
                'username' => $username
            ]
        ]);

    } elseif ($action === 'login') {
        ensureHttps();
        checkIpRateLimit();

        if (!isValidUsername($username) || $password === '') {
            respond(['success' => false, 'message' => '用户名或密码不正确']);
        }

        checkRateLimit($username);

        $existingHash = $db->get($username);
        if ($existingHash === null) {
            logSecurityEvent('login_failed', $username, ['reason' => 'user_not_found']);
            respond(['success' => false, 'message' => '用户名或密码不正确']);
        }

        if (password_verify($password, $existingHash)) {
            $profile = getUserProfile($profileDb, $username);
            if (isset($profile['status']) && $profile['status'] === 'disabled') {
                logSecurityEvent('login_failed', $username, ['reason' => 'user_disabled']);
                respond(['success' => false, 'message' => '账号已被禁用'], 403);
            }

            $sessionEpoch = getUserSessionEpoch($profile);
            if ($sessionEpoch === null) {
                logSecurityEvent('login_failed', $username, ['reason' => 'invalid_session_epoch']);
                respond(['success' => false, 'message' => '账号安全状态异常，请联系管理员'], 503);
            }

            $issuedToken = issueSessionToken($sessionDb, $username, false, $sessionEpoch, $existingHash);
            setAuthCookies($username, $issuedToken);
            logSecurityEvent('login_success', $username);
            respond([
                'success' => true,
                'message' => '登录成功',
                'data' => [
                    'username' => $username
                ]
            ]);
        } else {
            logSecurityEvent('login_failed', $username, ['reason' => 'invalid_password']);
            respond(['success' => false, 'message' => '用户名或密码不正确']);
        }
    } elseif ($action === 'verify') {
        $authUsername = getAuthenticatedUsername($sessionDb);
        if ($authUsername === null) {
            respond(['success' => false, 'message' => '未登录'], 401);
        }
        respond([
            'success' => true,
            'data' => [
                'username' => $authUsername
            ]
        ]);
    } elseif ($action === 'logout') {
        $authUsername = getAuthenticatedUsername($sessionDb);
        if ($authUsername === null) {
            logSecurityEvent('logout_failed', $username, ['reason' => 'invalid_token']);
            clearAuthCookies();
            respond(['success' => false, 'message' => 'Token过期或无效'], 401);
        }
        if (!databaseDeleteVerified($sessionDb, $authUsername)) {
            respond(['success' => false, 'message' => '会话失效失败，请稍后重试'], 503);
        }
        clearAuthCookies();
        logSecurityEvent('logout_success', $authUsername);
        respond(['success' => true, 'message' => '登出成功']);
    } elseif ($action === 'change_password') {
        ensureHttps();
        $authUsername = requireAuthenticatedUsername($sessionDb);
        checkRateLimitGeneric('change_password_' . $authUsername, MAX_ATTEMPTS, '密码修改尝试次数过多', 'change_password_rate_limit', $authUsername);
        $currentPassword = readPasswordField($input, 'currentPassword', 'encryptedCurrentPassword', $authUsername);
        $newPassword = readPasswordField($input, 'newPassword', 'encryptedNewPassword', $authUsername);

        if ($currentPassword === '' || $newPassword === '') {
            respond(['success' => false, 'message' => '当前密码和新密码不能为空']);
        }

        validatePassword($newPassword);

        $securityLockDb = new Database('registration_locks');
        $securityLease = acquireUserSecurityLease($securityLockDb, $authUsername);
        if ($securityLease === null) {
            respond(['success' => false, 'message' => '账号安全设置正在更新，请稍后重试'], 409);
        }

        try {
            $existingHash = $db->get($authUsername);
            if ($existingHash === null || !password_verify($currentPassword, $existingHash)) {
                releaseUserSecurityLease($securityLockDb, $securityLease, $authUsername, 'change_password_invalid_current');
                logSecurityEvent('change_password_failed', $authUsername, ['reason' => 'invalid_current_password']);
                respond(['success' => false, 'message' => '当前密码不正确']);
            }

            $profile = getUserProfile($profileDb, $authUsername);
            if (isset($profile['status']) && $profile['status'] === 'disabled') {
                releaseUserSecurityLease($securityLockDb, $securityLease, $authUsername, 'change_password_disabled');
                respond(['success' => false, 'message' => '账号已被禁用'], 403);
            }
            $sessionEpoch = getUserSessionEpoch($profile);
            if ($sessionEpoch === null) {
                releaseUserSecurityLease($securityLockDb, $securityLease, $authUsername, 'change_password_invalid_epoch');
                respond(['success' => false, 'message' => '账号安全状态异常，请联系管理员'], 503);
            }

            $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);
            if (!is_string($newPasswordHash)) {
                releaseUserSecurityLease($securityLockDb, $securityLease, $authUsername, 'change_password_hash_failed');
                respond(['success' => false, 'message' => '密码处理失败，请稍后重试'], 503);
            }

            if (!revokeUserSessionVerified($sessionDb, $authUsername)) {
                releaseUserSecurityLease($securityLockDb, $securityLease, $authUsername, 'change_password_revoke_failed');
                respond(['success' => false, 'message' => '旧会话吊销失败，请稍后重试'], 503);
            }
            if (!databaseSetVerified($db, $authUsername, $newPasswordHash)) {
                releaseUserSecurityLease($securityLockDb, $securityLease, $authUsername, 'change_password_write_failed');
                respond(['success' => false, 'message' => '密码写入失败，请稍后重试'], 503);
            }
            $issuedToken = issueSessionToken(
                $sessionDb,
                $authUsername,
                false,
                $sessionEpoch,
                $newPasswordHash
            );
            releaseUserSecurityLease($securityLockDb, $securityLease, $authUsername, 'change_password_complete');
        } catch (Throwable $error) {
            releaseUserSecurityLease($securityLockDb, $securityLease, $authUsername, 'change_password_exception');
            throw $error;
        }
        setAuthCookies($authUsername, $issuedToken);
        logSecurityEvent('change_password_success', $authUsername);
        respond(['success' => true, 'message' => '密码已修改']);
    } elseif ($action === 'set_settings') {
        $authUsername = requireAuthenticatedUsername($sessionDb);
        $settingsDb = new Database("users_settings");
        $settings = isset($input['settings']) ? sanitizeUserSettings($input['settings']) : [];
        $settingsStr = json_encode($settings, JSON_UNESCAPED_UNICODE);
        if (!is_string($settingsStr) || !databaseSetVerified($settingsDb, $authUsername, $settingsStr)) {
            respond(['success' => false, 'message' => '设置写入失败，请稍后重试'], 503);
        }
        respond(['success' => true, 'message' => '设置已保存']);
    } elseif ($action === 'get_settings') {
        $authUsername = requireAuthenticatedUsername($sessionDb);
        $settingsDb = new Database("users_settings");
        $settingsStr = $settingsDb->get($authUsername);
        $settings = $settingsStr ? json_decode($settingsStr, true) : null;
        respond(['success' => true, 'data' => $settings]);
    }
} catch (Exception $e) {
    // 记录详细错误到日志，但不暴露给客户端
    error_log("Auth API Exception: " . $e->getMessage() . "\n" . $e->getTraceAsString());

    // 所有环境统一返回通用错误信息
    respond(['success' => false, 'message' => 'Internal Server Error'], 500);
}
?>
