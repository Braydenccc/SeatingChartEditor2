import { execFileSync } from 'node:child_process';
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
  resolvedTarget = resolveStagingTarget(`test/${targetPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const deployBranch = `test/${resolvedTarget.deployPath}`;

runCommandInherit('git', ['push', 'origin', `HEAD:refs/heads/${deployBranch}`]);
console.log(`已推送当前分支到 ${deployBranch}，将部署到 ${resolvedTarget.siteUrl}`);
