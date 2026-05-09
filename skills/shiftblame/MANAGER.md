# MANAGER — 管理者

管理者由目前 CLI 環境擔任，統一協調：派工、管線、閘門、收尾。

> 管理者直接執行
> 執行者/紅隊/藍隊以子代理派工

## 決策

| # | 輸入 | 處理 |
|---|------|------|
| 1 | 日常操作/文件維護/部署/修復 | 直接執行 |
| 2 | 提問/答詢 | 直接回答 |
| 3 | 功能開發/需求 | 派工管線 |

## 派工

所有部門皆從 001 開始：執行者 result + 紅隊 red + 藍隊 blue。

## 管線

| 閘門 | 條件 |
|:----:|------|
| PRD→QA | result/red/blue → `AskUserQuestion` 老闆確認 |
| QA→DEV | result/red/blue → `AskUserQuestion` 老闆確認 |
| DEV→QC | result/red/blue → `AskUserQuestion` 老闆確認 |
| QC→收尾 | 實際啟動產品，提供 URL/指令/截圖或操作證據 → `AskUserQuestion` 老闆確認現況；通過後收尾並自動歸檔 slug |

## 退回

退回同部門 →  同部門 NNN + 1 修正 。
退回上游部門 → 上游部門 NNN + 1 修正。

## 收尾

QC→收尾閘門通過後，執行收尾檢查 → squash merge 前更新 README.md 和 REPO.md → squash merge → push → 若 workspace=worktree 則刪 worktree → 刪分支 → 搬移 slug 至 .shiftblame/archive/。已確認收尾即直接歸檔 slug，不再詢問是否歸檔；若未通過則退回 DEV 或 QC 新 NNN。

收尾檢查清單：確認無殭屍程序、背景 dev server、測試服務或 watcher；無 scratch/demo/prototype/debug output/臨時設定等開發殘留進入主分支；無非正式測試文件或測試產物進入主分支；無多餘 build artifact、coverage report、log、cache、截圖、錄影、下載檔；`.shiftblame/`、worktree 專用產物（worktree 模式）、本地私密設定不納入版本控制；README.md 與 REPO.md 已反映最終現況。

## task.md / 支援與版本

task.md：YAML frontmatter + 目標 + 上游輸入 + 約束，50 為上限。result.md 含 `[SUPPORT_REQUEST]` → 管理者介入（TOOL→增換工具；ASSIST→代處理），`AskUserQuestion` 向老闆報告。版本 major.minor.build，首次實作升 build，退回修正不重複升版。

## 部署

`sudo -S <command> < <(secret-tool lookup service sudo-pwd)`
