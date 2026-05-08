#!/usr/bin/env bash
# shiftblame task initializer
# Usage: bash scripts/task-init.sh <slug> <dept> [nnn]
# Creates DEPT/NNN directory and writes task.md template
# If nnn omitted, auto-increments from existing directories

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SB_DIR="$REPO_ROOT/.shiftblame"

slug="${1:?Usage: task-init.sh <slug> <dept> [nnn]}"
dept="${2:?Usage: task-init.sh <slug> <dept> [nnn]}"
# Normalize dept to uppercase
dept=$(echo "$dept" | tr '[:lower:]' '[:upper:]')
nnn="${3:-}"

TASK_BASE="$SB_DIR/$slug/$dept"

# Auto-increment NNN if not provided
if [[ -z "$nnn" ]]; then
  if [[ -d "$TASK_BASE" ]]; then
    last=$(find "$TASK_BASE" -maxdepth 1 -mindepth 1 -type d -name '[0-9]*' | xargs -I{} basename {} | sort -n | tail -1)
    nnn=$(printf '%03d' $((10#${last:-0} + 1)))
  else
    nnn="001"
  fi
fi

# Zero-pad to 3 digits
nnn=$(printf '%03d' $((10#$nnn)))

TASK_DIR="$TASK_BASE/$nnn"

# Prevent overwrite
if [[ -f "$TASK_DIR/task.md" ]]; then
  echo "SKIP: $TASK_DIR/task.md already exists"
  exit 0
fi

mkdir -p "$TASK_DIR"

cat > "$TASK_DIR/task.md" <<TMPL
---
slug: ${slug}
dept: ${dept}
task: ${nnn}
version: 0.1.0
status: pending
created: $(date -Iseconds)
---

# 目標


# 上游輸入


# 約束

TMPL

echo "OK: $TASK_DIR/task.md"
