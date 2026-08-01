---
name: sb-req
description: 開發途中強制停止並回 G1 重新確認需求；方向錯誤的 commit 由主對話 SECRETARY 用 reset 回退（判決性工作）。
---
# sb-req — 開發途中回 G1 重新確認需求

當使用者要求「回 G1」「重新確認需求」「方向錯了要重來」時執行本 prompt。用於**開發途中**發現需求方向錯誤，強制回到當前 `<nnn>` 的三權制衡。

先 `load skill: shiftblame`，再執行：

## 流程

1. **停止開發**：凍結當前進行中的開發工作，不再推進新 commit。
2. **SLUG 節點回退**：將 SLUG §3 目前節點改回 `三權制衡（G1↔G2↔G3）`（SKILL §6）。
3. **G1 重新確認**（AUDITOR 主導）：重新審視並定稿 G1 需求；G2／G3 待 G1 定稿後由 RESEARCHER／DEVELOPER 重寫以重新兩兩一致（判準見 SKILL §10）。
4. **commit 方向判定**（G1 定稿後，主對話 SECRETARY 主導——判決性工作不交子代理）：逐個比對開發途中已 commit 的工作與新 G1 方向：
   - **符合新方向** → 保留，作為新循環的既有基礎。
   - **偏離新方向** → `git reset` 回退（用 reset 非 revert：方向錯誤的嘗試不留反向 commit 噪音，保持線性歷史）。

## 邊界

- 本 prompt 只判定與觸發流程，**不自動執行 git 操作**；實際 reset 由主對話 SECRETARY 逐個判定後執行——判決性工作不交子代理（SKILL §3、§5）。
- 撤銷範圍限於**當前 `<nnn>`** 的開發途中工作；不回退其他 `<nnn>` 或已 PASS 歸檔的成果。
- 是否回退、回退哪些 commit，一律以**重新確認後的 G1 需求方向**為判定基準。
