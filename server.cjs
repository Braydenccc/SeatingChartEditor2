const http = require('http');
const https = require('https');
const path = require('path');
const { readFile } = require('fs').promises;

// dist 目录（构建输出）
// 当打包为 exe 时，需要从 exe 所在目录向上查找 dist 目录
// 或者直接使用当前目录（假设 exe 在 dist/bin 下，需要访问 dist 下的文件）
let DIST = path.join(__dirname, 'dist');

// 检查是否是打包后的可执行文件（pkg 会设置 process.pkg）
if (process.pkg) {
  // 检查 exe 所在目录下是否存在 dist 目录（安装版模式）
  const exeDir = path.dirname(process.execPath);
  const localDist = path.join(exeDir, 'dist');
  
  // 如果是打包为单文件 (Tauri 或 Pkg 模式)，或者安装包模式，都需要寻找资源
  // 对于 pkg：__dirname 指向包内虚拟路径，process.execPath 指向 exe 路径
  try {
    const { statSync } = require('fs');
    if (statSync(localDist).isDirectory()) {
      DIST = localDist;
    } else {
      DIST = path.join(__dirname, 'dist');
    }
  } catch (e) {
    // 找不到外部 dist 目录时，回退到包内虚拟目录
    DIST = path.join(__dirname, 'dist');
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
  const rel = path.relative(baseResolved, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    const err = new Error('Path traversal attempt detected');
    err.code = 'PATH_TRAVERSAL';
    throw err;
  }
  return resolved;
}

const server = http.createServer(async (req, res) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Intercept WebDAV proxy requests to bypass CORS
  if (req.url.startsWith('/api/dav-proxy')) {
    const davUrl = req.headers['x-dav-url'];
    if (!davUrl) {
      res.statusCode = 400;
      return res.end('Missing x-dav-url header');
    }
    try {
      const targetUrl = new URL(davUrl);
      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: { ...req.headers }
      };
      delete options.headers['host'];
      delete options.headers['x-dav-url'];
      delete options.headers['connection'];
      delete options.headers['origin'];
      delete options.headers['referer'];

      const client = targetUrl.protocol === 'https:' ? https : http;
      const proxyReq = client.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });
      proxyReq.on('error', (err) => {
        console.error('WebDAV Proxy Error:', err);
        res.statusCode = 502;
        res.end('Proxy error: ' + err.message);
      });
      req.pipe(proxyReq, { end: true });
    } catch (err) {
      res.statusCode = 400;
      res.end('Invalid URL');
    }
    return;
  }

  try {
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (_e) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Bad Request');
    }
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    const filePath = safeJoin(DIST, urlPath);

    try {
      const data = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const type = mime[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', type);
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'");
      res.end(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.end('Not found');
      }
      if (err.code === 'EACCES') {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.end('Forbidden');
      }
      throw err;
    }
  } catch (e) {
    if (e.code === 'PATH_TRAVERSAL') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Bad request');
    }
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
