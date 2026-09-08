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
const active = { slug: 'demo', ms: '001', node: 'build', history: [] };
const invalid = ['{broken', 'null', '[]', '{}', { slug: null }, { node: 'build' },
  { ...active, history: null }, { ...active, node: 'unknown' },
  { slug: null, ms: null, node: null, history: [], stamps: {}, unlockLog: [] },
  { ...active, node: 'ended' }, { inputs: 'broken' }, { ...active, inputs: 'broken' },
  { ...active, adversarialLog: 'broken' }, { ...active, history: ['broken'] }];
for (const raw of invalid) {
  const f = fixture(raw), before = readFileSync(f.state, 'utf8');
  assert.equal(f.run('state').status, 1, before);
  for (const args of [['adversarial', f.report], ['commitmsg', 'fix: 接入驗證'], ['next', 'intent'], ['end', '--boss-ok']]) {
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
    for (const command of ['git commit -m "fix: 接入驗證"', 'node -e "require(\'fs\').writeFileSync(\'README.md\',\'bad\')"', 'sb adversarial review.md']) {
      assert.equal(f.gate(tool, tool === 'Bash' ? { command } : { cmd: command }).status, 2, command);
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
// 原始損壞資料的曝光也保持唯讀，新輸入另存待恢復。
{
  const as = '意圖：原始待審理解保留';
  const pending = { at, uptoInput: 0, as, reviewed: false, hash: createHash('sha256').update('0' + as + at).digest('hex').slice(0, 16) };
  const f = fixture({ slug: null, inputs: [{ at, text: '原始輸入' }], understandings: [pending] });
  const before = readFileSync(f.state, 'utf8');
  const r = f.gate('', {}, 'UserPromptSubmit', { prompt: '恢復前的新輸入\n原文保留' });
  assert.match(r.stdout, /待恢復輸入/);
  assert.equal(readFileSync(f.state, 'utf8'), before);
  const saved = JSON.parse(readFileSync(join(f.cwd, '.shiftblame/tmp/recovery-inputs.jsonl'), 'utf8').trim());
  assert.equal(saved.text, '恢復前的新輸入\n原文保留');
}
// 合法未初始化與直接實行：不建 slug，對抗後、提交消費後仍可查詢。
for (const initial of [undefined, { inputs: [{ at, text: '不開 slug，修復' }] }]) {
  const f = fixture(initial);
  assert.equal(f.run('state').status, 0);
  assert.equal(f.run('adversarial', f.report).status, 0);
  assert.equal(f.run('state').status, 0);
  assert.match(f.run('state').stdout, /直接實行/);
  assert.equal(f.gate('Write', { file_path: join(f.cwd, 'README.md') }).status, 0);
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
  assert.equal(JSON.parse(readFileSync(f.state, 'utf8')).adversarialConsumed, true);
  assert.equal(existsSync(join(f.cwd, '.shiftblame/demo')), false);
}
// 已發章後狀態損壞：提交仍擋，不能以舊印章通行或消費它。
{
  const f = fixture({ inputs: [{ at, text: '修復' }] });
  assert.equal(f.run('adversarial', f.report).status, 0);
  assert.equal(f.run('commitmsg', 'fix: 驗證提交時重查').status, 0);
  const stamp = join(f.cwd, '.shiftblame/tmp/commit-stamp.json');
  const original = readFileSync(stamp, 'utf8');
  const st = JSON.parse(readFileSync(f.state, 'utf8'));
  writeFileSync(f.state, JSON.stringify({ ...st, slug: 'half-initialized' }));
  assert.equal(f.gate('Bash', { command: 'git commit -m "fix: 驗證提交時重查"' }).status, 2);
  assert.equal(readFileSync(stamp, 'utf8'), original);
  assert.equal(JSON.parse(readFileSync(f.state, 'utf8')).adversarialConsumed, false);
}
// 沒有對抗的合法主動 think 停等可以查詢，仍不能写入或發章。
{
  const f = fixture({ inputs: [{ at, text: '/shiftblame:think' }], understandingHold: { at, inputIdx: 0 } });
  assert.equal(f.run('state').status, 0);
  assert.match(f.run('state').stdout, /停等/);
  assert.equal(f.gate('Write', { file_path: join(f.cwd, 'README.md') }).status, 2);
  assert.equal(f.run('adversarial', f.report).status, 1);
  assert.equal(f.run('init', 'demo').status, 1);
  for (const tool of ['exec_command', 'functions.exec_command', 'Bash']) {
    assert.equal(f.gate(tool, { cmd: 'git add README.md', command: 'git add README.md' }).status, 2, '所有支援 shell 均遵守停等');
    assert.equal(f.gate(tool, { cmd: 'sb next requirement --boss-ok', command: 'sb next requirement --boss-ok' }).status, 2);
  }
}
{
  const f = fixture({ ...active, externalEvidence: null });
  assert.equal(f.run('state').status, 0, '正常外部證據重置仍有效');
}
// 正常段位仍遵守既有矩陣。
for (const initial of [undefined, { inputs: [{ at, text: '修復' }] }]) {
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
  assert.equal(f.run('adversarial', f.report).status, 0);
  const st = JSON.parse(readFileSync(f.state, 'utf8'));
  const log = st.adversarialLog;
  st.adversarialConsumed = true;
  writeFileSync(f.state, JSON.stringify(st));
  assert.equal(f.run('init', 'demo').status, 0, '另有開 slug 授權時仍可正常初始化');
  assert.deepEqual(JSON.parse(readFileSync(f.state, 'utf8')).adversarialLog, log, '歷史提交紀錄保持原值');
}
for (const [node, expected] of [['build', 0], ['verify', 2], ['intent', 2]]) {
  const f = fixture({ ...active, node });
  assert.equal(f.run('state').status, 0);
  assert.equal(f.gate('Write', { file_path: join(f.cwd, 'README.md') }).status, expected);
}
const skill = readFileSync(new URL('../../skills/think/SKILL.md', import.meta.url), 'utf8');
assert.match(skill, /流程接入失敗先修復/);
assert.match(skill, /接入不等於開 slug/);
console.log('sb-state-health: PASS');
