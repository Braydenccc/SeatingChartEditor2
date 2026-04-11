---
trigger: conditional
globs:
  - "public/api/*.php"
  - ".agents/retiehe_web_host/assets/*.php"
---

# Retinbox PHP 云函数

.php 后缀作为 PHP 云函数执行，兼容常规 PHP（安装型 SDK 不支持）。

## 请求

GET: $_GET / POST: $_POST / Headers: $_SERVER / Cookies: $_COOKIE / Sessions: $_SESSION(需session_start) / IP: $_SERVER["REMOTE_ADDR"]

## 响应

echo / json_encode / http_response_code / header / setcookie / header("Location:...")

## 文件

file_get_contents / file_put_contents / scandir / json_decode+file_get_contents / file_put_contents+json_encode / move_uploaded_file

## 包含

require_once "utils.php" / 绝对路径: require_once "lib/utils.php"