// 直接作業的唯讀 Git 事實＋原樣 Markdown；不儲存流程授權、不恢復產品檔案。
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readlinkSync,
  realpathSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { exactKeys, readFlowState, timestamp } from './flow-state.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const digest = value => hash(JSON.stringify(value));
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const oid = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const fail = message => { throw new Error(message); };
const quoted = value => JSON.stringify(value);
const decode = bytes => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const ignored = path => /^\.shiftblame(?:\/|$)/.test(path);
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function validTask(task) {
  return typeof task === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,79}$/u.test(task) &&
    !task.endsWith('.') && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(task);
}
function validPath(path) {
  return typeof path === 'string' && path.length > 0 && !isAbsolute(path) &&
    !/[\\:\x00-\x1f\x7f]/.test(path) && !ignored(path) &&
    path.split('/').every(part => part && part !== '.' && part !== '..' && part.toLowerCase() !== '.git');
}
function stat(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
// 清除可把查詢導向其他 repo／index／物件庫的環境覆寫；停用 Git 的可選索引寫入。
function git(root, args, allowed = [0]) {
  const env = { ...process.env };
  // Windows 環境名稱不分大小寫；複製為一般物件後須逐一清除別名，避免混用另一 repo。
  const overrides = /^(?:GIT_DIR|GIT_WORK_TREE|GIT_COMMON_DIR|GIT_INDEX_FILE|GIT_OBJECT_DIRECTORY|GIT_ALTERNATE_OBJECT_DIRECTORIES|GIT_NAMESPACE|GIT_PREFIX|GIT_OPTIONAL_LOCKS|GIT_TERMINAL_PROMPT)$/i;
  for (const key of Object.keys(env)) if (overrides.test(key)) delete env[key];
  env.GIT_OPTIONAL_LOCKS = '0';
  env.GIT_TERMINAL_PROMPT = '0';
  const result = spawnSync('git', ['-c', 'core.fsmonitor=false', ...args], {
    cwd: root, env, encoding: 'buffer', timeout: 30000, maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || !allowed.includes(result.status)) fail(`Git 無法查證（${args[0]}）：${result.error?.message ?? decode(result.stderr ?? Buffer.alloc(0)).trim()}`);
  return { status: result.status, text: decode(result.stdout) };
}
function repoRoot() {
  if (git(process.cwd(), ['rev-parse', '--is-inside-work-tree']).text.trim() !== 'true') fail('handoff 需要可查證的 Git 工作樹。');
  return realpathSync(git(process.cwd(), ['rev-parse', '--show-toplevel']).text.trim());
}
// 每個目錄元件都必須是真正目錄；連結即使指向 repo 內也不作保存落點。
function directory(root, parts, create = false) {
  let path = root;
  for (const part of parts) {
    path = join(path, part);
    if (create && !stat(path)) {
      try { mkdirSync(path); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    const s = stat(path);
    if (!s) fail(`交接目錄不存在：${path}`);
    if (s.isSymbolicLink() || !s.isDirectory() || realpathSync(path) !== path) fail(`不安全的交接路徑（符號連結／外指／非目錄）：${path}`);
  }
  return path;
}
function regular(path, optional = false) {
  const s = stat(path);
  if (!s && optional) return null;
  if (!s) fail(`檔案不存在：${path}`);
  if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1) fail(`不安全的檔案（連結或非一般檔案）：${path}`);
  return readFileSync(path);
}
function saveState(root) {
  // 只檢查已存在的系統目錄；失敗時不製造新狀態。
  if (stat(join(root, '.shiftblame'))) directory(root, ['.shiftblame']);
  const statePath = join(root, '.shiftblame', 'flow-state.json');
  if (stat(statePath)) regular(statePath);
  const current = readFlowState(root);
  if (!['missing', 'uninitialized', 'direct'].includes(current.kind) &&
      !(current.kind === 'ended' && current.state.concludedAt)) {
    fail(`handoff save 拒絕：${current.kind}（活動 slug／損壞狀態／未完結 ended 不可保存直接作業交接）。`);
  }
}
function identity(root, saving) {
  const ref = git(root, ['symbolic-ref', '--quiet', 'HEAD'], [0, 1]);
  if (ref.status === 1 && saving) fail('detached HEAD：handoff save 需要具名的直接作業分支。');
  const full = ref.status === 0 ? ref.text.trim() : null;
  if (full !== null && !full.startsWith('refs/heads/')) fail('HEAD 未指向可查證的本機分支。');
  const result = git(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], [0, 1]);
  let head = result.text.trim();
  if (result.status !== 0) {
    if (!full || git(root, ['show-ref', '--verify', '--quiet', full], [0, 1]).status !== 1) fail('HEAD 無法查證，且不是初始無提交分支。');
    head = null;
  } else if (!oid(head)) fail('HEAD commit 格式異常。');
  return { branch: full?.slice(11) ?? null, head };
}
function fileEntry(root, path) {
  if (!validPath(path)) fail(`Git 檔案路徑無法安全保存：${quoted(path)}`);
  const parts = path.split('/');
  let parent = root;
  for (const part of parts.slice(0, -1)) {
    parent = join(parent, part);
    const s = stat(parent);
    if (!s) return { path, type: 'missing', sha256: null };
    if (!s.isDirectory() || s.isSymbolicLink()) fail(`無法安全查證產品檔的父目錄：${parent}`);
  }
  const file = join(root, ...parts), s = stat(file);
  if (!s) return { path, type: 'missing', sha256: null };
  if (s.isSymbolicLink()) return { path, type: 'symlink', sha256: hash(readlinkSync(file, { encoding: 'buffer' })) };
  if (!s.isFile()) fail(`無法建立檔案指紋（非一般檔案，含 submodule／巢狀 repo）：${quoted(path)}`);
  return { path, type: 'file', sha256: hash(readFileSync(file)), executable: !!(s.mode & 0o111) };
}
const group = entries => ({ entries, sha256: digest(entries) });
function capture(root, saving = false) {
  const id = identity(root, saving);
  const index = git(root, ['ls-files', '--stage', '-z']).text.split('\0').filter(Boolean).flatMap(line => {
    const match = /^(\d{6}) ([a-f0-9]+) ([0-3])\t([\s\S]+)$/.exec(line);
    if (!match) fail('Git 索引資料格式異常。');
    if (ignored(match[4])) return [];
    if (!validPath(match[4])) fail(`索引路徑不安全：${quoted(match[4])}`);
    return [{ path: match[4], mode: match[1], oid: match[2], stage: Number(match[3]) }];
  }).sort((a, b) => order(a.path, b.path) || a.stage - b.stage);
  const worktree = [...new Set(index.map(entry => entry.path))].map(path => fileEntry(root, path));
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z']).text.split('\0')
    .filter(path => path && !ignored(path)).sort(order).map(path => fileEntry(root, path));
  const fields = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none']).text.split('\0');
  const status = [];
  for (let i = 0; i < fields.length; i++) {
    if (!fields[i]) continue;
    const xy = fields[i].slice(0, 2), path = fields[i].slice(3);
    const originalPath = /[RC]/.test(xy) ? fields[++i] : undefined;
    // 跨觀測目錄的 rename 仍以產品路徑呈現；觀測路徑不存入 snapshot。
    if (ignored(path)) {
      if (originalPath && !ignored(originalPath)) status.push({ path: originalPath, xy: 'D ' });
    } else status.push({ path, xy, ...(originalPath && !ignored(originalPath) ? { originalPath } : {}) });
  }
  status.sort((a, b) => order(a.path, b.path));
  return { ...id, index: group(index), worktree: group(worktree), untracked: group(untracked), status };
}
const SNAPSHOT_KEYS = ['schema', 'task', 'savedAt', 'repoRoot', 'branch', 'head', 'index', 'worktree', 'untracked', 'status', 'notes', 'notesSha256', 'sha256'];
function validate(snapshot, root, task) {
  const bad = reason => fail(`交接快照損壞或不相符：${task}（${reason}）`);
  if (!exactKeys(snapshot, SNAPSHOT_KEYS) || snapshot.schema !== 1) bad('schema');
  if (!validTask(snapshot.task) || snapshot.task !== task) bad('task／路徑');
  if (snapshot.repoRoot !== root) bad('repo 身份');
  if (!timestamp(snapshot.savedAt)) bad('savedAt');
  if (typeof snapshot.branch !== 'string' || !snapshot.branch ||
      git(root, ['check-ref-format', `refs/heads/${snapshot.branch}`], [0, 1]).status !== 0) bad('branch');
  if (snapshot.head !== null && !oid(snapshot.head)) bad('HEAD');
  if (typeof snapshot.notes !== 'string' || !snapshot.notes.trim() || !sha(snapshot.notesSha256) || hash(snapshot.notes) !== snapshot.notesSha256) bad('notes/hash');
  for (const name of ['index', 'worktree', 'untracked']) {
    const g = snapshot[name];
    if (!exactKeys(g, ['entries', 'sha256']) || !Array.isArray(g.entries) || !sha(g.sha256) || digest(g.entries) !== g.sha256) bad(`${name}/hash`);
    let previous = null;
    for (const entry of g.entries) {
      if (!entry || !validPath(entry.path)) bad(`${name}/路徑`);
      if (name === 'index') {
        if (!exactKeys(entry, ['path', 'mode', 'oid', 'stage']) || !/^(?:100644|100755|120000|160000)$/.test(entry.mode) || !oid(entry.oid) || !Number.isInteger(entry.stage) || entry.stage < 0 || entry.stage > 3) bad('index entry');
      } else {
        if (!exactKeys(entry, ['path', 'type', 'sha256', ...(entry.type === 'file' ? ['executable'] : [])]) ||
            !['file', 'symlink', 'missing'].includes(entry.type) ||
            (entry.type === 'missing' ? entry.sha256 !== null : !sha(entry.sha256)) ||
            (entry.type === 'file' && typeof entry.executable !== 'boolean')) bad(`${name} entry`);
      }
      if (previous && (order(previous.path, entry.path) > 0 || (previous.path === entry.path && (name !== 'index' || previous.stage >= entry.stage)))) bad(`${name} 重複或亂序路徑`);
      previous = entry;
    }
  }
  const tracked = [...new Set(snapshot.index.entries.map(entry => entry.path))];
  if (JSON.stringify(tracked) !== JSON.stringify(snapshot.worktree.entries.map(entry => entry.path))) bad('index/worktree 路徑');
  if (snapshot.untracked.entries.some(entry => tracked.includes(entry.path))) bad('untracked 路徑重複');
  if (!Array.isArray(snapshot.status) || snapshot.status.some(entry =>
    !exactKeys(entry, ['path', 'xy', ...(Object.hasOwn(entry ?? {}, 'originalPath') ? ['originalPath'] : [])]) ||
    !validPath(entry.path) || typeof entry.xy !== 'string' || !/^[ MADRCUT?!]{2}$/.test(entry.xy) ||
    (Object.hasOwn(entry, 'originalPath') && !validPath(entry.originalPath)))) bad('dirty status／路徑');
  const { sha256, ...body } = snapshot;
  if (!sha(sha256) || digest(body) !== sha256) bad('snapshot/hash');
  return snapshot;
}
function snapshotBytes(root, task, optional = false) {
  const dir = directory(root, ['.shiftblame', 'tmp', 'main', task]);
  return regular(join(dir, 'handoff.json'), optional);
}
function parse(bytes, root, task) {
  let value;
  try { value = JSON.parse(decode(bytes)); } catch { fail(`交接快照損壞：${task}（JSON／UTF-8）`); }
  return validate(value, root, task);
}
function save(root, task, source) {
  saveState(root);
  const dir = directory(root, ['.shiftblame', 'tmp', 'main', task], true);
  const lock = join(dir, '.save.lock'), pending = join(dir, `.handoff.${randomUUID()}.pending`);
  let locked = false, pendingCreated = false, committed = false;
  try {
    let fd;
    try { fd = openSync(lock, 'wx', 0o600); }
    catch (error) {
      if (error.code === 'EEXIST') fail(`工作 ${task} 正在保存或存在未清理的 .save.lock；確認原保存程序已結束後再處理鎖檔。`);
      throw error;
    }
    locked = true;
    closeSync(fd);
    const previous = snapshotBytes(root, task, true);
    if (previous) parse(previous, root, task);
    const sourcePath = realpathSync(resolve(process.cwd(), source));
    if (sourcePath === join(dir, 'handoff.json')) fail('notes 來源不可與輸出 snapshot 相同；保留來源原稿。');
    const notes = decode(readFileSync(sourcePath));
    if (!notes.trim()) fail('notes Markdown 不可為空；舊 snapshot 保持原樣。');
    const facts = capture(root, true);
    const body = { schema: 1, task, savedAt: new Date().toISOString(), repoRoot: root,
      ...facts, notes, notesSha256: hash(notes) };
    const snapshot = { ...body, sha256: digest(body) };
    validate(snapshot, root, task);
    const bytes = Buffer.from(JSON.stringify(snapshot, null, 2) + '\n');
    directory(root, ['.shiftblame', 'tmp', 'main', task]);
    fd = openSync(pending, 'wx', 0o600);
    pendingCreated = true;
    try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
    const verified = regular(pending);
    parse(verified, root, task);
    if (!bytes.equals(verified)) fail('pending 核對失敗；保留舊 snapshot。');
    if (digest(facts) !== digest(capture(root, true))) fail('保存期間 Git／檔案內容已變動；保留舊 snapshot，請核對後重試。');
    saveState(root);
    const now = snapshotBytes(root, task, true);
    if ((previous === null) !== (now === null) || (previous && !previous.equals(now))) fail('同 task 的 snapshot 已被其他程序更動；拒絕覆蓋。');
    if (!bytes.equals(regular(pending))) fail('pending 在核對期間被更動；保留舊 snapshot。');
    renameSync(pending, join(dir, 'handoff.json'));
    pendingCreated = false;
    committed = true;
    console.log(`pass\n  ✓ handoff 已保存：${task}\n  ✓ ${join(dir, 'handoff.json')}\n  ✓ branch: ${facts.branch}；HEAD: ${facts.head ?? 'null（初始無提交）'}`);
    console.log('快照僅供交接；權限與需求仍以原對話及正式來源為準，snapshot 不是授權。指紋只核對檔案輸入一致性，不代表行為驗收。');
  } finally {
    // 不穿越執行期間遭置換的目錄來清理；舊快照不參與刪除。
    if (locked) {
      try {
        directory(root, ['.shiftblame', 'tmp', 'main', task]);
        try { if (pendingCreated) unlinkSync(pending); }
        finally { unlinkSync(lock); }
      } catch (error) {
        // 原子替換已成功後，清理失敗不能誤報「保存失敗、舊快照仍在」。
        // 替換前若已有錯誤，保留其原始診斷，另揭露殘留資料。
        console.error(`警告：${committed ? '交接已保存' : '交接未保存'}，但暫存／鎖檔清理失敗：${error.message}`);
        console.error('請以 handoff show 核對落點；確認原程序已結束及實體路徑後，再清理殘留暫存／鎖檔。');
      }
    }
  }
}
function compareGroup(name, before, after) {
  if (before.sha256 === after.sha256) { console.log(`${name}: 相同`); return false; }
  console.log(`${name}: 差異`);
  const key = entry => `${entry.path}\0${entry.stage ?? ''}`;
  const a = new Map(before.entries.map(entry => [key(entry), entry]));
  const b = new Map(after.entries.map(entry => [key(entry), entry]));
  for (const k of [...new Set([...a.keys(), ...b.keys()])].sort(order)) {
    if (JSON.stringify(a.get(k)) !== JSON.stringify(b.get(k))) console.log(`  ${!a.has(k) ? '新增' : !b.has(k) ? '移除' : '變更'} ${quoted((b.get(k) ?? a.get(k)).path)}`);
  }
  return true;
}
function show(root, task) {
  const snapshot = parse(snapshotBytes(root, task), root, task);
  const current = capture(root);
  console.log(`task: ${task}\nsavedAt: ${snapshot.savedAt}\nrepo: ${root}`);
  console.log(`branch: 保存 ${snapshot.branch} → 目前 ${current.branch ?? 'detached HEAD'}`);
  console.log(`HEAD: 保存 ${snapshot.head ?? 'null（初始無提交）'} → 目前 ${current.head ?? 'null（初始無提交）'}`);
  let changed = snapshot.branch !== current.branch || snapshot.head !== current.head;
  for (const name of ['index', 'worktree', 'untracked']) changed = compareGroup(name, snapshot[name], current[name]) || changed;
  console.log(`dirty: 保存 ${snapshot.status.length} 筆 → 目前 ${current.status.length} 筆`);
  for (const entry of current.status) console.log(`  ${entry.xy} ${quoted(entry.path)}`);
  changed = digest(snapshot.status) !== digest(current.status) || changed;
  console.log(changed ? '差異需依原對話、正式來源及目前工作內容作語義核對。' : '目前分支、HEAD 與檔案指紋相同；續行仍須核對交接內容與正式來源。');
  console.log('權限與需求仍以原對話及正式來源為準，snapshot 不是授權；指紋只核對檔案輸入一致性，不代表行為驗收。本命令不切分支或還原檔案。');
  console.log('--- notes Markdown ---');
  process.stdout.write(snapshot.notes);
  if (!snapshot.notes.endsWith('\n')) process.stdout.write('\n');
}
function list(root) {
  const dir = directory(root, ['.shiftblame', 'tmp', 'main']);
  const entries = readdirSync(dir).sort(order);
  if (!entries.length) fail(`沒有具名交接：${dir}`);
  let broken = false;
  for (const task of entries) {
    try {
      if (!validTask(task)) fail(`非法 task 路徑：${quoted(task)}`);
      const snapshot = parse(snapshotBytes(root, task), root, task);
      console.log(`${task}\t${snapshot.savedAt}\t${snapshot.branch}\t${snapshot.head ?? 'null（初始無提交）'}`);
    } catch (error) { broken = true; console.error(`損壞／缺失：${quoted(task)} — ${error.message}`); }
  }
  return broken ? 1 : 0;
}
export function runHandoff(args) {
  const [action, task, source] = args;
  if (!((action === 'save' && args.length === 3) || (action === 'show' && args.length === 2) || (action === 'list' && args.length === 1))) {
    console.error('用法：sb handoff save <task> <notes.md> | sb handoff list | sb handoff show <task>');
    return 2;
  }
  if (action !== 'list' && !validTask(task)) fail('task 須為具名工作（1–80 個字母、數字、點、底線或連字號；字母／數字起首），不可使用路徑、尾點或 Windows 保留名。');
  const root = repoRoot();
  if (action === 'save') save(root, task, source);
  else if (action === 'show') show(root, task);
  else return list(root);
  return 0;
}
