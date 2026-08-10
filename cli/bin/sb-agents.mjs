#!/usr/bin/env node
// sb-agents — shiftblame 子代理定義安裝 CLI（zcode／claude／codex 三平台）
// 中性定義來源：cli/templates/*.md（frontmatter：name/description/color/sandbox + 正文）
// 依平台轉譯輸出到使用者層 agents 目錄；model 可經 --model 指定，未指定採平台默認語義值。

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

const PLATFORMS = {
  zcode: {
    dir: () => join(homedir(), '.zcode', 'agents'),
    ext: '.md',
    defaultModel: null, // 未指定 model 時省略欄位 = 繼承默認
  },
  claude: {
    dir: () => join(homedir(), '.claude', 'agents'),
    ext: '.md',
    defaultModel: 'inherit',
  },
  codex: {
    dir: () => join(homedir(), '.codex', 'agents'),
    ext: '.toml',
    defaultModel: null, // 未指定 model 時以註解標示配置點
  },
};

const SANDBOX_VALUES = new Set(['read-only', 'workspace-write']);

function parseTemplate(path) {
  const txt = readFileSync(path, 'utf-8');
  const m = txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`模板格式錯誤（缺 frontmatter）：${path}`);
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return { fm, body: m[2].replace(/\n$/, '') };
}

function renderMarkdown(fm, body, model) {
  const lines = [`---`, `name: "${fm.name}"`, `description: "${fm.description}"`, `color: ${fm.color ?? 'blue'}`];
  if (model) lines.push(`model: "${model}"`);
  lines.push(`---`, '');
  return lines.join('\n') + body + '\n';
}

function renderToml(fm, body, model) {
  const inst = body.trim();
  const lines = [
    `name = "${fm.name}"`,
    `description = "${fm.description}"`,
    `sandbox_mode = "${fm.sandbox}"`,
  ];
  if (model) {
    lines.push(`model = "${model}"`);
  } else {
    lines.push(`# model = "<模型 ID>"  # 配置點：安裝時以 --model 指定，未指定＝平台默認`);
  }
  lines.push(`developer_instructions = """`, inst, `"""`, '');
  return lines.join('\n');
}

function render(platform, template, model) {
  const { fm, body } = parseTemplate(template);
  if (platform === 'codex') return renderToml(fm, body, model);
  return renderMarkdown(fm, body, model);
}

function usage() {
  console.log(`sb-agents — shiftblame 子代理定義安裝 CLI

用法：
  sb-agents install [--platform zcode|claude|codex|all] [--model <模型>] [--force]
      將中性定義安裝到各平台使用者層 agents 目錄：
        zcode  → ~/.zcode/agents/*.md
        claude → ~/.claude/agents/*.md
        codex  → ~/.codex/agents/*.toml
      --model 指定模型（所有已安裝檔）；未指定採平台默認語義值
        （zcode 省略欄位＝繼承默認；claude 填 inherit；codex 註解配置點）
      --force 覆蓋已存在檔案；預設已存在則略過
  sb-agents list
      列出各平台已安裝的定義檔
  sb-agents --help`);
}

function listInstalled() {
  for (const [name, p] of Object.entries(PLATFORMS)) {
    const dir = p.dir();
    if (!existsSync(dir)) {
      console.log(`${name}: 無 agents 目錄（${dir}）`);
      continue;
    }
    const files = readdirSync(dir).filter((f) => f.endsWith(p.ext));
    console.log(`${name}: ${files.length ? files.join(', ') : '（空）'} @ ${dir}`);
  }
}

function install(platform, model, force) {
  const templates = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.md')).sort();
  const dir = PLATFORMS[platform].dir();
  mkdirSync(dir, { recursive: true });
  let installed = 0;
  let skipped = 0;
  for (const t of templates) {
    const name = t.replace(/\.md$/, '');
    const outName = name + PLATFORMS[platform].ext;
    const outPath = join(dir, outName);
    if (existsSync(outPath) && !force) {
      console.log(`  略過 ${outName}（已存在，--force 覆蓋）`);
      skipped++;
      continue;
    }
    const content = render(platform, join(TEMPLATES_DIR, t), model ?? PLATFORMS[platform].defaultModel);
    writeFileSync(outPath, content, 'utf-8');
    console.log(`  安裝 ${outName}${model ? `（model: ${model}）` : ''}`);
    installed++;
  }
  console.log(`[${platform}] ${installed} 安裝、${skipped} 略過 @ ${dir}`);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) {
  usage();
  process.exit(0);
}

const cmd = args[0];
if (cmd === 'list') {
  listInstalled();
  process.exit(0);
}
if (cmd !== 'install') {
  console.error(`未知指令：${cmd}`);
  usage();
  process.exit(1);
}

const opt = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const platformArg = opt('--platform') ?? 'all';
const platforms = platformArg === 'all' ? Object.keys(PLATFORMS) : [platformArg];
for (const p of platforms) {
  if (!PLATFORMS[p]) {
    console.error(`不支援的平台：${p}（可用：zcode｜claude｜codex｜all）`);
    process.exit(1);
  }
}
const model = opt('--model');
const force = args.includes('--force');

// 模板完整性預檢
for (const t of readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.md'))) {
  const { fm } = parseTemplate(join(TEMPLATES_DIR, t));
  for (const req of ['name', 'description', 'sandbox']) {
    if (!fm[req]) throw new Error(`模板 ${t} 缺 frontmatter 欄位：${req}`);
  }
  if (!SANDBOX_VALUES.has(fm.sandbox)) throw new Error(`模板 ${t} sandbox 值非法：${fm.sandbox}`);
}

for (const p of platforms) install(p, model, force);
