# shiftblame — 狀態機閘門

統一閘門檢查定義。管理者在每次狀態轉移前，依下表驗證必要條件；不通過則中止並報告缺件。

## 狀態與轉移

五階段 FAIL 狀態機：

```
L1 宣告:   DECLARED ──BossConfirm FAIL──→ DECLARED（重新宣告）
                └──agree──→ APPROVED

L2 產出:   APPROVED ──→ EXECUTED（result.md）──BossConfirm──→（繼續 L3）
                └──老闆要求修改──→ DECLARED（重新宣告，BossConfirm 後再 APPROVED → EXECUTED → BossConfirm）

L3 紅隊:   L2 BossConfirm 通過後 ──→ 紅隊寫入 red.md ──→ 管理者驗證 ──→ RED

L4 藍隊:   RED ──→ 藍隊寫入 blue.md ──→ 管理者驗證 ──→ BLUE
                └──FAIL──→ EXECUTED（退回 L2 原地修復 result.md）
                              └──BossConfirm 通過──→ L3 紅隊 → L4 藍隊 → L5 結論
                              └──BossConfirm FAIL──→ EXECUTED（繼續修改，見 L4 FAIL 修復閘門）

L5 結論:   BLUE ──PASS──→ CONCLUSION（管理者寫入 conclusion.md）──→ CHECKED ──BossConfirm FAIL──→ DECLARED（退回 L1 重新宣告）
                                                                └──BossConfirm PASSED──→ PASSED
```

FAIL 規則：
- L1 BossConfirm FAIL → 返回 L1 重新宣告
- L2 BossConfirm（result 確認）→ 老闆要求修改則返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm
- L4 藍隊 FAIL → 退回 L2 原地修復（EXECUTED），執行者修正 result.md → BossConfirm（L4 修復確認）→ L3 紅隊 → L4 藍隊 → L5 結論，直到藍隊 PASS。不觸發 DECLARED 狀態轉移，不更新 task.md 宣告段落。L4 FAIL 修復後 BossConfirm FAIL 仍留在 EXECUTED 繼續修改（見 L4 FAIL 修復閘門）
- L5 BossConfirm FAIL → 退回 L1 重新宣告（DECLARED），需重新走 BossConfirm
- 需 BossConfirm 的 FAIL：L1 宣告確認、L2 result 確認、L5 結論確認
- 不需 BossConfirm 的 FAIL：L4 藍隊 FAIL（打回上游）（上游自行走完整流程）
- FAIL 修改不刪除（保留完整追溯紀錄）。L4 藍隊 FAIL 原地修復不觸發 DECLARED 狀態轉移，不更新 task.md 宣告段落；L2 BossConfirm FAIL 時必須更新宣告段落（例外：L4 FAIL 退回 L2 修復後的 BossConfirm FAIL 不在此限，見 L4 FAIL 修復閘門，仍留在 EXECUTED 繼續修改）。增量攻防機制（在既有 red.md/blue.md 後追加新回合）本身不要求修改宣告段落
- 不得刪除既有攻防紀錄；FAIL 重跑時在既有內容後追加新回合（以 `---` 與回合標題分隔）
- L4 藍隊 FAIL 另有打回上游選項（問題在上游定義，退回上游修正）
- 宣告更新：更新宣告內容後狀態回到 DECLARED，必須重新走 BossConfirm，不得視為自動 APPROVED
- L4 FAIL 修復閘門：L4 藍隊 FAIL 退回 L2 原地修復後，BossConfirm 確認修復後的 result.md。此 BossConfirm FAIL 時仍留在 EXECUTED 繼續修改 result.md，不退回 DECLARED，不更新 task.md 宣告段落。僅在管理者判定需更新 task.md 宣告段落時，依 L2 BossConfirm FAIL 規則退回 DECLARED。適用 FEATURE/MAIN/RAPID 三種模式。

### DEV/QC 單循環（FEATURE 模式）

DEV（產品開發）和 QC（驗收上線）適用單循環，與 PM/QA 一致。L1 即為計畫宣告（對標研究部門的 L1 行為），L2 產出含技術規劃+技術設計+技術實作的完整 result.md，L3-L5 跑紅藍攻防。L1↔L2 迭代循環：L2 BossConfirm FAIL → DECLARED，反覆宣告-執行直到老闆滿意才進入紅藍。PM（專案計畫）和 QA（品質保證）同樣適用單循環。

合併歸檔狀態機（驗收上線閘門通過後）：

```
MERGED ──PUSH──→ PUSHED ──ARCHIVE──→ ARCHIVED ──UPDATE──→ UPDATED
```

### MAIN 模式

日常文件維護、生產環境部署、小型修復、配置變更等操作一律使用 MAIN 模式，不需老闆指定。功能開發、快速迭代、原型驗證等操作一律使用 RAPID 模式（預設），不需老闆指定。僅在老闆明確指定需要完整 QA/QC 流程時使用 FEATURE 模式。

MAIN 模式五階段 FAIL 狀態機與 FEATURE 模式一致。差異：

- 目錄結構：`.shiftblame/<slug>/<NNN>/`（扁平，無 DEPT 層級）
- 無部門前置條件、無上游讀取、無功能分支
- result.md 無部門三段式內容要求，直接描述工作成果
- conclusion.md 須包含最終結論與紅藍整合摘要（無跨部門推進聲明）
- task.md 使用 `mode: main` 欄位取代 `department` 欄位
- L4 藍隊 FAIL 無打回上游選項（無上游）

MAIN 模式收尾狀態機：

```
PASSED ──COMMIT──→ COMMITTED ──PUSH──→ PUSHED ──ARCHIVE──→ ARCHIVED ──UPDATE──→ UPDATED
```

MAIN 模式中 COMMIT 步驟為確認閘門（驗證所有變更已 commit），非首次 commit。首次 commit 在 result.md 產出前完成（見 Commit 閘門）。

MAIN 模式退回規則：
- L1 BossConfirm FAIL → 返回 L1 重新宣告。需 BossConfirm。
- L2 BossConfirm FAIL（result 確認）→ 返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm。需 BossConfirm。
- L4 藍隊 FAIL → 退回 L2 原地修復（EXECUTED），執行者修正 result.md → BossConfirm → L3 紅隊 → L4 藍隊 → L5 結論，直到藍隊 PASS。採增量攻防（不得刪除既有攻防紀錄，新回合追加在既有紀錄之後）。L4 FAIL 修復後 BossConfirm FAIL 仍留在 EXECUTED 繼續修改（見 L4 FAIL 修復閘門）。
- L5 BossConfirm FAIL → 退回 L1 重新宣告。需 BossConfirm。
- 回溯：撤回該 slug 所有變更（git 與 .shiftblame/），回到 001。需 BossConfirm

### RAPID 模式

RAPID 模式用於功能開發（預設）、快速驗證想法、原型開發或小型功能迭代。功能開發一律使用 RAPID 模式（預設），不需老闆指定；僅在老闆明確要求完整 QA/QC 流程時使用 FEATURE 模式。跳過 QA 和 QC，簡化管線為 PM→DEV→PM→DEV→收尾。

RAPID 模式五階段 FAIL 狀態機與 FEATURE 模式一致（各部門內部五階段不變）。差異：

- 使用功能分支（`feat/<slug>`），目錄結構同 FEATURE（`.shiftblame/<slug>/<DEPT>/<NNN>/`）
- 僅使用 PM 和 DEV 目錄，不走 QA 和 QC
- PM 與 DEV 交替迭代，每輪 PASSED 後管理者詢問老闆「繼續迭代（交給對方）或進入收尾」
- 下游讀取上游已 PASS 的 conclusion.md
- result.md 段式要求同 FEATURE（PM 四段式、DEV 三段式）
- task.md 使用 `mode: rapid` 欄位
- L4 藍隊 FAIL 退回僅限 PM↔DEV 之間（退回前先 commit、紅藍隊判定原因、老闆覆核）

RAPID 模式收尾狀態機：

```
PASSED ──COMMIT──→ COMMITTED ──MERGE──→ MERGED ──PUSH──→ PUSHED ──ARCHIVE──→ ARCHIVED ──UPDATE──→ UPDATED
```

RAPID 模式退回規則：
- L1 BossConfirm FAIL → 返回 L1 重新宣告。需 BossConfirm。
- L2 BossConfirm FAIL（result 確認）→ 返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm。需 BossConfirm。
- L4 藍隊 FAIL（原地修復）→ 同部門 NNN 不變，退回 L2 原地修復（EXECUTED）。修復後 BossConfirm → L3→L4→L5（見 L4 FAIL 修復閘門）。
- L4 藍隊 FAIL（退回對方部門）→ PM→DEV 或 DEV→PM，退回前先 commit。紅藍隊判定退回原因：定義問題（需求、規格或前端設計有誤）→退回 PM；實作問題（功能不符合規格、錯誤、效能）→原地修復。管理者向老闆報告退回原因與目標部門，經老闆覆核確認後才執行。需 BossConfirm。RAPID 模式無 QA 部門，「標準問題→退回 QA」路徑不適用。
- L5 BossConfirm FAIL → 退回 L1 重新宣告。需 BossConfirm。
- 回溯：撤回該 slug 所有變更，回到 001。需 BossConfirm。

MAIN 模式 task.md 模板：

```markdown
---
slug: <slug>
mode: main
round: <NNN>
status: PENDING
created_at: <ISO 8601>
trigger: <觸發原因>
review: local
---

# <NNN> <觸發原因>任務：<標題>

## 宣告

```

#### G1-MAIN — 派工（MAIN 模式）

**檢查**：`<slug>/SLUG.md` 與 `<slug>/<NNN>/task.md` 是否存在。

| 情境 | 動作 |
|------|------|
| `SLUG.md` 與 `task.md` 存在 | 通過 |
| 缺 `SLUG.md` | BLOCK：先建立 `<slug>/SLUG.md` |
| 目錄存在但無 `task.md` | BLOCK：先建立 task.md |
| 無對應目錄 | BLOCK：先建立目錄結構 |

#### G2-MAIN — 閘門審查（MAIN 模式）

與 G2 相同的五階段序列。差異：result.md 無部門三段式內容要求、無上游結論讀取、conclusion.md 無跨部門推進聲明。

MAIN 模式 commit 在 result.md 產出前執行（與 FEATURE 模式一致），紅隊使用 `git diff HEAD`（上一個 commit 以來的差異）檢視。不得使用 `git diff HEAD~1`（上上個 commit 的範圍）。

#### G3-MAIN — 歸檔（MAIN 模式）

PASSED 後：確認所有變更已 commit → push → 歸檔 → 更新 REPO.md/ROADMAP.md。無功能分支、無 merge。首次 commit 在 result.md 產出前完成。

| 狀態 | 意義 | 必要檔案 |
|------|------|----------|
| UNINIT | 尚未初始化 | 無 |
| READY | 可開始任務 | `.shiftblame/REPO.md` + `.shiftblame/ROADMAP.md` |
| TASK | 任務已建立 | `<slug>/SLUG.md` + `<slug>/<DEPT>/<NNN>/task.md` |
| DECLARED | 執行者已寫入宣告，等待老闆確認 | `task.md`（含非空「## 宣告」段落） |
| APPROVED | 老闆已同意宣告，可開始執行 | `task.md` |
| EXECUTED | result.md 已產出 | `task.md` + `result.md` |
| RED | red.md 已產出 | `task.md` + `result.md` + `red.md` |
| BLUE | blue.md 已產出 | `task.md` + `result.md` + `red.md` + `blue.md` |
| CONCLUSION | conclusion.md 已產出 | `task.md` + `result.md` + `red.md` + `blue.md` + `conclusion.md` |
| CHECKED | 閘門檢查完成（五檔齊全），待老闆確認 | — |
| PASSED | 老闆確認通過 | — |
| ARCHIVED | 已歸檔 | （已搬移至 `archive/`） |

合併歸檔狀態機（驗收上線閘門通過後）：

```
MERGED ──PUSH──→ PUSHED ──ARCHIVE──→ ARCHIVED ──UPDATE──→ UPDATED
```

## 閘門定義

### BossConfirm — 老闆確認

`BossConfirm` 是跨主開發環境的老闆確認機制：

| 目前環境 | 確認方式 |
|----------|----------|
| 支援內建提問工具 | 使用內建提問工具 |
| 一般對話環境 | 在目前對話中提出明確確認問題，等待使用者回覆後再繼續 |

凡文件寫 `BossConfirm`，皆代表必須等待老闆明確回覆通過、退回或調整方向；不得自行假設通過。

對老闆發出的確認問題必須預設對方不懂技術：使用繁體中文描述作品效果、可見變化與驗證結果，不得以技術術語作為主要確認內容。

面向老闆的所有詢問語言必須使用繁體中文。選項文字不得使用英文狀態機值（如 AGREE、DECLARED、APPROVED 等）。參考選項文字（非封閉列舉）：「同意」「不同意」「調整」「退回」「通過」「原地修復」「推進」「新執行切片」。狀態機值僅作為內部狀態記錄，不出現在老闆互動中。

**階段指標規則**：管理者在所有面向老闆的宣告與狀態報告中，必須使用「現在是 L*階段（階段名稱）」作為唯一階段指標（L1 宣告、L2 產出、L3 紅隊攻擊、L4 藍隊防禦、L5 結論）。不得以文件名稱（task.md、result.md、red.md、blue.md、conclusion.md）作為階段指標。

### BossPreview — DEV 即時預覽

`BossPreview` 是 DEV 期間的即時觀看與調整機制，不是正式閘門，不取代 `BossConfirm`。老闆可在 DEV 中多次要求觀看目前作品、驗證結果或下一個想調整的效果。管理者必須用中文提供可操作 URL/指令/截圖/畫面結果，並用一句話說明「目前作品已經能做到什麼」。若老闆提出下一個請求，管理者先用非技術語言確認「本回合要做出的可見功能」，再繼續 DEV。

### 宣告-確認-執行閘門

每一輪任務開始執行前，管理者必須向老闆確認宣告內容：

1. 執行者在 task.md「## 宣告」段落寫入本輪計畫（最低必要欄位：本輪目標、預期產出）
2. 管理者讀取宣告內容
3. 管理者向老闆 BossConfirm：用繁體中文說明「現在是 L1 階段（宣告）」、本輪要做什麼、預期產出什麼、這是本部門第幾輪
4. 老闆同意 → 狀態從 PENDING → APPROVED，開始執行
5. 老闆不同意 → 執行者調整宣告，重新確認

適用範圍：全部門（PM/QA/DEV/QC），每一輪。

建立 QA 任務前另有 PM 前置條件：PM 必須已通過閘門，且 QA task.md 的「上游輸入」必須引用或摘要 PM conclusion.md 的結論。未完成 PM 不得建立 QA task.md。

建立 DEV 任務前：管理者直接依 QA result.md 定義的完整功能列表建立 DEV task.md；task.md 不得只寫技術工作，必須明確寫出本回合要讓作品實際增加或改善的功能。


### 上下文監控與壓縮

管理者在全流程中持續監控上下文用量。監控時機：

- 狀態轉移前（特別是準備呼叫子代理前）
- 大量文件讀寫後（result.md、red.md、blue.md 產出後）
- BossConfirm 前
- 跨部門推進前
- 任何可能大幅增加上下文的操作前

上下文用量過高時，管理者直接強制觸發環境的壓縮上下文機制（非建議老闆執行），避免工作到一半因上下文爆炸而中斷。壓縮後 SessionStart hook 會自動重新載入 shiftblame 技能。compact hook 用於壓縮後恢復技能，非閘門觸發。
### G0 — 初始化

**時機**：觸發 shiftblame 技能時。

**檢查**：`.shiftblame/REPO.md` 與 `.shiftblame/ROADMAP.md` 是否存在。

| 情境 | 動作 |
|------|------|
| `.shiftblame/` + `REPO.md` + `ROADMAP.md` 皆存在 | 通過 |
| `.shiftblame/` 存在但缺 `REPO.md` 或 `ROADMAP.md` | BLOCK：手動補齊缺少的本地私密文件 |
| 位於 git repo，無 `.shiftblame/` | 自動建立 `.shiftblame/` + `REPO.md` + `ROADMAP.md` 模板 |
| 空目錄（無檔案） | 先 `git init`，再自動建立 |
| 非 git repo 且非空 | BLOCK：請先執行 `git init` |

確認 REPO.md 和 ROADMAP.md 格式。若任一文件不符合標準格式（見操作標準 17），管理者整理為標準格式後繼續。REPO.md 標準格式：專案現狀、已完成功能、技術棧、架構演進。ROADMAP.md 標準格式：產品方向、後續計畫、已知問題、待改進項目。模板見系統規格 31 和系統規格 32。

REPO.md 模板：

```markdown
# REPO — 專案現狀

> 本地私密，不納入版本控制

## 專案現狀


## 已完成功能


## 技術棧


## 架構演進

```

ROADMAP.md 模板：

```markdown
# ROADMAP — 穩定產品路線圖

> 本地私密，不納入版本控制；不得改以 docs/ 或其他會推送到遠端的文件維護。

## 原則

- ROADMAP 只在歸檔後更新，記錄穩定產品路線、後續候選與待改進項目。
- REPO.md 記錄「完成了什麼」，ROADMAP.md 記錄「未來預計要做什麼」。語意不可交叉。
- 開發中的工作筆記、臨時待辦、退回原因、BossPreview 回饋與本輪決策一律寫入 `.shiftblame/<slug>/SLUG.md`。
- 不得邊開發邊把 PM/QA/DEV/QC 流程待辦寫進 ROADMAP。
- 不得把 ROADMAP 內容當成本輪必做功能來源；本輪範圍永遠以使用者本輪明確想實現的功能為準。

## 產品方向


## 後續計畫


## 已知問題


## 待改進項目

```

### G1 — 派工

**時機**：派工給子代理前。

**檢查**：目標目錄 `<slug>/SLUG.md` 與 `<slug>/<DEPT>/<NNN>/task.md` 是否存在。

`SLUG.md` 是本輪開發筆記，建立新 slug 的第一個 `task.md` 前必須存在。它只承載開發中的工作日誌，不替代 `task.md`、`result.md`、`red.md` 或 `blue.md`，也不得在收尾前整理進 ROADMAP。

**QA 前置 PM**：若目標部門為 QA，管理者必須先確認同 slug 的 PM 已通過，並以 prompt 提供 PM 結論摘要，由執行者寫入 `task.md` 的「上游輸入」。PM 結論至少包含：

- 本輪使用者想實現的功能。
- 現有 repo、REPO.md、ROADMAP.md 中與本輪相關的背景。
- 本輪範圍與非本輪事項。
- ROADMAP 中可參考但不得自動納入本輪的項目。
- 建立 QA 標準前需要採納或排除的市場研究、通用方法、設計模式、CVE 或版本差異。

**DEV 前置選擇**：若目標部門為 DEV，管理者必須先取得老闆從 QA 結果中選擇的功能，由管理者寫入 `task.md` 的「目標」。描述必須是老闆看得懂的作品效果，例如「讓使用者可以新增一張卡片並立刻在畫面上看到」，不得只寫「實作資料模型」或「串接 API」。

**功能分支**：功能分支在第一次進入產品開發時建立（見操作標準 15）。執行者建立第一個產品開發 task.md 後、管理者執行 `git checkout -b feat/<slug>` 建立功能分支並切換。專案計畫和品質保證階段不需要功能分支。

**紅藍隊模式**：固定使用本環境子代理。建立 task.md 時將 `review` 寫為 `local`，同一 slug 後續任務沿用此值。

| 情境 | 動作 |
|------|------|
| `SLUG.md` 與 `task.md` 存在 | 通過 |
| 缺 `SLUG.md` | BLOCK：先建立 `<slug>/SLUG.md` |
| 目錄存在但無 `task.md` | BLOCK：先建立 task.md（見下方模板） |
| 無對應目錄 | BLOCK：先建立目錄結構、SLUG.md 與 task.md |

SLUG.md 模板：

```markdown
---
slug: <slug>
status: in_progress
created: <ISO timestamp>
updated: <ISO timestamp>
---

# <slug> — 本輪開發筆記

## 1. 本輪目標


## 2. 管線狀態紀錄


## 3. 殘餘風險與交接事項


## 4. BossPreview / 退回紀錄


## 5. 待收尾整理

- REPO.md：
- ROADMAP.md：
```

SLUG.md 分類規則：

| 分類 | 記錄時機 | 記錄者 |
|------|----------|--------|
| 1. 本輪目標 | 建立 slug 時 | 管理者 |
| 2. 管線狀態紀錄 | 各部門閘門通過後 | 管理者 |
| 3. 殘餘風險與交接事項 | 各部門閘門通過後、管理者整理殘餘風險時 | 管理者 |
| 4. BossPreview / 退回紀錄 | BossPreview 回饋或退回事件發生時 | 管理者 |
| 5. 待收尾整理 | 各部門閘門通過後、管理者整理候選內容時 | 管理者 |

待收尾整理歸檔後從此分類轉移至 REPO.md/ROADMAP.md，轉移完成的項目標註「→ 已整理」。

task.md 模板：

```markdown
---
slug: <slug>
department: <DEPT>
round: <NNN>
status: PENDING
created_at: <ISO 8601 日期時間格式：YYYY-MM-DDTHH:mm:ss+HH:MM>
trigger: <觸發原因>
review: local
upstream:
  - <上游任務引用>
---

# <DEPT>/<NNN> <觸發原因>任務：<標題>

## 宣告

```

建立規則：
- `NNN` 為三位數零填充（001, 002, …），省略時自動遞增。
- 已存在 `task.md` 時不覆寫。
- STATUS 合法值：PENDING、DECLARED、APPROVED、EXECUTED（全部大寫）。

### G2 — 閘門審查

**時機**：向老闆 `BossConfirm` 確認前。

**順序**：同一任務必須嚴格序列執行，不得並行紅藍隊：

1. 執行者完成工作成果並寫入 result.md（狀態 EXECUTED）。
2. 管理者向老闆 BossConfirm（確認 result.md 無需修改）。通過 → 繼續；老闆要求修改 → 返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm。
3. L2 BossConfirm 通過後，才呼叫紅隊。紅隊攻擊 result.md 並將報告寫入 `red.md`。管理者驗證 `red.md` 已產出且格式有效；若未產出，重新呼叫紅隊。
4. `red.md` 存在且格式有效後，才呼叫藍隊。藍隊讀取 `task.md`（宣告段落）、`result.md`、`red.md` 後將攻防對照報告寫入 `blue.md`。管理者驗證 `blue.md` 已產出且格式有效；若未產出，重新呼叫藍隊。藍隊 FAIL → 退回 L2 原地修復（EXECUTED），修復後 BossConfirm → L3→L4→L5（見 L4 FAIL 修復閘門）。
5. `red.md`、`blue.md` 皆存在且格式有效後，管理者依紅藍回饋寫入 conclusion.md，進入 CONCLUSION。
6. 管理者執行 Result Check（檢查五檔齊全且格式有效），通過後進入 CHECKED。
7. 管理者向老闆 `BossConfirm`，通過後進入 PASSED；FAIL → 退回 L1 重新宣告（DECLARED）。
8. 管理者依「上下文監控與壓縮」規則，在流程中持續監控上下文用量，於適當時機強制觸發壓縮。

**檢查**：目前任務目錄下 `result.md`、`red.md`、`blue.md`、`conclusion.md` 是否皆存在，且每檔皆含 YAML frontmatter 與繁體中文內容。`result.md` 必須承載該部門對應段式內容：PM/四段式（需求釐清+市場研究+產品規格+前端設計與視覺規格）、QA/五段式（安全標準+操作標準+系統規格+設計驗證標準+GWT 測試案例）、DEV/三段式（技術規劃+技術設計+技術實作；其中技術實作區分為後端與 API、前端接線與資源管理）、QC/三段式（驗收計畫+驗收報告+驗收結論；驗收方式為按 QA GWT 逐條端到端驗收+邊界測試）；不得以同名 `.md` 檔替代。DEV 的 `result.md` 必須顯示技術規劃、技術設計的前置內容先於實作建立，否則不得進入審查。`conclusion.md` 必須包含最終結論、紅藍整合摘要、跨部門推進聲明。

| 情境 | 動作 |
|------|------|
| 五檔皆存在 | 通過，可詢問老闆 |
| 缺 `result.md` | BLOCK：先完成執行者產出，不得呼叫紅隊或藍隊 |
| 缺 `red.md` | BLOCK：先呼叫紅隊，不得呼叫藍隊 |
| 缺 `blue.md` | BLOCK：先呼叫藍隊 |
| 缺 `conclusion.md` | BLOCK：先完成結論產出 |
| 缺對應內容型別或另建產物檔替代 `result.md` | BLOCK：重寫 `result.md`，不得跳過該輪 |
| 檔案為空、無 YAML frontmatter、或格式無效 | BLOCK：重派對應員工，不得跳過該輪 |

### 退回觸發條款

各部門退回觸發條件：

| 部門 | 退回觸發條款 |
|------|------------|
| 專案計畫 | 研究結論不足以支撐品質保證建標準 |
| 品質保證 | 標準或規格不明確、無法支撐產品開發建立技術規劃/設計/實作 |
| 產品開發 | 功能不符合規格、存在功能性錯誤、安全漏洞、效能不達標。退回時依退回原因分類：標準問題→退回 QA，定義問題→退回 PM，經老闆覆核後執行。退回前必須先 commit 所有工作變更。 |
| 驗收上線 | 功能性錯誤、安全漏洞、規格不一致 |

退回規則（五階段 FAIL 狀態機）：

- L1 BossConfirm FAIL：宣告不被接受 → 返回 L1 重新宣告。需 BossConfirm。
- L2 BossConfirm FAIL（result 確認）：老闆要求修改 result.md → 返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm。需 BossConfirm。
- L4 藍隊 FAIL（原地修復）：同部門 NNN 不變，退回 L2 原地修復（EXECUTED），執行者修正 result.md → BossConfirm → L3 紅隊 → L4 藍隊 → L5 結論，直到藍隊 PASS。一個 NNN 可以多次提交。不觸發 DECLARED 狀態轉移，不更新 task.md 宣告段落。採增量攻防（不得刪除既有 red.md / blue.md 紀錄，新回合攻防內容追加在既有紀錄之後，以 `---` 與 `## 第 N 次攻擊` / `## 第 N 次防禦` 分隔），保留完整追溯。
- L4 藍隊 FAIL（打回上游）：問題在上游定義，退回上游修正。上游開新 NNN（新執行切片），上游通過後回到原本被打回的 NNN，從 L1 重新宣告開始。本 NNN 的 L4 FAIL 不需 BossConfirm（上游自行走完整流程）。
- DEV 被退回時必須先 commit 當前所有工作變更，才能執行退回。退回前紅藍隊必須判定退回原因類型：標準問題（QA 標準或規格不明確、不完整、有矛盾）→ 退回 QA；定義問題（PM 需求釐清、產品規格或前端設計有誤）→ 退回 PM。管理者向老闆報告退回原因類型與目標部門，經老闆覆核確認後才執行退回。
- L5 BossConfirm FAIL：結論不被接受 → 退回 L1 重新宣告（DECLARED）。需 BossConfirm。
- 同部門新執行切片：PASS 後需要新的工作範圍時建立同部門新 NNN。
- 回溯：撤回該部門所有變更（git 與 .shiftblame/），回到該部門 001 狀態。僅限觸發部門。需 BossConfirm。

計畫不可更動：任何輪次不得更動已 PASSED 的前輪計畫範圍（功能範圍、架構決策、技術選型等）。若需更動，管理者判定是否屬計畫更動（功能範圍增減或架構決策變更），若是則提供老闆兩選項：回溯（限該部門）或進入路線圖（記錄至 ROADMAP.md，不在本輪執行）。實作方式、邊界處理、錯誤處理等不改變功能範圍的調整屬執行細節，不觸發回溯。

恢復：讀取未歸檔的 SLUG.md 恢復該 slug 的工作狀態。不適用已歸檔的 slug；適用於環境重啟後接續進度。
- 驗收上線例外：驗收上線一律退回產品開發（驗收上線不修改程式碼），直接回到原本被打回的 DEV NNN 重做
- 不得自行修改 result.md、red.md 或 blue.md
- 退回確認必須與閘門確認分離，不得合併
- 藍隊判定 FAIL 時，歸屬判斷由紅隊攻擊點和藍隊分析共同決定退回目標部門

未達門檻原地修復節點：

所有未達門檻的情況均改為 FAIL 原地修復（不自動建立 NNN+1）：
- PM/QA 結論判定研究/標準不足 → FAIL 原地修復同一 NNN
- DEV/QC 結論判定規劃/執行不足 → FAIL 原地修復同一 NNN

### G3 — 歸檔

**時機**：QC 閘門通過並收尾後。

歸檔前必須確認：merge --no-ff 已完成、push 完成、功能分支已刪除。

歸檔動作：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`

| 情境 | 動作 |
|------|------|
| 歸檔目錄已有同名 slug | 附加時間戳：`<slug>_<YYYYMMDDTHHMMSS>` |

歸檔後更新 REPO.md 和 ROADMAP.md（見操作標準 13、安全標準 16、安全標準 20）。管理者從 `.shiftblame/archive/<slug>/SLUG.md` 提取「待收尾整理」內容：

- REPO.md 加入已完成功能、架構變更、技術棧更新
- ROADMAP.md 加入後續計畫、已知問題、待改進項目
- 兩份文件語意不可交叉，只在歸檔後更新

禁止把待辦事項或未來路線圖寫入 `docs/`、README 的未來計畫章節，或其他會推送到遠端的文件。

## 管理者職責

管理者依上述閘門在每次狀態轉移前執行檢查。檢查方式：

- **讀取（優先，Claude）**：Read Tool（內建檔案讀取工具）
- **讀取（優先，Codex 桌面環境）**：`Get-Content -Encoding UTF8`（PowerShell）或 `cat`（Linux/macOS/Git Bash）
- **讀取（備援，Linux/macOS/Git Bash）**：`cat`、`sed -n`
- **讀取（備援，Windows PowerShell）**：`Get-Content -Encoding UTF8`
- **檢查/列檔**：`test -f`、`find`、`ls`、`Test-Path`、`Get-ChildItem`
- **寫入（優先，Claude）**：Write/Edit Tool（內建檔案寫入/編輯工具）
- **寫入（優先，Codex 桌面環境）**：`apply_patch` 系列工具（`apply_patch_add_file` / `apply_patch_update_file` / `apply_patch_replace_file` / `apply_patch_batch`），或 `Out-File -Encoding UTF8`（PowerShell）
- **寫入（備援）**：shell heredoc 或目前環境允許的 patch/write 工具
- **禁止**：在 Windows PowerShell 以未指定 `-Encoding UTF8` 的 `Get-Content`、`type`、`cat` 讀取含中文的 Markdown 檔案

所有檔案路徑以 `.shiftblame/` 為根，相對於 repo root。

## 全域入口安裝

安裝 shiftblame 技能後，在主開發環境的全域入口檔寫入 managed block。

每個 block 僅包含一行：載入技能的指令（如 `load shiftblame skills` 或等價觸發語句）。角色映射、讀取規則等資訊全部由 SKILL.md 承載。以 `<!-- BEGIN/END shiftblame:<label> -->` 標記，更新時只替換標記內容，不動其他區段。
