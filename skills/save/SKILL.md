---
name: save
description: 記錄工作落點到 .shiftblame/tmp/，SLUG 只保留狀態與回指，供 shiftblame:resume 核對後接續。
---
# shiftblame:save — 記錄當前 slug 工作落點

> **shiftblame:think 分發目標**：shiftblame:think 理解老闆要存檔記錄後分發至此。位置：在當前任意節點記錄落點到 tmp，SLUG 留回指，供 shiftblame:resume 恢復（不改變節點）。

當老闆要記錄當前工作落點時執行（由 shiftblame:think 分發）。用於顯式記錄當前工作落點到 `<repo>/.shiftblame/tmp/<slug>/handoff.md`，讓其他對話能用 shiftblame:resume 無縫恢復。

先 `load skill: shiftblame`，主對話 秘書 執行：

## 流程

0. **讀取當前狀態**（主對話）：確認當前 slug／ms、SLUG §4 節點、開發進度。
1. **準備交接文件**：將工作落點先寫入 `<repo>/.shiftblame/tmp/<slug>/handoff.pending.md`，保留既有 `handoff.md`；以 3～5 行白話記錄，對象與路徑寫清楚：
   - 正在進行什麼（哪個 ms 的哪個功能／階段）。
   - 做到哪裡（已完成部分、最新 commit）。
   - 下一步是什麼。
   - 待注意事項（若有）。
2. **讀回與替換**：確認暫存文件可讀，slug／ms、階段、commit 與實況相符，再以同目錄原子替換更新 `handoff.md`，讀回正式交接文件。準備或替換失敗時保留原交接、`last_save` 與回指，不能宣稱保存完成；僅清除已由原子替換消費的暫存名，其餘 tmp 材料留存。
3. **更新 SLUG**：僅在正式交接文件讀回成功後，更新 §4 目前節點與最近交付、§8 交接文件路徑，最後設 frontmatter `last_save: <YYYY-MM-DD HH:MM>`，交由 shiftblame:resume 核對後消費。標記更新失敗則保存未完成，resume 仍核對交接與實況。

## 邊界

- shiftblame:save 的寫入範圍＝`<repo>/.shiftblame/tmp/<slug>/` 的交接文件及其寫入暫存，與 SLUG 的 `last_save`、§4 狀態、§8 路徑回指；G1／G2／G3 與產品檔案保持原樣。對話、工作過程與交接敘事只寫 tmp；既有 SLUG 交接敘事先移入 tmp 並讀回，再將原段改為回指。
- shiftblame:save 是**顯式記錄**；即使不執行 shiftblame:save，shiftblame:resume 仍能從 SLUG + G1~G3 恢復部分資訊，但可能遺漏「進行到哪」的細節。shiftblame:save 提供經讀回的落點，resume 仍須核對交接文件與實況。
- 可在任何節點執行，記錄當下落點。
- `last_save` 是**待消費標記**：shiftblame:resume 成功讀取並核對落點後清除它，再接續工作；只有再次 shiftblame:save 才會有新標記。
