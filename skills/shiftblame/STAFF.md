# STAFF — 員工呼叫規格

| 別名 | 角色 | 呼叫路徑 |
|------|------|---------|
| 管理者 | 主 session | 直接執行 |
| 執行者 | 子代理（claude） | Agent 子代理 |
| 驗證者 | 子代理（codex/gemini） | Agent 子代理 呼叫 `Bash` + CLI |

## 執行者

```bash
# Agent 子代理派工
Agent(subagent_type="general-purpose", prompt="...")
```

## 驗證者

```bash
# codex
codex exec --dangerously-bypass-approvals-and-sandbox "prompt"
# gemini
GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p "prompt"
`--approval-mode` 在 `-p` 之前。`.shiftblame/` 用 `cat` 讀取（`read_file` 拒絕 `.gitignore` 路徑）。
```

## Prompt 模板

**Result**：讀取 task.md + DEPT/*.md → 依部門定義執行 → 寫入 `<cli>/result.md`。繁體中文產出。

**Review**：讀取 task.md + DEPT/*.md + 執行者 result.md → 依部門定義的紅隊/藍隊面向逐一驗證 → 寫入 `<cli>/review.md`。

所有產出（result.md / review.md）以 50 為上限。
