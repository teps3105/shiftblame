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

assert.equal(manifest.version, '1.0.2');
assert.equal(cliPackage.version, manifest.version);
assert.match(skill, /version: "1\.0\.2"/);

const reviewSection = skill.match(/### 臨時外部子代理唯讀檢閱([\s\S]*?)### 時序調控與一致性核對/)?.[1];
assert.ok(reviewSection, '缺少外部子代理唯讀檢閱權威段落');

const rows = reviewSection.split(/\r?\n/).filter((line) => line.startsWith('|'));
const sufficient = rows.find((line) => line.includes('證據足以可靠裁定'));
const uncertain = rows.find((line) => line.includes('證據不足或矛盾'));
const semantic = rows.find((line) => line.includes('選項改變產品語義'));

assert.match(sufficient ?? '', /直接裁定並繼續 \| 否 \|/);
assert.match(uncertain ?? '', /\*\*MUST\*\* 立即取得一次外部子代理唯讀技術檢閱/);
assert.match(uncertain ?? '', /不必先反覆失敗 \| 否 \|/);
assert.match(semantic ?? '', /先翻譯成使用者可理解的後果 \| 是，經 sb-think \|/);
assert.match(reviewSection, /純技術不可可靠裁定本身就是強制理由，不得把它誤分類為老闆決策/);
assert.match(reviewSection, /不得改問老闆純技術題/);

assert.match(think, /MUST 立即取得一次外部子代理的自包含唯讀技術意見/);
assert.match(think, /不得把純技術選擇轉嫁給老闆/);
assert.match(think, /符合 G1 的架構改選仍是 agents 的技術裁定/);
assert.match(think, /不得要求老闆代答技術題/);

assert.match(readme, /純技術裁定不外包給老闆/);
assert.match(readme, /只有產品語義、G1 成功集合、範圍、成本／風險容忍或新授權才交由老闆決定/);
assert.match(manifest.description, /外部子代理唯讀意見/);
assert.match(manifest.description, /不得轉嫁給老闆/);

for (const file of ['AUDIT.md', 'RESEARCH.md', 'PLAN.md', 'TEST.md', 'BUILD.md', 'VERIFY.md']) {
  const reference = read('skills', 'shiftblame', 'references', file);
  assert.match(reference, /revision: 1\.0\.2/);
  assert.match(reference, /外部子代理/);
  assert.match(reference, /主對話/);
  assert.match(reference, /老闆/);
}

for (const legacy of [
  '只有此時確實需要不同視角，才臨時取得一次唯讀檢閱意見',
  '主對話在同一瓶頸反覆失敗，或老闆明確指定',
  'G1／G2 組合無法排成可行實作計畫屬重大例外',
]) {
  assert.equal(skill.includes(legacy), false, `仍殘留會延遲技術外援的舊規則：${legacy}`);
}
