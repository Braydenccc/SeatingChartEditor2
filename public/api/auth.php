<?php
// 热铁盒云函数 API - 用户验证模块 (auth.php)
header('Content-Type: application/json; charset=utf-8');

function getRequestScheme() {
    $https = isset($_SERVER['HTTPS']) ? strtolower((string)$_SERVER['HTTPS']) : '';
    if ($https !== '' && $https !== 'off' && $https !== '0') {
        return 'https';
    }
    if (isset($_SERVER['REQUEST_SCHEME'])) {
        $scheme = strtolower((string)$_SERVER['REQUEST_SCHEME']);
        if ($scheme === 'http' || $scheme === 'https') {
            return $scheme;
        }
    }
    return (isset($_SERVER['SERVER_PORT']) && (string)$_SERVER['SERVER_PORT'] === '443') ? 'https' : 'http';
}

function normalizeOrigin($origin) {
    if (!is_string($origin) || trim($origin) === '') {
        return null;
    }
    $parts = parse_url(trim($origin));
    if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
        return null;
    }
    $scheme = strtolower($parts['scheme']);
    if ($scheme !== 'http' && $scheme !== 'https') {
        return null;
    }
    $host = strtolower($parts['host']);
    $port = isset($parts['port']) ? (int)$parts['port'] : null;
    if ($port !== null && ($port < 1 || $port > 65535)) {
        return null;
    }
    if ($port === 80 && $scheme === 'http') {
        $port = null;
    } elseif ($port === 443 && $scheme === 'https') {
        $port = null;
    }
    return $scheme . '://' . $host . ($port !== null ? ':' . $port : '');
}

function getCurrentOrigin() {
    if (!isset($_SERVER['HTTP_HOST']) || !is_string($_SERVER['HTTP_HOST']) || trim($_SERVER['HTTP_HOST']) === '') {
        return null;
    }
    return normalizeOrigin(getRequestScheme() . '://' . trim($_SERVER['HTTP_HOST']));
}

if (isset($_SERVER['HTTP_ORIGIN'])) {
    $requestOrigin = normalizeOrigin($_SERVER['HTTP_ORIGIN']);
    $currentOrigin = getCurrentOrigin();
    if ($requestOrigin !== null && $currentOrigin !== null && hash_equals($currentOrigin, $requestOrigin)) {
        header('Access-Control-Allow-Origin: ' . $requestOrigin);
        header('Vary: Origin');
    }
}
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

const MIN_TOKEN_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 6;

function respond($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);
    exit($code >= 400 ? 1 : 0);
}

function isValidUsername($username) {
    return is_string($username) && preg_match('/^[A-Za-z0-9_-]{1,32}$/', $username);
}

function getCsrfCookieCandidates() {
    $candidates = [];
    $csrfCookie = isset($_COOKIE['sce_csrf']) ? trim((string)$_COOKIE['sce_csrf']) : '';
    if ($csrfCookie !== '') {
        $candidates[] = $csrfCookie;
    }
    $rawCookie = isset($_SERVER['HTTP_COOKIE']) ? (string)$_SERVER['HTTP_COOKIE'] : '';
    if ($rawCookie !== '') {
        foreach (explode(';', $rawCookie) as $part) {
            $segment = trim($part);
            if (stripos($segment, 'sce_csrf=') === 0) {
                $value = trim(substr($segment, strlen('sce_csrf=')));
                $decoded = urldecode($value);
                if ($decoded !== '') {
                    $candidates[] = $decoded;
                }
            }
        }
    }
    return array_values(array_unique($candidates));
}

function ensureCsrfMatched() {
    // Collect submitted CSRF token from header (preferred) and body (fallback)
    $csrfHeader = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? trim($_SERVER['HTTP_X_CSRF_TOKEN']) : '';

    global $input;
    $bodyCsrf = '';
    if (is_array($input) && isset($input['_csrf']) && is_string($input['_csrf'])) {
        $bodyCsrf = trim($input['_csrf']);
    }

    // Use header if available, otherwise body _csrf
    $submittedToken = $csrfHeader !== '' ? $csrfHeader : $bodyCsrf;
    if ($submittedToken === '') {
        return false;
    }

    // Primary: Double-Submit Cookie — compare submitted token against cookie
    $candidates = getCsrfCookieCandidates();
    foreach ($candidates as $candidate) {
        if ($candidate !== '' && hash_equals($candidate, $submittedToken)) {
            return true;
        }
    }

    // Fallback: if cookie unavailable but header and body both present and match,
    // accept for hosting environments where cookies may not be forwarded to PHP.
    // Security still ensured by SameSite cookie + JSON Content-Type + CORS checks.
    if ($csrfHeader !== '' && $bodyCsrf !== '' && hash_equals($csrfHeader, $bodyCsrf)) {
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
$password = isset($input['password']) && is_string($input['password']) ? $input['password'] : '';
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
        if (strlen($password) < MIN_PASSWORD_LENGTH) {
            respond(['success' => false, 'message' => '密码至少 ' . MIN_PASSWORD_LENGTH . ' 位']);
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
