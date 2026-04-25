<?php
// 调试认证 API 问题
error_reporting(E_ALL);
ini_set('display_errors', '1');

echo "=== 认证 API 调试 ===\n\n";

// 1. 检查 Database 类是否可用
echo "1. 检查 Database 类:\n";
if (class_exists('Database')) {
    echo "   ✓ Database 类存在\n";
    try {
        $testDb = new Database('debug_test');
        echo "   ✓ Database 实例化成功\n";

        // 测试基本操作
        $testDb->set('test_key', 'test_value');
        $value = $testDb->get('test_key');
        if ($value === 'test_value') {
            echo "   ✓ Database 读写正常\n";
        } else {
            echo "   ✗ Database 读写异常: 期望 'test_value', 得到 '$value'\n";
        }
        $testDb->delete('test_key');
    } catch (Exception $e) {
        echo "   ✗ Database 操作失败: " . $e->getMessage() . "\n";
        echo "   Stack trace:\n" . $e->getTraceAsString() . "\n";
    }
} else {
    echo "   ✗ Database 类不存在（这在 Retinbox 平台上是异常的）\n";
}

echo "\n2. 检查 common.php 加载:\n";
try {
    require_once "api/common.php";
    echo "   ✓ common.php 加载成功\n";

    // 检查关键函数
    $functions = ['respond', 'isValidUsername', 'ensureCsrfMatched', 'isAuthorized', 'getClientIp', 'parseRequestInput'];
    foreach ($functions as $func) {
        if (function_exists($func)) {
            echo "   ✓ 函数 $func 存在\n";
        } else {
            echo "   ✗ 函数 $func 不存在\n";
        }
    }
} catch (Exception $e) {
    echo "   ✗ common.php 加载失败: " . $e->getMessage() . "\n";
    echo "   Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "\n3. 模拟注册请求:\n";
try {
    // 模拟 POST 数据
    $_POST = [
        'action' => 'register',
        'username' => 'testuser_' . time(),
        'password' => 'Test1234',
        '_csrf' => 'test_token'
    ];
    $_SERVER['HTTP_X_CSRF_TOKEN'] = 'test_token';
    $_SERVER['REMOTE_ADDR'] = '127.0.0.1';

    echo "   模拟数据已设置\n";
    echo "   POST: " . json_encode($_POST) . "\n";
    echo "   CSRF Header: " . $_SERVER['HTTP_X_CSRF_TOKEN'] . "\n";

    // 不实际执行 auth.php，而是检查关键步骤
    echo "\n   检查关键步骤:\n";

    // 检查 parseRequestInput
    $input = parseRequestInput();
    echo "   ✓ parseRequestInput 成功: " . json_encode($input) . "\n";

    // 检查 CSRF
    $csrfValid = ensureCsrfMatched($input);
    echo "   " . ($csrfValid ? "✓" : "✗") . " CSRF 验证: " . ($csrfValid ? "通过" : "失败") . "\n";

    // 检查用户名验证
    $usernameValid = isValidUsername($input['username']);
    echo "   " . ($usernameValid ? "✓" : "✗") . " 用户名验证: " . ($usernameValid ? "通过" : "失败") . "\n";

} catch (Exception $e) {
    echo "   ✗ 模拟请求失败: " . $e->getMessage() . "\n";
    echo "   Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "\n4. 检查 auth.php 文件:\n";
if (file_exists('api/auth.php')) {
    echo "   ✓ auth.php 文件存在\n";
    $content = file_get_contents('api/auth.php');
    echo "   文件大小: " . strlen($content) . " 字节\n";

    // 检查是否有语法错误
    $result = exec('php -l api/auth.php 2>&1', $output, $returnCode);
    if ($returnCode === 0) {
        echo "   ✓ PHP 语法检查通过\n";
    } else {
        echo "   ✗ PHP 语法错误:\n";
        foreach ($output as $line) {
            echo "     $line\n";
        }
    }
} else {
    echo "   ✗ auth.php 文件不存在\n";
}

echo "\n=== 调试完成 ===\n";
