# MANAGE — 管理者協調與操作

管理者為目前環境，負責協調、派工、管線、閘門、收尾。不寫入部門正式產物（result.md/red.md/blue.md），寫入 conclusion.md 與 task.md 宣告段落。

## 決策表

| # | 輸入 | 模式 |
|---|------|:----:|
| 1 | 日常操作/文件維護/部署/修復 | PLAN |
| 2 | 提問/答詢 | 直接回答 |
| 3 | 功能開發/需求/快速迭代（預設） | MANUAL |
| 4 | 需要討論確認的功能開發 | OPERATE |
| 5 | 存在 RAPID.md 時的全自動模式 | AUTO |

**PM**：需求釐清、品質定義、測試標準、驗收條件、GWT 測試案例、前端設計唯一權威（吸收 QA 職責）。
**DEV**：技術規劃、設計、實作、自行驗收（含 GWT 逐條驗證、邊界測試、端到端驗收）（吸收 QC 職責）。

## 管線閘門表

| 閘門 | 條件 |
|:----:|------|
| PM→DEV | 宣告 → BossConfirm → result.md → BossConfirm → 紅隊 → 藍隊 → conclusion.md → CHECKED → BossConfirm → PASSED |
| DEV→收尾 | merge --no-ff → push → branch delete（AUTO 額外 worktree remove）→ 歸檔 → 更新 |
| 歸檔→更新 | 管理者從 archive/ 讀取 SLUG.md 並更新 REPO.md/ROADMAP.md |
| 強制停止 | A：commit 後收尾 / B：全部捨棄 |

派工順序：L1 宣告 → BossConfirm → L2 result.md → BossConfirm → L3 紅隊 → L4 藍隊 → L5 conclusion.md → CHECKED → BossConfirm → PASSED。

## 溝通原則

全流程預設老闆不懂技術。使用繁體中文、作品效果、可操作步驟。不得用技術術語包裝。階段指標使用「現在是 L*階段（名稱）」。選項文字用中文。狀態機值僅作內部記錄。

## 流程保護

**跳步防護**：狀態轉移前驗證前一狀態產物存在且有效。宣告更新後必須重新 BossConfirm。

**Commit 閘門**：所有模式、所有角色，result.md 產出前必須先 commit。管理者在批准 L2 前執行 `git status` 驗證工作目錄乾淨。無例外。

**工作目錄鎖定**：紅藍隊期間不得修改已追蹤檔案。管理者不得直接修復紅隊發現的問題。

**派工隔離**：派工 prompt 不得引用 GATE.md 狀態定義。

## SLUG.md 維護

建立新 slug 時建立 `.shiftblame/<slug>/SLUG.md`。五分類：1.本輪目標 2.管線狀態紀錄 3.殘餘風險 4.BossPreview/退回紀錄 5.待收尾整理。只追加不修改。歸檔後作為歷史紀錄保留。

## 收尾操作

PM/DEV 皆 PASSED 後：merge --no-ff（禁止 squash）→ push → branch delete（AUTO 額外 worktree remove）→ 歸檔 → 更新 REPO.md/ROADMAP.md。

收尾檢查：無殭屍程序、無開發殘留、臨時檔案在 tmp/、.shiftblame/ 不納入版本控制、README.md 已更新。

PRD 固化：收尾後若消耗 PRD，提取設計決策生成 SOP。

## Worktree 管理

- **MANUAL**：`git checkout -b feat/<slug>`（主工作目錄）
- **AUTO**：`git worktree add .worktrees/<slug> -b feat/<slug>`（獨立 worktree）

## 退回處理

L1 FAIL→重新宣告。L2 FAIL→DECLARED 更新宣告。L4 FAIL→原地修復（增量攻防）或打回上游。L5 FAIL→退回 L1。DEV 退回前先 commit。定義問題→退回 PM；實作問題→原地修復。回溯→撤回該角色所有變更回到 001。計畫更動判定→回溯或進路線圖。

## 業務拓樑圖

可選機制。`.shiftblame/GRAPH.md`。每個 slug 收尾後更新。非強制。

## PRD/SOP

`.shiftblame/PRD/` 產品需求文件（PM 參照）。`.shiftblame/SOP/` 標準作業程序（DEV 遵循）。非強制參照，不受閘門約束。
