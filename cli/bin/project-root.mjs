// 專案根錨定：從起點向上找第一個含 .git 或 .shiftblame 的目錄，找不到時以起點為根。
// 磁碟根（/、C:\）與系統頂層目錄不作錨點：誤留在那裡的 .shiftblame 或 .git 不會把底下所有非專案路徑
// （含暫存目錄）收成同一個專案。家目錄照常可作錨點（dotfiles repo；POSIX 的 /root 位於第一層）。
// sb 與 hook 共用此判定。

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const WIN = process.platform === 'win32';
const fold = WIN || process.platform === 'darwin' ? (s) => s.toLowerCase() : (s) => s;
const SYSTEM_DRIVE = fold(process.env.SystemDrive || 'C:');
const HOME = (() => { try { const h = homedir(); return h ? fold(resolve(h)) : null; } catch { return null; } })();

// 系統頂層目錄：POSIX 的第一層（/usr、/etc、/home…）與 Windows 系統磁碟的第一層（C:\Windows、C:\Users…）。
export function topLevelSystemDir(abs) {
  if (WIN) { const m = abs.match(/^([a-z]:)[\\/]+[^\\/]+[\\/]*$/i); return !!m && fold(m[1]) === SYSTEM_DRIVE; }
  return /^\/[^/]+\/*$/.test(abs);
}
// 可作錨點：家目錄，或既非磁碟根也非系統頂層目錄的目錄。dir 須為絕對路徑。
export const anchorable = (dir) => (HOME !== null && fold(dir) === HOME) || (dirname(dir) !== dir && !topLevelSystemDir(dir));

export function findRoot(start, exists = existsSync) {
  const from = resolve(start);
  for (let dir = from; ;) {
    if (anchorable(dir) && (exists(join(dir, '.git')) || exists(join(dir, '.shiftblame')))) return dir;
    const up = dirname(dir);
    if (up === dir) return from;
    dir = up;
  }
}
