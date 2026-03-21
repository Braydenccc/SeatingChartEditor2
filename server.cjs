const http = require('http');
const fs = require('fs');
const path = require('path');

// dist 目录（构建输出）
// 当打包为 exe 时，需要从 exe 所在目录向上查找 dist 目录
// 或者直接使用当前目录（假设 exe 在 dist/bin 下，需要访问 dist 下的文件）
let DIST = path.join(__dirname, 'dist');

// 检查是否是打包后的可执行文件（pkg 会设置 process.pkg）
if (process.pkg) {
  // exe 所在目录就是 dist 目录（或者 exe 在 dist/bin 下）
  const exeDir = path.dirname(process.execPath);
  const exeDirName = path.basename(exeDir);

  if (exeDirName === 'bin') {
    // exe 在 dist/bin 目录下，需要访问上级目录（dist）
    DIST = path.join(exeDir, '..');
  } else {
    // exe 直接在 dist 目录下
    DIST = exeDir;
  }
} else {
  // 开发模式，从项目根目录的 dist 目录读取
  DIST = path.join(__dirname, 'dist');
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safeJoin(base, target) {
  const baseResolved = path.resolve(base);
  const resolved = path.resolve(base, '.' + path.normalize('/' + target));
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    throw new Error('Path traversal attempt detected');
  }
  return resolved;
}

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    const filePath = safeJoin(DIST, urlPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.end('Not found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const type = mime[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', type);
      res.end(data);
    });
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Server error');
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`Serving at ${url}`);

  // 自动打开系统默认浏览器（兼容 pkg 打包环境）
  const { spawn } = require('child_process');
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
});
