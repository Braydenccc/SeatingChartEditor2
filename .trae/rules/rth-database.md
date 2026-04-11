---
trigger: conditional
globs:
  - "public/api/**"
  - ".agents/retiehe_web_host/**"
  - "**/*.node.js"
---

# Retinbox KV 数据库

## 创建

PHP: `$db = new Database("name")` / JS: `const db = new Database("name")`
命名：仅字母/数字/_/-，区分大小写。

## 读写

PHP: $db->get / set / delete / list_keys
JS: await db.get / db.set(同步) / db.delete / await db.listKeys
值最大 65535 字符。

## 模糊查询

$db->search_value("%hello%") / await db.searchValue("%hello%")
SQL LIKE 语法，最多 1000 结果。

## 数组

push / get_array(getArray) / delete(key, value)

## 第三方 SQL

PHP 支持 mysqli 连外部 MySQL，推荐美西区域。