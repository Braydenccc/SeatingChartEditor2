import { execFileSync, execSync } from 'node:child_process';

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

function quoteRef(ref) {
  return `'${String(ref).replace(/'/g, `'\\''`)}'`;
}

const targetPath = process.argv[2]?.trim();
const currentBranch = run('git rev-parse --abbrev-ref HEAD');

if (currentBranch === 'HEAD') {
  console.error('detached HEAD 状态下无法部署，请先切换到分支。');
  process.exit(1);
}

if (!targetPath) {
  runInherit('git checkout test');
  runInherit(`git merge ${quoteRef(currentBranch)} --no-edit`);
  runInherit('git push origin test');
  runInherit(`git checkout ${quoteRef(currentBranch)}`);
  process.exit(0);
}

const safePath = targetPath.replace(/^\/+|\/+$/g, '');
if (!safePath) {
  console.error('部署路径不能为空。');
  process.exit(1);
}

if (!/^[a-zA-Z0-9._/-]+$/.test(safePath)) {
  console.error('部署路径仅允许字母、数字、点、下划线、连字符和斜杠。');
  process.exit(1);
}

const pathSegments = safePath.split('/').filter(Boolean);
if (pathSegments.length === 0) {
  console.error('部署路径不能为空。');
  process.exit(1);
}

if (pathSegments.some((segment) => segment === '.' || segment === '..')) {
  console.error('部署路径不能包含 . 或 .. 段。');
  process.exit(1);
}

if (pathSegments.some((segment) => segment === 'test')) {
  console.error('部署路径不能包含 test 段。');
  process.exit(1);
}

const deployBranch = `test/${safePath}`;

runFileInherit('git', ['push', 'origin', `HEAD:refs/heads/${deployBranch}`]);
console.log(`已推送当前分支到 ${deployBranch}，将部署到 https://test.sce.jbyc.cc/${safePath}`);
