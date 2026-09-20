import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repo, 'cli/bin/sb.mjs'), hook = join(repo, 'hooks/shiftblame-guard.mjs');
const before = '2020-01-01T00:00:00.000Z', sealedAt = '2020-01-02T00:00:00.000Z';
const entered = '2020-01-03T00:00:00.000Z', after = '2020-01-04T00:00:00.000Z';
const g1 = '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 現狀：現行畫面僅顯示部分結果且送出後無回饋\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n## 回指記錄\n';
const g2 = '# 技術\n使用既有入口完成需求並保留錯誤邊界，測試以真實輸出為依據。';
const g3 = '# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=畫面顯示完整結果 | 需要的證據=實際輸出 | 測試=result.test.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。';
function fixture(t, node = 'test') {
  const root = mkdtempSync(join(tmpdir(), 'sb-feedback-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ms = join(root, '.shiftblame/demo/001');
  mkdirSync(ms, { recursive: true }); mkdirSync(join(root, '.shiftblame/tmp'));
  writeFileSync(join(root, '.shiftblame/demo/SLUG.md'), '# 使用者資料送出\n');
  for (const [n, content] of [[1, g1], [2, g2], [3, g3]]) writeFileSync(join(ms, `G${n}.md`), content);
  const path = join(root, '.shiftblame/flow-state.json');
  const read = () => JSON.parse(readFileSync(path, 'utf8'));
  const write = s => writeFileSync(path, JSON.stringify(s, null, 2));
  const contract = { ms: '001', file: join(ms, 'G1.md'), sha256: createHash('sha256').update(g1.split('## 回指記錄')[0]).digest('hex'), sealedAt };
  write({ slug: 'demo', ms: '001', node, g1Contract: contract, edgeAt: { [`${node === 'test' ? 'plan' : 'test'}→${node}`]: entered }, lastBossInputAt: before, externalEvidence: { done: true, at: entered, tool: 'Agent' } });
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  const event = payload => spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
  const next = target => { const r = run('next', target); assert.equal(r.status, 0, r.stderr || r.stdout); return r; };
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
  git('init', '--initial-branch=main');
  writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
  git('add', '.gitignore'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'test: baseline');
  return { root, ms, read, write, run, event, next, git, contract };
}

test('測試揭露計畫錯誤後能回計畫與研究，修正再向前且保留需求核准', t => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'result.test.mjs'), '// 測試尚在撰寫，發現計畫前提不成立。\n');
  writeFileSync(join(f.ms, 'G2.md'), '無');
  f.next('plan');
  assert.equal(f.read().node, 'plan');
  assert.equal(f.event({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(f.ms, 'G3.md'), content: g3 } }).status, 0, '回計畫後取得 G3 寫入權');
  f.next('research');
  assert.equal(f.read().externalEvidence, null, '重新研究不能沿用前次外部查證標記');
  assert.equal(f.run('next', 'plan').status, 1, '缺本次研究證據時先完成研究');
  writeFileSync(join(f.ms, 'G2.md'), g2 + '\n採用已驗證的輸入邊界處理。');
  f.event({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { prompt: '測試夾具：外部查證事件' } });
  f.next('plan'); writeFileSync(join(f.ms, 'G3.md'), g3); f.next('test');
  assert.deepEqual(f.read().g1Contract, f.contract, '純技術回退完整保留需求封存');
  assert.equal(f.read().rev, undefined, '純技術回退不開新輪');
  assert.equal(readFileSync(join(f.root, 'result.test.mjs'), 'utf8').includes('前提'), true, '回退可保留未完成測試，不強迫先提交');
});

test('需求回查未變時 CLI 與 hook 沿用同一批准，初次或變更仍要核准', t => {
  const f = fixture(t, 'research');
  f.next('requirement');
  const command = 'node cli/bin/sb.mjs next research';
  assert.equal(f.event({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }).status, 0);
  f.next('research'); assert.deepEqual(f.read().g1Contract, f.contract);
  f.next('requirement');
  writeFileSync(join(f.ms, 'G1.md'), g1.replace('畫面顯示完整結果', '畫面顯示完整結果與摘要'));
  assert.equal(f.run('next', 'research').status, 1);
  assert.equal(f.event({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }).status, 2);
  writeFileSync(join(f.ms, 'G1.md'), g1);
  const st = f.read(); delete st.g1Contract; f.write(st);
  assert.equal(f.run('next', 'research').status, 1, '初次需求核准不能省略');
});

test('新意圖、錯誤契約來源與破損契約均不能沿用批准', t => {
  const f = fixture(t, 'requirement'), baseline = f.read();
  const variants = [
    { ...baseline, lastBossInputAt: after },
    { ...baseline, g1Contract: { ...f.contract, ms: '002' } },
    { ...baseline, g1Contract: { ...f.contract, file: join(f.root, 'other.md') } },
    { ...baseline, g1Contract: { ...f.contract, sealedAt: undefined } },
    { ...baseline, g1Contract: { ...f.contract, sha256: '0'.repeat(64) } },
  ];
  writeFileSync(join(f.root, 'other.md'), g1);
  for (const st of variants) {
    f.write(st);
    assert.equal(f.run('next', 'research').status, 1, JSON.stringify(st.g1Contract));
    const r = f.event({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next research' } });
    assert.equal(r.status, 2, r.stdout);
  }
  f.write(baseline); writeFileSync(join(f.ms, 'G1.md'), g1 + '## 回指記錄\n');
  assert.equal(f.run('next', 'research').status, 1);
});

test('五條相鄰回退均可執行，老闆新意圖仍不能被技術回退消化', t => {
  const f = fixture(t), baseline = f.read();
  for (const [from, to] of [['research','requirement'], ['plan','research'], ['test','plan'], ['build','test'], ['verify','build']]) {
    f.write({ ...baseline, node: from, edgeAt: { [`entry→${from}`]: entered } });
    f.next(to);
    assert.equal(f.read().rev, undefined);
    f.write({ ...baseline, node: from, edgeAt: { [`entry→${from}`]: entered }, lastBossInputAt: after });
    assert.equal(f.run('next', to).status, 1, `${from}→${to} 應先處理新意圖`);
  }
});

test('重進建置後使用最近進段時間，不受更早的首次進段時間誤擋', t => {
  const f = fixture(t, 'build');
  f.write({ ...f.read(), lastBossInputAt: sealedAt, edgeAt: { 'test→build': before, 'verify→build': entered } });
  f.next('test'); f.next('plan');
});

test('修復後重新驗收，兩個出口都拒絕舊的驗收檢閱', t => {
  const f = fixture(t, 'verify');
  f.write({ ...f.read(), edgeAt: { 'build→verify': entered }, lastAdv: { '2': { at: sealedAt, report: join(f.root, '.shiftblame/tmp/review.md'), verdict: '通過', node: 'verify' } } });
  assert.match(f.run('end', '--adversarial', '--boss-ok').stderr, /過期/);
  assert.match(f.run('next', 'intent', '--new-ms', '--adversarial', '--boss-ok').stderr, /過期/);
  assert.equal(f.read().ms, '001');
});

test('回退仍保留需求契約鎖定，不能從下游偷改需求', t => {
  const f = fixture(t);
  writeFileSync(join(f.ms, 'G1.md'), g1.replace('完整結果', '不同結果'));
  assert.match(f.run('next', 'plan').stderr, /偏離/);
  assert.equal(f.read().node, 'test');
  f.next('intent'); assert.equal(f.read().rev, 1);
});

test('驗收發現實作錯誤時，寫入提示引導回建置並恢復寫入權', t => {
  const f = fixture(t, 'verify');
  const startup = f.event({ hook_event_name: 'SessionStart' });
  assert.match(startup.stdout, /代理驗出問題時回 build／test 修復/);
  assert.doesNotMatch(startup.stdout, /驗不過 fail＝老闆新輸入/);
  const payload = { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(f.root, 'result.mjs'), content: 'export const result = true;\n' } };
  const blocked = f.event(payload);
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /技術修復沿合法邊回 build/);
  assert.doesNotMatch(blocked.stderr, /老闆新輸入重走 intent 開新輪後才可寫/);
  f.next('build');
  assert.equal(f.event(payload).status, 0, '正常技術回退後即可修正實作');
  assert.deepEqual(f.read().g1Contract, f.contract);
  assert.equal(f.read().rev, undefined);
});

test('技能與代理提示承載依證據回退的規則', t => {
  const skill = readFileSync(join(repo, 'skills/shiftblame/SKILL.md'), 'utf8');
  assert.match(skill, /依證據回退修正/);
  assert.match(skill, /test→plan/);
  assert.doesNotMatch(skill, /輪內單向定律|落地段回定義段必經 intent/);
  const f = fixture(t);
  const r = f.event({ hook_event_name: 'SessionStart' });
  assert.match(r.stdout, /依證據回退修正/);
});
