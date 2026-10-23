// Exercise workspace behavior through the public CLI, using isolated real Git repositories.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const sandbox = mkdtempSync(join(tmpdir(), 'sb-workspace-'));
const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const env = { ...process.env, SHIFTBLAME_POLICY: '', GIT_CONFIG_NOSYSTEM: '1' };
for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL']) delete env[key];
const git = (cwd, ...args) => {
  const result = spawnSync('git', ['-c', 'core.hooksPath=', '-C', cwd, ...args], { encoding: 'utf8', env });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};
const put = (root, path, content) => { const target = join(root, path); mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, content); };
const read = (root, path) => readFileSync(join(root, path), 'utf8');
const repo = name => {
  const root = join(sandbox, name);
  mkdirSync(root);
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'First Author');
  git(root, 'config', 'user.email', 'first@example.test');
  git(root, 'config', 'commit.gpgsign', 'false');
  put(root, 'README.md', '# Project\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-qm', 'Initial project');
  return root;
};
const workspace = (root, action, success = true) => {
  const result = spawnSync(process.execPath, [cli, 'workspace', action], { cwd: root, env, encoding: 'utf8' });
  assert.equal(result.status, success ? 0 : 1, `${action}: ${result.stdout}\n${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
};
const ignored = root => {
  for (const path of ['AGENTS.md', 'ROADMAP.md', '.shiftblame/tmp/example']) {
    assert.equal(git(root, 'check-ignore', '--no-index', '--', path), path);
  }
};
let failed = 0;
const scenario = (name, fn) => {
  try { fn(); console.log(`  pass: ${name}`); }
  catch (error) { failed++; console.error(`  FAIL: ${name}\n${error.stack}`); }
};
try {
  scenario('single-author migration renames SOP and keeps local documents at root', () => {
    const root = repo('solo');
    put(root, '.shiftblame/SOP.md', '# Local instructions\n');
    put(root, '.shiftblame/ROADMAP.md', '# Local roadmap\n');
    put(root, '.shiftblame/.gitignore', '*\n');
    put(root, '.gitignore', 'build/\n');
    const exclude = git(root, 'rev-parse', '--path-format=absolute', '--git-path', 'info/exclude');
    writeFileSync(exclude, '# user rules\nprivate.txt\n!AGENTS.md\n!ROADMAP.md\n!.shiftblame/\n');
    const result = workspace(root, 'migrate');
    assert.equal(result.collaborative, false);
    assert.equal(read(root, 'AGENTS.md'), '# Local instructions\n');
    assert.equal(read(root, 'ROADMAP.md'), '# Local roadmap\n');
    assert.equal(existsSync(join(root, '.shiftblame/SOP.md')), false);
    assert.equal(existsSync(join(root, '.shiftblame/ROADMAP.md')), false);
    assert.equal(read(root, '.gitignore'), 'build/\n');
    assert.ok(readFileSync(exclude, 'utf8').startsWith('# user rules\nprivate.txt\n!AGENTS.md\n!ROADMAP.md\n!.shiftblame/\n'));
    ignored(root);
    const first = readFileSync(exclude, 'utf8');
    assert.equal(workspace(root, 'migrate').moves.length, 0);
    assert.equal(readFileSync(exclude, 'utf8'), first);
    assert.equal(workspace(root, 'check').ok, true);
    assert.equal(git(root, 'status', '--porcelain', '--untracked-files=all'), '?? .gitignore');
  });

  scenario('root SOP is also migrated', () => {
    const root = repo('root-sop');
    put(root, 'SOP.md', 'Local root SOP');
    workspace(root, 'migrate');
    assert.equal(read(root, 'AGENTS.md'), 'Local root SOP');
    assert.equal(existsSync(join(root, 'SOP.md')), false);
  });

  for (const trackedName of ['AGENTS.md', 'ROADMAP.md']) scenario(`HEAD-tracked ${trackedName} selects hidden documents and preserves upstream`, () => {
    const root = repo(`tracked-${trackedName}`);
    put(root, trackedName, 'Upstream content\n');
    git(root, 'add', trackedName);
    git(root, 'commit', '-qm', 'Add upstream instructions');
    put(root, '.shiftblame/SOP.md', 'Local instructions\n');
    if (trackedName !== 'ROADMAP.md') put(root, 'ROADMAP.md', 'Local roadmap\n');
    const result = workspace(root, 'init');
    assert.equal(result.collaborative, true);
    assert.equal(read(root, trackedName), 'Upstream content\n');
    assert.equal(read(root, '.shiftblame/AGENTS.md'), 'Local instructions\n');
    assert.ok(existsSync(join(root, '.shiftblame/ROADMAP.md')));
    assert.equal(git(root, 'diff', '--name-only'), '');
    ignored(root);
    workspace(root, 'check');
  });

  scenario('remote-tracked document selects hidden directory even when absent from HEAD', () => {
    const root = repo('remote-tracked');
    put(root, 'AGENTS.md', 'Remote instructions');
    git(root, 'add', 'AGENTS.md');
    git(root, 'commit', '-qm', 'Remote documentation');
    git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    git(root, 'rm', 'AGENTS.md');
    git(root, 'commit', '-qm', 'Local branch without document');
    put(root, 'SOP.md', 'Local instructions');
    assert.equal(workspace(root, 'migrate').collaborative, true);
    assert.equal(read(root, '.shiftblame/AGENTS.md'), 'Local instructions');
    assert.equal(existsSync(join(root, 'AGENTS.md')), false);
  });

  scenario('multiple authors select hidden directory and relocate local root documents', () => {
    const root = repo('multiple-authors');
    git(root, '-c', 'user.name=Second Author', '-c', 'user.email=second@example.test', 'commit', '--allow-empty', '-qm', 'Second contribution');
    put(root, 'AGENTS.md', 'Local agents');
    put(root, 'ROADMAP.md', 'Local roadmap');
    const result = workspace(root, 'migrate');
    assert.equal(result.authorCount, 2);
    assert.equal(result.collaborative, true);
    assert.equal(read(root, '.shiftblame/AGENTS.md'), 'Local agents');
    assert.equal(read(root, '.shiftblame/ROADMAP.md'), 'Local roadmap');
    assert.equal(existsSync(join(root, 'AGENTS.md')), false);
    workspace(root, 'check');
  });

  scenario('different target content blocks the entire batch without overwriting', () => {
    const root = repo('conflict');
    put(root, 'AGENTS.md', 'Existing target');
    put(root, '.shiftblame/SOP.md', 'Different source');
    put(root, '.shiftblame/ROADMAP.md', 'Roadmap must not move');
    const exclude = git(root, 'rev-parse', '--path-format=absolute', '--git-path', 'info/exclude');
    const before = readFileSync(exclude, 'utf8');
    assert.ok(workspace(root, 'migrate', false).conflicts.length);
    assert.equal(read(root, 'AGENTS.md'), 'Existing target');
    assert.equal(read(root, '.shiftblame/SOP.md'), 'Different source');
    assert.equal(read(root, '.shiftblame/ROADMAP.md'), 'Roadmap must not move');
    assert.equal(existsSync(join(root, 'ROADMAP.md')), false);
    assert.equal(readFileSync(exclude, 'utf8'), before);
    workspace(root, 'check', false);
  });

  scenario('identical duplicates consolidate and repeated migration is idempotent', () => {
    const root = repo('duplicates');
    for (const path of ['AGENTS.md', 'SOP.md', '.shiftblame/SOP.md', '.shiftblame/AGENTS.md']) put(root, path, 'Same local instructions');
    workspace(root, 'migrate');
    assert.equal(read(root, 'AGENTS.md'), 'Same local instructions');
    for (const path of ['SOP.md', '.shiftblame/SOP.md', '.shiftblame/AGENTS.md']) assert.equal(existsSync(join(root, path)), false);
    assert.equal(workspace(root, 'migrate').moves.length, 0);
  });

  scenario('init uses AGENTS template and preserves existing user content', () => {
    const root = repo('init');
    workspace(root, 'init');
    const assets = fileURLToPath(new URL('../../skills/shiftblame/assets/', import.meta.url));
    assert.equal(read(root, 'AGENTS.md'), read(assets, 'AGENTS.md'));
    assert.equal(read(root, 'ROADMAP.md'), read(assets, 'ROADMAP.md'));
    workspace(root, 'check');
    workspace(root, 'init');
    assert.equal(read(root, 'AGENTS.md'), read(assets, 'AGENTS.md'), 'repeated init preserves the new template verbatim');
    assert.equal(read(root, 'ROADMAP.md'), read(assets, 'ROADMAP.md'));
    put(root, 'AGENTS.md', 'Customized instructions');
    workspace(root, 'init');
    assert.equal(read(root, 'AGENTS.md'), 'Customized instructions');
    workspace(root, 'check');
  });

  scenario('linked worktree resolves Git exclude through git-path', () => {
    const root = repo('worktree-main');
    const linked = join(sandbox, 'linked');
    git(root, 'worktree', 'add', '-qb', 'linked', linked);
    const exclude = git(linked, 'rev-parse', '--path-format=absolute', '--git-path', 'info/exclude');
    put(linked, 'SOP.md', 'Linked instructions');
    const result = workspace(linked, 'migrate');
    assert.equal(resolve(result.exclude), resolve(exclude));
    assert.equal(read(linked, 'AGENTS.md'), 'Linked instructions');
    assert.ok(readFileSync(exclude, 'utf8').includes('/.shiftblame/'));
    ignored(linked);
    workspace(linked, 'check');
  });

  scenario('check reports missing local excludes without creating them', () => {
    const root = repo('check-only');
    const exclude = git(root, 'rev-parse', '--path-format=absolute', '--git-path', 'info/exclude');
    const before = readFileSync(exclude, 'utf8');
    workspace(root, 'check', false);
    assert.equal(readFileSync(exclude, 'utf8'), before);
    assert.equal(existsSync(join(root, '.shiftblame')), false);
  });

  for (const [label, eol] of [['LF', '\n'], ['CRLF', '\r\n']]) scenario(`clean removes only local workspace ignore rules and preserves ${label}`, () => {
    const root = repo(`clean-${label}`);
    const preserved = ['# Existing project rules', 'build/', '*.log', '!important.log', 'docs/AGENTS.md', 'SOP.md.backup', 'my.shiftblame/', ''];
    const localRules = ['.shiftblame/', '/.shiftblame/**', 'AGENTS.md', '/ROADMAP.md', 'SOP.md', '!AGENTS.md', '!/.shiftblame/', '!/ROADMAP.md'];
    const original = [...preserved.slice(0, 3), ...localRules, ...preserved.slice(3)].join(eol);
    put(root, '.gitignore', original);
    put(root, '.shiftblame/SOP.md', 'Local instructions');
    // Migration changes local document placement but leaves the shared ignore file alone.
    workspace(root, 'migrate');
    assert.equal(read(root, '.gitignore'), original);
    const result = workspace(root, 'clean');
    assert.deepEqual(result.gitignoreCleanup.removed, localRules);
    assert.equal(read(root, '.gitignore'), preserved.join(eol));
    ignored(root);
    workspace(root, 'check');
    const exclude = readFileSync(result.exclude, 'utf8');
    assert.deepEqual(workspace(root, 'clean').gitignoreCleanup.removed, []);
    assert.equal(read(root, '.gitignore'), preserved.join(eol));
    assert.equal(readFileSync(result.exclude, 'utf8'), exclude);
  });

  scenario('clean retains upstream-owned AGENTS ignore rules and tracked content', () => {
    const root = repo('clean-upstream');
    put(root, 'AGENTS.md', '# Upstream instructions\n');
    git(root, 'add', 'AGENTS.md');
    git(root, 'commit', '-qm', 'Add upstream instructions');
    put(root, '.gitignore', '# Upstream policy\nAGENTS.md\n/AGENTS.md\n!AGENTS.md\n/.shiftblame/\n/ROADMAP.md\nbuild/\n');
    const result = workspace(root, 'clean');
    assert.equal(read(root, '.gitignore'), '# Upstream policy\nAGENTS.md\n/AGENTS.md\n!AGENTS.md\nbuild/\n');
    assert.deepEqual(result.gitignoreCleanup.retained, ['AGENTS.md', '/AGENTS.md', '!AGENTS.md']);
    assert.equal(read(root, 'AGENTS.md'), '# Upstream instructions\n');
    // A retained upstream negation can override local excludes; check must expose that.
    workspace(root, 'check', false);
  });

  scenario('general upstream negation is retained and ineffective excludes fail check', () => {
    const root = repo('clean-general-negation');
    put(root, '.gitignore', '# Shared broad policy\n!*\n/.shiftblame/\n/AGENTS.md\n/ROADMAP.md\n');
    workspace(root, 'clean');
    assert.equal(read(root, '.gitignore'), '# Shared broad policy\n!*\n');
    assert.equal(workspace(root, 'check', false).ok, false);
  });

  for (const collaborative of [false, true]) scenario(`SOP metadata and old paths migrate to ${collaborative ? 'hidden' : 'root'} local documents`, () => {
    const root = repo(`document-paths-${collaborative}`);
    if (collaborative) git(root, '-c', 'user.name=Second Author', '-c', 'user.email=second@example.test', 'commit', '--allow-empty', '-qm', 'Second contribution');
    put(root, '.shiftblame/SOP.md', [
      '---', 'title: SOP', 'role: sop', '---', '# SOP', '',
      'Instructions: `.shiftblame/SOP.md` and `SOP.md`.',
      'Roadmap: `.shiftblame/ROADMAP.md`.',
      'Windows paths: `.shiftblame\\SOP.md` and `.shiftblame\\ROADMAP.md`.',
      '',
    ].join('\n'));
    put(root, '.shiftblame/ROADMAP.md', '# Roadmap\n\nSee `.shiftblame/SOP.md`.\n');
    workspace(root, 'migrate');
    const prefix = collaborative ? '.shiftblame/' : '';
    assert.equal(read(root, `${prefix}AGENTS.md`), [
      '---', 'title: AGENTS', 'role: agents', '---', '# AGENTS', '',
      `Instructions: \`${prefix}AGENTS.md\` and \`${prefix}AGENTS.md\`.`,
      `Roadmap: \`${prefix}ROADMAP.md\`.`,
      `Windows paths: \`${prefix}AGENTS.md\` and \`${prefix}ROADMAP.md\`.`,
      '',
    ].join('\n'));
    assert.equal(read(root, `${prefix}ROADMAP.md`), `# Roadmap\n\nSee \`${prefix}AGENTS.md\`.\n`);
    workspace(root, 'check');
    assert.deepEqual(workspace(root, 'migrate').updates, []);
  });

  scenario('symlinked workspace cannot write outside the repository when supported', () => {
    const root = repo('symlink');
    const outside = join(sandbox, 'outside');
    mkdirSync(outside);
    put(outside, 'SOP.md', 'External content');
    try { symlinkSync(outside, join(root, '.shiftblame'), process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) {
      if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) { console.log(`    skip symlink: ${error.code}`); return; }
      throw error;
    }
    workspace(root, 'init', false);
    assert.equal(read(outside, 'SOP.md'), 'External content');
    assert.equal(existsSync(join(outside, 'AGENTS.md')), false);
    assert.equal(existsSync(join(outside, 'ROADMAP.md')), false);
    assert.equal(existsSync(join(root, 'AGENTS.md')), false);
  });
} finally {
  // Every fixture is created below this resolved temporary directory.
  rmSync(sandbox, { recursive: true, force: true });
}
if (failed) process.exitCode = 1;
else console.log('sb-workspace: pass');
