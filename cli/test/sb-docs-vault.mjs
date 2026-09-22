import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// sb docs-vault：以 <repo>/docs/ 為 Obsidian vault 根的自動建立——docs/ 與 docs/.obsidian/ 缺則建、
// .obsidian/ 最小配置補缺（既有檔不覆蓋——使用者自訂優先）、docs/.obsidian/ 忽略規則查證補行
// （git check-ignore --no-index 判定；非 Git 工作區直接規則辨識）。
// 範圍＝僅 <repo>/docs/：非 docs/ 文件不讀取；子儲存庫與 .shiftblame/ 不處理。
const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, '../bin/sb.mjs');
const roots = [];
process.on('exit', () => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });

const sandbox = ({ git = true, gitignore = '.shiftblame/\n' } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'sb-docs-vault-'));
  roots.push(root);
  mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
  if (gitignore !== null) writeFileSync(join(root, '.gitignore'), gitignore);
  if (git) {
    const g = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(g('init').status, 0);
    assert.equal(g('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '--allow-empty', '-m', 'test: 初始提交').status, 0);
  }
  return root;
};
const run = (root, ...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const stdout = (r) => `${r.stdout}\n${r.stderr}`;

// —— 1. 全新專案：docs/ 缺 → 建立 vault 結構＋.gitignore 補行＋git 判忽略 ——
{
  const root = sandbox();
  const r = run(root, 'docs-vault');
  assert.equal(r.status, 0, `docs-vault 應通過：${stdout(r)}`);
  assert.ok(existsSync(join(root, 'docs', '.obsidian', 'app.json')), 'docs/.obsidian/app.json 已建立');
  assert.equal(readFileSync(join(root, 'docs', '.obsidian', 'app.json'), 'utf8').trim(), '{}', 'app.json 為最小空配置');
  assert.match(readFileSync(join(root, '.gitignore'), 'utf8'), /^docs\/\.obsidian\/$/m, '.gitignore 已補 docs/.obsidian/');
  assert.equal(spawnSync('git', ['-C', root, 'check-ignore', '--quiet', '--', 'docs/.obsidian/']).status, 0, 'git 判 docs/.obsidian/ 已忽略');
  assert.match(stdout(r), /docs\/\.obsidian\/app\.json/, '輸出列出建立項');
  assert.match(stdout(r), /Graph View/, '輸出提示 Graph View 入口');
  // 範圍：vault 根即 docs/——未在 docs/ 外另建結構或連結（.shiftblame/ 僅 CLI 既有 tmp 紀錄）
  const top = readdirSync(root).filter((n) => !['.git', '.gitignore', 'docs', '.shiftblame'].includes(n));
  assert.equal(top.length, 0, `docs/ 外零新增：${top.join('、')}`);
}

// —— 2. 冪等：既有配置不覆蓋；結構齊備時重跑零變更 ——
{
  const root = sandbox();
  mkdirSync(join(root, 'docs', '.obsidian'), { recursive: true });
  writeFileSync(join(root, 'docs', '.obsidian', 'app.json'), '{"custom":true}');
  const r1 = run(root, 'docs-vault');
  assert.equal(r1.status, 0, stdout(r1));
  assert.equal(readFileSync(join(root, 'docs', '.obsidian', 'app.json'), 'utf8'), '{"custom":true}', '既有 app.json 不覆蓋');
  const gi1 = readFileSync(join(root, '.gitignore'), 'utf8');
  assert.match(gi1, /docs\/\.obsidian\//, '首次補行已發生');
  const r2 = run(root, 'docs-vault');
  assert.equal(r2.status, 0, stdout(r2));
  assert.equal(readFileSync(join(root, '.gitignore'), 'utf8'), gi1, '重跑不重複補行');
  assert.match(stdout(r2), /零變更/, '結構齊備時零變更');
}

// —— 3. 既有寬鬆規則（如 .obsidian/）已涵蓋 → .gitignore 原樣，不重複補 ——
{
  const root = sandbox({ gitignore: '.shiftblame/\n.obsidian/\n' });
  const r = run(root, 'docs-vault');
  assert.equal(r.status, 0, stdout(r));
  assert.equal(readFileSync(join(root, '.gitignore'), 'utf8'), '.shiftblame/\n.obsidian/\n', '已涵蓋時 .gitignore 原樣');
  assert.match(stdout(r), /已被忽略規則涵蓋/, '輸出說明規則已涵蓋');
}

// —— 4. 非 Git 工作區：直接規則辨識（有規則不重複補、無規則補行） ——
{
  const root = sandbox({ git: false, gitignore: 'docs/.obsidian/\n' });
  const r = run(root, 'docs-vault');
  assert.equal(r.status, 0, stdout(r));
  assert.equal(readFileSync(join(root, '.gitignore'), 'utf8'), 'docs/.obsidian/\n', '非 Git 直接規則命中，不重複補');

  const root2 = sandbox({ git: false });
  const r2 = run(root2, 'docs-vault');
  assert.equal(r2.status, 0, stdout(r2));
  assert.match(readFileSync(join(root2, '.gitignore'), 'utf8'), /^docs\/\.obsidian\/$/m, '非 Git 無規則時補行');
  assert.ok(existsSync(join(root2, 'docs', '.obsidian')), '非 Git 工作區照常建結構');
}

// —— 5. docs/ 已存在但缺 .obsidian/ → 只補缺，既有文件不受影響 ——
{
  const root = sandbox();
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', '主題.md'), '# 系統行為說明\n');
  const r = run(root, 'docs-vault');
  assert.equal(r.status, 0, stdout(r));
  assert.ok(existsSync(join(root, 'docs', '主題.md')), '既有 docs 文件保持原樣');
  assert.ok(existsSync(join(root, 'docs', '.obsidian', 'app.json')), '只補缺的 .obsidian/');
}

console.log('sb docs-vault 測試全數通過');
