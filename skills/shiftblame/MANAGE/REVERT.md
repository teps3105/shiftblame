---
title: MANAGE/REVERT
---

# REVERT — 退回處理

## 五階段 FAIL 狀態機

- **L1 BossConfirm FAIL** → 宣告不被接受，返回 L1 重新宣告。需 BossConfirm
- **L2 BossConfirm FAIL**（result 確認）→ 老闆要求修改 result.md，返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm。需 BossConfirm
- **L4 藍隊 FAIL（原地修復）** → 同角色 NNN 不變，退回 L2 原地修復（EXECUTED），執行者修正 result.md → BossConfirm → L3→L4→L5，直到藍隊 PASS。採增量攻防（不得刪除既有 red.md / blue.md 紀錄，新回合追加在既有紀錄之後）。L4 FAIL 修復後 BossConfirm FAIL 仍留在 EXECUTED 繼續修改
- **L4 藍隊 FAIL（打回上游）** → 問題在上游定義，上游開新 NNN，上游通過後回到被打回的 NNN 從 L1 重新宣告開始。本 NNN 的 L4 FAIL 不需 BossConfirm（上游自行走完整流程）
- **L5 BossConfirm FAIL** → 結論不被接受，退回 L1 重新宣告。需 BossConfirm
- **同角色新執行切片** → PASS 後需要新的工作範圍時建立同角色新 NNN
- **回溯** → 撤回該角色所有變更，回到 001。需 BossConfirm

## DEV 退回規則

DEV 被退回時必須先 commit 當前所有工作變更，才能執行退回。退回前紅藍隊必須判定退回原因類型：
- **定義問題**（PM 需求釐清、產品規格或前端設計有誤）→ 退回 PM
- **實作問題**（功能不符合規格、錯誤、效能）→ 原地修復

管理者向老闆報告退回原因類型與目標角色，經老闆覆核確認後才執行退回。

## 計畫更動判定

任何輪次發現需要更動已 PASSED 的前輪計畫時，管理者判定是否屬於計畫更動（功能範圍增減、架構決策變更）。若是，提供老闆兩選項：
- **回溯**：撤回該角色所有變更（git 與 .shiftblame/），回到該角色 001 狀態重新規劃。僅限觸發角色，不影響其他已通過閘門的角色。需 BossConfirm
- **進路線圖**：將更動項目記錄至 ROADMAP.md，不在本輪執行
