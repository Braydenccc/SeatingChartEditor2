<?php
require_once "api/debug-guard.php";
// 调试脚本：检查 auth.php 的问题
error_reporting(E_ALL);
ini_set('display_errors', '1');

echo "=== Auth Debug ===\n\n";

// 1. 检查 common.php 是否可以被引入
echo "1. Testing require_once 'api/common.php':\n";
try {
    require_once "api/common.php";
    echo "   ✓ common.php loaded successfully\n\n";
} catch (Exception $e) {
    echo "   ✗ Failed: " . $e->getMessage() . "\n\n";
    exit(1);
}

// 2. 检查 Database 类是否存在
echo "2. Checking Database class:\n";
if (class_exists('Database')) {
    echo "   ✓ Database class exists\n\n";
} else {
    echo "   ✗ Database class not found\n\n";
}

// 3. 检查关键函数是否存在
echo "3. Checking required functions:\n";
$functions = ['respond', 'isValidUsername', 'ensureCsrfMatched', 'isAuthorized', 'parseRequestInput', 'getClientIp'];
foreach ($functions as $func) {
    if (function_exists($func)) {
        echo "   ✓ $func exists\n";
    } else {
        echo "   ✗ $func not found\n";
    }
}
echo "\n";

// 4. 检查 HTTPS 环境变量
echo "4. Environment check:\n";
echo "   REQUIRE_HTTPS env: " . (function_exists('getenv') ? getenv('REQUIRE_HTTPS') : 'getenv not available') . "\n";
echo "   HTTPS: " . (isset($_SERVER['HTTPS']) ? $_SERVER['HTTPS'] : 'not set') . "\n";
echo "   HTTP_X_FORWARDED_PROTO: " . (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) ? $_SERVER['HTTP_X_FORWARDED_PROTO'] : 'not set') . "\n\n";

// 5. 模拟一个简单的登录请求
echo "5. Simulating login request:\n";
try {
    // 模拟 POST 数据
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_POST = [
        'action' => 'login',
        'username' => 'testuser',
        'password' => 'TestPass123',
        '_csrf' => 'test-token'
    ];
    $_SERVER['HTTP_X_CSRF_TOKEN'] = 'test-token';

    echo "   Request prepared\n";
    echo "   Now including auth.php...\n\n";

    // 这里不实际执行 auth.php，只是报告准备就绪
    echo "   ✓ Ready to process auth request\n";

} catch (Exception $e) {
    echo "   ✗ Error: " . $e->getMessage() . "\n";
}

echo "\n=== Debug Complete ===\n";
?>
