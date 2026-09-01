---
name: sb-resume
description: 繼續之前未完成的 slug/ms，基於既有 G1~G3 重新核對後接續工作。
---
# sb-resume — 繼續未完成的 slug/ms

> **sb-think 分發目標**：sb-think 理解老闆要恢復未完成工作後分發至此。位置：從任何中斷點恢復 → 依短帳本接續，必要時基於既有 G1~G3 重新核對。

當老闆要恢復未完成工作時執行（由 sb-think 分發）。用於 session 中斷後恢復既有未完成的工作。

先 `load skill: shiftblame`，主對話 秘書依 SKILL §9 讀取脈絡，再執行：

## 流程

0. **秘書讀取脈絡**（主對話）：依 §9 依序唯讀 `<repo>/.shiftblame/SOP.md`、`<repo>/.shiftblame/ROADMAP.md`、`<repo>/.shiftblame/archive/`、未歸檔的 `<slug>`。
1. **找出未完成的 slug/ms**：
   - 僅一個未完成 → 提議 resume 它。
   - 多個未完成 → 列出供老闆選，**等待老闆指定**後才 resume（提議不等於授權）。
   - 無未完成 → 提示「無未完成 slug，請透過 sb-think 開新工作」。
   - 老闆指定 → 直接 resume 指定者。
2. **偵測 sb-save 落點**：檢查 SLUG frontmatter 是否有 `last_save`。
   - **有 `last_save`** → **接續工作**（不重問確認）：讀 SLUG §8 交接摘要的工作落點，直接從記錄的「下一步」繼續（如落點在 `開發` 則續跑開發、在 `三面向制衡` 則從未完成的面向續跑）。**清除 `last_save` 標記**（存檔點已消費）。跳過 step 3-4。
   - **無 `last_save`** → 落點不明，走重新核對（step 3-4）。
3. **基於既有重新核對 G1~G3**（非清空重寫，不向老闆重問）：先讀 `flow-state.json`。若目前 ms 已有 `g1Contract`，MUST 先核對 G1 hash，且 G1 保持封存；codebase 差異只能作為可行性證據，不能反向改義需求。依承載歸屬重新核對其餘文件：
   - 仍成立 → 保留。
   - G2／G3 過時但仍 CONFORMS → 對應面向單調細化。
   - G1 hash 偏離、契約不足或衝突 → 停止；以 `tmp/amendment.md` 記錄原條款／新條款／影響範圍，經老闆確認後 `回 intent（sb next intent）`，不得直接改 G1。
4. **秘書核對 §10 一致性**：三份重新核對後，秘書親自核對兩兩雙向一致（三對六向）；不一致要求對應階段重做，一致後放行進入開發。

## 邊界

- resume 是**恢復既有未完成工作**，不是開新 slug 或開新 ms（開新 ms＝老闆「開新 ms」授權＋sb next intent --new-ms 留痕，由 sb-think 分發）。
- **二層判斷**：`last_save` 標記（接續落點）→ 無標記（重新核對 G1~G3）。有 `last_save` 時接續不重問確認，消費後清除標記。
- 重新核對（無 `last_save` 時）基於既有內容，保留仍成立者，不從零重寫；已放行 G1 的任何語意變更都走顯式修約（SKILL §1.4.1），不以 resume 繞過契約鎖定。
- SLUG §4 節點依當前實際狀態標記。
