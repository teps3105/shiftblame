#!/usr/bin/env bash
# shiftblame 初始化腳本 — Unix (Bash)
# 設定用戶級 CLAUDE.md（managed block）和用戶級 settings.json（SessionStart compact hook）

set -euo pipefail

claude_dir="$HOME/.claude"
claude_md="$claude_dir/CLAUDE.md"
settings="$claude_dir/settings.json"

managed_begin="<!-- BEGIN shiftblame:global-entry -->"
managed_end="<!-- END shiftblame:global-entry -->"
managed_content="load shiftblame skills. On any shiftblame keyword reload shiftblame skills."
managed_block="${managed_begin}
${managed_content}
${managed_end}"

hook_command="echo load shiftblame skills. On any shiftblame keyword reload shiftblame skills."

# --- CLAUDE.md ---

mkdir -p "$claude_dir"

if [ -f "$claude_md" ]; then
    content=$(cat "$claude_md")

    if echo "$content" | grep -qF "$managed_begin"; then
        echo "[OK] CLAUDE.md 已含 managed block，跳過"
    else
        # 有裸文字 → 遷移為 managed block
        bare="load shiftblame skills. On any shiftblame keyword reload shiftblame skills."
        if echo "$content" | grep -qF "$bare"; then
            content="${content//"$bare"/"$managed_block"}"
            printf '%s' "$content" > "$claude_md"
            echo "[OK] CLAUDE.md 裸文字已遷移為 managed block"
        else
            # 追加 managed block
            if [ -n "$content" ] && [ "${content: -1}" != $'\n' ]; then
                printf '\n' >> "$claude_md"
            fi
            printf '\n%s\n' "$managed_block" >> "$claude_md"
            echo "[OK] CLAUDE.md 已追加 managed block"
        fi
    fi
else
    printf '%s\n' "$managed_block" > "$claude_md"
    echo "[OK] 已建立 CLAUDE.md 並寫入 managed block"
fi

# --- settings.json (SessionStart compact hook) ---

if ! command -v jq &>/dev/null; then
    echo "[WARN] jq 不可用。手動將以下 JSON 片段加入 $settings 的 hooks.SessionStart 陣列："
    echo ""
    echo '{
  "matcher": "compact",
  "hooks": [
    {
      "type": "command",
      "command": "'"$hook_command"'",
      "timeout": 5
    }
  ]
}'
    echo ""
    echo "若 settings.json 不存在，建立新檔並寫入："
    echo '{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "'"$hook_command"'",
            "timeout": 5
          }
        ]
      }
    ]
  }
}'
    exit 0
fi

if [ -f "$settings" ]; then
    # 檢查是否已有 compact hook
    has_compact=$(jq -r '.hooks.SessionStart[]?.matcher // empty' "$settings" | grep -cxF "compact" || true)

    if [ "$has_compact" -gt 0 ]; then
        echo "[OK] settings.json 已含 compact hook，跳過"
    else
        # 追加 compact hook
        tmp=$(mktemp)
        jq '.hooks.SessionStart += [
            {
                "matcher": "compact",
                "hooks": [
                    {
                        "type": "command",
                        "command": "'"$hook_command"'",
                        "timeout": 5
                    }
                ]
            }
        ]' "$settings" > "$tmp" && mv "$tmp" "$settings"
        echo "[OK] settings.json 已追加 compact hook"
    fi
else
    # 建立新 settings.json
    cat > "$settings" <<JSONEOF
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "$hook_command",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
JSONEOF
    echo "[OK] 已建立 settings.json 並寫入 compact hook"
fi

echo ""
echo "初始化完成。CLAUDE.md 和 settings.json 已設定。"
