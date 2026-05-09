#!/usr/bin/env bash
# shiftblame gate prerequisite validation
# PreToolUse hook for AskUserQuestion
# Validates result.md, red.md, blue.md exist before gate confirmation

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SB_DIR="$REPO_ROOT/.shiftblame"

# Skip if not in shiftblame context
[[ -d "$SB_DIR" ]] || exit 0

# Find active slug (most recently modified)
SLUG=$(find "$SB_DIR" -maxdepth 1 -mindepth 1 -type d ! -name archive | sort -r | head -1)
[[ -n "$SLUG" ]] || exit 0

# Find latest department task with result.md (indicates gate is active)
GATE_DIR=$(find "$SLUG" -name "result.md" -printf '%h\n' 2>/dev/null | sort -r | head -1)
[[ -n "$GATE_DIR" ]] || exit 0

# Check gate files
MISSING=()
for f in result.md red.md blue.md; do
  [[ -f "$GATE_DIR/$f" ]] || MISSING+=("$f")
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "WARN: 閘門檔案不齊全 — 缺少: ${MISSING[*]}"
  echo "路徑: $GATE_DIR"
  # Exit 0 to allow, but warn; exit 2 to block
  exit 2
fi

exit 0
