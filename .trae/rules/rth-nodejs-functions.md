---
trigger: conditional
globs:
  - ".agents/retiehe_web_host/assets/*.node.js"
  - "**/*.node.js"
---

# Retinbox Node.js 云函数

.node.js 后缀作为 Node.js 云函数，req/res 为全局变量。

## 请求

Query: req.query / POST: req.body / Headers: req.headers / Cookies: req.cookies / IP: req.ip / Method: req.method

## 响应

document.write() / console.log() / res.write() / res.end() / res.send() / res.json() / res.status() / res.setHeader() / res.cookie() / res.redirect()

## 文件（全局 fs，仅同步）

fs.readFileSync / fs.writeFileSync / fs.existsSync / fs.readdirSync

## 模块

CommonJS require / module.exports / **不支持第三方 npm 库**
内置：crypto / fs / os / path / process / querystring