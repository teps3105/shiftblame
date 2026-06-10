# GATE — 閘門與收尾

1. **回饋即意圖**：老闆每次說話即觸發意圖揭露，管理者必須先揭露理解到的意圖，確認後才執行
2. **SOP 約束**：可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
3. **先提案再質疑**：G1/G2 各三輪辯論；體驗者階段獨立產出 FEATURE.md
4. **迭代收斂**：管理者以最後收斂為基線增量增加
5. **雙模式分流**：slug 管線走 `feat/<slug>`；簡易模式管理者在 main 操作（老闆授權）
6. **多子代理多視角**：G1/G2 正方/反方皆使用多子代理進行多觀點作業。G1 變更僅限 `.shiftblame/` 範圍

Slug 狀態序：PLANNED→DEVELOPED→EXPERIENCED→PASSED。G2（DEVELOPED）為 NNN 迭代出口；體驗者獨立產出 FEATURE.md；管理者收尾確認。簡易狀態序：PROPOSED→QUESTIONED→CONVERGED→PASSED。FAIL 以收斂為基線增量增加。

## 閘門生命週期

**Slug START**：驗證上游→載入三層租約（SOP｜SLUG §7｜SKILL+GATE+MANAGE+EXPERIENCE 皆技能定義檔 skills/shiftblame/）→揭露目標→**暫停等老闆確認**。
**Slug END**：呈現管理者收斂+下一步→老闆 PASS/FAIL。G2 為 NNN 迭代出口，收斂後提交；體驗者不提交；收尾時管理者提交文件更新。反方 H/M/L 標註，不做決策。
**體驗者交接**：G2 PASS→管理者驗證 FEATURE.md 空殼已建立→交接給體驗者→體驗者獨立完成→交回管理者→品質確認→收尾。
**簡易 START**：載入 SOP（長期租約）→揭露目標→**暫停等老闆確認**。不可跳過。
**簡易 END**：呈現管理者收斂→老闆 PASS→管理者在 main commit（僅 repo 檔案；.shiftblame/ 不入 repo）。FAIL 增量增加正→反→收斂。

## 收尾

Slug 管線：G2 為 NNN 迭代出口→收斂後提交→體驗者獨立完成 FEATURE.md→管理者品質確認→老闆 PASSED→收尾（確認→合併→推送→清理→歸檔至 .shiftblame/archive/）。回歸規則：改善建議→SOP 未完成項目；BUG→ROADMAP 已知問題；下一步→ROADMAP 後續計畫。簡易模式：PASS→commit（僅 repo 檔案）→結束。
