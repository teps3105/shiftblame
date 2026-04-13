const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const MANIFEST_NAME = ".shiftblame-manifest.json";

const isGlobal = Boolean(
  process.env.npm_config_global === "true" ||
    process.env.npm_config_prefix ===
      execSync("npm config get prefix -g", { encoding: "utf8" }).trim()
);

let dest;
if (isGlobal) {
  dest = path.join(require("os").homedir(), ".claude");
} else {
  dest = path.join(findProjectRoot(process.cwd()), ".claude");
}

const manifestPath = path.join(dest, MANIFEST_NAME);

if (!fs.existsSync(manifestPath)) {
  console.log("shiftblame: 未找到安裝紀錄，跳過清理");
  process.exit(0);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (_) {
  console.log("shiftblame: 安裝紀錄損毀，跳過清理");
  process.exit(0);
}

// 1. 刪除所有追蹤的檔案
let removed = 0;
for (const file of manifest.files || []) {
  const filePath = path.join(dest, file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    removed++;
  }
}

// 2. 清理空目錄（不刪除 .claude/ 本身）
cleanEmptyDirs(dest, dest);

// 3. 刪除 manifest
if (fs.existsSync(manifestPath)) {
  fs.unlinkSync(manifestPath);
}

console.log(`shiftblame: 已移除 ${removed} 個檔案`);
console.log("shiftblame: 反安裝完成（已保留 .claude/ 目錄）");

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

function cleanEmptyDirs(dir, stopAt) {
  if (dir === stopAt || !fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir);
    if (entries.length === 0) {
      fs.rmdirSync(dir);
      cleanEmptyDirs(path.dirname(dir), stopAt);
    }
  } catch (_) {}
}
