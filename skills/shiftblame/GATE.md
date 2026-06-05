# GATE — 閘門檢查與狀態機

## 初始化

觸發技能時檢查 `.shiftblame/REPO.md` 與 `.shiftblame/ROADMAP.md` 是否存在。

| 情境 | 動作 |
|------|------|
| 皆存在 | 通過 |
| 缺 REPO.md 或 ROADMAP.md | BLOCK：手動補齊 |
| 無 `.shiftblame/` | 自動建立（見下方指令區塊） |

```bash
# 初始化 .shiftblame/ 目錄與模板
mkdir -p .shiftblame
# Write .shiftblame/REPO.md    — 使用 TEMPLATES/REPO.md 模板
# Write .shiftblame/ROADMAP.md — 使用 TEMPLATES/ROADMAP.md 模板
```

> **指令規範**：以下所有指令區塊以 bash 為主。若環境無法執行 bash，執行同等功能指令，不另建 PowerShell 版本。

## 雙對話制度

雙對話制度將六階段流程拆分為兩個獨立對話，不可混合：

| 對話 | 階段 | 產出 | 所屬期別 |
|------|------|------|---------|
| 對話一（執行對話） | L0 規劃確認 | plan.md | 研究期（PM）/ 開發期（DEV） |
| 對話一 | L1 執行任務 | task.md | 研究期 / 開發期 |
| 對話一 | L2 驗收成果 | result.md | 研究期 / 開發期 |
| 對話二（品管/品控對話） | L3 紅隊攻擊 | red.md | 品管期（PM）/ 維運期（DEV） |
| 對話二 | L4 藍隊防禦 | blue.md | 品管期 / 維運期 |
| 對話二 | L5 結論+收尾 | conclusion.md | 品管期 / 維運期 |

**面向自動綁定**：面向由對話階段決定，老闆不再指定。
- PM：研究期=研究面向、品管期=品管面向
- DEV：開發期=開發面向、維運期=維運面向

**同類串接**：對話一結束後→下一個對話一（新 NNN）；對話二結束後→下一個對話二（新 NNN）。老闆控制分期切換。

**不溯及既往**：L3~L5 發現的問題記錄為技術債，由下一輪 NNN 處理。不退回同 NNN 的 L0~L2 修正。

**上下文管理**：由老闆自行決定壓縮/清理。對話一結束後僅提醒「請開新對話進行 L3~L5 驗證」。

## 狀態機

```
雙對話流程：

對話一（執行對話）：L0 規劃確認 → L1 執行 → L2 驗收 → STOP → 提醒開新對話
對話二（品管/品控對話）：L3 紅隊 → L4 藍隊 → L5 結論+收尾

狀態轉移：
PLANNED → EXECUTED → APPROVED → RED → BLUE → CHECKED → PASSED
  (L0)      (L1)      (L2)     (L3)   (L4)    (L5)

同類串接：
對話一 → 對話一 → ...（老闆決定切換到對話二）
對話二 → 對話二 → ...（全部 NNN 驗證完畢 → 收尾）

技術債循環：
對話二發現問題 → 記錄技術債 → 新 NNN 對話一處理 → 對話二驗證
```

| 狀態 | 意義 | 必要文件 |
|------|------|----------|
| PLANNED | L0 規劃確認完成 | plan.md |
| EXECUTED | L1 執行完成，已 commit | + task.md（含「## 執行成果」） |
| APPROVED | L2 驗收通過 | + result.md |
| RED | L3 紅隊完成 | + red.md |
| BLUE | L4 藍隊完成 | + blue.md |
| CHECKED | 六檔齊全，待收尾 | + conclusion.md |
| PASSED | L5 通過（可能帶技術債） | — |

## 宣告生命週期

每個 L 階段文件（plan.md / task.md / result.md / red.md / blue.md / conclusion.md）含「## 階段生命週期」段落，記錄宣告時間與狀態。

| 宣告 | 寫入時機 | 寫入者 | 意義 |
|------|---------|--------|------|
| 宣告開始 | 階段開始 | 管理者 | L0 共識寫入文件，標誌階段正式開始 |
| 宣告完成 | 工作完成 | 管理者 | 執行成果摘要，標誌工作結束 |
| 宣告凍結 | 對話一結束 | 管理者 | 凍結狀態，等待對話二 |
| 宣告恢復 | 對話恢復 | 管理者 | 恢復狀態，接續工作 |

**規則**：
- 計畫不可更動：不得更動已 PLANNED 的前輪計畫範圍。需更動→回溯或進路線圖。計畫調整後狀態回到 PLANNED，必須重新 L0。
- L0 規劃確認由管理者與老闆確認需求後建立 plan.md
- L5 結論+收尾合併後置作業（驗證、歸檔）

## 呈現規則

面向老闆全部使用繁體中文，預設老闆不懂技術。階段指標使用「現在是 L*階段（名稱）」。管理者呈現成果時列出明確的動作選項。

**動作選項規則**：管理者呈現時必須列出每個動作選項會執行的具體內容，不得使用抽象詞彙（如「同意」「不同意」「調整」「通過」「未通過」）。範例：「修正 A1~A3 → 開新 NNN 處理技術債」「進入 L5 結論+收尾」。

## 審查序列

雙對話制度序列：

**對話一（L0~L2）**：
1. L0 規劃確認 → plan.md → PLANNED
2. L1 執行任務（依複雜度）→ commit → task.md → EXECUTED
3. L2 驗收成果（依複雜度）→ result.md → APPROVED
4. STOP → 提醒老闆開新對話進行 L3~L5

**對話二（L3~L5）**：
1. L3 紅隊攻擊（依複雜度）→ red.md → RED
2. L4 藍隊防禦（依複雜度）→ blue.md → BLUE
3. L5 結論+收尾（管理者）→ conclusion.md → CHECKED → PASSED
4. 若發現問題 → 記錄技術債 → 提醒老闆開新 NNN 對話一處理

L3/L4 嚴格序列執行，不得並行。

## 派工檢查

派工前確認 `SLUG.md` 與 `plan.md`（對話一）或 `result.md`（對話二）存在。缺任一 → BLOCK。

plan.md frontmatter：`slug, role, aspect, round, status, created_at, trigger, review: local, upstream`。`aspect` 由對話階段自動綁定。正文含 `# <ROLE>/<NNN>`、`## 階段生命週期` 與需求範圍。上游結論由管理者提供。

task.md frontmatter 同 plan.md，正文含 `## 階段生命週期` 與 `## 執行成果`。

**目錄結構驗證**：plan.md / task.md 必須位於 NNN 切片目錄內（`<slug>/<ROLE>/<NNN>/`）。直接出現在 `<slug>/` 或 `<slug>/<ROLE>/` 根目錄 → BLOCK。

**跨部門交接驗證**：跨部門流程（PM→DEV）時，交接資料必須存入 `shared/` 目錄。

## 分支規則

DEV 開發預設在主 repo 分支執行，不使用 worktree。

### 建立分支

```bash
# 跨部門 PM→DEV
git checkout -b feat/<slug>

# 單一部門 — 不開分支，直接在 main 操作（無需執行指令）
```

### 收尾指令

```bash
# 收尾 — 跨部門
git checkout main
git merge --no-ff feat/<slug>
git push
git branch -d feat/<slug>

# 收尾 — 單一部門 — 已在 main，直接推送
git push
```

### `.shiftblame/` 隔離規則

`.shiftblame/` 永遠只存在於主工作目錄（main repo）。流程文件一律寫入主 repo 的 `.shiftblame/<slug>/`。

## 退回規則

**不溯及既往**：L3~L5 發現的問題記錄為技術債，由下一輪 NNN 處理。不退回同 NNN 的 L0~L2 修正。

**L0~L2 內部退回**：
- L1 未通過：修改後重新執行，不升級 NNN
- L2 未通過：視問題性質判定
  - **計畫問題**（需求範圍需變更、根本設計缺陷）→ 退回 L0（PLANNED），重新規劃確認
  - **執行問題**（L1 產出不完整）→ 退回 L1（EXECUTED），重新執行
  - **驗收問題**（報告微調、格式修正）→ L2 直接修復

**L3~L5 問題處理**：
- 所有問題記錄為技術債
- 當前 NNN 仍 PASSED（帶技術債紀錄）
- 下一輪 NNN 的對話一處理技術債

**判定者**：管理者。向老闆呈現判定理由與動作選項。

**判定界線**：當「L2 直接修復」與「退回 L1」界線模糊時，以「是否能不修改 L1 產出而完成修復」為準。能不動 L1 → L2 直接修復；必須修改 L1 → 退回 L1。

**規則**：
- L0 老闆修改需求：重新 L0 規劃確認
- 計畫不可更動：已 PLANNED 的計畫範圍不得由後續階段變更
- 回溯：撤回該角色所有變更回到 001
- 定義問題（需求定義層面的缺陷）→ 退回 PM（跨部門）
- DEV 退回前先 commit：

```bash
git add -A
git commit -m "fix(<slug>): 退回前暫存"
```

## 對話隔離

### 對話一（執行對話）

L0~L2 完成後強制停止。輸出摘要，提醒老闆開新對話進行 L3~L5 驗證。

```bash
# 1. 更新 SLUG.md 管線狀態紀錄
# Edit .shiftblame/<slug>/SLUG.md — 追加 NNN 狀態紀錄

# 2. Commit 所有變更
git add -A
git commit -m "feat(<slug>): <ROLE>/<NNN> 對話一完成 (L0~L2)"
```

3. 寫入「宣告凍結」至 result.md
4. 輸出摘要，提醒老闆開新對話
5. **停止處理**

### 對話二（品管/品控對話）

L3~L5 完成後：
- 若有技術債 → 記錄至 SLUG.md → 提醒老闆開新 NNN 對話一處理
- 若無問題 → L5 PASSED → 收尾

```bash
# 1. 更新 SLUG.md 管線狀態紀錄
# Edit .shiftblame/<slug>/SLUG.md — 追加 NNN 狀態紀錄（含技術債）

# 2. Commit 所有變更
git add -A
git commit -m "feat(<slug>): <ROLE>/<NNN> 對話二完成 (L3~L5)"
```

### 恢復

新對話恢復時：

```bash
# Read .shiftblame/<slug>/SLUG.md — 判定最新狀態
# Read .shiftblame/ROADMAP.md — 讀取路線圖
# Read .shiftblame/REPO.md — 讀取專案現狀
# 依 SLUG.md 判定接續對話一或對話二
# 若有技術債 → 讀取 red.md / blue.md 了解技術債內容
```

## 跨部門檔案隔離

所有 slug 部門間的交接檔案、資料**一律留在 `.shiftblame/<slug>/` 內**，不得外洩到專案其餘資料夾。

- **跨部門通訊目錄**：`.shiftblame/<slug>/shared/`。PM→DEV 交接資料存放於此。
- **暫存文件**：可暫時存放 `tmp/`，但最終版本必須存入 slug 內
- **禁止外洩**：跨部門交接資料不得存放在 slug 目錄以外的任何專案位置
- **定義問題退回**：DEV 發現需求定義層面的缺陷（跨部門問題）→ 退回 PM，不適用不溯及既往規則

## 開新對話

雙對話制度下，每個對話只負責一個階段（對話一或對話二）。恢復：SLUG.md → ROADMAP.md → REPO.md。

## 上下文監控

管理者持續監控上下文用量。過高時強制觸發壓縮。compact hook 自動重新載入技能。
