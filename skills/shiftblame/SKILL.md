---
name: shiftblame
description: "AI Agents 協作框架。UTF-8。回饋即意圖，不直接執行。四出口×正→反→收斂三輪辯論。"
---
# shiftblame — AI Agents 協作框架

正反回饋迴圈框架。雙模式：slug 管線 + 簡易模式。會話由老闆自由管理。
1. **回饋即意圖**：老闆回饋為意圖確認素材，僅供當前對話參考與意圖揭露使用
2. **SOP 約束**：可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
3. **PRD/PID 筆記本**：老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈
4. **先提案再質疑**：正方提案→反方質疑→管理者收斂（含執行變更），四出口各三輪辯論
5. **迭代收斂**：管理者以最後收斂為基線全部重跑

## 啟動序列

每次觸發**僅載入索引層**，按需讀取所需檔案。依序：
1. **未歸檔偵測**：掃描 `.shiftblame/` 下未歸檔 SLUG.md
2. **四文件載入**：REPO.md → ROADMAP.md → SOP.md → GRAPH.md
3. **Repo 狀態**：git log、status、branch
4. **租約載入**：slug 管線載入三層租約（SOP｜SLUG §7｜SKILL+GATE+MANAGE 皆技能定義檔 skills/shiftblame/）；簡易模式僅載入 SOP（長期）。若長期未載入回入口閘門 FAIL
5. **模式判斷**：老闆確認時指定 slug 管線或簡易模式。簡易模式同角色分工但不開 slug、不開分支、無 G(n).md，直接在 main commit。

## 觸發

`/shiftblame <文字>` 啟動序列→呈現意圖（含模式：slug 管線或簡易）→確認→分流。`/shiftblame`（無參數）呈現未歸檔清單供選擇或提議新 slug。觸發後不直接執行，呈現意圖須含執行模式，由老闆決定。

## 出口迴圈

**Slug 管線**：G1→G2→G3→G4，每出口正方提案→反方質疑→管理者收斂（含執行變更）。閘門→GATE.md；角色→ROLE/；管理→MANAGE.md；模板→TEMPLATES/（皆技能定義檔 skills/shiftblame/）。分支 `feat/<slug>`。
**簡易模式**：START（不可跳過）→正方提案→反方質疑→管理者收斂（含執行變更）→老闆 PASS→管理者在 main commit（僅 repo 檔案）。同角色分工，不開 slug、不開分支、無 G(n).md。觸發權在老闆。
