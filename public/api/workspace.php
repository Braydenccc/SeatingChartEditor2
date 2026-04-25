<?php
require_once "common.php";
header('Content-Type: application/json; charset=utf-8');

if (!class_exists('Database')) {
    respond(['success' => false, 'message' => 'Environment error: Database not supported.']);
}

const FILE_ID_BYTES = 16;

$input = parseRequestInput();

$action = $input['action'];
$username = isset($input['username']) ? trim($input['username']) : null;
$token = isset($input['token']) ? trim($input['token']) : null;

if (!ensureCsrfMatched($input)) {
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

        $fileId = isset($input['fileId']) && !empty($input['fileId']) ? $input['fileId'] : bin2hex(random_bytes(FILE_ID_BYTES));
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