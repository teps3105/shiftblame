#!/usr/bin/env bash
# shiftblame skill trigger prerequisite check
# PreToolUse hook for Skill tool
# Auto-inits .shiftblame/ when missing, handles repo/blank-dir detection

set -euo pipefail

# Only check for shiftblame skill
INPUT=$(cat)
SKILL=$(echo "$INPUT" | jq -r '.skill // empty' 2>/dev/null || true)
if [[ "$SKILL" != *"shiftblame"* ]]; then
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
IS_REPO=0
[[ -n "$REPO_ROOT" ]] && IS_REPO=1

SB_DIR="${REPO_ROOT:-$(pwd)}/.shiftblame"
REPO_MD="$SB_DIR/REPO.md"

# --- .shiftblame/ exists, check REPO.md ---
if [[ -d "$SB_DIR" ]]; then
  if [[ -f "$REPO_MD" ]]; then
    exit 0
  fi
  echo "BLOCK: .shiftblame/ 存在但缺少 REPO.md — 請手動建立"
  exit 2
fi

# --- .shiftblame/ missing ---
WORK_DIR="${REPO_ROOT:-$(pwd)}"

if [[ "$IS_REPO" -eq 1 ]]; then
  # Git repo → auto-init
  mkdir -p "$SB_DIR"
  cat > "$REPO_MD" <<EOF
# REPO — 專案現狀

> 本地私密，不納入版本控制

## 概述


## 技術棧


## 已知問題

EOF
  echo "INIT: 已自動初始化 .shiftblame/ + REPO.md"
  exit 0
fi

# Not a git repo — check if blank dir
FILE_COUNT=$(find "$WORK_DIR" -maxdepth 1 -mindepth 1 | wc -l)

if [[ "$FILE_COUNT" -eq 0 ]]; then
  # Blank dir → git init + auto-init
  git init "$WORK_DIR" >/dev/null 2>&1
  REPO_ROOT="$WORK_DIR"
  SB_DIR="$REPO_ROOT/.shiftblame"
  REPO_MD="$SB_DIR/REPO.md"
  mkdir -p "$SB_DIR"
  cat > "$REPO_MD" <<EOF
# REPO — 專案現狀

> 本地私密，不納入版本控制

## 概述


## 技術棧


## 已知問題

EOF
  echo "INIT: 空目錄 → git init + .shiftblame/ + REPO.md"
  exit 0
fi

# Not a repo, not blank → block
echo "BLOCK: 非 git 倉庫且目錄非空 — 請先執行 git init"
exit 2
