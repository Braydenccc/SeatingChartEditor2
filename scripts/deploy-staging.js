/**
 * Custom Retiehe Web Host deployment script for staging environments.
 *
 * Unlike the official rth-host-helper (which syncs files to the domain root
 * and deletes anything not in the local build), this script:
 *   1. Only manages files under a specific remote `deployPath` prefix.
 *   2. Leaves all other files/sub-paths on the same domain untouched,
 *      so multiple concurrent test environments can coexist.
 *
 * Usage:
 *   node scripts/deploy-staging.js \
 *     --site test.sce.jbyc.cc \
 *     --deploy-path test \
 *     --outdir dist
 *
 * Environment:
 *   RTH_API_KEY  – Retiehe API key (required)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ─── Configuration ────────────────────────────────────────────────────────────

const API_BASE = 'https://api-overseas.retiehe.com/backend';
const USER_AGENT = 'Mozilla/5.0 (linux) RTHHostHelper/5.0.3';

// ─── CLI Arg Parsing ──────────────────────────────────────────────────────────

function parseArgs() {
  const raw = process.argv.slice(2);
  const args = { site: '', deployPath: '', outdir: 'dist' };
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '--site') args.site = raw[++i];
    else if (raw[i] === '--deploy-path') args.deployPath = raw[++i];
    else if (raw[i] === '--outdir') args.outdir = raw[++i];
  }
  return args;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHeaders() {
  const apiKey = process.env.RTH_API_KEY;
  if (!apiKey) {
    console.error('Missing environment variable: RTH_API_KEY');
    process.exit(1);
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    'User-Agent': USER_AGENT,
  };
}

/** Normalize a deploy sub-path: strip leading/trailing slashes */
function normalizePrefix(rawPath) {
  return String(rawPath ?? '').trim().replace(/^\/+|\/+$/g, '');
}

/** Compute md5 checksum of a local file (matches rth-cli behaviour) */
function md5File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(data).digest('hex');
}

/** Recursively collect all files under a directory. Returns posix-style relative paths. */
function collectFiles(dir) {
  const results = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current)) {
      if (entry.startsWith('.')) continue;
      const abs = path.join(current, entry);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
      } else {
        results.push(path.relative(dir, abs).split(path.sep).join('/'));
      }
    }
  }
  walk(dir);
  return results;
}

/** Extensions / patterns treated as text (uploaded in bulk JSON) */
function isTextFile(filePath) {
  return /\.(html?|css|[cm]?js|json|md|txt|vue|webmanifest|xml|rth)$/i.test(filePath);
}

/** Extensions that should never be uploaded to a web host */
function shouldSkip(filePath) {
  return /\.(exe|docx?|pptx?|xlsx?|jsx|tsx?|less|scss|sass)$/i.test(filePath)
    || ['bun.lock', 'bun.lockb', 'package.json', 'package-lock.json',
        'pnpm-lock.yaml', 'tsconfig.json', 'yarn.lock'].includes(path.basename(filePath));
}

// ─── Retiehe API ──────────────────────────────────────────────────────────────

/**
 * GET /host-v3/site/content?domain=<domain>&username=<username>
 * Returns the full remote file map { "<key>": { url, ... }, ... }
 */
async function fetchRemoteContent(domain, username) {
  const url = `${API_BASE}/host-v3/site/content?domain=${encodeURIComponent(domain)}&username=${encodeURIComponent(username)}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET site content failed: ${res.status}${body ? ` – ${body}` : ''}`);
  }
  const data = await res.json();
  if (data.alert && !data.result) throw new Error(data.alert);
  return data.result ?? {};
}

/**
 * DELETE selected files from the remote.
 * POST /host-v3/site/content  { domain, username, keys: [...], type: "undefined" }
 */
async function deleteRemoteFiles(domain, username, keys) {
  const res = await fetch(`${API_BASE}/host-v3/site/content`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, username, keys: Array.from(keys), type: 'undefined' }),
  });
  if (!res.ok) throw new Error(`Delete files failed: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.alert ?? data.errorLog ?? 'Delete failed');
  return data;
}

/**
 * Upload a single text file.
 * POST /host-v3/site/content  { domain, username, key, content, type: "string" }
 * This mirrors rth-cli.js's la() / watch-mode upload, which works for any path depth.
 */
async function uploadTextFile(domain, username, key, content) {
  const res = await fetch(`${API_BASE}/host-v3/site/content`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, username, key, content, type: 'string' }),
  });
  if (!res.ok) throw new Error(`Upload text ${key} failed: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.alert ?? data.errorLog ?? `Text upload failed: ${key}`);
  return data;
}

/**
 * Upload one binary file via multipart.
 * POST /host-v3/site/content  (FormData)
 */
async function uploadBinaryFile(domain, username, remoteKey, localPath) {
  const blob = new Blob([fs.readFileSync(localPath)]);
  const form = new FormData();
  form.append('domain', domain);
  form.append('username', username);
  form.append('key', remoteKey);
  form.append('type', 'object');
  form.append('content', blob, path.basename(localPath));
  const res = await fetch(`${API_BASE}/host-v3/site/content`, {
    method: 'POST',
    headers: getHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(`Upload binary ${remoteKey} failed: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.alert ?? data.errorLog ?? 'Binary upload failed');
  return data;
}

/** Verify the API key and return the username */
async function verifyApiKey() {
  const apiKey = process.env.RTH_API_KEY;
  const res = await fetch(
    `https://api.retiehe.com/backend/api-key-v2/verification?key=${encodeURIComponent(apiKey)}`,
    { headers: { 'User-Agent': USER_AGENT } },
  );
  if (!res.ok) {
    if (res.status === 402) throw new Error('Premium subscription expired.');
    if (res.status === 404) throw new Error('Invalid API key.');
    throw new Error(`API key verification failed: ${res.status}`);
  }
  const data = await res.json();
  return data.username;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { site, deployPath, outdir } = parseArgs();

  if (!site || !outdir) {
    console.error('Usage: node deploy-staging.js --site <domain> --deploy-path <subpath> --outdir <dir>');
    process.exit(1);
  }

  const prefix = normalizePrefix(deployPath); // e.g. "test" or "test/rule"
  const prefixSlash = prefix ? `${prefix}/` : ''; // "test/" or ""

  // 1. Verify API key
  console.log('Verifying API key...');
  const username = await verifyApiKey();
  console.log('API key verified.');

  // 2. Collect local files
  if (!fs.existsSync(outdir)) {
    console.error(`Output directory not found: ${outdir}`);
    process.exit(1);
  }
  const localFiles = collectFiles(outdir);
  if (localFiles.length === 0) {
    console.error('No files found in output directory.');
    process.exit(1);
  }
  console.log(`Found ${localFiles.length} local files.`);

  // 3. Fetch remote file map
  console.log('Getting current site content...');
  const remote = await fetchRemoteContent(site, username);
  console.log('Site content retrieved.');

  // Build sets of remote keys that belong to our deployPath scope
  // Key format in Retiehe: e.g. "test/index.html", "test/assets/main.js"
  const remoteKeysInScope = new Set(
    Object.keys(remote).filter((k) => prefixSlash === '' || k.startsWith(prefixSlash)),
  );

  // 4. Build expected remote key set from local files
  const expectedRemoteKeys = new Set(
    localFiles.map((f) => (prefixSlash ? `${prefixSlash}${f}` : f)),
  );

  // 5. Delete remote files that no longer exist locally (within scope)
  const toDelete = new Set([...remoteKeysInScope].filter((k) => !expectedRemoteKeys.has(k)));
  if (toDelete.size > 0) {
    console.log(`Deleting ${toDelete.size} stale remote file(s) within "${prefix || '/'}"...`);
    for (const k of toDelete) console.log('  Delete:', k);
    await deleteRemoteFiles(site, username, toDelete);
    console.log('Stale files deleted.');
  } else {
    console.log('No stale files to delete.');
  }

  // 6. Upload new / changed files
  for (const localFile of localFiles) {
    if (shouldSkip(localFile)) {
      console.log('Skipped (not for browsers):', localFile);
      continue;
    }

    const localPath = path.join(outdir, localFile);
    const remoteKey = prefixSlash ? `${prefixSlash}${localFile}` : localFile;
    const stat = fs.statSync(localPath);

    if (stat.size > 5 * 1024 * 1024) {
      console.warn('Skipped (too large):', localFile);
      continue;
    }

    // Check if file changed via md5 comparison
    const remoteEntry = remote[remoteKey];
    if (remoteEntry?.url) {
      const remoteHash = remoteEntry.url.split('/')[2]; // Retiehe stores md5 in URL segment
      const localHash = md5File(localPath);
      if (localHash === remoteHash) {
        console.log('Unchanged:', remoteKey);
        continue;
      }
    }

    console.log('Uploading:', remoteKey);

    if (isTextFile(localFile)) {
      // Text files: use single-file string upload (mirrors rth-cli.js watch mode la())
      await uploadTextFile(site, username, remoteKey, fs.readFileSync(localPath, 'utf8'));
    } else {
      // Binary / compressed files: multipart upload
      await uploadBinaryFile(site, username, remoteKey, localPath);
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
