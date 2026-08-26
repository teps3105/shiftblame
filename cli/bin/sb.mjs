#!/usr/bin/env node
// sb — shiftblame 流程狀態機 CLI：把流程規範鎖死為可機械查核的閘門。
//
// 對抗兩類系統性問題：
//   1. 「不自知推進」——agent 自以為該推進就推進，跳過檢查/確認而不自覺。
//      對策：單向節點鏈＋每個推進點的前置閘門；推進 MUST 跑 `sb next`，閘門
//      不過即擋（exit 1）。老闆決策點 MUST 帶 --boss-ok（顯性留痕）。
//   2. 「四假」——假需求（G1 驗收不可查核）、假規劃（G3 無失敗模式/步驟）、
//      假測試（無斷言）、假驗收（反證敷衍/未驗寫「無」）。
//      對策：各階段閘門內建機械訊號檢查（見 CHECKS）。
//
// 無依賴（node:fs / node:crypto / node:path / node:child_process）。在 <repo>（專案根）
// 執行；寫入僅 <repo>/.shiftblame/（狀態檔 flow-state.json 與 tmp/）。
// exit：0 = PASS，1 = 閘門擋下，2 = 用法錯誤。

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const SB_DIR = '.shiftblame';
const TMP = join(SB_DIR, 'tmp');
const STATE_FILE = join(SB_DIR, 'flow-state.json');
const LOCK_FILE = join(TMP, 'test-lock.json');
const CONTRACT_FILE = join(TMP, 'g1-contract.md');

// ———— 檢查規則常數（四假訊號，日後按需調整） ————

// 假需求：驗收標準不得含不可查核的模糊謂詞
const VAGUE = ['完善', '正常運作', '順利', '合理', '適當', '良好', '友好', '自如', '更好', '優化用戶體驗', 'works properly', 'user-friendly'];
// 假測試：測試碼至少出現一次斷言 API（跨語言常見集）
const ASSERT_RE = /\b(assert\w*|expect\w*|should(?:\.\w+)?|assertEq|assertAlmostEqual|CHECK|FAIL\(|t\.Error|t\.Fatal|expectException|toBe|toEqual|to_be)\b/;
// 敷衍詞（段落全為此類 = 假）
const COP_OUT = /^(無|無風險|沒有|暫無|none|n\/?a|待補|略|不適用|無法)[。.\s]*$/i;

// ———— 節點鏈（單向；next = 允許的下一步） ————

const FLOW = {
  think:    { next: ['audit'], desc: 'sb-think 意圖確認' },
  audit:    { next: ['research'], desc: '審計 G1' },
  research: { next: ['plan'], desc: '研究 G2' },
  plan:     { next: ['release'], desc: '規劃 G3' },
  release:  { next: ['test', 'commit'], desc: '放行（§10 核對後）' },  // release→commit --direct = 預設直接修正
  test:     { next: ['build'], desc: '測試碼定義＋lock' },
  build:    { next: ['commit'], desc: '實作＋實機驗證' },
  commit:   { next: ['verify', 'converge'], desc: 'commit 存檔＝建立待驗對象（先於驗收）' },
  verify:   { next: ['verdict'], desc: '對存檔跑 CI 到綠燈＋報告' },
  verdict:  { next: ['converge', 'test'], desc: '秘書判決：通過→收斂或開下一功能小循環' },
  converge: { next: ['ms-done'], desc: 'ms 收斂（三面向重審）' },
  'ms-done': { next: ['audit', 'pass'], desc: '老闆決定：開新 ms 或結束 slug' },
  pass:     { next: [], desc: 'slug PASS（終態，收尾保鮮＋archive 由 sb-end 執行）' },
};

const BOSS_NODES = new Set(['audit', 'release', 'ms-done', 'pass']); // 這些推進 MUST --boss-ok

// ———— 小工具 ————

const out = (m) => console.log(m);
const die = (msgs, code = 1) => { console.error('FAIL'); for (const m of msgs) console.error(`  ✗ ${m}`); process.exit(code); };
const fin = (msgs) => { console.log('PASS'); for (const m of msgs) console.log(`  ✓ ${m}`); process.exit(0); };
const usage = (code = 2) => {
  console[code ? 'error' : 'log'](`sb — shiftblame 流程狀態機（在 <repo> 專案根執行）

用法：
  sb init <slug>                        開 slug：建立 flow-state.json（節點 think）
  sb state                              顯示目前節點、可走下一步與其前置條件
  sb next <node> [--boss-ok] [--direct] 推進節點（閘門不過即擋）
                                        --boss-ok：老闆拍板點的顯性留痕
                                        --direct：release→commit 預設直接修正路徑
  sb amend --boss-ok                    顯式修約：解除 G1 鎖定並退回 audit
  sb lock <測試碼...>                    測試定稿：斷言初篩＋sha256 鎖定基準
  sb report                              彙整自包含外部審計報告 → tmp/report-*.md
                                        （當前節點＋G1/G2/G3 全文＋執行證據＋審計判準）
  sb commitmsg "<訊息>"                  提交訊息機械驗證（type 前綴＋長度＋禁追蹤編號）
                                        任何 commit 前 MUST 通過（sb-commit 技能）`);
  process.exit(code);
};

const readJson = (p) => JSON.parse(readFileSync(p, 'utf-8'));
const mdOf = (p) => (existsSync(p) ? readFileSync(p, 'utf-8') : null);

// 取含關鍵詞的標題段內容（到同級/更高等級標題前）
function section(text, keyword) {
  const lines = text.split('\n');
  let start = -1, level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (!m) continue;
    if (start >= 0 && m[1].length <= level) break;
    if (start < 0 && m[2].includes(keyword)) { start = i; level = m[1].length; }
  }
  return start < 0 ? null : lines.slice(start + 1).join('\n').trim();
}

// 段落實質性：非空、有效字數達標、非全敷衍行
function substantive(body, minLen = 20) {
  if (!body) return false;
  const s = body.replace(/^[>#\-\s*]+/gm, '').replace(/\s+/g, '');
  if (s.length < minLen) return false;
  const lines = body.split('\n').map((l) => l.replace(/^[>#\-\s*]+/, '').trim()).filter(Boolean);
  return lines.length > 0 && !lines.every((l) => COP_OUT.test(l));
}

const msDir = (st) => join(SB_DIR, st.slug, st.ms);
const gPath = (st, n) => join(msDir(st), `G${n}.md`);
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

function checkCleanWorktree(problems, passes, timing) {
  try {
    const dirty = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (dirty.trim()) problems.push(`${timing} working tree 必須乾淨——該提交的先依 sb-commit 精準提交，該捨棄的明確捨棄，不得把未分類變更帶回 G1`);
    else passes.push(`working tree 乾淨（${timing}已完成提交／捨棄判定）`);
  } catch { passes.push('（非 git 環境，略過乾淨度檢查）'); }
}

// ———— 各節點推進閘門（target = 要進入的節點） ————

function gate(st, target, opts) {
  const problems = [];
  const passes = [];

  if (st.g1Contract?.ms === st.ms) {
    const path = st.g1Contract.file;
    if (!path || !existsSync(path)) problems.push(`G1 契約檔不存在：${path ?? '缺失'}——不得繼續；以 sb amend --boss-ok 顯式修約`);
    else if (sha256(path) !== st.g1Contract.sha256) problems.push('G1 已偏離放行時契約——局部技術模型不得改義；以 sb amend --boss-ok 顯式修約');
    if (!st.g1Contract.snapshot || !existsSync(st.g1Contract.snapshot) || sha256(st.g1Contract.snapshot) !== st.g1Contract.sha256) problems.push('G1 契約快照遺失或被修改——不得繼續；以 sb amend --boss-ok 顯式修約');
    if (!problems.length) passes.push(`G1 契約鎖定核對：${st.g1Contract.sha256.slice(0, 12)}`);
  }

  if (BOSS_NODES.has(target)) {
    if (!opts.bossOk) problems.push(`「${target}」是老闆拍板點——MUST 帶 --boss-ok（顯性留痕，不可由 agent 自行推進）`);
    else passes.push('老闆拍板留痕（--boss-ok）');
  }

  const g1 = mdOf(gPath(st, 1)), g2 = mdOf(gPath(st, 2)), g3 = mdOf(gPath(st, 3));
  const latestVerify = () => {
    if (!existsSync(TMP)) return null;
    const c = readdirSync(TMP).filter((f) => /^verify-.*\.md$/i.test(f)).sort();
    return c.length ? { name: c.at(-1), text: readFileSync(join(TMP, c.at(-1)), 'utf-8') } : null;
  };
  const latestBuild = () => {
    if (!existsSync(TMP)) return null;
    const c = readdirSync(TMP).filter((f) => /^build-.*\.md$/i.test(f)).sort();
    return c.length ? join(TMP, c.at(-1)) : null;
  };

  switch (target) {
    case 'research': // 假需求閘
      if (!g1) problems.push('G1 不存在（.shiftblame/<slug>/<ms>/G1.md）');
      else {
        const acc = section(g1, '驗收');
        if (acc === null) problems.push('G1 缺「驗收」段——需求沒有可查核的「完成」定義（假需求訊號）');
        else {
          if (!substantive(acc)) problems.push('G1 驗收段敷衍——驗收標準是不可查核的空話（假需求訊號）');
          const vague = VAGUE.filter((v) => acc.includes(v));
          if (vague.length) problems.push(`G1 驗收段含模糊謂詞「${vague.join('、')}」——不可查核（假需求訊號），改寫為可觀察的行為/狀態`);
          if (!problems.length) passes.push('G1 驗收標準可查核（存在＋實質＋無模糊謂詞）');
        }
      }
      break;

    case 'plan':
      if (!g2) problems.push('G2 不存在');
      else if (!substantive(g2, 30)) problems.push('G2 內容空泛——研究產出無實質內容，規劃無依據（薄研究也要有真結論，不是空話）');
      else passes.push('G2 實質存在');
      break;

    case 'release': { // 假規劃閘（起始效應）
      if (!g1) problems.push('G1 不存在——無法封存需求契約');
      if (!g3) problems.push('G3 不存在');
      else {
        const fm = section(g3, '失敗模式');
        if (fm === null) problems.push('G3 缺「失敗模式」段——premortem：假設計畫失敗了，最可能 2-3 個原因是什麼（假規劃/起始效應訊號）');
        else if (!substantive(fm, 10)) problems.push('G3「失敗模式」段敷衍——列不出真實失敗點＝沒想過會怎麼失敗');
        else passes.push('G3 失敗模式（premortem）非敷衍');
        const steps = section(g3, '實作步驟');
        if (steps === null) problems.push('G3 缺「實作步驟」段——計畫沒有可執行的步驟（假規劃訊號）');
        else if (!substantive(steps, 10)) problems.push('G3「實作步驟」段敷衍');
        else passes.push('G3 實作步驟實質存在');
      }
      const align = mdOf(join(TMP, 'alignment-check.md'));
      if (!align) problems.push(`${TMP}/alignment-check.md 不存在——放行前 §10 三對六向一致性核對 MUST 落記錄（G1↔G2、G2↔G3、G1↔G3）`);
      else if (!align.includes('G1') || !align.includes('G3')) problems.push('alignment-check.md 缺三對核對內容');
      else passes.push('§10 三對六向核對記錄存在');
      break;
    }

    case 'test':
      // release→test（重流程首個功能）或 verdict→test（判決通過開下一功能小循環）
      break;

    case 'build': // 假測試閘（lock 存在＝斷言初篩已過）
      if (!existsSync(LOCK_FILE)) problems.push(`${LOCK_FILE} 不存在——測試階段定稿後 MUST 跑 sb lock（含無斷言初篩），鎖定前不得寫實作`);
      else passes.push('測試已鎖定（sb lock 已跑，斷言初篩通過）');
      break;

    case 'verify': {
      // 待驗對象＝重流程存檔（build→commit）；直接修正（release→commit --direct）無測試可驗
      const commitIn = st.history.filter((h) => h.to === 'commit').at(-1);
      if (!commitIn || commitIn.from !== 'build') problems.push('commit 節點非重流程存檔（build→commit）——直接修正無測試可驗，不得進驗收');
      if (!latestBuild()) problems.push(`${TMP}/build-*.md 不存在——實作完成 MUST 落實機驗證記錄（含驗證方式與結果），未驗證不得進驗收`);
      else passes.push('實作＋實機驗證記錄存在');
      break;
    }

    case 'verdict': { // 假驗收閘（完成效應）＋測試鎖定核對（判決含鎖定核對）
      const rpt = latestVerify();
      if (!rpt) { problems.push(`${TMP}/verify-*.md 不存在——驗收 MUST 落結構化報告`); break; }
      const fals = section(rpt.text, '反證嘗試');
      if (fals === null) problems.push(`${rpt.name} 缺「反證嘗試」段——做了什麼嘗試讓它失敗（邊界輸入/拔依賴/極端情境）與結果（假驗收/完成效應訊號）`);
      else if (!substantive(fals, 10)) problems.push(`${rpt.name}「反證嘗試」段敷衍（全為 無/無法/不適用）`);
      else passes.push('反證嘗試實質存在');
      const unv = section(rpt.text, '未驗');
      if (unv === null) problems.push(`${rpt.name} 缺「未驗」段——未覆蓋面向清單`);
      else if (/^(無|none|n\/?a|沒有|暫無)[。.\s]*$/i.test(unv)) problems.push(`${rpt.name}「未驗」寫「無」——總有未覆蓋的面向，寫「無」即不自知（假驗收訊號）`);
      else if (!substantive(unv, 10)) problems.push(`${rpt.name}「未驗」段敷衍`);
      else passes.push('未驗清單實質存在');
      if (existsSync(LOCK_FILE)) {
        const { entries } = readJson(LOCK_FILE);
        let lockOk = true;
        for (const e of entries) {
          if (!existsSync(e.file)) { problems.push(`測試碼被刪除（違反測試鎖定）：${e.file}`); lockOk = false; continue; }
          const now = createHash('sha256').update(readFileSync(e.file)).digest('hex');
          if (now !== e.sha256) { problems.push(`測試碼被變更（違反測試鎖定）：${e.file}`); lockOk = false; }
        }
        if (lockOk) passes.push(`測試鎖定核對：${entries.length} 個測試碼 hash 未變`);
      }
      break;
    }

    case 'commit': {
      if (opts.direct) { passes.push('直接修正路徑（未觸發重流程條件，--direct 留痕）'); break; }
      if (!existsSync(LOCK_FILE)) { problems.push('無 test-lock.json——重流程路徑存檔前必查測試鎖定'); break; }
      const { entries } = readJson(LOCK_FILE);
      for (const e of entries) {
        if (!existsSync(e.file)) { problems.push(`測試碼被刪除：${e.file}`); continue; }
        const now = createHash('sha256').update(readFileSync(e.file)).digest('hex');
        if (now !== e.sha256) problems.push(`測試碼被變更（違反測試鎖定）：${e.file}`);
      }
      if (!problems.length) passes.push(`測試鎖定核對：${entries.length} 個測試碼 hash 未變（存檔即待驗對象，先於驗收）`);
      break;
    }

    case 'converge': {
      checkCleanWorktree(problems, passes, '收斂前');
      const commitIn = st.history.filter((h) => h.to === 'commit').at(-1);
      if (commitIn && commitIn.from === 'build' && st.node !== 'verdict') {
        problems.push('重流程存檔（build→commit）未經驗收（verify）＋判決（verdict）即收斂——commit 存檔先於驗收，MUST 判決通過才收斂');
      }
      break;
    }

    case 'audit': {
      if (st.node === 'ms-done') checkCleanWorktree(problems, passes, '回指 G1 前');
      // 開新 slug／ms 前的需求審計（外部 sb-report）為強制閘門——報告在推進前的節點產出，檔名自帶證據
      const needNode = st.node === 'ms-done' ? 'ms-done' : 'think';
      const needMs = st.node === 'ms-done' ? st.ms : '001';
      const re = new RegExp(`^report-${st.slug}-${needMs}-${needNode}-.*\.md$`, 'i');
      const hasRpt = existsSync(TMP) && readdirSync(TMP).some((x) => re.test(x));
      if (!hasRpt) problems.push(`開新 ${st.node === 'ms-done' ? 'ms' : 'slug'} 前缺少需求審計報告——MUST 先跑 sb report（於 ${needNode} 節點產出 tmp/report-${st.slug}-${needMs}-${needNode}-*.md）供外部審計（SKILL §1.8）`);
      else passes.push(`需求審計報告存在（${needNode} 節點）`);
      if (st.node === 'ms-done') { st.ms = String(Number(st.ms) + 1).padStart(3, '0'); passes.push(`開新 ms：${st.ms}（新里程碑回三面向制衡）`); }
      break;
    }
    case 'ms-done':
    case 'pass':
      break;
  }
  return { problems, passes };
}

// ———— 指令 ————

function cmdInit(slug) {
  if (!slug) usage();
  writeFileSync(STATE_FILE, JSON.stringify({ slug, ms: '001', node: 'think', history: [] }, null, 2));
  fin([`slug「${slug}」狀態檔建立 → ${STATE_FILE}`, '目前節點：think（sb-think 意圖確認）']);
}

function cmdState() {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  out(`slug: ${st.slug}   ms: ${st.ms}   node: ${st.node}（${FLOW[st.node].desc}）`);
  if (st.g1Contract?.ms === st.ms) out(`G1 contract: ${st.g1Contract.sha256}（${st.g1Contract.file}）`);
  for (const n of FLOW[st.node].next) {
    const { problems, passes } = gate({ ...st }, n, {});
    out(`  → ${n}（${FLOW[n].desc}）`);
    for (const p of passes) out(`      ✓ ${p}`);
    for (const p of problems) out(`      ✗ ${p}`);
  }
}

function cmdNext(target, opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  if (!(target in FLOW)) die([`未知節點「${target}」。可用：${Object.keys(FLOW).join(' → ')}`], 2);
  const allowed = FLOW[st.node].next.includes(target) && (target !== 'commit' || st.node !== 'release' || opts.direct);
  if (st.node === 'release' && target === 'commit' && !opts.direct) {
    die([`release→commit 是「預設直接修正」路徑，MUST 帶 --direct 留痕；重流程走 test→build→commit→verify→verdict（commit 存檔先於驗收）`]);
  }
  if (!FLOW[st.node].next.includes(target)) {
    die([`不合法推進：${st.node} → ${target}（單向節點鏈，当前可走：${FLOW[st.node].next.join(' / ')}）`]);
  }
  const { problems, passes } = gate(st, target, opts);
  if (problems.length) die(problems);
  const prev = st.node;
  st.node = target;
  if (target === 'release') {
    const file = gPath(st, 1);
    writeFileSync(CONTRACT_FILE, readFileSync(file));
    st.g1Contract = { ms: st.ms, file, snapshot: CONTRACT_FILE, sha256: sha256(file), lockedAt: new Date().toISOString() };
    passes.push(`G1 契約已封存：${st.g1Contract.sha256.slice(0, 12)}`);
  }
  st.history.push({ from: prev, to: target, at: new Date().toISOString(), bossOk: !!opts.bossOk, direct: !!opts.direct });
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([`${prev} → ${target}`, ...passes]);
}

function cmdAmend(opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  if (!opts.bossOk) die(['G1 修約是老闆拍板點——MUST 帶 --boss-ok（顯性留痕，不可由 agent 自行推進）']);
  const st = readJson(STATE_FILE);
  if (!st.g1Contract || st.g1Contract.ms !== st.ms) die(['目前 ms 尚無已放行的 G1 契約可修約']);
  if (!new Set(['release', 'test', 'build', 'commit', 'verify', 'verdict', 'converge']).has(st.node)) die([`目前節點 ${st.node} 不允許修約`]);
  const amendment = mdOf(join(TMP, 'amendment.md'));
  if (!amendment || !['原條款', '新條款', '影響範圍'].every((x) => amendment.includes(x))) {
    die([`${TMP}/amendment.md 必須先記錄「原條款／新條款／影響範圍」，不得以局部技術結論直接改寫 G1`]);
  }
  const problems = [], passes = [];
  checkCleanWorktree(problems, passes, '回指 G1 前');
  if (problems.length) die(problems);
  const prev = st.node;
  st.history.push({ from: prev, to: 'audit', at: new Date().toISOString(), bossOk: true, amendment: true });
  st.node = 'audit';
  delete st.g1Contract;
  if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([`${prev} → audit（G1 顯式修約）`, ...passes, '修約差異已記錄；原 G1 契約與測試鎖定已解除；G1 定稿後須重新對齊 G2/G3 並重新 release']);
}



function cmdCommitmsg(msg) {
  if (!msg) usage();
  const problems = [];
  const m = msg.match(/^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\([^)]+\))?:\s*(.+)$/);
  if (!m) problems.push('缺 type 前綴——格式 `<type>: <繁中描述>`（type：feat/fix/docs/style/refactor/perf/test/chore/build/ci）');
  else {
    const body = m.at(-1);
    if (body.length < 5) problems.push(`描述過短（${body.length} 字）——單行 10-30 字為準，至少講清楚變更本身`);
    if (body.length > 60) problems.push(`描述過長（${body.length} 字）——單行 10-30 字，MUST NOT 含功能詳細訊息`);
    if (/[a-zA-Z]{3,}-\d+|#\d+/.test(body)) problems.push('含追蹤編號（#123、PROJ-456 等）——commit 訊息純描述變更本身，追蹤靠分支名與 merge 訊息');
    if (/[\n\r]/.test(msg)) problems.push('多行訊息——規範要求單行');
  }
  if (problems.length) die(problems);
  fin([`提交訊息合格：${msg}`]);
}

function cmdReport() {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const outPath = join(TMP, `report-${st.slug}-${st.ms}-${st.node}-${stamp}.md`);
  const g = (n) => mdOf(gPath(st, n)) ?? `（G${n} 尚未建立）`;
  const tmpMd = (re) => {
    if (!existsSync(TMP)) return null;
    const c = readdirSync(TMP).filter((f) => re.test(f)).sort();
    return c.length ? { name: c.at(-1), text: readFileSync(join(TMP, c.at(-1)), 'utf-8') } : null;
  };
  const align = tmpMd(/^alignment-check\.md$/i);
  const amendment = tmpMd(/^amendment\.md$/i);
  const build = tmpMd(/^build-.*\.md$/i);
  const verify = tmpMd(/^verify-.*\.md$/i);
  let lock = '（無鎖定記錄——未走重流程或測試未定稿）';
  if (existsSync(LOCK_FILE)) {
    const { entries, lockedAt } = readJson(LOCK_FILE);
    lock = `鎖定時間 ${lockedAt}，${entries.length} 個測試碼 sha256 基準（存檔 sb next commit 與判決 sb next verdict 時重算核對，任何變更即擋）`;
  }
  const contract = st.g1Contract?.ms === st.ms
    ? `鎖定時間 ${st.g1Contract.lockedAt}，G1 sha256 ${st.g1Contract.sha256}，快照 ${st.g1Contract.snapshot ?? '缺失'}（目前${st.g1Contract.file && existsSync(st.g1Contract.file) && sha256(st.g1Contract.file) === st.g1Contract.sha256 && st.g1Contract.snapshot && existsSync(st.g1Contract.snapshot) && sha256(st.g1Contract.snapshot) === st.g1Contract.sha256 ? '一致' : '已偏離'}；任何變更即擋，須 sb amend --boss-ok）`
    : '（尚未放行，無 G1 契約鎖定）';
  let gitlog = '（非 git 環境）';
  try { gitlog = execSync('git log --oneline -10', { encoding: 'utf-8' }).trim(); } catch {}
  const hist = st.history.map((h) => `- ${h.from} → ${h.to}（${h.at}${h.bossOk ? '，老闆拍板' : ''}${h.direct ? '，直接修正' : ''}${h.amendment ? '，G1 修約' : ''}）`).join('\n') || '（尚無推進記錄）';

  const rpt = `# shiftblame 外部審計報告 — ${st.slug}/${st.ms} @ ${st.node}

> **本報告自包含**：供無法讀取原始碼與專案文件的外部審計 agent 使用。以下內容＝審計所需的全部材料，不需存取任何 repo 檔案。由 \`sb report\` 機械彙整客觀事實；§8 脈絡與審計問題由秘書補充。

## 0. 給外部審計者的說明

你是獨立外部審計者。請基於本報告材料與 §1 判準，審計這個開發流程的當前節點是否成立——重點不是「內容寫得好不好」，而是**流程誠實性**：有沒有假需求、假規劃、假測試、假驗收；有沒有跳過檢查的不自知推進。請給出：成立／不成立＋具體理由＋你發現的矛盾。

## 1. 審計判準（框架規則摘要）

- **節點鏈（單向）**：think→audit→research→plan→release→test→build→commit→verify→verdict→converge→ms-done→(新 ms audit｜pass)；verdict→test 為下一功能回邊，\`sb amend --boss-ok\` 為開發期 G1 顯式修約回 audit 的唯一例外。commit＝存檔（建立待驗對象，先於驗收）。
- **§10 兩兩一致**：G1↔G2、G2↔G3、G1↔G3 三對六向，放行前核對一次並落記錄。
- **四假訊號**：假需求（G1 驗收含模糊謂詞/敷衍）；假規劃（G3 缺失敗模式 premortem/實作步驟）；假測試（無斷言 API 的測試碼，鎖定時被擋）；假驗收（反證嘗試敷衍或全「不適用」、未驗清單寫「無」）。
- **測試鎖定**：測試定稿即 sha256 鎖定，判決前重算，被改過即返工——防「為綠燈逕改測試」。
- **G1 契約鎖定**：放行即 sha256 封存，後續每次推進重算；局部技術模型不得改義，變更只能經 \`sb amend --boss-ok\` 顯式修約。
- **證據分工**：測試階段寫測試（定義「過」）；實作階段寫碼＋實機驗證；實作完成即由秘書 commit 存檔（建立待驗對象）；驗收階段對存檔跑 CI 到綠燈＋反證嘗試；判決（通過/返工）由主對話秘書獨佔——通過才開下一個功能。

## 2. 流程狀態

- **slug**: ${st.slug}　**ms**: ${st.ms}　**當前節點**: ${st.node}
- **推進歷史**：
${hist}

## 3. G1 需求／驗收標準（全文）

**契約鎖定**：${contract}

${g(1)}

## 4. G2 技術分析（全文）

${g(2)}

## 5. G3 實作計畫（全文）

${g(3)}

## 6. 執行層證據

### 6.0 G1 顯式修約差異

${amendment ? amendment.text : '（尚無 G1 修約記錄）'}

### 6.1 §10 一致性核對記錄

${align ? align.text : '（尚無 alignment-check.md——未到放行或未落記錄）'}

### 6.2 測試鎖定

${lock}

### 6.3 實作＋實機驗證記錄（最新）

${build ? build.text : '（尚無 build 記錄）'}

### 6.4 驗收報告（最新，含反證嘗試與未驗清單）

${verify ? verify.text : '（尚無驗收報告）'}

## 7. Git 記錄（最近 10 筆）

\u0060\u0060\u0060
${gitlog}
\u0060\u0060\u0060

## 8. 秘書補充：本次審計問題（老闆／秘書填）

（秘書複核後填：本次想請外部審計回答的具體問題，如「G3 失敗模式是否涵蓋 G2 指出的最大技術風險」「驗收反證嘗試是否足以支撐合格判決」）

---
產生：${new Date().toISOString()}　工具：sb report（shiftblame ${process.env.SB_VERSION ?? ''}）
`;
  writeFileSync(outPath, rpt);
  fin([`外部審計報告已產生 → ${outPath}`, '秘書複核＋填 §8 審計問題後交付老闆（外部 agent 無法讀 repo，本檔即全部材料）']);
}

function cmdLock(files) {
  if (!files.length) usage();
  const problems = [];
  const entries = [];
  for (const f of files) {
    const abs = isAbsolute(f) ? f : resolve(f);
    if (!existsSync(abs)) { problems.push(`測試碼不存在：${f}`); continue; }
    const code = readFileSync(abs, 'utf-8');
    if (!ASSERT_RE.test(code)) problems.push(`${f} 疑似無斷言（找不到任何斷言 API）——假測試訊號，測試碼 MUST 有真實斷言`);
    entries.push({ file: abs, sha256: createHash('sha256').update(code).digest('hex') });
  }
  if (problems.length) die(problems);
  writeFileSync(LOCK_FILE, JSON.stringify({ lockedAt: new Date().toISOString(), entries }, null, 2));
  fin([`鎖定 ${entries.length} 個測試碼（斷言初篩通過）→ ${LOCK_FILE}`]);
}

// ———— main ————

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd) usage();
if (cmd === '--help' || rest.includes('--help')) usage(0);
const flags = { bossOk: false, direct: false };
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--boss-ok') flags.bossOk = true;
  else if (rest[i] === '--direct') flags.direct = true;
  else pos.push(rest[i]);
}
switch (cmd) {
  case 'init': cmdInit(pos[0]); break;
  case 'state': cmdState(); break;
  case 'next': cmdNext(pos[0], flags); break;
  case 'amend': cmdAmend(flags); break;
  case 'lock': cmdLock(pos); break;
  case 'report': cmdReport(); break;
  case 'commitmsg': cmdCommitmsg(pos.join(' ')); break;
  default: usage();
}
