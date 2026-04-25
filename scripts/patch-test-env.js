import fs from 'fs';
import { execSync } from 'child_process';

const TEST_HOST = 'https://test.sce.jbyc.cc';

try {
  // 解决 GitHub Actions 容器环境下的 git 目录所有权安全限制
  try {
    execSync("git config --global --add safe.directory '*'");
  } catch (e) {
    // Ignore errors if this fails (e.g. locally without perms)
  }

  console.log('Patching test environment markers');

  // 1. index.html - 添加 [test] 前缀到标题
  let indexHtml = fs.readFileSync('index.html', 'utf8');
  indexHtml = indexHtml.replace(/(<title(?:\s[^>]*)?>)([\s\S]*?)(<\/title>)/, (_, openTag, title, closeTag) => {
    const cleanedTitle = String(title).trim().replace(/^\[test\]\s*/i, '');
    return `${openTag}[test] ${cleanedTitle}${closeTag}`;
  });
  fs.writeFileSync('index.html', indexHtml);

  // 2. LoginDialog.vue - 添加测试环境警告
  const loginPath = 'src/components/auth/LoginDialog.vue';
  let loginVue = fs.readFileSync(loginPath, 'utf8');
  loginVue = loginVue.replace(
    '本账号服务不保证可用性，请妥善备份您的数据',
    '⚠️ 测试环境：账号与正式版不互通，用户数据可能随时被清除，请勿使用真实账号'
  );
  fs.writeFileSync(loginPath, loginVue);

  // 3. AppHeader.vue - 添加测试版标识
  const headerPath = 'src/components/layout/AppHeader.vue';
  let appHeader = fs.readFileSync(headerPath, 'utf8');

  // 在标题后添加测试版标识
  appHeader = appHeader.replace(
    '<h1 class="header-text">BraydenSCE V2</h1>',
    '<h1 class="header-text">BraydenSCE V2<span class="test-badge">测试版</span></h1>'
  );

  // 添加测试版标识样式
  if (!appHeader.includes('.test-badge')) {
    appHeader = appHeader.replace(
      '</style>',
      `.test-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  background: #ff9800;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  padding: 4px 10px;
  margin-left: 12px;
  vertical-align: middle;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  letter-spacing: 0.5px;
}

@media (max-width: 1366px) and (min-width: 1025px) {
  .test-badge {
    font-size: 11px;
    padding: 3px 8px;
    margin-left: 10px;
  }
}

@media (max-height: 820px) and (min-width: 1025px) {
  .test-badge {
    font-size: 10px;
    padding: 3px 7px;
    margin-left: 8px;
  }
}

@media (max-width: 1024px) {
  .test-badge {
    font-size: 11px;
    padding: 3px 8px;
    margin-left: 10px;
  }
}

@media (max-width: 768px) {
  .test-badge {
    font-size: 9px;
    padding: 2px 6px;
    margin-left: 6px;
  }
}
</style>`
    );
  }
  fs.writeFileSync(headerPath, appHeader);

  console.log('Successfully patched files for test environment.');
} catch (e) {
  console.error('Failed to patch test environment:', e);
  process.exit(1);
}
