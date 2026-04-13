const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const pkg = require("../package.json");

const src = path.join(__dirname, "..", ".claude");
const MANIFEST_NAME = ".shiftblame-manifest.json";

const isGlobal = Boolean(
  process.env.npm_config_global === "true" ||
    process.env.npm_config_prefix ===
      execSync("npm config get prefix -g", { encoding: "utf8" }).trim()
);

let dest, installType;
if (isGlobal) {
  dest = path.join(require("os").homedir(), ".claude");
  installType = "global";
} else {
  dest = path.join(findProjectRoot(process.cwd()), ".claude");
  installType = "local";
}

// 1. 讀舊 manifest
const manifestPath = path.join(dest, MANIFEST_NAME);
let oldFiles = [];
if (fs.existsSync(manifestPath)) {
  try {
    const old = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    oldFiles = old.files || [];
  } catch (_) {}
}

// 2. 掃描 src 建立新檔案清單
const newFiles = [];
function collectFiles(dir, base) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + "/" + entry.name : entry.name;
    if (entry.name === MANIFEST_NAME) continue;
    if (entry.isDirectory()) {
      collectFiles(path.join(dir, entry.name), rel);
    } else {
      newFiles.push(rel);
    }
  }
}
if (fs.existsSync(src)) {
  collectFiles(src, "");
}

// 3. 清理舊版殘留（在新版中已不存在的檔案）
const newSet = new Set(newFiles);
const staleFiles = oldFiles.filter((f) => !newSet.has(f));
for (const file of staleFiles) {
  const filePath = path.join(dest, file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
// 清理空目錄
cleanEmptyDirs(dest, dest);

// 4. 複製新檔案
copyRecursive(src, dest);

// 5. 寫入新 manifest
const manifest = { version: pkg.version, type: installType, files: newFiles };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// 6. 輸出
const label = isGlobal ? "user 級別" : "repo 級別";
console.log(`shiftblame: ${label}安裝完成 → ${dest}/`);
if (staleFiles.length > 0) {
  console.log(`shiftblame: 已清除 ${staleFiles.length} 個舊版殘留檔案`);
}
console.log("shiftblame: 請在目標 repo 中執行 /blame-init 初始化鍋目錄");

// --- helpers ---

function findProjectRoot(dir) {
  let current = dir;
  while (current !== path.dirname(current)) {
    if (
      fs.existsSync(path.join(current, "package.json")) &&
      current !== path.join(__dirname, "..")
    ) {
      return current;
    }
    current = path.dirname(current);
  }
  return process.env.INIT_CWD || process.cwd();
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function cleanEmptyDirs(dir, stopAt) {
  if (dir === stopAt || !fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir);
  if (entries.length === 0) {
    fs.rmdirSync(dir);
    cleanEmptyDirs(path.dirname(dir), stopAt);
  }
}
