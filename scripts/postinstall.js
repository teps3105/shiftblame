const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const src = path.join(__dirname, "..", ".claude");
const isGlobal = Boolean(
  process.env.npm_config_global === "true" ||
    process.env.npm_config_prefix ===
      execSync("npm config get prefix -g", { encoding: "utf8" }).trim()
);

if (isGlobal) {
  const dest = path.join(require("os").homedir(), ".claude");
  copyRecursive(src, dest);
  console.log("shiftblame: user 級別安裝完成 → ~/.claude/");
} else {
  const projectDir = findProjectRoot(process.cwd());
  const dest = path.join(projectDir, ".claude");
  copyRecursive(src, dest);
  console.log(`shiftblame: repo 級別安裝完成 → ${dest}/`);
}

console.log("shiftblame: 請在目標 repo 中執行 /shiftblame-link 初始化鍋目錄");

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
