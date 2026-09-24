---
name: save
description: 將工作落點保存到 .shiftblame/tmp/，核對成功後更新 SLUG 回指，供後續接續。
---
# 保存工作落點

依 [主技能](../shiftblame/SKILL.md) 核對 repo、slug／ms、階段、工作樹與最近 commit。記錄已完成、未完成、下一步、阻塞及必要來源，篇幅依交接需要；授權仍以使用者指示為準。

先寫入 `.shiftblame/tmp/<slug>/handoff.pending.md`，讀回並核對實況，再以同目錄原子替換更新 `handoff.md`。失敗時保留舊交接及標記。正式檔讀回成功後，更新 SLUG §4 狀態與 §8 回指，最後設定 `last_save`。

保存範圍限於交接與其回指，維持既有階段、G1 契約及產品檔案。直接實作的工作可只保存 tmp 交接。恢復時以正式文件、工作樹及實際狀態核對交接內容。
