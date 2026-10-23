// Consumer scenarios: ordinary repositories use their own conventions without a personal policy.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = mkdtempSync(join(tmpdir(), 'sb-generic-'));
const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const hook = fileURLToPath(new URL('../../hooks/shiftblame-guard.mjs', import.meta.url));
const env = { ...process.env, SHIFTBLAME_POLICY: '' };
const run = (bin, args, extra = {}) => spawnSync(process.execPath, [bin, ...args], { cwd: root, encoding: 'utf8', env, ...extra });
const event = (name, payload = {}, extra = {}) => run(hook, [], { input: JSON.stringify({ cwd: root, session_id: 'ordinary-user', hook_event_name: name, ...payload }), ...extra });
try {
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);
  assert.equal(event('SessionStart').status, 0);
  assert.equal(existsSync(join(root, '.shiftblame')), false, 'startup does not create a mandatory interview workspace');
  for (let i = 0; i < 8; i++) assert.equal(event('PostToolUseFailure').stdout, '');
  mkdirSync(join(root, 'docs/images'), { recursive: true });
  writeFileSync(join(root, 'docs/guide.md'), '# Guide\n\nTODO: next release\n');
  writeFileSync(join(root, 'docs/images/example.svg'), '<svg/>');
  writeFileSync(join(root, 'ROADMAP.md'), '# Roadmap\n');
  writeFileSync(join(root, 'README.md'), '# Example\n\nUse sb.\n');
  assert.equal(spawnSync('git', ['add', 'docs', 'ROADMAP.md', 'README.md'], { cwd: root }).status, 0);
  for (const msg of ['Implement the ROADMAP.md command', 'custom(scope)!: support sb → next']) {
    const result = run(cli, ['commitmsg', msg]);
    assert.equal(result.status, 0, result.stderr);
  }
  for (let i = 0; i < 2; i++) {
    const result = run(cli, ['rewrite']);
    assert.equal(result.status, 0, result.stderr);
  }
  const snap = join(root, '.shiftblame/tmp/rewrite-backup');
  assert.ok(existsSync(snap));
  assert.equal(readFileSync(join(snap, readdirSync(snap).sort().at(-1), 'docs/images/example.svg'), 'utf8'), '<svg/>');
  const commit = event('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'git commit -m "custom message"' } });
  assert.equal(commit.status, 0, commit.stderr);
  assert.ok(!commit.stdout.includes('permissionDecision'), 'no mandatory stamp or test-batch gate');
  const interview = event('PreToolUse', { tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/tmp/interview-custom.md') } });
  assert.equal(interview.status, 0, interview.stderr);
  const unsafe = event('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'rm -rf .' } });
  assert.equal(unsafe.status, 2, 'generic path protection still applies');
  const custom = join(root, 'policy.mjs');
  writeFileSync(custom, 'export const apiVersion = 1; export const commitMessageIssue = msg => msg.startsWith("ticket:") ? null : "ticket prefix required"; export const createHook = () => () => ({context:"selected policy"});');
  const selected = { ...env, SHIFTBLAME_POLICY: custom };
  assert.equal(run(cli, ['commitmsg', 'wrong'], { env: selected }).status, 1);
  assert.equal(run(cli, ['commitmsg', 'ticket: change'], { env: selected }).status, 0);
  assert.match(event('SessionStart', {}, { env: selected }).stdout, /selected policy/);
  assert.equal(event('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'rm -rf .' } }, { env: selected }).status, 2, 'policy cannot override base safety');
  assert.notEqual(run(cli, ['state'], { env: { ...env, SHIFTBLAME_POLICY: './relative.mjs' } }).status, 0);
  const home = join(root, 'home');
  mkdirSync(join(home, '.config/shiftblame'), { recursive: true });
  writeFileSync(join(home, '.config/shiftblame/policy.json'), JSON.stringify({ module: custom }));
  const configured = { ...env, HOME: home, USERPROFILE: home };
  delete configured.SHIFTBLAME_POLICY;
  assert.equal(run(cli, ['commitmsg', 'wrong'], { env: configured }).status, 1, 'explicit installed config applies');
  assert.equal(run(cli, ['commitmsg', 'wrong'], { env: { ...configured, SHIFTBLAME_POLICY: '' } }).status, 0, 'empty environment disables installed policy');
  writeFileSync(custom, 'export const apiVersion = 1; export const createCli = () => ({checkStaged(){throw Error("validator failed")}}); export const createHook = () => () => {throw Error("hook failed")};');
  assert.notEqual(run(cli, ['commitmsg', 'message'], { env: selected }).status, 0, 'validator exceptions must fail');
  assert.equal(event('PreToolUse', { tool_name: 'Read' }, { env: selected }).status, 2, 'hook policy exceptions must fail');
  writeFileSync(custom, 'export const apiVersion = 999;');
  assert.notEqual(run(cli, ['state'], { env: selected }).status, 0);
  assert.equal(event('PreToolUse', { tool_name: 'Read' }, { env: selected }).status, 2, 'policy version failures block at the host boundary');
  writeFileSync(custom, 'export const apiVersion = 1; export const createHook = () => {throw Error("initialization failed")};');
  assert.equal(event('PreToolUse', { tool_name: 'Read' }, { env: selected }).status, 2, 'policy initialization failures block');
  assert.equal(event('PreToolUse', { tool_name: 'Read' }, { env: { ...env, SHIFTBLAME_POLICY: join(root, 'missing.mjs') } }).status, 2, 'missing policy cannot silently disable enforcement');
  assert.match(readFileSync(join(root, 'docs/guide.md'), 'utf8'), /TODO/, 'snapshot does not rewrite source');
  console.log('sb-generic: pass');
} finally {
  rmSync(root, { recursive: true, force: true });
}
