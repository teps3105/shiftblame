// sb-interview：產品訪談閘——有對話代號的工作階段自動建立 .shiftblame 工作區；訪談不封鎖專案檔案寫入、
// git commit／push 與 sb 命令，只在寫入紀錄本身時要求提問證據：每一輪自上一輪完成（或對話開始）後
// 須至少一次提問工具（名稱以 ask 開頭）呼叫，有證據直接放行；開場標記由 hook 維護，紀錄出現新的完成輪
// 時推進基準並歸零計數；恢復的對話須提問後追加新的一輪，壓縮續接沿用；子代理與無對話代號的呼叫不設閘；
// 家目錄、其上層不自動建立；防護出錯時放行並記錄。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { interviewPath, interviewToken, parseInterview } from '../bin/interview.mjs';

const hook = fileURLToPath(new URL('../../hooks/shiftblame-guard.mjs', import.meta.url));
const base = mkdtempSync(join(tmpdir(), 'sb-interview-'));
process.on('exit', () => rmSync(base, { recursive: true, force: true }));
// 假家目錄：hook 以 HOME／USERPROFILE 判定家目錄，測試不碰真實家目錄。
const home = join(base, 'home');
const env = { ...process.env };
for (const k of Object.keys(env)) if (['HOME', 'USERPROFILE'].includes(k.toUpperCase())) delete env[k];
Object.assign(env, { HOME: home, USERPROFILE: home });
const repo = (dir) => { mkdirSync(dir, { recursive: true }); assert.equal(spawnSync('git', ['init', '-q', dir]).status, 0); return dir; };
const proj = repo(join(home, 'proj'));
const run = (event, payload = {}, cwd = proj) =>
  spawnSync(process.execPath, [hook], { encoding: 'utf8', env, input: JSON.stringify({ cwd, hook_event_name: event, ...payload }) });
const context = (r) => (r.stdout ? JSON.parse(r.stdout).hookSpecificOutput?.additionalContext ?? '' : '');
const decision = (r) => (r.stdout ? JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision : undefined);
const markerOf = () => JSON.parse(readFileSync(marker, 'utf8'));
const slash = (p) => p.replace(/\\/g, '/');

const sid = 'e2b7c1d0-0000-4000-8000-000000000001';
const token = interviewToken(sid);
const record = interviewPath(proj, token);
const marker = record.replace(/\.md$/, '.json');
const rel = `.shiftblame/tmp/interview-${token}.md`;
const tool = (name, tool_input, cwd = proj, session_id = sid) => run('PreToolUse', { session_id, tool_name: name, tool_input }, cwd);
const sh = (command, cwd, session_id) => tool('Bash', { command }, cwd, session_id);
const ps = (command) => tool('PowerShell', { command });
const ask = () => tool('AskUserQuestion', { questions: [{ question: '逾時要保留購物車嗎？' }] });
const round = (n, over = {}) => {
  const f = { 觸發: '新對話', 使用者原話: '「修好登入逾時」', 提問: '「逾時要保留購物車嗎？」', 目標: '登入逾時後可重試', 範圍: '只改 auth 模組', 限制與授權: '不動資料庫', 驗收: '逾時後出現重試按鈕', 未決: '無', 使用者確認: '使用者：確認', ...over };
  return `\n## 第 ${n} 輪 2026-09-27T10:0${n}\n\n${Object.entries(f).filter(([, v]) => v !== null).map(([k, v]) => `- ${k}：${v}`).join('\n')}\n`;
};
const HEAD = '---\ntitle: 產品訪談紀錄\n---\n\n# 產品訪談紀錄\n';

// —— 1. 紀錄解析：六個必填欄位；佔位符不算；子項可承載欄位內容；其他標題結束一輪 ——
{
  assert.equal(interviewToken(sid).length, 12);
  assert.equal(interviewToken(sid), interviewToken(sid), '同一對話代號得到同一紀錄');
  assert.notEqual(interviewToken(sid), interviewToken(`${sid}x`));
  let p = parseInterview(HEAD + round(1));
  assert.equal(p.complete, 1);
  p = parseInterview(HEAD + round(1, { 提問: '<提問>', 目標: '<目標>', 驗收: '（填）', 使用者確認: 'TODO', 範圍: null }));
  assert.deepEqual(p.rounds[0].missing, ['提問', '目標', '範圍', '驗收', '使用者確認'], '佔位符與缺欄都列為缺少');
  p = parseInterview(`## 第1輪\n* 觸發: 新對話\n- 提問: 為什麼\n- 目標：x\n- 範圍：y\n- 驗收：\n  - 逾時後出現重試按鈕\n  - 重試後回到原頁\n- 使用者確認：確認\n`);
  assert.equal(p.complete, 1, '半形冒號、* 項目與縮排子項都可承載欄位');
  assert.match(p.rounds[0].fields['驗收'], /重試後回到原頁/);
  p = parseInterview(`## 第 1 輪\n- 觸發：新對話\n- 提問：為什麼\n- 目標：x\n## 附註\n- 範圍：y\n- 驗收：z\n- 使用者確認：確認\n`);
  assert.deepEqual(p.rounds[0].missing, ['範圍', '驗收', '使用者確認'], '其他二級標題結束該輪');
  assert.equal(parseInterview(null).complete, 0);
}

// —— 2. 開場自動初始化：只建 .shiftblame/、tmp/ 與忽略全部內容的 .gitignore，不寫 flow-state ——
let r = run('SessionStart', { session_id: sid, source: 'startup' });
assert.equal(r.status, 0, r.stderr);
assert.equal(readFileSync(join(proj, '.shiftblame', '.gitignore'), 'utf8'), '*\n');
assert.ok(existsSync(join(proj, '.shiftblame', 'tmp')));
assert.equal(existsSync(join(proj, '.shiftblame', 'flow-state.json')), false, '自動初始化不寫 flow-state');
assert.equal(spawnSync('git', ['-C', proj, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }).stdout, '', '.shiftblame 由自身的 .gitignore 排除');
assert.match(context(r), /\[訪談\] 先做產品訪談/);
assert.ok(context(r).includes(rel), '開場提示指出本對話的紀錄路徑');
assert.match(context(r), /INTERVIEW\.md/, '開場提示附範本位置');
assert.match(context(r), /AskUserQuestion/, '開場提示要求先提問');
assert.deepEqual({ base: markerOf().base, asks: markerOf().asks, pending: markerOf().pending }, { base: 0, asks: 0, pending: false }, '開場標記記下已完成輪數與提問計數');

// —— 3. 訪談不封鎖其他工作：專案寫入、推送與 sb 命令照常；提交仍由印章檢查把關 ——
r = tool('Write', { file_path: join(proj, 'src', 'app.js'), content: 'x' });
assert.equal(r.status, 0, r.stderr);
assert.equal(tool('Edit', { file_path: 'src/app.js', old_string: 'a', new_string: 'b' }).status, 0, '相對路徑以 cwd 展開');
r = sh('git commit -m x');
assert.equal(r.status, 2);
assert.doesNotMatch(r.stderr, /產品訪談/, '提交不因訪談未完成而受阻');
assert.match(r.stderr, /印章/, '提交由印章檢查處理');
assert.equal(sh('git push origin main').status, 0, '推送不因訪談未完成而受阻');
assert.equal(sh('node cli/bin/sb.mjs state').status, 0, 'sb 命令照常');
for (const [name, input] of [['Write', { file_path: join(proj, '.shiftblame', 'tmp', 'notes.md') }], ['Write', { file_path: '.shiftblame/tmp/notes.md' }],
  ['Write', { file_path: join(base, 'outside.txt') }], ['Read', { file_path: join(proj, 'src', 'app.js') }], ['TodoWrite', { todos: [] }]]) {
  r = tool(name, input);
  assert.equal(r.status, 0, `${name} ${JSON.stringify(input)}`);
  assert.equal(decision(r), undefined, `${name} 不詢問`);
}
for (const command of ['git status', 'git log --oneline', 'sb state', 'ls']) assert.equal(sh(command).status, 0, command);

// —— 4. 寫訪談紀錄須有提問證據：未提問即拒（寫入工具與 shell 重定向同判），開場標記一律拒絕 ——
for (const r2 of [tool('Write', { file_path: record, content: HEAD }), tool('Write', { file_path: rel, content: HEAD }),
  sh(`printf '%s' x >> ${slash(record)}`), ps(`Add-Content -Path '${record}' -Value x`)]) {
  assert.equal(r2.status, 2, r2.stderr);
  assert.match(r2.stderr, /提問/);
  assert.match(r2.stderr, /AskUserQuestion/);
  assert.equal(decision(r2), undefined, '不再以權限提示詢問');
}
for (const r2 of [tool('Write', { file_path: marker, content: '{"base":0}' }), sh(`echo '{}' > ${slash(marker)}`)]) {
  assert.equal(r2.status, 2);
  assert.match(r2.stderr, /開場標記由 hook 維護/);
}

// —— 5. 提問工具呼叫累計為本輪證據：提問後寫紀錄直接放行 ——
r = ask();
assert.equal(r.status, 0, r.stderr);
assert.equal(markerOf().asks, 1, 'AskUserQuestion 計入本輪提問');
r = tool('Write', { file_path: record, content: HEAD });
assert.equal(r.status, 0, r.stderr);
assert.equal(decision(r), undefined, '有提問證據就不再詢問');

// —— 6. 紀錄不完整：提示列出缺漏欄位（含提問） ——
writeFileSync(record, HEAD + round(1, { 提問: '<提問>', 目標: '<目標>', 範圍: null, 驗收: null, 使用者確認: '（填）' }));
assert.match(context(run('UserPromptSubmit', { session_id: sid, prompt: '繼續' })), /訪談未完成.*第 1 輪缺少：提問、目標、範圍、驗收、使用者確認/);

// —— 7. 完成一輪：基準推進、計數歸零，下一輪須新提問；提示轉為已對齊 ——
writeFileSync(record, HEAD + round(1));
r = run('UserPromptSubmit', { session_id: sid, prompt: '繼續' });
assert.deepEqual({ base: markerOf().base, asks: markerOf().asks, pending: markerOf().pending }, { base: 1, asks: 0, pending: false }, '新的完成輪推進基準並歸零計數');
assert.equal(context(r).includes('[訪談]'), false, '已對齊的對話每次輸入不再提示');
r = tool('Write', { file_path: record, content: HEAD + round(1) + round(2, { 觸發: '範圍改變' }) });
assert.equal(r.status, 2, '追加一輪同樣須新提問');
assert.match(r.stderr, /提問/);
assert.equal(ask().status, 0);
const two = HEAD + round(1) + round(2, { 觸發: '範圍改變' });
assert.equal(tool('Write', { file_path: record, content: two }).status, 0, '提問後追加一輪放行');
writeFileSync(record, two, 'utf8');
run('UserPromptSubmit', { session_id: sid, prompt: '繼續' });
assert.deepEqual({ base: markerOf().base, asks: markerOf().asks }, { base: 2, asks: 0 }, '追加的完成輪同樣推進基準');
r = sh('git commit -m x');
assert.equal(r.status, 2);
assert.doesNotMatch(r.stderr, /產品訪談/, '提交始終由印章檢查處理');
assert.match(r.stderr, /印章/);
// 壓縮續接與同一代號再次 startup（子代理共用代號）：沿用原紀錄與基準。
for (const source of ['compact', 'startup']) {
  r = run('SessionStart', { session_id: sid, source });
  assert.match(context(r), /已完成 2 輪.*追加一輪/, source);
  assert.deepEqual({ base: markerOf().base, asks: markerOf().asks }, { base: 2, asks: 0 }, `${source} 不重設基準與計數`);
}

// —— 8. 恢復舊對話與 /clear：以開場時的完成輪數為基準，須提問後追加新的一輪 ——
r = run('SessionStart', { session_id: sid, source: 'resume' });
assert.equal(markerOf().base, 2);
assert.equal(markerOf().asks, 0);
assert.match(context(r), /恢復的對話：在同一紀錄末尾追加新的一輪/);
const three = HEAD + round(1) + round(2, { 觸發: '恢復對話' }) + round(3, { 觸發: '恢復對話' });
r = tool('Write', { file_path: record, content: three });
assert.equal(r.status, 2, '恢復後追加一輪須先提問');
assert.match(r.stderr, /提問/);
assert.equal(ask().status, 0);
assert.equal(tool('Write', { file_path: record, content: three }).status, 0, '提問後追加完整的一輪');
writeFileSync(record, three, 'utf8');
run('UserPromptSubmit', { session_id: sid, prompt: '繼續' });
assert.deepEqual({ base: markerOf().base, pending: markerOf().pending }, { base: 3, pending: false }, '追加的完成輪推進基準並清除恢復待辦');
run('SessionStart', { session_id: sid, source: 'clear' });
assert.equal(markerOf().base, 3);
assert.equal(markerOf().asks, 0, '/clear 歸零提問計數');
r = tool('Write', { file_path: record, content: three + round(4) });
assert.equal(r.status, 2, '/clear 同樣要求提問後的新一輪');

// —— 9. 不設閘：ZCode 子代理（sess_subagent_…）與沒有對話代號的呼叫 ——
const sub = 'sess_subagent_agent_00000000-0000-4000-8000-000000000002';
assert.equal(tool('Write', { file_path: join(proj, 'src', 'app.js') }, proj, sub).status, 0, '子代理不另做訪談');
assert.equal(existsSync(interviewPath(proj, interviewToken(sub)).replace(/\.md$/, '.json')), false);
const bare = repo(join(home, 'bare'));
assert.equal(run('SessionStart', { source: 'startup' }, bare).status, 0);
assert.equal(run('PreToolUse', { tool_name: 'Write', tool_input: { file_path: join(bare, 'a.js') } }, bare).status, 0);
assert.equal(existsSync(join(bare, '.shiftblame')), false, '沒有對話代號不自動建立工作區');

// —— 10. 第一個事件就是工具呼叫：同樣建立工作區；標記在事件中自建，紀錄寫入仍須提問 ——
const fresh = repo(join(home, 'fresh'));
const freshSid = 'sess_11111111-2222-4333-8444-555555555555';
const freshTool = (name, input) => run('PreToolUse', { session_id: freshSid, tool_name: name, tool_input: input }, fresh);
const freshRecord = join(fresh, '.shiftblame', 'tmp', `interview-${interviewToken(freshSid)}.md`);
assert.equal(freshTool('Write', { file_path: join(fresh, 'a.js'), content: 'x' }).status, 0, '專案寫入不因訪談未完成而受阻');
assert.ok(existsSync(join(fresh, '.shiftblame', 'tmp')));
r = freshTool('Write', { file_path: freshRecord, content: HEAD });
assert.equal(r.status, 2);
assert.match(r.stderr, /提問/);
assert.equal(freshTool('AskUserQuestion', { questions: [] }).status, 0);
assert.equal(freshTool('Write', { file_path: freshRecord, content: HEAD }).status, 0, '提問後放行，標記自建');

// —— 11. 工作區位置：家目錄與其上層不建立；非 git 的安全資料夾建立，子資料夾錨定到它 ——
for (const cwd of [home, base]) {
  assert.equal(run('SessionStart', { session_id: sid, source: 'startup' }, cwd).status, 0);
  assert.equal(existsSync(join(cwd, '.shiftblame')), false, `不在 ${cwd} 建立工作區`);
  assert.equal(tool('Write', { file_path: join(cwd, 'a.txt') }, cwd).status, 0, '沒有工作區就不設閘');
}
const plain = join(base, 'plain');
mkdirSync(join(plain, 'sub'), { recursive: true });
assert.equal(run('SessionStart', { session_id: sid, source: 'startup' }, plain).status, 0);
assert.ok(existsSync(join(plain, '.shiftblame', 'tmp')), '非 git 的安全資料夾建立工作區');
assert.equal(tool('Write', { file_path: 'x.txt' }, join(plain, 'sub')).status, 0, '子資料夾以上層工作區為專案根，寫入照常');
assert.equal(existsSync(join(plain, 'sub', '.shiftblame')), false);

// —— 12. 防護出錯時放行並記錄：紀錄檔被目錄占住 ——
const records = join(fresh, '.shiftblame', 'tmp', 'hook-records.json');
rmSync(records, { force: true });
mkdirSync(records);
r = run('PreToolUse', { tool_name: 'Read', tool_input: { file_path: join(fresh, 'a.js') } }, fresh);
assert.equal(r.status, 0, '紀錄失敗不影響工作');
const errors = readFileSync(join(fresh, '.shiftblame', 'tmp', 'hook-errors.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
assert.equal(errors.at(-1).where, 'record');
assert.equal(errors.at(-1).event, 'PreToolUse');

console.log('sb-interview: pass');
