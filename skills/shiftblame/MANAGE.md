# MANAGE — 管理者協調與操作

管理者負責正反調度、閘門、歸檔。讀寫含中文文件須指定 UTF-8。

## 隔離與操作

**slug 鏈範圍僅限主 repo**。`.shiftblame/` 本地運行時，不入 repo、不進 slug 鏈。
目錄結構詳 TEMPLATES/SLUG.md。PRD/PID：老闆的筆記本。SOP：皆可更新，建立與修改皆需意圖揭露。

## 正反調度

計畫行為：決定發散子代理數量與視角（掃描 slug 目標、變更範圍、REPO.md 現狀），盲獨立運行，管理者收斂為 plan-r1.md。
開發行為：管理者提出子代理數量與策略，正方執行實作。
驗收行為：決定審計維度（覆蓋率/一致性），盲獨立運行，管理者彙整為 conclusion-r1.md。
辯論行為：G3 PASS 後自動調度 R6 正方 DEBATE。管理者閱讀 debate-r2 + objection-r2，以白話寫 3~5 行辯論總結，寫入 SLUG.md 辯論總結欄位（G4 閘門前，僅一次）。
行為內部 R1↔R2 自動推進，管理者不需介入。僅行為出口閘門由管理者提交老闆確認。

## 流程操作

**產物完整性**：行為出口前驗證 R1/R2 產物已寫入且正文非空。不符 → BLOCK。
建立 slug：`mkdir -p .shiftblame/<slug>/001` + `git checkout -b feat/<slug>`
新 NNN：同 slug 複用 `feat/<slug>` 分支，開新目錄
Commit：開發行為出口 PASS 後管理者執行 `git add <變更> && git commit`（禁止 force-add .shiftblame/）
歸檔：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`
清理：合併後刪除 `feat/<slug>` 分支

## 分支保護

**main**：僅限老闆手動。**feat/<slug>**：agent 所有變更走此分支，收尾合併。**NNN=Commit**：開發 PASS 後才 commit，每 NNN 恰好一個。

## 觸發流程

1. 讀取或搜尋未歸檄 SLUG.md → 掌握 slug 狀態
2. 呈現理解到的意圖 → 與老闆溝通確認
3. 計畫行為：掃描環境 → 提出子代理策略 → 正方發散 → 反方質疑
4. 歸屬判定：驗收 PASS → 辯論（強制）→ G4 決策；行為出口 FAIL → 回同行為重計數
5. 辯論行為：R6 DEBATE → R7 OBJECTION → R6 DEBATE → R7 OBJECTION → 管理者白話總結 → G4 閘門
6. 上下文延續：同行為內 R2 讀 R1 產出；跨行為以 SLUG.md 為樞紐

## NNN 語義差異

驗收後 FAIL 的 NNN：修正既有品質問題，方向不變。辯論後 G4 的 NNN：基於辯論結論的新方向。兩者皆從計畫行為重跑，但觸發動機不同。

## 會話紀律

依 SOP.md 會話由老闆自由管理原則，NNN 迭代期間建議不開新對話（老闆可因 token 限制或 session 超時自由決定）。
