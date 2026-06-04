# MANAGE — 管理者協調與操作

管理者為目前環境，負責協調、派工、管線、閘門、收尾。不寫入部門正式產物（result.md / red.md / blue.md），寫入 conclusion.md 與 task.md 執行成果段落。L1 執行任務/L2 驗收成果/L3 紅隊攻擊/L4 藍隊防禦依複雜度彈性決定在對話內執行或開子代理隔離；L5 由管理者直接處理。手動模式（PM/FEATURE/DEV）每閘段由管理者寫入宣告並由老闆宣告通過；AUTO 模式全閘門自動通過。

## 編碼規則

本技能、`.shiftblame/` 文件與所有 Markdown 產物一律使用 UTF-8。管理者與子代理讀取或寫入含中文文件時，必須明確指定 UTF-8；禁止依賴 Windows/PowerShell/終端預設編碼。

- Codex / Windows PowerShell：讀取使用 `Get-Content -Encoding UTF8 <path>` 或等效 UTF-8 API；寫入使用 `apply_patch`，若需輸出檔案則使用 `Out-File -Encoding UTF8` / `Set-Content -Encoding UTF8`。
- Claude：優先使用 Read / Write / Edit Tool；使用 shell 或腳本時必須指定 UTF-8。
- Node.js：`fs.readFileSync(path, "utf8")` / `fs.writeFileSync(path, text, "utf8")`。
- Python：`open(path, encoding="utf-8")`。

派工 prompt 必須包含本段規則摘要，特別是「禁止未指定 UTF-8 讀取中文 Markdown」。臨時檔案存放 `.shiftblame/tmp/`。

## 決策表

| # | 輸入 | 模式 |
|---|------|:----:|
| 1 | 規劃/文件維護/部署/修復 | PM |
| 2 | 提問/答詢 | 直接回答 |
| 3 | 功能開發/需求/快速迭代（預設） | FEATURE |
| 4 | 維護/主分支/日常開發 | DEV |
| 5 | 老闆明確指示的全自動模式 | AUTO |

**PM**：需求釐清、品質定義、測試標準、驗收條件、GWT 測試案例、前端設計唯一權威（履行品質保證職責）。
**DEV**：技術規劃、設計、執行、自行驗收（含 GWT 逐條驗證、邊界測試、端到端驗收）（履行品質控制職責）。

## 管線閘門表

| 閘門 | 條件 |
|:----:|------|
| PM 階段 | **FEATURE/PM/DEV**：每階段宣告開始 → 執行（依複雜度）→ 宣告完成 → 宣告通過。L1→L2→L3→L4→L5→PASSED → **FEATURE: 宣告凍結**。**AUTO**：單次宣告 → L1→L2→L3→L4→L5→PASSED（全自動，無中間閘門）→ 停止 + 開新對話 |
| DEV 階段 | **FEATURE**：每階段宣告開始 → 執行（依複雜度）→ 宣告完成 → 宣告通過。L1→L2→L3→L4→L5→PASSED → **宣告凍結或收尾**。**AUTO**：單次宣告 → L1→L2→L3→L4→L5→PASSED（全自動）→ 停止 + 開新對話或收尾 |
| 收尾 | merge --no-ff → push → branch delete（AUTO 額外 worktree remove）→ 歸檔 → 更新 |
| 歸檔→更新 | 管理者從 archive/ 讀取 SLUG.md 並更新 REPO.md/ROADMAP.md |
| 強制停止 | A：commit 後收尾 / B：全部捨棄 |

派工順序：FEATURE/PM/DEV 每階段依序執行 宣告開始 → 執行（依複雜度）→ 宣告完成 → 宣告通過 → 下一階段。AUTO 單次宣告通過後全自動執行 L1→L2→L3→L4→L5→PASSED，中間不設閘門。FEATURE PASSED 後宣告凍結 / AUTO PASSED 後開新對話。

## 上下文隔離

管理者依複雜度彈性決定 L1 執行任務/L2 驗收成果/L3 紅隊攻擊/L4 藍隊防禦的執行方式（FEATURE/PM/DEV 適用）。AUTO 模式單次宣告後全自動執行，不逐階段宣告：

| 階段 | 執行者 | 說明 |
|:----:|--------|------|
| L1 執行任務 | 依複雜度 | 宣告通過後執行，低複雜度：對話內執行；高複雜度：子代理隔離 |
| L2 驗收成果 | 依複雜度 | 驗收 L1 產出，產出驗收報告 result.md |
| L3 紅隊攻擊 | 依複雜度 | 滲透、攻擊、破壞 — 外部對手立場 |
| L4 藍隊防禦 | 依複雜度 | 防禦、驗證、確認 — 內部品質團隊立場 |
| L5 最終結論 | 管理者（目前環境） | 彙整五檔寫入 conclusion.md + 宣告通過 |

### 複雜度判定

管理者在對話宣告時一併判定本輪複雜度：

| 複雜度 | 判定條件 | 執行方式 |
|--------|---------|----------|
| 低 | 計畫 ≤ 3 項變更、且 ≤ 2 份文件受影響 | 管理者在對話內直接執行 L1 執行任務/L2 驗收成果/L3 紅隊攻擊/L4 藍隊防禦 |
| 高 | 計畫 > 3 項變更、或涉及多份文件交叉修改 | 開子代理隔離執行 L1 執行任務/L2 驗收成果/L3 紅隊攻擊/L4 藍隊防禦 |

判定後記錄於 task.md 末行，格式：`複雜度：低/高`。低複雜度時管理者可在對話內依序執行 L1 執行任務（產出 task.md）→ L2 驗收成果（產出 result.md）→ L3 紅隊攻擊（產出 red.md）→ L4 藍隊防禦（產出 blue.md）。若無法開子代理 → BLOCK，不得使用外部品牌工具。

角色上下文檔：`ROLE/<ROLE>/{TASK,RESULT,RED,BLUE,CONCLUSION}.md`。管理者依階段讀取對應檔案，建構派工 prompt 或對話內執行指引。

## 溝通原則

全流程預設老闆不懂技術。使用繁體中文、作品效果、可操作步驟。不得用技術術語包裝。階段指標使用「現在是 L*階段（名稱）」。宣告通過由老闆以中文回應（「通過」或提供修改意見）。狀態機值僅作內部記錄。

## 流程保護

**跳步防護**：狀態轉移前驗證前一狀態產物存在且有效。計畫調整後必須重新宣告開始。

**Commit 閘門**：所有模式、所有角色，L1 執行任務完成後、L2 驗收成果前必須先 commit。管理者在 L2 驗收成果前執行 `git status` 驗證工作目錄乾淨。無例外。

**工作目錄鎖定**：L3/L4 期間不得修改已追蹤檔案。L3/L4 發現問題一律退回 DECLARED。

**派工隔離**：派工 prompt 不得引用 GATE.md 狀態定義。

## 工作目錄結構

所有產物一律放在 `.shiftblame/<slug>/` 下，按 NNN 切片目錄隔離。**禁止將 task.md / result.md 等產物直接放在 `<slug>/` 根目錄**（SLUG.md 除外）。

### PM/DEV 模式（扁平目錄）

```
.shiftblame/<slug>/
├── SLUG.md              ← 唯一允許在根目錄
└── <NNN>/               ← 切片目錄（001, 002, ...）
    ├── task.md
    ├── result.md
    ├── red.md
    ├── blue.md
    └── conclusion.md
```

### FEATURE/AUTO 模式（角色嵌套目錄）

```
.shiftblame/<slug>/
├── SLUG.md              ← 唯一允許在根目錄
└── <ROLE>/              ← PM / DEV
    └── <NNN>/           ← 切片目錄（001, 002, ...）
        ├── task.md
        ├── result.md
        ├── red.md
        ├── blue.md
        └── conclusion.md
```

### 建立順序（硬性）

1. **先建目錄**（`mkdir -p`），再寫入檔案
2. 第一份產物永遠從 `<NNN> = 001` 開始
3. 任何產物不得出現在 `<slug>/` 根目錄（SLUG.md 除外）

## 流程開始

1. **初始化**：觸發技能時檢查 `.shiftblame/REPO.md` + `.shiftblame/ROADMAP.md`。缺任一 → BLOCK 或自動建立模板。
2. **恢復**：若存在未歸檔的 `.shiftblame/<slug>/SLUG.md`，讀取並恢復該 slug 工作狀態。
   - **階段恢復（FEATURE）**：讀取 SLUG.md 管線狀態紀錄，判定最新狀態。PM PASSED → 恢復/開啟 DEV 對話；DEV PASSED → 恢復 PM 對話或進入收尾。角色對話持久化，恢復時沿用同一對話。
   - **階段恢復（AUTO）**：讀取 SLUG.md 管線狀態紀錄，判定最後 PASSED 的角色階段。PM PASSED → 接續 DEV；DEV PASSED → 接續 PM 或進入收尾。
3. **模式選擇**：依決策表判定模式。
4. **建立 SLUG.md**：管理者協調建立 `.shiftblame/<slug>/SLUG.md`。
5. **建立功能分支（FEATURE/AUTO）**：FEATURE：`git checkout -b feat/<slug>`；AUTO：`git worktree add .worktrees/<slug> -b feat/<slug>`；PM/DEV：不建立分支。
6. **建立第一份 task.md**：管理者協調建立。**必須先建 NNN 切片目錄再寫檔案**（見「工作目錄結構」）。PM/DEV：`.shiftblame/<slug>/<NNN>/task.md`；FEATURE/AUTO：`.shiftblame/<slug>/<ROLE>/<NNN>/task.md`。路徑錯誤即 BLOCK。
7. **進入 L1**：**FEATURE/PM/DEV**：管理者寫入「宣告開始」到 task.md（含本輪計畫）→ 向老闆呈現 → 宣告通過 → APPROVED → 依 `ROLE/<ROLE>/TASK.md` 依複雜度執行 → commit → 寫入「宣告完成」。**AUTO**：管理者寫入「宣告開始」（涵蓋整個角色階段計畫）→ 老闆明確指示同意 → 自動執行 L1→L2→L3→L4→L5→PASSED，中間不設閘門。

## 流程結束

### 階段結束

#### FEATURE 模式（角色對話持久化）

每角色階段 PASSED 後，若尚有後續角色階段需執行：
1. 更新 SLUG.md 管線狀態紀錄
2. Commit 所有變更
3. 輸出階段摘要
4. 寫入「宣告凍結」到該階段文件，凍結本對話，提醒老闆切換到另一個角色的持久對話（首次 PM→DEV 時提醒開啟新對話）
5. **停止處理**

若所有角色皆已完成 → 進入 slug 收尾。

#### AUTO 模式

AUTO 內部流程：單次宣告通過後 L1→L2→L3→L4→L5→PASSED 全自動執行，中間不設閘門。角色 PASSED 後，若尚有後續角色階段需執行：
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
5. **歸檔**：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`。同名已存在 → `mv .shiftblame/<slug>/ .shiftblame/archive/<slug>-v2/`（v3、v4… 遞增）。歸檔後確認 `.shiftblame/<slug>/` 已刪除。
6. **更新 REPO.md + ROADMAP.md**：從 archive/ SLUG.md 提取。REPO.md 記錄「完成了什麼」；ROADMAP.md 記錄「未來預計做什麼」。
7. **PRD 固化（若適用）**：若消耗 PRD，提取設計決策生成 SOP。未消耗 PRD 則跳過。
8. **業務拓樑圖（若使用）**：若 `.shiftblame/GRAPH.md` 存在，更新。不存在則跳過。
9. **開新對話**：輸出完成摘要，建議老闆開啟新對話。PM/DEV 模式收尾後亦建議開新對話。

## SLUG.md 維護

建立新 slug 時建立 `.shiftblame/<slug>/SLUG.md`。五分類：1.本輪目標 2.管線狀態紀錄 3.殘餘風險 4.BossPreview/退回紀錄 5.待收尾整理。只追加不修改。歸檔後作為歷史紀錄保留。

## Worktree 管理

- **FEATURE**：`git checkout -b feat/<slug>`（主工作目錄）
- **AUTO**：`git worktree add .worktrees/<slug> -b feat/<slug>`（獨立 worktree）

## 退回處理

L1~L5 宣告通過未通過一律退回 DECLARED 重新宣告，不分模式。DEV 退回前先 commit。定義問題→退回 PM。回溯→撤回該角色所有變更回到 001。計畫更動判定→回溯或進路線圖。

## 階段交接

### FEATURE 模式（角色對話持久化）

每角色階段 PASSED 後執行階段交接：
1. 更新 SLUG.md 管線狀態紀錄（記錄 `<ROLE>/<NNN> PASSED`）
2. Commit 所有變更
3. 輸出階段摘要
4. 寫入「宣告凍結」到該階段文件，凍結本對話，提醒老闆切換到另一個角色的持久對話（首次 PM→DEV 時提醒開啟新對話）
5. **停止處理**，不得繼續下一角色

恢復時，管理者讀取 SLUG.md 管線狀態紀錄，判定最新狀態並接續執行。若 DEV PASSED 且無後續 PM 需求 → 進入收尾。

### AUTO 模式

每角色階段 PASSED 後執行階段交接：
1. 更新 SLUG.md 管線狀態紀錄（記錄 `<ROLE>/<NNN> PASSED`）
2. Commit 所有變更
3. 輸出階段摘要
4. 提醒老闆開新對話以繼續下一角色階段
5. **停止處理**，不得繼續下一角色

新對話恢復時，管理者讀取 SLUG.md 管線狀態紀錄，判定最後 PASSED 的角色，接續下一角色。PM/DEV 模式不適用（本就單角色）。

## PRD/SOP

`.shiftblame/PRD/` 產品需求文件（PM 參照）。`.shiftblame/SOP/` 標準作業程序（DEV 遵循）。非強制參照，不受閘門約束。
