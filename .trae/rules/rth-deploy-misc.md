---
trigger: conditional
globs:
  - "scripts/deploy-*"
  - ".github/workflows/deploy.yml"
  - "package.json"
  - "rth-cli.js"
---

# Retinbox 部署与杂项

## 自动部署

npm run deploy 一键部署。需 RTH_API_KEY 环境变量（勿提交 Git）。
CLI：--site(域名) / --build(构建命令) / --outdir(输出目录)

## Git 自动部署

仓库 Secrets 设 RTH_API_KEY：GitHub(Settings→Secrets→Actions) / GitLab(CI/CD→Variables) / Gitee(Pipeline→Variables)

## 文件路径

- 绝对路径从网站根目录，省略前导 /
- 如 databases/data.txt（非 /databases/data.txt）
- 适用于读写文件、require/include

## 禁止 Base64

项目任何地方不用 Base64，本地图片用 URL.createObjectURL()