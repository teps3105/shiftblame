import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// README 唯一根目錄（assets/DOCS.md §0 文件位置）：README.md 只允許存在於 repo 根目錄一份——
// 模塊 README 與 docs/README.md 索引皆多重來源；其餘專案文件統一 docs/。
// 機械面：hooks 寫入攔截（寫入非根 README.md 即擋；刪除類放行＝清理通道）＋
// sb commitmsg 掃 git 追蹤集（存量違規擋提交直至清理——規範溯及既往；大小寫不敏感）。
const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, '../bin/sb.mjs');
const hookBin = resolve(here, '../../hooks/shiftblame-guard.mjs');
const roots = [];
process.on('exit', () => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });

const sandbox = () => {
  const root = mkdtempSync(join(tmpdir(), 'sb-readme-'));
  roots.push(root);
  mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
  writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(git('init').status, 0);
  assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '--allow-empty', '-m', 'test: 初始提交').status, 0);
  return { root, git };
};
const run = (root, ...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const commitmsg = (root, msg = 'feat: 文件位置規則的機械驗證') => run(root, 'commitmsg', msg);
const hookRun = (root, tool, toolInput) => spawnSync(process.execPath, [hookBin], {
  input: JSON.stringify({ cwd: root, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: toolInput }),
  encoding: 'utf8',
});
const stdout = (r) => `${r.stdout}\n${r.stderr}`;

// —— 1. sb commitmsg：追蹤集掃描（溯及既往——存量違規擋提交，不限 staged）——
{
  const { root } = sandbox();
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'mod'), { recursive: true });
  writeFileSync(join(root, 'docs', 'README.md'), '# docs 索引（違規）\n');
  writeFileSync(join(root, 'mod', 'README.md'), '# 模塊說明（違規）\n');
  writeFileSync(join(root, 'app.txt'), 'base\n');
  assert.equal(spawnSync('git', ['add', '.'], { cwd: root }).status, 0);
  assert.equal(spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: 帶存量違規的初始提交'], { cwd: root }).status, 0);
  // 存量違規未 staged 任何變更也擋——追蹤集掃描（溯及既往）
  const blocked = commitmsg(root);
  assert.notEqual(blocked.status, 0, '存量非根 README 擋提交（溯及既往）');
  assert.match(stdout(blocked), /README 唯一根目錄/);
  assert.match(stdout(blocked), /docs\/README\.md/);
  assert.match(stdout(blocked), /mod\/README\.md/);
  // 清理通道：git rm 移出追蹤集後放行（印章寫入）
  assert.equal(spawnSync('git', ['rm', '-q', 'docs/README.md', 'mod/README.md'], { cwd: root }).status, 0);
  const cleared = commitmsg(root);
  assert.equal(cleared.status, 0, `清理後發章：${stdout(cleared)}`);
  assert.ok(existsSync(join(root, '.shiftblame/tmp/commit-stamp.json')), '印章已寫入');
}

// —— 2. sb commitmsg：staged 新增違規與大小寫變體；根目錄 README.md 合法 ——
{
  const { root, git } = sandbox();
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', '主題.md'), '# 系統行為說明（合法）\n');
  writeFileSync(join(root, 'docs', 'readme.MD'), '# 大小寫變體（違規）\n');
  writeFileSync(join(root, 'README.md'), '# 根目錄門面（合法）\n');
  assert.equal(git('add', '.').status, 0);
  const blocked = commitmsg(root);
  assert.notEqual(blocked.status, 0, 'staged docs/readme.MD 擋提交（大小寫不敏感）');
  assert.match(stdout(blocked), /docs\/readme\.MD/);
  assert.doesNotMatch(stdout(blocked), /主題\.md/, 'docs/ 主題文件非違規項');
  assert.equal(git('rm', '--cached', '-q', 'docs/readme.MD').status, 0);
  rmSync(join(root, 'docs', 'readme.MD'));
  const cleared = commitmsg(root);
  assert.equal(cleared.status, 0, `根 README 與 docs/ 主題文件放行：${stdout(cleared)}`);
}

// —— 3. hooks 寫入攔截：寫非根 README.md 即擋；刪除類放行；docs/ 主題文件放行 ——
{
  const { root } = sandbox();
  const denyWrite = hookRun(root, 'Write', { file_path: join(root, 'docs', 'README.md'), content: '# 索引\n' });
  assert.notEqual(denyWrite.status, 0, 'hooks 擋寫 docs/README.md');
  assert.match(stdout(denyWrite), /README 唯一根目錄/);
  const denyModule = hookRun(root, 'Write', { file_path: join(root, 'mod', 'readme.md'), content: '# 模塊\n' });
  assert.notEqual(denyModule.status, 0, 'hooks 擋寫模塊 readme.md（大小寫不敏感）');
  const denyEdit = hookRun(root, 'Edit', { file_path: join(root, 'src', 'README.MD'), old_string: 'a', new_string: 'b' });
  assert.notEqual(denyEdit.status, 0, 'hooks 擋 Edit 非根 README.MD');
  const allowRoot = hookRun(root, 'Write', { file_path: join(root, 'README.md'), content: '# 根目錄門面\n' });
  assert.equal(allowRoot.status, 0, '根目錄 README.md 放行');
  const allowDocs = hookRun(root, 'Write', { file_path: join(root, 'docs', '主題.md'), content: '# 行為\n' });
  assert.equal(allowDocs.status, 0, 'docs/ 主題文件放行');
  const allowDelete = hookRun(root, 'Delete', { file_path: join(root, 'docs', 'README.md') });
  assert.equal(allowDelete.status, 0, '刪除類工具放行（存量違規的清理通道）');
  const allowMoveOut = hookRun(root, 'Move', { path: join(root, 'mod', 'README.md'), destination: join(root, 'docs', '模塊說明.md') });
  assert.equal(allowMoveOut.status, 0, '搬移類只判落點——搬出違規位置放行');
  const denyMoveIn = hookRun(root, 'Move', { path: join(root, 'README.md'), destination: join(root, 'docs', 'README.md') });
  assert.notEqual(denyMoveIn.status, 0, '搬移落點為非根 README.md 擋');
  const allowOutside = hookRun(root, 'Write', { file_path: join(tmpdir(), 'outside-readme', 'README.md'), content: '# 專案外\n' });
  assert.equal(allowOutside.status, 0, '專案外路徑不歸此規則管');
}

// —— 4. 文件陳述錨（SKILL §1 A9：MUST 級機制的行為測試 MUST 附文件陳述錨——機制拆除時測試與錨同拆）——
const skill = readFileSync(resolve(here, '../../skills/shiftblame/SKILL.md'), 'utf8');
const docs = readFileSync(resolve(here, '../../skills/shiftblame/assets/DOCS.md'), 'utf8');
const readme = readFileSync(resolve(here, '../../README.md'), 'utf8');
assert.match(skill, /README 唯一根目錄.*?docs\/（含索引）保持無 README/, '陳述錨：主 SKILL A9 仍述 README 唯一根目錄與機械承載');
assert.match(skill, /assets\/DOCS\.md 文件位置節/, '陳述錨：主 SKILL 指路 DOCS.md 文件位置節');
assert.match(docs, /文件位置（README 唯一根目錄/, '陳述錨：DOCS.md §0 文件位置節仍在');
assert.match(docs, /README\.md 僅允許存在於 repo 根目錄一份/, '陳述錨：DOCS.md 位置規則條文仍在');
assert.match(docs, /docs\/ 內保持無 README/, '陳述錨：DOCS.md 禁 README 索引條文仍在');
assert.match(docs, /追蹤集.*?溯及既往|溯及既往.*?追蹤集/s, '陳述錨：DOCS.md 述 commitmsg 追蹤集掃描與溯及既往');
assert.match(readme, /README 唯一根目錄/, '陳述錨：框架 README 仍述位置硬規則');

console.log('sb-readme-placement：README 唯一根目錄機械驗證全數通過');
