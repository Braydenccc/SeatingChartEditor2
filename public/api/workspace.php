<?php
// 热铁盒云函数 API - 工作区同步模块 (workspace.php)
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 确保在热铁盒环境中类存在
if (!class_exists('Database')) {
    echo json_encode(['success' => false, 'message' => 'Environment error: Database not supported.']);
    exit(1);
}

// 解析 JSON 载荷
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!$input || !isset($input['action'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid Request']);
    exit(1);
}

$action = $input['action'];
$username = isset($input['username']) ? trim($input['username']) : null;
$token = isset($input['token']) ? trim($input['token']) : null;

if (!$username || !$token) {
    echo json_encode(['success' => false, 'message' => '未授权的访问']);
    exit(1);
}

// 连接数据库
$dbUsers = new Database("users");
$dbFiles = new Database("scefiles");

// --- 简单的 Token 验证 ---
// （在实际应用中，应该在 auth.php 发放更安全的 JWT Token，这里使用简单的 mock token 进行对应验证）
$expectedPrefix = $username . ':';
$decodedToken = base64_decode($token);
if (strpos($decodedToken, $expectedPrefix) !== 0) {
    echo json_encode(['success' => false, 'message' => 'Token无效或已过期']);
    exit(1);
}

try {
    if ($action === 'save') {
        $name = isset($input['name']) ? trim($input['name']) : '未命名工作区';
        $content = isset($input['content']) ? $input['content'] : '';

        if (empty($content)) {
            echo json_encode(['success' => false, 'message' => '工作区内容不能为空']);
            exit(0);
        }

        // 如果提供了 fileId，则覆盖写入；否则创建新文件
        $fileId = isset($input['fileId']) && !empty($input['fileId']) ? $input['fileId'] : uniqid('ws_');

        $metadata = [
            'author' => $username,
            'name' => $name,
            'time' => date('c'),
            'size' => strlen($content)
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

        echo json_encode([
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

        echo json_encode([
            'success' => true,
            'data' => $list
        ]);

    } elseif ($action === 'load') {
        $fileId = isset($input['fileId']) ? trim($input['fileId']) : null;
        if (!$fileId) {
            echo json_encode(['success' => false, 'message' => '缺少 fileId']);
            exit(0);
        }

        $fileRaw = $dbFiles->get($fileId);
        if ($fileRaw === null) {
            echo json_encode(['success' => false, 'message' => '文件不存在或已被删除']);
            exit(0);
        }

        $fileData = json_decode($fileRaw, true);
        if (!$fileData || !isset($fileData['metadata']) || !isset($fileData['content'])) {
             echo json_encode(['success' => false, 'message' => '文件格式损坏']);
             exit(0);
        }

        // 鉴权：只能加载自己的文件
        if ($fileData['metadata']['author'] !== $username) {
            echo json_encode(['success' => false, 'message' => '无权访问该文件']);
            exit(0);
        }

        echo json_encode([
            'success' => true,
            'data' => $fileData
        ]);

    } elseif ($action === 'delete') {
         $fileId = isset($input['fileId']) ? trim($input['fileId']) : null;
         if (!$fileId) {
             echo json_encode(['success' => false, 'message' => '缺少 fileId']);
             exit(0);
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
                 
                 echo json_encode(['success' => true, 'message' => '文件已删除']);
                 exit(0);
             } else {
                 echo json_encode(['success' => false, 'message' => '无权删除该文件或文件损坏']);
                 exit(0);
             }
         } else {
             // 即使物理文件不在了，如果列表里还有残留，也顺带把它清了
             $userFilesKey = $username . '_files';
             $dbUsers->delete($userFilesKey, $fileId);
             
             echo json_encode(['success' => true, 'message' => '文件已被移除']);
             exit(0);
         }
    } else {
        echo json_encode(['success' => false, 'message' => 'Unknown action']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Internal Server Error' ]);
}
?>
