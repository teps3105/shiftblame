// External policies are executable local configuration, explicitly selected by the caller.
import { isAbsolute } from 'node:path';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
let path = process.env.SHIFTBLAME_POLICY;
// A user-installed policy is explicit configuration. Empty env disables it, e.g. in CI.
if (path === undefined) {
  try {
    const config = JSON.parse(readFileSync(join(homedir(), '.agents', 'local', 'shiftblame-policy.json'), 'utf8'));
    if (typeof config.module !== 'string' || !config.module) throw new Error('政策設定缺少 module');
    path = config.module;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
if (path && !isAbsolute(path)) throw new Error('SHIFTBLAME_POLICY 必須是絕對模組路徑');
export const policy = path ? await import(pathToFileURL(path).href) : {};
if (path && policy.apiVersion !== 1) throw new Error('不支援的政策介面版本（需要 apiVersion = 1）');
for (const name of ['commitMessageIssue', 'createCli', 'createHook']) {
  if (policy[name] !== undefined && typeof policy[name] !== 'function') throw new Error(`政策 ${name} 必須為函式`);
}
