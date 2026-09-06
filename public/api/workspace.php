<?php
require_once "api/common.php";
require_once "api/file-permissions.php";
header('Content-Type: application/json; charset=utf-8');

if (!class_exists('Database')) {
    respond(['success' => false, 'message' => 'Environment error: Database not supported.']);
}

const FILE_ID_BYTES = 16;
const MAX_WORKSPACE_DB_VALUE_BYTES = 60000;
const MAX_WORKSPACE_DB_VALUE_CHARS = 60000;

function workspaceDbValueFitsStorage($encodedValue) {
    if (!is_string($encodedValue)) {
        return false;
    }

    $encodedBytes = strlen($encodedValue);
    $encodedCharacters = function_exists('mb_strlen') ? mb_strlen($encodedValue, 'UTF-8') : $encodedBytes;
    return $encodedBytes <= MAX_WORKSPACE_DB_VALUE_BYTES && $encodedCharacters <= MAX_WORKSPACE_DB_VALUE_CHARS;
}

function generateWorkspaceFileId($dbFiles) {
    for ($attempt = 0; $attempt < 16; $attempt++) {
        $candidate = bin2hex(random_bytes(FILE_ID_BYTES));
        if ($dbFiles->get(sanitizeDbKey($candidate)) === null) {
            return $candidate;
        }
    }
    return null;
}

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

    // tags 是客户端恢复工作区时的必需字段，服务端必须使用同一入口契约
    if (!isset($content['tags'])) {
        return ['valid' => false, 'message' => '缺少必需字段: tags'];
    }
    if (!is_array($content['tags'])) {
        return ['valid' => false, 'message' => 'tags 必须是数组'];
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

    foreach ($content['tags'] as $tag) {
        if (!is_array($tag)) {
            return ['valid' => false, 'message' => '标签数据格式错误'];
        }
        if (!isset($tag['id']) || !isset($tag['name']) || !isset($tag['color'])) {
            return ['valid' => false, 'message' => '标签数据缺少必需字段 (id, name, color)'];
        }
    }

    return ['valid' => true, 'message' => ''];
}

/**
 * PHP 的关联数组解码无法区分空对象和空数组；工作区中的数值属性
 * 约定为空对象，写回或返回时需要恢复该 JSON 形态。
 */
function normalizeWorkspaceNumericAttributes($content) {
    if (!is_array($content) || !isset($content['students']) || !is_array($content['students'])) {
        return $content;
    }

    foreach ($content['students'] as $index => $student) {
        if (!is_array($student) || !array_key_exists('numericAttributes', $student)) {
            continue;
        }

        if ($student['numericAttributes'] === null || (
            is_array($student['numericAttributes']) && count($student['numericAttributes']) === 0
        )) {
            $content['students'][$index]['numericAttributes'] = new stdClass();
        }
    }

    return $content;
}

function isWorkspaceDeleted($fileData) {
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
            return in_array('deleted', $fileData['metadata']['tags']);
        }
    }

    return false;
}

$input = parseRequestInput();

$action = $input['action'];

if (!ensureCsrfMatched($input)) {
    respond(['success' => false, 'message' => 'CSRF 校验失败'], 403);
}

$dbUsers = new Database("users");
$dbFiles = new Database("scefiles");
$dbPermissions = new Database("file_permissions");
$sessionDb = new Database("users_sessions");
$username = requireAuthenticatedUsername($sessionDb);

try {
    if ($action === 'save') {
        $name = isset($input['name']) ? trim($input['name']) : '未命名工作区';
        $content = isset($input['content']) ? $input['content'] : '';

        if (empty($content)) {
            respond(['success' => false, 'message' => '工作区内容不能为空']);
        }

        $nameLength = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);
        if ($name === '' || $nameLength > 50) {
            respond(['success' => false, 'message' => '工作区名称不能为空且不能超过 50 个字符']);
        }

        // 验证工作区内容格式
        $validation = validateWorkspaceContent($content);
        if (!$validation['valid']) {
            respond(['success' => false, 'message' => '工作区格式无效: ' . $validation['message']]);
        }

        $content = normalizeWorkspaceNumericAttributes($content);

        $hasRequestedFileId = array_key_exists('fileId', $input) && $input['fileId'] !== null && $input['fileId'] !== '';
        $requestedFileId = $hasRequestedFileId && is_string($input['fileId']) ? trim($input['fileId']) : null;
        if ($hasRequestedFileId && !isValidFileId($requestedFileId)) {
            respond(['success' => false, 'message' => '文件ID格式无效']);
        }

        $existingFileRaw = $requestedFileId !== null
            ? $dbFiles->get(sanitizeDbKey($requestedFileId))
            : null;
        $fileId = $existingFileRaw !== null
            ? $requestedFileId
            : generateWorkspaceFileId($dbFiles);
        if ($fileId === null) {
            respond(['success' => false, 'message' => '无法生成工作区文件ID，请重试'], 503);
        }

        // 只有实际存在的工作区允许沿用客户端提供的 ID；新建 ID 始终由服务端生成。
        $sanitizedFileId = sanitizeDbKey($fileId);
        $existingFileData = null;
        if ($existingFileRaw !== null) {
            $existingFileData = json_decode($existingFileRaw, true);
            if (isWorkspaceDeleted($existingFileData)) {
                respond(['success' => false, 'message' => '工作区已被删除，不能继续操作']);
            }
        }

        // 检查权限（通过权限表，避免冗余的文件读取）
        $existingPerm = getFilePermissionRecord($dbPermissions, $fileId, $username);
        $createdPermission = false;

        if ($existingPerm !== null) {
            if (!hasFilePermission($dbPermissions, $fileId, $username, 'write')) {
                respond(['success' => false, 'message' => '无权限修改此文件'], 403);
            }
        } elseif ($existingFileRaw !== null) {
            if (
                is_array($existingFileData) &&
                isset($existingFileData['metadata']['author']) &&
                $existingFileData['metadata']['author'] === $username
            ) {
                if (!grantFilePermission($dbPermissions, $fileId, $username, 'owner')) {
                    respond(['success' => false, 'message' => '无法更新工作区权限记录'], 503);
                }
            } else {
                respond(['success' => false, 'message' => '无权限修改此文件'], 403);
            }
        } else {
            if (!createFilePermission($dbPermissions, $fileId, $username, 'owner')) {
                respond(['success' => false, 'message' => '无法创建工作区权限记录'], 503);
            }
            $createdPermission = true;
        }

        $contentJson = json_encode($content, JSON_UNESCAPED_UNICODE);
        if (!is_string($contentJson)) {
            if ($createdPermission) revokeFilePermission($dbPermissions, $fileId, $username);
            respond(['success' => false, 'message' => '工作区内容无法编码']);
        }
        $contentSize = strlen($contentJson);

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

        $encodedFileData = json_encode($fileData, JSON_UNESCAPED_UNICODE);
        if (!is_string($encodedFileData)) {
            if ($createdPermission) revokeFilePermission($dbPermissions, $fileId, $username);
            respond(['success' => false, 'message' => '工作区数据无法编码']);
        }

        if (!workspaceDbValueFitsStorage($encodedFileData)) {
            if ($createdPermission) revokeFilePermission($dbPermissions, $fileId, $username);
            respond(['success' => false, 'message' => '云工作区超过安全存储上限（编码后最大 60000 字节/字符），请导出本地文件或精简内容'], 413);
        }

        if (!databaseSetVerified($dbFiles, $sanitizedFileId, $encodedFileData)) {
            if ($createdPermission) revokeFilePermission($dbPermissions, $fileId, $username);
            respond(['success' => false, 'message' => '工作区写入失败，未确认保存成功'], 503);
        }

        // 消毒用户文件列表键名
        $userFilesKey = sanitizeDbKey($username . '_files');
        $indexWarning = null;
        try {
            $existingFiles = $dbUsers->get_array($userFilesKey);
            if (!is_array($existingFiles)) {
                $existingFiles = [];
            }

            if (!in_array($fileId, $existingFiles, true) && !databasePushVerified($dbUsers, $userFilesKey, $fileId)) {
                $indexWarning = '工作区已保存，但兼容文件列表索引暂未更新';
                error_log("Workspace user_files index update failed for {$username}/{$fileId}");
            }
        } catch (Throwable $error) {
            $indexWarning = '工作区已保存，但兼容文件列表索引暂未更新';
            $safeError = sanitizeSingleLineLogText($error->getMessage(), 512);
            error_log("Workspace user_files index update failed for {$username}/{$fileId}: {$safeError}");
        }

        respond([
            'success' => true,
            'message' => $indexWarning ?: '保存成功',
            'data' => [
                'fileId' => $fileId,
                'metadata' => $metadata,
                'indexWarning' => $indexWarning
            ]
        ]);

    } elseif ($action === 'list') {
        $userFilesKey = sanitizeDbKey($username . '_files');
        $legacyFileIds = $dbUsers->get_array($userFilesKey);
        if (!$legacyFileIds || !is_array($legacyFileIds)) {
            $legacyFileIds = [];
        }
        $permissionFileIds = getUserAccessibleFiles($dbPermissions, $username);
        $fileIds = array_values(array_unique(array_merge($permissionFileIds ?: [], $legacyFileIds)));

        $list = [];
        if ($fileIds && is_array($fileIds)) {
            foreach ($fileIds as $fileId) {
                if (!isValidFileId($fileId)) continue;

                $sanitizedFileId = sanitizeDbKey($fileId);
                $fileRaw = $dbFiles->get($sanitizedFileId);
                if (!$fileRaw) continue;

                $fileData = json_decode($fileRaw, true);
                if (!$fileData || !isset($fileData['metadata'])) continue;
                if (isWorkspaceDeleted($fileData)) continue;

                // 兼容旧数据：自动迁移权限记录
                if (getFilePermissionRecord($dbPermissions, $fileId, $username) === null) {
                    // 检查文件作者是否是当前用户
                    if (isset($fileData['metadata']['author']) && $fileData['metadata']['author'] === $username) {
                        grantFilePermission($dbPermissions, $fileId, $username, 'owner');
                    }
                }

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

    } elseif ($action === 'rename') {
        $fileId = isset($input['fileId']) ? trim($input['fileId']) : null;
        $name = isset($input['name']) ? trim($input['name']) : '';

        if (!$fileId) {
            respond(['success' => false, 'message' => '缺少 fileId']);
        }

        if (!isValidFileId($fileId)) {
            respond(['success' => false, 'message' => '文件ID格式无效']);
        }

        if ($name === '') {
            respond(['success' => false, 'message' => '工作区名称不能为空']);
        }

        $nameLength = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);
        if ($nameLength > 50) {
            respond(['success' => false, 'message' => '工作区名称不能超过 50 个字符']);
        }

        $sanitizedFileId = sanitizeDbKey($fileId);
        $fileRaw = $dbFiles->get($sanitizedFileId);
        if ($fileRaw === null) {
            respond(['success' => false, 'message' => '文件不存在或已被删除']);
        }

        $fileData = json_decode($fileRaw, true);
        if (!$fileData || !isset($fileData['metadata']) || !isset($fileData['content'])) {
            respond(['success' => false, 'message' => '文件格式损坏']);
        }

        if (isWorkspaceDeleted($fileData)) {
            respond(['success' => false, 'message' => '工作区已被删除，不能继续操作']);
        }

        if (getFilePermissionRecord($dbPermissions, $fileId, $username) === null) {
            if (isset($fileData['metadata']['author']) && $fileData['metadata']['author'] === $username) {
                if (!grantFilePermission($dbPermissions, $fileId, $username, 'owner')) {
                    respond(['success' => false, 'message' => '无法更新工作区权限记录'], 503);
                }
            } else {
                respond(['success' => false, 'message' => '无权限修改此文件'], 403);
            }
        } elseif (!hasFilePermission($dbPermissions, $fileId, $username, 'write')) {
            respond(['success' => false, 'message' => '无权限修改此文件'], 403);
        }

        $fileData['metadata']['name'] = $name;
        $fileData['content'] = normalizeWorkspaceNumericAttributes($fileData['content']);
        $encodedFileData = json_encode($fileData, JSON_UNESCAPED_UNICODE);
        if (!workspaceDbValueFitsStorage($encodedFileData) || !databaseSetVerified($dbFiles, $sanitizedFileId, $encodedFileData)) {
            respond(['success' => false, 'message' => '工作区名称写入失败'], 503);
        }

        $userFilesKey = sanitizeDbKey($username . '_files');
        $indexWarning = null;
        try {
            $existingFiles = $dbUsers->get_array($userFilesKey);
            if (!is_array($existingFiles)) {
                $existingFiles = [];
            }

            if (!in_array($fileId, $existingFiles, true) && !databasePushVerified($dbUsers, $userFilesKey, $fileId)) {
                $indexWarning = '工作区名称已更新，但兼容文件列表索引暂未更新';
                error_log("Workspace rename user_files index update failed for {$username}/{$fileId}");
            }
        } catch (Throwable $error) {
            $indexWarning = '工作区名称已更新，但兼容文件列表索引暂未更新';
            $safeError = sanitizeSingleLineLogText($error->getMessage(), 512);
            error_log("Workspace rename user_files index update failed for {$username}/{$fileId}: {$safeError}");
        }

        respond([
            'success' => true,
            'message' => $indexWarning ?: '工作区名称已更新',
            'data' => [
                'fileId' => $fileId,
                'metadata' => $fileData['metadata'],
                'indexWarning' => $indexWarning
            ]
        ]);

    } elseif ($action === 'load') {
        $fileId = isset($input['fileId']) ? trim($input['fileId']) : null;
        if (!$fileId) {
            respond(['success' => false, 'message' => '缺少 fileId']);
        }

        if (!isValidFileId($fileId)) {
            respond(['success' => false, 'message' => '文件ID格式无效']);
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

        if (isWorkspaceDeleted($fileData)) {
            respond(['success' => false, 'message' => '文件不存在或已被删除']);
        }

        // 检查读权限（兼容旧数据：如果没有权限记录，检查文件作者）
        if (getFilePermissionRecord($dbPermissions, $fileId, $username) === null) {
            // 没有权限记录，检查文件作者
            if (isset($fileData['metadata']['author']) && $fileData['metadata']['author'] === $username) {
                // 自动迁移：创建权限记录
                grantFilePermission($dbPermissions, $fileId, $username, 'owner');
            } else {
                respond(['success' => false, 'message' => '无权访问该文件'], 403);
            }
        } elseif (!hasFilePermission($dbPermissions, $fileId, $username, 'read')) {
            respond(['success' => false, 'message' => '无权访问该文件'], 403);
        }

        $fileData['content'] = normalizeWorkspaceNumericAttributes($fileData['content']);
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

         $sanitizedFileId = sanitizeDbKey($fileId);
         $fileRaw = $dbFiles->get($sanitizedFileId);
         if ($fileRaw === null) {
             respond(['success' => true, 'message' => '工作区已被忽略']);
         }

         $fileData = json_decode($fileRaw, true);
         if (!$fileData || !isset($fileData['metadata']) || !isset($fileData['content'])) {
             respond(['success' => false, 'message' => '文件格式损坏']);
         }

         if (isWorkspaceDeleted($fileData)) {
             respond(['success' => true, 'message' => '工作区已标记删除']);
         }

        if (getFilePermissionRecord($dbPermissions, $fileId, $username) === null) {
            if (isset($fileData['metadata']['author']) && $fileData['metadata']['author'] === $username) {
                if (!grantFilePermission($dbPermissions, $fileId, $username, 'owner')) {
                    respond(['success' => false, 'message' => '无法更新工作区权限记录'], 503);
                }
             } else {
                 respond(['success' => false, 'message' => '无权删除该文件'], 403);
             }
         } elseif (!hasFilePermission($dbPermissions, $fileId, $username, 'write')) {
             respond(['success' => false, 'message' => '无权删除该文件'], 403);
         }

         if (!isset($fileData['metadata']['tags']) || !is_array($fileData['metadata']['tags'])) {
             $fileData['metadata']['tags'] = [];
         }

         if (!in_array('deleted', $fileData['metadata']['tags'])) {
             $fileData['metadata']['tags'][] = 'deleted';
         }

         $fileData['metadata']['deleted'] = true;
         $fileData['metadata']['deletedAt'] = date('c');
         $encodedFileData = json_encode($fileData, JSON_UNESCAPED_UNICODE);
         if (!workspaceDbValueFitsStorage($encodedFileData) || !databaseSetVerified($dbFiles, $sanitizedFileId, $encodedFileData)) {
             respond(['success' => false, 'message' => '工作区删除标记写入失败'], 503);
         }

         respond(['success' => true, 'message' => '工作区已标记删除']);
    } else {
        respond(['success' => false, 'message' => 'Unknown action'], 400);
    }

} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Internal Server Error'], 500);
}
?>
