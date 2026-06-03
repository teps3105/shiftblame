# MODE — FEATURE

討論確認模式。用於需老闆明確指定討論確認的功能開發。使用功能分支 + worktree 隔離。BossConfirm 需老闆手動確認。

## 適用情境

需老闆明確指定討論確認的功能開發。非預設模式。

## 形式參數

| 屬性 | 值 |
|------|-----|
| Pass | 2（PM + DEV） |
| 部門序列 | PM → DEV |
| BossConfirm | Manual |
| 分支 | feat/\<slug\> |
| 目錄 | .shiftblame/\<slug\>/\<ROLE\>/\<NNN\>/ |
| worktree | 是 |
| 上游讀取 | 跨部門 CONCLUSION.md |

## 管線

PM（含品質定義）→ DEV（含自行驗收）→ PM → DEV → 收尾

PM 和 DEV 各自跑完整 L1→L5。下游讀取上游已 PASSED 的 CONCLUSION.md。

## 品質定義分配

- **PM**：品質定義、測試標準、驗收條件、GWT 測試案例（Given-When-Then）
- **DEV**：自行驗收（依 PM 品質標準逐條確認）、功能驗證、邊界測試

## RESULT.md

目標導向，不要求固定格式。

## BossConfirm Manual 規則

- L1/L2/L5：需老闆明確回覆通過、退回或調整
- 管理者不得自行假設通過

## 與 AUTO 的差異（否定性定義）

FEATURE 模式**不具備**以下 AUTO 模式的限制機制：

- 無攻防上限（紅藍攻防不設 3 輪上限）
- 無迭代上限（不設 PM/002 + DEV/002 限制）
- 無自動修復閘門（L4 FAIL 處理不自動決定，需管理者+老闆判定）
- 無品質不足連續計數機制
- 無強制收尾（不設迭代上限觸發的強制收尾）

## L4 FAIL 退回

僅限 PM↔DEV 之間。退回前先 commit。紅藍隊判定退回原因，老闆覆核：

- **定義問題**（需求、規格或前端設計有誤）→ 退回 PM
- **實作問題**（功能不符、錯誤、效能）→ 原地修復（同部門 EXECUTED）

## 管線推進

每輪 PASSED 後管理者詢問老闆「繼續迭代或收尾」。

## 退回

- L1 BossConfirm FAIL → 返回 L1 重新宣告
- L2 BossConfirm FAIL → DECLARED（更新宣告段落，重走確認）
- L4 Blue FAIL（原地修復）→ EXECUTED，修復後 BossConfirm → L3→L4→L5
- L4 Blue FAIL（退回對方）→ 退回前先 commit，紅藍隊判定原因，老闆覆核
- L5 BossConfirm FAIL → 退回 L1 重新宣告
- 回溯 → 撤回該 slug 所有變更，回到 001

## 收尾

PASSED → COMMITTED → MERGED → PUSHED → ARCHIVED → UPDATED

步驟：切回主工作目錄 → merge --no-ff → push → worktree remove → branch delete → 歸檔 → 更新 REPO.md/ROADMAP.md。

## 開新對話

每個 slug 完成收尾後，管理者輸出完成摘要並建議老闆開啟新對話。新對話恢復流程：讀取 ROADMAP.md → REPO.md → 前一個歸檔 slug 的 SLUG.md → PRD 再掃描。
