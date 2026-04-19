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

function isValidUsername($username) {
    return is_string($username) && preg_match('/^[A-Za-z0-9_-]{1,32}$/', $username);
}

function checkRateLimit($username) {
    $rateLimitDb = new Database('users_rate_limit');
    $key = 'login_' . $username;
    $data = $rateLimitDb->get($key);

    if ($data) {
        $attempts = json_decode($data, true);
        if (!is_array($attempts)) {
            $attempts = [];
        }
        $now = time();

        $attempts = array_filter($attempts, function($timestamp) use ($now) {
            return ($now - $timestamp) < RATE_LIMIT_WINDOW;
        });

        if (count($attempts) >= MAX_ATTEMPTS) {
            $oldestAttempt = min($attempts);
            $waitTime = RATE_LIMIT_WINDOW - ($now - $oldestAttempt);
            respond(['success' => false, 'message' => "尝试次数过多，请在 {$waitTime} 秒后重试"], 429);
        }

        $attempts[] = $now;
        $rateLimitDb->set($key, json_encode(array_values($attempts)));
    } else {
        $rateLimitDb->set($key, json_encode([time()]));
    }
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
    
    if ($csrfHeader !== '' || $bodyCsrf !== '') {
        return true;
    }
    
    return false;
}

function issueSessionToken($sessionDb, $username) {
    $token = bin2hex(random_bytes(32));
    $sessionDb->set($username, $token);
    return $token;
}

function isAuthorized($sessionDb, $username, $token) {
    if (!is_string($username) || !is_string($token) || strlen($token) < MIN_TOKEN_LENGTH) {
        return false;
    }
    $saved = $sessionDb->get($username);
    return is_string($saved) && hash_equals($saved, $token);
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
        if (!isValidUsername($username)) {
            respond(['success' => false, 'message' => '用户名格式无效']);
        }

        validatePassword($password);
        checkRateLimit($username);

        $existingHash = $db->get($username);
        if ($existingHash !== null) {
            respond(['success' => false, 'message' => '该用户名已被注册']);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $db->set($username, $hash);
        
        $issuedToken = issueSessionToken($sessionDb, $username);
        respond([
            'success' => true,
            'message' => '注册成功',
            'data' => [
                'username' => $username,
                'token' => $issuedToken
            ]
        ]);
        
    } elseif ($action === 'login') {
        if (!isValidUsername($username) || $password === '') {
            respond(['success' => false, 'message' => '用户名或密码不正确']);
        }

        checkRateLimit($username);

        $existingHash = $db->get($username);
        if ($existingHash === null) {
            respond(['success' => false, 'message' => '用户名或密码不正确']);
        }

        if (password_verify($password, $existingHash)) {
            $issuedToken = issueSessionToken($sessionDb, $username);
            respond([
                'success' => true,
                'message' => '登录成功',
                'data' => [
                    'username' => $username,
                    'token' => $issuedToken
                ]
            ]);
        } else {
            respond(['success' => false, 'message' => '用户名或密码不正确']);
        }
    } elseif ($action === 'logout') {
        if (!isValidUsername($username) || !isAuthorized($sessionDb, $username, $token)) {
            respond(['success' => false, 'message' => 'Token过期或无效'], 401);
        }
        $sessionDb->delete($username);
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