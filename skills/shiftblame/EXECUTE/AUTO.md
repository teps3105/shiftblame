---
title: EXECUTE/AUTO
---

# AUTO 模式形式定義

自動模式。用於功能開發（預設）、快速迭代、原型驗證。使用功能分支 + worktree 隔離。BossConfirm 由管理者自行判斷品質，不暫停等待老闆。

## 適用情境

功能開發（預設）、快速迭代、原型驗證、小型功能開發。不需老闆指定。

## 形式參數

| 屬性 | 值 |
|------|-----|
| Pass | 2（PM + DEV） |
| 角色序列 | PM → DEV |
| BossConfirm | Auto |
| 分支 | feat/\<slug\> |
| 目錄 | .shiftblame/\<slug\>/\<ROLE\>/\<NNN\>/ |
| worktree | 是 |
| 上游讀取 | 跨角色 CONCLUSION.md |
| MaxIter | ≤2 |

## 管線

PM（含品質定義）→ DEV（含自行驗收）→ PM → DEV → 收尾。PM 和 DEV 各自跑完整 L1→L5。下游讀取上游已 PASSED 的 CONCLUSION.md。

## BossConfirm Auto 規則

管理者自行判斷品質是否足夠進入下一階段：L1 宣告非空→通過；L2 RESULT.md 格式有效→通過；L5 五檔齊全→通過。品質不足原地修正，連續 3 次仍未通過→BLOCK 報告老闆。

## AUTO 派工差異

AUTO 模式下派工操作與標準模式的差異：

- **BossConfirm 自動通過**：派工 prompt 中不包含等待老闆確認的指示；管理者在派工前自行判斷品質是否足夠
- **自動修復閘門**：L4 FAIL 時管理者自動決定原地修復或退回，不需在派工 prompt 中標註等待老闆指示
- **攻防上限**：同一 NNN 最多 3 輪紅藍。第 3 輪 FAIL → 記錄殘餘風險強制通過 L5。強制通過時必須在 CONCLUSION.md 中明確標註殘餘風險
- **迭代上限**：每 slug 最多 PM/002 + DEV/002（2 輪完整迭代）。超限→記錄殘餘問題到 SLUG.md，強制收尾。兩計數器完全獨立運作

## L4 FAIL 退回

僅限 PM↔DEV 之間。退回前先 commit。紅藍隊判定退回原因，老闆覆核：定義問題→退回 PM；實作問題→原地修復（同角色 EXECUTED）。

## 收尾

PASSED → COMMITTED → MERGED → PUSHED → ARCHIVED → UPDATED。步驟：切回主工作目錄 → merge --no-ff → push → worktree remove → branch delete → 歸檔 → 更新 REPO.md/ROADMAP.md。
