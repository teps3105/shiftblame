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
assert.equal(manifest.version, '1.8.0');
assert.equal(cliPackage.version, manifest.version);
assert.match(skill, /version: "1\.8\.0"/);

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
assert.match(read('cli', 'bin', 'sb.mjs'), /閘保持封閉/, '診斷只揭露不降級（閘保持封閉）');

// 八段詞彙落地
assert.match(skill, /intent→audit→research→plan→test→build→verify→done/);
assert.match(skill, /回 intent/);
assert.match(skill, /時點①對抗/);
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

// 1.7.0 雙流模型落地（時序由輸入流順序天然承擔）
assert.match(skill, /輸入流/);
assert.match(skill, /雙流模型/);
assert.match(skill, /輸入流/);
assert.match(skill, /理解流/);
assert.match(skill, /必然曝光/);
assert.match(skill, /抗上下文壓縮|抗壓縮/);
assert.match(skill, /外部證據打底/, 'SKILL 記載 G2 外部證據打底（1.6.0）');
assert.match(skill, /externalEvidence/, 'SKILL 記載 externalEvidence 閘');
assert.match(skill, /大型研究.*MUST 外部唯讀子代理/s, 'SKILL 記載大型研究 MUST 子代理承擔');
assert.match(readme, /雙流模型/);
assert.match(readme, /輸入流/);
assert.match(readme, /理解宣告/);
assert.match(readme, /外部性/, 'README 記載研究／返工外部性閘（1.6.0）');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /EXTERNAL_RESEARCH_TOOLS/, 'hooks 外部工具清單存在');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /⑨/, 'CARD⑨ 外部性閘條');
assert.ok(!read('hooks', 'shiftblame-guard.mjs').includes('isUnlockCmd'), '解鎖單體通道已撤（1.7.0）');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /recordInput/, 'hooks 輸入流記錄');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /recordUnderstanding/, 'hooks 理解流記錄');
assert.match(read('cli', 'bin', 'sb.mjs'), /cmdUnlockRetired/, 'sb unlock 退役');
assert.match(read('cli', 'bin', 'sb.mjs'), /陳述對照閘/, '陳述對照閘（永續層文件↔實況）');
assert.match(skill, /兩層文件模型/, '兩層文件模型條文');
assert.match(readme, /兩層文件模型/, 'README 兩層文件模型記載');
assert.match(read('cli', 'bin', 'sb.mjs'), /陳述對照閘/, '陳述對照閘（永續層文件↔實況）');
assert.match(skill, /兩種觸發樣態/, 'SKILL 兩種觸發樣態條文（1.7.2 主動觸發停等）');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /checkHoldFreeze/, 'hooks 停等凍結（hold 硬擋寫入與推進）');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /understandingHold/, 'hooks understandingHold 狀態機');
assert.match(skill, /段-檔承載規格/, 'SKILL 段-檔承載規格（1.7.3 四閉環軸）');
assert.match(skill, /輪內單向定律/, 'SKILL 輪內單向定律（一次定律退役）');
assert.match(read('cli', 'bin', 'sb.mjs'), /snapshotRev/, 'CLI 輪次快照（回 intent 凍結 rev 基線）');
assert.match(read('cli', 'bin', 'sb.mjs'), /auditEvidence/, 'CLI 審計痕跡閘（audit→research 邊驗）');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /markAuditEvidence/, 'hooks 審計痕跡標記');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /checkGFileMatrix/, 'hooks G 檔寫入矩陣（定義邊寫、落地邊唯讀）');
assert.match(read('skills', 'shiftblame', 'references', 'AUDIT.md'), /現況審計/, 'AUDIT 現況審計（審計先於研究）');
assert.match(read('skills', 'shiftblame', 'references', 'AUDIT.md'), /BDD 行為規格/, 'AUDIT BDD 行為規格');
assert.match(read('skills', 'shiftblame', 'references', 'TEST.md'), /G3 落地邊/, 'TEST G3 落地邊歸位');
assert.match(read('skills', 'shiftblame', 'references', 'VERIFY.md'), /G1 裁判邊/, 'VERIFY G1 裁判邊歸位');
assert.match(skill, /消融原則/, 'SKILL 消融原則（1.8.0 方法論六落點）');
assert.match(read('cli', 'bin', 'sb.mjs'), /六鍵（1.8.0＋消融/, 'BDD 第六鍵消融（validateG1Acceptance）');
assert.match(read('cli', 'test', 'sb-ablation.mjs'), /消融矩陣/, '框架本體消融矩陣（sb-ablation.mjs）');
assert.ok(existsSync(join(repo, 'cli', 'test', 'sb-ablation.mjs')), '消融矩陣測試檔存在');
assert.match(skill, /兩層文件模型/, '兩層文件模型條文（永續層對照義務／當下層用後即弃）');
assert.match(readme, /兩層文件模型/, 'README 兩層文件模型記載');

// 舊機制詞零殘留（1.5.0 的「唯開工解鎖／獨立成行／老闆詞印章 hooks 偵測」；SKILL／README／references／sb.mjs／hooks）
const legacy = ['release→test', 'verdict→', 'converge→', 'ms-done', 'sb lock', 'sb amend', 'sb report', /sb-do(?!cs)/.source, 'sb-start', 'sb-end', 'sb-commit', '--direct', 'direct-change', 'USER_OBSERVABLE', '預設直接修正',
  '獨立成行', '唯老闆「開工」解鎖', '唯「開工」解鎖', '老闆詞印章', 'bossInputs', '--self-attack', '身分切換自攻', '切換身份', '切換身分', '候選詞', '否定共現', 'CONSENT_WORDS', '非否定候選',
  '自寫候選', '候選內判讀', '詞集天險', '候選標記', '機械過濾', '機械授權過濾',
  '薄研究', '薄規劃', '薄產出', '薄流程',
  'sb unlock --quoted', 'sb unlock --stamp', '對話鎖', '令行靜止', 'thinkRouted', '消費即失效', '逐字錨定', '授權印章', 'unlockLog', '時序元規則', '收尾保鮮', '文件保鮮', '保鮮', '一次定律'];
const files = ['README.md', '.codex-plugin/plugin.json', 'hooks/hooks.json', 'skills/shiftblame/SKILL.md', 'skills/sb-think/SKILL.md', 'skills/sb-resume/SKILL.md', 'skills/sb-todo/SKILL.md', 'skills/sb-save/SKILL.md', 'skills/sb-dice/SKILL.md', 'skills/sb-docs/SKILL.md', 'skills/sb-sop/SKILL.md', 'skills/sb-roadmap/SKILL.md', 'skills/shiftblame/assets/SLUG.md', 'skills/shiftblame/assets/SOP.md', 'skills/shiftblame/assets/ROADMAP.md', 'skills/shiftblame/assets/DOCS.md', 'cli/bin/sb.mjs', 'hooks/shiftblame-guard.mjs',
  'skills/shiftblame/references/AUDIT.md', 'skills/shiftblame/references/RESEARCH.md', 'skills/shiftblame/references/PLAN.md',
  'skills/shiftblame/references/TEST.md', 'skills/shiftblame/references/BUILD.md', 'skills/shiftblame/references/VERIFY.md'];
for (const f of files) {
  const text = read(...f.split('/'));
  for (const w of legacy) {
    assert.equal(text.includes(w), false, `${f} 殘留舊詞：${w}`);
  }
}

// 條文正向化（1.7.1）：治理文件一律「做什麼」的正向形態——負向條文詞零殘留（機械防復發；
// 限制語義由「僅／唯一／保持」承擔，行為閘門不變）
for (const f of files.filter((p) => p.endsWith('.md') || p.endsWith('.json'))) {
  const text = read(...f.split('/'));
  for (const w of ['MUST NOT', '不得', '禁止']) {
    assert.equal(text.includes(w), false, `${f} 殘留負向條文詞：${w}（1.7.1 正向化）`);
  }
}

// references 版號
for (const file of ['AUDIT.md', 'RESEARCH.md', 'PLAN.md', 'TEST.md', 'BUILD.md', 'VERIFY.md']) {
  const reference = read('skills', 'shiftblame', 'references', file);
  assert.match(reference, /revision: 1\.8\.0/);
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
assert.match(readme, /--boss-ok/);
assert.match(manifest.description, /八段/);
console.log('sb-agent-governance: PASS');
