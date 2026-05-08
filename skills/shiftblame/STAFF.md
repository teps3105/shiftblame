# STAFF — 員工呼叫規格

| 別名 | 角色 | 呼叫路徑 |
|------|------|---------|
| 管理者 | 主 session | 直接執行 |
| 執行者 | 子代理（claude） | Agent 子代理 |
| 紅隊 | 子代理（codex） | `Bash` + CLI |
| 藍隊 | 子代理（gemini） | `Bash` + CLI |

## 執行者

```bash
# Agent 子代理派工
Agent(subagent_type="general-purpose", prompt="...")
```

## 紅隊 / 藍隊

```bash
# codex（紅隊）
codex exec --dangerously-bypass-approvals-and-sandbox "prompt"
# gemini（藍隊）
GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p "prompt"
```

`--approval-mode` 在 `-p` 之前。`.shiftblame/` 用 `cat` 讀取（`read_file` 拒絕 `.gitignore` 路徑）。

## Worktree 工作規範

所有部門的 Demo、開發、測試等產物一律寫入 `<slug>/worktree/`，不得寫入主分支工作目錄。

- **PRD**：Demo 原型寫入 worktree
- **QA**：測試腳本與測試產物寫入 worktree
- **DEV**：程式碼實作與測試寫入 worktree
- **QC**：驗證腳本與結果寫入 worktree

收尾 squash merge 時，僅合併正式程式碼。Demo 原型、測試腳本、測試產物等不隨 merge 進入主分支。

## Prompt 模板

**Result**：讀取 task.md + DEPT/*.md → 依部門執行者規則執行 → 寫入 `result.md`

**Red**：讀取 task.md + result.md → 依部門紅隊規則攻擊 → 寫入 `red.md`。

**Blue**：讀取 task.md + result.md → 依部門藍隊規則檢視 → 寫入 `blue.md`。

所有產出（task.md / result.md / red.md / blue.md）使用繁體中文產出。