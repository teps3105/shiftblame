# STAFF — 員工呼叫規格

| 別名 | 角色 | 呼叫路徑 |
|------|------|---------|
| 管理者 | 目前環境 | 直接執行 |
| 執行者 | 本環境子代理（預設，管理者可根據上下文使用情況隨時調整為目前環境直接執行） | result.md |
| 紅隊 | 本環境子代理 | red.md |
| 藍隊 | 本環境子代理 | blue.md |

## 固定呼叫映射

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| 主開發環境 | 本環境子代理（預設，管理者可根據上下文使用情況隨時調整為目前環境直接執行） | 本環境子代理 | 本環境子代理 |

固定原則：管理者負責協調、派工、管線管理、閘門檢查、收尾、寫入 `conclusion.md` 與 `task.md` 宣告段落；執行者預設由本環境子代理擔任，負責寫入 `result.md`，管理者可根據上下文使用情況隨時調整為目前環境直接執行。SLUG.md 由管理者維護（流程紀錄，非部門正式產物）。git 操作由管理者執行。紅隊與藍隊固定使用本環境子代理，不使用外部品牌工具或跨環境審查。

**階段指標規則**：管理者在所有面向老闆的宣告與狀態報告中，必須使用「現在是 L*階段（階段名稱）」作為唯一階段指標（L1 宣告、L2 產出、L3 紅隊攻擊、L4 藍隊防禦、L5 結論）。不得以文件名稱（task.md、result.md、red.md、blue.md、conclusion.md）作為階段指標。

## 紅藍隊派工

task.md 的 `review` 欄位固定為 `local`。同一 slug 內所有任務一律由本環境子代理依序產出 `red.md` 與 `blue.md`。

同一任務的攻防順序固定為 `result.md`（工作成果）→ BossConfirm（老闆確認 result.md 無需修改）→ `red.md` → `blue.md` → `conclusion.md` → Result Check（五檔）→ CHECKED → BossConfirm → PASSED。以下段落僅供管理者參考，不得出現在派工 prompt 中。管理者必須先確認 `result.md` 已存在且格式有效，且老闆已 BossConfirm 確認無需修改，才能呼叫紅隊；必須先確認 `red.md` 存在且格式有效，才能呼叫藍隊；必須先確認 `blue.md` 存在且格式有效，才能由管理者寫入 `conclusion.md`。L2 BossConfirm 不通過時返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm，通過後才呼叫紅隊。L4 藍隊 FAIL 退回 L2 原地修復（EXECUTED），執行者修正 result.md → BossConfirm → L3→L4→L5，採增量攻防：不得刪除既有 red.md / blue.md 紀錄，新回合攻防追加在既有紀錄之後（以 `---` 與回合標題分隔）。L5 BossConfirm FAIL 退回 L1 重新宣告。執行者、紅隊與藍隊皆使用本環境子代理，不得並行啟動。

## 執行者呼叫

執行者預設由本環境子代理擔任（管理者可根據上下文使用情況隨時調整為目前環境直接執行），紅隊與藍隊固定由本環境子代理擔任；prompt 必須要求子代理將報告寫入指定的目標檔案（執行者→`result.md`、紅隊→`red.md`、藍隊→`blue.md`）。管理者在子代理回傳後驗證檔案是否已產出且格式有效；若未產出，管理者重新呼叫該子代理。

若本環境無法開子代理，管理者必須 BLOCK 並回報原因，不得改用外部品牌工具補位。不得跳過閘門；`result.md`、`red.md`、`blue.md` 三份產出仍必須齊全後才能進入 `BossConfirm`。

### `.shiftblame/` 讀寫權限規則

派工時，prompt 必須包含以下硬性指示：

```text
重要產出規則（環境自適應）：
- .shiftblame/ 已被 .gitignore 排除。
- 讀取 .shiftblame/ 與 skills/shiftblame/ 內 Markdown 檔案時：Claude 環境優先使用 Read Tool（內建檔案讀取工具）；Codex 桌面環境使用 `Get-Content -Encoding UTF8`（PowerShell）或 `cat`（Linux/macOS/Git Bash）。若內建工具無法使用再以 shell 指令處理。
- 寫入 .shiftblame/ 與 skills/shiftblame/ 內 Markdown 檔案時：Claude 環境優先使用 Write/Edit Tool（內建檔案寫入/編輯工具）；Codex 桌面環境使用 `apply_patch` 系列工具（apply_patch_add_file / apply_patch_update_file / apply_patch_replace_file / apply_patch_batch），或 `Out-File -Encoding UTF8`（PowerShell）。若內建工具無法使用再以 shell heredoc 處理。
- 檢查檔案存在與列檔可使用 test -f、find、Test-Path、Get-ChildItem。
- 禁止在 Windows PowerShell 以未指定 -Encoding UTF8 的 Get-Content/type/cat 讀取含中文 Markdown。
- 開發中筆記、臨時待辦、BossPreview 回饋、退回原因與本輪決策只可記錄在 .shiftblame/<slug>/SLUG.md，不得寫入 ROADMAP.md。
- 你的輸出必須直接寫入指定的目標檔案（如 red.md / blue.md），請使用寫入工具將完整報告寫入該檔案。不要只輸出到對話中。
- 報告必須包含完整的 YAML frontmatter 與繁體中文內容。
- 臨時檔案（暫存、中間產物、除錯輸出、截圖等）一律存放在 .shiftblame/tmp/，不得放在專案根目錄。不自動清理。
```

若員工回報 `.shiftblame/` 檔案被 ignore/permission 拒絕，管理者不得等待其自行修復；立即中止該員工程序，改用上述硬性指示重派，或由管理者代讀內容後以 prompt 摘要提供。

## 臨時檔案規範

所有流程中產生的臨時檔案（暫存、中間產物、除錯輸出、截圖、錄影、下載等）一律存放在 `.shiftblame/tmp/`。不得在專案根目錄建立臨時檔案。不自動清理，由老闆自行決定何時清理。派工 prompt 必須明確寫入此規則。

## 工作區規範

功能分支在第一次進入產品開發時建立（見操作標準 15）。執行者建立第一個產品開發 task.md 後，管理者執行 `git checkout -b feat/<slug>` 建立功能分支並切換。專案計畫和品質保證階段不需要功能分支。

- 功能分支生命週期：產品開發開始時建立 → 驗收上線通過後 merge --no-ff 到主分支 → push → 刪除
- 所有程式碼變更、README.md 更新都在功能分支上
- `.shiftblame/` 產物不受分支管理（已被 .gitignore 排除）

## Prompt 模板

所有模板都必須包含「`.shiftblame/` 與 `skills/shiftblame/` 的 Markdown 檔案讀取與寫入規則：Claude 環境優先使用 Read Tool / Write/Edit Tool；Codex 桌面環境使用 `Get-Content -Encoding UTF8`（讀取）與 `apply_patch` 系列或 `Out-File -Encoding UTF8`（寫入）。若內建工具無法使用，再以 shell 指令處理」。

所有面向老闆的內容都必須預設老闆不懂技術：用繁體中文、作品效果、可操作步驟與驗證結果描述，不得用技術術語包裝。技術細節可放在「內部備註」或「實作紀錄」，不可取代功能描述。

面向老闆的互動必須使用繁體中文。選項文字不得使用英文狀態機值（如 AGREE、DECLARED、APPROVED 等）。參考選項文字（非封閉列舉）：「同意」「不同意」「調整」。狀態機值全部大寫（YAML frontmatter、狀態描述）。

上下文監控與壓縮（此段落供管理者參考，不包含在派工 prompt 中）：

管理者在全流程中持續監控上下文用量。上下文過高時直接強制觸發環境的壓縮上下文機制（非建議老闆執行），避免工作到一半因上下文爆炸而中斷。壓縮後 SessionStart hook 會自動重新載入 shiftblame 技能。compact hook 用於壓縮後恢復技能，非閘門觸發。

**Executor Task**：確認 `SLUG.md` 與 task.md 存在 → 讀取 `SLUG.md` + task.md + `DEPT/<DEPT>/L1.md`（優先 Read Tool，備援 shell UTF-8）→ 執行者先在「## 宣告」段落寫入本輪計畫 → 管理者向老闆確認宣告（用繁體中文）→ 老闆同意後依部門執行者產出規則（L2.md）執行 → 管理者執行 `git status` 驗證工作目錄 → 若不乾淨則管理者執行 `git add` + `git commit` → 寫入 result.md（狀態 EXECUTED）→ 管理者向老闆 BossConfirm 確認 result.md 無需修改 → 通過後才呼叫紅隊。MAIN 模式管理者直接執行時，管理者自己在產出 result.md 前必須先 commit 所有變更，不得跳過。派工時提供上游所有部門的所有已 PASS 的 conclusion.md 完整內容，不指示員工自行讀取歷史文件。研究部門（PM/QA）result.md 必須 self-contained：完整寫入前輪仍然有效的結論，已被修正的以修正後版本呈現，禁止引用其他文件。必要時同步把開發中筆記、臨時待辦、BossPreview 回饋或退回原因追加到 `SLUG.md`。DEV/QC 適用單循環，與 PM/QA 一致：L1 即為計畫宣告，L1↔L2 迭代循環直到老闆滿意才進入紅藍。工作成果寫入 result.md 並通過 BossConfirm 後，不得跳過紅隊直接產出 conclusion.md 或進入下一部門。RAPID 模式：PM 吸收 QA 職責（品質定義、測試標準、驗收條件），DEV 吸收 QC 職責（自行驗收、功能驗證），不要求固定段式格式，result.md 以目標導向產出。

SLUG.md 維持五分類結構：（1）本輪目標、（2）管線狀態紀錄、（3）殘餘風險與交接事項、（4）BossPreview / 退回紀錄、（5）待收尾整理。分類規則見 GATE.md SLUG.md 模板。執行者不得將這些內容寫入 REPO.md 或 ROADMAP.md。

**Red**：確認 `result.md` 已存在且格式有效，且 L2 BossConfirm 已通過（老闆已確認 result.md 無需修改）→ 讀取 `SLUG.md` + task.md（宣告段落）+ `result.md` + `DEPT/<DEPT>/L3.md`（優先 Read Tool，備援 shell UTF-8）→ 依部門紅隊規則攻擊 result.md → 將紅隊報告寫入 `red.md`。完成前不得呼叫藍隊。只可寫入 `red.md`，不得修改其他已追蹤檔案。管理者在紅隊回傳後驗證 `red.md` 是否已產出且格式有效；若未產出，重新呼叫紅隊。追加格式：FAIL 重跑時以 `---` 與 `## 第 N 次攻擊` 分隔。red.md 末尾必須包含流程合規聲明：「紅隊攻擊完成。任何角色不得依據本報告立即修復問題。必須繼續藍隊流程。修復一律延後到 FAIL 原地修復或打回上游。」

**Blue**：確認 `red.md` 已存在且格式有效 → 讀取 `SLUG.md` + task.md（宣告段落）+ `result.md` + red.md + `DEPT/<DEPT>/L4.md`（優先 Read Tool，備援 shell UTF-8）→ 依部門藍隊規則檢視 → 將藍隊報告寫入 `blue.md`。藍隊報告必須包含紅藍攻防對照、紅隊每個攻擊點的防禦或修正判定、殘餘風險，以及 PASS/FAIL 建議。只可寫入 `blue.md`，不得修改其他已追蹤檔案。管理者在藍隊回傳後驗證 `blue.md` 是否已產出且格式有效；若未產出，重新呼叫藍隊。追加格式：FAIL 重跑時以 `---` 與 `## 第 N 次防禦` 分隔。blue.md 末尾必須包含流程合規聲明：「藍隊檢視完成。執行者不得依據紅藍回饋立即修復問題。藍隊 FAIL 時由管理者依狀態機判定：原地修復則返回 L2 重跑 L3→L4→L5，或打回上游由上游修正（MAIN 模式無此選項）。PASS 時才由管理者產出 conclusion.md。」

**Executor Conclusion**：確認 `red.md` 與 `blue.md` 皆存在且格式有效 → 管理者讀取 `SLUG.md` + task.md + red.md + blue.md + `DEPT/<DEPT>/L5.md`（優先 Read Tool，備援 shell UTF-8）→ 管理者依紅藍回饋寫入 `conclusion.md`。不得建立同名 `.md` 檔替代 `conclusion.md`。研究部門（PM/QA）conclusion.md 必須 self-contained：完整寫入有效結論，無引用其他文件。若本輪閘門通過並推進至下游部門，conclusion.md 須包含跨部門推進聲明：「本部門閘門已通過。下游部門不得把 ROADMAP 當成本輪需求，也不得沿用本輪的 red.md/blue.md。」若本輪為打回上游新執行切片，conclusion.md 須包含聲明：「本輪為打回上游新執行切片。不得沿用上一輪的 red.md 或 blue.md。」若本輪為 FAIL 後原地修復，conclusion.md 須包含聲明：「本輪為 FAIL 後原地修復。前次工作成果保留供參考，不得沿用前次的 red.md 或 blue.md。」

所有產出（task.md / result.md / red.md / blue.md / conclusion.md）使用繁體中文產出。
