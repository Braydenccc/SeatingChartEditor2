import fs from 'fs';
import { execSync } from 'child_process';

const TEST_HOST = 'https://test.sce.jbyc.cc';

// --- 子测试环境配置 ---
// 从外部配置文件读取（如果没有配置子测试，内部默认至少应有一项指向主测试环境，或者直接读取配置即可）
const envsFile = fs.readFileSync('test-envs.json', 'utf8');
const SUB_TEST_ENVS = JSON.parse(envsFile);

function encodeHtmlEntities(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

try {
  // 解决 GitHub Actions 容器环境下的 git 目录所有权安全限制
  try {
    execSync("git config --global --add safe.directory '*'");
  } catch (e) {
    // Ignore errors if this fails (e.g. locally without perms)
  }

  // 仅保留基础环境变量（如果需要的话，目前脚本不再依赖当前环境名字来决定下拉状态
  // 而是通过浏览器端实际访问的 URL 或简单保持下拉框供跳转）

  console.log(`Patching test env with static sub-test selector`);

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
  
  // 生成固定的下拉选项
  const optionsHtml = SUB_TEST_ENVS
    .map((env) => {
      // 在编译时我们不再动态判断哪个是当前选中的，而是可以让前端在加载时或者只做简单跳转即可
      // 此处暂时取消默认选中逻辑，因为静态生成不能反映动态 URL。如果要完美匹配当前 URL，需通过 JS 设置。
      // 但为了简单，可以在客户端写入一小段脚本来选中当前页面匹配的 Option。
      return `<option value="${encodeHtmlEntities(env.url)}">${encodeHtmlEntities(env.label)}</option>`;
    })
    .join('');
    
  const selectorHtml = `<select class="subtest-selector" onchange="if (this.value) { window.location.href = this.value; }" id="envSelectorPlaceholder">${optionsHtml}</select><script>setTimeout(()=>{const sel=document.getElementById('envSelectorPlaceholder');if(!sel)return;Array.from(sel.options).forEach(opt=>{if(window.location.href.startsWith(opt.value)){opt.selected=true;}});},0);</script>`;
  
  appHeader = appHeader.replace(
    '<h1 class="header-text">BraydenSCE V2</h1>',
    `<h1 class="header-text">\n        BraydenSCE V2\n        ${selectorHtml}\n      </h1>`
  );
  
  // 如果之前存在旧的 branch-selector 样式，先清理掉它
  if (appHeader.includes('.branch-selector')) {
    // 因为正则替换可能有点复杂，直接新增新的 class 原有不管，或者兼容
    appHeader = appHeader.replace(/\.branch-selector/g, '.subtest-selector');
  } else if (!appHeader.includes('.subtest-selector')) {
    appHeader = appHeader.replace(
      '</style>',
      `.subtest-selector { display: inline-block; font-size: 11px; font-weight: 500; font-family: monospace; background: rgba(255,255,255,0.18); color: rgba(255,255,255,0.95); border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; padding: 2px 8px; margin-left: 10px; vertical-align: middle; max-width: 300px; cursor: pointer; }\n.subtest-selector option { color: #1f2937; }\n</style>`
    );
  }
  fs.writeFileSync(headerPath, appHeader);
  
  console.log('Successfully patched files for test environment with static sub-test configs.');
} catch (e) {
  console.error('Failed to patch test environment notices:', e);
  process.exit(1);
}
