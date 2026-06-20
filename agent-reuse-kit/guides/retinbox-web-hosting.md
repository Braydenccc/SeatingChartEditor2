# Retinbox Web Hosting 经验

如果新项目也使用 Retinbox Web Hosting，可以复制本文件。否则不要把这些平台规则放进通用 `AGENTS.md`，以免误导 agent。

## 关键规则

- PHP 云函数扩展名使用 `.php`。
- Node.js 云函数扩展名使用 `.node.js`。
- PHP 文件引用使用从网站根目录开始的相对路径，省略开头 `/`。
- 不使用 `__DIR__` 拼接云函数引用路径。
- 数据库使用 Retinbox 内置 KV：`new Database("db_name")`。
- 不在文档或流程中引用不存在的测试环境部署命令。

## PHP 示例

```php
<?php
require_once "api/common.php";

$db = new Database("app_data");
$value = $db->get("key");

header("Content-Type: application/json");
echo json_encode(["value" => $value], JSON_UNESCAPED_UNICODE);
```

## Node.js 示例

```javascript
const db = new Database("app_data");
const value = await db.get("key");

res.json({ value });
```

## 数据存储建议

| 场景 | 推荐 |
| --- | --- |
| 少量配置 | JSON 文件 |
| 用户数据 | KV 数据库 |
| 临时登录态 | Session 或 Cookie |
| 大量键值数据 | KV 数据库 |
| 第三方结构化查询 | PHP 连接外部 SQL 数据库 |

## 安全建议

- 对用户输入做校验和过滤。
- PHP 输出 HTML 时使用 `htmlspecialchars()`。
- 不在代码中暴露密码或密钥。
- 验证请求来源和登录态。
- 合理设置缓存头，避免敏感响应被缓存。

## 调试提醒

- 路径问题优先检查是否错误使用了相对路径、`../` 或 `__DIR__`。
- PHP 的 `session_start()` 必须在任何输出前调用。
- 文件总大小限制较小时，大量数据应进入数据库。
- Node.js 云函数不要假设可以安装 npm 依赖。

