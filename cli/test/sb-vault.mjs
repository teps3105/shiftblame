import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'sb-vault-'));
// 本測試只清理自己建立、位於系統暫存根內的絕對路徑。
process.on('exit', () => { assert.equal(resolve(root).startsWith(resolve(tmpdir()) + sep), true); rmSync(root, { recursive: true, force: true }); });
let serial = 0;
function fixture({ withGit = true, stalePlugin = false } = {}) {
  const cwd = join(root, String(serial++));
  mkdirSync(cwd, { recursive: true });
  if (withGit) spawnSync('git', ['init', '-q'], { cwd });
  mkdirSync(join(cwd, 'docs'), { recursive: true });
  writeFileSync(join(cwd, 'README.md'), '# demo\n');
  writeFileSync(join(cwd, 'package.json'), '{}\n');
  mkdirSync(join(cwd, 'skills'), { recursive: true });
  if (stalePlugin) {
    mkdirSync(join(cwd, '.obsidian', 'plugins', 'hidden-folders-access'), { recursive: true });
    writeFileSync(join(cwd, '.obsidian', 'plugins', 'hidden-folders-access', 'main.js'), '/* stale */\n');
    writeFileSync(join(cwd, '.obsidian', 'community-plugins.json'), '["hidden-folders-access"]\n');
  }
  const globalDir = join(cwd, '..', 'global', String(serial));
  const run = () => spawnSync(process.execPath, [cli, 'vault'], { cwd, encoding: 'utf8', env: { ...process.env, SB_OBSIDIAN_GLOBAL: globalDir } });
  return {
    cwd, globalDir, regPath: join(globalDir, 'obsidian.json'),
    appJsonPath: join(cwd, '.obsidian', 'app.json'),
    appearanceJsonPath: join(cwd, '.obsidian', 'appearance.json'),
    snippetPath: join(cwd, '.obsidian', 'snippets', 'sb-vault-filter.css'),
    run,
  };
}

// —— 1. 初始化並註冊：.obsidian/app.json 規定集（docs／README 之外全部隱藏）＋檔案總管 snippet＋全域註冊表補掛 ——
{
  const f = fixture();
  const r = f.run();
  assert.equal(r.status, 0, r.stderr);
  const cfg = JSON.parse(readFileSync(f.appJsonPath, 'utf8'));
  assert.deepEqual(cfg.userIgnoreFilters, ['package.json', 'skills/'], '規定集＝顯示集（docs/＋README.md）之外的頂層非 dot 項');
  const css = readFileSync(f.snippetPath, 'utf8');
  assert.match(css, /\.nav-folder-title:not\(\[data-path\*="\/"\]\):not\(\[data-path="docs"\]/, 'snippet 頂層 folder 反白名單');
  assert.match(css, /\.nav-file-title:not\(\[data-path\*="\/"\]\):not\(\[data-path="README\.md"\]/, 'snippet 頂層 file 反白名單');
  assert.match(css, /display:\s*none\s*!important/, '白名單外一律 display:none');
  const appearance = JSON.parse(readFileSync(f.appearanceJsonPath, 'utf8'));
  assert.deepEqual(appearance.enabledCssSnippets, ['sb-vault-filter'], 'snippet 已啟用');
  const reg = JSON.parse(readFileSync(f.regPath, 'utf8'));
  const entries = Object.values(reg.vaults);
  assert.equal(entries.length, 1, '補掛一條 vault');
  assert.equal(entries[0].path, f.cwd, '註冊路徑＝sandbox repo 根');
  assert.match(r.stdout, /已補掛全域註冊表/);
  assert.match(r.stdout, /已生成並啟用/);
  assert.match(readFileSync(join(f.cwd, '.gitignore'), 'utf8'), /\.obsidian\//, '.gitignore 補忽略 .obsidian/');
}

// —— 2. 冪等：重跑零新增（過濾器無漂移、snippet 不重寫、註冊不重寫） ——
{
  const f = fixture();
  f.run();
  const before = readFileSync(f.appJsonPath, 'utf8');
  const cssBefore = readFileSync(f.snippetPath, 'utf8');
  const appearanceBefore = readFileSync(f.appearanceJsonPath, 'utf8');
  const regBefore = readFileSync(f.regPath, 'utf8');
  const r = f.run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /無漂移/);
  assert.match(r.stdout, /檔案總管過濾已生效/, 'snippet 無漂移不重寫');
  assert.match(r.stdout, /已註冊/);
  assert.equal(readFileSync(f.appJsonPath, 'utf8'), before, 'app.json 未被重寫');
  assert.equal(readFileSync(f.snippetPath, 'utf8'), cssBefore, 'snippet 未被重寫');
  assert.equal(readFileSync(f.appearanceJsonPath, 'utf8'), appearanceBefore, 'appearance.json 未被重寫');
  assert.equal(readFileSync(f.regPath, 'utf8'), regBefore, '註冊表未被重寫');
}

// —— 3. 漂移校正：手動改過濾器 → 重跑對齊規定集 ——
{
  const f = fixture();
  f.run();
  writeFileSync(f.appJsonPath, JSON.stringify({ userIgnoreFilters: ['隨手加的/'], attachmentFolderPath: 'assets' }));
  const r = f.run();
  assert.equal(r.status, 0, r.stderr);
  const cfg = JSON.parse(readFileSync(f.appJsonPath, 'utf8'));
  assert.deepEqual(cfg.userIgnoreFilters, ['package.json', 'skills/'], '漂移重寫為規定集');
  assert.equal(cfg.attachmentFolderPath, 'assets', '非過濾鍵不動');
}

// —— 3b. 檔案總管漂移：snippet 停用或內容遭改 → 重跑恢復；使用者既有 snippet 與外觀鍵保留 ——
{
  const f = fixture();
  f.run();
  writeFileSync(f.appearanceJsonPath, JSON.stringify({ enabledCssSnippets: ['我的主題微調'], cssTheme: 'Obsidian' }));
  writeFileSync(f.snippetPath, '/* 被人改掉的內容 */\n');
  const r = f.run();
  assert.equal(r.status, 0, r.stderr);
  const appearance = JSON.parse(readFileSync(f.appearanceJsonPath, 'utf8'));
  assert.deepEqual(appearance.enabledCssSnippets, ['我的主題微調', 'sb-vault-filter'], '補啟用不整表接管');
  assert.equal(appearance.cssTheme, 'Obsidian', '外觀鍵不動');
  assert.match(readFileSync(f.snippetPath, 'utf8'), /nav-folder-title/, 'snippet 內容漂移重寫');
  assert.match(r.stdout, /內容已更新|已生成並啟用/, 'snippet 漂移訊息');
}

// —— 4. 舊機制外掛殘留清除（無外掛形態的單一事實） ——
{
  const f = fixture({ stalePlugin: true });
  const r = f.run();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(existsSync(join(f.cwd, '.obsidian', 'plugins', 'hidden-folders-access')), false, 'hidden-folders-access 已清除');
  assert.equal(existsSync(join(f.cwd, '.obsidian', 'community-plugins.json')), false, 'community-plugins.json 已清除');
  assert.match(r.stdout, /已移除舊外掛殘留/);
}

// —— 5. 全域註冊表已有他 vault：補掛不動既有條目；已註冊同路徑則冪等 ——
{
  const f = fixture();
  mkdirSync(f.globalDir, { recursive: true });
  writeFileSync(f.regPath, JSON.stringify({ vaults: { aaaa000000000000: { path: 'D:\\其他專案', ts: 123 } } }));
  const r = f.run();
  assert.equal(r.status, 0, r.stderr);
  const reg = JSON.parse(readFileSync(f.regPath, 'utf8'));
  assert.equal(Object.keys(reg.vaults).length, 2, '既有條目保留＋補掛一條');
  assert.equal(reg.vaults.aaaa000000000000.path, 'D:\\其他專案', '既有 vault 條目不動');
  const mine = Object.entries(reg.vaults).find(([id]) => id !== 'aaaa000000000000')[1];
  assert.equal(mine.path, f.cwd);
  f.run();
  const regAfter = JSON.parse(readFileSync(f.regPath, 'utf8'));
  assert.equal(Object.keys(regAfter.vaults).length, 2, '重跑不新增條目');
}

// —— 6. 註冊表毀損：重建空表後註冊；app.json／appearance.json 毀損保持原樣不擋 ——
{
  const f = fixture();
  mkdirSync(f.globalDir, { recursive: true });
  mkdirSync(join(f.cwd, '.obsidian'), { recursive: true });
  writeFileSync(f.regPath, '不是 JSON');
  writeFileSync(f.appJsonPath, '也不是 JSON');
  writeFileSync(f.appearanceJsonPath, '也不是 JSON');
  const r = f.run();
  assert.equal(r.status, 0, r.stderr);
  const reg = JSON.parse(readFileSync(f.regPath, 'utf8'));
  assert.equal(Object.values(reg.vaults).length, 1, '毀損註冊表重建後補掛');
  assert.match(r.stdout, /非 JSON——保持原樣/, 'app.json 毀損不擋命令，揭露未設定');
  assert.match(r.stdout, /appearance\.json 非 JSON/, 'appearance.json 毀損不擋命令，揭露 snippet 未啟用');
  assert.equal(readFileSync(f.appearanceJsonPath, 'utf8'), '也不是 JSON', '毀損 appearance.json 原樣');
}

console.log('sb-vault: 全部場景通過');
