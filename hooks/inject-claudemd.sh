#!/bin/sh
# Idempotently inject secretary prompt into ~/.claude/CLAUDE.md
# Uses version markers to support auto-update on plugin upgrade

CLAUDE_MD="$HOME/.claude/CLAUDE.md"
INJECT_BEGIN="# shiftblame-inject:begin"
INJECT_END="# shiftblame-inject:end"
SECRETARY_LINE='使用時執行 `/secretary` 或輸入「開始」即可啟動秘書調度。'

mkdir -p "$HOME/.claude"
touch "$CLAUDE_MD"

# If version markers exist, remove old injected content
if grep -q "$INJECT_BEGIN" "$CLAUDE_MD" 2>/dev/null; then
  # Remove everything between markers (inclusive)
  sed -i "/$INJECT_BEGIN/,/$INJECT_END/d" "$CLAUDE_MD"
fi

# Remove any legacy injection (without markers) that mentions /secretary or 開始
# This handles upgrades from legacy versions
if grep -q '/secretary\|開始.*啟動秘書' "$CLAUDE_MD" 2>/dev/null; then
  # Only remove lines that look like our injection (not user content)
  sed -i '/使用時.*secretary.*啟動秘書/d' "$CLAUDE_MD"
  sed -i '/使用時執行.*secretary.*或輸入/d' "$CLAUDE_MD"
fi

# Inject with version markers
if [ -s "$CLAUDE_MD" ]; then
  echo "" >> "$CLAUDE_MD"
fi
echo "$INJECT_BEGIN" >> "$CLAUDE_MD"
echo "$SECRETARY_LINE" >> "$CLAUDE_MD"
echo "$INJECT_END" >> "$CLAUDE_MD"
