import fs from 'fs';
import { execSync } from 'child_process';

try {
  // 解决 GitHub Actions 容器环境下的 git 目录所有权安全限制
  try {
    execSync("git config --global --add safe.directory '*'");
  } catch (e) {
    // Ignore errors if this fails (e.g. locally without perms)
  }

  const commitSha = execSync('git log -1 --format=%h').toString().trim();
  const commitMsg = execSync('git log -1 --format=%s').toString().trim().substring(0, 40);

  console.log(`Patching test env with commit: ${commitSha}`);

  // 1. index.html
  let indexHtml = fs.readFileSync('index.html', 'utf8');
  indexHtml = indexHtml.replace('<title>座位表编辑器-scev2byccc</title>', '<title>[测试版] 座位表编辑器-scev2byccc</title>');
  fs.writeFileSync('index.html', indexHtml);

  // 2. LoginDialog.vue
  const loginPath = 'src/components/auth/LoginDialog.vue';
  let loginVue = fs.readFileSync(loginPath, 'utf8');
  loginVue = loginVue.replace(
    '本账号服务不保证可用性，请妥善备份您的数据',
    '⚠️ 测试环境：账号与正式版不互通，用户数据可能随时被清除，请勿使用真实账号'
  );
  fs.writeFileSync(loginPath, loginVue);

  // 3. AppHeader.vue
  const headerPath = 'src/components/layout/AppHeader.vue';
  let appHeader = fs.readFileSync(headerPath, 'utf8');
  const badgeHtml = `<span class="commit-badge">${commitSha} ${commitMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
  appHeader = appHeader.replace(
    '<h1 class="header-text">BraydenSCE V2</h1>',
    `<h1 class="header-text">\n        BraydenSCE V2\n        ${badgeHtml}\n      </h1>`
  );
  if (!appHeader.includes('.commit-badge')) {
    appHeader = appHeader.replace(
      '</style>',
      `.commit-badge { display: inline-block; font-size: 11px; font-weight: 400; font-family: monospace; background: rgba(255,255,255,0.18); color: rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; padding: 2px 8px; margin-left: 10px; vertical-align: middle; max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n</style>`
    );
  }
  fs.writeFileSync(headerPath, appHeader);
  
  console.log('Successfully patched files for test environment.');
} catch (e) {
  console.error('Failed to patch test environment notices:', e);
  process.exit(1);
}
