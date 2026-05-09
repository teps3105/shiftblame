#!/usr/bin/env bash
# shiftblame pre-dispatch check
# PreToolUse hook for Agent tool
# Ensures task.md exists before dispatching sub-agent

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SB_DIR="$REPO_ROOT/.shiftblame"

# Skip if not in shiftblame context
[[ -d "$SB_DIR" ]] || exit 0

# Read tool input
INPUT=$(cat)

# Find active slug
SLUG=$(find "$SB_DIR" -maxdepth 1 -mindepth 1 -type d ! -name archive | sort -r | head -1)
[[ -n "$SLUG" ]] || exit 0

# Find latest task directory (pending = no result.md yet)
PENDING=$(find "$SLUG" -maxdepth 3 -mindepth 3 -type d | while read -r d; do
  if [[ ! -f "$d/result.md" && -f "$d/task.md" ]]; then
    echo "$d"
  fi
done | sort -r | head -1)

# If there's a pending task with task.md, all good
if [[ -n "$PENDING" ]]; then
  exit 0
fi

# Check for task dirs without task.md (needs init)
NO_TASK=$(find "$SLUG" -maxdepth 3 -mindepth 3 -type d | while read -r d; do
  if [[ ! -f "$d/task.md" ]]; then
    echo "$d"
  fi
done | sort -r | head -1)

if [[ -n "$NO_TASK" ]]; then
  slug_name=$(basename "$(dirname "$(dirname "$NO_TASK")")")
  dept_name=$(basename "$(dirname "$NO_TASK")")
  task_num=$(basename "$NO_TASK")
  echo "BLOCK: task.md 不存在 — 請先執行: bash skills/shiftblame/scripts/task-init.sh $slug_name $dept_name $task_num"
  exit 2
fi

exit 0
