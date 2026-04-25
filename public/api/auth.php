<?php
header('Content-Type: application/json; charset=utf-8');

function respond($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);
    exit($code >= 400 ? 1 : 0);
}

if (!class_exists('Database')) {
    respond(['success' => false, 'message' => 'Environment error: Database not supported.'], 503);
}

const MIN_TOKEN_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 6;
const RATE_LIMIT_WINDOW = 300;
const MAX_ATTEMPTS = 5;
const TOKEN_EXPIRY_DAYS = 30;
const TOKEN_EXPIRY_REMEMBER_ME = 90;
const REQUIRE_HTTPS = false;

function isValidUsername($username) {
    return is_string($username) && preg_match('/^[A-Za-z0-9_-]{1,32}$/', $username);
}

function getClientIp() {
    $ip = $_SERVER['HTTP_X_REAL_IP'] ??
          $_SERVER['HTTP_X_FORWARDED_FOR'] ??
          $_SERVER['REMOTE_ADDR'] ??
          'unknown';

    if (strpos($ip, ',') !== false) {
        $ip = explode(',', $ip)[0];
    }

    return trim($ip);
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
        // 日志记录失败不应影响主流程
    }
}

function ensureHttps() {
    if (!REQUIRE_HTTPS) {
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

        $attempts[] = $now;
        $rateLimitDb->set($key, json_encode($attempts));
    } else {
        $rateLimitDb->set($key, json_encode([$now]));
    }
}

function checkRateLimit($username) {
    checkRateLimitGeneric('login_' . $username, MAX_ATTEMPTS, '尝试次数过多', 'rate_limit_username', $username);
}

function checkIpRateLimit() {
    checkRateLimitGeneric('ip_' . getClientIp(), MAX_ATTEMPTS * 3, 'IP 请求过于频繁', 'rate_limit_ip', 'N/A');
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

function ensureCsrfMatched() {
    global $input;

    $csrfHeader = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? trim($_SERVER['HTTP_X_CSRF_TOKEN']) : '';
    $bodyCsrf = (is_array($input) && isset($input['_csrf']) && is_string($input['_csrf'])) ? trim($input['_csrf']) : '';

    if ($csrfHeader !== '' && $bodyCsrf !== '' && hash_equals($csrfHeader, $bodyCsrf)) {
        return true;
    }

    return false;
}

function issueSessionToken($sessionDb, $username, $rememberMe = false) {
    $token = bin2hex(random_bytes(32));
    $expiryDays = $rememberMe ? TOKEN_EXPIRY_REMEMBER_ME : TOKEN_EXPIRY_DAYS;
    $expiry = time() + ($expiryDays * 86400);
    $sessionData = $token . '|' . $expiry;
    $sessionDb->set($username, $sessionData);
    return $token;
}

function isAuthorized($sessionDb, $username, $token) {
    if (!is_string($username) || !is_string($token) || strlen($token) < MIN_TOKEN_LENGTH) {
        return false;
    }
    $savedData = $sessionDb->get($username);
    if (!$savedData) {
        return false;
    }

    $parts = explode('|', $savedData, 2);
    if (count($parts) !== 2) {
        return false;
    }

    [$savedToken, $expiry] = $parts;

    if (time() > (int)$expiry) {
        $sessionDb->delete($username);
        return false;
    }

    return hash_equals($savedToken, $token);
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!$input && !empty($_POST)) {
    $input = $_POST;
}

if ((!$input || !isset($input['action'])) && !empty($_GET) && isset($_GET['action'])) {
    $input = $_GET;
}

if (!$input || !isset($input['action'])) {
    respond([
        'success' => false, 
        'message' => 'Invalid Request'
    ], 400);
}

$action = $input['action'];
$username = isset($input['username']) ? trim($input['username']) : '';
$password = isset($input['password']) && is_string($input['password']) ? $input['password'] : '';
$token = isset($input['token']) ? trim($input['token']) : '';

$allowedActions = ['register', 'login', 'logout', 'set_settings', 'get_settings'];
if (!in_array($action, $allowedActions, true)) {
    respond(['success' => false, 'message' => 'Unknown action'], 400);
}

if (!ensureCsrfMatched()) {
    respond(['success' => false, 'message' => 'CSRF 校验失败'], 403);
}

$db = new Database("users");
$sessionDb = new Database("users_sessions");

try {
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
    respond(['success' => false, 'message' => 'Internal Server Error'], 500);
}
?>