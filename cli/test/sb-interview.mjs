// sb-interview：產品訪談閘——有對話代號的工作階段自動建立 .shiftblame 工作區；訪談紀錄完成一輪前擋下專案檔案寫入、
// git commit／push 與 sb 流程命令；恢復的對話須追加新的一輪，壓縮續接沿用；子代理與無對話代號的呼叫不設閘；
// 家目錄、其上層不自動建立；防護出錯時放行並記錄。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
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
const slash = (p) => p.replace(/\\/g, '/');

const sid = 'e2b7c1d0-0000-4000-8000-000000000001';
const token = interviewToken(sid);
const record = interviewPath(proj, token);
const marker = record.replace(/\.md$/, '.json');
const rel = `.shiftblame/tmp/interview-${token}.md`;
const tool = (name, tool_input, cwd = proj, session_id = sid) => run('PreToolUse', { session_id, tool_name: name, tool_input }, cwd);
const sh = (command, cwd, session_id) => tool('Bash', { command }, cwd, session_id);
const ps = (command, cwd, session_id) => tool('PowerShell', { command }, cwd, session_id);
const round = (n, over = {}) => {
  const f = { 觸發: '新對話', 使用者原話: '「修好登入逾時」', 目標: '登入逾時後可重試', 範圍: '只改 auth 模組', 限制與授權: '不動資料庫', 驗收: '逾時後出現重試按鈕', 未決: '無', 使用者確認: '使用者：確認', ...over };
  return `\n## 第 ${n} 輪 2026-09-27T10:0${n}\n\n${Object.entries(f).filter(([, v]) => v !== null).map(([k, v]) => `- ${k}：${v}`).join('\n')}\n`;
};
const HEAD = '---\ntitle: 產品訪談紀錄\n---\n\n# 產品訪談紀錄\n';

// —— 1. 紀錄解析：五個必填欄位；佔位符不算；子項可承載欄位內容；其他標題結束一輪 ——
{
  assert.equal(interviewToken(sid).length, 12);
  assert.equal(interviewToken(sid), interviewToken(sid), '同一對話代號得到同一紀錄');
  assert.notEqual(interviewToken(sid), interviewToken(`${sid}x`));
  let p = parseInterview(HEAD + round(1));
  assert.equal(p.complete, 1);
  p = parseInterview(HEAD + round(1, { 目標: '<目標>', 驗收: '（填）', 使用者確認: 'TODO', 範圍: null }));
  assert.deepEqual(p.rounds[0].missing, ['目標', '範圍', '驗收', '使用者確認'], '佔位符與缺欄都列為缺少');
  p = parseInterview(`## 第1輪\n* 觸發: 新對話\n- 目標：x\n- 範圍：y\n- 驗收：\n  - 逾時後出現重試按鈕\n  - 重試後回到原頁\n- 使用者確認：確認\n`);
  assert.equal(p.complete, 1, '半形冒號、* 項目與縮排子項都可承載欄位');
  assert.match(p.rounds[0].fields['驗收'], /重試後回到原頁/);
  p = parseInterview(`## 第 1 輪\n- 觸發：新對話\n- 目標：x\n## 附註\n- 範圍：y\n- 驗收：z\n- 使用者確認：確認\n`);
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
assert.equal(JSON.parse(readFileSync(marker, 'utf8')).base, 0, '開場標記記下開場時已完成的輪數');

// —— 3. 閘關閉：擋專案檔案寫入、提交、推送與 sb 流程命令；唯讀、tmp 筆記與專案根以外照常 ——
r = tool('Write', { file_path: join(proj, 'src', 'app.js'), content: 'x' });
assert.equal(r.status, 2);
assert.match(r.stderr, /產品訪談尚未完成/);
assert.match(r.stderr, /紀錄尚未建立/);
assert.match(r.stderr, /專案檔案寫入暫停/);
assert.equal(tool('Edit', { file_path: 'src/app.js', old_string: 'a', new_string: 'b' }).status, 2, '相對路徑以 cwd 展開');
for (const [command, what] of [['git commit -m x', /git commit/], ['git push origin main', /git push/], ['sb next research', /sb next/],
  ['node cli/bin/sb.mjs init demo', /sb init/], [`bash -c "git commit -m 'x'"`, /git commit/], ['$G commit -m x', /變數組成/], ['sb vault', /sb vault/]]) {
  r = sh(command);
  assert.equal(r.status, 2, command);
  assert.match(r.stderr, what, command);
}
r = ps('git push');
assert.equal(r.status, 2);
assert.match(r.stderr, /產品訪談尚未完成/);
for (const [name, input] of [['Write', { file_path: join(proj, '.shiftblame', 'tmp', 'notes.md') }], ['Write', { file_path: '.shiftblame/tmp/notes.md' }],
  ['Write', { file_path: join(base, 'outside.txt') }], ['Read', { file_path: join(proj, 'src', 'app.js') }], ['TodoWrite', { todos: [] }]]) {
  r = tool(name, input);
  assert.equal(r.status, 0, `${name} ${JSON.stringify(input)}`);
  assert.equal(decision(r), undefined, `${name} 不詢問`);
}
for (const command of ['git status', 'git log --oneline', 'sb state', 'ls']) assert.equal(sh(command).status, 0, command);
// 寫訪談紀錄本身：經使用者確認；開場標記由 hook 維護。
for (const r2 of [tool('Write', { file_path: record, content: HEAD }), tool('Write', { file_path: rel, content: HEAD }),
  sh(`printf '%s' x >> ${slash(record)}`), ps(`Add-Content -Path '${record}' -Value x`)]) {
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(decision(r2), 'ask', '寫紀錄時詢問使用者');
  assert.match(JSON.parse(r2.stdout).hookSpecificOutput.permissionDecisionReason, /產品訪談紀錄.*使用者確認/);
}
for (const r2 of [tool('Write', { file_path: marker, content: '{"base":0}' }), sh(`echo '{}' > ${slash(marker)}`)]) {
  assert.equal(r2.status, 2);
  assert.match(r2.stderr, /開場標記由 hook 維護/);
}

// —— 4. 紀錄不完整：仍關閉，訊息列出缺漏欄位 ——
writeFileSync(record, HEAD + round(1, { 目標: '<目標>', 驗收: null, 使用者確認: '（填）' }));
r = sh('git commit -m x');
assert.equal(r.status, 2);
assert.match(r.stderr, /第 1 輪缺少：目標、驗收、使用者確認/);
assert.match(context(run('UserPromptSubmit', { session_id: sid, prompt: '繼續' })), /尚未完成產品訪談.*第 1 輪缺少/);

// —— 5. 完成一輪：閘開啟，寫紀錄不再詢問；提交回到一般的印章檢查 ——
writeFileSync(record, HEAD + round(1));
r = tool('Write', { file_path: join(proj, 'src', 'app.js'), content: 'x' });
assert.equal(r.status, 0, r.stderr);
assert.equal(decision(tool('Write', { file_path: record, content: HEAD + round(1) + round(2, { 觸發: '範圍改變' }) })), undefined, '閘開啟後追加一輪不詢問');
r = sh('git commit -m x');
assert.equal(r.status, 2);
assert.doesNotMatch(r.stderr, /產品訪談/, '提交改由印章檢查處理');
assert.match(r.stderr, /印章/);
assert.equal(context(run('UserPromptSubmit', { session_id: sid, prompt: '繼續' })).includes('[訪談]'), false, '完成後每次輸入不再提示');
// 壓縮續接與同一代號再次 startup（子代理共用代號）：沿用原紀錄，不重設開場標記。
for (const source of ['compact', 'startup']) {
  r = run('SessionStart', { session_id: sid, source });
  assert.match(context(r), /已完成 1 輪.*追加一輪/, source);
  assert.equal(JSON.parse(readFileSync(marker, 'utf8')).base, 0, `${source} 不重設開場標記`);
  assert.equal(tool('Write', { file_path: join(proj, 'src', 'app.js') }).status, 0, `${source} 後閘維持開啟`);
}

// —— 6. 恢復舊對話與 /clear：以開場時的完成輪數為基準，須追加新的一輪 ——
r = run('SessionStart', { session_id: sid, source: 'resume' });
assert.equal(JSON.parse(readFileSync(marker, 'utf8')).base, 1);
assert.match(context(r), /恢復的對話：在同一紀錄末尾追加新的一輪/);
r = tool('Write', { file_path: join(proj, 'src', 'app.js') });
assert.equal(r.status, 2);
assert.match(r.stderr, /恢復的對話須在紀錄末尾追加新的一輪（開場時已完成 1 輪）/);
appendFileSync(record, round(2, { 觸發: '恢復對話', 使用者確認: null }));
assert.match(tool('Write', { file_path: join(proj, 'src', 'app.js') }).stderr, /第 2 輪缺少：使用者確認/, '新的一輪缺欄時列出缺漏');
writeFileSync(record, HEAD + round(1) + round(2, { 觸發: '恢復對話' }));
assert.equal(tool('Write', { file_path: join(proj, 'src', 'app.js') }).status, 0, '追加完整的一輪後重新開啟');
run('SessionStart', { session_id: sid, source: 'clear' });
assert.equal(JSON.parse(readFileSync(marker, 'utf8')).base, 2);
assert.equal(tool('Write', { file_path: join(proj, 'src', 'app.js') }).status, 2, '/clear 同樣要求新的一輪');

// —— 7. 不設閘：ZCode 子代理（sess_subagent_…）與沒有對話代號的呼叫 ——
const sub = 'sess_subagent_agent_00000000-0000-4000-8000-000000000002';
assert.equal(tool('Write', { file_path: join(proj, 'src', 'app.js') }, proj, sub).status, 0, '子代理不另做訪談');
assert.equal(existsSync(interviewPath(proj, interviewToken(sub)).replace(/\.md$/, '.json')), false);
const bare = repo(join(home, 'bare'));
assert.equal(run('SessionStart', { source: 'startup' }, bare).status, 0);
assert.equal(run('PreToolUse', { tool_name: 'Write', tool_input: { file_path: join(bare, 'a.js') } }, bare).status, 0);
assert.equal(existsSync(join(bare, '.shiftblame')), false, '沒有對話代號不自動建立工作區');

// —— 8. 第一個事件就是工具呼叫：同樣建立工作區並設閘（無論輸入為何） ——
const fresh = repo(join(home, 'fresh'));
r = run('PreToolUse', { session_id: 'sess_11111111-2222-4333-8444-555555555555', tool_name: 'Write', tool_input: { file_path: join(fresh, 'a.js') } }, fresh);
assert.equal(r.status, 2);
assert.match(r.stderr, /紀錄尚未建立/);
assert.ok(existsSync(join(fresh, '.shiftblame', 'tmp')));

// —— 9. 工作區位置：家目錄與其上層不建立；非 git 的安全資料夾建立，其子資料夾錨定到它 ——
for (const cwd of [home, base]) {
  assert.equal(run('SessionStart', { session_id: sid, source: 'startup' }, cwd).status, 0);
  assert.equal(existsSync(join(cwd, '.shiftblame')), false, `不在 ${cwd} 建立工作區`);
  assert.equal(tool('Write', { file_path: join(cwd, 'a.txt') }, cwd).status, 0, '沒有工作區就不設閘');
}
const plain = join(base, 'plain');
mkdirSync(join(plain, 'sub'), { recursive: true });
assert.equal(run('SessionStart', { session_id: sid, source: 'startup' }, plain).status, 0);
assert.ok(existsSync(join(plain, '.shiftblame', 'tmp')), '非 git 的安全資料夾建立工作區');
r = tool('Write', { file_path: 'x.txt' }, join(plain, 'sub'));
assert.equal(r.status, 2, '子資料夾錨定到上層工作區並受閘');
assert.equal(existsSync(join(plain, 'sub', '.shiftblame')), false);

// —— 10. 防護出錯時放行並記錄：紀錄檔被目錄占住 ——
const records = join(fresh, '.shiftblame', 'tmp', 'hook-records.json');
rmSync(records, { force: true });
mkdirSync(records);
r = run('PreToolUse', { tool_name: 'Read', tool_input: { file_path: join(fresh, 'a.js') } }, fresh);
assert.equal(r.status, 0, '紀錄失敗不影響工作');
const errors = readFileSync(join(fresh, '.shiftblame', 'tmp', 'hook-errors.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
assert.equal(errors.at(-1).where, 'record');
assert.equal(errors.at(-1).event, 'PreToolUse');

console.log('sb-interview: pass');
