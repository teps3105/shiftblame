# MANAGE — 調度與交接

管理者負責調度、閘門、歸檔。slug 鏈限主 repo；.shiftblame/ 本地不入 repo；非持久產出放 tmp。讀寫中文須 UTF-8。

## 調度流程

1. START：驗證上游產出 → 載入三層租約（SOP｜SLUG §7｜SKILL+GATE+MANAGE）→ 揭露目標 → **暫停等待老闆確認**
2. 讀取未歸檔 SLUG.md → 掌握 slug 狀態
3. 呈現理解到的意圖 → 與老闆溝通確認（入口 FAIL 回此步）
4. 計畫（G1）：子代理盲獨立發散 → 管理者收斂為 G1.md 正方段
5. 開發（G2）：管理者提出策略 → 正方執行實作
6. 驗收（G3）：管理者決定審計維度 → 盲獨立運行 → 管理者彙整為 G3.md
7. 展望（G4）：G4 START 重載租約 → 正→反→收斂 → 更新 README+四文件+PRD/PID+交接摘要+提交 → 收尾或暫停
8. END：呈現收斂 + 下一步方向 → 老闆確認
9. L0 前：檢視交接摘要

## 流程操作

產物完整性：出口前驗證 G(n).md 正文非空。建立 slug：`mkdir -p .shiftblame/<slug>/001` + `git checkout -b feat/<slug>`。新 NNN：複用分支，開新目錄。Commit：G4 PASS 後管理者執行，僅 add repo 變更檔案。歸檔：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`。

## 分支保護

main 由老闆操作。agent 所有變更走 `feat/<slug>`。各 NNN 變更獨立，合併僅於收尾時執行。每 NNN 恰好一個 commit。

## 會話紀律

依 SOP 會話由老闆自由管理。NNN 迭代期間建議不開新對話。老闆開 NNN 即為流程決策，管理者不應以變更規模質疑流程成本。
