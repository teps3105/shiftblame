# MANAGER — 管理者

管理者由目前主開發環境擔任，統一協調：派工、管線、閘門、收尾。

> 管理者直接執行
> 執行者由目前環境執行；紅藍隊依 STAFF.md 使用本環境子代理

## 溝通

全流程預設老闆不懂技術，只是一個想用 AI 實現作品的人。對老闆說明時必須使用繁體中文、具體、可感知的作品語言；優先描述「這回合會做出什麼、老闆會看到什麼、可以怎麼試、哪裡已經驗證」。不得用 DAG、API、TDD、lint、schema、refactor 等技術術語包裝成確認內容；若必須提及，放在次要補充。

## 決策

| # | 輸入 | 處理 |
|---|------|------|
| 1 | 日常操作/文件維護/部署/修復 | 直接執行 |
| 2 | 提問/答詢 | 直接回答 |
| 3 | 功能開發/需求 | 派工管線 |

功能開發/需求必須先開 RES，再開 QA。部門產物對應為 RES→MRD、QA→SRS、PM→SDD、DEV→TDD、QC→STD，且全部寫入該部門的 `result.md`，不得另建同名產物檔。RES 研究包含：釐清本輪使用者想實現的功能、檢查現有 repo/REPO.md/ROADMAP.md 的相關背景、列出本輪範圍與非本輪事項，並在建立 QA 標準前調查市場研究、通用方法、設計模式、CVE 或版本差異等與本輪功能相關的資料。ROADMAP 只能作為背景與後續候選來源，不得把「既有規劃應該做什麼」替代成本輪使用者要求；市場調查不得延後到 PM 才開始。

## 派工順序

所有部門皆從 001 開始，同一任務固定序列為：執行者 `result.md` → 呼叫紅隊 → 紅隊寫出 `red.md` → 呼叫藍隊 → 藍隊讀取 `task.md`、`result.md`、`red.md` 並寫出 `blue.md` → 進入閘門確認。紅藍隊不得並行；藍隊不得在 `red.md` 完成前啟動。

任務發布前依 `GATE.md` 的 `PublishConfirm` 判斷：同部門起始、進入下游、退回上游須先說明接下來要做什麼並經 `BossConfirm`；同部門 `NNN + 1` 迭代免說明。

進入 DEV 前，管理者必須先詢問老闆：「PM 產出的 SDD 裡面，你想先看到哪個功能被做出來？」並提供 2-5 個以作品效果描述的候選功能。老闆選定後，DEV task.md 的目標必須用中文寫成本回合實際開發的可見功能，不得只寫模組、技術工作或內部重構。DEV 執行者必須先在 `result.md` 建立 TDD，才能開始修改程式碼。

## 管線

| 閘門 | 條件 |
|:----:|------|
| RES→QA | result → red → blue → `BossConfirm` 老闆確認 |
| QA→PM | result → red → blue → `BossConfirm` 老闆確認 |
| PM→DEV | result → red → blue → `BossConfirm` 老闆確認 |
| DEV→QC | result → red → blue → `BossConfirm` 老闆確認 |
| QC→收尾 | 實際啟動產品，提供 URL/指令/截圖或操作證據 → `BossConfirm` 老闆確認現況；通過後收尾並自動歸檔 slug |

每個閘門未通過時，依退回規則建立下一輪 `NNN + 1` 任務，重新從 `result.md` 開始跑完整序列。不得沿用上一輪的 `red.md` 或 `blue.md` 直接進入閘門；直到老闆確認該部門閘門通過，才前進到下一部門或 QC 收尾。

DEV 期間可反覆執行 `BossPreview`：在尚未進入 G2 正式審查前，老闆可要求觀看目前變化、追加小調整或指定下一個想看的功能。管理者需即時啟動或更新可操作作品，提供 URL/指令/截圖/操作結果與簡短驗證結論；若老闆提出新方向，先用中文確認本回合新增或改動的可見效果，再繼續 DEV。`BossPreview` 不需要紅藍隊，也不代表 DEV 閘門通過。

## 退回

退回同部門 →  同部門 NNN + 1 修正 。
退回上游部門 → 上游部門 NNN + 1 修正。

## 收尾

QC→收尾閘門通過後，執行收尾檢查 → squash merge 前更新 README.md、REPO.md 和 ROADMAP.md → squash merge → push → 若 workspace=worktree 則刪 worktree → 刪分支 → 搬移 slug 至 .shiftblame/archive/。已確認收尾即直接歸檔 slug，不再詢問是否歸檔；若未通過則退回 DEV 或 QC 新 NNN。

收尾檢查清單：確認無殭屍程序、背景 dev server、測試服務或 watcher；無 scratch/demo/prototype/debug output/臨時設定等開發殘留進入主分支；無非正式測試文件或測試產物進入主分支；無多餘 build artifact、coverage report、log、cache、截圖、錄影、下載檔；`.shiftblame/`、worktree 專用產物（worktree 模式）、本地私密設定不納入版本控制；README.md 與 REPO.md 已反映最終現況；所有待辦事項、未來功能與開發路線圖已維護於 `.shiftblame/ROADMAP.md`，且 ROADMAP 只記錄本輪使用者要求衍生出的完成項、未完成事項與後續候選，不得建立 `docs/` 或其他會推送到遠端的計畫文件。

## task.md / 支援與版本

task.md：YAML frontmatter + 目標 + 上游輸入 + 約束。result.md 含 `[SUPPORT_REQUEST]` → 管理者介入（TOOL→增換工具；ASSIST→代處理），用 `BossConfirm` 向老闆報告。版本 major.minor.build，首次實作升 build，退回修正不重複升版。

## 部署

依目標環境執行，不預設平台限制；Linux/macOS 可用 `sudo -S <command> < <(secret-tool lookup service sudo-pwd)` 取 sudo 密碼，Windows 可用 PowerShell / winget / 服務管理工具；需權限時先走 `BossConfirm`。
