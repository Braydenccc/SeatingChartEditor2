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

function isAuthorized($sessionDb, $username, $token) {
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
        $sessionDb->delete($username);
        return false;
    }

    // 新格式：比对 Token 的 SHA-256 哈希
    if (isset($data['tokenHash'])) {
        $tokenHash = hash('sha256', $token);
        return hash_equals($data['tokenHash'], $tokenHash);
    }

    // 旧格式：比对明文 Token（向后兼容）
    return hash_equals($data['token'], $token);
}

function getAuthenticatedUsername($sessionDb) {
    $username = isset($_COOKIE['sce_username']) && is_string($_COOKIE['sce_username']) ? trim($_COOKIE['sce_username']) : '';
    $token = isset($_COOKIE['sce_token']) && is_string($_COOKIE['sce_token']) ? trim($_COOKIE['sce_token']) : '';

    if (!isValidUsername($username) || !isAuthorized($sessionDb, $username, $token)) {
        return null;
    }

    $profileDb = new Database('user_profiles');
    if (isUserDisabled($profileDb, $username)) {
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

function isHttpsRequest() {
    if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
        return true;
    }
    if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
        return true;
    }
    if (isset($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on') {
        return true;
    }
    if (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) {
        return true;
    }
    if (isset($_SERVER['REQUEST_SCHEME']) && $_SERVER['REQUEST_SCHEME'] === 'https') {
        return true;
    }
    return false;
}

function setAppCookie($name, $value, $days, $httpOnly = true) {
    $options = [
        'expires' => time() + ($days * 86400),
        'path' => '/',
        'secure' => isHttpsRequest(),
        'httponly' => $httpOnly,
        'samesite' => 'Lax'
    ];
    setcookie($name, $value, $options);
}

function clearAppCookie($name, $httpOnly = true) {
    $options = [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => isHttpsRequest(),
        'httponly' => $httpOnly,
        'samesite' => 'Lax'
    ];
    setcookie($name, '', $options);
}

function sanitizeDbKey($key) {
    return preg_replace('/[^a-zA-Z0-9_-]/', '_', $key);
}

function getClientIp() {
    static $cachedIp = null;

    if ($cachedIp !== null) {
        return $cachedIp;
    }

    $ip = $_SERVER['HTTP_X_REAL_IP'] ??
          $_SERVER['HTTP_X_FORWARDED_FOR'] ??
          $_SERVER['REMOTE_ADDR'] ??
          'unknown';

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
