#!/bin/bash
# ==============================================================================
# shiftblame PreToolUse Hook: Intercept Memory Write
# ------------------------------------------------------------------------------
# 攔截 Write tool 寫入 memory 路徑的行為，導向秘書確認老闆需求 → MIS 派工流程。
# ==============================================================================

# 從 stdin 讀取 JSON (Claude Code PreToolUse hook 格式)
# 格式範例: {"tool_name": "Write", "tool_input": {"file_path": "/home/user/.claude/memory/...", ...}}
INPUT=$(cat)

# 簡易解析 tool_name (不依賴 jq)
TOOL_NAME=$(echo "$INPUT" | sed -n 's/.*"tool_name": *"\([^"]*\)".*/\1/p')

if [ "$TOOL_NAME" = "Write" ]; then
    # 簡易解析 file_path
    FILE_PATH=$(echo "$INPUT" | sed -n 's/.*"file_path": *"\([^"]*\)".*/\1/p')
    
    # 判斷是否為 memory 相關路徑
    if [[ "$FILE_PATH" == *".claude/memory"* ]] || [[ "$FILE_PATH" == *"claude memory"* ]]; then
        echo "======================================================================" >&2
        echo "【shiftblame 警告】偵測到自動 memory 寫入行為。" >&2
        echo "請透過 /secretary 或 MIS 派工流程處理框架核心變更，以維持共識機制。" >&2
        echo "======================================================================" >&2
    fi
fi

exit 0
