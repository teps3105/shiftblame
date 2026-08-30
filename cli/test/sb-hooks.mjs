import assert from 'node:assert/strict';
import { existsSync as existsSyncFn, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// hooks 煙霧測試：三事件注入 + commit 印章硬擋（無印章／逾期／訊息不符／-F／有效）
// 與框架文件編輯提醒。hook 故障必須靜默放行（deny 是唯一非零出口）。

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hook = join(repo, 'hooks', 'shiftblame-guard.mjs');
const root = mkdtempSync(join(tmpdir(), 'sb-hooks-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));

// hooks.json 必須是合法 JSON 且註冊三事件（type: command——ZCode/Codex 共用格式）
const hooksJson = JSON.parse(readFileSync(join(repo, 'hooks', 'hooks.json'), 'utf8'));
for (const ev of ['SessionStart', 'UserPromptSubmit', 'PreToolUse']) {
  assert.ok(hooksJson.hooks[ev], `hooks.json 缺 ${ev}`);
  assert.equal(hooksJson.hooks[ev][0].hooks[0].type, 'command');
  assert.match(hooksJson.hooks[ev][0].hooks[0].command, /CLAUDE_PLUGIN_ROOT/);
}

const run = (payload) => {
  const p = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ cwd: root, ...payload }),
    encoding: 'utf8',
  });
  return { status: p.status, stdout: p.stdout, stderr: p.stderr };
};
const ctxOf = (r) => JSON.parse(r.stdout).hookSpecificOutput.additionalContext;

// 1. SessionStart：載入程序＋不變量卡（含人話三時點與版號規則）
const s = run({ hook_event_name: 'SessionStart' });
assert.equal(s.status, 0);
assert.match(ctxOf(s), /冷啟動載入/);
assert.match(ctxOf(s), /sb-think/);
assert.match(ctxOf(s), /人話三時點/);
assert.match(ctxOf(s), /七判準/);
assert.match(ctxOf(s), /版本號屬老闆決策/);

// 2. UserPromptSubmit（非治理目錄）：核心卡、無節點行
const u1 = run({ hook_event_name: 'UserPromptSubmit', prompt: '隨便做點什麼' });
assert.equal(u1.status, 0);
assert.match(ctxOf(u1), /三步序/);
assert.match(ctxOf(u1), /反向對抗/);
assert.match(ctxOf(u1), /人話三時點/);
assert.ok(!ctxOf(u1).includes('[節點]'), '非治理目錄不應注入節點');

// 2b. 寫入 release-brief／verify 檔 → 注入人話段提醒
const wb = run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame', 'tmp', 'release-brief-demo-001-2.md') } });
assert.equal(wb.status, 0);
assert.match(ctxOf(wb), /## 人話/);
assert.match(ctxOf(wb), /UI\/UX\/UE/);
const wv = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame', 'tmp', 'verify-002.md') } });
assert.equal(wv.status, 0);
assert.match(ctxOf(wv), /問題來源/);

// 2c. 複核修補回歸：content 誤觸不注入、review-verify 誤觸不注入、版號檔提醒
const noTrig = run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, 'notes.md'), content: 'see release-brief-demo-001-2.md for details' } });
assert.equal(noTrig.status, 0);
assert.equal(noTrig.stdout.trim(), '');
const noRev = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame', 'tmp', 'review-verify-demo-001-1.md') } });
assert.equal(noRev.status, 0);
assert.equal(noRev.stdout.trim(), '');
const ver = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, 'cli', 'package.json') } });
assert.equal(ver.status, 0);
assert.match(ctxOf(ver), /版號屬老闆決策/);

// 3. UserPromptSubmit（治理目錄）：加注節點
mkdirSync(join(root, '.shiftblame'), { recursive: true });
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '002', node: 'verify' }));
const u2 = run({ hook_event_name: 'UserPromptSubmit', prompt: '繼續' });
assert.match(ctxOf(u2), /\[節點\] demo\/002 @ verify/);
assert.match(ctxOf(u2), /sb next/);

// 4. git commit 無印章 → exit 2 阻擋
const c1 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: something"' } });
assert.equal(c1.status, 2);
assert.match(c1.stderr, /sb commitmsg/);

// 5. -F 檔案訊息 → exit 2
const c2 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -F msg.txt' } });
assert.equal(c2.status, 2);
assert.match(c2.stderr, /-m/);

// 6. 印章有效且訊息相符 → exit 0 靜默
const tmp = join(root, '.shiftblame', 'tmp');
mkdirSync(tmp, { recursive: true });
writeFileSync(join(tmp, 'commit-stamp.json'), JSON.stringify({ message: 'feat: 通過驗證的訊息', cwd: root, issuedAt: new Date().toISOString() }));
const c3 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: 通過驗證的訊息"' } });
assert.equal(c3.status, 0);
assert.equal(c3.stdout.trim(), '');

// 7. 訊息不符 → exit 2（先補新印章——測試 6 的有效印章已消費）
writeFileSync(join(tmp, 'commit-stamp.json'), JSON.stringify({ message: 'feat: 印章裡的訊息', cwd: root, issuedAt: new Date().toISOString() }));
const c4 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: 另一個訊息"' } });
assert.equal(c4.status, 2);
assert.match(c4.stderr, /不符/);

// 8. 印章逾期（11 分鐘前）→ exit 2
writeFileSync(join(tmp, 'commit-stamp.json'), JSON.stringify({ message: 'feat: 通過驗證的訊息', cwd: root, issuedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString() }));
const c5 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: 通過驗證的訊息"' } });
assert.equal(c5.status, 2);
assert.match(c5.stderr, /逾期/);

// 9. 修改框架文件（SKILL.md）→ 注入三步序提醒；一般檔案 → 靜默
const w1 = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'D:/x/skills/shiftblame/SKILL.md' } });
assert.equal(w1.status, 0);
assert.match(ctxOf(w1), /三步序/);
const w2 = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'D:/x/src/app.js' } });
assert.equal(w2.status, 0);
assert.equal(w2.stdout.trim(), '');

// 10. 跨專案印章 → exit 2
const other = mkdtempSync(join(tmpdir(), 'sb-hooks-other-'));
mkdirSync(join(other, '.shiftblame', 'tmp'), { recursive: true });
writeFileSync(join(other, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: 'feat: 通過驗證的訊息', cwd: other, issuedAt: new Date().toISOString() }));
writeFileSync(join(tmp, 'commit-stamp.json'), JSON.stringify({ message: 'feat: 通過驗證的訊息', cwd: other, issuedAt: new Date().toISOString() }));
const c6 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: 通過驗證的訊息"' } });
assert.equal(c6.status, 2);
assert.match(c6.stderr, /其他專案/);
rmSync(other, { recursive: true, force: true });
writeFileSync(join(tmp, 'commit-stamp.json'), JSON.stringify({ message: 'feat: 通過驗證的訊息', cwd: root, issuedAt: new Date().toISOString() }));

// 11. 多重 -m 夾帶 → exit 2
const c7 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: 通過驗證的訊息" -m "hidden paragraph"' } });
assert.equal(c7.status, 2);
assert.match(c7.stderr, /多個 -m/);

// 12. 非相關 Bash → 靜默；非法 stdin（防護損壞）→ 靜默 exit 0
const b1 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls -la' } });
assert.equal(b1.status, 0);
assert.equal(b1.stdout.trim(), '');
const bad = spawnSync(process.execPath, [hook], { input: 'not-json{{', encoding: 'utf8' });
assert.equal(bad.status, 0);

// ———— 破壞性命令＋相對路徑防護（各語言刪除腳本） ————

// 13. rm -rf 相對 → 擋；絕對 → 放行
const d1 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf build' } });
assert.equal(d1.status, 2);
assert.match(d1.stderr, /絕對路徑/);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf /tmp/abs-dir' } }).status, 0);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf D:/x/abs' } }).status, 0);

// 14. Windows del/rd /s 相對 → 擋
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'del /s /q dist' } }).status, 2);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rd /s /q dist' } }).status, 2);

// 15. PowerShell Remove-Item -Recurse 相對 → 擋；絕對 → 放行
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'powershell -Command "Remove-Item dist -Recurse -Force"' } }).status, 2);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'powershell -Command "Remove-Item D:/x/abs -Recurse"' } }).status, 0);

// 16. 行內直譯器刪除 API：python -c shutil.rmtree 相對 → 擋；絕對 → 放行
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `python -c "import shutil; shutil.rmtree('build')"` } }).status, 2);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `python -c "import shutil; shutil.rmtree('/tmp/abs-dir')"` } }).status, 0);

// 17. node -e fs.rmSync recursive 相對 → 擋
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `node -e "require('fs').rmSync('build',{recursive:true})"` } }).status, 2);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `node -e "require('fs').rmSync('/tmp/abs-dir',{recursive:true})"` } }).status, 0);

// 18. git clean/reset --hard 未 -C 絕對錨定 → 擋；-C 絕對 → 放行
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git clean -fd' } }).status, 2);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git reset --hard HEAD~1' } }).status, 2);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} reset --hard HEAD~1` } }).status, 0);

// 19. 重定向截斷相對 → 擋；>> 與 /dev/null → 放行
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'echo x > out.txt' } }).status, 2);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'echo x >> out.txt' } }).status, 0);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'echo x > /dev/null' } }).status, 0);

// 20. 直跑腳本檔：相對字面路徑刪除 → 擋；僅 API（變數路徑）→ 注入警告；絕對字面 → 放行
writeFileSync(join(root, 'clean_rel.py'), `import shutil\nshutil.rmtree('build')\n`);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'python clean_rel.py' } }).status, 2);
writeFileSync(join(root, 'clean_var.py'), `import shutil, sys\nshutil.rmtree(sys.argv[1])\n`);
const sv = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'python clean_var.py build' } });
assert.equal(sv.status, 0);
assert.match(ctxOf(sv), /遞迴刪除 API/);
writeFileSync(join(root, 'clean_abs.py'), `import shutil\nshutil.rmtree('/tmp/abs-dir')\n`);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'python clean_abs.py' } }).status, 0);

// 21. cwd 非絕對：UserPromptSubmit 仍注卡；PreToolUse git commit 無錨定 → 靜默放行（不猜測）
const rel = spawnSync(process.execPath, [hook], { input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', cwd: 'relative/dir', prompt: 'x' }), encoding: 'utf8' });
assert.equal(rel.status, 0);
assert.match(JSON.parse(rel.stdout).hookSpecificOutput.additionalContext, /三步序/);
const nc = spawnSync(process.execPath, [hook], { input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: 'relative/dir', tool_name: 'Bash', tool_input: { command: 'git commit -m "x"' } }), encoding: 'utf8' });
assert.equal(nc.status, 0);
assert.equal(nc.stdout.trim(), '');

// 22. 層間停靠雙重鎖：node=release 時 sb next test 無 --boss-ok → hook 擋；帶旗標 → 過
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'release' }));
const t1 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next test' } });
assert.equal(t1.status, 2);
assert.match(t1.stderr, /老闆確認點/);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next test --boss-ok' } }).status, 0);
// UserPromptSubmit 於 release 節點注入停等老闆確認提示
const u3 = run({ hook_event_name: 'UserPromptSubmit', prompt: '繼續' });
assert.match(ctxOf(u3), /停等老闆確認/);
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'verify' }));

// 23. 大小寫繞過：GIT commit 無印章 → 擋；tool_name 小寫 bash 仍防護
const gc = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'GIT commit -m "feat: x"' } });
assert.equal(gc.status, 2);
const lc = spawnSync(process.execPath, [hook], { input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: root, tool_name: 'bash', tool_input: { command: 'rm -rf build' } }), encoding: 'utf8' });
assert.equal(lc.status, 2);

// 24. 印章消費制：有效印章過一次後即刪，同訊息再 commit → 缺印章
writeFileSync(join(tmp, 'commit-stamp.json'), JSON.stringify({ message: 'feat: once', cwd: root, issuedAt: new Date().toISOString() }));
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: once"' } }).status, 0);
const again = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: once"' } });
assert.equal(again.status, 2);
assert.match(again.stderr, /缺少 commit 印章/);
// 未來時間戳 → 擋
writeFileSync(join(tmp, 'commit-stamp.json'), JSON.stringify({ message: 'feat: once', cwd: root, issuedAt: new Date(Date.now() + 3600_000).toISOString() }));
assert.match(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: once"' } }).stderr, /未來/);
// -C 其他 repo → 擋
const other2 = mkdtempSync(join(tmpdir(), 'sb-hooks-other2-'));
writeFileSync(join(tmp, 'commit-stamp.json'), JSON.stringify({ message: 'feat: once', cwd: root, issuedAt: new Date().toISOString() }));
const cx = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${other2} commit -m "feat: once"` } });
rmSync(other2, { recursive: true, force: true });
assert.match(cx.stderr, /其他 repo|專案不符/);
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'verify' }));

// 24b. 根目錄與長旗標繞過回歸：rm -rf / 與 /home 即拒；>160 字 pad 的 git commit 仍擌
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }).status, 2);
assert.match(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }).stderr, /根目錄/);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf /home' } }).status, 0); // 絕對非根路徑：政策上放行（>> 受平台權限層管轄）
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf D:/' } }).status, 2);
const pad = 'A'.repeat(180);
const padded = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -c pad=${pad} commit -m "feat: x"` } });
assert.equal(padded.status, 2);

// 24c. 停靠 regex 邊界：sb.mjs 形與註解形 --boss-ok
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'release' }));
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'node D:/x/cli/bin/sb.mjs next test' } }).status, 2);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next test # --boss-ok' } }).status, 2);
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'verify' }));

// 24d. -m 緊貼形與分段 -C 限同段：foo -C 他工具不干擾印章段
writeFileSync(join(tmp, 'commit-stamp.json'), JSON.stringify({ message: 'feat: tight', cwd: root, issuedAt: new Date().toISOString() }));
const tight = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m"feat: tight"' } });
assert.equal(tight.status, 0);
writeFileSync(join(tmp, 'commit-stamp.json'), JSON.stringify({ message: 'feat: seg', cwd: root, issuedAt: new Date().toISOString() }));
const segc = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `foo -C ${other2 ?? root} build && git commit -m "feat: seg"` } });
assert.equal(segc.status, 0);

// 24e. 狀態寫入矩陣：測試碼僅 test 節點；實作碼白名單 build/release/pass；其餘擋
const setNode = (n) => writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: n }));
writeFileSync(join(tmp, 'test-lock.json'), JSON.stringify({ entries: [{ file: join(root, 'test', 'app.test.js'), sha256: 'x' }] }));
const W = (node, tool, target) => {
  setNode(node);
  return spawnSync(process.execPath, [hook], { input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: root, tool_name: tool, tool_input: { file_path: target } }), encoding: 'utf8' });
};
// verify 節點改實作碼（本案違規場景）→ 擋
const v1 = W('verify', 'Edit', 'src/class_actor.gd');
assert.equal(v1.status, 2);
assert.match(v1.stderr, /寫入矩陣/);
assert.match(v1.stderr, /verify/);
// verdict 節點改實作碼 → 擋；MCP 寫檔工具（write_file）同擋
assert.equal(W('verdict', 'Write', 'src/app.js').status, 2);
const mcp = spawnSync(process.execPath, [hook], { input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: root, tool_name: 'mcp__ide__write_file', tool_input: { path: 'src/app.js', content: 'x' } }), encoding: 'utf8' });
assert.equal(mcp.status, 2);
// build / release / pass 節點寫實作碼 → 放行
assert.equal(W('build', 'Edit', 'src/app.js').status, 0);
assert.equal(W('release', 'Edit', 'src/app.js').status, 0);
assert.equal(W('pass', 'Edit', 'docs/guide.md').status, 0);
// 鎖定測試碼：test 節點放行；build/verify 節點擋
assert.equal(W('test', 'Edit', 'test/app.test.js').status, 0);
const tb = W('build', 'Edit', 'test/app.test.js');
assert.equal(tb.status, 2);
assert.match(tb.stderr, /測試碼/);
assert.equal(W('verify', 'Edit', 'test/app.test.js').status, 2);
// 測試慣例路徑（未鎖定）在非 test 節點也擋（build 新增 spec 檔）
assert.equal(W('build', 'Write', 'src/app.spec.js').status, 2);
// test 節點寫實作碼 → 擋（測試狀態只寫測試）
const timpl = W('test', 'Edit', 'src/app.js');
assert.equal(timpl.status, 2);
assert.match(timpl.stderr, /實作檔/);
// .shiftblame 內永遠可寫；讀取類工具不攔
assert.equal(W('verify', 'Edit', '.shiftblame/tmp/evidence.txt').status, 0);
const rd = spawnSync(process.execPath, [hook], { input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: root, tool_name: 'mcp__ide__read_file', tool_input: { path: 'src/app.js' } }), encoding: 'utf8' });
assert.equal(rd.status, 0);
// 專案外檔案不歸矩陣管
assert.equal(W('verify', 'Edit', 'C:/Windows/Temp/x.txt').status, 0);
setNode('verify');

// 24f. 實攻修復回歸：_test_ 中綴不再誤判、裝置前綴、decoy 鍵、put/manage 工具、駝峰鍵
// build 寫「名含 test_ 的實作檔」→ 放行（誤擋消除）
assert.equal(W('build', 'Edit', 'src/test_utils.js').status, 0);
assert.equal(W('build', 'Edit', 'src/renamed_test_helper.js').status, 0);
// test 節點寫 src 內非測試慣例檔 → 仍擋（實作檔）
assert.equal(W('test', 'Edit', 'src/renamed_test_helper.js').status, 2);
// 副檔名慣例保留：foo.test.js / foo_test.py 於非 test 節點擋
assert.equal(W('build', 'Write', 'src/foo.test.js').status, 2);
assert.equal(W('build', 'Write', 'src/foo_test.py').status, 2);
// `\\?\` 裝置前綴 → 擋（相對 root 的 src；於 verify 節點）
setNode('verify');
const dev = spawnSync(process.execPath, [hook], { input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: root, tool_name: 'Write', tool_input: { file_path: '\\\\?\\' + root.replace(/\//g, '\\') + '\\src\\app.js' } }), encoding: 'utf8' });
assert.equal(dev.status, 2);
// decoy 鍵：file_path 指工作區但 path 指實作碼 → 擋
const decoy = spawnSync(process.execPath, [hook], { input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: root, tool_name: 'mcp__ide__write_file', tool_input: { file_path: '.shiftblame/tmp/x.txt', path: 'src/app.js' } }), encoding: 'utf8' });
assert.equal(decoy.status, 2);
// 駝峰鍵 filePath → 擋
const camel = spawnSync(process.execPath, [hook], { input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: root, tool_name: 'Write', tool_input: { filePath: 'src/app.js' } }), encoding: 'utf8' });
assert.equal(camel.status, 2);
// 工具名 put／filesystem_manage（雙用途）於 verify 寫 src → 擋
assert.equal(W('verify', 'mcp__fs__put', 'src/app.js').status, 2);
assert.equal(W('verify', 'mcp__godot__filesystem_manage', 'src/app.js').status, 2);
// 讀取豁免：read_file 於 verify 讀 src → 放行
assert.equal(W('verify', 'mcp__ide__read_file', 'src/app.js').status, 0);
setNode('verify');

// 25. sb 根錨定：在 git 根的子目錄執行 sb init，狀態檔落在根
const projRoot = mkdtempSync(join(tmpdir(), 'sb-anchor-'));
mkdirSync(join(projRoot, 'sub/deeper'), { recursive: true });
spawnSync('git', ['init'], { cwd: projRoot, encoding: 'utf8' });
const sbInit = spawnSync(process.execPath, [join(repo, 'cli', 'bin', 'sb.mjs'), 'init', 'demo'], { cwd: join(projRoot, 'sub/deeper'), encoding: 'utf8' });
assert.equal(sbInit.status, 0);
assert.ok(existsSyncFn(join(projRoot, '.shiftblame', 'flow-state.json')), '狀態檔必須落在專案根，不是子目錄');
assert.ok(!existsSyncFn(join(projRoot, 'sub/deeper/.shiftblame')), '子目錄不得長出流浪 .shiftblame');
// sb init 落實 .gitignore（verdict 樹檢查依賴）
assert.match(readFileSync(join(projRoot, '.gitignore'), 'utf8'), /\.shiftblame\//);
// commitmsg 於 verify 節點 → 拒（防驗收期間偷改＋偷 commit 洗白鏈）
writeFileSync(join(projRoot, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'verify' }));
const cmVer = spawnSync(process.execPath, [join(repo, 'cli', 'bin', 'sb.mjs'), 'commitmsg', 'feat: 偷蓋'], { cwd: projRoot, encoding: 'utf8' });
assert.equal(cmVer.status, 1);
assert.match(cmVer.stderr, /不得產生 commit 印章/);
rmSync(projRoot, { recursive: true, force: true });
