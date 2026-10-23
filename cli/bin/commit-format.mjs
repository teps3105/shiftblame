// Default accepts the repository's own commit convention; external policy may narrow it.
import { policy } from './policy.mjs';
export function commitMessageIssue(msg) {
  if (typeof msg !== 'string' || !msg.trim() || /[\n\r]/.test(msg)) return '提交訊息須為非空單行';
  return policy.commitMessageIssue?.(msg) ?? null;
}
