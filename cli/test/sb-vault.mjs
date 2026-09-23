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
  return { cwd, globalDir, regPath: join(globalDir, 'obsidian.json'), appJsonPath: join(cwd, '.obsidian', 'app.json'), run };
}

// —— 1. 初始化並註冊：.obsidian/app.json 規定集（docs／README 之外全部隱藏）＋全域註冊表補掛 ——
{
  const f = fixture();
  const r = f.run();
  assert.equal(r.status, 0, r.stderr);
  const cfg = JSON.parse(readFileSync(f.appJsonPath, 'utf8'));
  assert.deepEqual(cfg.userIgnoreFilters, ['package.json', 'skills/'], '規定集＝顯示集（docs/＋README.md）之外的頂層非 dot 項');
  const reg = JSON.parse(readFileSync(f.regPath, 'utf8'));
  const entries = Object.values(reg.vaults);
  assert.equal(entries.length, 1, '補掛一條 vault');
  assert.equal(entries[0].path, f.cwd, '註冊路徑＝sandbox repo 根');
  assert.match(r.stdout, /已補掛全域註冊表/);
  assert.match(readFileSync(join(f.cwd, '.gitignore'), 'utf8'), /\.obsidian\//, '.gitignore 補忽略 .obsidian/');
}

// —— 2. 冪等：重跑零新增（過濾器無漂移、註冊不重寫） ——
{
  const f = fixture();
  f.run();
  const before = readFileSync(f.appJsonPath, 'utf8');
  const regBefore = readFileSync(f.regPath, 'utf8');
  const r = f.run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /無漂移/);
  assert.match(r.stdout, /已註冊/);
  assert.equal(readFileSync(f.appJsonPath, 'utf8'), before, 'app.json 未被重寫');
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

// —— 6. 註冊表毀損：重建空表後註冊；app.json 毀損保持原樣不擋 ——
{
  const f = fixture();
  mkdirSync(f.globalDir, { recursive: true });
  mkdirSync(join(f.cwd, '.obsidian'), { recursive: true });
  writeFileSync(f.regPath, '不是 JSON');
  writeFileSync(f.appJsonPath, '也不是 JSON');
  const r = f.run();
  assert.equal(r.status, 0, r.stderr);
  const reg = JSON.parse(readFileSync(f.regPath, 'utf8'));
  assert.equal(Object.values(reg.vaults).length, 1, '毀損註冊表重建後補掛');
  assert.match(r.stdout, /非 JSON——保持原樣/, 'app.json 毀損不擋命令，揭露未設定');
}

console.log('sb-vault: 全部場景通過');
