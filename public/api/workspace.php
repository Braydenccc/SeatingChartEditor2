<?php
require_once "api/common.php";
require_once "api/file-permissions.php";
header('Content-Type: application/json; charset=utf-8');

if (!class_exists('Database')) {
    respond(['success' => false, 'message' => 'Environment error: Database not supported.']);
}

const FILE_ID_BYTES = 16;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB 限制

/**
 * 验证工作区内容格式
 * 支持新旧两种数据结构：
 * - 旧版：顶层 seats, seatConfig
 * - 新版：layout.seats, layout.config
 * @param mixed $content 待验证的内容
 * @return array ['valid' => bool, 'message' => string]
 */
function validateWorkspaceContent($content) {
    // 必须是对象/数组
    if (!is_array($content)) {
        return ['valid' => false, 'message' => '工作区数据必须是 JSON 对象'];
    }

    // 必须包含 students 字段
    if (!isset($content['students'])) {
        return ['valid' => false, 'message' => '缺少必需字段: students'];
    }

    // 验证 students 是数组
    if (!is_array($content['students'])) {
        return ['valid' => false, 'message' => 'students 必须是数组'];
    }

    // 检测数据结构版本
    $isNewFormat = isset($content['layout']) && is_array($content['layout']);

    if ($isNewFormat) {
        // 新版格式：layout.seats 和 layout.config
        if (!isset($content['layout']['seats'])) {
            return ['valid' => false, 'message' => '缺少必需字段: layout.seats'];
        }
        if (!isset($content['layout']['config'])) {
            return ['valid' => false, 'message' => '缺少必需字段: layout.config'];
        }

        // 验证 layout.seats 是数组
        if (!is_array($content['layout']['seats'])) {
            return ['valid' => false, 'message' => 'layout.seats 必须是数组'];
        }

        // 验证 layout.config 是对象
        if (!is_array($content['layout']['config'])) {
            return ['valid' => false, 'message' => 'layout.config 必须是对象'];
        }

        // 验证 layout.config 包含 groups（可选，如果没有会由前端迁移补充）
        if (isset($content['layout']['config']['groups']) && !is_array($content['layout']['config']['groups'])) {
            return ['valid' => false, 'message' => 'layout.config.groups 必须是数组'];
        }

        // 验证每个 seat 的基本结构
        foreach ($content['layout']['seats'] as $seat) {
            if (!is_array($seat)) {
                return ['valid' => false, 'message' => '座位数据格式错误'];
            }
            if (!isset($seat['id'])) {
                return ['valid' => false, 'message' => '座位数据缺少必需字段 (id)'];
            }
        }
    } else {
        // 旧版格式：顶层 seats 和 seatConfig
        if (!isset($content['seats'])) {
            return ['valid' => false, 'message' => '缺少必需字段: seats'];
        }
        if (!isset($content['seatConfig'])) {
            return ['valid' => false, 'message' => '缺少必需字段: seatConfig'];
        }

        // 验证 seats 是数组
        if (!is_array($content['seats'])) {
            return ['valid' => false, 'message' => 'seats 必须是数组'];
        }

        // 验证 seatConfig 是对象
        if (!is_array($content['seatConfig'])) {
            return ['valid' => false, 'message' => 'seatConfig 必须是对象'];
        }

        // 验证 seatConfig 包含 groups（可选）
        if (isset($content['seatConfig']['groups']) && !is_array($content['seatConfig']['groups'])) {
            return ['valid' => false, 'message' => 'seatConfig.groups 必须是数组'];
        }

        // 验证每个 seat 的基本结构
        foreach ($content['seats'] as $seat) {
            if (!is_array($seat)) {
                return ['valid' => false, 'message' => '座位数据格式错误'];
            }
            if (!isset($seat['id'])) {
                return ['valid' => false, 'message' => '座位数据缺少必需字段 (id)'];
            }
        }
    }

    // 验证每个 student 的基本结构
    foreach ($content['students'] as $student) {
        if (!is_array($student)) {
            return ['valid' => false, 'message' => '学生数据格式错误'];
        }
        if (!isset($student['id']) || !isset($student['name'])) {
            return ['valid' => false, 'message' => '学生数据缺少必需字段 (id, name)'];
        }
    }

    return ['valid' => true, 'message' => ''];
}

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
$dbPermissions = new Database("file_permissions");
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

        // 验证工作区内容格式
        $validation = validateWorkspaceContent($content);
        if (!$validation['valid']) {
            respond(['success' => false, 'message' => '工作区格式无效: ' . $validation['message']]);
        }

        $fileId = isset($input['fileId']) && !empty($input['fileId']) ? $input['fileId'] : bin2hex(random_bytes(FILE_ID_BYTES));

        if (!isValidFileId($fileId)) {
            respond(['success' => false, 'message' => '文件ID格式无效']);
        }

        // 消毒文件 ID 用作数据库键名
        $sanitizedFileId = sanitizeDbKey($fileId);

        // 检查权限（通过权限表，避免冗余的文件读取）
        $permKey = sanitizeDbKey("perm_{$fileId}_{$username}");
        $existingPerm = $dbPermissions->get($permKey);

        if ($existingPerm !== null) {
            if (!hasFilePermission($dbPermissions, $fileId, $username, 'write')) {
                respond(['success' => false, 'message' => '无权限修改此文件'], 403);
            }
        } else {
            createFilePermission($dbPermissions, $fileId, $username, 'owner');
        }

        // 检查文件大小
        $contentSize = is_string($content) ? strlen($content) : strlen(json_encode($content));
        if ($contentSize > MAX_FILE_SIZE) {
            respond(['success' => false, 'message' => '文件大小超过限制（最大 5MB）']);
        }

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

        $dbFiles->set($sanitizedFileId, json_encode($fileData));

        // 消毒用户文件列表键名
        $userFilesKey = sanitizeDbKey($username . '_files');
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
        $fileIds = getUserAccessibleFiles($dbPermissions, $username);

        $list = [];
        if ($fileIds && is_array($fileIds)) {
            foreach ($fileIds as $fileId) {
                if (!isValidFileId($fileId)) continue;

                $sanitizedFileId = sanitizeDbKey($fileId);
                $fileRaw = $dbFiles->get($sanitizedFileId);
                if (!$fileRaw) continue;

                $fileData = json_decode($fileRaw, true);
                if (!$fileData || !isset($fileData['metadata'])) continue;

                $list[] = [
                    'fileId' => $fileId,
                    'metadata' => $fileData['metadata']
                ];
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

        if (!isValidFileId($fileId)) {
            respond(['success' => false, 'message' => '文件ID格式无效']);
        }

        // 检查读权限
        if (!hasFilePermission($dbPermissions, $fileId, $username, 'read')) {
            respond(['success' => false, 'message' => '无权访问该文件'], 403);
        }

        // 消毒文件 ID
        $sanitizedFileId = sanitizeDbKey($fileId);

        $fileRaw = $dbFiles->get($sanitizedFileId);
        if ($fileRaw === null) {
            respond(['success' => false, 'message' => '文件不存在或已被删除']);
        }

        $fileData = json_decode($fileRaw, true);
        if (!$fileData || !isset($fileData['metadata']) || !isset($fileData['content'])) {
             respond(['success' => false, 'message' => '文件格式损坏']);
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

         if (!isValidFileId($fileId)) {
             respond(['success' => false, 'message' => '文件ID格式无效']);
         }

         // 检查写权限
         if (!hasFilePermission($dbPermissions, $fileId, $username, 'write')) {
             respond(['success' => false, 'message' => '无权删除该文件'], 403);
         }

         // 消毒文件 ID
         $sanitizedFileId = sanitizeDbKey($fileId);

         $fileRaw = $dbFiles->get($sanitizedFileId);
         if ($fileRaw !== null) {
             $dbFiles->delete($sanitizedFileId);

             // 消毒用户文件列表键名
             $userFilesKey = sanitizeDbKey($username . '_files');
             $dbUsers->delete($userFilesKey, $fileId);

             // 删除权限记录
             revokeFilePermission($dbPermissions, $fileId, $username);

             respond(['success' => true, 'message' => '文件已删除']);
          } else {
              // 消毒用户文件列表键名
              $userFilesKey = sanitizeDbKey($username . '_files');
              $dbUsers->delete($userFilesKey, $fileId);

              // 删除权限记录
              revokeFilePermission($dbPermissions, $fileId, $username);

              respond(['success' => true, 'message' => '文件已被移除']);
          }
    } else {
        respond(['success' => false, 'message' => 'Unknown action'], 400);
    }

} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Internal Server Error'], 500);
}
?>