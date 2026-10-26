// Default accepts the repository's own commit convention; external policy may narrow it.
import { execFileSync } from 'node:child_process';
import { policy } from './policy.mjs';
export function commitMessageIssue(msg) {
  if (typeof msg !== 'string' || !msg.trim() || /[\n\r]/.test(msg)) return '提交訊息須為非空單行';
  return policy.commitMessageIssue?.(msg) ?? null;
}

// Shared by sb commitmsg and the hook commit gate. Pure deletions stay allowed so tracked internals can be removed;
// Git keeps the typed case on case-insensitive filesystems, so the workspace prefix is matched case-insensitively.
export function stagedFiles(cwd) {
  let staged = [];
  try {
    staged = execFileSync('git', ['-C', cwd, '-c', 'core.quotePath=false', 'diff', '--cached', '--name-only', '--diff-filter=ACMRTUB'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((l) => l.trim()).filter(Boolean);
  } catch { /* Non-Git directories have no index to inspect. */ }
  return { staged, system: staged.filter((p) => /^\.shiftblame(?:\/|$)/i.test(p)) };
}
export const stagedSystemMessage = (hits) =>
  `系統檔不入庫——staged 含 ${hits.slice(0, 5).join('、')}${hits.length > 5 ? ` 等 ${hits.length} 檔` : ''}（先 git restore --staged 移除再提交）`;
