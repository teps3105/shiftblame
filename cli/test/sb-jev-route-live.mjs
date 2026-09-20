// 手動 live 測試：node cli/test/sb-jev-route-live.mjs --live <輸出檔絕對路徑>。
import { writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestJudgment } from '../../hooks/jev-client.mjs';
import { cases } from './jev-route-cases.mjs';
if (process.argv[2] !== '--live' || !isAbsolute(process.argv[3] ?? '')) throw new Error('需明確 --live 及輸出絕對路徑。');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const selected = process.argv[4] === '--independent' ? (await import('./jev-route-independent.mjs')).cases : cases;
const rows = [];
const started = performance.now();
async function evaluate(item) {
  const began = performance.now();
  const result = await requestJudgment(root, 'route', { model: 'jev-1.13.0', state: item.state, tools: item.tools, candidates: item.candidates });
  const chosen = result?.call ? item.candidates.findIndex(candidate => JSON.stringify({ name: candidate.name, input: candidate.input }) === JSON.stringify(result.call)) : result?.reason;
  return { id: item.id, split: item.split, language: item.language, expected: item.expected, chosen,
    exact: chosen === item.expected,
    operational: chosen === item.expected || (['generate','insufficient'].includes(chosen) && ['generate','insufficient'].includes(item.expected)),
    elapsedMs: Math.round(performance.now() - began), result };
}
rows.push(await evaluate(selected[0]));
for (let index = 1; index < selected.length; index += 6) rows.push(...await Promise.all(selected.slice(index, index + 6).map(evaluate)));
const summary = { datasetType: 'synthetic_controlled', productionEvidence: false, model: 'jev-1.13.0',
  elapsedMs: Math.round(performance.now() - started), cases: rows.length,
  exact: rows.filter(row => row.exact).length, operational: rows.filter(row => row.operational).length,
  falseDirect: rows.filter(row => typeof row.chosen === 'number' && !row.operational).length,
  failures: rows.filter(row => !row.operational).map(row => ({ id: row.id, expected: row.expected, chosen: row.chosen })) };
writeFileSync(process.argv[3], JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary));
