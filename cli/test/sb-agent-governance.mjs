import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (...parts) => readFileSync(join(repo, ...parts), 'utf8');

const skill = read('skills', 'shiftblame', 'SKILL.md');
const think = read('skills', 'sb-think', 'SKILL.md');
const readme = read('README.md');
const manifest = JSON.parse(read('.codex-plugin', 'plugin.json'));
const cliPackage = JSON.parse(read('cli', 'package.json'));

// 版號一致
assert.equal(manifest.version, '1.6.1');
assert.equal(cliPackage.version, manifest.version);
assert.match(skill, /version: "1\.6\.1"/);

// hooks 註冊型式（1.6.1）：單一 `command` 型配置多平台相容——ZCode 與 Codex 的 hooks schema 交集
// （command 型＋CLAUDE_PLUGIN_ROOT 兩端展開＋秒級 timeout）；不為個別平台綁專屬配置。
// inject 的 hookEventName MUST 填實際事件名（1.6.0 的 233 次 hook.run.failed 真根因：寫死 'additionalContext'
// 使 additionalContext 注入被 strict schema 丟棄——副作用生效但卡片/曝光全瞎）
const hooksJson = JSON.parse(read('hooks', 'hooks.json'));
for (const [evt, entries] of Object.entries(hooksJson.hooks)) {
  for (const entry of entries) {
    for (const h of entry.hooks) {
      assert.equal(h.type, 'command', `hooks.json ${evt} 為單一 command 型（雙平台 schema 交集）`);
      assert.ok(h.command.includes('${CLAUDE_PLUGIN_ROOT}/hooks/shiftblame-guard.mjs'), `hooks.json ${evt} 經 CLAUDE_PLUGIN_ROOT 兩端展開指向 guard`);
      assert.equal(h.timeout, 10, `hooks.json ${evt} 秒級 timeout（雙平台皆認）`);
    }
  }
}
const guardSrc = read('hooks', 'shiftblame-guard.mjs');
assert.ok(!guardSrc.includes("hookEventName: 'additionalContext'"), 'inject 不得寫死事件名（strict schema 歸因驗證）');
assert.match(guardSrc, /hookEventName: event/, 'inject hookEventName 填實際事件名');
assert.match(guardSrc, /HOOK_EVENTS\.includes\(event\)/, 'inject 函數層防護：非七事件字面值即拒輸出（同類病灶結構性絕緣）');
assert.match(guardSrc, /inject\((?:[^)]*)'(?:SessionStart|UserPromptSubmit|PreToolUse|PermissionRequest|PostToolUse|PostToolUseFailure|Stop)'\)/s, '每個 inject 調用帶事件字面值');
assert.match(guardSrc, /beatHeartbeat[\s\S]{0,200}existsSync\(join\(root, '\.shiftblame'\)\)/, '心跳僅寫既有工作區（禁止流浪 cwd 長出 .shiftblame）');

// hooks 心跳＋CLI 健康診斷（1.6.1）：hooks 死亡/未信任時閘擋附「記錄缺失≠授權缺失」警示（只診斷不降級——逃生門屬合法漏洞已否決）
assert.match(guardSrc, /beatHeartbeat/, 'hooks 每次成功執行寫心跳');
assert.match(read('cli', 'bin', 'sb.mjs'), /hooksHealthNote/, 'CLI 閘擋對照心跳輸出 hooks 健康診斷');
assert.match(read('cli', 'bin', 'sb.mjs'), /不得繞閘/, '診斷只揭露不降級（fail-closed 不變）');

// 八段詞彙落地
assert.match(skill, /intent→audit→research→plan→test→build→verify→done/);
assert.match(skill, /回 intent/);
assert.match(skill, /時點①對抗/);
assert.match(skill, /對話鎖/);
assert.match(skill, /回頭自由/);
assert.match(skill, /流程代號不進程式碼/);
assert.match(skill, /令行靜止|--adversarial 宣告/);
assert.match(skill, /節錄快照/);
assert.match(skill, /自由傾倒區/);
assert.match(skill, /SB\.md|SLUG\.md/);

// 1.5.2 提交對抗閘與返工直通落地
assert.match(skill, /提交對抗閘/);
assert.match(skill, /sb adversarial/);
assert.match(skill, /返工直通/);
assert.match(skill, /--rerun/);
assert.match(read('cli', 'bin', 'sb.mjs'), /cmdAdversarial/);
assert.match(readme, /提交對抗閘/);
assert.match(readme, /返工直通/);

// 1.5.1 時序元規則落地
assert.match(skill, /時序元規則/);
assert.match(skill, /sb unlock --quoted/);
assert.match(skill, /消費即失效/);
assert.match(skill, /抗上下文壓縮|抗壓縮/);
assert.match(skill, /外部證據打底/, 'SKILL 記載 G2 外部證據打底（1.6.0）');
assert.match(skill, /externalEvidence/, 'SKILL 記載 externalEvidence 閘');
assert.match(skill, /大型研究.*MUST 外部唯讀子代理/s, 'SKILL 記載大型研究 MUST 子代理承擔');
assert.match(readme, /sb unlock --quoted/);
assert.match(readme, /理解宣告/);
assert.match(readme, /外部性/, 'README 記載研究／返工外部性閘（1.6.0）');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /EXTERNAL_RESEARCH_TOOLS/, 'hooks 外部工具清單存在');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /⑨/, 'CARD⑨ 外部性閘條');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /isUnlockCmd/, 'Bash 攔截放行 sb unlock（解鎖通道）');

// 舊機制詞零殘留（1.5.0 的「唯開工解鎖／獨立成行／老闆詞印章 hooks 偵測」；SKILL／README／references／sb.mjs／hooks）
const legacy = ['release→test', 'verdict→', 'converge→', 'ms-done', 'sb lock', 'sb amend', 'sb report', /sb-do(?!cs)/.source, 'sb-start', 'sb-end', 'sb-commit', '--direct', 'direct-change', 'USER_OBSERVABLE', '預設直接修正',
  '獨立成行', '唯老闆「開工」解鎖', '唯「開工」解鎖', '老闆詞印章', 'bossInputs', '--self-attack', '身分切換自攻', '切換身份', '切換身分', '候選詞', '否定共現', 'CONSENT_WORDS', '非否定候選',
  '自寫候選', '候選內判讀', '詞集天險', '候選標記', '機械過濾', '機械授權過濾',
  '薄研究', '薄規劃', '薄產出', '薄流程'];
const files = ['README.md', '.codex-plugin/plugin.json', 'hooks/hooks.json', 'skills/shiftblame/SKILL.md', 'skills/sb-think/SKILL.md', 'cli/bin/sb.mjs', 'hooks/shiftblame-guard.mjs',
  'skills/shiftblame/references/AUDIT.md', 'skills/shiftblame/references/RESEARCH.md', 'skills/shiftblame/references/PLAN.md',
  'skills/shiftblame/references/TEST.md', 'skills/shiftblame/references/BUILD.md', 'skills/shiftblame/references/VERIFY.md'];
for (const f of files) {
  const text = read(...f.split('/'));
  for (const w of legacy) {
    assert.equal(text.includes(w), false, `${f} 殘留舊詞：${w}`);
  }
}

// references 版號
for (const file of ['AUDIT.md', 'RESEARCH.md', 'PLAN.md', 'TEST.md', 'BUILD.md', 'VERIFY.md']) {
  const reference = read('skills', 'shiftblame', 'references', file);
  assert.match(reference, /revision: 1\.6\.1/);
}

// 技能清單：8 個功能型存在；5 個流程型已刪
import { existsSync } from 'node:fs';
for (const k of ['sb-think', 'sb-save', 'sb-resume', 'sb-dice', 'sb-docs', 'sb-sop', 'sb-roadmap', 'sb-todo', 'shiftblame']) {
  assert.ok(existsSync(join(repo, 'skills', k, 'SKILL.md')), `技能 ${k} 應存在`);
}
for (const k of ['sb-start', 'sb-do', 'sb-end', 'sb-commit', 'sb-report']) {
  assert.equal(existsSync(join(repo, 'skills', k, 'SKILL.md')), false, `技能 ${k} 應已刪除`);
}

// sb-think 核心語義
assert.match(think, /全域路由|唯一閘口/);
assert.match(think, /回 intent|回think/);
assert.match(readme, /八段|intent → audit/);
assert.match(readme, /對話鎖/);
assert.match(readme, /授權印章|印章/);
assert.match(manifest.description, /八段/);
console.log('sb-agent-governance: PASS');
