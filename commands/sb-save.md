---
description: 記錄當前 slug 工作落點到 SLUG.md，供其他對話用 /sb-resume 無縫恢復。
---

載入 `shiftblame` skill。本指令用於**顯式記錄當前工作落點**到 SLUG.md，讓使用者在其他對話（session）能用 `/sb-resume` 無縫回到工作。只更新 SLUG.md 本身，不建立額外快照檔。

## 觸發後流程

0. **SECRETARY 讀取當前狀態**（主對話）：確認當前 `<slug>`／`<nnn>`、SLUG §3 節點、開發進度（正在做哪個功能、做到哪、下一步）。
1. **寫入 `last_save` 標記**：在 SLUG frontmatter 設 `last_save: <YYYY-MM-DD HH:MM>`（標記此存檔點待 `/sb-resume` 消費）。
2. **更新 SLUG §3 目前節點表**：確認「節點」「最近交付」欄反映當前實際狀態（如 `開發` + 正在做的功能與 commit）。
3. **更新 SLUG §7 交接摘要**：以 3～5 行白話記錄當前工作落點：
   - 正在進行什麼（哪個 nnn 的哪個功能／階段）。
   - 做到哪裡（已完成的部分、最新 commit）。
   - 下一步是什麼（接下來該做什麼）。
   - 待注意事項（若有）。

## 邊界

- sb-save **只更新 SLUG.md**（frontmatter `last_save` + §3 節點 + §7 交接摘要），不建立快照檔、不動 G1／G2／G3 內容、不動 repo。
- sb-save 是**顯式記錄**；即使不執行 sb-save，`/sb-resume` 仍能從 SLUG + G1~G3 恢復部分資訊，但可能遺漏「進行到哪」的細節。sb-save 確保落點完整，讓 resume 無縫接續而非重確認。
- sb-save 可在任何節點執行（三權制衡／開發／證據／三者重審等），記錄當下落點。
- `last_save` 是**待消費標記**：`/sb-resume` 讀取後接續工作並清除它；只有再次 sb-save 才會有新標記。
- 若有 loop 授權（§2 記錄），sb-save 保留該記錄不覆蓋（resume 需讀取它恢復自主模式）。
