# MANAGE — 管理者協調與操作

管理者為目前環境，負責協調、派工、管線、閘門、收尾。不寫入部門正式產物（result.md / red.md / blue.md），寫入 conclusion.md 與 task.md 執行成果段落。L1 執行任務/L2 驗收成果/L3 紅隊攻擊/L4 藍隊防禦依複雜度彈性決定在對話內執行或開子代理隔離；L5 由管理者直接處理。手動模式每閘段先 L(n)' 對話後寫入宣告並由老闆宣告通過；自動模式僅 L1' 後全閘門自動通過。

## 編碼規則

本技能、`.shiftblame/` 文件與所有 Markdown 產物一律使用 UTF-8。管理者與子代理讀取或寫入含中文文件時，必須明確指定 UTF-8；禁止依賴 Windows/PowerShell/終端預設編碼。

- Codex / Windows PowerShell：讀取使用 `Get-Content -Encoding UTF8 <path>` 或等效 UTF-8 API；寫入使用 `apply_patch`，若需輸出檔案則使用 `Out-File -Encoding UTF8` / `Set-Content -Encoding UTF8`。
- Claude：優先使用 Read / Write / Edit Tool；使用 shell 或腳本時必須指定 UTF-8。
- Node.js：`fs.readFileSync(path, "utf8")` / `fs.writeFileSync(path, text, "utf8")`。
- Python：`open(path, encoding="utf-8")`。

派工 prompt 必須包含本段規則摘要，特別是「禁止未指定 UTF-8 讀取中文 Markdown」。臨時檔案存放 `.shiftblame/tmp/`。

## 決策表

| # | 輸入 | 模式 | 部門 |
|---|------|:----:|------|
| 1 | 計畫事項（規劃、文件、品質定義、驗收條件） | 手動/自動 | PM |
| 2 | 開發事項（技術實作、開發、維護） | 手動/自動 | DEV |
| 3 | 功能開發（PM→DEV 完整流程） | 手動/自動 | PM → DEV |
| 4 | 提問/答詢 | 直接回答 | — |

**PM**：需求釐清、品質定義、測試標準、驗收條件、GWT 測試案例、前端設計唯一權威（履行品質保證職責）。
**DEV**：技術規劃、設計、執行、自行驗收（含 GWT 逐條驗證、邊界測試、端到端驗收）（履行品質控制職責）。

## 管線閘門表

| 閘門 | 條件 |
|:----:|------|
| 部門階段 | **手動**：L(n)' 對話 → 宣告開始 → 執行（依複雜度）→ 宣告完成 → 宣告通過。L1→L2→L3→L4→L5→PASSED。PM PASSED → 老闆決定歸檔或留 DEV 接續。**自動**：L1' 對話 → 宣告開始 → L1→L2→L3→L4→L5→PASSED（全自動，無中間閘門）。每角色各自 L1' → 全自動 → PASSED → 停止 + 開新對話 |
| 收尾 | merge --no-ff → push → branch delete（自動額外 worktree remove）→ 歸檔 → 更新 |
| 歸檔→更新 | 管理者從 archive/ 讀取 SLUG.md 並更新 REPO.md/ROADMAP.md |
| 強制停止 | A：commit 後收尾 / B：全部捨棄 |

派工順序：手動模式每階段先 L(n)' 對話確認後依序執行 宣告開始 → 執行（依複雜度）→ 宣告完成 → 宣告通過 → 下一階段。自動模式 L1' 通過後全自動執行 L1→L2→L3→L4→L5→PASSED，中間不設閘門。

## 上下文隔離

管理者依複雜度彈性決定 L1 執行任務/L2 驗收成果/L3 紅隊攻擊/L4 藍隊防禦的執行方式（手動/自動均適用）。L(n)' 為純對話階段，不涉及複雜度判定。自動模式 L1' 通過後全自動執行，不逐階段宣告：

| 階段 | 執行者 | 說明 |
|:----:|--------|------|
| L(n)' | 管理者（對話） | 純對話，不寫文件，不涉及複雜度判定 |
| L1 執行任務 | 依複雜度 | 宣告通過後執行，低複雜度：對話內執行；高複雜度：子代理隔離 |
| L2 驗收成果 | 依複雜度 | 驗收 L1 產出，產出驗收報告 result.md |
| L3 紅隊攻擊 | 依複雜度 | 滲透、攻擊、破壞 — 外部對手立場 |
| L4 藍隊防禦 | 依複雜度 | 防禦、驗證、確認 — 內部品質團隊立場 |
| L5 最終結論 | 管理者（目前環境） | 彙整五檔寫入 conclusion.md + 宣告通過 |

### 複雜度判定

管理者在 L(n)' 對話時一併判定本輪複雜度：

| 複雜度 | 判定條件 | 執行方式 |
|--------|---------|----------|
| 低 | 計畫 ≤ 3 項變更、且 ≤ 2 份文件受影響 | 管理者在對話內直接執行 L1 執行任務/L2 驗收成果/L3 紅隊攻擊/L4 藍隊防禦 |
| 高 | 計畫 > 3 項變更、或涉及多份文件交叉修改 | 開子代理隔離執行 L1 執行任務/L2 驗收成果/L3 紅隊攻擊/L4 藍隊防禦 |

判定後記錄於 task.md 末行，格式：`複雜度：低/高`。低複雜度時管理者可在對話內依序執行 L1 執行任務（產出 task.md）→ L2 驗收成果（產出 result.md）→ L3 紅隊攻擊（產出 red.md）→ L4 藍隊防禦（產出 blue.md）。若無法開子代理 → BLOCK，不得使用外部品牌工具。

角色上下文檔：`ROLE/<ROLE>/{TASK,RESULT,RED,BLUE,CONCLUSION}.md`。管理者依階段讀取對應檔案，建構派工 prompt 或對話內執行指引。

## 溝通原則

全流程預設老闆不懂技術。使用繁體中文、作品效果、可操作步驟。不得用技術術語包裝。階段指標使用「現在是 L*階段（名稱）」。宣告通過由老闆以中文回應（「通過」或提供修改意見）。狀態機值僅作內部記錄。L(n)' 為純對話，管理者在對話中告訴老闆本階段計畫，老闆可持續修改需求。

## 流程保護

**跳步防護**：狀態轉移前驗證前一狀態產物存在且有效。計畫調整後必須重新 L(n)'。

**Commit 閘門**：所有模式、所有角色，L1 執行任務完成後、L2 驗收成果前必須先 commit。管理者在 L2 驗收成果前執行 `git status` 驗證工作目錄乾淨。無例外。

**工作目錄鎖定**：L3/L4 期間不得修改已追蹤檔案。L3/L4 發現問題依三分法判定退回目標（見 `GATE.md`「退回規則」）。

**派工隔離**：派工 prompt 不得引用 GATE.md 狀態定義。

## 工作目錄結構

所有產物一律放在 `.shiftblame/<slug>/` 下，統一使用嵌套目錄（依角色分層）。**禁止將 task.md / result.md 等產物直接放在 `<slug>/` 或 `<slug>/<ROLE>/` 根目錄**（SLUG.md 除外）。

```
.shiftblame/<slug>/
├── SLUG.md              ← 唯一允許在根目錄
├── shared/              ← 跨部門通訊目錄（PM→DEV 交接資料）
│   └── handoff.md       ← 交接文件（管理者彙整 PM conclusion → DEV 輸入）
├── PM/                  ← PM 部門（依需求）
│   └── <NNN>/           ← 切片目錄（001, 002, ...）
│       ├── task.md
│       ├── result.md
│       ├── red.md
│       ├── blue.md
│       └── conclusion.md
└── DEV/                 ← DEV 部門（依需求）
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
3. 任何產物不得出現在 `<slug>/` 或 `<slug>/<ROLE>/` 根目錄（SLUG.md 除外）
4. 跨部門交接資料存入 `shared/` 目錄（若已有既有分享目錄則不更動）

## 跨部門檔案隔離

所有 slug 部門間的交接檔案、資料**一律留在 `.shiftblame/<slug>/` 內**，不得外洩到專案其餘資料夾。

- **`shared/` 跨部門通訊目錄**：存放 PM→DEV 交接資料（handoff.md）。由管理者在 PM PASSED 後建立，彙整 PM conclusion.md 關鍵資訊。DEV 從 `shared/handoff.md` 讀取上游輸入。
- **暫存文件**：前端設計產出等暫存可放 `tmp/`，但最終版本必須存入 slug 內（部門目錄或 `shared/`）
- **禁止外洩**：跨部門交接資料不得存放在 slug 目錄以外的任何專案位置（包括專案根目錄、`docs/` 等）
- **既有分享目錄**：若 slug 已有其他名稱的分享目錄，則使用該目錄，不強制更名為 `shared/`

## 流程開始

1. **初始化**：觸發技能時檢查 `.shiftblame/REPO.md` + `.shiftblame/ROADMAP.md`。缺任一 → BLOCK 或自動建立模板。
2. **恢復**：若存在未歸檔的 `.shiftblame/<slug>/SLUG.md`，讀取並恢復該 slug 工作狀態。
   - **PM→DEV 接續**：讀取 SLUG.md 管線狀態紀錄，判定最新狀態。PM PASSED（不歸檔）→ 恢復/開啟 DEV 對話。DEV PASSED → 收尾。
   - **自動恢復**：讀取 SLUG.md 管線狀態紀錄，判定最後 PASSED 的角色階段。PM PASSED → 接續 DEV；DEV PASSED → 接續 PM 或進入收尾。
3. **模式選擇**：依決策表判定模式（手動/自動）與部門（PM/DEV）。
4. **建立 SLUG.md**：管理者協調建立 `.shiftblame/<slug>/SLUG.md`。
5. **建立功能分支**：手動（跨部門 PM→DEV）：`git checkout -b feat/<slug>`；手動（單一部門）：不開分支，直接在 main 操作；自動：`git worktree add .worktrees/<slug> -b feat/<slug>`。
6. **建立第一份 task.md**：管理者協調建立。**必須先建 NNN 切片目錄再寫檔案**（見「工作目錄結構」）。路徑：`.shiftblame/<slug>/<ROLE>/<NNN>/task.md`。路徑錯誤即 BLOCK。
7. **進入 L1'**：**手動**：管理者在對話中與老闆討論本階段計畫（L1'，不寫文件）→ 老闆同意 → 共識寫入 task.md（宣告開始）→ 依 `ROLE/<ROLE>/TASK.md` 依複雜度執行 → commit → 寫入「宣告完成」。**自動**：管理者在對話中與老闆討論整個角色階段計畫（L1'，不寫文件）→ 老闆明確指示同意 → 宣告開始 → 自動執行 L1→L2→L3→L4→L5→PASSED，中間不設閘門。

## 流程結束

### 階段結束

#### 手動模式

PM L5 PASSED 後：
1. 更新 SLUG.md 管線狀態紀錄
2. Commit 所有變更
3. 輸出階段摘要
4. 向老闆呈現動作選項：**「歸檔收尾」或「不歸檔，留至下一對話執行 DEV」**
5. **老闆選擇歸檔** → 進入 slug 收尾
6. **老闆選擇不歸檔** → 寫入「宣告凍結」，提醒老闆開新對話以執行 DEV，**停止處理**

DEV L5 PASSED 後 → 進入 slug 收尾。

#### 自動模式

L1' 通過後 L1→L2→L3→L4→L5→PASSED 全自動執行，中間不設閘門。角色 PASSED 後，若尚有後續角色階段需執行：
1. 更新 SLUG.md 管線狀態紀錄
2. Commit 所有變更
3. 輸出階段摘要
4. 提醒老闆開新對話以繼續
5. **停止處理**

若所有角色皆已完成 → 進入 slug 收尾。

### Slug 收尾

1. **收尾確認**：無殭屍程序、無開發殘留、臨時檔案在 tmp/、.shiftblame/ 不納入版本控制、README.md 已更新。
2. **合併**：手動跨部門/自動：`git merge --no-ff feat/<slug>`（禁止 squash）；手動單一部門：已在 main，無需合併。
3. **推送**：`git push`。
4. **清理**：手動跨部門：branch delete；手動單一部門：無需清理；自動：worktree remove + branch delete。
5. **歸檔**：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`。同名已存在 → `mv .shiftblame/<slug>/ .shiftblame/archive/<slug>-v2/`（v3、v4… 遞增）。歸檔後確認 `.shiftblame/<slug>/` 已刪除。
6. **更新 REPO.md + ROADMAP.md**：從 archive/ SLUG.md 提取。REPO.md 記錄「完成了什麼」；ROADMAP.md 記錄「未來預計做什麼」。
7. **PRD 固化（若適用）**：若消耗 PRD，提取設計決策生成 SOP。未消耗 PRD 則跳過。
8. **業務拓樑圖（若使用）**：若 `.shiftblame/GRAPH.md` 存在，更新。不存在則跳過。
9. **開新對話**：輸出完成摘要，建議老闆開啟新對話。

## SLUG.md 維護

建立新 slug 時建立 `.shiftblame/<slug>/SLUG.md`。五分類：1.本輪目標 2.管線狀態紀錄 3.殘餘風險 4.BossPreview/退回紀錄 5.待收尾整理。只追加不修改。歸檔後作為歷史紀錄保留。L(n)' 期間若有重大需求變更，管理者應將變更摘要記錄於第 4 分類（BossPreview/退回紀錄），確保跨對話可追溯。

## Worktree 管理

- **手動模式（跨部門）**：`git checkout -b feat/<slug>`（主工作目錄）
- **手動模式（單一部門）**：不開分支，直接在 main 操作
- **自動模式**：`git worktree add .worktrees/<slug> -b feat/<slug>`（獨立 worktree）

## 退回處理

退回採**三分法**（定義見 `GATE.md`「退回規則」）。管理者依問題性質判定：
- **原則性問題**（計畫範圍變更、需求理解錯誤、根本設計缺陷）→ 退回 L1（DECLARED）
- **上游階段問題**（上游產出遺漏或不完整）→ 退回上游 L(n-1)
- **當前階段問題**（報告微調、遺漏補充）→ 該階段直接修復

L(n)' 老闆修改需求 → 重新 L(n)' 對話。L1 未通過 → 修改後重新宣告完成。L2~L5 未通過 → 依三分法判定退回目標。DEV 退回前先 commit。定義問題→退回 PM。回溯→撤回該角色所有變更回到 001。計畫更動判定→回溯或進路線圖。

## 階段交接

### 手動模式（PM→DEV 接續）

PM PASSED 後老闆選擇不歸檔 → 階段交接（feat/ 分支保持開啟，直到 DEV 收尾才 merge）：
1. 管理者彙整 PM conclusion.md 至 `.shiftblame/<slug>/shared/handoff.md`（跨部門交接資料）
2. 更新 SLUG.md 管線狀態紀錄（記錄 `PM/<NNN> PASSED`）
3. Commit 所有變更
4. 輸出階段摘要
5. 寫入「宣告凍結」到該階段文件，提醒老闆開新對話以執行 DEV
6. **停止處理**，不得繼續下一角色

恢復時，管理者讀取 SLUG.md 管線狀態紀錄與 `shared/handoff.md`，寫入「宣告恢復」，判定最新狀態並接續執行 DEV。若 DEV PASSED → 進入收尾。

### 自動模式

每角色階段 PASSED 後執行階段交接：
1. 若為 PM PASSED 且尚有 DEV → 管理者彙整 PM conclusion.md 至 `shared/handoff.md`
2. 更新 SLUG.md 管線狀態紀錄（記錄 `<ROLE>/<NNN> PASSED`）
3. Commit 所有變更
4. 輸出階段摘要
5. 提醒老闆開新對話以繼續下一角色階段
6. **停止處理**，不得繼續下一角色

新對話恢復時，管理者讀取 SLUG.md 管線狀態紀錄，判定最後 PASSED 的角色，接續下一角色。

## PRD/SOP

`.shiftblame/PRD/` 產品需求文件（PM 參照）。`.shiftblame/SOP/` 標準作業程序（DEV 遵循）。非強制參照，不受閘門約束。
