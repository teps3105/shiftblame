# MODE — AUTO

自動模式（原 RAPID）。用於功能開發（預設）、快速迭代、原型驗證。使用功能分支 + worktree 隔離。BossConfirm 由管理者自行判斷品質，不暫停等待老闆。

## 適用情境

功能開發（預設）、快速迭代、原型驗證、小型功能開發。不需老闆指定。

## 形式參數

| 屬性 | 值 |
|------|-----|
| Pass | 2（PM + DEV） |
| 部門序列 | PM → DEV |
| BossConfirm | Auto |
| 分支 | feat/\<slug\> |
| 目錄 | .shiftblame/\<slug\>/\<ROLE\>/\<NNN\>/ |
| worktree | 是 |
| 上游讀取 | 跨部門 CONCLUSION.md |

## 管線

PM（含品質定義）→ DEV（含自行驗收）→ PM → DEV → 收尾

PM 和 DEV 各自跑完整 L1→L5。下游讀取上游已 PASSED 的 CONCLUSION.md。

## 執行模板

AUTO 模式使用 TEMPLATE/RAPID.md 作為預定執行序列驅動。

## 品質定義分配

- **PM**：品質定義、測試標準、驗收條件、GWT 測試案例（Given-When-Then）
- **DEV**：自行驗收（依 PM 品質標準逐條確認）、功能驗證、邊界測試

## RESULT.md

目標導向，不要求固定格式。專注於「本輪達成什麼、怎麼驗證」。

## BossConfirm Auto 規則

管理者自行判斷品質是否足夠進入下一階段：

- **L1**：TASK.md「## 宣告」段落非空，包含本輪目標與預期產出 → 通過
- **L2**：RESULT.md 包含完整工作成果，格式有效 → 通過
- **L5**：CONCLUSION.md 包含最終結論，五檔齊全且格式有效 → 通過
- **品質不足**：原地修正（不算迭代次數、不算退回），連續 3 次原地修正仍未通過 → BLOCK 報告老闆

## L4 FAIL 退回

僅限 PM↔DEV 之間。退回前先 commit。紅藍隊判定退回原因，老闆覆核：

- **定義問題**（需求、規格或前端設計有誤）→ 退回 PM
- **實作問題**（功能不符、錯誤、效能）→ 原地修復（同部門 EXECUTED）

## 上限

- **攻防上限**：同一 NNN 最多 3 輪紅藍。第 3 輪 FAIL → 記錄殘餘風險強制通過 L5。**強制通過時必須在 CONCLUSION.md 中明確標註殘餘風險**
- **迭代上限**：每 slug 最多 PM/002 + DEV/002（2 輪完整迭代）。超限 → 記錄殘餘問題到 SLUG.md，強制收尾
- 兩計數器完全獨立運作

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
