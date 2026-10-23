#!/usr/bin/env node
// Host hooks block only on exit 2; keep policy imports and initialization inside that boundary.
try {
  await import('./guard-runtime.mjs');
} catch (error) {
  process.stderr.write(`[shiftblame] 無法載入工作政策：${error.message}\n`);
  process.exit(2);
}
