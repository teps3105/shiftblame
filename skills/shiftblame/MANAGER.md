# MANAGER — 管理者

管理者由目前主開發環境擔任，統一協調：派工、管線、閘門、收尾、寫入 conclusion.md。

> 管理者直接執行
> 執行者預設使用本環境子代理（管理者可根據上下文使用情況隨時調整為目前環境直接執行）；紅藍隊固定使用本環境子代理

## 溝通

全流程預設老闆不懂技術，只是一個想用 AI 實現作品的人。對老闆說明時必須使用繁體中文、具體、可感知的作品語言；優先描述「這回合會做出什麼、老闆會看到什麼、可以怎麼試、哪裡已經驗證」。不得用 DAG、API、技術規劃文件、lint、schema、refactor 等技術術語包裝成確認內容；若必須提及，放在次要補充。

面向老闆的所有詢問語言必須使用繁體中文。選項文字不得使用英文狀態機值。參考選項文字（非封閉列舉）：「同意」「不同意」「調整」「退回」「通過」「原地修復」「推進」「新執行切片」。狀態機值（AGREE、DECLARED、APPROVED 等）僅作為內部狀態記錄，不出現在老闆互動中。

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

所有部門皆從 001 開始，同一任務固定序列為：宣告 → BossConfirm → 執行者寫入 result.md（工作成果）→ BossConfirm（老闆確認 result.md 無需修改）→ 紅隊攻擊 result.md 並寫入 `red.md` → 管理者驗證 `red.md` → 呼叫藍隊 → 藍隊讀取 `task.md`（宣告段落）、`result.md`、`red.md` 並寫入 `blue.md` → 管理者驗證 `blue.md` → 管理者依紅藍回饋寫入 `conclusion.md` → Result Check（五檔齊全）→ CHECKED → BossConfirm → PASSED → compact 提醒（FEATURE 阻塞式，MAIN 條件式）。紅藍隊不得並行；藍隊不得在 `red.md` 完成前啟動。L2 BossConfirm 不通過時返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm；L4 藍隊 FAIL 退回 L1 重新宣告（DECLARED），需 BossConfirm；L5 BossConfirm FAIL 退回 L1 重新宣告。管理者驗證紅藍隊產出，未產出則重跑該子代理。DEV 和 QC 跑兩次此序列（計畫循環 → Boss Plan Pass → PLAN_PASSED → 實作循環 → Boss Gate Pass → PASSED），見 GATE.md 雙循環定義。

進入 DEV 時，管理者直接依 QA result.md 定義的完整功能列表建立 DEV task.md。DEV task.md 的目標必須用中文寫成本回合實際開發的全部可見功能，不得只寫模組、技術工作或內部重構。DEV 執行者必須先在 `task.md` 建立技術規劃、技術設計、技術實作的前置內容，才能開始修改程式碼。

## 管線

| 閘門 | 條件 |
|:----:|------|
| 專案計畫→品質保證 | 宣告 → BossConfirm → result.md → BossConfirm（result 確認）→ 紅隊 → 藍隊 → conclusion.md → Check（五檔）→ CHECKED → BossConfirm → PASSED → compact |
| 品質保證→產品開發 | 宣告 → BossConfirm → result.md → BossConfirm（result 確認）→ 紅隊 → 藍隊 → conclusion.md → Check（五檔）→ CHECKED → BossConfirm → PASSED → compact |
| 產品開發→工程收尾 | 計畫循環：宣告 → BossConfirm → result.md（計畫）→ BossConfirm（result 確認）→ 紅隊 → 藍隊 → conclusion.md → Check → Boss Plan Pass → PLAN_PASSED；實作循環（同 NNN）：宣告 → BossConfirm → result.md（完整）→ BossConfirm（result 確認）→ 紅隊 → 藍隊 → conclusion.md → Check → Boss Gate Pass → PASSED → compact |
| 工程收尾→驗收上線 | 管理者確認清理無殘留 → 建立驗收上線任務（邏輯驗證+部署+E2E） |
| 驗收上線→合併 | 計畫循環：宣告 → BossConfirm → result.md（計畫）→ BossConfirm（result 確認）→ 紅隊 → 藍隊 → conclusion.md → Check → Boss Plan Pass → PLAN_PASSED；實作循環（同 NNN）：宣告 → BossConfirm → result.md（完整）→ BossConfirm（result 確認）→ 紅隊 → 藍隊 → conclusion.md → Check → Boss Gate Pass → PASSED → compact |
| 合併→歸檔 | merge --no-ff 完成 → push 完成 → 功能分支已刪除 → 歸檔 |
| 歸檔→更新 | 管理者從 archive/ 讀取 SLUG.md 並更新 REPO.md/ROADMAP.md |
| 老闆強制停止 | 選項 A（commit 後強制收尾）/ 選項 B（全部捨棄） |

每個閘門未通過時，依五階段 FAIL 狀態機處理：L1 BossConfirm FAIL → 返回 L1 重新宣告；L2 BossConfirm FAIL → 返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm；L4 藍隊 FAIL → 返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → red.md → blue.md，直到藍隊 PASS。修改不刪除（保留完整追溯紀錄），採增量攻防。L2 BossConfirm FAIL 與 L4 藍隊 FAIL 皆必須更新宣告段落。不得沿用上一輪的 `red.md` 或 `blue.md`；管理者寫入新的 red.md / blue.md 時不得刪除既有攻防紀錄，必須在既有內容後追加新回合（以 `---` 與回合標題分隔）。直到老闆確認該部門閘門通過（PASSED），才前進到下一部門或驗收上線收尾。PASSED 後管理者判斷分支：推進下一部門或同部門新執行切片（新 NNN）。一個 NNN 可以多次提交。

管理者在 BossConfirm PASSED 後輸出 compact 提醒：FEATURE 模式為阻塞式（閘門已通過，執行 compact 後繼續收尾或推進），MAIN 模式為條件式（僅上下文過長時才要求 compact）。DEV/QC 計畫循環通過（PLAN_PASSED）不 compact，保持上下文連續性直到實作循環也 PASSED。

FEATURE 模式（PM/QA PASSED 或 DEV/QC 實作循環 PASSED）：
閘門已通過。請執行 /compact 壓縮上下文後繼續收尾或推進下一部門。
compact 後 SessionStart hook 會自動重新載入 shiftblame 技能。

FEATURE 模式（DEV/QC 計畫循環 PLAN_PASSED）：
計畫循環已通過。不執行 compact，直接進入實作循環。

MAIN 模式：
閘門已通過。若上下文過長，請執行 /compact 壓縮上下文後繼續收尾。

合併歸檔狀態機（驗收上線閘門通過後）：merge --no-ff → push → 歸檔 → 更新 REPO.md/ROADMAP.md。

DEV 期間可反覆執行 `BossPreview`：在尚未進入 G2 正式審查前，老闆可要求觀看目前變化、追加小調整或指定下一個想看的功能。管理者需即時啟動或更新可操作作品，提供 URL/指令/截圖/操作結果與簡短驗證結論；若老闆提出新方向，先用中文確認本回合新增或改動的可見效果，再繼續 DEV。`BossPreview` 不需要紅藍隊，也不代表 DEV 閘門通過。

## 退回

五階段 FAIL 狀態機：

- L1 BossConfirm FAIL → 宣告不被接受，返回 L1 重新宣告。需 BossConfirm。
- L2 BossConfirm FAIL（result 確認）→ 老闆要求修改 result.md，返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm。需 BossConfirm。
- L4 藍隊 FAIL（原地修復）→ 同部門 NNN 不變，task.md 回到 DECLARED，更新宣告段落後重新 BossConfirm → APPROVED → EXECUTED → red.md → blue.md，直到藍隊 PASS。採增量攻防（不得刪除既有 red.md / blue.md 紀錄，新回合攻防追加在既有紀錄之後）。需 BossConfirm。
- L4 藍隊 FAIL（打回上游）→ 問題在上游定義，上游開新 NNN，上游通過後回到原本被打回的 NNN，從 L1 重新宣告開始。本 NNN 的 L4 FAIL 不需 BossConfirm（上游自行走完整流程）。
- L5 BossConfirm FAIL → 結論不被接受，退回 L1 重新宣告。需 BossConfirm。
- 同部門新執行切片 → PASS 後需要新的工作範圍時建立同部門新 NNN。
- 回溯 → 撤回該部門所有變更，回到 001。需 BossConfirm。
- 驗收上線例外 → 驗收上線一律退回產品開發（驗收上線不修改程式碼），直接回到原本被打回的 DEV NNN 重做。

計畫更動判定：任何輪次發現需要更動已 PASSED 的前輪計畫時，管理者判定是否屬於計畫更動（功能範圍增減、架構決策變更）。若是，提供老闆兩選項：
- 回溯：撤回該部門所有變更（git 與 .shiftblame/），回到該部門 001 狀態重新規劃。僅限觸發部門，不影響其他已通過閘門的部門。需 BossConfirm。
- 進路線圖：將更動項目記錄至 ROADMAP.md，不在本輪執行。

## 上游讀取

所有部門讀取指令時，預設讀取所有上游部門的所有已 PASS 的 conclusion.md：
- QA → 讀 PM 所有已 PASS 的 conclusion.md
- DEV → 讀 QA 所有已 PASS 的 conclusion.md
- QC → 讀 DEV 所有已 PASS 的 conclusion.md
- PM 為第一部門，無上游，僅讀 SLUG.md + task.md + REPO.md + ROADMAP.md

管理者派工時提供上游所有已 PASS 的 conclusion.md 完整內容。預設一律提供全文，僅在超出派工 prompt 可容納範圍時才提供摘要。摘要最低保留欄位：每段結論的核心判定。

合併衝突處理：
- 文件衝突（README.md 等）→ 管理者直接解決，不需重新驗收上線
- 程式碼邏輯衝突 → 中止 merge，FAIL 原地修復 DEV，解決衝突後重新走工程收尾+驗收上線

老闆強制停止：
- 選項 A：commit 後強制收尾。跳過尚未完成的管線步驟，先清理確認無殘留 → 驗收上線任務 → 驗收上線通過後 merge --no-ff → push → 歸檔 → 更新 REPO.md/ROADMAP.md。驗收上線退回則老闆再次選擇。
- 選項 B：全部捨棄。放棄功能分支上的所有變更。

## 流程保護

### 跳步防護

管理者在狀態機轉移時，必須驗證前一狀態的產物存在且格式有效。驗證不通過則中止轉移。

**宣告更新規則**：若執行者在 BossConfirm 前更新了宣告內容（無論是否已進入 DECLARED），狀態回到 DECLARED，必須重新走完整宣告流程（BossConfirm），不得視為自動 APPROVED。

**TASK → DECLARED**：驗證 task.md「## 宣告」段落非空。不通過 → 要求執行者先寫入宣告。

**DECLARED → APPROVED**：驗證 BossConfirm 已完成（老闆已明確同意）。不通過 → 中止，等待老闆確認。

**APPROVED → EXECUTED**：驗證老闆已同意宣告且 task.md status 為 APPROVED。不通過 → 中止。

**EXECUTED → RED**：驗證 result.md 存在且格式有效（包含 YAML frontmatter 與繁體中文工作成果）。不通過 → 要求執行者先完成工作成果。

**RED → BLUE**：驗證 red.md 存在、包含 YAML frontmatter、包含繁體中文攻擊內容。不通過 → 重新呼叫紅隊。

**BLUE → CONCLUSION**：驗證 blue.md 存在、包含 YAML frontmatter、包含繁體中文檢視內容。不通過 → 重新呼叫藍隊。驗證 conclusion.md 存在、包含 YAML frontmatter、包含繁體中文結論內容。不通過 → 管理者先完成結論產出。

**CONCLUSION → CHECKED**：驗證五檔齊全（task.md + result.md + red.md + blue.md + conclusion.md），每檔含 YAML frontmatter 與繁體中文內容。不通過 → 要求補齊缺件。

**不可跳步**：藍隊判定 FAIL 時，管理者回到 L1（DECLARED），更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → red.md → blue.md，不產出 conclusion.md。只有藍隊 PASS 才進入 L5 產出 conclusion.md。L2 BossConfirm 不可跳過：result.md 產出後必須經老闆確認才能呼叫紅隊。L5 BossConfirm FAIL 時退回 L1 重新宣告（DECLARED）。

### Commit 閘門

DEV 階段的 EXECUTED → RED 轉移前，管理者必須驗證工作目錄乾淨：不存在未追蹤檔案、已追蹤但未暫存修改、已暫存但未提交。驗證不通過 → 中止紅隊呼叫，要求 DEV 執行者先 commit 所有變更。PM 和 QA 階段不適用此閘門。

### 工作目錄鎖定

紅藍隊期間（EXECUTED → RED 轉移至 BLUE 完成）以及 DECLARED → APPROVED 期間，管理者不得進行任何會修改工作目錄中已追蹤檔案的操作。唯一例外：更新 SLUG.md 的「管線狀態紀錄」段落和「BossPreview / 退回紀錄」段落。

紅隊子代理將報告寫入 `red.md`，藍隊子代理將報告寫入 `blue.md`。管理者在子代理回傳後驗證檔案是否已產出且格式有效；若未產出，重新呼叫該子代理。管理者寫入 `conclusion.md`，不得刪除既有攻防紀錄。

紅隊報告中發現問題時，管理者不得直接修復。必須繼續藍隊流程。若需修復，FAIL 原地修復或打回上游。

### 派工隔離

管理者在派工 prompt 中不得引用 GATE.md 狀態定義表。GATE.md 為管理者內部參考文件，不透過 prompt 傳遞給任何代理。

## MAIN 模式

MAIN 模式由老闆明確指定，用於不需要跑完整部門管線的小型修復、文件更新與配置變更。

特徵：
- 直接在主分支工作，不建立功能分支
- 簡化目錄（`.shiftblame/<slug>/<NNN>/`，無 DEPT 層級）
- 仍跑五階段流程（task→result→red→blue→conclusion）
- 無部門管線（不走 PM→QA→DEV→QC）
- 無上游/下游概念
- result.md 無部門三段式內容要求，直接描述工作成果

派工順序（MAIN 模式）：宣告 → BossConfirm → result.md → BossConfirm（result 確認）→ 紅隊 → 藍隊 → conclusion.md → Result Check → CHECKED → BossConfirm → PASSED → compact 提醒（條件式，僅上下文過長時）

退回（MAIN 模式）：L1 BossConfirm FAIL → 返回 L1 重新宣告；L2 BossConfirm FAIL → 返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm；L4 藍隊 FAIL → 退回 L1 重新宣告（DECLARED），更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → red.md → blue.md，採增量攻防，需 BossConfirm；L5 BossConfirm FAIL → 退回 L1 重新宣告；回溯 → 撤回該 slug 所有變更，回到 001。需 BossConfirm。

收尾（MAIN 模式）：PASSED 後 commit 到 main → push → 歸檔 → 更新 REPO.md/ROADMAP.md。無功能分支、無 merge。

## 收尾

驗收上線閘門通過後，執行收尾 → merge --no-ff（保留 commit 歷史，禁止 squash）→ push → 刪除功能分支 → 歸檔（搬移 slug 至 archive/）→ 從 archive/ 中讀取 SLUG.md 並更新 REPO.md 和 ROADMAP.md（見操作標準 20、操作標準 13）。已確認收尾即直接歸檔 slug，不再詢問是否歸檔；若未通過則 FAIL 原地重做（驗收上線不修改程式碼）。

收尾檢查清單（清理步驟）：確認無殭屍程序、背景 dev server、測試服務或 watcher；無 scratch/demo/prototype/debug output/臨時設定等開發殘留；無非正式測試文件或測試產物；無多餘 build artifact、coverage report、log、cache、截圖、錄影、下載檔；臨時檔案應存放於 `.shiftblame/tmp/`（由老闆自行清理，非管理者責任）；`.shiftblame/`、本地私密設定不納入版本控制；開發中的筆記、臨時待辦、預覽回饋與退回原因只維護於 `.shiftblame/<slug>/SLUG.md`；`.shiftblame/ROADMAP.md` 只在歸檔後更新為穩定產品路線圖：記錄實際完成結果與後續候選，不得當成工作日誌；README.md 已在產品開發任務中更新並通過紅藍隊審查；驗收上線閘門通過後 slug 通訊文件夾直接搬移至 `.shiftblame/archive/`。

task.md：YAML frontmatter + 宣告 + 結果。result.md 含 `[SUPPORT_REQUEST]` → 管理者介入（TOOL→增換工具；ASSIST→代處理），用 `BossConfirm` 向老闆報告。

## 部署

依目標環境執行，不預設平台限制；Linux/macOS 可用 `sudo -S <command> < <(secret-tool lookup service sudo-pwd)` 取 sudo 密碼，Windows 可用 PowerShell / winget / 服務管理工具；需權限時先走 `BossConfirm`。
