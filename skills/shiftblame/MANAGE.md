# MANAGE — 管理者協調與操作

管理者為目前環境，負責協調、派工、管線、閘門、收尾。不寫入部門正式產物（result.md / red.md / blue.md），寫入 conclusion.md 與 task.md 宣告段落。L2/L3/L4 強制由子代理執行，管理者僅處理 L1（宣告 + BossConfirm）與 L5（結論 + BossConfirm）。

## 決策表

| # | 輸入 | 模式 |
|---|------|:----:|
| 1 | 規劃/文件維護/部署/修復 | PM |
| 2 | 提問/答詢 | 直接回答 |
| 3 | 功能開發/需求/快速迭代（預設） | FEATURE |
| 4 | 維護/主分支/日常開發 | DEV |
| 5 | 存在 RAPID.md 時的全自動模式 | AUTO |

**PM**：需求釐清、品質定義、測試標準、驗譗條件、GWT 測試案例、前端設計唯一權威（履行品質保證職責）。
**DEV**：技術規劃、設計、實作、自行驗收（含 GWT 逐條驗證、邊界測試、端到端驗收）（履行品質控制職責）。

## 管線閘門表

| 閘門 | 條件 |
|:----:|------|
| PM 階段 | 宣告（管理者）→ BossConfirm → result.md（子代理）→ BossConfirm → red.md（子代理）→ BossConfirm → blue.md（子代理）→ BossConfirm → conclusion.md（管理者）→ CHECKED → BossConfirm → PASSED → **commit + 停止 + 開新對話** |
| DEV 階段 | 宣告（管理者）→ BossConfirm → result.md（子代理）→ BossConfirm → red.md（子代理）→ BossConfirm → blue.md（子代理）→ BossConfirm → conclusion.md（管理者）→ CHECKED → BossConfirm → PASSED → **commit + 停止 + 開新對話或收尾** |
| 收尾 | merge --no-ff → push → branch delete（AUTO 額外 worktree remove）→ 歸檔 → 更新（AUTO 額外更新 RAPID.md） |
| 歸檔→更新 | 管理者從 archive/ 讀取 SLUG.md 並更新 REPO.md/ROADMAP.md |
| 強制停止 | A：commit 後收尾 / B：全部捨棄 |

派工順序：L1 宣告（管理者）→ BossConfirm → L2 result.md（子代理）→ BossConfirm → L3 red.md（子代理）→ BossConfirm → L4 blue.md（子代理）→ BossConfirm → L5 conclusion.md（管理者）→ CHECKED → BossConfirm → PASSED → 每角色階段結束後開新對話（FEATURE/AUTO）。

## 上下文隔離

管理者與子代理的上下文權責劃分：

| 階段 | 執行者 | 說明 |
|:----:|--------|------|
| L1 宣告 | 管理者（目前環境） | 高權重 — 直接處理 BossConfirm |
| L2 產出 | 子代理（強制） | 上下文隔離 — 子代理獨立產出 result.md |
| L3 紅隊 | 子代理（強制） | 上下文隔離 — 子代理獨立產出 red.md |
| L4 藍隊 | 子代理（強制） | 上下文隔離 — 子代理獨立產出 blue.md |
| L5 結論 | 管理者（目前環境） | 高權重 — 彙整五檔寫入 conclusion.md + BossConfirm |

**禁止**：管理者不得自行產出 result.md / red.md / blue.md。若無法開子代理 → BLOCK，不得使用外部品牌工具。

角色上下文檔：`ROLE/<ROLE>/{START,EXECUTE,ATTACK,DEFEND,END}.md`。管理者依階段讀取對應檔案，建構派工 prompt。

## 溝通原則

全流程預設老闆不懂技術。使用繁體中文、作品效果、可操作步驟。不得用技術術語包裝。階段指標使用「現在是 L*階段（名稱）」。選項文字用中文。狀態機值僅作內部記錄。

## 流程保護

**跳步防護**：狀態轉移前驗證前一狀態產物存在且有效。宣告更新後必須重新 BossConfirm。

**Commit 閘門**：所有模式、所有角色，result.md 產出前必須先 commit。管理者在批准 L2 前執行 `git status` 驗證工作目錄乾淨。無例外。

**工作目錄鎖定**：紅藍隊期間不得修改已追蹤檔案。管理者不得直接修復紅隊發現的問題。

**派工隔離**：派工 prompt 不得引用 GATE.md 狀態定義。

## 流程開始

1. **初始化**：觸發技能時檢查 `.shiftblame/REPO.md` + `.shiftblame/ROADMAP.md`。缺任一 → BLOCK 或自動建立模板。
2. **恢復**：若存在未歸檔的 `.shiftblame/<slug>/SLUG.md`，讀取並恢復該 slug 工作狀態。
   - **階段恢復（FEATURE/AUTO）**：讀取 SLUG.md 管線狀態紀錄，判定最後 PASSED 的角色階段。PM PASSED → 接續 DEV；DEV PASSED → 接續 PM 或進入收尾。
3. **模式選擇**：依決策表判定模式。
4. **建立 SLUG.md**：管理者協調建立 `.shiftblame/<slug>/SLUG.md`。
5. **建立功能分支（FEATURE/AUTO）**：FEATURE：`git checkout -b feat/<slug>`；AUTO：`git worktree add .worktrees/<slug> -b feat/<slug>`；PM/DEV：不建立分支。
6. **建立第一份 task.md**：管理者協調建立。PM/DEV 使用扁平目錄 `<slug>/<NNN>/`；FEATURE/AUTO 使用 `<slug>/<ROLE>/<NNN>/`。
7. **進入 L1 宣告**：依 `ROLE/<ROLE>/START.md` 建構上下文 → 寫入宣告 → BossConfirm → APPROVED。

## 流程結束

### 階段結束（FEATURE/AUTO）

每角色階段 PASSED 後，若尚有後續角色階段需執行：
1. 更新 SLUG.md 管線狀態紀錄
2. Commit 所有變更
3. 輸出階段摘要
4. 提醒老闆開新對話以繼續
5. **停止處理**

若所有角色皆已完成 → 進入 slug 收尾。

### Slug 收尾

1. **收尾確認**：無殭屍程序、無開發殘留、臨時檔案在 tmp/、.shiftblame/ 不納入版本控制、README.md 已更新。
2. **合併**：FEATURE/AUTO：`git merge --no-ff feat/<slug>`（禁止 squash）；PM/DEV：已在 main。
3. **推送**：`git push`。
4. **清理**：FEATURE：branch delete；AUTO：worktree remove + branch delete；PM/DEV：無需清理。
5. **歸檔**：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`。同名已存在 → 附加時間戳。
6. **更新 REPO.md + ROADMAP.md**：從 archive/ SLUG.md 提取。REPO.md 記錄「完成了什麼」；ROADMAP.md 記錄「未來預計做什麼」。
7. **更新 RAPID.md（AUTO 模式）**：管理者從本次 AUTO 迭代中提取經驗，更新 `.shiftblame/RAPID.md`（已完成功能、待修正項目、下次迭代建議）。
8. **PRD 固化**：若消耗 PRD，提取設計決策生成 SOP。
8. **業務拓樑圖**：若 `.shiftblame/GRAPH.md` 存在，更新。
9. **開新對話**：輸出完成摘要，建議老闆開啟新對話。PM/DEV 模式收尾後亦建議開新對話。

## SLUG.md 維護

建立新 slug 時建立 `.shiftblame/<slug>/SLUG.md`。五分類：1.本輪目標 2.管線狀態紀錄 3.殘餘風險 4.BossPreview/退回紀錄 5.待收尾整理。只追加不修改。歸檔後作為歷史紀錄保留。

## Worktree 管理

- **FEATURE**：`git checkout -b feat/<slug>`（主工作目錄）
- **AUTO**：`git worktree add .worktrees/<slug> -b feat/<slug>`（獨立 worktree）

## 退回處理

L1~L5 BossConfirm FAIL 一律退回 DECLARED 重新宣告，不分模式。DEV 退回前先 commit。定義問題→退回 PM。回溯→撤回該角色所有變更回到 001。計畫更動判定→回溯或進路線圖。

## 階段交接

FEATURE/AUTO 模式下，每角色階段 PASSED 後執行階段交接：
1. 更新 SLUG.md 管線狀態紀錄（記錄 `<ROLE>/<NNN> PASSED`）
2. Commit 所有變更
3. 輸出階段摘要
4. 提醒老闆開新對話以繼續下一角色階段
5. **停止處理**，不得繼續下一角色

新對話恢復時，管理者讀取 SLUG.md 管線狀態紀錄，判定最後 PASSED 的角色，接續下一角色。若 DEV PASSED 且無後續 PM 需求 → 進入收尾。PM/DEV 模式不適用（本就單角色）。

## PRD/SOP

`.shiftblame/PRD/` 產品需求文件（PM 參照）。`.shiftblame/SOP/` 標準作業程序（DEV 遵循）。非強制參照，不受閘門約束。
