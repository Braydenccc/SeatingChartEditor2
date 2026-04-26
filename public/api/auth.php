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
function shouldRequireHttps() {
    static $cached = null;
    if ($cached === null) {
        $cached = !function_exists('getenv') || getenv('REQUIRE_HTTPS') !== 'false';
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

    $isHttps = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
               (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

    if (!$isHttps) {
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
    if (strlen($password) < 8) {
        respond(['success' => false, 'message' => '密码至少需要 8 个字符']);
    }

    if (!preg_match('/[A-Z]/', $password)) {
        respond(['success' => false, 'message' => '密码必须包含至少一个大写字母']);
    }

    if (!preg_match('/[a-z]/', $password)) {
        respond(['success' => false, 'message' => '密码必须包含至少一个小写字母']);
    }

    if (!preg_match('/[0-9]/', $password)) {
        respond(['success' => false, 'message' => '密码必须包含至少一个数字']);
    }
}

/**
 * 解密客户端加密的密码
 * @param string $encryptedPassword Base64 编码的加密数据
 * @param string $username 用户名（用作密钥派生）
 * @return string|null 明文密码或 null（解密失败）
 */
function decryptPasswordFromTransport($encryptedPassword, $username) {
    try {
        // Base64 解码
        $combined = base64_decode($encryptedPassword, true);
        if ($combined === false) {
            return null;
        }

        // 分离 IV (12 字节) 和密文
        $iv = substr($combined, 0, 12);
        $ciphertext = substr($combined, 12);

        // 派生密钥（与客户端相同的算法）
        $keyMaterial = "sce-auth-{$username}";
        $salt = "sce-transport-salt-v1";
        $key = hash_pbkdf2('sha256', $keyMaterial, $salt, 100000, 32, true);

        // 解密（AES-256-GCM）
        $decrypted = openssl_decrypt(
            $ciphertext,
            'aes-256-gcm',
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            substr($ciphertext, -16) // GCM tag 在密文末尾
        );

        return $decrypted !== false ? $decrypted : null;
    } catch (Exception $e) {
        error_log("Password decryption failed: " . $e->getMessage());
        return null;
    }
}

function issueSessionToken($sessionDb, $username, $rememberMe = false) {
    $token = bin2hex(random_bytes(32));
    $expiryDays = $rememberMe ? TOKEN_EXPIRY_REMEMBER_ME : TOKEN_EXPIRY_DAYS;
    $expiry = time() + ($expiryDays * 86400);

    // 存储 Token 的 SHA-256 哈希而非明文
    $tokenHash = hash('sha256', $token);
    $sessionData = json_encode(['tokenHash' => $tokenHash, 'expiry' => $expiry]);
    $sessionDb->set($username, $sessionData);

    return $token;
}

try {
    $input = parseRequestInput();

    $action = $input['action'];
    $username = isset($input['username']) ? trim($input['username']) : '';

    // 支持加密密码和明文密码（向后兼容）
    $encryptedPassword = isset($input['encryptedPassword']) && is_string($input['encryptedPassword']) ? $input['encryptedPassword'] : '';
    $password = isset($input['password']) && is_string($input['password']) ? $input['password'] : '';

    // 如果提供了加密密码，尝试解密
    if ($encryptedPassword !== '' && $username !== '') {
        $decrypted = decryptPasswordFromTransport($encryptedPassword, $username);
        if ($decrypted !== null) {
            $password = $decrypted;
        } else {
            // 解密失败，记录日志但不暴露详细信息
            error_log("Failed to decrypt password for user: {$username}");
            respond(['success' => false, 'message' => '密码格式错误，请重试'], 400);
        }
    }

    $token = isset($input['token']) ? trim($input['token']) : '';

    $allowedActions = ['register', 'login', 'logout', 'set_settings', 'get_settings'];
    if (!in_array($action, $allowedActions, true)) {
        respond(['success' => false, 'message' => 'Unknown action'], 400);
    }

    if (!ensureCsrfMatched($input)) {
        respond(['success' => false, 'message' => 'CSRF 校验失败'], 403);
    }

    $db = new Database("users");
    $sessionDb = new Database("users_sessions");
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

        $issuedToken = issueSessionToken($sessionDb, $username);
        logSecurityEvent('register_success', $username);
        respond([
            'success' => true,
            'message' => '注册成功',
            'data' => [
                'username' => $username,
                'token' => $issuedToken
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
            $issuedToken = issueSessionToken($sessionDb, $username);
            logSecurityEvent('login_success', $username);
            respond([
                'success' => true,
                'message' => '登录成功',
                'data' => [
                    'username' => $username,
                    'token' => $issuedToken
                ]
            ]);
        } else {
            logSecurityEvent('login_failed', $username, ['reason' => 'invalid_password']);
            respond(['success' => false, 'message' => '用户名或密码不正确']);
        }
    } elseif ($action === 'logout') {
        if (!isValidUsername($username) || !isAuthorized($sessionDb, $username, $token)) {
            logSecurityEvent('logout_failed', $username, ['reason' => 'invalid_token']);
            respond(['success' => false, 'message' => 'Token过期或无效'], 401);
        }
        $sessionDb->delete($username);
        logSecurityEvent('logout_success', $username);
        respond(['success' => true, 'message' => '登出成功']);
    } elseif ($action === 'set_settings') {
        if (!isValidUsername($username) || !isAuthorized($sessionDb, $username, $token)) {
            respond(['success' => false, 'message' => 'Token过期或无效'], 401);
        }
        $settingsDb = new Database("users_settings");
        $settingsStr = isset($input['settings']) ? json_encode($input['settings'], JSON_UNESCAPED_UNICODE) : '{}';
        $settingsDb->set($username, $settingsStr);
        respond(['success' => true, 'message' => '设置已保存']);
    } elseif ($action === 'get_settings') {
        if (!isValidUsername($username) || !isAuthorized($sessionDb, $username, $token)) {
            respond(['success' => false, 'message' => 'Token过期或无效'], 401);
        }
        $settingsDb = new Database("users_settings");
        $settingsStr = $settingsDb->get($username);
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