<?php
// 热铁盒云函数 API - 工作区同步模块 (workspace.php)
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

function ensureCsrfMatched() {
    $csrfHeader = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? trim($_SERVER['HTTP_X_CSRF_TOKEN']) : '';
    $csrfCookie = isset($_COOKIE['sce_csrf']) ? trim($_COOKIE['sce_csrf']) : '';
    return $csrfHeader !== '' && $csrfCookie !== '' && hash_equals($csrfCookie, $csrfHeader);
}

function isValidUsername($username) {
    return is_string($username) && preg_match('/^[A-Za-z0-9_-]{1,32}$/', $username);
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
$username = isset($input['username']) ? trim($input['username']) : null;
$token = isset($input['token']) ? trim($input['token']) : null;

if (!ensureCsrfMatched()) {
    respond(['success' => false, 'message' => 'CSRF 校验失败'], 403);
}

if (!isValidUsername($username) || !$token) {
    respond(['success' => false, 'message' => '未授权的访问'], 401);
}

// 连接数据库
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

        // 如果提供了 fileId，则覆盖写入；否则创建新文件
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

        // 写入文件数据到 scefiles
        $dbFiles->set($fileId, json_encode($fileData));

        // 将 fileId 记录到 users 数据库的用户专属列表中
        $userFilesKey = $username . '_files';
        
        // 检查是否已经存在于列表中，避免重复 push
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
                        // 出于防范，只拉取属于该用户的文件（防止垃圾数据）
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

        // 按时间倒序排序
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

        // 鉴权：只能加载自己的文件
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
         
         // 鉴权
         $fileRaw = $dbFiles->get($fileId);
         if ($fileRaw !== null) {
             $fileData = json_decode($fileRaw, true);
             if ($fileData && isset($fileData['metadata']) && $fileData['metadata']['author'] === $username) {
                 // 删除物理键
                 $dbFiles->delete($fileId);
                 
                 // 从索引数组中移出
                 $userFilesKey = $username . '_files';
                 // array delete API is natively supported: delete(key_name, value)
                  $dbUsers->delete($userFilesKey, $fileId);
                  
                  respond(['success' => true, 'message' => '文件已删除']);
              } else {
                  respond(['success' => false, 'message' => '无权删除该文件或文件损坏']);
              }
          } else {
             // 即使物理文件不在了，如果列表里还有残留，也顺带把它清了
              $userFilesKey = $username . '_files';
              $dbUsers->delete($userFilesKey, $fileId);
              
              respond(['success' => true, 'message' => '文件已被移除']);
          }
    } else {
        respond(['success' => false, 'message' => 'Unknown action'], 400);
    }

} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Internal Server Error' ], 500);
}
?>
