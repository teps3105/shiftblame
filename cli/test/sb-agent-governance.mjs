import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (...parts) => readFileSync(join(repo, ...parts), 'utf8');

const skill = read('skills', 'shiftblame', 'SKILL.md');
const think = read('skills', 'think', 'SKILL.md');
const readme = read('README.md');
const manifest = JSON.parse(read('.codex-plugin', 'plugin.json'));
const cliPackage = JSON.parse(read('cli', 'package.json'));

// 版號一致
assert.equal(manifest.version, '2.5.3');
assert.equal(cliPackage.version, manifest.version);
assert.match(skill, /version: "2.5.3"/);

// 輸出形狀（人話契約）與時點條目對照錨定本次對抗條目
assert.match(think, /輸出形狀（人話契約）/, 'think SKILL 承載輸出形狀節（對老闆輸出＝人話非公文）');
assert.match(read('skills', 'shiftblame', 'references', 'MECHANISMS.md'), /輸出形狀/);
assert.match(read('cli', 'bin', 'sb.mjs'), /lastAdv/, '對抗邊時點條目對照（lastAdv——舊對抗條目重複消費即擋）');

// hooks 註冊型式：單一 `command` 型配置多平台相容——ZCode 與 Codex 的 hooks schema 交集
// （command 型＋CLAUDE_PLUGIN_ROOT 兩端展開＋秒級 timeout）；不為個別平台綁專屬配置。
// inject 的 hookEventName MUST 填實際事件名（根因：hookEventName 寫死 'additionalContext'
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
assert.match(guardSrc, /HOOK_EVENTS\.includes\(event\)/, 'inject 函數層防護：非七事件字面值即拒輸出（同類缺陷結構性絕緣）');
assert.match(guardSrc, /inject\((?:[^)]*)'(?:SessionStart|UserPromptSubmit|PreToolUse|PermissionRequest|PostToolUse|PostToolUseFailure|Stop)'\)/s, '每個 inject 調用帶事件字面值');
assert.match(guardSrc, /beatHeartbeat[\s\S]{0,200}existsSync\(join\(root, '\.shiftblame'\)\)/, '心跳僅寫既有工作區（禁止流浪 cwd 長出 .shiftblame）');

// hooks 心跳＋CLI 健康診斷：hooks 死亡/未信任時閘擋附「記錄缺失≠授權缺失」警示（只診斷不降級——逃生門屬合法漏洞已否決）
assert.match(guardSrc, /beatHeartbeat/, 'hooks 每次成功執行寫心跳');
assert.match(read('cli', 'bin', 'sb.mjs'), /hooksHealthNote/, 'CLI 閘擋對照心跳輸出 hooks 健康診斷');
assert.match(read('cli', 'bin', 'sb.mjs'), /閘保持封閉/, '診斷只揭露不降級（閘保持封閉）');

// 七段圓環詞彙落地（意圖揭露＋圓環主鏈——intent 環首＝環尾；verify 判決出 fail／pass 兩種邊——done 節點已除名）
assert.match(skill, /intent→requirement→research→plan→test→build→verify/);
assert.match(skill, /意圖揭露|第一性思想/, 'SKILL 承載意圖揭露與第一性思想');
assert.match(skill, /重走 intent/);
assert.match(skill, /時點 1 對抗/);
assert.match(skill, /老闆新輸入重走 intent/);
assert.match(skill, /流程代號不進程式碼/);
assert.match(skill, /令行靜止|--adversarial 宣告/);
assert.match(skill, /節錄快照/);
assert.match(skill, /自由傾倒區/);
assert.match(skill, /SB\.md|SLUG\.md/);

// 提交格式閘（2.4.0 段內提交對抗移除——審核資源前移兩時點）與兩時點對抗落地
assert.match(skill, /sb commitmsg/);
assert.match(skill, /sb adversarial/);
assert.match(skill, /時點 2 對抗/);
assert.match(read('cli', 'bin', 'sb.mjs'), /cmdAdversarial/);
assert.match(read('cli', 'bin', 'sb.mjs'), /from: 'verify', to: 'intent', point: '2'/); // 時點 2＝verify→intent 出口邊（驗收完成、G1 回指閉環後審驗收結果——新鮮度由通用 adversarial 邊對照承載）
assert.match(readme, /sb commitmsg/);
assert.match(readme, /時點 2 對抗/);

// 對話由平台承載（時序由平台 session 序天然承擔）＋旗標即章
assert.match(skill, /對話由平台承載/);
assert.match(skill, /旗標即章/);
assert.match(skill, /理解宣告/);
assert.match(skill, /對話實蹟/, 'SKILL 記載抽查面（對話實蹟對照）');
assert.match(skill, /外部證據打底/, 'SKILL 記載 G2 外部證據打底');
assert.match(skill, /externalEvidence/, 'SKILL 記載 externalEvidence 閘');
assert.match(skill, /大型研究.*MUST 外部唯讀子代理/s, 'SKILL 記載大型研究 MUST 子代理承擔');
assert.match(readme, /對話由平台承載/);
assert.match(readme, /理解宣告/);
assert.match(readme, /外部性/, 'README 記載研究／返工外部性閘');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /EXTERNAL_RESEARCH_TOOLS/, 'hooks 外部工具清單存在');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /⑨/, 'CARD⑨ 外部性閘條');
assert.ok(!read('hooks', 'shiftblame-guard.mjs').includes('isUnlockCmd'), '解鎖單體通道已撤');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /recordInput/, 'hooks 回合邊界處理（模式追蹤重置＋舊流鍵冪等剝除）');
assert.match(read('cli', 'bin', 'sb.mjs'), /cmdUnlockAbsent/, 'sb unlock 不存在命令處理');
assert.match(read('cli', 'bin', 'sb.mjs'), /陳述對照閘/, '陳述對照閘（永續層文件↔實況）');
assert.match(skill, /文件陳述錨/, 'SKILL 記載文件陳述錨（行為測試附文件陳述斷言——刪除漂移攔截）');
assert.match(skill, /標準攻擊點清單（對抗任務組裝 MUST 轉錄）/, 'SKILL 標準攻擊點清單實體化＋轉錄義務');
assert.match(readme, /文件陳述錨/, 'README 記載文件陳述錨');
assert.match(skill, /文件先行/, 'SKILL 記載文件先行（永續層文件先於實作碼——build 順序原則）');
assert.match(read('skills', 'shiftblame', 'references', 'BUILD.md'), /文件先行（永續層義務）/, 'BUILD 記載文件先行義務');
assert.match(readme, /文件先行/, 'README 記載文件先行');
assert.match(skill, /觸發樣態——揭露第一動；未定案必問；無歧義即執行/, 'SKILL 觸發樣態條文（揭露第一動＋未定案必問）');
assert.match(skill, /段-檔承載規格/, 'SKILL 段-檔承載規格（四閉環軸）');
assert.match(skill, /輪內單向定律/, 'SKILL 輪內單向定律');
assert.match(read('cli', 'bin', 'sb.mjs'), /countRev/, 'CLI 輪次計數；');
assert.ok(!read('cli', 'bin', 'sb.mjs').includes('snapshotRev') && !read('cli', 'bin', 'sb.mjs').includes('rev/rN'), 'snapshotRev 識別字零殘留（rev 快照禁復活）');
assert.ok(!read('cli', 'bin', 'sb.mjs').includes('auditEvidence'), 'auditEvidence 識別字零殘留——CLI');
assert.ok(!read('hooks', 'shiftblame-guard.mjs').includes('markAuditEvidence') && !read('hooks', 'shiftblame-guard.mjs').includes('AUDIT_READ_TOOLS'), 'auditEvidence 識別字零殘留——hooks');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /checkGFileMatrix/, 'hooks G 檔寫入矩陣（RAM/ROM 分區）');
assert.match(read('skills', 'shiftblame', 'references', 'REQUIREMENT.md'), /經查證的現況事實/, 'REQUIREMENT 經查證的現況事實（查證先於研究）');
assert.match(read('skills', 'shiftblame', 'references', 'REQUIREMENT.md'), /BDD 行為規格/, 'REQUIREMENT BDD 行為規格');
assert.match(read('skills', 'shiftblame', 'references', 'REQUIREMENT.md'), /行為矩陣判準/, 'REQUIREMENT 行為矩陣判準（GWT 實質判準）');
assert.match(read('skills', 'shiftblame', 'references', 'REQUIREMENT.md'), /純工程工作不立法/, 'REQUIREMENT 工程活動排除條');
assert.match(read('skills', 'shiftblame', 'references', 'MECHANISMS.md'), /規格工程化/, 'MECHANISMS 規格工程化攻擊點');
assert.match(read('skills', 'shiftblame', 'references', 'TEST.md'), /G3 落地邊/, 'TEST G3 落地邊');
assert.match(read('skills', 'shiftblame', 'references', 'STRUCTURE.md'), /R1/, 'STRUCTURE 固定規則');
assert.match(read('skills', 'shiftblame', 'references', 'STRUCTURE.md'), /accepted_exception/, 'STRUCTURE 四態結果');
assert.match(read('skills', 'shiftblame', 'references', 'STRUCTURE.md'), /與七段圓環的銜接/, 'STRUCTURE 七段圓環銜接');
assert.match(read('skills', 'shiftblame', 'references', 'TEST.md'), /測試規模與穩定度成正比/, 'TEST 規模∝穩定度');
assert.match(read('skills', 'shiftblame', 'references', 'TEST.md'), /同生命週期/, 'TEST 生命週期紀律');
assert.match(skill, /STRUCTURE\.md/, 'SKILL 樹含 STRUCTURE');
assert.match(skill, /AUDIT\.md/, 'SKILL 樹含 AUDIT');
assert.match(read('skills', 'shiftblame', 'references', 'AUDIT.md'), /對抗判定：通過/, 'AUDIT 判定行格式');
assert.match(read('skills', 'shiftblame', 'references', 'AUDIT.md'), /無自代介面/, 'AUDIT 無自代介面');
assert.match(read('skills', 'shiftblame', 'references', 'AUDIT.md'), /修復複審閉環/, 'AUDIT 複審閉環');
assert.match(read('skills', 'shiftblame', 'references', 'VERIFY.md'), /真驗收執行/, 'VERIFY 真驗收執行（GWT 逐條劇本）');
assert.match(read('skills', 'shiftblame', 'references', 'VERIFY.md'), /時點 2 對抗.*出口邊/s, 'VERIFY 時點 2＝verify 出口邊對抗（驗收完成、G1 回指閉環後——build→verify 機械推進）');
assert.match(skill, /消融原則/, 'SKILL 消融原則（方法論六落點）');
assert.match(read('cli', 'bin', 'sb.mjs'), /七鍵（現狀——差異宣言左邊/, 'BDD 現狀鍵＝需求先驗（validateG1Acceptance）');
assert.match(read('cli', 'bin', 'sb.mjs'), /消融——拿掉此需求使用者失去什麼/, 'BDD 消融鍵（validateG1Acceptance）');
assert.match(read('skills', 'shiftblame', 'references', 'REQUIREMENT.md'), /現狀＝.*即偽需求/, 'REQUIREMENT 現狀差異宣言條文（需求先驗——文件陳述錨）');
assert.match(read('cli', 'test', 'sb-ablation.mjs'), /消融矩陣/, '框架本體消融矩陣（sb-ablation.mjs）');
assert.ok(existsSync(join(repo, 'cli', 'test', 'sb-ablation.mjs')), '消融矩陣測試檔存在');
assert.match(skill, /兩層文件模型/, '兩層文件模型條文（永續層對照義務／當下層用後即弃）');
assert.match(readme, /兩層文件模型/, 'README 兩層文件模型記載');

// 觀測紀律與迴圈防護（2.0.3-2.0.5 機制群——文件陳述錨）
assert.match(skill, /基質優先/, 'SKILL 記載基質優先（重複造輪子準入判準）');
assert.match(skill, /元行為錨定/, 'SKILL 記載元行為錨定（規則由實測推導）');
assert.match(skill, /修剪迴路/, 'SKILL 記載修剪迴路（每 ms 審查三問）');
assert.match(skill, /sb sopreview/, 'SKILL 記載 sb sopreview 審查留痕');
assert.match(skill, /merge <slug>/, 'SKILL 記載固定合併訊息 merge <slug>');
assert.match(skill, /外部協作倉庫依該倉庫自身的 issue／PR 策略/, 'SKILL 記載協作倉庫政策讓位');
assert.match(skill, /在 main 直接作業的工作屬於 main，無合併步驟/, 'SKILL 記載 main 直接作業免合併');
assert.match(skill, /sb-usage\.jsonl/, 'SKILL 記載 usage 觀測事件');
assert.match(skill, /flow-state 恆定長/, 'SKILL 記載 flow-state 定長承載（對話流零落檔）');
assert.match(skill, /迴圈斷路器/, 'SKILL 記載迴圈斷路器（擋行為模式——無變更重跑即擋）');
assert.match(skill, /工作做到完成為止/, 'SKILL 記載計數純觀測（工作做到完成為止）');
assert.match(readme, /迴圈斷路器/, 'README 記載迴圈斷路器');
assert.match(readme, /基質優先/, 'README 記載方法論（基質優先）');
assert.ok(!skill.includes('INDEX.md'), 'SKILL 歸檔清單機制零殘留（archive 僅承載 slug 目錄）');
assert.ok(!readme.includes('INDEX.md'), 'README 歸檔清單機制零殘留');
assert.match(read('cli', 'bin', 'sb.mjs'), /cmdSopreview/, 'CLI SOP／ROADMAP 審查留痕命令');
assert.match(read('cli', 'bin', 'sb.mjs'), /sb-usage\.jsonl/, 'CLI usage 事件落檔');
assert.match(read('cli', 'bin', 'sb.mjs'), /telemetry/, 'CLI 產出遙測（sb end）');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /countUsage/, 'hooks 回合計數＋斷路器模式判定');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /repeats\[fp\] = 'seen'/, 'hooks 指紋記錄（模式①判定基礎）');
assert.match(skill, /停點偵測/, 'SKILL 記載停點偵測（防偷懶停——活動流程無申報擋停一次）');
assert.match(skill, /sb stop-report/, 'SKILL 記載停點申報命令（合法停點載體）');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /stopReportLine/, 'hooks 停點申報曝光行（老闆終審真待決 or 偷懶）');
assert.match(read('cli', 'bin', 'sb.mjs'), /cmdStopReport/, 'CLI 停點申報命令（活動態＋實質門檻）');
assert.match(skill, /診斷與狀態修復自由/, 'SKILL 記載異常模式修復自由（唯讀白名單已除）');
assert.match(read('hooks', 'shiftblame-guard.mjs'), /修復是異常模式的目的/, 'hooks 異常模式政策：修復自由＋封閉 git 寫入／sb 流程命令');

// 掃描檔案清單（歷史書寫禁令＋負向條文詞掃描的承載面；下沉機制檔 MECHANISMS 同批把關）
const files = ['README.md', '.codex-plugin/plugin.json', 'hooks/hooks.json', 'skills/shiftblame/SKILL.md', 'skills/think/SKILL.md', 'skills/resume/SKILL.md', 'skills/save/SKILL.md', 'skills/dice/SKILL.md', 'skills/shiftblame/assets/SLUG.md', 'skills/shiftblame/assets/SOP.md', 'skills/shiftblame/assets/ROADMAP.md', 'skills/shiftblame/assets/DOCS.md', 'cli/bin/sb.mjs', 'hooks/shiftblame-guard.mjs',
  'skills/shiftblame/references/REQUIREMENT.md', 'skills/shiftblame/references/RESEARCH.md', 'skills/shiftblame/references/PLAN.md', 'skills/shiftblame/references/STRUCTURE.md', 'skills/shiftblame/references/AUDIT.md',
  'skills/shiftblame/references/TEST.md', 'skills/shiftblame/references/BUILD.md', 'skills/shiftblame/references/VERIFY.md', 'skills/shiftblame/references/MECHANISMS.md'];

// 歷史書寫禁令：repo 只寫當下事實——版本編年史、事件態裁定、死機制敘述的居所是 .shiftblame/ 與 git
// （版本欄與 revision: 行是當前版本同步聲明，由版號一致斷言對照。防舊機制復活由消融矩陣＋現行正向錨＋對抗審查承擔，
//  歷史由 git 承擔——以負向禁詞清單累積歷史殘留替代重新設計屬規則堆疊，歷史禁詞表已退役）
import { readdirSync } from 'node:fs';
const VER_PAREN = new RegExp('\\uff08' + '[^\\uff09\\u00a7]*' + '1' + '\\.' + '\\d'); // 中文括號內含版本號即編年史（§ 章節引用除外；拼接構造避免本檔自命中）
const CHRONICLE = ['老闆已否決', '老闆已拍板', '老闆裁定：', '老闆拍板：', '撤鎖範式', '前既有', '實事故'];
const testFiles = readdirSync(join(repo, 'cli', 'test')).filter((n) => n.endsWith('.mjs')).map((n) => 'cli/test/' + n);
for (const f of [...files, ...testFiles.filter((p) => p !== 'cli/test/sb-agent-governance.mjs')]) {
  const text = read(...f.split('/'));
  assert.equal(text.search(VER_PAREN), -1, `${f} 殘留版本編年史（repo 只寫當下事實）`);
  for (const w of CHRONICLE) {
    assert.equal(text.includes(w), false, `${f} 殘留歷史書寫：${w}`);
  }
}
// 禁令承載者自查（本檔）：版本括號樣式零殘留（拼接 regex 零自指）
assert.equal(read('cli', 'test', 'sb-agent-governance.mjs').search(VER_PAREN), -1, 'governance 自身零版本編年史');

// 條文正向化：治理文件一律「做什麼」的正向形態——負向條文詞零殘留（機械防復發；
// 限制語義由「僅／唯一／保持」承擔，行為閘門不變）
for (const f of files.filter((p) => p.endsWith('.md') || p.endsWith('.json'))) {
  const text = read(...f.split('/'));
  for (const w of ['MUST NOT', '不得', '禁止']) {
    assert.equal(text.includes(w), false, `${f} 殘留負向條文詞：${w}（正向化）`);
  }
}

// references 與 assets 版號（revision: 行＝當前版本同步聲明，與 manifest 一致）
for (const [dir, file] of [
  ...['REQUIREMENT.md', 'RESEARCH.md', 'PLAN.md', 'TEST.md', 'BUILD.md', 'VERIFY.md', 'STRUCTURE.md', 'AUDIT.md', 'MECHANISMS.md'].map((f) => ['references', f]),
  ...['SLUG.md', 'SOP.md', 'ROADMAP.md', 'DOCS.md'].map((f) => ['assets', f]),
]) {
  const doc = read('skills', 'shiftblame', dir, file);
  assert.match(doc, new RegExp('revision: ' + manifest.version.replace(/\./g, '\\.')), `${dir}/${file} revision 同步`);
}

// 技能清單：4 個功能型存在；文件類技能已退役（流程與寫入矩陣直接承載）；9 個已退役
import { existsSync } from 'node:fs';
for (const k of ['think', 'save', 'resume', 'dice', 'shiftblame']) {
  assert.ok(existsSync(join(repo, 'skills', k, 'SKILL.md')), `技能 ${k} 應存在`);
}
for (const k of ['sb-start', 'sb-do', 'sb-end', 'sb-commit', 'sb-report', 'docs', 'sop', 'roadmap', 'todo']) {
  assert.equal(existsSync(join(repo, 'skills', k, 'SKILL.md')), false, `技能 ${k} 應已刪除`);
}

// shiftblame:think 核心語義
assert.match(think, /全域路由|唯一閘口/);
assert.match(think, /回 intent|回think/);
assert.match(readme, /七段|requirement → research/);
assert.match(readme, /--boss-ok/);
assert.match(manifest.description, /七段/);
console.log('sb-agent-governance: pass');
