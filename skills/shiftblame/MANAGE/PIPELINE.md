---
title: MANAGE/PIPELINE
---

# PIPELINE — 管線閘門表

## 閘門定義

| 閘門 | 條件 |
|:----:|------|
| 專案計畫→產品開發 | 宣告 → BossConfirm → result.md → BossConfirm（result 確認）→ 紅隊 → 藍隊 → conclusion.md → Check（五檔）→ CHECKED → BossConfirm → PASSED |
| 產品開發→專案計畫 | 宣告 → BossConfirm → result.md → BossConfirm（result 確認）→ 紅隊 → 藍隊 → conclusion.md → Check（五檔）→ CHECKED → BossConfirm → PASSED |
| PM/DEV→收尾 | 老闆確認成品滿意 → merge --no-ff → push → worktree remove → branch delete → 歸檔 → 更新 REPO.md/ROADMAP.md |
| 合併→歸檔 | merge --no-ff 完成 → push 完成 → 功能分支已刪除 → 歸檔 |
| 歸檔→更新 | 管理者從 archive/ 讀取 SLUG.md 並更新 REPO.md/ROADMAP.md |
| 老闆強制停止 | 選項 A（commit 後強制收尾）/ 選項 B（全部捨棄） |

## 派工順序

所有角色皆從 001 開始，同一任務固定序列：L1 宣告 → BossConfirm → L2 執行者寫入 result.md → BossConfirm → L3 紅隊攻擊 red.md → 管理者驗證 → L4 藍隊 blue.md → 管理者驗證 → L5 管理者寫入 conclusion.md → Result Check（五檔齊全）→ CHECKED → BossConfirm → PASSED。

紅藍隊不得並行；藍隊不得在 red.md 完成前啟動。L2 BossConfirm 不通過時返回 DECLARED，更新 task.md 宣告段落後重新流程。L4 藍隊 FAIL 退回 L2 原地修復（EXECUTED），修復後 BossConfirm → L3→L4→L5，採增量攻防（新回合追加在既有紀錄之後，不得刪除原始攻防紀錄）。L5 BossConfirm FAIL 退回 L1 重新宣告。L1 即為計畫宣告，L1↔L2 迭代循環直到老闆滿意才進入紅藍。

## 上游讀取規則

所有角色讀取指令時，預設讀取所有上游角色的所有已 PASS 的 conclusion.md：
- PM 為第一角色，無上游，僅讀 SLUG.md + task.md + REPO.md + ROADMAP.md
- DEV → 讀 PM 所有已 PASS 的 conclusion.md（PM 結論含品質標準與驗收條件）

管理者在派工時應檢查 `.shiftblame/PRD/` 與 `.shiftblame/SOP/` 中是否有相關文件，一併提供給對應角色。派工時提供上游所有已 PASS 的 conclusion.md 完整內容，預設一律提供全文，僅在超出派工 prompt 可容納範圍時才提供摘要。摘要最低保留欄位：每段結論的核心判定。

## 合併衝突處理

- 文件衝突（README.md 等）→ 管理者直接解決，不需重新走退回流程
- 程式碼邏輯衝突 → 中止 merge，FAIL 原地修復 DEV，解決衝突後重新走收尾流程

## 老闆強制停止

- **選項 A**：commit 後強制收尾。跳過尚未完成的管線步驟，先清理確認無殘留 → merge --no-ff → push → worktree remove → branch delete → 歸檔 → 更新 REPO.md/ROADMAP.md
- **選項 B**：全部捨棄。放棄功能分支上的所有變更
