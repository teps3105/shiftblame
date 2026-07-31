---
description: 丟棄當前 slug 所有成果（重大方向錯誤），回 main，不 archive，重新討論需求。
---

載入 `shiftblame` skill。本指令用於**重大方向錯誤**時，丟棄當前 `<slug>` 的所有成果——回到 main、刪除分支與 slug 文件、**不 archive**，然後重新討論需求。與 `/sb-end`（成功完成的收尾歸檔）對立：dice 是失敗丟棄，不留痕跡。

## 觸發後流程

0. **SECRETARY 確認意圖**（主對話）：老闆主動呼叫即表達丟棄意圖。秘書揭示將丟棄的範圍（當前 slug 的分支、commit、`.shiftblame/<slug>/`），請老闆確認。
1. **切回 main**：`git checkout main`。
2. **刪除分支**：`git branch -D <type>/<slug>`（強制刪除，分支上的 commit 一併消失）。
3. **刪除 slug 文件**：刪除 `.shiftblame/<slug>/` 目錄。**不移至 `archive/`**——archive 是成功完成的歸檔，dice 是失敗丟棄，兩者語意不同。
4. **重新討論需求**：回到 SECRETARY 意圖揭露狀態（§2），與老闆重新討論需求方向。

## 邊界

- sb-dice 是**不可逆的丟棄**——分支 commit 與 slug 文件刪除後無法經由框架恢復（僅能靠 git reflog 在期限內救回）。SECRETARY MUST 在執行前明確揭示丟棄範圍並取得老闆確認。
- **不 archive**：archive 保留成功完成的歷史脈絡供未來參考；dice 是方向錯誤的清除，不留失敗軌跡。
- 撤銷範圍限於當前 `<slug>` 的分支與文件；不影響 main 上已 merge 的其他成果、不影響已 archive 的 slug。
- 適用於**重大方向錯誤**（整個 slug 走偏）；若只是單一 nnn 的需求/技術/計畫錯誤，用 `/sb-req`／`/sb-meth`／`/sb-plan` 退回對應權即可，不需丟棄整個 slug。
