# MANAGE — 管理者協調與操作

管理者為目前環境，負責協調、派工、管線、閘門、收尾。不寫入部門正式產物（result.md / red.md / blue.md），寫入 conclusion.md、plan.md 與 task.md 執行成果段落。L1 執行任務/L2 驗收成果/L3 紅隊攻擊/L4 藍隊防禦依複雜度彈性決定在對話內執行或開子代理隔離；L5 由管理者直接處理。雙對話制度：對話一負責 L0~L2，對話二負責 L3~L5。

## 編碼規則

本技能、`.shiftblame/` 文件與所有 Markdown 產物一律使用 UTF-8。管理者與子代理讀取或寫入含中文文件時，必須明確指定 UTF-8；禁止依賴 Windows/PowerShell/終端預設編碼。

- Codex / Windows PowerShell：讀取使用 `Get-Content -Encoding UTF8 <path>` 或等效 UTF-8 API；寫入使用 `apply_patch`，若需輸出檔案則使用 `Out-File -Encoding UTF8` / `Set-Content -Encoding UTF8`。
- Claude：優先使用 Read / Write / Edit Tool；使用 shell 或腳本時必須指定 UTF-8。
- Node.js：`fs.readFileSync(path, "utf8")` / `fs.writeFileSync(path, text, "utf8")`。
- Python：`open(path, encoding="utf-8")`。

派工 prompt 必須包含本段規則摘要，特別是「禁止未指定 UTF-8 讀取中文 Markdown」。臨時檔案存放 `.shiftblame/tmp/`。

## 決策表

| # | 輸入 | 部門 | 期別 |
|---|------|------|------|
| 1 | 研究事項（需求釐清、功能規劃、品質定義） | PM（研究品管） | 研究期（L0~L2）/ 品管期（L3~L5） |
| 2 | 開發事項（技術實作、開發、維護） | DEV（開發維運） | 開發期（L0~L2）/ 維運期（L3~L5） |
| 3 | 功能開發（PM→DEV 完整流程） | PM → DEV | 各自雙對話 |
| 4 | 提問/答詢 | 直接回答 | — |

**PM**（研究品管）：面向自動綁定——研究期=研究面向（需求釐清、品質定義、測試標準、驗收條件、GWT 測試案例、前端設計唯一權威）、品管期=品管面向（品質偏移校正、標準修訂、品質一致性檢查）。

**DEV**（開發維運）：面向自動綁定——開發期=開發面向（技術規劃、設計、執行、自行驗收含 GWT 逐條驗證/邊界測試/端到端驗收）、維運期=維運面向（使用者視角產品驗證、端到端驗收、使用者體驗品質確認）。

## 管線閘門表

| 閘門 | 條件 |
|:----:|------|
| 對話一（L0~L2） | L0 規劃確認（plan.md）→ L1 執行（依複雜度）→ commit → L2 驗收 → STOP → 提醒老闆開新對話做驗證 |
| 對話二（L3~L5） | L3 紅隊（依複雜度）→ L4 藍隊（依複雜度）→ L5 結論+收尾（管理者）→ PASSED |
| 收尾 | 見 GATE.md「歸檔 → 收尾歸檔指令」 |
| 歸檔→更新 | `# Read .shiftblame/archive/<slug>/SLUG.md` → `# Edit .shiftblame/REPO.md` + `# Edit .shiftblame/ROADMAP.md` |
| 強制停止 | A：`git add -A && git commit -m "chore(<slug>): 強制停止"` → 收尾 / B：`git checkout . && git clean -fd` |

## 上下文隔離

管理者依複雜度彈性決定 L1/L2/L3/L4 的執行方式：

| 階段 | 執行者 | 說明 |
|:----:|--------|------|
| L0 規劃確認 | 管理者 | 與老闆確認需求，產出 plan.md |
| L1 執行任務 | 依複雜度 | 低複雜度：對話內執行；高複雜度：子代理隔離 |
| L2 驗收成果 | 依複雜度 | 驗收 L1 產出，產出 result.md |
| L3 紅隊攻擊 | 依複雜度 | 滲透、攻擊、破壞 — 外部對手立場 |
| L4 藍隊防禦 | 依複雜度 | 防禦、驗證、確認 — 內部品質團隊立場 |
| L5 結論+收尾 | 管理者 | 彙整六檔寫入 conclusion.md + 收尾後置作業 |

### 複雜度判定

管理者在 L0 規劃確認時一併判定本輪複雜度：

| 複雜度 | 判定條件 | 執行方式 |
|--------|---------|----------|
| 低 | 計畫 ≤ 3 項變更、且 ≤ 2 份文件受影響 | 管理者在對話內直接執行 |
| 高 | 計畫 > 3 項變更、或涉及多份文件交叉修改 | 開子代理隔離執行 |

判定後記錄於 plan.md 末行，格式：`複雜度：低/高`。

角色上下文檔：`ROLE/<ROLE>/{PLAN,TASK,RESULT,RED,BLUE,CONCLUSION}.md`。管理者依階段讀取對應檔案。

## 溝通原則

全流程預設老闆不懂技術。使用繁體中文、作品效果、可操作步驟。不得用技術術語包裝。階段指標使用「現在是 L*階段（名稱）」。狀態機值僅作內部記錄。

## 流程保護

**跳步防護**：狀態轉移前驗證前一狀態產物存在且有效。

**Commit 閘門**：所有角色，L1 執行任務完成後、L2 驗收前必須先 commit。無例外。

```bash
# L1 執行完成後，L2 驗收前
git add -A
git commit -m "<type>(<slug>): <繁體中文標題>"

# L2 驗收前驗證工作目錄乾淨
git status  # 預期輸出：nothing to commit, working tree clean
```

**工作目錄鎖定**：L3/L4 期間不得修改已追蹤檔案。L3/L4 發現問題記錄為技術債。

**派工隔離**：派工 prompt 不得引用 GATE.md 狀態定義。

## 工作目錄結構

所有產物一律放在 `.shiftblame/<slug>/` 下，統一使用嵌套目錄。**禁止將產物直接放在 `<slug>/` 或 `<slug>/<ROLE>/` 根目錄**（SLUG.md 除外）。

```
.shiftblame/<slug>/
├── SLUG.md              ← 唯一允許在根目錄
├── shared/              ← 跨部門通訊目錄（PM→DEV 交接資料）
│   └── handoff.md       ← 交接文件（管理者彙整 PM conclusion → DEV 輸入）
├── PM/                  ← 研究品管部門
│   └── <NNN>/
│       ├── plan.md          ← L0 規劃確認
│       ├── task.md          ← L1 執行任務
│       ├── result.md        ← L2 驗收成果
│       ├── red.md           ← L3 紅隊攻擊
│       ├── blue.md          ← L4 藍隊防禦
│       └── conclusion.md    ← L5 結論+收尾
└── DEV/                 ← 開發維運部門
    └── <NNN>/
        ├── plan.md
        ├── task.md
        ├── result.md
        ├── red.md
        ├── blue.md
        └── conclusion.md
```

### 建立順序（硬性）

```bash
# 1. 先建目錄，再寫入檔案
mkdir -p .shiftblame/<slug>/shared
mkdir -p .shiftblame/<slug>/<ROLE>/001

# 2. 建立後寫入檔案
# Write .shiftblame/<slug>/SLUG.md
# Write .shiftblame/<slug>/<ROLE>/001/plan.md
# Write .shiftblame/<slug>/<ROLE>/001/task.md
```

3. 第一份產物永遠從 `<NNN> = 001` 開始
4. 任何產物不得出現在 `<slug>/` 或 `<slug>/<ROLE>/` 根目錄（SLUG.md 除外）
5. 跨部門交接資料存入 `shared/` 目錄

## 跨部門檔案隔離

所有 slug 部門間的交接檔案、資料**一律留在 `.shiftblame/<slug>/` 內**，不得外洩到專案其餘資料夾。

- **`shared/` 跨部門通訊目錄**：存放 PM→DEV 交接資料（handoff.md）。由管理者在 PM PASSED 後建立，彙整 PM conclusion.md 關鍵資訊。DEV 從 `shared/handoff.md` 讀取上游輸入。
- **暫存文件**：前端設計產出等暫存可放 `tmp/`，但最終版本必須存入 slug 內
- **禁止外洩**：跨部門交接資料不得存放在 slug 目錄以外的任何專案位置
- **既有分享目錄**：若 slug 已有其他名稱的分享目錄，則使用該目錄，不強制更名為 `shared/`

### handoff.md 格式

管理者在 PM PASSED 後，彙整 PM conclusion.md 至 `shared/handoff.md`。

```markdown
# handoff.md — <slug> PM→DEV 交接

## 交接摘要

（管理者填入：本輪 PM 完成了什麼、DEV 需要接續什麼）

## 上游期別

（管理者填入：本輪 PM 各 NNN 使用的期別，如「001 研究期、002 品管期」，供 DEV 了解上游產出性質）

## 功能規格

（從 PM conclusion.md 彙整：DEV 需實作的功能列表、品質標準、GWT 測試案例）

## 設計規格

（從 PM conclusion.md 彙整：前端設計規格、視覺資源路徑）

## 驗收條件

（從 PM conclusion.md 彙整：DEV 自行驗收的通過標準）

## 殘餘風險

（從 PM conclusion.md 彙整：已知風險與注意事項）

## 技術債

（從 PM red.md/blue.md 彙整：PM 品管期發現的技術債，供 DEV 開發期參考）
```

**建立時機**：PM PASSED 後、DEV 開始前。

```bash
# PM PASSED 後建立 handoff.md
mkdir -p .shiftblame/<slug>/shared
# Read .shiftblame/<slug>/PM/<NNN>/conclusion.md
# Write .shiftblame/<slug>/shared/handoff.md — 彙整結論關鍵資訊
```

## 流程開始

```bash
# === Step 1: 初始化 ===
# 檢查 .shiftblame/REPO.md 與 .shiftblame/ROADMAP.md 是否存在
test -f .shiftblame/REPO.md && test -f .shiftblame/ROADMAP.md
# 缺任一 → BLOCK 或執行初始化（見 GATE.md「初始化」）
```

```bash
# === Step 2: 恢復 ===
# 若存在未歸檔的 SLUG.md，讀取恢復
# Read .shiftblame/<slug>/SLUG.md — 判定管線狀態紀錄
# 判定接續對話一或對話二
```

```bash
# === Step 3: 部門選擇 ===
# 依決策表判定部門（PM 研究品管 / DEV 開發維運）
```

```bash
# === Step 4: 建立 SLUG.md ===
mkdir -p .shiftblame/<slug>/shared
mkdir -p .shiftblame/<slug>/<ROLE>/001
# Write .shiftblame/<slug>/SLUG.md — 使用 TEMPLATES/SLUG.md 模板
```

```bash
# === Step 5: 建立功能分支 ===
# 跨部門 PM→DEV：
git checkout -b feat/<slug>
# 單一部門：不開分支，直接在 main 操作
```

```bash
# === Step 6: L0 規劃確認 ===
# 與老闆確認需求 → 寫入 plan.md
# Write .shiftblame/<slug>/<ROLE>/001/plan.md — 使用 ROLE/<ROLE>/PLAN.md 產出格式
```

```bash
# === Step 7: L1 執行任務 ===
# 依 plan.md 執行 → commit → 寫入 task.md 執行成果
```

```bash
# === Step 8: L2 驗收成果 ===
# 驗收 L1 產出 → result.md → STOP → 提醒老闆開新對話做 L3~L5
```

## 流程結束

### 對話一結束（L0~L2 完成）

```bash
# 1. 更新 SLUG.md 管線狀態紀錄
# Edit .shiftblame/<slug>/SLUG.md — 追加 NNN 狀態（APPROVED）

# 2. Commit 所有變更
git add -A
git commit -m "feat(<slug>): <ROLE>/<NNN> 對話一完成 (L0~L2)"
```

3. 寫入「宣告凍結」至 result.md
4. 輸出摘要，提醒老闆開新對話進行 L3~L5
5. **停止處理**

### 對話二結束（L3~L5 完成）

若有技術債：

```bash
# 1. 記錄技術債至 SLUG.md
# Edit .shiftblame/<slug>/SLUG.md — 追加技術債紀錄

# 2. Commit
git add -A
git commit -m "feat(<slug>): <ROLE>/<NNN> 對話二完成 (L3~L5，含技術債)"
```

3. 提醒老闆開新 NNN 對話一處理技術債
4. **停止處理**

若無問題 → L5 PASSED → 進入 Slug 收尾。

### Slug 收尾

收尾指令統一見 GATE.md「收尾歸檔指令」：

1. **收尾確認**：無殭屍程序、無開發殘留、臨時檔案在 tmp/、.shiftblame/ 不納入版本控制、README.md 已更新。
2. **合併** → GATE.md Step 2
3. **推送** → GATE.md Step 3
4. **清理** → GATE.md Step 4
5. **歸檔** → GATE.md Step 5
6. **更新 REPO.md + ROADMAP.md** → GATE.md Step 7
7. **PRD 固化（若適用）**：若消耗 PRD，提取設計決策生成 SOP。
8. **業務拓樑圖（若使用）**：若 `.shiftblame/GRAPH.md` 存在，更新。
9. **開新對話**：輸出完成摘要，建議老闆開啟新對話。

## SLUG.md 維護

建立新 slug 時建立 `.shiftblame/<slug>/SLUG.md`。五分類：1.本輪目標 2.管線狀態紀錄 3.殘餘風險 4.BossPreview/退回紀錄 5.待收尾整理。只追加不修改。歸檔後作為歷史紀錄保留。

```bash
# 建立 SLUG.md（新建 slug 時）
# Write .shiftblame/<slug>/SLUG.md — 使用 TEMPLATES/SLUG.md 模板

# 更新 SLUG.md（每次狀態變更時追加）
# Edit .shiftblame/<slug>/SLUG.md — 只追加，不修改既有內容
```

## Worktree 管理

DEV 開發預設在主 repo 分支執行，**不使用 worktree**。所有開發工作直接在主工作目錄進行。

```bash
# 跨部門 PM→DEV — 開 feat/ 分支，在主 repo 執行
git checkout -b feat/<slug>

# 單一部門 — 不開分支，直接在 main 操作（無需執行指令）
```

### `.shiftblame/` 隔離規則

`.shiftblame/` 永遠只存在於主工作目錄（main repo）。流程文件一律寫入主 repo 的 `.shiftblame/<slug>/`。

## 退回處理

退回採**不溯及既往**原則。L3~L5 問題記為技術債，由下一輪 NNN 處理。

L0~L2 內部退回：
- **計畫問題**（需求範圍變更、根本設計缺陷）→ 退回 L0（PLANNED）
- **執行問題**（L1 產出不完整）→ 退回 L1（EXECUTED）
- **驗收問題**（報告微調）→ L2 直接修復

跨部門問題：DEV 發現需求定義缺陷 → 退回 PM（跨部門）。

```bash
# DEV 退回前先 commit
git add -A
git commit -m "fix(<slug>): 退回前暫存"
```

```bash
# 回溯：撤回該角色所有變更回到 001
git log --oneline --grep="<ROLE>/001" | tail -1
git reset --hard <initial-hash>
```

## 階段交接

### PM→DEV（跨部門）

PM 對話二 PASSED 後交接 DEV：

```bash
# 1. 建立 handoff.md（跨部門交接資料）
mkdir -p .shiftblame/<slug>/shared
# Read .shiftblame/<slug>/PM/<NNN>/conclusion.md
# Write .shiftblame/<slug>/shared/handoff.md — 彙整結論關鍵資訊

# 2. 更新 SLUG.md 管線狀態紀錄
# Edit .shiftblame/<slug>/SLUG.md — 追加 PM/<NNN> PASSED

# 3. Commit 所有變更
git add -A
git commit -m "feat(<slug>): PM→DEV 階段交接"
```

4. 輸出階段摘要
5. **停止處理**，提醒老闆開新對話執行 DEV

### 同類串接

對話一串接（多 NNN 執行期）：

```bash
# 對話一 NNN 001 完成後 → 開新對話 → 對話一 NNN 002
# Read .shiftblame/<slug>/SLUG.md — 判定最新狀態
# 建立新 NNN 目錄
mkdir -p .shiftblame/<slug>/<ROLE>/002
# Write plan.md, task.md 等
```

對話二串接（多 NNN 品管/品控期）：

```bash
# 對話二 NNN 001 完成後 → 開新對話 → 對話二 NNN 002
# Read .shiftblame/<slug>/SLUG.md — 判定最新狀態與技術債
```

## PRD/SOP

`.shiftblame/PRD/` 產品需求文件（PM 參照）。`.shiftblame/SOP/` 標準作業程序（DEV 遵循）。非強制參照，不受閘門約束。
