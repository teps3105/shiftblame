// 命令結構解析：把 Bash、PowerShell 與 cmd 指令拆成簡單命令（字詞、重定向、管線），供 hook 依結構判斷。
// 引號內文字、註解與運算式不當成命令；可辨識的巢狀 shell（-c、eval、iex、cmd /c、heredoc、管線餵 shell）一併展開。
// 界線：直譯器內嵌程式（node -e、python -c）、腳本檔內容、執行期才組成的命令與 cd 造成的目錄變化不展開。

export const MAX_DEPTH = 4;
const MAX_PARSES = 256;
// 已在外層展開過的命令替換，在字詞值中以占位符代替，避免巢狀重解析時重複計入。
const SUB = '$__sub__';

const mkWord = (value = '', raw = value) => ({ value, raw, quoted: false, dynamic: false });
const newCmd = () => ({ words: [], redirects: [], heredocs: [], herestrings: [], pipeIn: false, pipeOut: false, pipeline: 0 });

// ———— 共用掃描 ————

function findBacktick(src, i) {
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === '`') return i;
    i++;
  }
  return -1;
}
function skipDoublePosix(src, i) {
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '"') return i + 1;
    if (c === '$' && src[i + 1] === '(') { const j = matchParen(src, i + 2); i = j < 0 ? src.length : j + 1; continue; }
    if (c === '`') { const j = findBacktick(src, i + 1); i = j < 0 ? src.length : j + 1; continue; }
    i++;
  }
  return src.length;
}
// i 指向開括號之後；回傳對應閉括號位置，找不到為 -1。
function matchParen(src, i) {
  let depth = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === "'") { const j = src.indexOf("'", i + 1); i = j < 0 ? src.length : j + 1; continue; }
    if (c === '"') { i = skipDoublePosix(src, i + 1); continue; }
    if (c === '`') { const j = findBacktick(src, i + 1); i = j < 0 ? src.length : j + 1; continue; }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
    i++;
  }
  return -1;
}
const unescapeBacktick = (s) => s.replace(/\\([`\\$])/g, '$1');

// ———— POSIX shell ————

const POSIX_BREAK = new Set([' ', '\t', '\r', '\n', ';', '&', '|', '(', ')', '<', '>']);
// 反斜線後接這些字元才是跳脫；其餘保留反斜線，使未加引號的 Windows 路徑維持原樣。
const POSIX_ESCAPABLE = new Set([' ', '\t', "'", '"', '`', '$', '\\', ';', '&', '|', '(', ')', '<', '>', '*', '?', '[', ']', '#', '~', '{', '}', '!', '=', '%', '^']);
const ANSI_C = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', v: '\v', '\\': '\\', "'": "'", '"': '"', '?': '?' };

function ansiC(src, i) {
  let v = '';
  while (i < src.length) {
    const c = src[i];
    if (c === "'") return [v, i + 1];
    if (c === '\\' && i + 1 < src.length) { const d = src[i + 1]; v += ANSI_C[d] ?? c + d; i += 2; continue; }
    v += c; i++;
  }
  return [v, src.length];
}
function readDollarPosix(src, i, w, ctx) {
  const d = src[i + 1];
  if (d === '(') {
    const j = matchParen(src, i + 2), e = j < 0 ? src.length : j;
    w.dynamic = true;
    if (src[i + 2] === '(') w.value += src.slice(i, e + 1); // $((…)) 是算術，不是命令
    else { ctx.sub(src.slice(i + 2, e), 'posix'); w.value += SUB; }
    return e + 1;
  }
  if (d === '{') { const j = src.indexOf('}', i + 2), e = j < 0 ? src.length : j; w.dynamic = true; w.value += src.slice(i, e + 1); return e + 1; }
  if (d && /[A-Za-z_]/.test(d)) { let j = i + 1; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++; w.dynamic = true; w.value += src.slice(i, j); return j; }
  if (d && /[0-9@*#?$!-]/.test(d)) { w.dynamic = true; w.value += src.slice(i, i + 2); return i + 2; }
  w.value += '$';
  return i + 1;
}
function readBacktickPosix(src, i, w, ctx) {
  const j = findBacktick(src, i + 1), e = j < 0 ? src.length : j;
  ctx.sub(unescapeBacktick(src.slice(i + 1, e)), 'posix');
  w.dynamic = true; w.value += SUB;
  return e + 1;
}
function readDoublePosix(src, i, w, ctx) {
  while (i < src.length) {
    const c = src[i];
    if (c === '"') return i + 1;
    if (c === '\\') {
      const d = src[i + 1];
      if (d === '\n') { i += 2; continue; }
      if (d === '$' || d === '`' || d === '"' || d === '\\') { w.value += d; i += 2; continue; }
      w.value += c; i++; continue;
    }
    if (c === '`') { i = readBacktickPosix(src, i, w, ctx); continue; }
    if (c === '$') { i = readDollarPosix(src, i, w, ctx); continue; }
    w.value += c; i++;
  }
  return src.length;
}
function readWordPosix(src, i, ctx) {
  const w = mkWord(), start = i;
  while (i < src.length) {
    const c = src[i];
    if (POSIX_BREAK.has(c)) break;
    if (c === '\\') {
      const d = src[i + 1];
      if (d === '\n') { i += 2; continue; }
      if (d === undefined) { w.value += '\\'; i++; continue; }
      if (POSIX_ESCAPABLE.has(d)) { w.value += d; w.quoted = true; i += 2; continue; }
      w.value += '\\' + d; i += 2; continue;
    }
    if (c === "'") { const j = src.indexOf("'", i + 1), e = j < 0 ? src.length : j; w.value += src.slice(i + 1, e); w.quoted = true; i = e + 1; continue; }
    if (c === '$' && src[i + 1] === "'") { const [v, e] = ansiC(src, i + 2); w.value += v; w.quoted = true; i = e; continue; }
    if (c === '"') { i = readDoublePosix(src, i + 1, w, ctx); w.quoted = true; continue; }
    if (c === '`') { i = readBacktickPosix(src, i, w, ctx); continue; }
    if (c === '$') { i = readDollarPosix(src, i, w, ctx); continue; }
    w.value += c; i++;
  }
  w.raw = src.slice(start, i);
  return [w, i];
}
// 未加引號的 heredoc 本文仍會展開命令替換：解析其內容，回傳以占位符取代後的本文。
function extractPosixSubs(text, ctx) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') { out += text.slice(i, i + 2); i++; continue; }
    if (c === '$' && text[i + 1] === '(' && text[i + 2] !== '(') {
      const j = matchParen(text, i + 2), e = j < 0 ? text.length : j;
      ctx.sub(text.slice(i + 2, e), 'posix'); out += SUB; i = e;
    } else if (c === '`') {
      const j = findBacktick(text, i + 1), e = j < 0 ? text.length : j;
      ctx.sub(unescapeBacktick(text.slice(i + 1, e)), 'posix'); out += SUB; i = e;
    } else out += c;
  }
  return out;
}
function findTestClose(src, i) {
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === "'") { const j = src.indexOf("'", i + 1); i = j < 0 ? src.length : j + 1; continue; }
    if (c === '"') { i = skipDoublePosix(src, i + 1); continue; }
    if (c === ']' && src[i + 1] === ']' && /\s/.test(src[i - 1] ?? ' ') && (i + 2 >= src.length || /[\s;&|)]/.test(src[i + 2]))) return i;
    i++;
  }
  return -1;
}

function parsePosix(src, ctx) {
  const cmds = [], docs = [];
  let cur = newCmd(), pipeline = ctx.nextPipeline(), pending = null, i = 0;
  const n = src.length;
  const closePending = () => { if (pending) { cur.redirects.push({ fd: pending.fd, op: pending.op, target: null, dup: false }); pending = null; } };
  const flush = (op) => {
    closePending();
    const had = cur.words.length || cur.redirects.length;
    if (had) { cur.pipeline = pipeline; cmds.push(cur); }
    const prev = cur;
    cur = newCmd();
    if ((op === '|' || op === '|&') && had) { prev.pipeOut = true; cur.pipeIn = true; }
    else pipeline = ctx.nextPipeline();
  };
  const addWord = (w) => {
    if (!pending) { cur.words.push(w); return; }
    const r = pending; pending = null;
    const dup = (r.op === '>&' || r.op === '<&') && !w.dynamic && /^(?:\d+|-)$/.test(w.value);
    cur.redirects.push({ fd: r.fd, op: r.op === '>&' && !dup ? '&>' : r.op, target: w, dup });
    if (r.op === '<<' || r.op === '<<-') docs.push({ delim: w.raw.replace(/['"\\]/g, ''), expand: !/['"\\]/.test(w.raw), strip: r.op === '<<-', cmd: cur });
    if (r.op === '<<<') cur.herestrings.push(w);
  };
  const readDocs = (at) => {
    for (const d of docs.splice(0)) {
      let body = '';
      while (at < n) {
        let e = src.indexOf('\n', at); if (e < 0) e = n;
        const line = src.slice(at, e);
        at = e + 1;
        if ((d.strip ? line.replace(/^\t+/, '') : line).replace(/\r$/, '') === d.delim) break;
        body += line + '\n';
      }
      d.cmd.heredocs.push({ body: d.expand ? extractPosixSubs(body, ctx) : body, expand: d.expand });
    }
    return Math.min(at, n);
  };
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
    if (c === '\n') { flush('\n'); i++; if (docs.length) i = readDocs(i); continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    const start = !cur.words.length && !pending;
    if (start && src.startsWith('((', i)) { const j = matchParen(src, i + 1); i = j < 0 ? n : j + 1; continue; }
    if (start && src.startsWith('[[', i) && /\s/.test(src[i + 2] ?? '')) { const j = findTestClose(src, i + 2); i = j < 0 ? n : j + 2; continue; }
    const two = src.slice(i, i + 2);
    if (src.startsWith('&>>', i)) { closePending(); pending = { fd: null, op: '&>>' }; i += 3; continue; }
    if (two === '&>') { closePending(); pending = { fd: null, op: '&>' }; i += 2; continue; }
    if (two === '&&' || two === '||' || two === ';;' || two === ';&' || two === '|&') { flush(two); i += 2; continue; }
    if (c === ';' || c === '&' || c === '|' || c === '(' || c === ')') { flush(c); i++; continue; }
    if ((c === '<' || c === '>') && src[i + 1] === '(') {
      const j = matchParen(src, i + 2), e = j < 0 ? n : j;
      ctx.sub(src.slice(i + 2, e), 'posix');
      const w = mkWord(SUB, src.slice(i, e + 1)); w.dynamic = true; addWord(w);
      i = e + 1; continue;
    }
    const rm = /^(\d*)(>>|>\||>&|>|<<<|<<-|<<|<>|<&|<)/.exec(src.slice(i, i + 12));
    if (rm) { closePending(); pending = { fd: rm[1] || null, op: rm[2] }; i += rm[0].length; continue; }
    const [w, j] = readWordPosix(src, i, ctx);
    i = j === i ? i + 1 : j;
    addWord(w);
  }
  flush('eof');
  return cmds;
}

// ———— PowerShell ————

const PS_BREAK = new Set([' ', '\t', '\r', '\n', ';', '|', '&', '(', ')', '{', '}', '<', '>']);
const PS_SQ = new Set(["'", '\u2018', '\u2019', '\u201A', '\u201B']);
const PS_DQ = new Set(['"', '\u201C', '\u201D', '\u201E']);
const PS_ESC = { n: '\n', t: '\t', r: '\r', '0': '\0', a: '\x07', b: '\b', f: '\f', v: '\v', e: '\x1b' };
const PS_ASSIGN = /^(?:=|\+=|-=|\*=|\/=|%=|\?\?=)$/;

function skipPsString(src, i) { // i 指向開引號
  const set = PS_DQ.has(src[i]) ? PS_DQ : PS_SQ, dq = set === PS_DQ;
  i++;
  while (i < src.length) {
    const c = src[i];
    if (dq && c === '`') { i += 2; continue; }
    if (set.has(c)) { if (set.has(src[i + 1])) { i += 2; continue; } return i + 1; }
    i++;
  }
  return src.length;
}
function matchPs(src, i, open, close) { // i 指向開括號之後
  let depth = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '`') { i += 2; continue; }
    if (PS_SQ.has(c) || PS_DQ.has(c)) { i = skipPsString(src, i); continue; }
    if (c === '#' && (i === 0 || /\s/.test(src[i - 1]))) { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
    i++;
  }
  return -1;
}
function readDollarPs(src, i, w, ctx) {
  const d = src[i + 1];
  if (d === '(') { const j = matchPs(src, i + 2, '(', ')'), e = j < 0 ? src.length : j; ctx.sub(src.slice(i + 2, e), 'ps'); w.dynamic = true; w.value += SUB; return e + 1; }
  if (d === '{') { const j = src.indexOf('}', i + 2), e = j < 0 ? src.length : j; w.dynamic = true; w.value += src.slice(i, e + 1); return e + 1; }
  if (d && /[A-Za-z_?^$]/.test(d)) { let j = i + 2; while (j < src.length && /[A-Za-z0-9_:]/.test(src[j])) j++; w.dynamic = true; w.value += src.slice(i, j); return j; }
  w.value += '$';
  return i + 1;
}
function readDoublePs(src, i, w, ctx) {
  while (i < src.length) {
    const c = src[i];
    if (PS_DQ.has(c)) { if (PS_DQ.has(src[i + 1])) { w.value += '"'; i += 2; continue; } return i + 1; }
    if (c === '`') { const d = src[i + 1] ?? ''; w.value += PS_ESC[d] ?? d; i += 2; continue; }
    if (c === '$') { i = readDollarPs(src, i, w, ctx); continue; }
    w.value += c; i++;
  }
  return src.length;
}
function readSinglePs(src, i, w) {
  while (i < src.length) {
    const c = src[i];
    if (PS_SQ.has(c)) { if (PS_SQ.has(src[i + 1])) { w.value += "'"; i += 2; continue; } return i + 1; }
    w.value += c; i++;
  }
  return src.length;
}
function readWordPs(src, i, ctx) {
  const w = mkWord(), start = i;
  while (i < src.length) {
    const c = src[i];
    if (PS_BREAK.has(c)) break;
    if (c === '`') { const d = src[i + 1]; if (d === undefined) { i++; continue; } w.value += PS_ESC[d] ?? d; w.quoted = true; i += 2; continue; }
    if (PS_SQ.has(c)) { i = readSinglePs(src, i + 1, w); w.quoted = true; continue; }
    if (PS_DQ.has(c)) { i = readDoublePs(src, i + 1, w, ctx); w.quoted = true; continue; }
    if (c === '$') { i = readDollarPs(src, i, w, ctx); continue; }
    w.value += c; i++;
  }
  w.raw = src.slice(start, i);
  return [w, i];
}
function readHereStringPs(src, i, ctx) { // i 指向 @
  const dq = src[i + 1] === '"';
  let j = i + 2;
  while (j < src.length && (src[j] === ' ' || src[j] === '\t')) j++;
  if (src[j] === '\r') j++;
  if (src[j] !== '\n') return null;
  const close = new RegExp(`\\r?\\n${dq ? '"' : "'"}@`, 'g');
  close.lastIndex = j;
  const m = close.exec(src);
  const bodyEnd = m ? m.index : src.length;
  const w = mkWord();
  w.quoted = true;
  const body = src.slice(j + 1, bodyEnd);
  if (dq) readDoublePs(body + '"', 0, w, ctx);
  else w.value = body;
  const end = m ? m.index + m[0].length : src.length;
  w.raw = src.slice(i, end);
  return [w, end];
}

function parsePs(src, ctx) {
  const cmds = [];
  let cur = newCmd(), pipeline = ctx.nextPipeline(), pending = null, i = 0;
  const n = src.length;
  const closePending = () => { if (pending) { cur.redirects.push({ fd: pending.fd, op: pending.op, target: null, dup: false }); pending = null; } };
  const flush = (op) => {
    closePending();
    const had = cur.words.length || cur.redirects.length;
    if (had) { cur.pipeline = pipeline; cmds.push(cur); }
    const prev = cur;
    cur = newCmd();
    if (op === '|' && had) { prev.pipeOut = true; cur.pipeIn = true; }
    else pipeline = ctx.nextPipeline();
  };
  const addWord = (w) => {
    if (!pending) { cur.words.push(w); return; }
    cur.redirects.push({ fd: pending.fd, op: pending.op, target: w, dup: false });
    pending = null;
  };
  const group = (from, open, close, rawStart) => { // 子運算式與指令區塊：內容另行解析，字詞以占位符代表
    const j = matchPs(src, from, open, close), e = j < 0 ? n : j;
    ctx.sub(src.slice(from, e), 'ps');
    const w = mkWord(SUB, src.slice(rawStart, e + 1)); w.dynamic = true; addWord(w);
    return e + 1;
  };
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f') { i++; continue; }
    if (c === '`' && (src[i + 1] === '\n' || (src[i + 1] === '\r' && src[i + 2] === '\n'))) { i += src[i + 1] === '\r' ? 3 : 2; continue; }
    if (c === '\n') { flush('\n'); i++; continue; }
    if (c === '<' && src[i + 1] === '#') { const j = src.indexOf('#>', i + 2); i = j < 0 ? n : j + 2; continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    const two = src.slice(i, i + 2);
    if (two === '&&' || two === '||') { flush(two); i += 2; continue; }
    if (c === ';') { flush(';'); i++; continue; }
    if (c === '|') { flush('|'); i++; continue; }
    if (c === '&') { if (cur.words.length) flush('&'); i++; continue; } // 開頭是呼叫運算子，結尾是背景執行
    if (c === '.' && !cur.words.length && /\s/.test(src[i + 1] ?? '')) { i++; continue; } // dot-source
    if (c === '(') { i = group(i + 1, '(', ')', i); continue; }
    if ((c === '$' || c === '@') && src[i + 1] === '(') { i = group(i + 2, '(', ')', i); continue; }
    if (c === '{') { i = group(i + 1, '{', '}', i); continue; }
    if (c === '@' && src[i + 1] === '{') { i = group(i + 2, '{', '}', i); continue; }
    if (c === ')' || c === '}') { i++; continue; }
    if (c === '@' && (src[i + 1] === "'" || src[i + 1] === '"')) {
      const hs = readHereStringPs(src, i, ctx);
      if (hs) { addWord(hs[0]); i = hs[1]; continue; }
    }
    const rm = /^([1-6*]?)(>>|>&[1-6]|>|<)/.exec(src.slice(i, i + 5));
    if (rm) {
      closePending();
      if (rm[2].startsWith('>&')) cur.redirects.push({ fd: rm[1] || null, op: '>&', target: mkWord(rm[2].slice(2)), dup: true });
      else pending = { fd: rm[1] || null, op: rm[2] };
      i += rm[0].length; continue;
    }
    if (src.startsWith('--%', i) && (i + 3 >= n || /\s/.test(src[i + 3]))) { // 停止解析：其後原樣傳給程式
      let e = src.indexOf('\n', i); if (e < 0) e = n;
      addWord(mkWord('--%'));
      for (const t of src.slice(i + 3, e).match(/"[^"]*"|\S+/g) ?? []) { const w = mkWord(t.replace(/^"|"$/g, ''), t); w.quoted = t.startsWith('"'); addWord(w); }
      i = e; continue;
    }
    const [w, j] = readWordPs(src, i, ctx);
    i = j === i ? i + 1 : j;
    addWord(w);
  }
  flush('eof');
  return cmds;
}

// ———— cmd.exe ————

const CMD_BREAK = new Set([' ', '\t', '\r', '\n', '&', '|', '(', ')', '<', '>']);
function readWordCmd(src, i) {
  const w = mkWord(), start = i;
  let inQuote = false;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n' || (!inQuote && CMD_BREAK.has(c))) break;
    if (c === '"') { inQuote = !inQuote; w.quoted = true; i++; continue; }
    if (c === '^' && !inQuote) { if (src[i + 1] !== undefined) w.value += src[i + 1]; i += 2; continue; }
    if (c === '%' || c === '!') {
      const j = src.indexOf(c, i + 1);
      if (j > i + 1 && /^[A-Za-z_][\w:~,\-=]*$/.test(src.slice(i + 1, j))) { w.dynamic = true; w.value += src.slice(i, j + 1); i = j + 1; continue; }
    }
    w.value += c; i++;
  }
  w.raw = src.slice(start, i);
  return [w, i];
}
function parseCmd(src, ctx) {
  const cmds = [];
  let cur = newCmd(), pipeline = ctx.nextPipeline(), pending = null, i = 0;
  const n = src.length;
  const closePending = () => { if (pending) { cur.redirects.push({ fd: pending.fd, op: pending.op, target: null, dup: false }); pending = null; } };
  const flush = (op) => {
    closePending();
    const had = cur.words.length || cur.redirects.length;
    if (had) { cur.pipeline = pipeline; cmds.push(cur); }
    const prev = cur;
    cur = newCmd();
    if (op === '|' && had) { prev.pipeOut = true; cur.pipeIn = true; }
    else pipeline = ctx.nextPipeline();
  };
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '^' && src[i + 1] === '\n') { i += 2; continue; }
    if (c === '\n') { flush('\n'); i++; continue; }
    if (!cur.words.length && !pending) {
      if (c === '@') { i++; continue; }
      if (src.startsWith('::', i) || /^rem(?:\s|$)/i.test(src.slice(i, i + 4))) { while (i < n && src[i] !== '\n') i++; continue; }
    }
    const two = src.slice(i, i + 2);
    if (two === '&&' || two === '||') { flush(two); i += 2; continue; }
    if (c === '&' || c === '|' || c === '(' || c === ')') { flush(c); i++; continue; }
    const rm = /^(\d?)(>>|>&\d|<&\d|>|<)/.exec(src.slice(i, i + 4));
    if (rm) {
      closePending();
      if (/^[<>]&/.test(rm[2])) cur.redirects.push({ fd: rm[1] || null, op: rm[2].slice(0, 2), target: mkWord(rm[2].slice(2)), dup: true });
      else pending = { fd: rm[1] || null, op: rm[2] };
      i += rm[0].length; continue;
    }
    const [w, j] = readWordCmd(src, i);
    i = j === i ? i + 1 : j;
    if (pending) { cur.redirects.push({ fd: pending.fd, op: pending.op, target: w, dup: false }); pending = null; }
    else cur.words.push(w);
  }
  flush('eof');
  return cmds;
}

// ———— 命令解析：保留字、環境指派與包裝程式 ————

const STRIP_POSIX = new Set(['if', 'then', 'elif', 'else', 'fi', 'do', 'done', 'while', 'until', '!', '{', '}', 'esac', 'coproc']);
const NON_COMMAND_POSIX = new Set(['for', 'case', 'select', 'function', 'in']);
const ASSIGN_RE = /^[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]*\])?\+?=/;
export const baseName = (v) => String(v).split(/[\\/]/).pop().toLowerCase().replace(/\.(?:exe|com|bat|cmd)$/, '');

function skipOptions(ws, i, valueOpts = [], { positional = 0 } = {}) {
  while (i < ws.length) {
    const v = ws[i].value;
    if (v === '--') { i++; break; }
    if (!v.startsWith('-') || v === '-') break;
    i += valueOpts.includes(v) ? 2 : 1;
  }
  return Math.min(i + positional, ws.length);
}
const WRAPPERS = {
  env(ws, i, res) {
    while (i < ws.length) {
      const v = ws[i].value;
      if (v === '--') { i++; break; }
      if (v === '-S' || v === '--split-string') { if (ws[i + 1]) res.scripts.push({ text: ws[i + 1].value, dialect: 'posix' }); i += 2; continue; }
      if (v.startsWith('--split-string=')) { res.scripts.push({ text: v.slice(15), dialect: 'posix' }); i++; continue; }
      if (/^-S./.test(v)) { res.scripts.push({ text: v.slice(2), dialect: 'posix' }); i++; continue; }
      if (['-u', '--unset', '-C', '--chdir'].includes(v)) { i += 2; continue; }
      if (v.startsWith('-') && v !== '-') { i++; continue; }
      break;
    }
    while (i < ws.length && /^[^=-][^=]*=/.test(ws[i].value)) i++;
    return i;
  },
  command(ws, i) {
    while (i < ws.length && /^-[pvV]+$/.test(ws[i].value)) { if (/[vV]/.test(ws[i].value)) return -1; i++; }
    return i;
  },
  builtin: (ws, i) => i,
  busybox: (ws, i) => i,
  exec: (ws, i) => skipOptions(ws, i, ['-a']),
  nohup: (ws, i) => i,
  time: (ws, i) => skipOptions(ws, i),
  nice: (ws, i) => skipOptions(ws, i, ['-n']),
  sudo: (ws, i) => skipOptions(ws, i, ['-u', '-g', '-h', '-p', '-C', '-D', '-r', '-t', '-U', '-T']),
  doas: (ws, i) => skipOptions(ws, i, ['-u', '-C']),
  timeout: (ws, i) => skipOptions(ws, i, ['-s', '-k'], { positional: 1 }),
  stdbuf: (ws, i) => skipOptions(ws, i, ['-i', '-o', '-e']),
  winpty: (ws, i) => skipOptions(ws, i),
  call: (ws, i) => i,
  xargs(ws, i, res) {
    res.stdinArgs = true;
    return skipOptions(ws, i, ['-a', '-d', '-E', '-I', '-L', '-n', '-P', '-s', '--arg-file', '--delimiter', '--eof', '--max-args', '--max-lines', '--max-procs', '--max-chars', '--replace', '--process-slot-var']);
  },
  npx(ws, i, res) {
    while (i < ws.length) {
      const v = ws[i].value;
      if (v === '--') { i++; break; }
      if (v === '-c' || v === '--call') { if (ws[i + 1]) res.scripts.push({ text: ws[i + 1].value, dialect: 'posix' }); i += 2; continue; }
      if (v === '-p' || v === '--package') { i += 2; continue; }
      if (v.startsWith('-')) { i++; continue; }
      break;
    }
    return i;
  },
};

function resolveEntry(cmd, words = cmd.words, extra = {}) {
  const res = { cmd, dialect: cmd.dialect, depth: cmd.depth, name: null, nameWord: null, args: [], stdinArgs: false, query: false, scripts: [], ...extra };
  let i = 0;
  if (cmd.dialect === 'posix') {
    while (i < words.length && !words[i].quoted && STRIP_POSIX.has(words[i].value)) i++;
    if (i < words.length && !words[i].quoted && NON_COMMAND_POSIX.has(words[i].value)) return res;
    while (i < words.length && ASSIGN_RE.test(words[i].raw)) i++;
  } else if (cmd.dialect === 'ps' && words.length > 2 && words[0].dynamic && PS_ASSIGN.test(words[1].value)) {
    i = 2; // $x = <pipeline>
  }
  for (let guard = 0; guard < 8 && i < words.length; guard++) {
    const w = words[i];
    if (w.dynamic) break;
    const wrap = WRAPPERS[baseName(w.value)];
    if (!wrap) break;
    const next = wrap(words, i + 1, res);
    if (next < 0) { res.query = true; return res; }
    i = next;
    if (cmd.dialect === 'posix') while (i < words.length && ASSIGN_RE.test(words[i].raw)) i++;
  }
  if (i >= words.length) return res;
  res.nameWord = words[i];
  res.name = words[i].dynamic ? null : baseName(words[i].value);
  res.args = words.slice(i + 1);
  return res;
}
// find 的搜尋根：選項與運算式之前的位置參數；未給時 find 以 . 為根。
export function findRoots(entry) {
  const roots = [], args = entry.args;
  let i = 0;
  while (i < args.length && /^-(?:[HLP]|D|O\d*)$/.test(args[i].value)) i += args[i].value === '-D' ? 2 : 1;
  for (; i < args.length; i++) {
    const v = args[i].value;
    if (v.startsWith('-') || v === '(' || v === '!' || v === ',') break;
    roots.push(args[i]);
  }
  return roots;
}
// find -exec／-execdir／-ok 的子命令視為獨立命令；{} 代表 find 的搜尋結果。
function findExecEntries(entry) {
  if (entry.name !== 'find') return [];
  const out = [], args = entry.args, roots = findRoots(entry);
  for (let i = 0; i < args.length; i++) {
    if (!/^-(?:exec|execdir|ok|okdir)$/.test(args[i].value)) continue;
    let j = i + 1;
    while (j < args.length && args[j].value !== ';' && args[j].value !== '+') j++;
    const words = args.slice(i + 1, j);
    if (words.length) out.push(resolveEntry(entry.cmd, words, { findExec: true, findRoots: roots }));
    i = j;
  }
  return out;
}

// ———— 巢狀 shell ————

const POSIX_SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'ash', 'mksh']);
const PS_SHELLS = new Set(['pwsh', 'powershell', 'powershell_ise', 'pwsh-preview']);
const joinValues = (words) => words.map((w) => w.value).join(' ');

function posixShellMode(args) {
  for (let i = 0; i < args.length; i++) {
    const v = args[i].value;
    if (v === '-' || v === '-s') return {};
    if (v === '--') return { file: i + 1 < args.length };
    if (/^-[A-Za-z]*c[A-Za-z]*$/.test(v)) {
      for (let j = i + 1; j < args.length; j++) if (!/^[-+][A-Za-z]+$/.test(args[j].value)) return { script: args[j] };
      return {};
    }
    if (['-o', '+o', '-O', '+O', '--rcfile', '--init-file'].includes(v)) { i++; continue; }
    if (/^[-+][A-Za-z]+$/.test(v) || v.startsWith('--')) continue;
    return { file: true };
  }
  return {};
}
const PS_VALUE_PARAMS = ['executionpolicy', 'ex', 'ep', 'workingdirectory', 'wd', 'wo', 'configurationname', 'config', 'custompipename', 'inputformat', 'inp', 'if', 'outputformat', 'o', 'of', 'settingsfile', 'settings', 'version', 'v', 'windowstyle', 'w', 'psconsolefile', 'configurationfile', 'encodedarguments', 'encodeda', 'ea'];
// -Command 之後的所有參數以空白串接成腳本；-EncodedCommand 為 base64 UTF-16LE。
function psShellMode(args) {
  for (let i = 0; i < args.length; i++) {
    const v = args[i].value;
    if (!/^[-/]/.test(v)) {
      if (/\.ps1$/i.test(v)) return { file: true };
      return { text: joinValues(args.slice(i)) };
    }
    const p = v.replace(/^[-/]+/, '').toLowerCase().replace(/:.*$/, '');
    if (p && ('command'.startsWith(p) || p === 'c')) {
      const rest = args.slice(i + 1);
      if (rest.length === 1 && rest[0].value === '-') return { stdin: true };
      return { text: joinValues(rest) };
    }
    if (p === 'e' || p === 'ec' || (p.length >= 3 && 'encodedcommand'.startsWith(p))) {
      const w = args[i + 1];
      if (!w || w.dynamic) return {};
      try { return { text: Buffer.from(w.value, 'base64').toString('utf16le') }; } catch { return {}; }
    }
    if (p === 'f' || (p.length >= 2 && 'file'.startsWith(p))) return { file: true };
    if (PS_VALUE_PARAMS.includes(p)) i++;
  }
  return {};
}
// cmd /c：單一參數時 cmd 會去掉外層引號；多個參數時含空白者保留引號。
const cmdScript = (words) => (words.length === 1 ? words[0].value : words.map((w) => (/\s/.test(w.value) ? `"${w.value}"` : w.value)).join(' '));
// 管線上游餵給 shell 的內容：各字詞、命令參數串接、heredoc 與 here-string 本文都當候選腳本（寧可多解析）。
function upstreamScripts(earlier, pipeline, dialect) {
  const out = [];
  for (const c of earlier) {
    if (c.pipeline !== pipeline) continue;
    for (const h of c.heredocs) out.push({ text: h.body, dialect });
    for (const h of c.herestrings) out.push({ text: h.value, dialect });
    for (const w of c.words) out.push({ text: w.value, dialect });
    if (c.words.length > 2) out.push({ text: joinValues(c.words.slice(1)), dialect });
  }
  return out;
}
function nestedScripts(entry, earlier) {
  const out = [...entry.scripts];
  const { name, args, cmd } = entry;
  const viaStdin = (dialect) => {
    if (entry.findExec) return;
    for (const h of cmd.heredocs) out.push({ text: h.body, dialect });
    for (const h of cmd.herestrings) out.push({ text: h.value, dialect });
    if (cmd.pipeIn) out.push(...upstreamScripts(earlier, cmd.pipeline, dialect));
  };
  if (name && POSIX_SHELLS.has(name)) {
    const mode = posixShellMode(args);
    if (mode.script) out.push({ text: mode.script.value, dialect: 'posix' });
    else if (!mode.file) viaStdin('posix');
  } else if (name && PS_SHELLS.has(name)) {
    const mode = psShellMode(args);
    if (mode.text !== undefined) out.push({ text: mode.text, dialect: 'ps' });
    else if (mode.stdin || (!mode.file && !args.length)) viaStdin('ps');
  } else if (name === 'cmd') {
    const k = args.findIndex((w) => /^\/{1,2}[ck]$/i.test(w.value));
    if (k >= 0) out.push({ text: cmdScript(args.slice(k + 1)), dialect: 'cmd' });
    else if (!args.length) viaStdin('cmd');
  } else if (name === 'eval' && entry.dialect === 'posix') {
    out.push({ text: joinValues(args), dialect: 'posix' });
  } else if (name === 'iex' || name === 'invoke-expression') {
    out.push({ text: joinValues(args.filter((w) => !/^-c(?:o(?:m(?:m(?:a(?:n(?:d)?)?)?)?)?)?$/i.test(w.value))), dialect: 'ps' });
  }
  return out.filter((s) => s.text && s.text.trim());
}

// ———— 入口 ————

function collect(text, dialect, depth, out) {
  if (out.parses++ >= MAX_PARSES) { out.overflow.push(text); return; }
  const ctx = {
    nextPipeline: () => ++out.pipelineSeq,
    sub: (inner, d) => collect(inner, d, depth, out),
  };
  const cmds = dialect === 'ps' ? parsePs(text, ctx) : dialect === 'cmd' ? parseCmd(text, ctx) : parsePosix(text, ctx);
  for (const c of cmds) { c.dialect = dialect; c.depth = depth; }
  cmds.forEach((c, k) => {
    const main = resolveEntry(c);
    for (const entry of [main, ...findExecEntries(main)]) {
      out.entries.push(entry);
      for (const s of nestedScripts(entry, cmds.slice(0, k))) {
        if (depth + 1 > MAX_DEPTH) out.overflow.push(s.text);
        else collect(s.text, s.dialect, depth + 1, out);
      }
    }
  });
}
// 回傳 entries（每個簡單命令的解析結果，含巢狀展開）與 overflow（超過層數或解析次數上限、未展開的腳本文字）。
export function analyzeCommand(text, dialect = 'posix') {
  const out = { entries: [], overflow: [], parses: 0, pipelineSeq: 0 };
  collect(String(text ?? ''), dialect, 0, out);
  return { entries: out.entries, overflow: out.overflow };
}

// git 全域選項與子命令；redirect 收集會改變 repo 或工作樹位置的全域選項。
const GIT_VALUE_OPTS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--attr-source']);
const GIT_REDIRECT_OPT = /^--(?:git-dir|work-tree|super-prefix)(?:=|$)/;
export function gitInvocation(args) {
  const g = { C: [], c: [], configEnv: [], redirect: [], sub: null, subArgs: [] };
  for (let i = 0; i < args.length; i++) {
    const w = args[i], v = w.value;
    if (GIT_REDIRECT_OPT.test(v)) g.redirect.push(v);
    if (GIT_VALUE_OPTS.has(v)) {
      const val = args[i + 1] ?? null;
      if (v === '-C') g.C.push(val);
      else if (v === '-c' && val) g.c.push(val.value);
      else if (v === '--config-env' && val) g.configEnv.push(val.value);
      i++; continue;
    }
    if (v.startsWith('--config-env=')) { g.configEnv.push(v.slice(13)); continue; }
    if (v.startsWith('-')) continue;
    g.sub = w;
    g.subArgs = args.slice(i + 1);
    break;
  }
  return g;
}
