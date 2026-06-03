---
title: GATE/REVERT
---

# 退回觸發條款

各角色退回觸發條件：

| 角色 | 退回觸發條款 |
|------|------------|
| 專案計畫 | 研究結論不足以支撐下游 DEV 建立技術規劃/設計/實作 |
| 產品開發 | 功能不符合規格、存在功能性錯誤。退回時依退回原因分類：規格不足→退回 PM 補充規格，定義問題→退回 PM，實作問題→原地修復。退回前必須先 commit 所有工作變更。 |

## 退回規則（五階段 FAIL 狀態機）

- L1 BossConfirm FAIL：宣告不被接受 → 返回 L1 重新宣告。需 BossConfirm。
- L2 BossConfirm FAIL（result 確認）：老闆要求修改 result.md → 返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm。需 BossConfirm。
- L4 藍隊 FAIL（原地修復）：同角色 NNN 不變，退回 L2 原地修復（EXECUTED），執行者修正 result.md → BossConfirm → L3 紅隊 → L4 藍隊 → L5 結論，直到藍隊 PASS。一個 NNN 可以多次提交。不觸發 DECLARED 狀態轉移，不更新 task.md 宣告段落。採增量攻防（不得刪除既有 red.md / blue.md 紀錄，新回合攻防內容追加在既有紀錄之後，以 `---` 與 `## 第 N 次攻擊` / `## 第 N 次防禦` 分隔），保留完整追溯。
- L4 藍隊 FAIL（打回上游）：問題在上游定義，退回上游修正。上游開新 NNN（新執行切片），上游通過後回到原本被打回的 NNN，從 L1 重新宣告開始。本 NNN 的 L4 FAIL 不需 BossConfirm（上游自行走完整流程）。
- DEV 被退回時必須先 commit 當前所有工作變更，才能執行退回。退回前紅藍隊必須判定退回原因類型：定義問題（PM 需求釐清、產品規格或前端設計有誤）→ 退回 PM；實作問題（功能不符合規格、錯誤、效能）→ 原地修復。管理者向老闆報告退回原因類型與目標角色，經老闆覆核確認後才執行退回。
- L5 BossConfirm FAIL：結論不被接受 → 退回 L1 重新宣告（DECLARED）。需 BossConfirm。
- 同角色新執行切片：PASS 後需要新的工作範圍時建立同角色新 NNN。
- 回溯：撤回該角色所有變更（git 與 .shiftblame/），回到該角色 001 狀態。僅限觸發角色。需 BossConfirm。

## 增量攻防機制

不得刪除既有攻防紀錄；FAIL 重跑時在既有內容後追加新回合（以 `---` 與回合標題分隔）。

## 通用規則

- 計畫不可更動：任何輪次不得更動已 PASSED 的前輪計畫範圍（見 GATE/DECLARE）。
- 恢復：讀取未歸檔的 SLUG.md 恢復該 slug 的工作狀態。不適用已歸檔的 slug。
- 不得自行修改 result.md、red.md 或 blue.md。
- 退回確認必須與閘門確認分離，不得合併。
- 藍隊判定 FAIL 時，歸屬判斷由紅隊攻擊點和藍隊分析共同決定退回目標角色。
