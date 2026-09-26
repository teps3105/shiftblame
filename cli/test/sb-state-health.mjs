import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const hook = fileURLToPath(new URL('../../hooks/shiftblame-guard.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'sb-health-'));
process.on('exit', () => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); rmSync(root, { recursive: true, force: true }); });
let serial = 0;
const at = '2026-09-09T00:00:00.000Z';
function fixture(raw) {
  const cwd = join(root, String(serial++));
  mkdirSync(join(cwd, '.shiftblame/tmp'), { recursive: true });
  const state = join(cwd, '.shiftblame/flow-state.json');
  if (raw !== undefined) writeFileSync(state, typeof raw === 'string' ? raw : JSON.stringify(raw));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  const gate = (tool, input, event = 'PreToolUse', extra = {}) => spawnSync(process.execPath, [hook], { cwd, input: JSON.stringify({ cwd, hook_event_name: event, tool_name: tool, tool_input: input, ...extra }), encoding: 'utf8' });
  const git = (...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
  const report = join(cwd, '.shiftblame/tmp/review-fixture.md');
  writeFileSync(report, '隔離測試 fixture，不代表實際對抗或授權。\n對抗判定：通過\n');
  return { cwd, state, run, gate, git, report };
}
const active = { slug: 'demo', ms: '001', node: 'build' };
// 2.4.0：空物件 {} 在 directState 放寬下屬合法 direct 態（非 invalid）——歸入合法區塊驗證。
// 舊流鍵（inputs／history 等）由讀取端 migrateStreams 剝除後依剩餘欄位分類——不再因流鍵形狀炸 invalid。
const invalid = ['{broken', 'null', '[]', { slug: null }, { node: 'build' },
  { ...active, node: 'unknown' },
  { ...active, node: 'ended' }, { ...active, lastAdv: 'bad' }, { ...active, edgeAt: 'bad' }];
for (const raw of invalid) {
  const f = fixture(raw), before = readFileSync(f.state, 'utf8');
  assert.equal(f.run('state').status, 1, before);
  for (const args of [['adversarial', f.report, '--point', '1'], ['commitmsg', 'fix: 接入驗證'], ['next', 'intent'], ['end', '--boss-ok']]) {
    const r = f.run(...args);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stderr, /接入異常/);
    assert.equal(readFileSync(f.state, 'utf8'), before);
  }
  for (const tool of ['Write', 'Edit', 'apply_patch', 'mcp__files__write_file', 'mcp__files__write_target']) {
    const input = tool === 'apply_patch' ? { input: `*** Begin Patch\n*** Update File: ${f.cwd}/README.md\n@@\n-x\n+y\n*** End Patch` } : { file_path: join(f.cwd, 'README.md') };
    const r = f.gate(tool, input);
    assert.equal(r.status, 2, `${tool}: ${r.stderr}`);
    assert.match(r.stderr, /接入異常/);
  }
  for (const tool of ['Bash', 'exec_command', 'functions.exec_command']) {
    // 封閉面：會消費或惡化異常狀態的動作（git 寫入＋sb 流程命令——與停等凍結同攔截面）
    for (const command of ['git commit -m "fix: 接入驗證"', 'git add .', 'sb adversarial review.md', 'sb end --boss-ok', 'sb sopreview']) {
      assert.equal(f.gate(tool, tool === 'Bash' ? { command } : { cmd: command }).status, 2, command);
    }
    // 修復自由（異常模式的目的）：修復腳本與唯讀查證放行——shell 對正式檔的寫入屬既有殘餘（同常規模式），由抽查承擔
    for (const command of ['node repair-state.mjs', 'node -e "require(\'fs\').writeFileSync(\'flow-state.json\',\'{}\')"', 'rg -n "a|b|c" .']) {
      assert.equal(f.gate(tool, tool === 'Bash' ? { command } : { cmd: command }).status, 0, command);
    }
    assert.equal(f.gate(tool, { cmd: 'sb state', command: 'sb state' }).status, 0);
  }
  assert.equal(f.gate('Read', { file_path: f.state }).status, 0);
  assert.equal(f.gate('Write', { file_path: f.state }).status, 0, '限定狀態恢復可執行');
  assert.equal(f.gate('Write', { file_path: join(f.cwd, '.shiftblame/tmp/diagnosis.md') }).status, 0);
  assert.equal(f.gate('Write', { file_path: join(f.cwd, '.shiftblame/demo/SLUG.md') }).status, 2, '不能用正式流程文件洗過接入');
  const notice = f.gate('', {}, 'SessionStart');
  assert.match(notice.stdout, /接入異常/);
  assert.equal(readFileSync(f.state, 'utf8'), before, '失敗原檔不被心跳或紀錄器洗成有效資料');
  assert.equal(existsSync(join(f.cwd, '.shiftblame/tmp/commit-stamp.json')), false);
}
// 損壞檔的 UserPromptSubmit 保持唯讀（2.5.2：恢復另存已拆——對話事實由平台承載，原檔不被洗動）。
{
  const f = fixture({ slug: null });
  const before = readFileSync(f.state, 'utf8');
  const r = f.gate('', {}, 'UserPromptSubmit', { prompt: '恢復前的新輸入\n原文保留' });
  assert.match(r.stdout, /接入異常/);
  assert.equal(readFileSync(f.state, 'utf8'), before);
  assert.equal(existsSync(join(f.cwd, '.shiftblame/tmp/recovery-inputs.jsonl')), false, '恢復另存機制已隨雙流拆除');
}
// 合法未初始化與直接實行：不建 slug——2.4.0 起無時點對抗（時點屬七段圓環流程），提交走 commitmsg 格式閘，提交消費後仍可查詢。
// 變體：純紀錄檔含 rewriteSeen（hooks 記錄鍵——HOOK_RECORD_KEYS 白名單容忍，不炸分類）；
// 純紀錄檔含 2.0x 老流鍵（stamps／unlockLog）——讀取端 migrateStreams 剝除後依剩餘欄位歸 direct 態（舊檔升級即瘦身）。
for (const initial of [undefined, { rewriteSeen: { rev: 0, at } }, { slug: null, ms: null, node: null, stamps: {}, unlockLog: [] }]) {
  const f = fixture(initial);
  assert.equal(f.run('state').status, 0);
  assert.equal(f.run('adversarial', f.report, '--point', '1').status, 1, '直接實行無時點對抗——時點屬七段圓環流程');
  assert.equal(f.run('state').status, 0);
  assert.match(f.run('state').stdout, /直接實行/);
  // 2.5.2：未覆蓋即凍結已隨理解流拆除——理解宣告由 think 於對話揭露，機械不再凍結寫入；
  // direct 態寫入放行（路由紀律由對話曝光＋老闆終審承擔）。
  assert.equal(f.gate('Write', { file_path: join(f.cwd, 'README.md' )}).status, 0, '對話承載：無機械凍結');
  assert.equal(f.git('init').status, 0);
  writeFileSync(join(f.cwd, '.gitignore'), '.shiftblame/\n');
  writeFileSync(join(f.cwd, 'README.md'), 'direct execution\n');
  assert.equal(f.git('add', '.').status, 0);
  const msg = 'fix: 驗證合法直接實行';
  const stamp = f.run('commitmsg', msg);
  assert.equal(stamp.status, 0, stamp.stderr);
  const gate = f.gate('Bash', { command: `git commit -m "${msg}"` });
  assert.equal(gate.status, 0, gate.stderr);
  assert.equal(f.git('-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', msg).status, 0);
  assert.equal(f.run('state').status, 0);
  assert.equal(existsSync(join(f.cwd, '.shiftblame/tmp/commit-stamp.json')), false, '印章於 commit 驗章焚章（一對一）');
  assert.equal(existsSync(join(f.cwd, '.shiftblame/demo')), false);
}
// ended 態容忍 rewriteSeen 殘留（hooks 記錄鍵屬 HOOK_RECORD_KEYS——sb end 冪等清理外的防禦深度，不炸白名單）。
{
  const f = fixture({ slug: 'demo', ms: '001', node: 'ended', endedAt: at, rewriteSeen: { rev: 1, at } });
  const r = f.run('state');
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /接入異常/);
}
// 已發章後狀態損壞：提交仍擋，不能以舊印章通行或消費它。
{
  const f = fixture({});
  assert.equal(f.run('commitmsg', 'fix: 驗證提交時重查').status, 0);
  const stamp = join(f.cwd, '.shiftblame/tmp/commit-stamp.json');
  const original = readFileSync(stamp, 'utf8');
  const st = JSON.parse(readFileSync(f.state, 'utf8'));
  writeFileSync(f.state, JSON.stringify({ ...st, slug: 'half-initialized' }));
  assert.equal(f.gate('Bash', { command: 'git commit -m "fix: 驗證提交時重查"' }).status, 2);
  assert.equal(readFileSync(stamp, 'utf8'), original, '印章未被消費');
}
{
  const f = fixture({ ...active, externalEvidence: null });
  assert.equal(f.run('state').status, 0, '正常外部證據重置仍有效');
}
// 2.4.0：空物件 directState——合法 direct 態可查詢、可發章。
{
  const f = fixture({});
  assert.equal(f.run('state').status, 0, '空物件屬合法 direct 態');
  assert.match(f.run('state').stdout, /直接實行/);
  assert.equal(f.run('commitmsg', 'fix: 空物件直接實行').status, 0);
}
// 正常段位仍遵守既有矩陣。
for (const initial of [undefined, { hooksHeartbeat: { at, event: 'PreToolUse' } }]) {
  for (const folder of ['old/001', 'archive/old']) {
    const f = fixture(initial);
    mkdirSync(join(f.cwd, '.shiftblame', folder), { recursive: true });
    const before = existsSync(f.state) ? readFileSync(f.state, 'utf8') : null;
    assert.equal(f.run('state').status, 1, '存在孤立骨架時不降級成全新工作區');
    assert.equal(f.run('init', 'next').status, 1);
    assert.equal(f.gate('Write', { file_path: join(f.cwd, 'README.md') }).status, 2);
    assert.equal(existsSync(f.state) ? readFileSync(f.state, 'utf8') : null, before);
    assert.equal(existsSync(join(f.cwd, '.shiftblame/next')), false);
  }
}
{
  const f = fixture();
  mkdirSync(join(f.cwd, '.shiftblame/archive'));
  writeFileSync(join(f.cwd, '.shiftblame/SOP.md'), '既有專案規範\n');
  assert.equal(f.run('state').status, 0, '純專案文件與空歸檔不強制開 slug');
  const stPath = f.state;
  const st = existsSync(stPath) ? JSON.parse(readFileSync(stPath, 'utf8')) : {};
  st.hooksHeartbeat = { at, event: 'SessionStart' };
  mkdirSync(join(f.cwd, '.shiftblame'), { recursive: true });
  writeFileSync(stPath, JSON.stringify(st));
  assert.equal(f.run('init', 'demo', '--no-git').status, 0, '另有開 slug 授權時仍可正常初始化');
  assert.deepEqual(JSON.parse(readFileSync(f.state, 'utf8')).hooksHeartbeat, st.hooksHeartbeat, 'hooks 紀錄接納不重置');
}
for (const [node, expected] of [['build', 0], ['verify', 2], ['intent', 0]]) {
  const f = fixture({ ...active, node });
  assert.equal(f.run('state').status, 0);
  assert.equal(f.gate('Write', { file_path: join(f.cwd, 'README.md') }).status, expected);
}
console.log('sb-state-health: pass');
