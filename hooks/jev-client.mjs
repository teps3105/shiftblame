import { createConnection, createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, realpathSync, chmodSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { delegate } from '../cli/bin/jev.mjs';
import { filterToolResult } from './jev-work.mjs';
import { compactWorkingMemory } from '../cli/bin/jev-compact.mjs';
import { judgeRoute } from '../cli/bin/jev-route.mjs';

const self = fileURLToPath(import.meta.url);
const MAX_BYTES = 1024 * 1024;
function address(root) {
  const hash = createHash('sha256').update(homedir()).update(root);
  for (const path of [self, ...['./jev-work.mjs','../cli/bin/jev.mjs','../cli/bin/jev-route.mjs','../cli/bin/jev-compact.mjs',...['compact','state','request'].map(name=>`../cli/bin/vendor/fast-jev-compaction/${name}.js`)].map(path=>fileURLToPath(new URL(path,import.meta.url)))]) hash.update(readFileSync(path));
  const id = hash.digest('hex').slice(0, 32);
  return process.platform === 'win32' ? `\\\\.\\pipe\\sb-jev-${id}` : join(tmpdir(), `sb-jev-${id}.sock`);
}
function exchange(endpoint, message) {
  return new Promise((accept, reject) => {
    const socket = createConnection(endpoint); socket.setEncoding('utf8'); let data = ''; let settled = false;
    const done = (error, value) => { if (settled) return; settled = true; socket.destroy(); error ? reject(error) : accept(value); };
    socket.setTimeout(Math.max(1, message.deadline - Date.now()), () => done(new Error('deadline')));
    socket.on('error', error => done(error));
    socket.on('connect', () => socket.write(JSON.stringify(message) + '\n'));
    socket.on('data', chunk => {
      data += chunk;
      if (Buffer.byteLength(data) > MAX_BYTES) return done(new Error('size'));
      if (!data.includes('\n')) return;
      try {
        const reply = JSON.parse(data.slice(0, data.indexOf('\n')));
        if (reply.id !== message.id || reply.root !== message.root || reply.fingerprint !== message.fingerprint) throw new Error('source');
        done(null, reply.value);
      } catch (error) { done(error); }
    });
    socket.on('end', () => { if (!settled) done(new Error('closed')); });
  });
}

export async function requestJudgment(rootPath, kind, payload, timeoutMs = 2000) {
  if (!rootPath) return null;
  try {
    const deadline = Date.now() + Math.min(5000, Math.max(1, timeoutMs));
    const root = realpathSync(rootPath), endpoint = address(root);
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized) > MAX_BYTES - 1024) return null;
    const message = { id: randomUUID(), root, kind, payload, deadline,
      fingerprint: createHash('sha256').update(serialized).digest('hex') };
    try { return await exchange(endpoint, message); }
    catch (error) { if (!['ENOENT','ECONNREFUSED'].includes(error.code)) return null; }
    if (kind === 'shutdown') return null;
    const child = spawn(process.execPath, [self, '--serve', root], { cwd: dirname(self), detached: true, windowsHide: true, stdio: 'ignore' });
    child.on('error', () => {}); child.unref();
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 25));
      try { return await exchange(endpoint, message); }
      catch (error) { if (!['ENOENT','ECONNREFUSED'].includes(error.code)) return null; }
    }
  } catch { /* 失敗返回原工具路徑，不增加代理選用或管理服務步驟。 */ }
  return null;
}

export function serve(rootPath, options = {}) {
  const root = realpathSync(rootPath), endpoint = address(root);
  let active = 0, connections = 0, networkActive = 0;
  const pooledFetch = async (...args) => {
    if (networkActive >= 8) throw new Error('capacity');
    networkActive++;
    try {
      const response = await (options.fetch ?? fetch)(...args);
      if (!response.ok) { await response.body?.cancel(); return { ok:false, status:response.status }; }
      const data = await response.json();
      return { ok:true, status:response.status, json:async()=>data };
    }
    finally { networkActive--; }
  };
  const server = createServer(socket => {
    socket.setEncoding('utf8');
    if (++connections > 16) { connections--; socket.destroy(); return; }
    let data = '', received = false;
    socket.setTimeout(5000, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('close', () => { connections--; });
    socket.on('data', async chunk => {
      if (received) return;
      data += chunk;
      if (Buffer.byteLength(data) > MAX_BYTES) { socket.destroy(); return; }
      if (!data.includes('\n')) return;
      received = true;
      let message;
      try {
        message = JSON.parse(data.slice(0, data.indexOf('\n')));
        if (message.root !== root || !['filter','delegate','compact','route','shutdown'].includes(message.kind) || typeof message.id !== 'string' ||
            !Number.isFinite(message.deadline) || message.deadline <= Date.now() || message.deadline > Date.now() + 5000 ||
            message.fingerprint !== createHash('sha256').update(JSON.stringify(message.payload)).digest('hex')) throw new Error('invalid');
      } catch { socket.destroy(); return; }
      const reply = value => { if (!socket.destroyed) socket.end(JSON.stringify({ id: message.id, root, fingerprint: message.fingerprint, value }) + '\n'); };
      if (message.kind === 'shutdown') { reply(active === 0); if (!active) server.close(); return; }
      if (active >= 8) { reply(null); return; }
      active++; clearTimeout(idle);
      try {
        const timeoutMs = Math.max(1, Math.min(1200, message.deadline - Date.now()));
        const transport = { ...options, fetch: pooledFetch, timeoutMs };
        const value = message.kind === 'filter' ? await filterToolResult(root,message.payload,transport)
          : message.kind === 'compact' ? await compactWorkingMemory(message.payload,transport)
          : message.kind === 'route' ? await judgeRoute(message.payload,transport)
          : await delegate(root,message.payload,transport);
        reply(Date.now() < message.deadline ? value : null);
      } catch { reply(null); }
      finally { active--; if (!active) armIdle(); }
    });
  });
  let idle;
  const armIdle = () => { clearTimeout(idle); idle = setTimeout(() => { if (!active) server.close(); }, options.idleMs ?? 300000); idle.unref(); };
  server.on('error', () => { clearTimeout(idle); });
  server.on('close', () => clearTimeout(idle));
  server.listen(endpoint, () => { if (process.platform !== 'win32') chmodSync(endpoint, 0o600); armIdle(); });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === self) {
  if (process.argv[2] === '--serve') serve(process.argv[3]);
  else if (['--request','--compact','--route'].includes(process.argv[2])) {
    try {
      const payload = JSON.parse(Buffer.from(process.argv[4], 'base64').toString('utf8'));
      const kind = { '--request': 'delegate', '--compact': 'compact', '--route': 'route' }[process.argv[2]];
      process.stdout.write(JSON.stringify(await requestJudgment(process.argv[3], kind, payload)));
    } catch { process.stdout.write('null'); process.exitCode = 1; }
  }
}
