import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname,resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const json=p=>JSON.parse(readFileSync(join(root,p),'utf8'));
const manifest=json('.codex-plugin/plugin.json');
assert.equal(manifest.version,'2.8.0');
for(const p of ['package.json','cli/package.json'])assert.equal(json(p).version,manifest.version);
assert.equal(json('package.json').bin.sb,'cli/bin/sb.mjs');
const hooks=json('hooks/hooks.json').hooks;
assert.deepEqual(Object.keys(hooks).sort(),['PreToolUse','SessionStart','UserPromptSubmit']);
for(const entries of Object.values(hooks))for(const entry of entries)for(const h of entry.hooks){assert.equal(h.type,'command');assert.ok(h.command.includes('shiftblame-guard.mjs'));assert.ok(h.timeout>0);}
function walk(path){return readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(path,e.name)):[join(path,e.name)]);}
for(const p of walk(join(root,'skills')).filter(p=>p.endsWith('.md'))){
 const s=readFileSync(p,'utf8');
 for(const [,url] of s.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
  if(/^(?:https?:|#|<)/.test(url))continue;
  assert.ok(existsSync(resolve(dirname(p),url.split('#')[0])),p+': '+url);
 }
}
console.log('sb-agent-governance: pass');
