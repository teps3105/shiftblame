# DEV — 開發部門（L2 + L3 + L4）

開發部門。execution_model: lead_executor。claude 固定主執行者獨佔 worktree，codex/gemini 固定監督者。

## 監督者面向

| 監督者 | 面向 |
|--------|------|
| codex | 邏輯正確性 + 測試覆蓋度（靜態分析、邏輯分支、邊界條件） |
| gemini | 功能完整性 + 規格一致性（PRD 需求覆蓋、端到端完整性） |

## 產出

路徑：`.shiftblame/<slug>/DEV/<NNN>/`

- `claude/result.md` — 實作成果（檔案清單、測試結果、啟動驗證、commit hash）
- `codex/review.md` — 從邏輯正確性面向檢視
- `gemini/review.md` — 從功能完整性面向檢視

## 規則

- 依 PRD DAG 按模組拓撲順序實作：DB → 後端 → 前端
- TDD 至全綠（unit + integration），全綠後實際啟動驗證
- DAG 標示為 QC 可操作的介面完整實作
- Commit 前語法檢查（parse check / lint）

## 管理者 E2E 閘門（DEV→QC）

監督者 review 通過後，管理者實際啟動應用以使用者身份端到端操作（Web SPA 用 chrome-devtools-mcp）。通過後 `clarify()` 呈報老闆覆核，確認後推進 QC。QC 退回 DEV 修正後需再次 E2E + 老闆覆核。
