---
name: sb-dice
description: 丟棄當前 slug 所有成果（重大方向錯誤），回 main，不 archive，重新討論需求。
---
# sb-dice — 丟棄當前 slug，重新討論需求

當使用者要求「丟棄這個 slug」「方向全錯重來」「sb-dice」時執行本 prompt。用於重大方向錯誤時，丟棄當前 slug 所有成果，回 main，不 archive，重新討論需求。

先 `load skill: shiftblame`，主對話 SECRETARY 執行：

## 流程

0. **確認意圖**（主對話）：老闆主動要求即表達丟棄意圖。秘書揭示將丟棄的範圍（當前 slug 的分支、commit、`.shiftblame/<slug>/`），請老闆確認。
1. **切回 main**：`git checkout main`。
2. **刪除分支**：`git branch -D <type>/<slug>`（強制刪除，commit 一併消失）。
3. **刪除 slug 文件**：刪除 `.shiftblame/<slug>/`。**不 archive**——archive 是成功歸檔，dice 是失敗丟棄。
4. **重新討論需求**：回到意圖揭露狀態（§2），與老闆重新討論需求方向。

## 邊界

- sb-dice 是**不可逆丟棄**——分支 commit 與 slug 文件刪除後無法經框架恢復（僅 git reflog 期限內可救）。執行前 MUST 揭示範圍並取得確認。
- **不 archive**：archive 保留成功歷史；dice 是方向錯誤的清除，不留軌跡。
- 撤銷範圍限當前 slug 的分支與文件；不影響 main 已 merge 成果、不影響已 archive slug。
- 適用**重大方向錯誤**（整個 slug 走偏）；單一 nnn 錯誤用重大例外遷移（SKILL §1.4.1）退回即可。
