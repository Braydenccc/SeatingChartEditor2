<?php
require_once "api/common.php";
require_once "api/file-permissions.php";
header('Content-Type: application/json; charset=utf-8');

if (!class_exists('Database')) {
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => 'Environment error: Database not supported.'], JSON_UNESCAPED_UNICODE);
    exit(1);
}

const ADMIN_DB_NAME = 'admin';
const ADMIN_ENABLE_KEY = 'is_enable';
const ADMIN_TOKEN_HASH_KEY = 'api_token_hash';
const ADMIN_AUDIT_LOG_KEY = 'audit_logs';
const ADMIN_AUDIT_FAILURE_KEY = 'audit_failures';
const ADMIN_MAX_LOG_LIMIT = 200;
const ADMIN_UNVERIFIED_RATE_WINDOW = 300;
const ADMIN_UNVERIFIED_RATE_MAX = 30;

function adminGetHeaderValue($name) {
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return isset($_SERVER[$key]) && is_string($_SERVER[$key]) ? trim($_SERVER[$key]) : '';
}

function adminParseRequest() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        return [
            'input' => [],
            'error' => 'Only POST requests are allowed',
            'status' => 405
        ];
    }

    $rawInput = file_get_contents('php://input');
    $input = null;

    if (is_string($rawInput) && trim($rawInput) !== '') {
        $input = json_decode($rawInput, true);
        if (!is_array($input)) {
            return [
                'input' => [],
                'error' => 'Invalid JSON request body',
                'status' => 400
            ];
        }
    } elseif (!empty($_POST)) {
        $input = $_POST;
    }

    if (!is_array($input) || !isset($input['action']) || !is_string($input['action'])) {
        return [
            'input' => is_array($input) ? $input : [],
            'error' => 'Invalid Request',
            'status' => 400
        ];
    }

    return [
        'input' => $input,
        'error' => null,
        'status' => 200
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

function adminCreateLogEntry($action, $success, $verified, $status, $reason, $target, $input) {
    return [
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

function adminRespond($adminDb, $input, $action, $payload, $status, $success, $verified, $reason = '', $target = null) {
    adminAppendAuditLog($adminDb, adminCreateLogEntry(
        $action,
        $success,
        $verified,
        $status,
        $reason,
        $target,
        $input
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
        'invalid_request'
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
