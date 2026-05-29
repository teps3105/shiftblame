# STAFF — 員工呼叫規格

| 別名 | 角色 | 呼叫路徑 |
|------|------|---------|
| 管理者 | 目前環境 | 直接執行 |
| 執行者 | 目前環境 | 直接執行或本環境子代理 |
| 紅隊 | 本環境子代理 | red.md |
| 藍隊 | 本環境子代理 | blue.md |

## 固定呼叫映射

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| 主開發環境 | 目前環境 | 本環境子代理 | 本環境子代理 |

固定原則：目前環境永遠同時是管理者與執行者。管理者負責協調、派工、管線管理、閘門檢查與收尾，不寫入部門正式產物；執行者負責寫入 `task.md` 和 `result.md`。SLUG.md 由管理者維護（流程紀錄，非部門正式產物）。git 操作由管理者執行。紅隊與藍隊一律使用本環境子代理，不使用外部品牌工具或跨環境審查。

## 紅藍隊派工

task.md 的 `review` 欄位固定為 `local`。同一 slug 內所有任務一律由本環境子代理依序產出 `red.md` 與 `blue.md`。

同一任務的攻防順序固定為 `task.md` 工作結論 → `red.md` → `blue.md` → `result.md` → Result Check → CHECKED → BossConfirm → PASSED。以下段落僅供管理者參考，不得出現在派工 prompt 中。管理者必須先確認 `task.md` 工作結論已存在且格式有效，才能呼叫紅隊；必須先確認 `red.md` 存在且格式有效，才能呼叫藍隊；必須先確認 `blue.md` 存在且格式有效，才能指示執行者寫入 `result.md`。紅隊與藍隊不得並行啟動。

## 執行者呼叫

執行者由目前環境直接執行，或由管理者開本環境子代理執行。紅隊與藍隊固定由本環境子代理擔任；prompt 必須要求只寫入指定檔案，不修改 `task.md`、`result.md` 或其他輸出。

若本環境無法開子代理，管理者必須 BLOCK 並回報原因，不得改用外部品牌工具補位。不得跳過閘門；`result.md`、`red.md`、`blue.md` 三份產出仍必須齊全後才能進入 `BossConfirm`。

### `.shiftblame/` 讀寫權限規則

派工時，prompt 必須包含以下硬性指示：

```text
重要產出規則：
- .shiftblame/ 已被 .gitignore 排除。
- 讀取 .shiftblame/ 與 skills/shiftblame/ 內 Markdown 檔案時，只能使用 shell 指令；Linux/macOS/Git Bash 使用 cat 或 sed -n，Windows PowerShell 必須使用 Get-Content -Encoding UTF8。
- 檢查檔案存在與列檔可使用 test -f、find、Test-Path、Get-ChildItem。
- 禁止使用 read_file、內建檔案讀取器，或在 Windows PowerShell 以未指定 -Encoding UTF8 的 Get-Content/type/cat 讀取含中文 Markdown。
- 開發中筆記、臨時待辦、BossPreview 回饋、退回原因與本輪決策只可記錄在 .shiftblame/<slug>/SLUG.md，不得寫入 ROADMAP.md。
- 你的輸出將被直接導向到目標檔案（如 red.md），因此請「僅輸出報告的 Markdown 內容」，不要包含任何前言、後記、確認訊息或工具呼叫的原始輸出。
- 報告必須包含完整的 YAML frontmatter 與繁體中文內容。
```

若員工回報 `.shiftblame/` 檔案被 ignore/permission 拒絕，管理者不得等待其自行修復；立即中止該員工程序，改用上述硬性指示重派，或由管理者代讀內容後以 prompt 摘要提供。

## 工作區規範

功能分支在第一次進入產品開發時建立（見操作標準 15）。執行者建立第一個產品開發 task.md 後，管理者執行 `git checkout -b feat/<slug>` 建立功能分支並切換。專案計畫和品質保證階段不需要功能分支。

- 功能分支生命週期：產品開發開始時建立 → 驗收上線通過後 merge --no-ff 到主分支 → push → 刪除
- 所有程式碼變更、README.md 更新都在功能分支上
- `.shiftblame/` 產物不受分支管理（已被 .gitignore 排除）

## Prompt 模板

所有模板都必須包含「`.shiftblame/` 與 `skills/shiftblame/` 的 Markdown 檔案只能用 shell 讀取，不得用 read_file；Windows PowerShell 必須使用 `Get-Content -Encoding UTF8`」。

所有面向老闆的內容都必須預設老闆不懂技術：用繁體中文、作品效果、可操作步驟與驗證結果描述，不得用技術術語包裝。技術細節可放在「內部備註」或「實作紀錄」，不可取代功能描述。

面向老闆的互動必須使用繁體中文。選項文字不得使用英文狀態機值（如 AGREE、DECLARED、APPROVED 等）。參考選項文字（非封閉列舉）：「同意」「不同意」「調整」。狀態機值全部大寫（YAML frontmatter、狀態描述）。

**Executor Task**：確認 `SLUG.md` 與 task.md 存在 → 用 UTF-8 shell 讀取 `SLUG.md` + task.md + `DEPT/<DEPT>/L1.md` → 執行者先在「## 宣告」段落寫入本輪計畫 → 管理者向老闆確認宣告（用繁體中文）→ 老闆同意後依部門執行者工作結論規則執行 → 寫入 task.md 工作結論（狀態 EXECUTED）。派工時提供上游所有部門的所有已 PASS 的 result.md 完整內容，不指示員工自行讀取歷史文件。研究部門（PM/QA）result.md 必須 self-contained：完整寫入前輪仍然有效的結論，已被修正的以修正後版本呈現，禁止引用其他文件。必要時同步把開發中筆記、臨時待辦、BossPreview 回饋或退回原因追加到 `SLUG.md`。產品開發要求更嚴：必須先把技術規劃、技術設計、技術實作的前置內容寫入 `task.md`，再開始程式碼實作。工作結論寫入後，不得跳過紅隊直接產出 result.md 或進入下一部門。

SLUG.md 維持五分類結構：（1）本輪目標、（2）管線狀態紀錄、（3）殘餘風險與交接事項、（4）BossPreview / 退回紀錄、（5）待收尾整理。分類規則見 GATE.md SLUG.md 模板。執行者不得將這些內容寫入 REPO.md 或 ROADMAP.md。

**Red**：確認 `task.md` 工作結論已存在且格式有效 → 用 UTF-8 shell 讀取 `SLUG.md` + task.md + `DEPT/<DEPT>/L2.md` → 依部門紅隊規則攻擊工作結論 → 寫入 `red.md`。完成前不得呼叫藍隊。只可寫入 red.md，不得修改其他已追蹤檔案。red.md 末尾必須包含流程合規聲明：「紅隊攻擊完成。任何角色不得依據本報告立即修復問題。必須繼續藍隊流程。修復一律延後到 FAIL 原地修復或打回上游。」

**Blue**：確認 `red.md` 已存在且格式有效 → 用 UTF-8 shell 讀取 `SLUG.md` + task.md + red.md + `DEPT/<DEPT>/L3.md` → 依部門藍隊規則檢視 → 寫入 `blue.md`。藍隊報告必須包含紅藍攻防對照、紅隊每個攻擊點的防禦或修正判定、殘餘風險，以及 PASS/FAIL 建議。只可寫入 blue.md，不得修改其他已追蹤檔案。blue.md 末尾必須包含流程合規聲明：「藍隊檢視完成。執行者不得依據紅藍回饋立即修復問題。修復一律延後到 RESULT 產出後的 FAIL 原地修復或打回上游。」

**Executor Result**：確認 `red.md` 與 `blue.md` 皆存在且格式有效 → 用 UTF-8 shell 讀取 `SLUG.md` + task.md + red.md + blue.md + `DEPT/<DEPT>/L4.md` → 依部門執行者結果產出規則執行 → 寫入 `result.md`（狀態 RESULT）。不得建立同名 `.md` 檔替代 `result.md`。研究部門（PM/QA）result.md 必須 self-contained：完整寫入前輪仍然有效的結論，已被修正的以修正後版本呈現，禁止引用其他文件。禁止在 result.md 中立即修復紅隊指出的問題；result.md 記錄本輪結論與紅藍隊評估結果，修復一律延後到 FAIL 原地修復或打回上游。若本輪閘門通過並推進至下游部門，result.md 須包含跨部門推進聲明：「本部門閘門已通過。下游部門不得把 ROADMAP 當成本輪需求，也不得沿用本輪的 red.md/blue.md。」若本輪為打回上游新執行切片，result.md 須包含聲明：「本輪為打回上游新執行切片。不得沿用上一輪的 red.md 或 blue.md。」若本輪為 FAIL 後原地修復，result.md 須包含聲明：「本輪為 FAIL 後原地修復。前次工作結論保留供參考，不得沿用前次的 red.md 或 blue.md。」

所有產出（task.md / result.md / red.md / blue.md）使用繁體中文產出。
