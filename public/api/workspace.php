<?php
header('Content-Type: application/json; charset=utf-8');

// Database 类存根（仅用于 IDE 类型检查，实际由 Retinbox 平台提供）
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

if (!class_exists('Database')) {
    respond(['success' => false, 'message' => 'Environment error: Database not supported.']);
}

const MIN_TOKEN_LENGTH = 32;

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

function isValidUsername($username) {
    return is_string($username) && preg_match('/^[A-Za-z0-9_-]{1,32}$/', $username);
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
$username = isset($input['username']) ? trim($input['username']) : null;
$token = isset($input['token']) ? trim($input['token']) : null;

if (!ensureCsrfMatched()) {
    respond(['success' => false, 'message' => 'CSRF 校验失败'], 403);
}

if (!isValidUsername($username) || !$token) {
    respond(['success' => false, 'message' => '未授权的访问'], 401);
}

$dbUsers = new Database("users");
$dbFiles = new Database("scefiles");
$sessionDb = new Database("users_sessions");

if (!isAuthorized($sessionDb, $username, $token)) {
    respond(['success' => false, 'message' => 'Token无效或已过期'], 401);
}

try {
    if ($action === 'save') {
        $name = isset($input['name']) ? trim($input['name']) : '未命名工作区';
        $content = isset($input['content']) ? $input['content'] : '';

        if (empty($content)) {
            respond(['success' => false, 'message' => '工作区内容不能为空']);
        }

        $fileId = isset($input['fileId']) && !empty($input['fileId']) ? $input['fileId'] : uniqid('ws_');
        $contentSize = is_string($content) ? strlen($content) : strlen(json_encode($content));

        $metadata = [
            'author' => $username,
            'name' => $name,
            'time' => date('c'),
            'size' => $contentSize
        ];

        $fileData = [
            'metadata' => $metadata,
            'content' => $content
        ];

        $dbFiles->set($fileId, json_encode($fileData));

        $userFilesKey = $username . '_files';
        $existingFiles = $dbUsers->get_array($userFilesKey);
        if ($existingFiles === null) {
             $existingFiles = [];
        }

        if (!in_array($fileId, $existingFiles)) {
            $dbUsers->push($userFilesKey, $fileId);
        }

        respond([
            'success' => true,
            'message' => '保存成功',
            'data' => [
                'fileId' => $fileId,
                'metadata' => $metadata
            ]
        ]);

    } elseif ($action === 'list') {
        $userFilesKey = $username . '_files';
        $fileIds = $dbUsers->get_array($userFilesKey);

        $list = [];
        if ($fileIds && is_array($fileIds)) {
            foreach ($fileIds as $fileId) {
                $fileRaw = $dbFiles->get($fileId);
                if ($fileRaw !== null) {
                    $fileData = json_decode($fileRaw, true);
                    if ($fileData && isset($fileData['metadata'])) {
                        if ($fileData['metadata']['author'] === $username) {
                            $list[] = [
                                'fileId' => $fileId,
                                'metadata' => $fileData['metadata']
                            ];
                        }
                    }
                }
            }
        }

        usort($list, function($a, $b) {
            return strtotime($b['metadata']['time']) - strtotime($a['metadata']['time']);
        });

        respond([
            'success' => true,
            'data' => $list
        ]);

    } elseif ($action === 'load') {
        $fileId = isset($input['fileId']) ? trim($input['fileId']) : null;
        if (!$fileId) {
            respond(['success' => false, 'message' => '缺少 fileId']);
        }

        $fileRaw = $dbFiles->get($fileId);
        if ($fileRaw === null) {
            respond(['success' => false, 'message' => '文件不存在或已被删除']);
        }

        $fileData = json_decode($fileRaw, true);
        if (!$fileData || !isset($fileData['metadata']) || !isset($fileData['content'])) {
             respond(['success' => false, 'message' => '文件格式损坏']);
        }

        if ($fileData['metadata']['author'] !== $username) {
            respond(['success' => false, 'message' => '无权访问该文件']);
        }

        respond([
            'success' => true,
            'data' => $fileData
        ]);

    } elseif ($action === 'delete') {
         $fileId = isset($input['fileId']) ? trim($input['fileId']) : null;
         if (!$fileId) {
             respond(['success' => false, 'message' => '缺少 fileId']);
         }

         $fileRaw = $dbFiles->get($fileId);
         if ($fileRaw !== null) {
             $fileData = json_decode($fileRaw, true);
             if ($fileData && isset($fileData['metadata']) && $fileData['metadata']['author'] === $username) {
                 $dbFiles->delete($fileId);

                 $userFilesKey = $username . '_files';
                 $dbUsers->delete($userFilesKey, $fileId);

                  respond(['success' => true, 'message' => '文件已删除']);
              } else {
                  respond(['success' => false, 'message' => '无权删除该文件或文件损坏']);
              }
          } else {
              $userFilesKey = $username . '_files';
              $dbUsers->delete($userFilesKey, $fileId);

              respond(['success' => true, 'message' => '文件已被移除']);
          }
    } else {
        respond(['success' => false, 'message' => 'Unknown action'], 400);
    }

} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Internal Server Error'], 500);
}
?>