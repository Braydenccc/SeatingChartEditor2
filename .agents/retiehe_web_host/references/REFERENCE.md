# 热铁盒云函数完整参考

本文档提供了热铁盒云函数的完整 API 参考。

## PHP 云函数参考

### 超全局变量

| 变量 | 说明 | 示例 |
| ---- | ---- | ---- |
| `$_GET` | URL 查询参数 | `$_GET["name"]` |
| `$_POST` | POST 请求体参数 | `$_POST["message"]` |
| `$_COOKIE` | Cookie | `$_COOKIE["sessionId"]` |
| `$_SESSION` | Session 数据 | `$_SESSION["username"]` |
| `$_SERVER` | 服务器和执行环境信息 | `$_SERVER["HTTP_HOST"]` |

### 常用 $_SERVER 键

| 键名 | 说明 |
| ---- | ---- |
| `REQUEST_METHOD` | 请求方法（GET、POST 等） |
| `QUERY_STRING` | 查询字符串 |
| `HTTP_HOST` | 主机名 |
| `HTTP_USER_AGENT` | 用户代理 |
| `HTTP_REFERER` | 来源网址 |
| `HTTP_ACCEPT_LANGUAGE` | 接受的语言 |
| `REMOTE_ADDR` | 访客 IP |
| `REQUEST_URI` | 请求 URI |
| `HTTPS` | 是否 HTTPS |

### 输出函数

| 函数 | 说明 |
| ---- | ---- |
| `echo` | 输出一个或多个字符串 |
| `print` | 输出一个字符串 |
| `var_dump` | 打印变量的详细信息 |
| `print_r` | 打印变量的可读信息 |

### HTTP 响应相关

| 函数 | 说明 | 示例 |
| ---- | ---- | ---- |
| `header()` | 设置响应头 | `header("Content-Type: application/json")` |
| `http_response_code()` | 设置响应状态码 | `http_response_code(404)` |
| `setcookie()` | 设置 Cookie | `setcookie("name", "value", time() + 3600)` |
| `exit` 或 `die` | 终止脚本执行 | `exit;` |

### Session 函数

| 函数 | 说明 |
| ---- | ---- |
| `session_start()` | 启动 Session |
| `session_destroy()` | 销毁 Session |
| `session_unset()` | 释放所有 Session 变量 |
| `session_regenerate_id()` | 重新生成 Session ID |

### 文件操作函数

| 函数 | 说明 |
| ---- | ---- |
| `file_get_contents()` | 读取文件内容 |
| `file_put_contents()` | 写入文件内容 |
| `file_exists()` | 检查文件是否存在 |
| `is_file()` | 判断是否为文件 |
| `is_dir()` | 判断是否为目录 |
| `scandir()` | 列出目录内容 |
| `unlink()` | 删除文件 |
| `json_encode()` | 将数组/对象编码为 JSON |
| `json_decode()` | 将 JSON 解码为数组/对象 |
| `disk_free_space()` | 获取磁盘剩余空间 |

### 引入文件

| 函数 | 说明 | 行为 |
| ---- | ---- | ---- |
| `include` | 引入文件 | 不存在时继续执行 |
| `include_once` | 引入文件（仅一次） | 不存在时继续执行 |
| `require` | 引入文件 | 不存在时报错停止 |
| `require_once` | 引入文件（仅一次） | 不存在时报错停止 |

### 数据库 API (Database 类)

| 方法 | 说明 | 返回值 |
| ---- | ---- | ------ |
| `__construct(string $name)` | 创建或打开数据库 | Database 实例 |
| `get(string $key)` | 获取键值 | string\|null |
| `set(string $key, string $value)` | 设置键值 | void |
| `delete(string $key)` | 删除键值 | void |
| `list_keys()` | 列出所有键 | array |
| `push(string $key, string $value)` | 向数组添加值 | void |
| `get_array(string $key)` | 获取数组 | array |
| `delete(string $key, string $value)` | 从数组删除指定值 | void |

### 字符串处理

| 函数 | 说明 |
| ---- | ---- |
| `strlen()` | 字符串长度 |
| `strpos()` | 查找子串位置 |
| `str_replace()` | 字符串替换 |
| `trim()` | 去除首尾空白 |
| `explode()` | 分割字符串为数组 |
| `implode()` | 连接数组为字符串 |
| `htmlspecialchars()` | HTML 特殊字符转义 |
| `urlencode()` | URL 编码 |
| `urldecode()` | URL 解码 |

### 数组处理

| 函数 | 说明 |
| ---- | ---- |
| `count()` | 数组元素个数 |
| `in_array()` | 检查值是否在数组中 |
| `array_push()` | 向数组末尾添加元素 |
| `array_pop()` | 弹出数组末尾元素 |
| `array_merge()` | 合并数组 |
| `array_keys()` | 获取所有键 |
| `array_values()` | 获取所有值 |
| `sort()` | 排序数组 |
| `isset()` | 检查变量是否设置 |
| `empty()` | 检查变量是否为空 |

### 日期时间

| 函数 | 说明 |
| ---- | ---- |
| `time()` | 当前时间戳 |
| `date()` | 格式化日期 |
| `strtotime()` | 将字符串解析为时间戳 |
| `sleep()` | 延迟执行 |

## Node.js 云函数参考

### 全局对象

| 对象 | 说明 |
| ---- | ---- |
| `req` | 请求对象（Express 风格） |
| `res` | 响应对象（Express 风格） |
| `document` | 文档对象（浏览器风格） |
| `window` | 窗口对象（浏览器风格） |
| `navigator` | 导航器对象（浏览器风格） |
| `location` | 位置对象（浏览器风格） |
| `console` | 控制台对象 |
| `process` | 进程对象 |
| `fs` | 文件系统对象 |
| `os` | 操作系统对象 |
| `crypto` | 加密对象 |
| `path` | 路径对象 |
| `querystring` | 查询字符串对象 |

### req 对象属性

| 属性 | 说明 | 示例 |
| ---- | ---- | ---- |
| `req.query` | URL 查询参数 | `req.query.name` |
| `req.body` | POST 请求体 | `req.body.message` |
| `req.headers` | 请求头 | `req.headers["user-agent"]` |
| `req.cookies` | Cookie | `req.cookies.sessionId` |
| `req.method` | 请求方法 (GET/POST) | - |
| `req.url` | 完整 URL | - |
| `req.ip` | 访客 IP | - |

### res 对象方法

| 方法 | 说明 | 示例 |
| ---- | ---- | ---- |
| `res.write(string)` | 写入响应内容 | `res.write("Hello")` |
| `res.end(string)` | 结束响应并返回 | `res.end("Done")` |
| `res.send(string)` | 同 `res.end()` | - |
| `res.json(object)` | 返回 JSON | `res.json({data: "ok"})` |
| `res.status(code)` | 设置状态码 | `res.status(404)` |
| `res.setHeader(name, value)` | 设置响应头 | `res.setHeader("Content-Type", "application/json")` |
| `res.cookie(name, value, options)` | 设置 Cookie | `res.cookie("name", "value", {maxAge: 3600000})` |
| `res.redirect(url)` | 重定向 | `res.redirect("https://example.com")` |
| `res.redirect(code, url)` | 带状态码重定向 | `res.redirect(301, "/new-url")` |

### document 对象

| 属性/方法 | 说明 |
| ----------- | ---- |
| `document.write(string)` | 写入响应内容 |
| `document.referrer` | 来源网址 |

### location 对象

| 属性 | 说明 |
| ---- | ---- |
| `location.href` | 完整 URL |
| `location.search` | 查询字符串 |

### navigator 对象

| 属性 | 说明 |
| ---- | ---- |
| `navigator.userAgent` | 用户代理 |

### fs 对象方法 (同步)

| 方法 | 说明 |
| ---- | ---- |
| `fs.readFileSync(path)` | 读取文件 |
| `fs.writeFileSync(path, data)` | 写入文件 |
| `fs.existsSync(path)` | 检查文件是否存在 |
| `fs.readdirSync(path)` | 列出目录 |
| `fs.unlinkSync(path)` | 删除文件 |
| `fs.mkdirSync(path)` | 创建目录 |
| `fs.rmdirSync(path)` | 删除目录 |

### localStorage 对象

| 方法 | 说明 |
| ---- | ---- |
| `localStorage.getItem(key)` | 获取值 |
| `localStorage.setItem(key, value)` | 设置值 |
| `localStorage.removeItem(key)` | 删除值 |

### process 对象

| 方法/属性 | 说明 |
| ---- | ---- |
| `process.exit()` | 退出程序 |
| `process.env` | 环境变量 |

### os 对象

| 方法 | 说明 |
| ---- | ---- |
| `os.diskFreeSpace()` | 获取剩余空间 |

### crypto 对象

| 方法 | 说明 |
| ---- | ---- |
| `crypto.createHash(algorithm)` | 创建哈希对象 |
| `crypto.createHmac(algorithm, key)` | 创建 HMAC 对象 |

### Node.js 数据库 API (Database 类)

| 方法 | 说明 | 返回值 |
| ---- | ---- | ------ |
| `constructor(string name)` | 创建或打开数据库 | Database 实例 |
| `get(string key)` | 获取键值（异步） | Promise&lt;string&gt; |
| `set(string key, string value)` | 设置键值（同步） | void |
| `delete(string key)` | 删除键值（同步） | void |
| `listKeys()` | 列出所有键（异步） | Promise&lt;string[]&gt; |
| `push(string key, string value)` | 向数组添加值（同步） | void |
| `getArray(string key)` | 获取数组（异步） | Promise&lt;string[]&gt; |

### JSON 处理

| 方法 | 说明 |
| ---- | ---- |
| `JSON.stringify(object)` | 对象转 JSON 字符串 |
| `JSON.parse(string)` | JSON 字符串转对象 |

### require 函数

| 用途 | 示例 |
| ---- | ---- |
| 引入 Node.js 模块 | `const fs = require("fs")` |
| 引入本地文件 | `const utils = require("lib/utils.node.js")` |
| 引入 JSON 文件 | `const config = require("config.json")` |

## 常用代码片段

### PHP 代码片段

**基础响应:**

```php
<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");

$data = [
    "status" => "success",
    "message" => "操作成功"
];

echo json_encode($data);
```

**错误处理:**

```php
<?php
function sendError($code, $message) {
    http_response_code($code);
    header("Content-Type: application/json");
    echo json_encode(["error" => $message]);
    exit;
}

if (!isset($_GET["id"])) {
    sendError(400, "缺少 id 参数");
}
```

**数据库封装:**

```php
<?php
class DBHelper {
    private $db;

    public function __construct($dbName) {
        $this->db = new Database($dbName);
    }

    public function get($key) {
        return $this->db->get($key);
    }

    public function set($key, $value) {
        $this->db->set($key, $value);
    }

    public function delete($key) {
        $this->db->delete($key);
    }

    public function listAll() {
        $keys = $this->db->list_keys();
        $result = [];
        foreach ($keys as $key) {
            $result[$key] = $this->db->get($key);
        }
        return $result;
    }
}
```

### Node.js 代码片段

**基础响应:**

```javascript
res.setHeader("Content-Type", "application/json; charset=utf-8");
res.setHeader("Access-Control-Allow-Origin", "*");

const data = {
    status: "success",
    message: "操作成功"
};

res.json(data);
```

**错误处理:**

```javascript
function sendError(code, message) {
    res.status(code);
    res.setHeader("Content-Type", "application/json");
    res.json({ error: message });
}

if (!req.query.id) {
    sendError(400, "缺少 id 参数");
}
```

**数据库封装:**

```javascript
class DBHelper {
    constructor(dbName) {
        this.db = new Database(dbName);
    }

    async get(key) {
        return await this.db.get(key);
    }

    set(key, value) {
        this.db.set(key, value);
    }

    delete(key) {
        this.db.delete(key);
    }

    async listAll() {
        const keys = await this.db.listKeys();
        const result = {};
        for (const key of keys) {
            result[key] = await this.db.get(key);
        }
        return result;
    }
}
```

## 常见状态码

| 状态码 | 含义 | 使用场景 |
| ------ | ---- | -------- |
| 200 | OK | 请求成功 |
| 201 | Created | 创建成功 |
| 204 | No Content | 成功但无返回内容 |
| 301 | Moved Permanently | 永久重定向 |
| 302 | Found | 临时重定向 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未授权 |
| 403 | Forbidden | 禁止访问 |
| 404 | Not Found | 资源不存在 |
| 405 | Method Not Allowed | 请求方法不允许 |
| 500 | Internal Server Error | 服务器内部错误 |
