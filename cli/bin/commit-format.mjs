// 提交訊息格式與內容：sb commitmsg 與 hooks 提交閘的單一判準來源（雙層一致）。
// 印章檔存於可寫的 tmp、可被手寫，格式不因此豁免——hook 端以同一函式獨立複驗。
// exit 約定沿用 CLI：此模式只回傳不合格原因（null＝合格），由呼叫端決定 die 或 deny。

export const COMMIT_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'build', 'ci'];
export const COMMIT_MSG_MAX = 120;

// 內容違例（機械可判子集）：提交訊息須自含白話，讀者不必知道任何內部脈絡——
// 內部文件引用、任務代號與流程旗標、對話壓縮術語、流程內部詞彙都不得入訊息；版本號開頭不在此限。
// 未列舉的暗語由規範條文約束（SKILL.md「文件與提交」），列舉項由此閘硬擋；新的暗語樣態出現時增補此清單。
const CONTENT_BANS = [
  // 內部文件引用：工作目錄路徑、訪談代號檔、流程文件名與文件檔名
  [/\.shiftblame/i, '內部工作目錄路徑'],
  [/interview-[\w-]*/i, '訪談代號檔'],
  [/\b(?:SOP|ROADMAP)\b/i, '流程內部文件名'],
  [/\b(?:SKILL|MECHANISMS|GLOSSARY|HANDOFF|AUDIT|STRUCTURE|INTERVIEW)\.md\b/i, '流程文件檔名'],
  // 任務代號與流程旗標
  [/\bG[1-3]\b/, '契約時點代號'],
  [/--(?:boss-ok|new-ms|adversarial|no-git)\b/, '流程旗標'],
  [/\b\w+-[0-9a-f]{8,}\b/i, '帶雜湊的任務代號'],
  [/\bslug\b/i, 'slug 代號稱呼'],
  // 流程內部詞彙
  [/\bsb\b/i, '流程工具簡稱'],
  [/時點/, '流程時點詞'],
  [/印章/, '提交章流程詞'],
  [/狀態卡/, '續接卡簡稱'],
  [/帳本/, '已退役帳本稱呼'],
  // 壓縮術語：箭頭鏈
  [/→|⇒/, '箭頭鏈壓縮'],
];

export function commitMessageIssue(msg) {
  if (typeof msg !== 'string' || !msg.trim() || /[\n\r]/.test(msg)) return '提交訊息須為非空單行——格式「type: 一句話」';
  const m = /^([a-z]+): (\S.*)$/.exec(msg);
  if (!m || !COMMIT_TYPES.includes(m[1])) {
    return `提交訊息須為「type: 一句話」——type 小寫且屬流程詞彙（${COMMIT_TYPES.join('/')}），冒號後恰一格空格接一句話`;
  }
  if (msg.length > COMMIT_MSG_MAX) return `提交訊息超過一句話（${msg.length} > ${COMMIT_MSG_MAX} 字元）——標題保持單句，細節留在對話或文件`;
  for (const [re, label] of CONTENT_BANS) {
    const hit = re.exec(msg);
    if (hit) return `提交訊息含${label}（「${hit[0]}」）——訊息須自含白話：寫出變更的行為內容，內部文件、任務代號與暗語一律改寫成一般描述`;
  }
  return null;
}
