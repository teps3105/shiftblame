# STAFF — 員工呼叫規格

管理者（主 session）協調；執行者/驗證者（子代理）透過 CLI 呼叫。

| 別名 | 角色 | 呼叫路徑 |
|------|------|---------|
| 管理者 | 主 session | 直接執行 |
| 執行者 | 子代理（claude） | Agent 子代理 |
| 驗證者 | 子代理（codex/gemini） | `Bash` + CLI |

## 管理者

主 session，直接執行。需要隔離上下文或並行處理時，執行者以 Agent 子代理派工。

## 執行者（claude 子代理）

```bash
# Agent 子代理派工
Agent(subagent_type="general-purpose", prompt="...")
```

## 驗證者（codex/gemini 子代理）

```bash
# codex
codex exec --dangerously-bypass-approvals-and-sandbox "prompt"
# gemini
GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p "prompt"
```

`--approval-mode` 在 `-p` 之前。`.shiftblame/` 用 `cat` 讀取（`read_file` 拒絕 `.gitignore` 路徑）。

## Prompt 模板

**Result**：讀取 task.md + DEPT/*.md → 依部門定義執行 → 寫入 `<cli>/result.md`。繁體中文產出。

**Review**：讀取 task.md + DEPT/*.md + 執行者 result.md → 依部門定義的紅隊/藍隊面向逐一驗證 → 寫入 `<cli>/review.md`。

所有產出（result.md / review.md）以 50 為上限。

## Poll 流程

1. 管理者（主 session）直接執行；驗證者以 background process 派工
2. 每 30 秒 poll 驗證者 子目錄的 result.md / review.md
3. 管理者產出由管理者直接確認