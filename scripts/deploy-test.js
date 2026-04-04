import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { resolveStagingTarget } from './staging-deploy-path.js';

function runCommand(executable, args) {
  try {
    return execFileSync(executable, args, { stdio: 'pipe', encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`命令执行失败: ${executable} ${args.join(' ')}`);
    throw error;
  }
}

function runCommandInherit(executable, args) {
  execFileSync(executable, args, { stdio: 'inherit' });
}

function resolveCurrentBranchForDeploy() {
  const branchFromGit = runCommand('git', ['symbolic-ref', '-q', '--short', 'HEAD']);
  if (branchFromGit) {
    return branchFromGit;
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

  return '';
}

const targetPath = process.argv[2]?.trim();
const currentBranchRef = resolveCurrentBranchForDeploy();

if (!currentBranchRef) {
  console.error('detached HEAD 状态下无法部署，请先切换到分支。');
  process.exit(1);
}

if (!targetPath) {
  runCommandInherit('git', ['checkout', 'test']);
  runCommandInherit('git', ['merge', currentBranchRef, '--no-edit']);
  runCommandInherit('git', ['push', 'origin', 'test']);
  runCommandInherit('git', ['checkout', currentBranchRef]);
  process.exit(0);
}

let resolvedTarget;
try {
  resolvedTarget = resolveStagingTarget(`test-${targetPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

// --- 自动添加子测试环境到 JSON 逻辑 ---
const envsFilePath = 'test-envs.json';
let envs = [];
try {
  envs = JSON.parse(fs.readFileSync(envsFilePath, 'utf8'));
} catch (e) {
  // 如果首次没有该文件，忽略即可，后续会自动创建
}

if (!envs.some(env => env.id === targetPath)) {
  envs.push({
    id: targetPath,
    label: `子测试 ${targetPath}`,
    url: resolvedTarget.siteUrl
  });
  fs.writeFileSync(envsFilePath, JSON.stringify(envs, null, 2) + '\n', 'utf8');
  console.log(`[提示] 自动将新环境加入到了 ${envsFilePath}`);
  
  try {
    runCommandInherit('git', ['add', envsFilePath]);
    runCommandInherit('git', ['commit', '-m', `chore: 自动注册新的测试环境 ${targetPath}`]);
    console.log(`[提示] 已自动创建 Commit。`);
  } catch(e) {
    console.warn(`[警告] 自动 Commit 失败，如果工作区为空可能无需提交。`);
  }
}
// ----------------------------------------

const deployBranch = `test-${targetPath}`;

runCommandInherit('git', ['push', 'origin', `HEAD:refs/heads/${deployBranch}`]);
console.log(`已推送当前分支到 ${deployBranch}，将部署到 ${resolvedTarget.siteUrl}`);
