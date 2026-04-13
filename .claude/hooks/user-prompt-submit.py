#!/usr/bin/env python3
"""UserPromptSubmit hook: 老闆說話就路由到秘書。"""
import json
import sys

# 這些是 meta 操作 / Claude Code 自身功能，不需要路由到秘書
SKIP_PATTERNS = [
    "/help", "/clear", "/compact", "/model", "/fast",
    "/hooks", "/cost", "/status", "/doctor", "/logout",
    "/init", "/plans", "/tasks", "/memory", "/loop",
    "/schedule", "/review", "/simplify",
    "keybinding", "按鍵", "快捷鍵",
    "Claude Code", "claude code",
]

def main():
    data = json.load(sys.stdin)
    user_input = data.get("user_prompt", "")
    session_id = data.get("session_id", "")

    # 空 input 不處理
    if not user_input.strip():
        print(json.dumps({"continue": True}))
        return

    # 檢查是否為 meta 操作
    for pattern in SKIP_PATTERNS:
        if pattern.lower() in user_input.lower():
            print(json.dumps({"continue": True}))
            return

    # 檢查是否已經是 /secretary 命令
    if user_input.strip().startswith("/secretary"):
        print(json.dumps({"continue": True}))
        return

    # 檢查是否為純粹的 git 操作（查看狀態、看 log 等）
    git_only = user_input.strip().startswith(("git ", "!git "))
    if git_only and len(user_input.strip()) < 80:
        print(json.dumps({"continue": True}))
        return

    # 其他所有訊息 → 路由到秘書
    print(json.dumps({
        "systemMessage": "此訊息應透過 SECRETARY agent 路由。請使用 Skill(\"secretary\") 或 Agent(subagent_type=\"SECRETARY\") 啟動秘書，將老闆原話作為 prompt 傳入。不要自己直接處理。",
        "continue": True
    }))

if __name__ == "__main__":
    main()
