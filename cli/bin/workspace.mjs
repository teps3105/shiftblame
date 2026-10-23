// Framework-owned local documents. Never replace tracked upstream files or edit .gitignore.
import { existsSync, lstatSync, mkdirSync, readFileSync, linkSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLock, writeAtomic } from './state-io.mjs';

export const EXCLUDES = ['/.shiftblame/', '/AGENTS.md', '/ROADMAP.md'];
const git = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const optionalGit = (root, args) => { try { return git(root, args); } catch { return ''; } };
const tracked = (root, path) => !!git(root, ['ls-files', '--', path]);
const present = path => { try { lstatSync(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
function safe(root, path) {
  const rel = relative(root, path);
  if (isAbsolute(rel) || rel.startsWith('..')) throw Error(`工作區路徑越界：${path}`);
  let at = root;
  for (const part of rel.split(/[\\/]/).filter(Boolean)) {
    at = join(at, part);
    if (present(at) && lstatSync(at).isSymbolicLink()) throw Error(`工作區不穿越符號連結：${at}`);
  }
}

export function inspectWorkspace(cwd) {
  const root = git(cwd, ['rev-parse', '--show-toplevel']);
  const refs = new Set();
  if (optionalGit(root, ['rev-parse', '--verify', 'HEAD'])) refs.add('HEAD');
  const upstream = optionalGit(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  if (upstream) refs.add(upstream);
  const remoteRefs = optionalGit(root, ['for-each-ref', '--format=%(refname)', 'refs/remotes/']).split('\n').filter(Boolean);
  for (const ref of remoteRefs) refs.add(ref);
  const upstreamTracked = [...refs].some(ref => git(root, ['ls-tree', '--name-only', ref, '--', 'AGENTS.md', 'ROADMAP.md']).length > 0);
  const authors = new Set((refs.size ? git(root, ['log', '--all', '--format=%aE']) : '').split('\n').map(s => s.trim().toLowerCase()).filter(Boolean));
  const collaborative = upstreamTracked || authors.size > 1;
  const directory = collaborative ? '.shiftblame' : '';
  const exclude = git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'info/exclude']);
  return { root, collaborative, upstreamTracked, authorCount: authors.size, directory, agents: join(root, directory, 'AGENTS.md'), roadmap: join(root, directory, 'ROADMAP.md'), exclude };
}

function excludeFindings(info) {
  const text = existsSync(info.exclude) ? readFileSync(info.exclude, 'utf8') : '';
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.indexOf('# shiftblame local workspace');
  const end = lines.indexOf('# end shiftblame local workspace', start + 1);
  // Owned rules are last so earlier unignore patterns cannot cancel framework exclusions.
  return { text, valid: start >= 0 && end === lines.length - 2 && EXCLUDES.every(rule => lines.slice(start + 1, end).includes(rule)) };
}

function writeExcludes(info) {
  mkdirSync(dirname(info.exclude), { recursive: true });
  const release = acquireLock(info.exclude);
  if (!release) throw Error(`無法取得本機忽略檔鎖：${info.exclude}`);
  try {
    const { text, valid } = excludeFindings(info);
    if (valid) return;
    const begin = '# shiftblame local workspace', end = '# end shiftblame local workspace';
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const kept = [];
    let owned = false;
    for (const line of lines) {
      if (line === begin) { owned = true; continue; }
      if (owned && line === end) { owned = false; continue; }
      if (!owned) kept.push(line);
    }
    if (owned) throw Error(`本機忽略檔的管理區塊未閉合：${info.exclude}`);
    while (kept.at(-1) === '') kept.pop();
    writeAtomic(info.exclude, [...kept, '', begin, ...EXCLUDES, end, ''].join('\n'));
  } finally { release(); }
}

// Hooks may need scratch storage before local documents exist. No layout migration is implicit.
export function ensureWorkspaceStorage(root) {
  if (optionalGit(root, ['rev-parse', '--show-toplevel'])) {
    const exclude = git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'info/exclude']);
    writeExcludes({ exclude });
  }
  safe(root, join(root, '.shiftblame', 'tmp'));
  mkdirSync(join(root, '.shiftblame', 'tmp'), { recursive: true });
}

function migrationPlan(info) {
  const moves = [], conflicts = [], protectedFiles = [];
  for (const [target, candidates] of [
    [info.agents, ['SOP.md', '.shiftblame/SOP.md', 'AGENTS.md', '.shiftblame/AGENTS.md']],
    [info.roadmap, ['ROADMAP.md', '.shiftblame/ROADMAP.md']],
  ]) {
    safe(info.root, target);
    const sources = candidates.map(p => join(info.root, p)).filter(p => p !== target && present(p));
    let selected = present(target) ? readFileSync(target) : null;
    for (const source of sources) {
      safe(info.root, source);
      const rel = relative(info.root, source).replace(/\\/g, '/');
      if (tracked(info.root, rel)) { protectedFiles.push(rel); continue; }
      const content = readFileSync(source);
      if (selected && !selected.equals(content)) { conflicts.push({ source, target, reason: '既有內容不同，不覆寫或自動合併' }); continue; }
      if (tracked(info.root, relative(info.root, target).replace(/\\/g, '/'))) { conflicts.push({ source, target, reason: '目標已被追蹤' }); continue; }
      moves.push({ source, target });
      selected ??= content;
    }
  }
  return { moves, conflicts, protectedFiles };
}

function normalizedDocument(text, info, moved = false) {
  if (!moved && !/(?:\bSOP\.md\b|^#{1,6}\s+SOP\b|^role:\s*sop\s*$)/m.test(text)) return text;
  const agents = info.directory ? '.shiftblame/AGENTS.md' : 'AGENTS.md';
  const roadmap = info.directory ? '.shiftblame/ROADMAP.md' : 'ROADMAP.md';
  return text.replace(/\.shiftblame[\\/](?:SOP|AGENTS|ROADMAP)\.md|\bSOP\.md\b/g,
    match => /ROADMAP\.md$/.test(match) ? roadmap : agents)
    .replace(/^(#{1,6}\s+)SOP\b/gm, '$1AGENTS')
    .replace(/^(title:\s*)SOP\s*$/gm, '$1AGENTS')
    .replace(/^(role:\s*)sop\s*$/gm, '$1agents');
}

function documentUpdates(info, apply, moved = new Set()) {
  const updates = [];
  for (const path of [info.agents, info.roadmap]) {
    if (!present(path) || tracked(info.root, relative(info.root, path).replace(/\\/g, '/'))) continue;
    safe(info.root, path);
    const original = readFileSync(path, 'utf8');
    const updated = normalizedDocument(original, info, moved.has(path));
    if (updated !== original) {
      updates.push(path);
      if (apply) writeAtomic(path, updated);
    }
  }
  return updates;
}

function cleanGitignore(info) {
  const path = join(info.root, '.gitignore');
  const removed = [], retained = [];
  if (!present(path)) return { removed, retained };
  safe(info.root, path);
  const original = readFileSync(path, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  const kept = [];
  for (const line of lines) {
    const rule = line.trim();
    const match = /^!?\/?(\.shiftblame)(?:\/.*)?$|^!?\/?(AGENTS\.md|ROADMAP\.md|SOP\.md)$/.exec(rule);
    if (!match) { kept.push(line); continue; }
    const name = match[1] ?? match[2];
    // Upstream-owned paths are not local workspace contamination.
    if (optionalGit(info.root, ['ls-tree', '--name-only', 'HEAD', '--', name])) { retained.push(line); kept.push(line); continue; }
    removed.push(line);
    if (/^#.*shiftblame.*(?:工作區|workspace|暫存)/i.test(kept.at(-1) ?? '')) kept.pop();
  }
  if (removed.length) writeAtomic(path, kept.join(eol));
  return { removed, retained };
}

export function runWorkspace(action, cwd = process.cwd()) {
  if (!['migrate', 'init', 'check', 'clean'].includes(action)) throw Error('用法：sb workspace <migrate|init|check|clean>');
  const info = inspectWorkspace(cwd);
  safe(info.root, join(info.root, '.shiftblame'));
  const plan = migrationPlan(info);
  if (action === 'check') {
    const ignored = EXCLUDES.every(path => optionalGit(info.root, ['check-ignore', '--no-index', path.slice(1)]) !== '');
    const updates = documentUpdates(info, false);
    return { ...info, ...plan, updates, ok: excludeFindings(info).valid && ignored && !plan.moves.length && !plan.conflicts.length && !updates.length };
  }
  // Plan the entire migration before moving any content.
  if (plan.conflicts.length) return { ...info, ...plan, ok: false };
  writeExcludes(info);
  for (const { source, target } of plan.moves) {
    mkdirSync(dirname(target), { recursive: true });
    if (present(target)) {
      if (!readFileSync(target).equals(readFileSync(source))) throw Error(`遷移期間目標改變：${target}`);
      unlinkSync(source);
    } else { linkSync(source, target); unlinkSync(source); }
  }
  const oldIgnore = join(info.root, '.shiftblame', '.gitignore');
  if (present(oldIgnore)) {
    safe(info.root, oldIgnore);
    if (!tracked(info.root, '.shiftblame/.gitignore') && readFileSync(oldIgnore, 'utf8').trim() === '*') unlinkSync(oldIgnore);
  }
  const updates = documentUpdates(info, true, new Set(plan.moves.map(move => move.target)));
  if (action === 'init') {
    for (const [target, name] of [[info.agents, 'AGENTS.md'], [info.roadmap, 'ROADMAP.md']]) {
      safe(info.root, target);
      mkdirSync(dirname(target), { recursive: true });
      if (!present(target)) writeFileSync(target, readFileSync(fileURLToPath(new URL(`../../skills/shiftblame/assets/${name}`, import.meta.url))), { flag: 'wx' });
    }
  }
  const gitignoreCleanup = action === 'clean' ? cleanGitignore(info) : { removed: [], retained: [] };
  return { ...info, ...plan, updates, gitignoreCleanup, ok: true };
}
