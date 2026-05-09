#!/usr/bin/env bash
# Install/update global CLI entry files for shiftblame.
# Usage: bash ~/.<cli>/skills/shiftblame/scripts/install-global-entrypoints.sh

set -euo pipefail

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
GEMINI_HOME="${GEMINI_HOME:-$HOME/.gemini}"

write_managed_block() {
  local file="$1"
  local label="$2"
  local body="$3"
  local begin="<!-- BEGIN shiftblame:${label} -->"
  local end="<!-- END shiftblame:${label} -->"
  local tmp

  mkdir -p "$(dirname "$file")"
  tmp="$(mktemp)"

  if [[ -f "$file" ]]; then
    awk -v begin="$begin" -v end="$end" '
      $0 == begin { skip = 1; next }
      $0 == end { skip = 0; next }
      skip != 1 { print }
    ' "$file" > "$tmp"
    printf '\n' >> "$tmp"
  fi

  {
    printf '%s\n' "$begin"
    printf '%s\n' "$body"
    printf '%s\n' "$end"
  } >> "$tmp"

  mv "$tmp" "$file"
}

codex_body='
# shiftblame — Codex Global Entry

當目前環境是 Codex CLI，若使用者要求載入推鍋系統、開始、start、開工、動工、go、begin，或要求 multi-agent workflow，必須使用 shiftblame 技能。

技能入口：`~/.codex/skills/shiftblame/SKILL.md`
遵循：`SKILL.md`、`MANAGER.md`、`STAFF.md`、`DEPT/*.md`
可呼叫 scripts：`~/.codex/skills/shiftblame/scripts/*.sh`

角色映射：

| 角色 | CLI | 產出 |
|------|-----|------|
| 管理者 | codex | task.md |
| 執行者 | codex | result.md |
| 紅隊 | claude | red.md |
| 藍隊 | gemini | blue.md |

所有產出使用繁體中文。
'

claude_body='
# shiftblame — Claude Global Entry

當目前環境是 Claude CLI，若使用者要求載入推鍋系統、開始、start、開工、動工、go、begin，或要求 multi-agent workflow，必須使用 shiftblame 技能。

技能入口：`~/.claude/skills/shiftblame/SKILL.md`
遵循：`SKILL.md`、`MANAGER.md`、`STAFF.md`、`DEPT/*.md`
可呼叫 scripts：`~/.claude/skills/shiftblame/scripts/*.sh`

角色映射：

| 角色 | CLI | 產出 |
|------|-----|------|
| 管理者 | claude | task.md |
| 執行者 | claude | result.md |
| 紅隊 | codex | red.md |
| 藍隊 | gemini | blue.md |

所有產出使用繁體中文。
'

gemini_body='
# shiftblame — Gemini Global Entry

當目前環境是 Gemini CLI，若使用者要求載入推鍋系統、開始、start、開工、動工、go、begin，或要求 multi-agent workflow，必須使用 shiftblame 技能。

技能入口：`~/.gemini/skills/shiftblame/SKILL.md`
遵循：`SKILL.md`、`MANAGER.md`、`STAFF.md`、`DEPT/*.md`
可呼叫 scripts：`~/.gemini/skills/shiftblame/scripts/*.sh`

角色映射：

| 角色 | CLI | 產出 |
|------|-----|------|
| 管理者 | gemini | task.md |
| 執行者 | gemini | result.md |
| 紅隊 | claude | red.md |
| 藍隊 | codex | blue.md |

所有產出使用繁體中文。
'

write_managed_block "$CODEX_HOME/AGENTS.md" "codex-entry" "$codex_body"
write_managed_block "$CLAUDE_HOME/CLAUDE.md" "claude-entry" "$claude_body"
write_managed_block "$GEMINI_HOME/GEMINI.md" "gemini-entry" "$gemini_body"

printf 'OK: installed shiftblame global entrypoints\n'
printf -- '- %s\n' "$CODEX_HOME/AGENTS.md" "$CLAUDE_HOME/CLAUDE.md" "$GEMINI_HOME/GEMINI.md"
