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

## L0 溝通階段

L0 為統一的**溝通階段**（停下並溝通）。管理者在對話中向老闆報告目前狀態與下一步計畫，老闆可持續修改需求，L0 不寫入任何文件。L0 通過後，由當下狀態決定分流進入哪個 L(n)，共識寫入階段文件，正式執行。

- **手動模式**：每個 L(n) 前皆有 L0，分流由當下狀態決定
- **自動模式**：僅一次 L0，通過後 L1~L5 全自動執行。老闆可隨時喊停進入 L0
- L0 期間老闆修改需求 → 重新 L0 討論（等同退回）
- L0 通過 → 共識寫入文件 → 宣告開始 → 依狀態分流進入 L(n)

**分流規則**（L0 通過後，依當下狀態進入）：

| 狀態 | → 進入 |
|------|--------|
| DECLARED | L1 執行 |
| EXECUTED | L2 驗收 |
| APPROVED | L3 紅隊 |
| RED | L4 藍隊 |
| BLUE | L5 結論 |

## 狀態機

```
L0 溝通階段: 管理者向老闆報告目前狀態與下一步計畫（不寫文件）
             老闆修改需求 → 重新 L0 討論
             老闆同意 → 共識寫入文件 → 宣告開始 → 依狀態分流進入 L(n)

分流規則（L0 通過後，依當下狀態進入）：
DECLARED → L1 / EXECUTED → L2 / APPROVED → L3 / RED → L4 / BLUE → L5

L1 執行任務: L0 → 宣告開始 → APPROVED → 執行（依複雜度）→ commit → 宣告完成 → EXECUTED
                 宣告通過 → L0 → 分流 L2 / 未通過 → 修改後重新宣告完成
L2 驗收成果: L0 → 宣告開始 → 驗收（依複雜度）→ result.md → 宣告完成 → EXECUTED
                 宣告通過 → L0 → 分流 L3
                 未通過 → 當前修復（驗收報告微調）/ 退回 L1（執行不完整）/ 退回 DECLARED（原則性問題）
L3 紅隊攻擊: L0 → 宣告開始 → red.md（依複雜度）→ 宣告完成 → RED
                 宣告通過 → L0 → 分流 L4
                 未通過 → 當前修復（攻擊遺漏補充）/ 退回 L2（驗收漏洞）/ 退回 DECLARED（原則性問題）
L4 藍隊防禦: L0 → 宣告開始 → blue.md（依複雜度）→ 宣告完成 → BLUE
                 宣告通過 → L0 → 分流 L5
                 未通過 → 當前修復（防禦策略微調）/ 退回 L3（攻擊不全面）/ 退回 DECLARED（原則性問題）
L5 最終結論: L0 → 宣告開始 → conclusion.md（管理者）→ 宣告完成 → CHECKED
                 宣告通過 → PASSED → 收尾（PM：老闆決定歸檔或留 DEV 接續）
                 未通過 → 當前修復（結論文字調整）/ 退回 L4（防禦遺漏）/ 退回 DECLARED（原則性問題）

手動模式：每 L(n) 前皆有 L0 溝通階段。L0 通過後共識寫入文件，進入 L(n) 正式執行。
自動模式：僅一次 L0，通過後 L1~L5 全自動執行，中間不設閘門。老闆可隨時喊停進入 L0。
```

| 狀態 | 意義 | 必要檔案 |
|------|------|----------|
| DECLARED | 管理者已寫入宣告開始，等待執行 | task.md |
| APPROVED | 宣告通過(L1)，L1 執行任務開始 | task.md（含「## 執行成果」） |
| EXECUTED | result.md（驗收報告）已產出（依複雜度） | task.md + result.md |
| RED | red.md 已產出（依複雜度），待宣告通過 | + red.md |
| BLUE | blue.md 已產出（依複雜度），待宣告通過 | + blue.md |
| CHECKED | 五檔齊全，待宣告通過 | + conclusion.md |
| PASSED | 宣告通過(L5) | — |

**自動簡化路徑**：DECLARED → PASSED（中間狀態為內部流程紀錄，不設閘門）。

## 宣告生命週期

每個 L 階段（task.md / result.md / red.md / blue.md / conclusion.md）必須依序完成以下宣告，**寫入該階段文件**：

**手動模式**：每階段先 L0 對話，通過後宣告開始，執行後宣告完成，審查後宣告通過。

**自動模式**：僅在 task.md 寫入一次「宣告開始」（涵蓋整個角色階段計畫），老闆明確指示同意後 L1~L5 全自動執行，中間不寫入宣告完成/宣告通過，完成後直接 PASSED。

| 宣告 | 寫入時機 | 寫入者 | 意義 |
|------|---------|--------|------|
| L0 | L(n) 正式階段前 | 管理者 | 純對話，不寫文件。向老闆報告目前狀態與下一步計畫，老闆可修改需求 |
| 宣告開始 | L0 通過後 | 管理者 | L0 共識寫入文件，標誌 L(n) 正式開始 |
| 宣告完成 | 工作完成 | 管理者 | 執行成果摘要，標誌工作結束 |
| 宣告通過 | 審查通過 | 管理者（依老闆選定動作）| 階段通過，可進入下一階段（自動不適用此列） |
| 宣告凍結 | 角色階段結束（PM→DEV 接續） | 管理者 | 凍結狀態，等待下一對話 |
| 宣告恢復 | 角色恢復 | 管理者 | 恢復狀態，從 SLUG.md 接續 |

**規則**：
- 手動：無「宣告通過」不得進入下一階段
- 自動：L0 通過後全自動執行，中間不設閘門
- L1 未通過：修改後重新「宣告完成」，再次等待「宣告通過」
- L2~L5 未通過：依三分法判定退回目標（見「退回規則」）
- L0 老闆修改需求：重新 L0 對話
- 宣告凍結/宣告恢復適用於 PM PASSED 後不歸檔、留至下一對話執行 DEV 的情境

**階段文件格式**：每份階段文件含「## 階段生命週期」段落，以表格記錄各宣告的時間與狀態。管理者隨階段進展逐項填入。

**計畫不可更動**：不得更動已宣告通過的前輪計畫範圍。需更動→回溯或進路線圖。計畫調整後狀態回到 DECLARED，必須重新 L0。

## 宣告通過

「宣告通過」為階段通過機制，適用於手動模式。管理者完成階段工作並寫入「宣告完成」後，向老闆呈現成果並列出明確的**動作選項**，老闆直接選擇動作，管理者將選定動作寫入該階段文件。不得自行假設通過。

**自動模式**：僅在角色階段開始時一次「L0」。老闆明確指示同意後，L1~L5 全自動執行，中間不需再次宣告。

**動作選項規則**：管理者呈現時必須列出每個動作選項會執行的具體內容，不得使用抽象詞彙（如「同意」「不同意」「調整」「通過」「未通過」）。範例：「修正 A1~A3 → 退回 DECLARED」「進入 L4 藍隊防禦」。

**呈現規則**：面向老闆全部使用繁體中文，預設老闆不懂技術。階段指標使用「現在是 L*階段（名稱）」。管理者呈現「宣告完成」內容與成果摘要，列出動作選項，等待老闆選擇。

**通過流程（手動）**：
1. L0 對話 — 管理者向老闆報告目前狀態與下一步計畫（不寫文件）
2. L0 通過 — 共識寫入文件（宣告開始），依狀態分流進入 L(n)
3. 執行 L(n) — 依複雜度執行
4. 宣告完成 — 管理者寫入執行成果
5. 老闆選擇動作 → 宣告通過或退回

**自動通過流程**：L0 對話 → 老闆明確指示同意 → L1~L5 全自動執行 → PASSED。執行期間老闆可隨時喊停進入 L0，由當下狀態決定分流。

`BossPreview`：DEV 期間即時觀看機制，不是正式閘門，不取代宣告通過。

## 審查序列

嚴格序列執行，L3/L4 不得並行：

**手動模式**（每階段 L0 + 閘門）：
1. L0 → 宣告開始(L1) → 依複雜度執行 → commit → 宣告完成(L1) → 宣告通過(L1)
2. L0 → 宣告開始(L2) → 驗收（依複雜度）→ result.md → 宣告完成(L2) → 宣告通過(L2)
3. L0 → 宣告開始(L3) → 紅隊攻擊（依複雜度）→ red.md → 宣告完成(L3) → 宣告通過(L3)
4. L0 → 宣告開始(L4) → 藍隊防禦（依複雜度）→ blue.md → 宣告完成(L4) → 宣告通過(L4)
5. L0 → 宣告開始(L5) → conclusion.md（管理者）→ 宣告完成(L5) → 宣告通過(L5) → PASSED

**自動模式**（僅 L0，全自動）：
L0 → 宣告開始 → L1 → L2 → L3 → L4 → L5 → PASSED（中間無閘門，老闆可隨時喊停進入 L0）

自動模式 PM→DEV 串接：每個角色各自一次 L0 → 全自動 L1~L5 → PASSED → 開新對話接續下一角色。

L2~L5 宣告通過未通過：依三分法判定退回目標（見「退回規則」）。自動模式：原則性問題退回至初始宣告重新開始；其餘問題自動修復後繼續。

## 派工檢查

派工前確認 `SLUG.md` 與 `task.md` 存在。缺任一 → BLOCK。task.md frontmatter：`slug, role, round, status, created_at, trigger, review: local, upstream`。正文含 `# <ROLE>/<NNN>`、`## 階段生命週期` 與 `## 執行成果`。上游結論由管理者提供。PRD/SOP 非強制參照。**目錄結構驗證**：task.md 必須位於 NNN 切片目錄內（`<slug>/<ROLE>/<NNN>/task.md`）。task.md 直接出現在 `<slug>/` 或 `<slug>/<ROLE>/` 根目錄 → BLOCK。**跨部門交接驗證**：跨部門流程（PM→DEV）時，交接資料必須存入 `shared/` 目錄，不得散落在 slug 以外的專案位置。

## Worktree 閘門

### 建立分支

```bash
# 手動模式（跨部門 PM→DEV）
git checkout -b feat/<slug>

# 手動模式（單一部門）— 不開分支，直接在 main 操作（無需執行指令）

# 自動模式 — 優先使用環境內建 worktree 工具（如 EnterWorktree）
# 若無內建工具，使用以下指令：
git worktree add .worktrees/<slug> -b feat/<slug>
# <worktree_path> = 實際建立路徑（框架預設 .worktrees/<slug>，環境工具可能自訂）
```

### 收尾指令

```bash
# 收尾 — 手動模式（跨部門 PM→DEV）
git checkout main
git merge --no-ff feat/<slug>
git push
git branch -d feat/<slug>

# 收尾 — 手動模式（單一部門）— 已在 main，直接推送
git push

# 收尾 — 自動模式
git checkout main
git merge --no-ff feat/<slug>
git push
# <worktree_path> 為實際建立路徑
git worktree remove <worktree_path>
git branch -d feat/<slug>
```

### `.shiftblame/` 隔離規則

`.shiftblame/` 永遠只存在於主工作目錄（main repo），不得出現在任何 worktree 中。流程文件（SLUG.md、task.md、result.md 等）一律寫入主 repo 的 `.shiftblame/<slug>/`。Worktree 僅用於程式碼/定義檔變更。此規則不受 worktree 實際路徑影響。

```bash
# 驗證 worktree 中無 .shiftblame/
test ! -d <worktree_path>/.shiftblame/  # 若失敗 → BLOCK

# 若 worktree 內誤建 .shiftblame/ → BLOCK，管理者執行以下搬移：
mv <worktree_path>/.shiftblame/ .shiftblame/
```

## 退回規則

退回採**三分法**，管理者依問題性質判定歸類，向老闆說明並由老闆選擇動作（手動模式）：

| 問題類型 | 定義 | 退回目標 | 範例 |
|----------|------|----------|------|
| **原則性問題** | 計畫範圍需變更、需求理解有誤、根本性設計缺陷、目標無法達成 | → DECLARED（退回 L1） | L2~L5 皆適用 |
| **上游階段問題** | 上游產出有遺漏或不完整，非當前階段能獨立修復 | → 退回上游 L(n-1) | L2 發現 L1 執行不完整→退回 L1；L3 發現 L2 驗收漏洞→退回 L2；L4 發現 L3 攻擊不全面→退回 L3；L5 發現 L4 防禦遺漏→退回 L4 |
| **當前階段問題** | 報告文字微調、格式修正、不涉及上游產出的遺漏補充 | → 該階段直接修復 | L2~L5 皆適用 |

**判定者**：管理者。手動模式向老闆呈現判定理由與動作選項，老闆選擇後執行。自動模式由管理者直接判定。

**判定界線**：當「當前修復」與「上游退回」界線模糊時，以「是否能不修改上游產出而完成修復」為準。能不動上游 → 當前修復；必須修改上游 → 上游退回。

**規則**：
- L0 老闆修改需求：重新 L0 對話（不影響已寫入文件的內容）
- L1 未通過：修改後重新宣告完成
- L2~L5 未通過：依上表判定退回目標，非一律退回 DECLARED
- **上游退回流程**：退回上游 L(n-1) 後，L(n-1) 從該階段狀態重新開始（手動模式需重新 L0；自動模式直接重新執行 L(n-1)）。L(n-1) 完成後接續執行 L(n)，不跳過中間階段。狀態回溯至 L(n-1) 對應的狀態值。
- 當前修復不更改狀態，修正後重新宣告完成
- DEV 退回前先 commit：

```bash
git add -A
git commit -m "fix(<slug>): 退回前暫存"
```
- 定義問題（需求定義層面的缺陷）→ 退回 PM（跨部門，見 MANAGE.md「退回處理」）
- 回溯→撤回該角色所有變更回到 001
- 計畫更動判定→回溯或進路線圖
- **自動模式修復上限**：同一問題連續自動修復 3 次仍未通過 → 升級為原則性問題，退回至初始宣告重新開始

**自動模式**：原則性問題退回至初始宣告重新開始；上游/當前問題由管理者自動修復後繼續執行（受修復上限約束）。

## 歸檔

- **PM L5 PASSED** → 老闆決定：歸檔 → 收尾；或 不歸檔 → 留至下一對話執行 DEV
- **DEV L5 PASSED** → 收尾

### 收尾歸檔指令

```bash
# === Step 1: 收尾確認 ===
# 檢查：無殭屍程序、無開發殘留、臨時檔案在 tmp/、.shiftblame/ 不納入版本控制

# === Step 2: 合併（手動跨部門 / 自動模式） ===
git checkout main
git merge --no-ff feat/<slug>   # 禁止 squash

# Step 2（手動單一部門）— 已在 main，跳過合併

# === Step 3: 推送 ===
git push

# === Step 4: 清理分支 ===
# 手動跨部門：
git branch -d feat/<slug>
# 手動單一部門 — 無需清理
# 自動模式（<worktree_path> 為實際建立路徑）：
git worktree remove <worktree_path>
git branch -d feat/<slug>

# === Step 5: 歸檔 ===
mkdir -p .shiftblame/archive
mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/
# 若同名已存在，遞增版本號：
# mv .shiftblame/<slug>/ .shiftblame/archive/<slug>-v2/
# mv .shiftblame/<slug>/ .shiftblame/archive/<slug>-v3/  （以此類推）

# === Step 6: 確認原目錄已刪除 ===
test ! -d .shiftblame/<slug>/

# === Step 7: 更新 REPO.md + ROADMAP.md ===
# Read .shiftblame/archive/<slug>/SLUG.md
# Edit .shiftblame/REPO.md    — 記錄「完成了什麼」
# Edit .shiftblame/ROADMAP.md — 記錄「未來預計做什麼」
```

## 每角色階段對話隔離

### 手動模式（PM→DEV 接續）

PM PASSED 後老闆決定不歸檔 → 留至下一對話執行 DEV：

```bash
# 1. 更新 SLUG.md 管線狀態紀錄
# Edit .shiftblame/<slug>/SLUG.md — 追加 PM/<NNN> PASSED 紀錄

# 2. Commit 所有變更
git add -A
git commit -m "feat(<slug>): PM/<NNN> PASSED"

# 3. 寫入「宣告凍結」
# Edit <階段文件>  — 在「## 階段生命週期」表格追加 | 宣告凍結 | <ISO 8601> | FROZEN |
# Edit .shiftblame/<slug>/SLUG.md — 記錄宣告凍結
```

4. 輸出階段摘要，提醒老闆開新對話以執行 DEV
5. **停止處理**

恢復時：

```bash
# Read .shiftblame/<slug>/SLUG.md — 判定最新狀態
# Edit <階段文件>  — 寫入「宣告恢復」：在「## 階段生命週期」表格追加 | 宣告恢復 | <ISO 8601> | RESUMED |
```

### 自動模式

每角色階段 PASSED 後強制開新對話。新對話恢復時，管理者讀取 SLUG.md 管線狀態紀錄，判定最後 PASSED 的角色，接續下一角色。

## 跨部門檔案隔離

所有 slug 部門間的交接檔案、資料**一律留在 `.shiftblame/<slug>/` 內**，不得外洩到專案其餘資料夾。

- **跨部門通訊目錄**：`.shiftblame/<slug>/shared/`。PM→DEV 交接資料存放於此。若已有既有分享目錄（判定標準：該目錄專門存放跨部門交接資料、非單一部門產物）則不更動。
- **暫存文件**：可暫時存放 `tmp/`，但最終版本必須存入 slug 內（部門目錄或 `shared/`）
- **禁止外洩**：跨部門交接資料不得存放在 slug 目錄以外的任何專案位置
- **派工檢查**：管理者在階段交接前驗證所有交接檔案已存入 `shared/`
- **定義問題退回**：DEV 發現需求定義層面的缺陷（跨部門問題）→ 退回 PM（見 MANAGE.md「退回處理」），不適用三分法的同部門退回邏輯

## 開新對話

手動模式 PM→DEV 接續：老闆決定不歸檔後開新對話。自動模式：每角色 PASSED 後**強制**開新對話。恢復：SLUG.md → ROADMAP.md → REPO.md。

## 上下文監控

管理者持續監控上下文用量。過高時強制觸發壓縮。compact hook 自動重新載入技能。
