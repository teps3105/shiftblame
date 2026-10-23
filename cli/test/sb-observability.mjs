process.env.SHIFTBLAME_POLICY = '';
// sb-observability：觀測紀律——sb 每次調用落 usage 事件，hook 計數純觀測、不設預算與上限。
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, '../bin/sb.mjs');
const hookBin = resolve(here, '../../hooks/shiftblame-guard.mjs');
const root = mkdtempSync(join(tmpdir(), 'sb-obsv-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const hookRun = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
const usageFile = () => join(root, '.shiftblame/tmp/sb-usage.jsonl');
const usageLines = () => (existsSync(usageFile()) ? readFileSync(usageFile(), 'utf8').split('\n').filter(Boolean) : []);

// —— 1. usage 事件：每次 sb 調用（含失敗調用）落 tmp JSONL，缺檔自動重建 ——
assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
git('add', '.gitignore', 'seed.txt');
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: initial').status, 0);
const usageCount0 = usageLines().length;
assert.equal(run('state').status, 0);
assert.ok(usageLines().length >= usageCount0 + 1, 'sb state 調用落 sb-usage.jsonl');
assert.equal(run('budget', '--requests', '5').status, 2, '已除命令照常 usage()（exit 2——解析器衛生）');
{
  const lines = usageLines();
  assert.ok(lines.length >= 2, '失敗調用（用法錯誤）也追加一行');
  const last = JSON.parse(lines.at(-1));
  assert.equal(last.cmd, 'budget', '子命令記錄正確（含失敗調用）');
  assert.match(last.args, /--requests 5/, '參數摘要記錄');
  assert.match(last.at, /^\d{4}-\d\d-\d\dT/, '時間戳記錄');
}

// —— 2. 重複的外部觀測合法，只計為嘗試次數 ——
for (let i = 0; i < 5; i++) assert.equal(hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status --porcelain' } }).status, 0);
{
  const records = JSON.parse(readFileSync(join(root, '.shiftblame/tmp/hook-records.json'), 'utf8'));
  assert.ok(records.turnUsage.requests >= 5, '重複的外部觀測只計數');
  assert.equal(records.turnUsage.repeats, undefined);
}
for (const removed of ['init', 'next', 'end', 'closeout', 'adversarial', 'sopreview']) assert.equal(run(removed, 'x').status, 2, '已移除的命令回用法錯誤：' + removed);

console.log('sb-observability: pass');
