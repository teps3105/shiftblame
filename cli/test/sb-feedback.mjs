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
const g1 = '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 現狀：現行畫面僅顯示部分結果且送出後無回饋\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n# 技術研究\n沿用既有送出入口，錯誤邊界以真實輸出驗證。\n## 回指記錄\n';
const g2 = '回指 G1：' + createHash('sha256').update(g1.split('## 回指記錄')[0]).digest('hex') + '\n# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=畫面顯示完整結果 | 需要的證據=實際輸出 | 測試=result.test.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。\n# 品質\n以送出後的實際畫面輸出為通過判準，驗證以真實輸出為依據。\n## 回指記錄\n';
const g3 = '回指 G2：pending\n# 實作紀錄\n沿用既有入口完成送出並保留錯誤邊界。\n## 回指記錄\n';
// 各段進入邊：fixture 依 node 記錄「上一邊」時戳，供回退／重進情境使用。
const ENTRY = { requirement: null, research: 'requirement→research', plan: 'research→plan', quality: 'plan→quality', build: 'quality→build', verify: 'build→verify' };
function fixture(t, node = 'quality') {
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
  write({ slug: 'demo', ms: '001', node, g1Contract: contract, edgeAt: ENTRY[node] ? { [ENTRY[node]]: entered } : {}, lastBossInputAt: before });
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  const event = payload => spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
  const next = target => { const r = run('next', target); assert.equal(r.status, 0, r.stderr || r.stdout); return r; };
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
  git('init', '--initial-branch=main');
  writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
  git('add', '.gitignore'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'test: baseline');
  return { root, ms, read, write, run, event, next, git, contract };
}

test('品質安排揭露計畫錯誤後能回計畫與研究，修正再向前且保留需求核准', t => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'result.test.mjs'), '// 測試尚在撰寫，發現計畫前提不成立。\n');
  writeFileSync(join(f.ms, 'G2.md'), '無');
  f.next('plan');
  assert.equal(f.read().node, 'plan');
  assert.equal(f.event({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(f.ms, 'G2.md'), content: g2 } }).status, 0, '回計畫後取得 G2 寫入權');
  f.next('research');
  writeFileSync(join(f.ms, 'G1.md'), g1);
  f.next('plan');
  writeFileSync(join(f.ms, 'G2.md'), g2); f.next('quality');
  assert.deepEqual(f.read().g1Contract, f.contract, '純技術回退完整保留需求封存');
  assert.equal(f.read().rev, undefined, '純技術回退不開新輪');
  assert.equal(readFileSync(join(f.root, 'result.test.mjs'), 'utf8').includes('前提'), true, '回退可保留未完成測試，不強迫先提交');
});

test('需求回查未變時 CLI 與 hook 沿用同一批准，初次或變更仍要核准', t => {
  const f = fixture(t, 'plan');
  f.next('research');
  const command = 'node cli/bin/sb.mjs next plan';
  assert.equal(f.event({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }).status, 0);
  f.next('plan'); assert.deepEqual(f.read().g1Contract, f.contract);
  f.next('research');
  writeFileSync(join(f.ms, 'G1.md'), g1.replace('畫面顯示完整結果', '畫面顯示完整結果與摘要'));
  assert.equal(f.run('next', 'plan').status, 1);
  assert.equal(f.event({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }).status, 2);
  writeFileSync(join(f.ms, 'G1.md'), g1);
  const st = f.read(); delete st.g1Contract; f.write(st);
  assert.equal(f.run('next', 'plan').status, 1, '初次需求核准不能省略');
});

test('錯誤契約來源與破損契約均不能沿用批准', t => {
  const f = fixture(t, 'research'), baseline = f.read();
  const variants = [
    { ...baseline, g1Contract: { ...f.contract, ms: '002' } },
    { ...baseline, g1Contract: { ...f.contract, file: join(f.root, 'other.md') } },
    { ...baseline, g1Contract: { ...f.contract, sealedAt: undefined } },
    { ...baseline, g1Contract: { ...f.contract, sha256: '0'.repeat(64) } },
  ];
  writeFileSync(join(f.root, 'other.md'), g1);
  for (const st of variants) {
    f.write(st);
    assert.equal(f.run('next', 'plan').status, 1, JSON.stringify(st.g1Contract));
    const r = f.event({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next plan' } });
    assert.equal(r.status, 2, r.stdout);
  }
  f.write(baseline); writeFileSync(join(f.ms, 'G1.md'), g1 + '## 回指記錄\n');
  assert.equal(f.run('next', 'plan').status, 1);
});

test('五條相鄰回退均可執行，老闆新意圖仍不能被技術回退消化', t => {
  const f = fixture(t), baseline = f.read();
  for (const [from, to] of [['plan','research'], ['quality','plan'], ['build','quality'], ['verify','build'], ['verify','quality']]) {
    f.write({ ...baseline, node: from, edgeAt: { [`entry→${from}`]: entered } });
    f.next(to);
    assert.equal(f.read().rev, undefined);
    f.write({ ...baseline, node: from, edgeAt: { [`entry→${from}`]: entered }, lastBossInputAt: after });
    assert.equal(f.run('next', to).status, 0, `${from}→${to} 不以舊輸入時間戳猜測新意圖`);
  }
});

test('重進建置後使用最近進段時間，不受更早的首次進段時間誤擋', t => {
  const f = fixture(t, 'build');
  f.write({ ...f.read(), lastBossInputAt: sealedAt, edgeAt: { 'quality→build': before, 'verify→build': entered } });
  f.next('quality'); f.next('plan');
});

test('修復後重新驗收，兩個出口都拒絕舊的驗收檢閱', t => {
  const f = fixture(t, 'verify');
  f.write({ ...f.read(), edgeAt: { 'build→verify': entered }, lastAdv: { '3': { at: sealedAt, report: join(f.root, '.shiftblame/tmp/review.md'), verdict: '通過', node: 'verify' } } });
  assert.match(f.run('end', '--adversarial', '--boss-ok').stderr, /過期/);
  assert.match(f.run('next', 'requirement', '--new-ms', '--adversarial', '--boss-ok').stderr, /過期/);
  assert.equal(f.read().ms, '001');
});

test('回退仍保留需求契約鎖定，不能從下游偷改需求', t => {
  const f = fixture(t);
  writeFileSync(join(f.ms, 'G1.md'), g1.replace('完整結果', '不同結果'));
  assert.match(f.run('next', 'plan').stderr, /偏離/);
  assert.equal(f.read().node, 'quality');
  f.next('requirement'); assert.equal(f.read().rev, 1);
});

test('驗收發現實作錯誤時，寫入提示引導回建置並恢復寫入權', t => {
  const f = fixture(t, 'verify');
  const startup = f.event({ hook_event_name: 'SessionStart' });
  assert.equal(startup.status, 0);
  const payload = { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(f.root, 'result.mjs'), content: 'export const result = true;\n' } };
  const blocked = f.event(payload);
  assert.equal(blocked.status, 2);
  assert.ok(blocked.stderr.includes('result.mjs'));
  assert.doesNotMatch(blocked.stderr, /新輸入.*開新輪後才可寫/);
  f.next('build');
  assert.equal(f.event(payload).status, 0, '正常技術回退後即可修正實作');
  assert.deepEqual(f.read().g1Contract, f.contract);
  assert.equal(f.read().rev, undefined);
});

const records = (root) => { try { return JSON.parse(readFileSync(join(root, '.shiftblame/tmp/hook-records.json'), 'utf8')); } catch { return {}; } };

test('連續失敗引導回退並標記時點待重審，重審推進解除', t => {
  const f = fixture(t, 'build');
  const fail = () => f.event({ hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', session_id: 's1' });
  assert.equal(fail().stdout, '', '未達閾值不注入');
  assert.equal(fail().stdout, '');
  const third = fail();
  assert.ok(third.stdout.includes('回退引導') && third.stdout.includes('sb next quality'), '閾值注入回退引導');
  assert.ok(records(f.root).failureNudge?.count === 3 && records(f.root).suspect?.['2'], '計數與待重審標記落 tmp/hook-records.json');
  const ss = f.event({ hook_event_name: 'SessionStart', session_id: 's1', source: 'startup' });
  assert.ok(ss.stdout.includes('時點待重審') && ss.stdout.includes('quality→build'), '段注入顯示待重審與重審邊');
  f.event({ hook_event_name: 'PostToolUse', tool_name: 'Bash', session_id: 's1' });
  assert.equal(records(f.root).failureNudge, undefined, '工具成功歸零連續計數');
  assert.ok(records(f.root).suspect?.['2'], '標記不隨成功清除——解除靠時點重審');
  // 時點 2 重審：quality→build 再次推進（G2 未變——契約沿用，對抗條目重新留痕；帶 g2 鍵避免舊語義遷移）
  const report = join(f.root, '.shiftblame/tmp/review2.md');
  writeFileSync(report, '審查模型：重審\n通過\n');
  const g2Hash = createHash('sha256').update(g2.split('## 回指記錄')[0]).digest('hex');
  f.write({ ...f.read(), node: 'quality', lastAdv: { '2': { at: new Date().toISOString(), report, verdict: '通過', node: 'quality', g2: g2Hash } } });
  const r = f.run('next', 'build', '--adversarial', '--boss-ok');
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.ok(r.stdout.includes('時點 2 重審通過'), '推進訊息載明重審通過');
  assert.equal(records(f.root).suspect, undefined, '重審通過後待重審標記清除');
});

test('失敗升級裁示：改動前先問老闆一次，唯讀不受閘', t => {
  const f = fixture(t, 'build');
  for (let i = 0; i < 6; i++) f.event({ hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', session_id: 's1' });
  const warn = f.event({ hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', session_id: 's1' });
  assert.ok(warn.stdout.includes('回退裁示') && warn.stdout.includes('AskUserQuestion'), '閾值二注入裁示要求問老闆');
  const edit = { hook_event_name: 'PreToolUse', tool_name: 'Edit', session_id: 's1', tool_input: { file_path: join(f.root, 'a.js'), content: 'x' } };
  const asked = f.event(edit);
  assert.ok(asked.stdout.includes('permissionDecision'), '改動觸發 ask');
  assert.ok(records(f.root).failureNudge?.askedAt, 'askedAt 落檔——同一輪升級只問一次');
  assert.equal(f.event(edit).stdout.includes('permissionDecision'), false, '已問過不再 ask');
  assert.equal(f.event({ hook_event_name: 'PreToolUse', tool_name: 'Read', session_id: 's1', tool_input: { file_path: join(f.root, 'a.js') } }).status, 0, '唯讀查證不受閘');
});

test('換段重置連續計數；計畫段失敗標記時點 1，品質段不標', t => {
  const f = fixture(t, 'build');
  const fail = () => f.event({ hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', session_id: 's1' });
  fail(); fail();
  f.write({ ...f.read(), node: 'quality', edgeAt: { 'plan→quality': entered } });
  fail();
  assert.ok(records(f.root).failureNudge?.count === 1 && records(f.root).failureNudge?.node === 'quality', '換段計數重置');
  fail(); fail();
  const qThird = fail();
  assert.ok(qThird.stdout.includes('sb next plan') && records(f.root).suspect?.['1'] === undefined, '品質段引導回計畫且不標上游時點');
  f.write({ ...f.read(), node: 'plan', edgeAt: { 'research→plan': entered } });
  fail(); fail();
  const pThird = fail();
  assert.ok(pThird.stdout.includes('sb next research'), '計畫段引導回研究');
  assert.ok(records(f.root).suspect?.['1'], '計畫段連續失敗標記時點 1 待重審');
});
