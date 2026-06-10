---
name: shiftblame
description: "AI Agents 協作框架。UTF-8。回饋即意圖，不直接執行。二出口×正→反→收斂辯論＋體驗者獨立產出。"
---
# shiftblame — AI Agents 協作框架

正反回饋迴圈框架。雙模式：slug 管線 + 簡易模式。會話由老闆自由管理。
1. **回饋即意圖**：老闆每次說話即觸發意圖揭露，管理者必須先揭露理解到的意圖，確認後才執行
2. **SOP 約束**：可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
3. **PRD/PID 筆記本**：老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈
4. **先提案再質疑**：G1/G2 各三輪辯論；體驗者階段獨立產出 FEATURE.md
5. **迭代收斂**：管理者以最後收斂為基線增量增加

## 啟動序列

每次觸發**僅載入索引層**，按需讀取所需檔案。依序：
1. **未歸檔偵測**：掃描 `.shiftblame/` 下未歸檔 SLUG.md
2. **四文件載入**：REPO.md → ROADMAP.md → SOP.md → GRAPH.md
3. **Repo 狀態**：git log、status、branch
4. **租約載入**：slug 管線載入三層租約（SOP｜SLUG §7｜SKILL+GATE+MANAGE+EXPERIENCE 皆技能定義檔 skills/shiftblame/）；簡易模式僅載入 SOP（長期）。若長期未載入回入口閘門 FAIL
5. **模式判斷**：老闆確認時指定 slug 管線或簡易模式。簡易模式同角色分工但不開 slug、不開分支、無 G(n).md，直接在 main commit。

## 觸發

`/shiftblame <文字>` 啟動序列→呈現意圖（含模式：slug 管線或簡易）→確認→分流。`/shiftblame`（無參數）呈現未歸檔清單供選擇或提議新 slug。觸發後不直接執行，呈現意圖須含執行模式，由老闆決定。

## 出口迴圈

**Slug 管線**：G1(計畫)→G2(開發 NNN)→體驗者獨立完成(FEATURE.md)→管理者收尾。G1/G2 各三輪辯論；體驗者階段獨立產出。G2 為 NNN 迭代出口，收斂後提交；體驗者不提交；收尾時管理者提交文件更新。管理者全程在線，體驗者階段職責：交接→等待→收到 FEATURE.md→品質確認→收尾。閘門→GATE.md；角色→ROLE/；管理→MANAGE.md；體驗→EXPERIENCE.md；模板→TEMPLATES/（皆技能定義檔 skills/shiftblame/）。分支 `feat/<slug>`。
**簡易模式**：START（不可跳過）→正方多子代理多視角提案→反方多子代理多視角質疑→管理者收斂（含執行變更）→老闆 PASS→管理者在 main commit（僅 repo 檔案）。同角色分工，不開 slug、不開分支、無 G(n).md。觸發權在老闆。
