// 產品訪談紀錄：每個平台對話（session_id）一份 <repo>/.shiftblame/tmp/interview-<代號>.md。
// 「## 第 N 輪」標題段是一輪；必填欄位都有內容才算完成。開場標記記下開場時已完成的輪數，
// 恢復舊對話時要追加新的一輪才算重新對齊；壓縮續接沿用原紀錄。
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeAtomic } from './state-io.mjs';

export const INTERVIEW_FIELDS = ['觸發', '目標', '範圍', '驗收', '使用者確認'];
const PLACEHOLDER = /^(?:<[^<>]*>|[（(]\s*(?:填|待填)\s*[）)]|待填|todo|tbd)$/i;
const filled = (v) => typeof v === 'string' && v.trim().length > 0 && !PLACEHOLDER.test(v.trim());

export const interviewToken = (sessionId) => createHash('sha256').update(String(sessionId), 'utf8').digest('hex').slice(0, 12);
export const interviewPath = (root, token) => join(root, '.shiftblame', 'tmp', `interview-${token}.md`);
const markerPath = (root, token) => join(root, '.shiftblame', 'tmp', `interview-${token}.json`);
const readText = (path) => { try { return readFileSync(path, 'utf8'); } catch { return null; } };

export function parseInterview(text) {
  const rounds = [];
  let round = null, field = null;
  for (const line of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const head = line.match(/^##\s+第\s*(\d+)\s*輪/);
    if (head) { round = { n: Number(head[1]), fields: {} }; rounds.push(round); field = null; continue; }
    if (/^#{1,2}\s/.test(line)) { round = null; field = null; continue; }
    if (!round) continue;
    const m = line.match(/^[-*]\s*([^：:\s][^：:]*?)\s*[：:]\s*(.*)$/);
    if (m) { field = m[1].trim(); round.fields[field] = m[2].trim(); continue; }
    // 欄位內容可寫在下方的縮排子項。
    if (field && /^\s+\S/.test(line)) round.fields[field] = `${round.fields[field]} ${line.trim()}`.trim();
    else if (line.trim()) field = null;
  }
  for (const r of rounds) r.missing = INTERVIEW_FIELDS.filter((k) => !filled(r.fields[k]));
  return { rounds, complete: rounds.filter((r) => !r.missing.length).length };
}

function readMarker(root, token) {
  try {
    const m = JSON.parse(readFileSync(markerPath(root, token), 'utf8'));
    return Number.isInteger(m?.base) && m.base >= 0 ? m : null;
  } catch { return null; }
}
// 開場：resume／clear 以目前完成輪數為基準，要求新的一輪；compact 沿用。
// 同一對話再次 startup（例如子代理共用 session_id）不重設既有標記。
export function markSessionStart(root, sessionId, source) {
  if (source === 'compact') return;
  const token = interviewToken(sessionId);
  if (!['resume', 'clear'].includes(source) && readMarker(root, token)) return;
  const { complete } = parseInterview(readText(interviewPath(root, token)));
  writeAtomic(markerPath(root, token), JSON.stringify({ base: complete, at: new Date().toISOString(), source: source ?? null }, null, 2));
}
export function interviewStatus(root, sessionId) {
  const token = interviewToken(sessionId);
  const path = interviewPath(root, token);
  const text = readText(path);
  const parsed = parseInterview(text);
  const base = readMarker(root, token)?.base ?? 0;
  return { token, path, exists: text !== null, ...parsed, base, open: parsed.complete > base };
}
