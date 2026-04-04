import fs from 'fs';
import { execFileSync, execSync } from 'child_process';

const TEST_HOST = 'https://test.sce.jbyc.cc';

/**
 * Run git with explicit argv (no shell string), returning trimmed stdout.
 * @param {string[]} args
 * @returns {string}
 */
function runGit(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Git command failed: git ${args.join(' ')}`);
    throw error;
  }
}

function encodeHtmlEntities(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toStagingUrl(branch) {
  if (branch === 'test') return `${TEST_HOST}/test`;
  if (branch.startsWith('test/')) {
    return `${TEST_HOST}/test/${branch.slice(5)}`;
  }
  return '';
}

function shouldSelectBranchOption(branch, currentBranch, hasCurrentBranchInList) {
  if (branch === currentBranch) {
    return true;
  }

  return branch === 'test' && !hasCurrentBranchInList;
}

function resolveCurrentBranch() {
  const currentBranchFromGit = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (currentBranchFromGit !== 'HEAD') {
    return currentBranchFromGit;
  }

  const githubRefName = process.env.GITHUB_REF_NAME?.trim() || '';
  if (githubRefName) {
    return githubRefName;
  }

  const githubRef = process.env.GITHUB_REF?.trim() || '';
  const refPrefix = 'refs/heads/';
  if (githubRef.startsWith(refPrefix)) {
    return githubRef.slice(refPrefix.length);
  }

  console.warn('Unable to resolve current branch in detached HEAD, fallback to test');
  return 'test';
}

try {
  // 解决 GitHub Actions 容器环境下的 git 目录所有权安全限制
  try {
    execSync("git config --global --add safe.directory '*'");
  } catch (e) {
    // Ignore errors if this fails (e.g. locally without perms)
  }

  const currentBranch = resolveCurrentBranch();
  const localBranches = runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);
  const remoteBranches = runGit(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin'])
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b && !b.endsWith('/HEAD'))
    .map((b) => b.replace(/^origin\//, ''));

  const branchSet = new Set([...localBranches, ...remoteBranches]);
  if (currentBranch === 'test' || currentBranch.startsWith('test/')) {
    branchSet.add(currentBranch);
  }
  const branchList = Array.from(branchSet)
    .filter((branch) => branch === 'test' || branch.startsWith('test/'))
    .sort((a, b) => {
      if (a === 'test') return -1;
      if (b === 'test') return 1;
      return a.localeCompare(b);
    });

  if (branchList.length === 0) {
    branchList.push('test');
  }
  const hasCurrentBranchInList = branchList.includes(currentBranch);

  console.log(`Patching test env with branch selector: ${currentBranch}`);

  // 1. index.html
  let indexHtml = fs.readFileSync('index.html', 'utf8');
  // 保留可能存在的 title 属性，同时避免重复注入 [test] 前缀
  indexHtml = indexHtml.replace(/(<title(?:\s[^>]*)?>)([\s\S]*?)(<\/title>)/, (_, openTag, title, closeTag) => {
    const cleanedTitle = String(title).trim().replace(/^\[test\]\s*/i, '');
    return `${openTag}[test] ${cleanedTitle}${closeTag}`;
  });
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
  const optionsHtml = branchList
    .map((branch) => {
      const url = toStagingUrl(branch);
      const selected = shouldSelectBranchOption(branch, currentBranch, hasCurrentBranchInList) ? ' selected' : '';
      return `<option value="${encodeHtmlEntities(url)}"${selected}>${encodeHtmlEntities(branch)}</option>`;
    })
    .join('');
  const selectorHtml = `<select class="branch-selector" onchange="if (this.value) { window.location.href = this.value; }">${optionsHtml}</select>`;
  appHeader = appHeader.replace(
    '<h1 class="header-text">BraydenSCE V2</h1>',
    `<h1 class="header-text">\n        BraydenSCE V2\n        ${selectorHtml}\n      </h1>`
  );
  if (!appHeader.includes('.branch-selector')) {
    appHeader = appHeader.replace(
      '</style>',
      `.branch-selector { display: inline-block; font-size: 11px; font-weight: 500; font-family: monospace; background: rgba(255,255,255,0.18); color: rgba(255,255,255,0.95); border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; padding: 2px 8px; margin-left: 10px; vertical-align: middle; max-width: 300px; cursor: pointer; }\n.branch-selector option { color: #1f2937; }\n</style>`
    );
  }
  fs.writeFileSync(headerPath, appHeader);
  
  console.log('Successfully patched files for test environment.');
} catch (e) {
  console.error('Failed to patch test environment notices:', e);
  process.exit(1);
}
