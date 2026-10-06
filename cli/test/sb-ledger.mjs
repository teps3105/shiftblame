import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const hook = fileURLToPath(new URL('../../hooks/shiftblame-guard.mjs', import.meta.url));
const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'sb-ledger-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
const statePath = join(root, '.shiftblame/flow-state.json');
// 窗口設小（1000，門檻 800）讓假 usage 可觸發；USERPROFILE/HOME 指向暫存根，rollout 後備不觸碰真實家目錄。
const baseEnv = { SB_WINDOW_TOKENS: '1000', USERPROFILE: root, HOME: root };
const run = (event, extra = {}, env = {}) => spawnSync(process.execPath, [hook], {
  encoding: 'utf8',
  env: { ...process.env, ...baseEnv, ...env },
  input: JSON.stringify({ cwd: root, hook_event_name: event, ...extra }),
});
const records = () => JSON.parse(readFileSync(join(root, '.shiftblame/tmp/hook-records.json'), 'utf8'));
const ctxOf = (r) => JSON.parse(r.stdout).hookSpecificOutput.additionalContext ?? '';

// ———— 假 transcript／rollout：最後一筆 usage 決定用量 ————
let serial = 0;
const usageFile = (lines) => {
  const f = join(root, `usage-${serial++}.jsonl`);
  writeFileSync(f, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return f;
};
const snake = (tokens) => ({ type: 'assistant', message: { usage: { input_tokens: tokens } } });
const camel = (usage) => ({ response: { usage } });

// 低於門檻不提醒。
let f = usageFile([{ x: 1 }, snake(700)]);
let r = run('UserPromptSubmit', { session_id: 'sess-a', transcriptPath: f });
assert.equal(r.status, 0, r.stderr);
assert.ok(!ctxOf(r).includes('[帳本]'), '低於門檻不提醒');
assert.equal(records().compactNudge, undefined);

// 超過門檻提醒一次：蛇形欄位相加快取（600+300=900≥800）。
f = usageFile([snake(600), snake(600), { type: 'assistant', message: { usage: { input_tokens: 600, cache_read_input_tokens: 300 } } }]);
r = run('UserPromptSubmit', { session_id: 'sess-a', transcriptPath: f });
assert.ok(ctxOf(r).includes('[帳本]'), '過門檻提醒');
assert.ok(ctxOf(r).includes('.shiftblame/tmp/main/<task>/ledger.md'), 'main 模式給主帳本路徑');
assert.equal(records().compactNudge.session, 'sess-a');

// 同一輪壓縮循環不重複提醒。
r = run('UserPromptSubmit', { session_id: 'sess-a', transcriptPath: f });
assert.ok(!ctxOf(r).includes('[帳本]'), '同循環不重複');

// 駝峰 inputTokens 已含 cacheReadTokens：700 不得算成 1350——低於門檻不提醒，並解除武裝。
f = usageFile([camel({ inputTokens: 700, cacheReadTokens: 650, cacheWriteTokens: 0 })]);
r = run('UserPromptSubmit', { session_id: 'sess-a', transcriptPath: f });
assert.ok(!ctxOf(r).includes('[帳本]'), '駝峰不重複相加');
assert.equal(records().compactNudge, undefined, '用量回落解除武裝');

// 解除後再過門檻，重新提醒（下一輪壓縮循環）。
r = run('UserPromptSubmit', { session_id: 'sess-a', transcriptPath: f });
assert.ok(!ctxOf(r).includes('[帳本]'));
f = usageFile([snake(900)]);
r = run('UserPromptSubmit', { session_id: 'sess-a', transcriptPath: f });
assert.ok(ctxOf(r).includes('[帳本]'), '回落後重新武裝');

// transcript 缺席時掃 rollout 的 model-io 紀錄（檔名含對話代號）。
mkdirSync(join(root, '.zcode/cli/rollout'), { recursive: true });
writeFileSync(join(root, '.zcode/cli/rollout/model-io-sess-roll.jsonl'), JSON.stringify({ response: { usage: { inputTokens: 950 } } }) + '\n');
r = run('UserPromptSubmit', { session_id: 'sess-roll' });
assert.ok(ctxOf(r).includes('[帳本]'), 'rollout 後備取用量');
// 沒有配對紀錄的對話靜默略過，不報錯。
r = run('UserPromptSubmit', { session_id: 'sess-other' });
assert.equal(r.status, 0);
assert.ok(!ctxOf(r).includes('[帳本]'));

// 窗口來源：未設 SB_WINDOW_TOKENS 時接平台的自動壓縮設定（Claude Code 經 settings.env 注入），顯式覆寫仍優先。
const snake170 = usageFile([snake(170)]);
r = run('UserPromptSubmit', { session_id: 'sess-win', transcriptPath: snake170 }, { SB_WINDOW_TOKENS: '', CLAUDE_CODE_AUTO_COMPACT_WINDOW: '200' });
assert.ok(ctxOf(r).includes('[帳本]'), '平台自動壓縮設定當窗口（170>=200*0.8）');
r = run('UserPromptSubmit', { session_id: 'sess-win2', transcriptPath: snake170 }, { SB_WINDOW_TOKENS: '1000', CLAUDE_CODE_AUTO_COMPACT_WINDOW: '200' });
assert.ok(!ctxOf(r).includes('[帳本]'), '顯式覆寫優先（170<1000*0.8）');

// Codex rollout 的 token_count 事件：input_tokens 已含 cached_input_tokens（相加會重複計入），窗口取同一事件的 model_context_window。
const codex = (usage, window) => usageFile([{ type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: usage, model_context_window: window } } }]);
f = codex({ input_tokens: 150, cached_input_tokens: 100, cache_write_input_tokens: 0 }, 258);
r = run('UserPromptSubmit', { session_id: 'sess-codex', transcriptPath: f });
assert.ok(!ctxOf(r).includes('[帳本]'), 'Codex 不重複相加（150<258*0.8；誤加 cached 會算 250 過門檻）');
f = codex({ input_tokens: 220, cached_input_tokens: 210, cache_write_input_tokens: 6 }, 258);
r = run('UserPromptSubmit', { session_id: 'sess-codex2', transcriptPath: f }, { SB_WINDOW_TOKENS: '1000' });
assert.ok(ctxOf(r).includes('[帳本]'), 'Codex 窗口取 rollout 的 model_context_window（226>=258*0.8；退 env 1000 則不過）');

// ———— 壓縮續接：SessionStart(source=compact) 注入帳本路徑與末 30 行 ————
const ledger40 = (dir) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ledger.md'), ['# 帳本', ...Array.from({ length: 40 }, (_, i) => `- 2026-10-06 [證據] L${String(i + 1).padStart(2, '0')}`)].join('\n') + '\n');
};
const compactRun = () => run('SessionStart', { source: 'compact' });

// 沒有帳本：不注入也不報錯。
r = compactRun();
assert.equal(r.status, 0, r.stderr);
assert.ok(!ctxOf(r).includes('[壓縮續接]'));

// main：最近更新的 task 帳本末 30 行（不含前 10 行）。
ledger40(join(root, '.shiftblame/tmp/main/alpha'));
r = compactRun();
assert.ok(ctxOf(r).includes('[壓縮續接] 帳本末 30 行（.shiftblame/tmp/main/alpha/ledger.md）'));
assert.ok(ctxOf(r).includes('L40') && ctxOf(r).includes('L11'), '含末 30 行');
assert.ok(!ctxOf(r).includes('L01') && !ctxOf(r).includes('L10\n'), '不含更早的行');

// 有活動 slug：注入 slug 帳本與階段資訊，不是 main 的 task 帳本。
writeFileSync(statePath, JSON.stringify({ slug: 'demo', ms: '001', node: 'build' }));
ledger40(join(root, '.shiftblame/tmp/demo'));
writeFileSync(join(root, '.shiftblame/tmp/demo/ledger.md'), '# 帳本 — demo\n- 2026-10-06 [未決] slug 帳本獨有行\n');
r = compactRun();
assert.ok(ctxOf(r).includes('[壓縮續接] slug demo／ms 001／段 build'), '帶 slug／里程碑／階段');
assert.ok(ctxOf(r).includes('slug 帳本獨有行'), '注入 slug 帳本');
assert.ok(!ctxOf(r).includes('L40'), '不注入 main 的 task 帳本');
assert.ok(!ctxOf(r).includes('AC-01'), '不注入 G 檔內容');

// slug 帳本不存在：不注入（連 main 帳本也不注入）。
rmSync(join(root, '.shiftblame/tmp/demo/ledger.md'));
r = compactRun();
assert.ok(!ctxOf(r).includes('[壓縮續接]'), 'slug 帳本缺席不退回 main 帳本');

// ———— sb next 收帳：列出 [未決]，不阻擋 ————
rmSync(statePath);
const sb = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
r = sb('init', 'ledgerdemo', '--no-git');
assert.equal(r.status, 0, r.stderr);
// requirement→research 的假需求閘要求實質的 G1 驗收段。
mkdirSync(join(root, '.shiftblame/ledgerdemo/001'), { recursive: true });
writeFileSync(join(root, '.shiftblame/ledgerdemo/001/G1.md'), [
  '# 驗收', '',
  '### AC-01',
  '- 使用者：老闆',
  '- 現狀：壓縮後遺失過程判斷',
  '- Given：對話用量過窗口 80%',
  '- When：自動壓縮發生',
  '- Then：帳本末 30 行隨壓縮續接注入',
  '- 失敗邊界：無帳本時靜默不報錯',
  '- 消融：壓縮前的決策與未決事項遺失',
  '- 證據：BEHAVIOR', '',
].join('\n'));
mkdirSync(join(root, '.shiftblame/tmp/ledgerdemo'), { recursive: true });
writeFileSync(join(root, '.shiftblame/tmp/ledgerdemo/ledger.md'), [
  '# 帳本 — ledgerdemo',
  '- 2026-10-06 [否決] 用 PreCompact hook——平台不支援',
  '- 2026-10-06 [未決] Q1 快取欄位語意',
  '- 2026-10-06 [已解] Q0 窗口預設——已寫進 MECHANISMS',
  '- 2026-10-06 [未決] Q2 實驗基準組',
].join('\n') + '\n');
r = sb('next', 'research');
assert.equal(r.status, 0, r.stderr + r.stdout);
assert.match(r.stdout, /帳本未決 2 筆/, '列出未決數量');
assert.match(r.stdout, /Q1 快取欄位語意/, '列出未決內容');
assert.ok(!r.stdout.includes('Q0 窗口預設'), '已解行不列');
// 收掉一筆後數量跟著更新；收帳不阻擋推進。
writeFileSync(join(root, '.shiftblame/tmp/ledgerdemo/ledger.md'), [
  '# 帳本 — ledgerdemo',
  '- 2026-10-06 [已解] Q1 快取欄位語意——已寫進 guard 實作',
  '- 2026-10-06 [未決] Q2 實驗基準組',
].join('\n') + '\n');
r = sb('next', 'requirement');
assert.equal(r.status, 0, r.stderr + r.stdout);
assert.match(r.stdout, /帳本未決 1 筆/);

console.log('sb-ledger: pass');
