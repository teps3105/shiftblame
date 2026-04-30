#!/bin/sh
# Idempotently inject secretary prompt into ~/.claude/CLAUDE.md

CLAUDE_MD="$HOME/.claude/CLAUDE.md"
SECRETARY_LINE='使用時每個 session 開始執行 \`/secretary\` 啟動秘書調度。'

mkdir -p "$HOME/.claude"
touch "$CLAUDE_MD"

if grep -q '/secretary' "$CLAUDE_MD" 2>/dev/null; then
  exit 0
fi

if [ -s "$CLAUDE_MD" ]; then
  echo "" >> "$CLAUDE_MD"
fi
echo "$SECRETARY_LINE" >> "$CLAUDE_MD"
