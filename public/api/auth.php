<?php
// 热铁盒云函数 API - 用户验证模块 (auth.php)
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 确保在热铁盒环境中类存在
if (!class_exists('Database')) {
    echo json_encode(['success' => false, 'message' => 'Environment error: Database not supported.']);
    exit(1);
}

function respond($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);
    exit($code >= 400 ? 1 : 0);
}

function isValidUsername($username) {
    return is_string($username) && preg_match('/^[A-Za-z0-9_-]{1,32}$/', $username);
}

function ensureCsrfMatched() {
    $csrfHeader = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? trim($_SERVER['HTTP_X_CSRF_TOKEN']) : '';
    $csrfCookie = isset($_COOKIE['sce_csrf']) ? trim($_COOKIE['sce_csrf']) : '';
    return $csrfHeader !== '' && $csrfCookie !== '' && hash_equals($csrfCookie, $csrfHeader);
}

function issueSessionToken($sessionDb, $username) {
    try {
        $token = bin2hex(random_bytes(32));
    } catch (Exception $e) {
        $token = hash('sha256', $username . ':' . microtime(true) . ':' . uniqid('', true));
    }
    $sessionDb->set($username, $token);
    return $token;
}

function isAuthorized($sessionDb, $username, $token) {
    if (!is_string($username) || !is_string($token) || strlen($token) < 32) {
        return false;
    }
    $saved = $sessionDb->get($username);
    return is_string($saved) && hash_equals($saved, $token);
}

// 解析 JSON 载荷
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

// 支持部分服务器直接把 payload 转化到了 $_POST
if (!$input && !empty($_POST)) {
    // 可能是 application/x-www-form-urlencoded
    $input = $_POST;
} elseif (!$input && isset($HTTP_RAW_POST_DATA)) {
    $input = json_decode($HTTP_RAW_POST_DATA, true);
}

// 支持处理被服务器 301 重定向为 GET 的情况，或者仅仅是为了调试
if ((!$input || !isset($input['action'])) && !empty($_GET) && isset($_GET['action'])) {
    $input = $_GET;
}

if (!$input || !isset($input['action'])) {
    respond([
        'success' => false, 
        'message' => 'Invalid Request',
        'debug' => [
            'method' => $_SERVER['REQUEST_METHOD'],
            'contentType' => isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : 'none',
            'rawLength' => strlen($rawInput),
            'hasPost' => !empty($_POST)
        ]
    ], 400);
}

$action = $input['action'];
$username = isset($input['username']) ? trim($input['username']) : '';
$password = isset($input['password']) ? (string) $input['password'] : '';
$token = isset($input['token']) ? trim($input['token']) : '';

$allowedActions = ['register', 'login', 'set_settings', 'get_settings'];
if (!in_array($action, $allowedActions, true)) {
    respond(['success' => false, 'message' => 'Unknown action'], 400);
}

if (!ensureCsrfMatched()) {
    respond(['success' => false, 'message' => 'CSRF 校验失败'], 403);
}

// 连接 "users" 数据库
$db = new Database("users");
$sessionDb = new Database("users_sessions");

try {
    if ($action === 'register') {
        if (!isValidUsername($username)) {
            respond(['success' => false, 'message' => '用户名格式无效']);
        }
        if (strlen($password) < 6) {
            respond(['success' => false, 'message' => '密码至少 6 位']);
        }

        // 检查用户是否已存在
        $existingHash = $db->get($username);
        if ($existingHash !== null) {
            respond(['success' => false, 'message' => '该用户名已被注册']);
        }

        // 使用 PASSWORD_DEFAULT (目前是 bcrypt) 加密密码
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $db->set($username, $hash);
        
        // 生成并持久化会话令牌
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

        // 登录
        $existingHash = $db->get($username);
        if ($existingHash === null) {
            respond(['success' => false, 'message' => '用户名或密码不正确']);
        }

        // 校验密码
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
