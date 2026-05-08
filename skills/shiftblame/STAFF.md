# STAFF — 員工呼叫規格

claude 直接執行或 Agent 子代理；codex 與 gemini 透過 CLI 呼叫，僅承擔研究與監督。

| 別名 | 角色 | 呼叫路徑 |
|------|------|---------|
| claude | 主執行者 | 直接執行或 Agent 子代理 |
| codex | 研究者 + 監督者 | `Bash` + `codex exec` |
| gemini | 研究者 + 監督者 | `Bash` + `gemini -p` |

## claude

所有角色（秘書/管理者/開發者/驗證者）由當前 session 直接執行。需要隔離上下文或並行處理時使用 Agent 子代理。

## codex

```bash
codex exec --dangerously-bypass-approvals-and-sandbox "prompt"
```

PTY 模式（Bash 帶 `pty: true` 環境變數）。exit_code 124 偶發。pipe 到 tail/head 會卡死（64KB buffer）。

## gemini

```bash
# 一般派工
GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p "prompt"
# 含框架定義檔
GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text \
  --include-directories="<定義檔路徑>" -p "prompt"
```

`--approval-mode` 在 `-p` 之前。`.shiftblame/` 用 `cat` 讀取（`read_file` 拒絕 `.gitignore` 路徑）。

## Prompt 模板（codex/gemini 適用）

所有產出檔案（proposal.md / result.md / review.md / conclusion.md）以 50 行為上限，超過的部分排入下個 NNN 的 task.md。

**Proposal**：讀取 task.md + DEPT 定義檔 → 分析 → 寫入 `<cli>/proposal.md`（claude 用 Write/Edit；codex/gemini 用原生 write_file）。繁體中文產出。

**Review**：讀取 task.md + conclusion.md + 主執行者 result.md → 從自身面向逐一驗證 → 寫入 `<cli>/review.md`。
- codex 面向：邏輯正確性 + 測試覆蓋度
- gemini 面向：功能完整性 + 規格一致性

## Poll 流程

1. claude 直接執行；codex/gemini 以 background process 派工
2. 每 30 秒 poll codex/gemini 子目錄的 proposal.md / review.md
3. claude 產出由管理者直接確認
