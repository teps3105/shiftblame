# MANAGE — 調度與交接

管理者負責調度、收斂（含執行變更）、閘門、歸檔。slug 鏈限主 repo；.shiftblame/ 本地不入 repo；非持久產出放 .shiftblame/tmp/。讀寫中文須 UTF-8。

## 調度流程

1. START：驗證上游產出→載入租約（slug：三層 SOP｜SLUG §7｜SKILL+GATE+MANAGE+EXPERIENCE 技能定義檔；簡易：僅 SOP）→揭露目標→**暫停等老闆確認**
2. 讀取未歸檔 SLUG.md → 掌握 slug 狀態（簡易模式不適用）
3. 呈現理解到的意圖→與老闆溝通確認（含模式選擇：slug 或簡易）（入口 FAIL 回此步）
4. 計畫（G1）：正方多子代理多視角提案→反方多子代理多視角質疑→管理者收斂（變更僅限 .shiftblame/ 範圍）
5. 開發（G2）：正方多子代理多視角提案→反方多子代理多視角質疑→管理者收斂（含 TDD 紀律實作+提交）。G2 為 NNN 迭代出口：FAIL→開新 NNN；PASS→交接給體驗者
6. 體驗（體驗者階段）：管理者交接→等待→收到 FEATURE.md→品質確認→收尾。體驗者獨立產出 FEATURE.md，管理者不介入。改善建議→SOP 未完成項目；BUG→ROADMAP 已知問題；下一步→ROADMAP 後續計畫
7. 收尾：管理者提交文件更新→老闆 PASSED→合併→推送→清理→歸檔至 .shiftblame/archive/
8. END：呈現收斂+下一步方向→老闆確認。Slug 走收尾；簡易結束
9. L0 前：檢視交接摘要

**調度策略**：管理者依任務複雜度決定子代理數量、視角、是否盲獨立。策略在調度時動態決定，不定義在正反方職責中。

## 簡易模式流程

老闆指定簡易→START（載入租約→揭露目標→暫停等老闆確認，**不可跳過**）→正方多子代理多視角提案→反方多子代理多視角質疑→管理者收斂（含執行變更）→老闆 PASS→管理者在 main commit（**僅 repo 檔案；.shiftblame/ 不入 repo**）→結束。同角色分工，不開 slug、不開分支、無 G(n).md、無歸檔。觸發權在老闆。FAIL 以收斂為基線增量增加。

## 流程操作

產物完整性：出口前驗證 G(n).md 正文非空。建立 slug：`mkdir -p .shiftblame/<slug>/001` + `git checkout -b feat/<slug>`。簡易模式不適用。Commit：G2 收斂後提交；體驗者不提交；收尾時管理者提交文件更新；簡易 PASS 後管理者在 main 執行。G1 變更僅限 `.shiftblame/` 範圍。歸檔：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`。EXPERIENCE.md 位於技能根目錄（位階等同 MANAGE.md），定義體驗者產出規範。

## 分支保護與會話紀律

Slug 管線 agent 走 `feat/<slug>`，main 由老闆操作。簡易模式管理者在 main 操作（老闆授權）。各 NNN 變更獨立，合併僅於收尾時執行。依 SOP 會話由老闆自由管理。管理者不應以變更規模質疑流程成本。
