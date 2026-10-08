// flow-state 與 hooks 紀錄的共用寫入：同目錄暫存檔改名，讀取端不會讀到半寫檔；
// 讀改寫以排他鎖串行，並行的寫入者不會互相覆蓋。
import { closeSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { hooksOnly } from './flow-state.mjs';

export function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
  catch { const end = Date.now() + ms; while (Date.now() < end) { /* 無 SharedArrayBuffer 時忙等 */ } }
}

// Windows 上防毒或索引程式短暫占用目標時改名會失敗：重試數次，仍失敗才退回直接寫入。
export function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  try {
    writeFileSync(tmp, text);
    for (let i = 0; ; i++) {
      try { renameSync(tmp, file); return; }
      catch (error) {
        if (i >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error;
        sleepSync(10 * (i + 1));
      }
    }
  } catch {
    try { unlinkSync(tmp); } catch { /* 暫存檔可能未建立 */ }
    writeFileSync(file, text);
  }
}

// Windows 刪除中的鎖檔會回報 EPERM／EACCES／EBUSY，與 EEXIST 同樣視為暫時占用。
const BUSY = new Set(['EEXIST', 'EPERM', 'EACCES', 'EBUSY']);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
function readLock(lock) {
  try {
    const text = readFileSync(lock, 'utf8');
    let info = null;
    try { info = JSON.parse(text); } catch { /* 內容寫入中或損毀 */ }
    return { text, info };
  } catch (error) { return error.code === 'ENOENT' ? null : { text: null, info: null }; }
}
// 殘鎖：持有的程序已結束，或持有超過 staleMs。刪除前再讀一次，確認仍是同一把鎖。
function clearStale(lock, staleMs) {
  const cur = readLock(lock);
  if (!cur) return true;
  if (cur.text === null) return false;
  if (cur.info && Number.isInteger(cur.info.pid) && Number.isFinite(cur.info.at)) {
    if (alive(cur.info.pid) && Date.now() - cur.info.at < staleMs) return false;
  } else {
    let age;
    try { age = Date.now() - statSync(lock).mtimeMs; } catch { return true; }
    if (age < Math.min(staleMs, 2000)) return false; // 剛建立、內容尚未寫入
  }
  const again = readLock(lock);
  if (!again) return true;
  if (again.text !== cur.text) return false;
  try { unlinkSync(lock); } catch (error) { return error.code === 'ENOENT'; }
  return true;
}
function releaseLock(lock, token) {
  try { if (JSON.parse(readFileSync(lock, 'utf8')).token === token) unlinkSync(lock); } catch { /* 已釋放或已被判為殘鎖 */ }
}
// 取得 `${file}.lock`：成功回傳只釋放自己這把鎖的函式，逾時回傳 null。不可重入。
export function acquireLock(file, { waitMs = 5000, staleMs = 60000 } = {}) {
  const lock = `${file}.lock`;
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const deadline = Date.now() + waitMs;
  for (let delay = 5; ; delay = Math.min(delay * 2, 100)) {
    let code;
    try {
      const fd = openSync(lock, 'wx');
      try { writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now(), token })); } finally { closeSync(fd); }
      return () => releaseLock(lock, token);
    } catch (error) {
      if (!BUSY.has(error.code)) throw error;
      code = error.code;
    }
    if (code === 'EEXIST' && clearStale(lock, staleMs)) continue;
    if (Date.now() >= deadline) return null;
    sleepSync(delay);
  }
}

// hooks 的心跳與工具呼叫計數另存 tmp，與 sb 寫入的 flow-state 分開。
export const hookRecordsPath = (root) => join(root, '.shiftblame', 'tmp', 'hook-records.json');
export function readHookRecords(root) {
  try {
    const st = JSON.parse(readFileSync(hookRecordsPath(root), 'utf8'));
    delete st.compactNudge; // 已移除的壓縮帳本提醒狀態——舊檔讀取即剝，寫回時不再帶出。
    return hooksOnly(st) ? st : {};
  } catch { return {}; }
}
