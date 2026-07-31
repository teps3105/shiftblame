---
description: 繼續之前未完成的 slug/nnn，基於既有 G1~G3 重新確認後重走三權制衡。
argument-hint: [slug/nnn]
---

載入 `shiftblame` skill。本指令用於 session 中斷後恢復既有未完成的工作。主對話 SECRETARY 依 SBM-SKILL §9 讀取脈絡，找出未完成的 `<slug>`／`<nnn>`，基於既有 G1~G3 重新確認後重走三權制衡。

## 觸發後流程

0. **SECRETARY 讀取脈絡**（主對話）：依 §9 依序唯讀 `.shiftblame/SOP.md`、`ROADMAP.md`、`archive/`、未歸檔的 `<slug>`。
1. **找出未完成的 slug/nnn**：
   - 僅一個未完成 → 提議 resume 它。
   - 多個未完成 → 列出供老闆選，**等待老闆指定**後才 resume（提議不等於授權）。
   - 無未完成 → 提示「無未完成 slug，請用 `/sb-next` 開新工作」。
   - 老闆於後標指定（如 `sb-resume feature-auth/002`）→ 直接 resume 指定者。
2. **偵測 loop 授權**：檢查 SLUG §2 是否有 `loop 模式：自主執行至所有 nnn 完成` 記錄。
   - **有 loop 授權** → 恢復自主模式：續跑 `/sb-do`→開發→`/sb-review`→開新 nnn（`/sb-next`）→ ... 直到所有 nnn 完成 → `/sb-docs` → 停止（同 `/sb-loop` 的自主序列）。**跳過以下 step 3-4 的單次重新確認**（自主模式由 loop 授權驅動，不需逐階段重確認）。
   - **無 loop 授權** → 走一般 resume（step 3-4）。
3. **基於既有重新確認 G1~G3**（非清空重寫，無 loop 授權時）：SECRETARY 派發角色子代理，讀取該 `<nnn>` 既有的 G1／G2／G3，逐份確認內容是否仍有效（codebase、需求、技術是否變動）：
   - 仍成立 → 保留。
   - 過時或與當前 codebase 矛盾 → 修正該份（由其主導角色子代理改寫自己文件）。
   - 需求方向已變 → 改用 `/sb-req` 較合適（那是需求層退回，非 resume）。
4. **SECRETARY 核對 §10 一致性**（無 loop 授權時）：三份重新確認後，秘書親自核對兩兩雙向一致（三對六向）；不一致要求對應角色子代理重做，一致後放行進入開發。

## 邊界

- resume 是**恢復既有未完成工作**，不是開新 slug/nnn（那是 `/sb-next`）。
- 重新確認基於既有內容，保留仍成立者，不從零重寫；若既有 G1~G3 已全失效，建議改用 `/sb-req`／`/sb-meth`／`/sb-plan` 或開新 nnn。
- SLUG §3 節點依當前實際狀態標記（resume 後通常回到 `三權制衡（G1↔G2↔G3）` 重走）。

$ARGUMENTS
