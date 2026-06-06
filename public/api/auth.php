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
    try {
        $logDb = new Database('security_logs');
        $logEntry = json_encode([
            'event' => $event,
            'username' => $username,
            'ip' => getClientIp(),
            'time' => time(),
            'timestamp' => date('c'),
            'details' => $details
        ], JSON_UNESCAPED_UNICODE);
        $logDb->push('events', $logEntry);
    } catch (Exception $e) {
        error_log("Security log failed: {$event} for {$username} - " . $e->getMessage());
    }
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
    $data = $rateLimitDb->get($key);
    $now = time();

    $attempts = [];
    if ($data) {
        $attempts = json_decode($data, true);
        if (!is_array($attempts)) {
            $attempts = [];
        }

        $attempts = array_filter($attempts, function($timestamp) use ($now) {
            return ($now - $timestamp) < RATE_LIMIT_WINDOW;
        });

        if (count($attempts) >= $maxAttempts) {
            $oldestAttempt = min($attempts);
            $waitTime = RATE_LIMIT_WINDOW - ($now - $oldestAttempt);
            if ($logEvent && $logUsername) {
                logSecurityEvent($logEvent, $logUsername, ['wait_time' => $waitTime]);
            }
            respond(['success' => false, 'message' => $errorMessage . "，请在 {$waitTime} 秒后重试"], 429);
        }
    }

    $attempts[] = $now;
    $rateLimitDb->set($key, json_encode($attempts));
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

function issueSessionToken($sessionDb, $username, $rememberMe = false) {
    $token = bin2hex(random_bytes(32));
    $expiryDays = $rememberMe ? TOKEN_EXPIRY_REMEMBER_ME : TOKEN_EXPIRY_DAYS;
    $expiry = time() + ($expiryDays * 86400);

    // 存储 Token 的 SHA-256 哈希而非明文
    $tokenHash = hash('sha256', $token);
    $sessionData = json_encode(['tokenHash' => $tokenHash, 'expiry' => $expiry]);
    $sessionDb->set($username, $sessionData);

    return ['token' => $token, 'expiryDays' => $expiryDays];
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
    $username = isset($input['username']) ? trim($input['username']) : '';
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

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $db->set($username, $hash);
        $profileDb->set($username, json_encode([
            'status' => 'active',
            'createdAt' => date('c'),
            'updatedAt' => date('c')
        ], JSON_UNESCAPED_UNICODE));

        $issuedToken = issueSessionToken($sessionDb, $username);
        setAuthCookies($username, $issuedToken);
        logSecurityEvent('register_success', $username);
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
            if (isUserDisabled($profileDb, $username)) {
                logSecurityEvent('login_failed', $username, ['reason' => 'user_disabled']);
                respond(['success' => false, 'message' => '账号已被禁用'], 403);
            }

            $issuedToken = issueSessionToken($sessionDb, $username);
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
        $sessionDb->delete($authUsername);
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

        $existingHash = $db->get($authUsername);
        if ($existingHash === null || !password_verify($currentPassword, $existingHash)) {
            logSecurityEvent('change_password_failed', $authUsername, ['reason' => 'invalid_current_password']);
            respond(['success' => false, 'message' => '当前密码不正确']);
        }

        $db->set($authUsername, password_hash($newPassword, PASSWORD_DEFAULT));
        $issuedToken = issueSessionToken($sessionDb, $authUsername);
        setAuthCookies($authUsername, $issuedToken);
        logSecurityEvent('change_password_success', $authUsername);
        respond(['success' => true, 'message' => '密码已修改']);
    } elseif ($action === 'set_settings') {
        $authUsername = requireAuthenticatedUsername($sessionDb);
        $settingsDb = new Database("users_settings");
        $settings = isset($input['settings']) ? sanitizeUserSettings($input['settings']) : [];
        $settingsStr = json_encode($settings, JSON_UNESCAPED_UNICODE);
        $settingsDb->set($authUsername, $settingsStr);
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
