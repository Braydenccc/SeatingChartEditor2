<?php
/**
 * 用户文件权限管理辅助函数
 *
 * 提供独立的权限表机制，不依赖文件元数据
 */

/**
 * 授予用户对文件的访问权限
 *
 * @param Database $permDb 权限数据库实例
 * @param string $fileId 文件 ID
 * @param string $username 用户名
 * @param string $permission 权限类型：'owner'（所有者）、'read'（只读）、'write'（读写）
 * @return bool 是否成功
 */
function grantFilePermission($permDb, $fileId, $username, $permission = 'owner') {
    if (!isValidUsername($username) || !isValidFileId($fileId)) {
        return false;
    }

    $permKey = sanitizeDbKey("perm_{$fileId}_{$username}");
    $permData = json_encode([
        'username' => $username,
        'fileId' => $fileId,
        'permission' => $permission,
        'grantedAt' => time()
    ]);

    return $permDb->set($permKey, $permData);
}

/**
 * 撤销用户对文件的访问权限
 *
 * @param Database $permDb 权限数据库实例
 * @param string $fileId 文件 ID
 * @param string $username 用户名
 * @return bool 是否成功
 */
function revokeFilePermission($permDb, $fileId, $username) {
    if (!isValidUsername($username) || !isValidFileId($fileId)) {
        return false;
    }

    $permKey = sanitizeDbKey("perm_{$fileId}_{$username}");
    return $permDb->delete($permKey);
}

/**
 * 检查用户是否有文件访问权限
 *
 * @param Database $permDb 权限数据库实例
 * @param string $fileId 文件 ID
 * @param string $username 用户名
 * @param string $requiredPermission 所需权限：'read' 或 'write'
 * @return bool 是否有权限
 */
function hasFilePermission($permDb, $fileId, $username, $requiredPermission = 'read') {
    if (!isValidUsername($username) || !isValidFileId($fileId)) {
        return false;
    }

    $permKey = sanitizeDbKey("perm_{$fileId}_{$username}");
    $permData = $permDb->get($permKey);

    if (!$permData) {
        return false;
    }

    $perm = json_decode($permData, true);
    if (!$perm || !isset($perm['permission'])) {
        return false;
    }

    // 权限层级：owner > write > read
    $permissionLevels = ['read' => 1, 'write' => 2, 'owner' => 3];
    $userLevel = $permissionLevels[$perm['permission']] ?? 0;
    $requiredLevel = $permissionLevels[$requiredPermission] ?? 0;

    return $userLevel >= $requiredLevel;
}

/**
 * 检查用户是否是文件所有者
 *
 * @param Database $permDb 权限数据库实例
 * @param string $fileId 文件 ID
 * @param string $username 用户名
 * @return bool 是否是所有者
 */
function isFileOwner($permDb, $fileId, $username) {
    if (!isValidUsername($username) || !isValidFileId($fileId)) {
        return false;
    }

    $permKey = sanitizeDbKey("perm_{$fileId}_{$username}");
    $permData = $permDb->get($permKey);

    if (!$permData) {
        return false;
    }

    $perm = json_decode($permData, true);
    return $perm && isset($perm['permission']) && $perm['permission'] === 'owner';
}

/**
 * 获取用户拥有的所有文件 ID
 *
 * @param Database $permDb 权限数据库实例
 * @param string $username 用户名
 * @return array 文件 ID 列表
 */
function getUserFiles($permDb, $username) {
    if (!isValidUsername($username)) {
        return [];
    }

    $allKeys = $permDb->list_keys();
    $fileIds = [];

    foreach ($allKeys as $key) {
        if (strpos($key, "perm_") !== 0) {
            continue;
        }

        $permData = $permDb->get($key);
        if (!$permData) {
            continue;
        }

        $perm = json_decode($permData, true);
        if (
            is_array($perm) &&
            isset($perm['username'], $perm['fileId']) &&
            $perm['username'] === $username &&
            isValidFileId($perm['fileId'])
        ) {
            $fileIds[] = $perm['fileId'];
        }
    }

    return array_values(array_unique($fileIds));
}

// Aliases for backward compatibility
function createFilePermission($permDb, $fileId, $username, $permission = 'owner') {
    return grantFilePermission($permDb, $fileId, $username, $permission);
}

function getUserAccessibleFiles($permDb, $username) {
    return getUserFiles($permDb, $username);
}

/**
 * 迁移旧数据：从元数据迁移到权限表
 *
 * @param Database $permDb 权限数据库实例
 * @param Database $dbFiles 文件数据库实例
 * @return array 迁移统计信息
 */
function migrateFilePermissions($permDb, $dbFiles) {
    $allKeys = $dbFiles->list_keys();
    $migrated = 0;
    $skipped = 0;

    foreach ($allKeys as $fileId) {
        if (!isValidFileId($fileId)) {
            $skipped++;
            continue;
        }

        $fileRaw = $dbFiles->get($fileId);
        if (!$fileRaw) {
            $skipped++;
            continue;
        }

        $fileData = json_decode($fileRaw, true);
        if (!$fileData || !isset($fileData['metadata']['author'])) {
            $skipped++;
            continue;
        }

        $author = $fileData['metadata']['author'];
        if (!isValidUsername($author)) {
            $skipped++;
            continue;
        }

        // 检查是否已有权限记录
        $permKey = sanitizeDbKey("perm_{$fileId}_{$author}");
        if ($permDb->get($permKey)) {
            $skipped++;
            continue;
        }

        // 创建权限记录
        if (grantFilePermission($permDb, $fileId, $author, 'owner')) {
            $migrated++;
        } else {
            $skipped++;
        }
    }

    return [
        'migrated' => $migrated,
        'skipped' => $skipped,
        'total' => count($allKeys)
    ];
}
?>
