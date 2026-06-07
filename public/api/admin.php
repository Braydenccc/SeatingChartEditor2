<?php
require_once "api/common.php";
require_once "api/file-permissions.php";

const ADMIN_DB_NAME = 'admin';
const ADMIN_ENABLE_KEY = 'is_enable';
const ADMIN_TOKEN_HASH_KEY = 'api_token_hash';
const ADMIN_CORS_ALLOWED_ORIGINS_KEY = 'cors_allowed_origins';
const ADMIN_AUDIT_LOG_KEY = 'audit_logs';
const ADMIN_AUDIT_FAILURE_KEY = 'audit_failures';
const ADMIN_MAX_LOG_LIMIT = 200;
const ADMIN_UNVERIFIED_RATE_WINDOW = 300;
const ADMIN_UNVERIFIED_RATE_MAX = 30;

function adminNormalizeCorsOrigin($origin) {
    if (!is_string($origin)) {
        return '';
    }

    $origin = rtrim(trim($origin), '/');
    if ($origin === '' || $origin === '*') {
        return '';
    }

    $parts = parse_url($origin);
    if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
        return '';
    }

    if (strtolower($parts['scheme']) !== 'https') {
        return '';
    }

    if (isset($parts['path']) || isset($parts['query']) || isset($parts['fragment']) || isset($parts['user']) || isset($parts['pass'])) {
        return '';
    }

    $normalized = 'https://' . strtolower($parts['host']);
    if (isset($parts['port'])) {
        $normalized .= ':' . (int)$parts['port'];
    }

    return $normalized;
}

function adminParseCorsAllowedOrigins($rawOrigins) {
    if (is_array($rawOrigins)) {
        $originItems = $rawOrigins;
    } elseif (is_string($rawOrigins) && trim($rawOrigins) !== '') {
        $decoded = json_decode($rawOrigins, true);
        $originItems = is_array($decoded) ? $decoded : preg_split('/[\r\n,]+/', $rawOrigins);
    } else {
        return [];
    }

    if (!is_array($originItems)) {
        return [];
    }

    $allowedOrigins = [];
    foreach ($originItems as $originItem) {
        $origin = adminNormalizeCorsOrigin($originItem);
        if ($origin !== '') {
            $allowedOrigins[] = $origin;
        }
    }

    return array_values(array_unique($allowedOrigins));
}

function adminGetConfiguredCorsAllowedOrigins() {
    if (!class_exists('Database')) {
        return [];
    }

    try {
        $adminDb = new Database(ADMIN_DB_NAME);
        return adminParseCorsAllowedOrigins($adminDb->get(ADMIN_CORS_ALLOWED_ORIGINS_KEY));
    } catch (Throwable $error) {
        return [];
    }
}

function adminApplyCors() {
    $origin = isset($_SERVER['HTTP_ORIGIN']) && is_string($_SERVER['HTTP_ORIGIN']) ? trim($_SERVER['HTTP_ORIGIN']) : '';
    $allowedOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174'
    ];
    $allowedOrigins = array_merge($allowedOrigins, adminGetConfiguredCorsAllowedOrigins());

    $isAllowedOrigin = $origin !== '' && in_array($origin, $allowedOrigins, true);

    if ($isAllowedOrigin) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
        header('Access-Control-Max-Age: 600');
        header('Vary: Origin');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code($origin === '' || $isAllowedOrigin ? 204 : 403);
        exit($origin === '' || $isAllowedOrigin ? 0 : 1);
    }
}

adminApplyCors();
header('Content-Type: application/json; charset=utf-8');

if (!class_exists('Database')) {
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => 'Environment error: Database not supported.'], JSON_UNESCAPED_UNICODE);
    exit(1);
}

function adminGetHeaderValue($name) {
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return isset($_SERVER[$key]) && is_string($_SERVER[$key]) ? trim($_SERVER[$key]) : '';
}

function adminCreateRequestSummary($rawInput = null, $jsonError = '') {
    $summary = [
        'method' => isset($_SERVER['REQUEST_METHOD']) ? (string)$_SERVER['REQUEST_METHOD'] : '',
        'contentType' => isset($_SERVER['CONTENT_TYPE']) ? substr((string)$_SERVER['CONTENT_TYPE'], 0, 120) : '',
        'contentLength' => isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : null,
        'rawInputLength' => is_string($rawInput) ? strlen($rawInput) : null,
        'hasPostFields' => !empty($_POST),
        'origin' => isset($_SERVER['HTTP_ORIGIN']) ? substr((string)$_SERVER['HTTP_ORIGIN'], 0, 160) : '',
        'referer' => isset($_SERVER['HTTP_REFERER']) ? substr((string)$_SERVER['HTTP_REFERER'], 0, 200) : ''
    ];

    if ($jsonError !== '') {
        $summary['jsonError'] = $jsonError;
    }

    return $summary;
}

function adminNormalizePostInput($post) {
    $input = is_array($post) ? $post : [];
    foreach ($input as $key => $value) {
        if (is_array($value) && count($value) === 1) {
            $input[$key] = reset($value);
        }
    }

    foreach (['deleted', 'includeContent'] as $key) {
        if (!isset($input[$key]) || is_bool($input[$key])) {
            continue;
        }

        if ($input[$key] === 'true' || $input[$key] === '1' || $input[$key] === 1) {
            $input[$key] = true;
        } elseif ($input[$key] === 'false' || $input[$key] === '0' || $input[$key] === 0) {
            $input[$key] = false;
        }
    }

    return $input;
}

function adminParseUrlEncodedInput($rawInput) {
    if (!is_string($rawInput) || trim($rawInput) === '') {
        return [];
    }

    $parsed = [];
    parse_str($rawInput, $parsed);
    return adminNormalizePostInput($parsed);
}

function adminParseRequest() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        return [
            'input' => [],
            'error' => 'Only POST requests are allowed',
            'status' => 405,
            'requestSummary' => adminCreateRequestSummary()
        ];
    }

    $rawInput = file_get_contents('php://input');
    $input = null;

    if (is_string($rawInput) && trim($rawInput) !== '') {
        $input = json_decode($rawInput, true);
        if (!is_array($input)) {
            $postInput = adminNormalizePostInput($_POST);
            if (!empty($postInput) && isset($postInput['action']) && is_string($postInput['action'])) {
                return [
                    'input' => $postInput,
                    'error' => null,
                    'status' => 200,
                    'requestSummary' => adminCreateRequestSummary($rawInput, json_last_error_msg())
                ];
            }

            $urlEncodedInput = adminParseUrlEncodedInput($rawInput);
            if (!empty($urlEncodedInput) && isset($urlEncodedInput['action']) && is_string($urlEncodedInput['action'])) {
                return [
                    'input' => $urlEncodedInput,
                    'error' => null,
                    'status' => 200,
                    'requestSummary' => adminCreateRequestSummary($rawInput, json_last_error_msg())
                ];
            }

            $payloadHeaderInput = adminParseUrlEncodedInput(adminGetHeaderValue('X-Admin-Payload'));
            if (!empty($payloadHeaderInput) && isset($payloadHeaderInput['action']) && is_string($payloadHeaderInput['action'])) {
                return [
                    'input' => $payloadHeaderInput,
                    'error' => null,
                    'status' => 200,
                    'requestSummary' => adminCreateRequestSummary($rawInput, json_last_error_msg())
                ];
            }

            return [
                'input' => [],
                'error' => 'Invalid JSON request body',
                'status' => 400,
                'requestSummary' => adminCreateRequestSummary($rawInput, json_last_error_msg())
            ];
        }
    } elseif (!empty($_POST)) {
        $input = adminNormalizePostInput($_POST);
    }

    if ((!is_array($input) || !isset($input['action']) || !is_string($input['action']))) {
        $payloadHeaderInput = adminParseUrlEncodedInput(adminGetHeaderValue('X-Admin-Payload'));
        if (!empty($payloadHeaderInput) && isset($payloadHeaderInput['action']) && is_string($payloadHeaderInput['action'])) {
            $input = $payloadHeaderInput;
        }
    }

    if (!is_array($input) || !isset($input['action']) || !is_string($input['action'])) {
        return [
            'input' => is_array($input) ? $input : [],
            'error' => 'Invalid Request',
            'status' => 400,
            'requestSummary' => adminCreateRequestSummary($rawInput)
        ];
    }

    return [
        'input' => $input,
        'error' => null,
        'status' => 200,
        'requestSummary' => adminCreateRequestSummary($rawInput)
    ];
}

function adminIsVerified($adminDb) {
    $enabled = $adminDb->get(ADMIN_ENABLE_KEY);
    if ($enabled !== '1') {
        return false;
    }

    $token = adminGetHeaderValue('X-Admin-Token');
    if ($token === '') {
        return false;
    }

    $savedHash = $adminDb->get(ADMIN_TOKEN_HASH_KEY);
    if (!is_string($savedHash) || trim($savedHash) === '') {
        return false;
    }

    return hash_equals(strtolower(trim($savedHash)), hash('sha256', $token));
}

function adminIsHttpsAllowed() {
    return isHttpsRequest() || isLocalRequestHost() || envFlagEnabled('ADMIN_ALLOW_HTTP');
}

function adminCheckUnverifiedRateLimit() {
    $rateDb = new Database('admin_rate_limit');
    $key = sanitizeDbKey('admin_unverified_' . getClientIp());
    $now = time();
    $raw = $rateDb->get($key);
    $timestamps = $raw ? json_decode($raw, true) : [];
    if (!is_array($timestamps)) {
        $timestamps = [];
    }

    $timestamps = array_values(array_filter($timestamps, function($timestamp) use ($now) {
        return ($now - (int)$timestamp) < ADMIN_UNVERIFIED_RATE_WINDOW;
    }));

    if (count($timestamps) >= ADMIN_UNVERIFIED_RATE_MAX) {
        http_response_code(429);
        echo json_encode(['success' => false, 'message' => '请求过于频繁，请稍后重试'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);
        exit(1);
    }

    $timestamps[] = $now;
    $rateDb->set($key, json_encode($timestamps));
}

function adminSanitizeForLog($value, $depth = 0) {
    if ($depth > 4) {
        return '[truncated]';
    }

    if (!is_array($value)) {
        if (is_string($value) && strlen($value) > 160) {
            return substr($value, 0, 160) . '...';
        }
        return $value;
    }

    $sensitiveKeys = [
        'token',
        'password',
        'currentpassword',
        'newpassword',
        'content',
        'authorization',
        'encryptedpassword',
        'webdav',
        'settings'
    ];

    $sanitized = [];
    $count = 0;
    foreach ($value as $key => $item) {
        if ($count >= 25) {
            $sanitized['__truncated'] = true;
            break;
        }

        $normalizedKey = strtolower((string)$key);
        if (in_array($normalizedKey, $sensitiveKeys, true)) {
            $sanitized[$key] = '[redacted]';
        } else {
            $sanitized[$key] = adminSanitizeForLog($item, $depth + 1);
        }
        $count++;
    }

    return $sanitized;
}

function adminCreateLogEntry($action, $success, $verified, $status, $reason, $target, $input, $requestSummary = null) {
    $entry = [
        'id' => bin2hex(random_bytes(8)),
        'time' => time(),
        'timestamp' => date('c'),
        'action' => $action,
        'success' => $success,
        'verified' => $verified,
        'status' => $status,
        'ip' => getClientIp(),
        'userAgent' => isset($_SERVER['HTTP_USER_AGENT']) ? substr((string)$_SERVER['HTTP_USER_AGENT'], 0, 200) : '',
        'reason' => $reason,
        'target' => $target,
        'paramsSummary' => adminSanitizeForLog($input)
    ];

    if (is_array($requestSummary)) {
        $entry['requestSummary'] = adminSanitizeForLog($requestSummary);
    }

    return $entry;
}

function adminAppendAuditLog($adminDb, $entry) {
    try {
        $encoded = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);
        $adminDb->push(ADMIN_AUDIT_LOG_KEY, $encoded);
        if (!$entry['success'] || !$entry['verified']) {
            $adminDb->push(ADMIN_AUDIT_FAILURE_KEY, $encoded);
        }
    } catch (Exception $e) {
        error_log('Admin audit log failed: ' . $e->getMessage());
    }
}

function adminRespond($adminDb, $input, $action, $payload, $status, $success, $verified, $reason = '', $target = null, $requestSummary = null) {
    adminAppendAuditLog($adminDb, adminCreateLogEntry(
        $action,
        $success,
        $verified,
        $status,
        $reason,
        $target,
        $input,
        $requestSummary
    ));

    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);
    exit($status >= 400 ? 1 : 0);
}

function adminDecodeJson($raw, $fallback = []) {
    if (!is_string($raw) || $raw === '') {
        return $fallback;
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function adminIsPasswordHash($value) {
    if (!is_string($value) || $value === '') {
        return false;
    }

    $info = password_get_info($value);
    return isset($info['algo']) && $info['algo'] !== 0 && $info['algo'] !== null;
}

function adminGetExistingUserHash($usersDb, $username) {
    if (!isValidUsername($username)) {
        return null;
    }

    $hash = $usersDb->get($username);
    return adminIsPasswordHash($hash) ? $hash : null;
}

function adminIsWorkspaceDeleted($fileData) {
    if (!$fileData || !is_array($fileData)) {
        return false;
    }

    if (isset($fileData['deleted']) && $fileData['deleted'] === true) {
        return true;
    }

    if (isset($fileData['metadata']) && is_array($fileData['metadata'])) {
        if (isset($fileData['metadata']['deleted']) && $fileData['metadata']['deleted'] === true) {
            return true;
        }

        if (isset($fileData['metadata']['tags']) && is_array($fileData['metadata']['tags'])) {
            return in_array('deleted', $fileData['metadata']['tags'], true);
        }
    }

    return false;
}

function adminGetUserWorkspaces($usersDb, $filesDb, $permissionsDb, $username, $includeDeleted = true) {
    $legacyFileIds = $usersDb->get_array(sanitizeDbKey($username . '_files'));
    if (!is_array($legacyFileIds)) {
        $legacyFileIds = [];
    }

    $permissionFileIds = getUserAccessibleFiles($permissionsDb, $username);
    $fileIds = array_values(array_unique(array_merge($permissionFileIds ?: [], $legacyFileIds)));
    $workspaces = [];
    foreach ($fileIds as $fileId) {
        if (!isValidFileId($fileId)) {
            continue;
        }

        $fileRaw = $filesDb->get(sanitizeDbKey($fileId));
        $fileData = adminDecodeJson($fileRaw, null);
        if (!$fileData || !isset($fileData['metadata']) || !is_array($fileData['metadata'])) {
            continue;
        }

        $deleted = adminIsWorkspaceDeleted($fileData);
        if (!$includeDeleted && $deleted) {
            continue;
        }

        $workspaces[] = [
            'fileId' => $fileId,
            'metadata' => $fileData['metadata'],
            'deleted' => $deleted
        ];
    }

    return $workspaces;
}

function adminGetSettingsSummary($settingsDb, $username) {
    $settings = adminDecodeJson($settingsDb->get($username), []);
    $summary = [];

    if (isset($settings['backupMode'])) {
        $summary['backupMode'] = !!$settings['backupMode'];
    }

    if (isset($settings['webdav']) && is_array($settings['webdav'])) {
        $summary['webdav'] = [
            'url' => isset($settings['webdav']['url']) ? $settings['webdav']['url'] : null,
            'username' => isset($settings['webdav']['username']) ? $settings['webdav']['username'] : null,
            'hasEncryptedPassword' => isset($settings['webdav']['encryptedPassword'])
        ];
    }

    return $summary;
}

function adminParseLimit($input) {
    $limit = isset($input['limit']) ? (int)$input['limit'] : 50;
    if ($limit < 1) {
        $limit = 50;
    }
    if ($limit > ADMIN_MAX_LOG_LIMIT) {
        $limit = ADMIN_MAX_LOG_LIMIT;
    }
    return $limit;
}

function adminReadLogArray($adminDb, $key, $limit) {
    $logs = $adminDb->get_array($key);
    if (!is_array($logs)) {
        return [];
    }

    $logs = array_slice($logs, -$limit);
    $logs = array_reverse($logs);
    $result = [];
    foreach ($logs as $entry) {
        $decoded = adminDecodeJson($entry, null);
        if ($decoded) {
            $result[] = $decoded;
        }
    }

    return $result;
}

$adminDb = new Database(ADMIN_DB_NAME);
$parseResult = adminParseRequest();
$input = $parseResult['input'];
$action = isset($input['action']) && is_string($input['action']) ? $input['action'] : 'unknown';
if (!adminIsHttpsAllowed()) {
    adminRespond(
        $adminDb,
        $input,
        $action,
        ['success' => false, 'message' => '管理接口必须使用 HTTPS 连接'],
        403,
        false,
        false,
        'https_required',
        null,
        isset($parseResult['requestSummary']) ? $parseResult['requestSummary'] : null
    );
}
$verified = adminIsVerified($adminDb);

if (!$verified) {
    adminCheckUnverifiedRateLimit();
    adminRespond(
        $adminDb,
        $input,
        $action,
        ['success' => false, 'message' => '未验证'],
        401,
        false,
        false,
        'not_verified'
    );
}

if ($parseResult['error'] !== null) {
    adminRespond(
        $adminDb,
        $input,
        $action,
        ['success' => false, 'message' => $parseResult['error']],
        $parseResult['status'],
        false,
        true,
        'invalid_request',
        null,
        isset($parseResult['requestSummary']) ? $parseResult['requestSummary'] : null
    );
}

$allowedActions = [
    'list_users',
    'get_user_detail',
    'set_user_status',
    'reset_user_password',
    'list_workspaces',
    'get_workspace_detail',
    'rename_workspace',
    'set_workspace_deleted',
    'list_audit_logs',
    'list_audit_failures'
];

if (!in_array($action, $allowedActions, true)) {
    adminRespond(
        $adminDb,
        $input,
        $action,
        ['success' => false, 'message' => 'Unknown action'],
        400,
        false,
        true,
        'unknown_action'
    );
}

try {
    $usersDb = new Database('users');
    $profilesDb = new Database('user_profiles');
    $filesDb = new Database('scefiles');
    $permissionsDb = new Database('file_permissions');
    $settingsDb = new Database('users_settings');
    $sessionDb = new Database('users_sessions');

    if ($action === 'list_users') {
        $keys = $usersDb->list_keys();
        sort($keys);

        $users = [];
        foreach ($keys as $key) {
            if (!isValidUsername($key)) {
                continue;
            }

            $hash = $usersDb->get($key);
            if (!adminIsPasswordHash($hash)) {
                continue;
            }

            $profile = getUserProfile($profilesDb, $key);
            $users[] = [
                'username' => $key,
                'status' => $profile['status'],
                'workspaceCount' => count(adminGetUserWorkspaces($usersDb, $filesDb, $permissionsDb, $key, false))
            ];
        }

        adminRespond(
            $adminDb,
            $input,
            $action,
            ['success' => true, 'data' => $users],
            200,
            true,
            true
        );
    }

    if ($action === 'get_user_detail') {
        $username = isset($input['username']) ? trim((string)$input['username']) : '';
        if (adminGetExistingUserHash($usersDb, $username) === null) {
            adminRespond(
                $adminDb,
                $input,
                $action,
                ['success' => false, 'message' => '用户不存在'],
                404,
                false,
                true,
                'user_not_found',
                $username
            );
        }

        $profile = getUserProfile($profilesDb, $username);
        adminRespond(
            $adminDb,
            $input,
            $action,
            [
                'success' => true,
                'data' => [
                    'username' => $username,
                    'status' => $profile['status'],
                    'profile' => $profile,
                    'workspaces' => adminGetUserWorkspaces($usersDb, $filesDb, $permissionsDb, $username, true),
                    'settings' => adminGetSettingsSummary($settingsDb, $username)
                ]
            ],
            200,
            true,
            true,
            '',
            $username
        );
    }

    if ($action === 'set_user_status') {
        $username = isset($input['username']) ? trim((string)$input['username']) : '';
        $status = isset($input['status']) ? trim((string)$input['status']) : '';

        if (adminGetExistingUserHash($usersDb, $username) === null) {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => '用户不存在'], 404, false, true, 'user_not_found', $username);
        }

        if (!in_array($status, ['active', 'disabled'], true)) {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => '用户状态无效'], 400, false, true, 'invalid_status', $username);
        }

        $profile = getUserProfile($profilesDb, $username);
        $profile['status'] = $status;
        $profile['updatedAt'] = date('c');
        if ($status === 'disabled') {
            $profile['disabledAt'] = date('c');
        }
        if ($status === 'active' && isset($profile['disabledAt'])) {
            unset($profile['disabledAt']);
        }

        $profilesDb->set($username, json_encode($profile, JSON_UNESCAPED_UNICODE));
        adminRespond($adminDb, $input, $action, ['success' => true, 'message' => '用户状态已更新', 'data' => ['username' => $username, 'status' => $status]], 200, true, true, '', $username);
    }

    if ($action === 'reset_user_password') {
        $username = isset($input['username']) ? trim((string)$input['username']) : '';
        $newPassword = isset($input['newPassword']) && is_string($input['newPassword']) ? $input['newPassword'] : '';

        if (adminGetExistingUserHash($usersDb, $username) === null) {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => '用户不存在'], 404, false, true, 'user_not_found', $username);
        }

        $validation = validatePasswordStrength($newPassword);
        if (!$validation['valid']) {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => $validation['message']], 400, false, true, 'invalid_password', $username);
        }

        $usersDb->set($username, password_hash($newPassword, PASSWORD_DEFAULT));
        $sessionDb->delete($username);
        adminRespond($adminDb, $input, $action, ['success' => true, 'message' => '密码已重置'], 200, true, true, '', $username);
    }

    if ($action === 'list_workspaces') {
        $keys = $filesDb->list_keys();
        sort($keys);
        $workspaces = [];

        foreach ($keys as $fileId) {
            if (!isValidFileId($fileId)) {
                continue;
            }

            $fileData = adminDecodeJson($filesDb->get($fileId), null);
            if (!$fileData || !isset($fileData['metadata']) || !is_array($fileData['metadata'])) {
                continue;
            }

            $workspaces[] = [
                'fileId' => $fileId,
                'metadata' => $fileData['metadata'],
                'deleted' => adminIsWorkspaceDeleted($fileData)
            ];
        }

        usort($workspaces, function($a, $b) {
            $aTime = isset($a['metadata']['time']) ? strtotime($a['metadata']['time']) : 0;
            $bTime = isset($b['metadata']['time']) ? strtotime($b['metadata']['time']) : 0;
            return $bTime - $aTime;
        });

        adminRespond($adminDb, $input, $action, ['success' => true, 'data' => $workspaces], 200, true, true);
    }

    if ($action === 'get_workspace_detail') {
        $fileId = isset($input['fileId']) ? trim((string)$input['fileId']) : '';
        $includeContent = isset($input['includeContent']) && $input['includeContent'] === true;

        if (!isValidFileId($fileId)) {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => '文件ID格式无效'], 400, false, true, 'invalid_file_id', $fileId);
        }

        $fileData = adminDecodeJson($filesDb->get(sanitizeDbKey($fileId)), null);
        if (!$fileData || !isset($fileData['metadata']) || !is_array($fileData['metadata'])) {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => '工作区不存在或格式损坏'], 404, false, true, 'workspace_not_found', $fileId);
        }

        $data = [
            'fileId' => $fileId,
            'metadata' => $fileData['metadata'],
            'deleted' => adminIsWorkspaceDeleted($fileData)
        ];
        if ($includeContent) {
            $data['content'] = isset($fileData['content']) ? $fileData['content'] : null;
        }

        adminRespond($adminDb, $input, $action, ['success' => true, 'data' => $data], 200, true, true, '', $fileId);
    }

    if ($action === 'rename_workspace') {
        $fileId = isset($input['fileId']) ? trim((string)$input['fileId']) : '';
        $name = isset($input['name']) ? trim((string)$input['name']) : '';

        if (!isValidFileId($fileId)) {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => '文件ID格式无效'], 400, false, true, 'invalid_file_id', $fileId);
        }

        if ($name === '') {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => '工作区名称不能为空'], 400, false, true, 'invalid_name', $fileId);
        }

        $nameLength = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);
        if ($nameLength > 50) {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => '工作区名称不能超过 50 个字符'], 400, false, true, 'invalid_name', $fileId);
        }

        $sanitizedFileId = sanitizeDbKey($fileId);
        $fileData = adminDecodeJson($filesDb->get($sanitizedFileId), null);
        if (!$fileData || !isset($fileData['metadata']) || !is_array($fileData['metadata'])) {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => '工作区不存在或格式损坏'], 404, false, true, 'workspace_not_found', $fileId);
        }

        $fileData['metadata']['name'] = $name;
        $fileData['metadata']['adminUpdatedAt'] = date('c');
        $filesDb->set($sanitizedFileId, json_encode($fileData, JSON_UNESCAPED_UNICODE));

        adminRespond($adminDb, $input, $action, ['success' => true, 'message' => '工作区名称已更新', 'data' => ['fileId' => $fileId, 'metadata' => $fileData['metadata']]], 200, true, true, '', $fileId);
    }

    if ($action === 'set_workspace_deleted') {
        $fileId = isset($input['fileId']) ? trim((string)$input['fileId']) : '';
        if (!isset($input['deleted']) || !is_bool($input['deleted'])) {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => 'deleted 必须是布尔值'], 400, false, true, 'invalid_deleted_flag', $fileId);
        }

        $deleted = $input['deleted'];

        if (!isValidFileId($fileId)) {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => '文件ID格式无效'], 400, false, true, 'invalid_file_id', $fileId);
        }

        $sanitizedFileId = sanitizeDbKey($fileId);
        $fileData = adminDecodeJson($filesDb->get($sanitizedFileId), null);
        if (!$fileData || !isset($fileData['metadata']) || !is_array($fileData['metadata'])) {
            adminRespond($adminDb, $input, $action, ['success' => false, 'message' => '工作区不存在或格式损坏'], 404, false, true, 'workspace_not_found', $fileId);
        }

        if (!isset($fileData['metadata']['tags']) || !is_array($fileData['metadata']['tags'])) {
            $fileData['metadata']['tags'] = [];
        }

        if ($deleted) {
            if (!in_array('deleted', $fileData['metadata']['tags'], true)) {
                $fileData['metadata']['tags'][] = 'deleted';
            }
            $fileData['metadata']['deleted'] = true;
            $fileData['metadata']['deletedAt'] = date('c');
        } else {
            $fileData['metadata']['deleted'] = false;
            unset($fileData['metadata']['deletedAt']);
            unset($fileData['deleted']);
            $fileData['metadata']['tags'] = array_values(array_filter($fileData['metadata']['tags'], function($tag) {
                return $tag !== 'deleted';
            }));
        }

        $fileData['metadata']['adminUpdatedAt'] = date('c');
        $filesDb->set($sanitizedFileId, json_encode($fileData, JSON_UNESCAPED_UNICODE));

        adminRespond($adminDb, $input, $action, ['success' => true, 'message' => $deleted ? '工作区已标记删除' : '工作区已恢复', 'data' => ['fileId' => $fileId, 'metadata' => $fileData['metadata'], 'deleted' => adminIsWorkspaceDeleted($fileData)]], 200, true, true, '', $fileId);
    }

    if ($action === 'list_audit_logs') {
        $limit = adminParseLimit($input);
        adminRespond($adminDb, $input, $action, ['success' => true, 'data' => adminReadLogArray($adminDb, ADMIN_AUDIT_LOG_KEY, $limit)], 200, true, true);
    }

    if ($action === 'list_audit_failures') {
        $limit = adminParseLimit($input);
        adminRespond($adminDb, $input, $action, ['success' => true, 'data' => adminReadLogArray($adminDb, ADMIN_AUDIT_FAILURE_KEY, $limit)], 200, true, true);
    }
} catch (Exception $e) {
    error_log('Admin API Exception: ' . $e->getMessage());
    adminRespond(
        $adminDb,
        $input,
        $action,
        ['success' => false, 'message' => 'Internal Server Error'],
        500,
        false,
        $verified,
        'internal_error'
    );
}
?>
