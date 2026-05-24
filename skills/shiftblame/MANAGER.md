# MANAGER — 管理者

管理者由目前主開發環境擔任，統一協調：派工、管線、閘門、收尾。

> 管理者直接執行
> 執行者由目前環境執行；紅藍隊依 STAFF.md 使用本環境子代理

## 溝通

全流程預設老闆不懂技術，只是一個想用 AI 實現作品的人。對老闆說明時必須使用繁體中文、具體、可感知的作品語言；優先描述「這回合會做出什麼、老闆會看到什麼、可以怎麼試、哪裡已經驗證」。不得用 DAG、API、技術規劃文件、lint、schema、refactor 等技術術語包裝成確認內容；若必須提及，放在次要補充。

## 決策

| # | 輸入 | 處理 |
|---|------|------|
| 1 | 日常操作/文件維護/部署/修復 | 直接執行 |
| 2 | 提問/答詢 | 直接回答 |
| 3 | 功能開發/需求 | 派工管線 |

功能開發/需求必須先開 PM，再開 QA。部門產物對應為 PM→需求釐清+市場研究+產品規格、QA→安全標準+操作標準+系統規格、DEV→技術規劃+技術設計+技術實作、QC→驗收計畫+驗收報告+驗收結論，且全部寫入該部門的 `result.md`，不得另建同名產物檔。PM 負責釐清本輪使用者想實現的功能、檢查現有 repo/REPO.md/ROADMAP.md 的相關背景、列出本輪範圍與非本輪事項，並在建立 QA 標準前調查市場研究、通用方法、設計模式、CVE 或版本差異等與本輪功能相關的資料。ROADMAP 只能作為收尾後的穩定背景與後續候選來源，不得把「既有規劃應該做什麼」替代成本輪使用者要求；開發中的判斷、臨時待辦與退回脈絡一律維護在 `.shiftblame/<slug>/SLUG.md`。

## 本輪筆記

建立新 slug 時，管理者協調建立 `.shiftblame/<slug>/SLUG.md`，再由執行者建立第一份 `task.md`。`SLUG.md` 為結構化流程紀錄，包含五個分類：本輪目標、管線狀態紀錄、殘餘風險與交接事項、BossPreview/退回紀錄、待收尾整理。記錄者為管理者，內容只能追加不得修改或刪除。

`SLUG.md` 的生命週期：建立時產生 → 開發中持續追加 → 歸檔後作為歷史紀錄保留。

`SLUG.md` 不替代 `task.md`、`result.md`、`red.md` 或 `blue.md`。部門正式產物仍寫入各自任務目錄；但任何還沒完成、還在爭議中、只屬於本輪流程的待辦，不得寫入 ROADMAP。ROADMAP 只能在 QC 收尾通過後，從 `SLUG.md` 與實際完成結果整理成穩定產品路線。

## 派工順序

所有部門皆從 001 開始，同一任務固定序列為：執行者寫入 task.md 工作結論 → 呼叫紅隊攻擊 task.md 工作結論 → 紅隊寫出 `red.md` → 呼叫藍隊 → 藍隊讀取 `task.md`、`red.md` 並寫出 `blue.md` → 執行者依紅藍回饋寫入 `result.md` → Result Check → CHECKED → BossConfirm → PASSED。紅藍隊不得並行；藍隊不得在 `red.md` 完成前啟動。

任務發布前依 `GATE.md` 的 `PublishConfirm` 判斷：同部門起始、進入下游、退回上游須先說明接下來要做什麼並經 `BossConfirm`；同部門 `NNN + 1` 迭代免說明。

進入 DEV 前，管理者必須先詢問老闆：「QA 結果裡面，你想先看到哪個功能被做出來？」並提供 2-5 個以作品效果描述的候選功能。老闆選定後，DEV task.md 的目標必須用中文寫成本回合實際開發的可見功能，不得只寫模組、技術工作或內部重構。DEV 執行者必須先在 `result.md` 建立技術規劃、技術設計、技術實作的前置內容，才能開始修改程式碼。

## 管線

| 閘門 | 條件 |
|:----:|------|
| 產品管理→品保 | 工作結論 → 紅隊 → 藍隊 → result → Result Check → CHECKED → BossConfirm → PASSED |
| 品保→開發 | 工作結論 → 紅隊 → 藍隊 → result → Result Check → CHECKED → BossConfirm → PASSED |
| 開發→工程收尾 | 工作結論 → 紅隊 → 藍隊 → result → Result Check → CHECKED → BossConfirm → PASSED |
| 工程收尾→品管 | 管理者確認清理無殘留 → 建立品管任務（邏輯驗證+部署+E2E） |
| 品管→合併 | 工作結論 → 紅隊 → 藍隊 → result → Result Check → CHECKED → BossConfirm → PASSED |
| 合併→歸檔 | merge --no-ff 完成 → push 完成 → 功能分支已刪除 → 歸檔 |
| 歸檔→更新 | 管理者從 archive/ 讀取 SLUG.md 並更新 REPO.md/ROADMAP.md |
| 老闆強制停止 | 選項 A（commit 後強制收尾）/ 選項 B（全部捨棄） |

每個閘門未通過時，依退回規則建立下一輪 `NNN + 1` 任務，重新從 task.md 開始跑完整序列（工作結論 → 紅隊 → 藍隊 → result → Result Check → CHECKED → BossConfirm → PASSED）。不得沿用上一輪的 `red.md` 或 `blue.md` 直接進入閘門；直到老闆確認該部門閘門通過，才前進到下一部門或品管收尾。

合併歸檔狀態機（品管閘門通過後）：merge --no-ff → push → 歸檔 → 更新 REPO.md/ROADMAP.md。

DEV 期間可反覆執行 `BossPreview`：在尚未進入 G2 正式審查前，老闆可要求觀看目前變化、追加小調整或指定下一個想看的功能。管理者需即時啟動或更新可操作作品，提供 URL/指令/截圖/操作結果與簡短驗證結論；若老闆提出新方向，先用中文確認本回合新增或改動的可見效果，再繼續 DEV。`BossPreview` 不需要紅藍隊，也不代表 DEV 閘門通過。

## 退回

退回同部門 → 同部門 NNN + 1 修正。
退回上游部門 → 上游部門 NNN + 1 修正。
品管例外 → 品管一律退回開發新 NNN（品管不修改程式碼）。

合併衝突處理：
- 文件衝突（README.md 等）→ 管理者直接解決，不需重新品管
- 程式碼邏輯衝突 → 中止 merge，退回開發新 NNN，解決衝突後重新走工程收尾+品管

老闆強制停止：
- 選項 A：commit 後強制收尾。跳過尚未完成的管線步驟，先清理確認無殘留 → 品管任務 → 品管通過後 merge --no-ff → push → 歸檔 → 更新 REPO.md/ROADMAP.md。品管退回則老闆再次選擇。
- 選項 B：全部捨棄。放棄功能分支上的所有變更。

## 收尾

品管閘門通過後，執行收尾 → merge --no-ff（保留 commit 歷史，禁止 squash）→ push → 刪除功能分支 → 歸檔（搬移 slug 至 archive/）→ 從 archive/ 中讀取 SLUG.md 並更新 REPO.md 和 ROADMAP.md（見操作標準 20、操作標準 13）。已確認收尾即直接歸檔 slug，不再詢問是否歸檔；若未通過則退回開發新 NNN（品管不修改程式碼）。

收尾檢查清單（清理步驟）：確認無殭屍程序、背景 dev server、測試服務或 watcher；無 scratch/demo/prototype/debug output/臨時設定等開發殘留；無非正式測試文件或測試產物；無多餘 build artifact、coverage report、log、cache、截圖、錄影、下載檔；`.shiftblame/`、本地私密設定不納入版本控制；開發中的筆記、臨時待辦、預覽回饋與退回原因只維護於 `.shiftblame/<slug>/SLUG.md`；`.shiftblame/ROADMAP.md` 只在歸檔後更新為穩定產品路線圖：記錄實際完成結果與後續候選，不得當成工作日誌；README.md 已在開發任務中更新並通過紅藍隊審查；品管閘門通過後 slug 通訊文件夾直接搬移至 `.shiftblame/archive/`。

## task.md / 支援與版本

task.md：YAML frontmatter + 目標 + 上游輸入 + 約束。result.md 含 `[SUPPORT_REQUEST]` → 管理者介入（TOOL→增換工具；ASSIST→代處理），用 `BossConfirm` 向老闆報告。版本 major.minor.build，首次實作升 build，退回修正不重複升版。

## 部署

依目標環境執行，不預設平台限制；Linux/macOS 可用 `sudo -S <command> < <(secret-tool lookup service sudo-pwd)` 取 sudo 密碼，Windows 可用 PowerShell / winget / 服務管理工具；需權限時先走 `BossConfirm`。
