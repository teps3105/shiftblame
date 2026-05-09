#!/usr/bin/env bash
# shiftblame slug archiver
# Usage: bash skills/shiftblame/scripts/slug-archive.sh [slug]
# Moves completed slug to .shiftblame/archive/
# If slug omitted, archives the currently active slug

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SB_DIR="$REPO_ROOT/.shiftblame"
ARCHIVE_DIR="$SB_DIR/archive"

if [[ ! -d "$SB_DIR" ]]; then
  echo "SKIP: .shiftblame/ not found"
  exit 0
fi

slug="${1:-}"

# Auto-detect active slug if not provided
if [[ -z "$slug" ]]; then
  slug=$(find "$SB_DIR" -maxdepth 1 -mindepth 1 -type d ! -name archive -exec basename {} \; | head -1)
  if [[ -z "$slug" ]]; then
    echo "SKIP: no active slug found"
    exit 0
  fi
fi

SLUG_DIR="$SB_DIR/$slug"

if [[ ! -d "$SLUG_DIR" ]]; then
  echo "ERROR: slug '$slug' not found in .shiftblame/" >&2
  exit 1
fi

# Verify branch is gone (skip if not a git repo or branch arg unavailable)
branch_name=$(git -C "$REPO_ROOT" worktree list 2>/dev/null | grep "$slug" | awk '{print $3}' || true)
if [[ -n "$branch_name" ]] && git -C "$REPO_ROOT" rev-parse --verify "$branch_name" &>/dev/null; then
  echo "WARN: branch '$branch_name' still exists — archive anyway? (y/N)" >&2
  read -r confirm
  [[ "$confirm" =~ ^[yY] ]] || { echo "ABORT"; exit 1; }
fi

# Handle name collision in archive
dest="$ARCHIVE_DIR/$slug"
if [[ -d "$dest" ]]; then
  ts=$(date +%Y%m%dT%H%M%S)
  dest="$ARCHIVE_DIR/${slug}_${ts}"
  echo "NOTE: '$slug' already archived — renaming to '${slug}_${ts}'"
fi

mkdir -p "$ARCHIVE_DIR"
mv "$SLUG_DIR" "$dest"

echo "OK: $slug → archive/$slug"
