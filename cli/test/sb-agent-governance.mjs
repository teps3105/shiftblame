import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (...parts) => readFileSync(join(repo, ...parts), 'utf8');

const skill = read('skills', 'shiftblame', 'SKILL.md');
const think = read('skills', 'sb-think', 'SKILL.md');
const readme = read('README.md');
const manifest = JSON.parse(read('.codex-plugin', 'plugin.json'));
const cliPackage = JSON.parse(read('cli', 'package.json'));

// 版號一致
assert.equal(manifest.version, '1.5.0');
assert.equal(cliPackage.version, manifest.version);
assert.match(skill, /version: "1\.5\.0"/);

// 八段詞彙落地
assert.match(skill, /intent→audit→research→plan→test→build→verify→done/);
assert.match(skill, /回 intent/);
assert.match(skill, /時點①對抗/);
assert.match(skill, /對話鎖/);
assert.match(skill, /完成印章/);
assert.match(skill, /回頭自由/);
assert.match(skill, /流程代號不進程式碼/);
assert.match(skill, /令行靜止|--adversarial 宣告/);
assert.match(skill, /節錄快照/);
assert.match(skill, /自由傾倒區/);
assert.match(skill, /SB\.md|SLUG\.md/);

// 舊節點詞零殘留（SKILL／README／references／sb.mjs／hooks）
const legacy = ['release→test', 'verdict→', 'converge→', 'ms-done', 'sb lock', 'sb amend', 'sb report', /sb-do(?!cs)/.source, 'sb-start', 'sb-end', 'sb-commit', '--direct', 'direct-change', 'USER_OBSERVABLE', '預設直接修正'];
const files = ['README.md', 'skills/shiftblame/SKILL.md', 'skills/sb-think/SKILL.md', 'cli/bin/sb.mjs', 'hooks/shiftblame-guard.mjs',
  'skills/shiftblame/references/AUDIT.md', 'skills/shiftblame/references/RESEARCH.md', 'skills/shiftblame/references/PLAN.md',
  'skills/shiftblame/references/TEST.md', 'skills/shiftblame/references/BUILD.md', 'skills/shiftblame/references/VERIFY.md'];
for (const f of files) {
  const text = read(...f.split('/'));
  for (const w of legacy) {
    assert.equal(text.includes(w), false, `${f} 殘留舊詞：${w}`);
  }
}

// references 版號
for (const file of ['AUDIT.md', 'RESEARCH.md', 'PLAN.md', 'TEST.md', 'BUILD.md', 'VERIFY.md']) {
  const reference = read('skills', 'shiftblame', 'references', file);
  assert.match(reference, /revision: 1\.5\.0/);
}

// 技能清單：8 個功能型存在；5 個流程型已刪
import { existsSync } from 'node:fs';
for (const k of ['sb-think', 'sb-save', 'sb-resume', 'sb-dice', 'sb-docs', 'sb-sop', 'sb-roadmap', 'sb-todo', 'shiftblame']) {
  assert.ok(existsSync(join(repo, 'skills', k, 'SKILL.md')), `技能 ${k} 應存在`);
}
for (const k of ['sb-start', 'sb-do', 'sb-end', 'sb-commit', 'sb-report']) {
  assert.equal(existsSync(join(repo, 'skills', k, 'SKILL.md')), false, `技能 ${k} 應已刪除`);
}

// sb-think 核心語義
assert.match(think, /全域路由|唯一閘口/);
assert.match(think, /回 intent|回think/);
assert.match(readme, /八段|intent → audit/);
assert.match(readme, /對話鎖/);
assert.match(readme, /老闆詞印章|印章/);
assert.match(manifest.description, /八段/);
