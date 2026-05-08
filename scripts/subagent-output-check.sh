#!/usr/bin/env bash
# shiftblame sub-agent output validation
# PostToolUse hook for Agent and Bash tools
# Validates that sub-agent outputs were written correctly

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SB_DIR="$REPO_ROOT/.shiftblame"

# Skip if not in shiftblame context
[[ -d "$SB_DIR" ]] || exit 0

# Read tool input to determine context
INPUT=$(cat)

# Find latest task directory
SLUG=$(find "$SB_DIR" -maxdepth 1 -mindepth 1 -type d ! -name archive | sort -r | head -1)
[[ -n "$SLUG" ]] || exit 0

LATEST_TASK=$(find "$SLUG" -maxdepth 3 -mindepth 3 -type d | sort -r | head -1)
[[ -n "$LATEST_TASK" ]] || exit 0

# Check for recently created output files (within last 60s)
NOW=$(date +%s)
for f in result.md red.md blue.md; do
  if [[ -f "$LATEST_TASK/$f" ]]; then
    MTIME=$(stat -c %Y "$LATEST_TASK/$f" 2>/dev/null || echo 0)
    AGE=$(( NOW - MTIME ))
    if [[ $AGE -lt 60 ]]; then
      SIZE=$(stat -c %s "$LATEST_TASK/$f" 2>/dev/null || echo 0)
      echo "OK: $f ($SIZE bytes, ${AGE}s ago)"
    fi
  fi
done

exit 0
