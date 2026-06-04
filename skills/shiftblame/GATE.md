# GATE — 閘門檢查與狀態機

## 初始化

觸發技能時檢查 `.shiftblame/REPO.md` 與 `.shiftblame/ROADMAP.md` 是否存在。

| 情境 | 動作 |
|------|------|
| 皆存在 | 通過 |
| 缺 REPO.md 或 ROADMAP.md | BLOCK：手動補齊 |
| 無 `.shiftblame/` | 自動建立 + 模板 |

## 狀態機

```
L1 執行任務: 宣告開始 → APPROVED → 執行（依複雜度）→ commit → 宣告完成 → EXECUTED
                宣告通過 → L2 / 未通過 → 修改後重新宣告完成
L2 驗收成果: 宣告開始 → 驗收（依複雜度）→ result.md → 宣告完成 → EXECUTED
                宣告通過 → L3 / 未通過 → 退回 DECLARED
L3 紅隊攻擊: 宣告開始 → red.md（依複雜度）→ 宣告完成 → RED
                宣告通過 → L4 / 未通過 → 退回 DECLARED
L4 藍隊防禦: 宣告開始 → blue.md（依複雜度）→ 宣告完成 → BLUE
                宣告通過 → L5 / 未通過 → 退回 DECLARED
L5 最終結論: 宣告開始 → conclusion.md（管理者）→ 宣告完成 → CHECKED
                宣告通過 → PASSED → 宣告凍結（FEATURE）/ 收尾（其他模式）
                未通過 → 退回 DECLARED

全閘門宣告通過：DEV/FEATURE/PM 由老闆宣告通過；AUTO 模式自動通過。宣告寫入各階段文件。L2~L5 未通過一律退回 DECLARED。L1~L4 依複雜度決定在對話內執行或開子代理隔離（見 MANAGE.md「上下文隔離」）。
```

| 狀態 | 意義 | 必要檔案 |
|------|------|----------|
| DECLARED | 管理者已向老闆宣告（對話動作），等待確認 | task.md |
| APPROVED | 老闆同意，L1 執行任務開始 | task.md（含「## 執行成果」） |
| EXECUTED | result.md（驗收報告）已產出（依複雜度） | task.md + result.md |
| RED | red.md 已產出（依複雜度），待宣告通過 | + red.md |
| BLUE | blue.md 已產出（依複雜度），待宣告通過 | + blue.md |
| CHECKED | 五檔齊全，待老闆確認 | + conclusion.md |
| PASSED | 老闆確認通過 | — |

## 宣告生命週期

每個 L 階段（task.md / result.md / red.md / blue.md / conclusion.md）必須依序完成以下宣告，**寫入該階段文件**：

| 宣告 | 寫入時機 | 寫入者 | 意義 |
|------|---------|--------|------|
| 宣告開始 | 階段啟動 | 管理者 | 本階段計畫內容，標誌階段開始 |
| 宣告完成 | 工作完成 | 管理者 | 執行成果摘要，標誌工作結束 |
| 宣告通過 | 審查通過 | 手動：老闆 / AUTO：自動 | 階段通過，可進入下一階段 |
| 宣告凍結 | 角色階段結束（FEATURE） | 管理者 | 凍結狀態，等待老闆切換對話 |
| 宣告恢復 | 角色恢復（FEATURE） | 管理者 | 恢復狀態，從 SLUG.md 接續 |

**規則**：
- 無「宣告通過」不得進入下一階段
- AUTO 模式全閘門自動通過；PM/FEATURE/DEV 由老闆宣告通過
- L1 未通過：修改後重新「宣告完成」，再次等待「宣告通過」
- L2~L5 未通過：一律退回 DECLARED 重新宣告
- 宣告凍結/宣告恢復僅適用於 FEATURE 模式角色切換

**階段文件格式**：每份階段文件含「## 階段生命週期」段落，以表格記錄各宣告的時間與狀態。管理者隨階段進展逐項填入。

**計畫不可更動**：不得更動已宣告通過的前輪計畫範圍。需更動→回溯或進路線圖。計畫調整後狀態回到 DECLARED，必須重新宣告開始。

## 宣告通過

「宣告通過」為階段通過機制：管理者完成階段工作並寫入「宣告完成」後，向老闆呈現成果，老闆宣告通過後管理者將通過紀錄寫入該階段文件。不得自行假設通過。

**呈現規則**：面向老闆全部使用繁體中文，預設老闆不懂技術。階段指標使用「現在是 L*階段（名稱）」。管理者呈現「宣告完成」內容與成果摘要，等待老闆回應。

**通過流程**：
1. 管理者向老闆呈現本階段「宣告完成」內容（繁體中文）
2. 老闆回應：
   - 通過 → 管理者寫入「宣告通過」到該階段文件，進入下一階段
   - 未通過 → 依退回規則處理（L1 修改重呈；L2~L5 退回 DECLARED）
3. AUTO 模式：全閘門自動通過，管理者直接寫入「宣告通過」

`BossPreview`：DEV 期間即時觀看機制，不是正式閘門，不取代宣告通過。

## 審查序列

嚴格序列執行，L3/L4 不得並行：

1. 宣告開始(L1) → 依複雜度執行 → commit → 宣告完成(L1) → 宣告通過(L1)
2. 宣告開始(L2) → 驗收（依複雜度）→ result.md → 宣告完成(L2) → 宣告通過(L2)
3. 宣告開始(L3) → 紅隊攻擊（依複雜度）→ red.md → 宣告完成(L3) → 宣告通過(L3)
4. 宣告開始(L4) → 藍隊防禦（依複雜度）→ blue.md → 宣告完成(L4) → 宣告通過(L4)
5. 宣告開始(L5) → conclusion.md（管理者）→ 宣告完成(L5) → 宣告通過(L5) → PASSED

L2~L5 宣告通過未通過一律退回 DECLARED 重新宣告，不分模式。

## 派工檢查

派工前確認 `SLUG.md` 與 `task.md` 存在。缺任一 → BLOCK。task.md frontmatter：`slug, role, round, status, created_at, trigger, review: local, upstream`。正文含 `# <ROLE>/<NNN>` 與 `## 執行成果`。上游結論由管理者提供。PRD/SOP 非強制參照。**目錄結構驗證**：task.md 必須位於 NNN 切片目錄內（PM/DEV：`.shiftblame/<slug>/<NNN>/task.md`；FEATURE/AUTO：`.shiftblame/<slug>/<ROLE>/<NNN>/task.md`）。task.md 直接出現在 `<slug>/` 根目錄 → BLOCK。

## Worktree 閘門

僅 AUTO 模式使用 worktree（`.worktrees/<slug>`）。FEATURE 在主工作目錄開分支。PM/DEV 不使用功能分支。

- **FEATURE**：`git checkout -b feat/<slug>`
- **AUTO**：`git worktree add .worktrees/<slug> -b feat/<slug>`
- 收尾（FEATURE）：merge → push → branch delete
- 收尾（AUTO）：merge → push → worktree remove → branch delete

## 退回規則

- L1 宣告通過未通過：修改後重新宣告完成。L2~L5 宣告通過未通過：一律退回 DECLARED 重新宣告，不分模式。AUTO 模式全閘門自動通過。DEV 退回前先 commit。定義問題→退回 PM。回溯→撤回該角色所有變更回到 001。

## 歸檔

所有角色 PASSED → FEATURE/AUTO：merge --no-ff → push → branch delete（AUTO 額外 worktree remove）；PM/DEV：push → 歸檔 `mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/` → 更新 REPO.md + ROADMAP.md（AUTO 額外更新 RAPID.md，見 MANAGE.md 收尾步驟 7）。

## 每角色階段對話隔離

### FEATURE 模式：角色對話持久化

PM 與 DEV 各維持一個持久對話，透過凍結/恢復機制切換。首次 PM PASSED 後老闆開啟新對話作為 DEV 對話；之後每次角色切換，老闆在兩個已存在的對話間切換。PM 與 DEV 不得在同一對話內執行。

**凍結/恢復機制**：
- **宣告凍結**：角色階段 PASSED 後，管理者寫入「宣告凍結」到該階段文件與 SLUG.md，輸出階段摘要，提醒老闆切換到另一個角色的對話，然後**停止處理**。
- **宣告恢復**：老闆回到該角色的對話時，管理者讀取 SLUG.md 判定最新狀態，寫入「宣告恢復」到該階段文件，接續執行。

SLUG.md 管線狀態紀錄格式：`<ROLE>/<NNN> <STATUS>`（例：PM/001 PASSED）。恢復時讀取最後一筆紀錄判定：PM PASSED → DEV；DEV PASSED → PM 或收尾。

階段內部流程不受影響：單一角色階段的 L1~L5 閘門、攻擊防禦、FAIL 重跑均在同一對話內完成。

### AUTO / PM / DEV 模式

AUTO：每角色階段 PASSED 後強制開新對話。PM/DEV：slug 收尾後建議開新對話。

## 開新對話

FEATURE：使用角色對話持久化（凍結/恢復），僅首次 PM→DEV 時開啟新對話。AUTO：每角色階段 PASSED 後**強制**開新對話。PM/DEV：slug 收尾後建議開新對話。恢復：SLUG.md → ROADMAP.md → REPO.md。

## 上下文監控

管理者持續監控上下文用量。過高時強制觸發壓縮。compact hook 自動重新載入技能。
