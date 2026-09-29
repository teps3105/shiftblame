// 提交訊息格式：sb commitmsg 與 hooks 提交閘的單一判準來源（雙層一致）。
// 印章檔存於可寫的 tmp、可被手寫，格式不因此豁免——hook 端以同一函式獨立複驗。
// exit 約定沿用 CLI：此模式只回傳不合格原因（null＝合格），由呼叫端決定 die 或 deny。

export const COMMIT_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'build', 'ci'];
export const COMMIT_MSG_MAX = 120;

export function commitMessageIssue(msg) {
  if (typeof msg !== 'string' || !msg.trim() || /[\n\r]/.test(msg)) return '提交訊息須為非空單行——格式「type: 一句話」';
  const m = /^([a-z]+): (\S.*)$/.exec(msg);
  if (!m || !COMMIT_TYPES.includes(m[1])) {
    return `提交訊息須為「type: 一句話」——type 小寫且屬流程詞彙（${COMMIT_TYPES.join('/')}），冒號後恰一格空格接一句話`;
  }
  if (msg.length > COMMIT_MSG_MAX) return `提交訊息超過一句話（${msg.length} > ${COMMIT_MSG_MAX} 字元）——標題保持單句，細節留在對話或文件`;
  return null;
}
