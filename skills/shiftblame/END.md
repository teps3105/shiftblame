# END — 流程結束

## 1. 收尾確認

所有角色皆 PASSED 且老闆確認後，執行收尾：

- 無殭屍程序、背景 dev server、測試服務
- 無開發殘留進入主分支
- 臨時檔案在 `.shiftblame/tmp/`
- `.shiftblame/` 不納入版本控制
- README.md 已更新並通過紅藍隊審查（開發任務中）

## 2. 合併

- FEATURE/AUTO：切回 main → `git merge --no-ff feat/<slug>`（禁止 squash）
- DOC/MAIN：已在 main，無需 merge
- 合併衝突：文件衝突管理者直接解決；程式碼衝突中止 merge、FAIL 修復

## 3. 推送

`git push` 到遠端。

## 4. 清理

- FEATURE：`git branch -d feat/<slug>`
- AUTO：`git worktree remove .worktrees/<slug>` → `git branch -d feat/<slug>`
- DOC/MAIN：無需清理

驗證：`git worktree list`（AUTO）、`git branch`、主工作目錄在 main 且乾淨。

## 5. 歸檔

`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`

同名 slug 已存在 → 附加時間戳 `<slug>_<YYYYMMDDTHHMMSS>`。

## 6. 更新 REPO.md + ROADMAP.md

管理者從 `archive/<slug>/SLUG.md` 提取：

- **REPO.md**：加入已完成功能、架構變更（「完成了什麼」）
- **ROADMAP.md**：加入後續計畫、已知問題、待改進項目（「未來預計做什麼」）
- 兩份文件語意不可交叉

## 7. PRD 固化（若適用）

若消耗了 PRD，提取已實作驗證的設計決策生成 SOP 至 `.shiftblame/SOP/`。

## 8. 業務拓樑圖更新（若使用）

若 `.shiftblame/GRAPH.md` 存在，更新執行序列狀態與進度統計。

## 9. 開新對話

輸出完成摘要。建議老闆開啟新對話。停止處理下一個 slug。新對話恢復：ROADMAP.md → REPO.md → 前一歸檔 SLUG.md。
