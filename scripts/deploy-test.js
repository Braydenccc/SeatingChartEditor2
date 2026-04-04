import { execFileSync, execSync } from 'node:child_process';
import { resolveStagingTarget } from './staging-deploy-path.js';

function run(command) {
  try {
    return execSync(command, { stdio: 'pipe', encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`命令执行失败: ${command}`);
    throw error;
  }
}

function runInherit(command) {
  execSync(command, { stdio: 'inherit' });
}

function runFileInherit(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function posixShellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

const targetPath = process.argv[2]?.trim();
const currentBranchRef = run('git symbolic-ref -q --short HEAD');

if (!currentBranchRef) {
  console.error('detached HEAD 状态下无法部署，请先切换到分支。');
  process.exit(1);
}

if (!targetPath) {
  runInherit('git checkout test');
  runInherit(`git merge ${posixShellQuote(currentBranchRef)} --no-edit`);
  runInherit('git push origin test');
  runInherit(`git checkout ${posixShellQuote(currentBranchRef)}`);
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

runFileInherit('git', ['push', 'origin', `HEAD:refs/heads/${deployBranch}`]);
console.log(`已推送当前分支到 ${deployBranch}，将部署到 ${resolvedTarget.siteUrl}`);
