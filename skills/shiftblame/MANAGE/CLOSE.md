---
title: MANAGE/CLOSE
---

# CLOSE — 收尾操作

PM/DEV 皆 PASSED 且老闆確認後，執行收尾流程：

merge --no-ff（保留 commit 歷史，禁止 squash）→ push → worktree remove → branch delete → 歸檔（搬移 slug 至 archive/）→ 從 archive/ 中讀取 SLUG.md 並更新 REPO.md 和 ROADMAP.md。

## 收尾檢查清單

- 確認無殭屍程序、背景 dev server、測試服務或 watcher
- 無 scratch/demo/prototype/debug output/臨時設定等開發殘留
- 無多餘 build artifact、coverage report、log、cache、截圖、錄影、下載檔
- 臨時檔案應存放於 `.shiftblame/tmp/`（由老闆自行清理，非管理者責任）
- `.shiftblame/`、本地私密設定不納入版本控制
- 開發中的筆記、臨時待辦、預覽回饋與退回原因只維護於 `.shiftblame/<slug>/SLUG.md`
- `.shiftblame/ROADMAP.md` 只在歸檔後更新為穩定產品路線圖：記錄實際完成結果與後續候選，不得當成工作日誌
- README.md 已在產品開發任務中更新並通過紅藍隊審查
- 確認 worktree 已移除（`git worktree list` 不再出現）
- 確認功能分支已刪除（`git branch` 不再出現）
- 確認主工作目錄在 main 分支且乾淨

## PRD 固化

收尾後若消耗了 PRD，執行 PRD 固化流程（提取已實作驗證的設計決策生成 SOP 文件至 `.shiftblame/SOP/`，記錄狀態至 `.shiftblame/PRD/STATUS.md`）。

## 業務拓樑圖更新

若使用 GRAPH.md，在收尾後更新執行序列狀態與進度統計。

## 開新對話提示

收尾完成後，管理者輸出提示訊息：「本 slug 已完成收尾。建議開啟新對話繼續下一個工作。」管理者停止處理下一個 slug 的工作。
