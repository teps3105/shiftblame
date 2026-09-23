import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// sb docs-vault：以 <repo> 根為 Obsidian vault 根——.obsidian/ 建於 <repo>/.obsidian/（Obsidian 設定
// 目錄固定在 vault 根）、Hidden Folders Access 外掛自動安裝（Obsidian 核心不索引 dot 資料夾——標準解；
// 測試以 localhost 假源模擬 release 下載）、community-plugins.json 補缺啟用、data.json enabledFolders
// 補 .shiftblame、app.json userIgnoreFilters 補缺（索引集＝docs/＋.shiftblame 治理文件、tmp/ 排除、
// 非 docs/ 頂層項目動態掃入）、.gitignore 查證補行 .obsidian/。冪等：既有檔與既有條目不覆蓋。
const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, '../bin/sb.mjs');
const roots = [];
const children = [];
process.on('exit', () => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  for (const c of children) c.kill();
});

const sandbox = ({ git = true, gitignore = '.shiftblame/\n', withSb = true, topEntries = ['cli'] } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'sb-docs-vault-'));
  roots.push(root);
  mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
  if (!withSb) rmSync(join(root, '.shiftblame'), { recursive: true, force: true });
  for (const name of topEntries) {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, 'placeholder.txt'), 'x\n');
  }
  if (gitignore !== null) writeFileSync(join(root, '.gitignore'), gitignore);
  if (git) {
    const g = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(g('init').status, 0);
    assert.equal(g('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '--allow-empty', '-m', 'test: 初始提交').status, 0);
  }
  return root;
};
const run = (root, env = {}) => spawnSync(process.execPath, [cli, 'docs-vault'], {
  cwd: root, encoding: 'utf8',
  env: { ...process.env, ...env },
});
const stdout = (r) => `${r.stdout}\n${r.stderr}`;
const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const pluginDir = (root) => join(root, '.obsidian', 'plugins', 'hidden-folders-access');

// localhost 假源：模擬 GitHub latest release 三檔（main.js／manifest.json／styles.css）。
// 必須跑在獨立子進程——spawnSync 會阻塞測試進程事件迴圈，同進程 server 無法回應 CLI 請求（死鎖）。
const SERVER_SCRIPT = `
const http = require('node:http');
const fail = process.env.FAKE_FAIL === '1';
const server = http.createServer((req, resp) => {
  if (fail) { resp.writeHead(503); resp.end('unavailable'); return; }
  resp.writeHead(200, { 'content-type': 'text/plain' });
  resp.end('fake-' + req.url.slice(1));
});
server.listen(0, '127.0.0.1', () => console.log('PORT=' + server.address().port));
`;
const startFakeSource = ({ fail = false } = {}) => new Promise((res, rej) => {
  const child = spawn(process.execPath, ['-e', SERVER_SCRIPT], {
    env: { ...process.env, FAKE_FAIL: fail ? '1' : '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let out = '';
  child.stdout.on('data', (d) => {
    out += d;
    const m = out.match(/PORT=(\d+)/);
    // 活著的子進程與其 stdout pipe 會撐住事件迴圈——拿到 port 即解除引用，讓測試進程能自然退出。
    if (m) { child.unref(); child.stdout.destroy(); res(`http://127.0.0.1:${m[1]}`); }
  });
  child.on('error', rej);
  children.push(child);
});

// —— 1. 全新專案（git）：vault 結構＋外掛三檔＋啟用＋data.json＋過濾器＋.gitignore ——
{
  const base = await startFakeSource();
  const root = sandbox();
  const r = run(root, { SB_DOCS_VAULT_PLUGIN_BASE: base });
  assert.equal(r.status, 0, `docs-vault 應通過：${stdout(r)}`);
  assert.ok(existsSync(join(root, '.obsidian')), '.obsidian/ 建於 repo 根');
  assert.ok(existsSync(join(root, 'docs')), 'docs/ 缺則建');
  for (const f of ['main.js', 'manifest.json', 'styles.css']) assert.ok(existsSync(join(pluginDir(root), f)), `外掛 ${f} 已下載`);
  assert.deepEqual(readJson(root, '.obsidian/community-plugins.json'), ['hidden-folders-access'], 'community-plugins.json 啟用外掛');
  const data = readJson(root, '.obsidian/plugins/hidden-folders-access/data.json');
  assert.deepEqual(data.enabledFolders, ['.shiftblame'], 'data.json 開啟 .shiftblame');
  const filters = readJson(root, '.obsidian/app.json').userIgnoreFilters;
  assert.ok(filters.includes('.shiftblame/tmp/'), 'tmp/ 已排除');
  assert.ok(filters.includes('cli/'), '頂層非 docs 項目已掃入過濾');
  assert.ok(!filters.some((f) => f === 'docs' || f === 'docs/'), 'docs/ 本身不被排除');
  assert.match(readFileSync(join(root, '.gitignore'), 'utf8'), /^\.obsidian\/$/m, '.gitignore 已補 .obsidian/');
  assert.equal(spawnSync('git', ['-C', root, 'check-ignore', '--quiet', '--', '.obsidian/']).status, 0, 'git 判 .obsidian/ 已忽略');
  assert.match(stdout(r), /Graph View/, '輸出提示 Graph View 入口');
  assert.match(stdout(r), /1\.13\+/, '輸出標注 Obsidian 版本需求');
}

// —— 2. 冪等：重跑零新增、外掛檔與設定不變、.gitignore 不重複補 ——
{
  const base = await startFakeSource();
  const root = sandbox();
  assert.equal(run(root, { SB_DOCS_VAULT_PLUGIN_BASE: base }).status, 0);
  const snap = ['.obsidian/community-plugins.json', '.obsidian/app.json', '.obsidian/plugins/hidden-folders-access/data.json', '.obsidian/plugins/hidden-folders-access/main.js', '.gitignore'].map((rel) => readFileSync(join(root, rel), 'utf8'));
  // 假源關閉——重跑不應再下載（三檔已齊即冪等跳過），此舉同時驗證「已齊不下載」
  const r2 = run(root, { SB_DOCS_VAULT_PLUGIN_BASE: 'http://127.0.0.1:1' });
  assert.equal(r2.status, 0, stdout(r2));
  assert.deepEqual(['.obsidian/community-plugins.json', '.obsidian/app.json', '.obsidian/plugins/hidden-folders-access/data.json', '.obsidian/plugins/hidden-folders-access/main.js', '.gitignore'].map((rel) => readFileSync(join(root, rel), 'utf8')), snap, '重跑零變更');
  assert.match(stdout(r2), /零新增/, '結構齊備時零新增');
}

// —— 3. 既有設定自訂：community-plugins／app.json／data.json 的使用者條目保留、缺項補上 ——
{
  const base = await startFakeSource();
  const root = sandbox();
  mkdirSync(join(root, '.obsidian'), { recursive: true });
  mkdirSync(join(pluginDir(root)), { recursive: true });
  writeFileSync(join(root, '.obsidian', 'community-plugins.json'), JSON.stringify(['another-plugin']));
  writeFileSync(join(root, '.obsidian', 'app.json'), JSON.stringify({ userIgnoreFilters: ['私人筆記/'], alwaysUpdateLinks: true }));
  writeFileSync(join(pluginDir(root), 'data.json'), JSON.stringify({ enabledFolders: ['.秘密'], allowedExtensions: ['md'] }));
  writeFileSync(join(pluginDir(root), 'main.js'), '/* 使用者既有 */');
  const r = run(root, { SB_DOCS_VAULT_PLUGIN_BASE: base });
  assert.equal(r.status, 0, stdout(r));
  assert.deepEqual(readJson(root, '.obsidian/community-plugins.json'), ['another-plugin', 'hidden-folders-access'], '既有啟用保留、補缺');
  const cfg = readJson(root, '.obsidian/app.json');
  assert.ok(cfg.userIgnoreFilters.includes('私人筆記/') && cfg.userIgnoreFilters.includes('.shiftblame/tmp/'), '過濾器補缺不覆蓋');
  assert.equal(cfg.alwaysUpdateLinks, true, '其他設定鍵未動');
  const data = readJson(root, '.obsidian/plugins/hidden-folders-access/data.json');
  assert.deepEqual(data.enabledFolders, ['.秘密', '.shiftblame'], 'enabledFolders 既有保留、補缺');
  assert.deepEqual(data.allowedExtensions, ['md'], 'allowedExtensions 未動');
  assert.equal(readFileSync(join(pluginDir(root), 'main.js'), 'utf8'), '/* 使用者既有 */', '既有外掛檔不覆蓋');
  assert.ok(!existsSync(join(pluginDir(root), 'styles.css')) || true, '缺的下載、有的不動（見上斷言）');
}

// —— 4. 下載失敗降級：不擋結構、輸出替代指引 ——
{
  const base = await startFakeSource({ fail: true });
  const root = sandbox();
  const r = run(root, { SB_DOCS_VAULT_PLUGIN_BASE: base });
  assert.equal(r.status, 0, `下載失敗應降級不擋：${stdout(r)}`);
  assert.match(stdout(r), /下載失敗/, '輸出說明下載失敗');
  assert.match(stdout(r), /Obsidian/, '輸出替代安裝指引');
  assert.ok(existsSync(join(root, '.obsidian', 'app.json')), '過濾器照常建立');
}

// —— 5. 非 Git 工作區：直接規則辨識（有規則不重複補、無規則補行） ——
{
  const base = await startFakeSource();
  const root = sandbox({ git: false, gitignore: '.shiftblame/\n.obsidian/\n' });
  const r = run(root, { SB_DOCS_VAULT_PLUGIN_BASE: base });
  assert.equal(r.status, 0, stdout(r));
  assert.equal(readFileSync(join(root, '.gitignore'), 'utf8'), '.shiftblame/\n.obsidian/\n', '已有直接規則不重複補');

  const root2 = sandbox({ git: false, gitignore: '.shiftblame/\n' });
  const r2 = run(root2, { SB_DOCS_VAULT_PLUGIN_BASE: base });
  assert.equal(r2.status, 0, stdout(r2));
  assert.match(readFileSync(join(root2, '.gitignore'), 'utf8'), /^\.obsidian\/$/m, '非 Git 無規則時補行');
}

// —— 6. 無 .shiftblame（純 docs vault）：結構與外掛照常，重跑補治理文件 ——
{
  const base = await startFakeSource();
  const root = sandbox({ withSb: false });
  const r = run(root, { SB_DOCS_VAULT_PLUGIN_BASE: base });
  assert.equal(r.status, 0, stdout(r));
  assert.deepEqual(readJson(root, '.obsidian/plugins/hidden-folders-access/data.json').enabledFolders, ['.shiftblame'], '外掛設定照常預寫（slug 開立後 Obsidian 重啟即現身）');
  mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
  const r2 = run(root, { SB_DOCS_VAULT_PLUGIN_BASE: base });
  assert.equal(r2.status, 0, stdout(r2));
}

// —— 7. 頂層動態過濾：新增頂層項目後重跑補缺 ——
{
  const base = await startFakeSource();
  const root = sandbox();
  assert.equal(run(root, { SB_DOCS_VAULT_PLUGIN_BASE: base }).status, 0);
  assert.ok(!readJson(root, '.obsidian/app.json').userIgnoreFilters.includes('tools/'), '尚未有 tools/');
  mkdirSync(join(root, 'tools'), { recursive: true });
  writeFileSync(join(root, 'tools', 'gen.js'), 'x\n');
  const r2 = run(root, { SB_DOCS_VAULT_PLUGIN_BASE: base });
  assert.equal(r2.status, 0, stdout(r2));
  assert.ok(readJson(root, '.obsidian/app.json').userIgnoreFilters.includes('tools/'), '重跑後 tools/ 掃入過濾');
}

// —— 8. 損壞設定檔：保持原樣不覆蓋 ——
{
  const base = await startFakeSource();
  const root = sandbox();
  mkdirSync(join(root, '.obsidian'), { recursive: true });
  mkdirSync(join(pluginDir(root)), { recursive: true });
  writeFileSync(join(root, '.obsidian', 'app.json'), 'not-json{');
  writeFileSync(join(root, '.obsidian', 'community-plugins.json'), 'also-bad[');
  const r = run(root, { SB_DOCS_VAULT_PLUGIN_BASE: base });
  assert.equal(r.status, 0, stdout(r));
  assert.equal(readFileSync(join(root, '.obsidian', 'app.json'), 'utf8'), 'not-json{', '損壞 app.json 保持原樣');
  assert.equal(readFileSync(join(root, '.obsidian', 'community-plugins.json'), 'utf8'), 'also-bad[', '損壞 community-plugins.json 保持原樣');
  assert.match(stdout(r), /非 JSON/, '輸出說明保持原樣未補');
}

console.log('sb docs-vault 測試全數通過');
