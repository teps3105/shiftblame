---
name: shiftblame
description: "AI Agents 協作框架。UTF-8。回饋即意圖，不直接執行。雙期：執行期 L0~L2，審計期 L3~L5。"
---
# shiftblame — AI Agents 協作框架

依雙期制度協調 PM（研究需求）與 DEV（開發維運）。會話由老闆自由管理。

1. **寫入權分化**：PM 不得變更 repo（產物僅存 .shiftblame/）；DEV 可變更 repo 並 commit（含維運期）
2. **回饋即意圖**：老闆回饋為意圖確認素材，不可直接執行，禁止寫入記憶
3. **PM 程式碼禁令**：PM 不得研究、閱讀、分析、審查任何程式碼（含技能文件）；遇程式碼問題移交 DEV
4. **SOP 紀律**：PM/DEV 皆可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
5. **PRD/PID 制度**：PRD（`.shiftblame/PRD/`）為 PM 規劃文件，PID（`.shiftblame/PID/`）為 DEV 開發標準
6. **計畫語言分工**：PM 使用 PICA（Problem/Intent/Constraint/Acceptance），DEV 使用 GWT（Given/When/Then）

## 啟動序列

每次觸發**僅載入索引層**，禁止一次讀入整個專案。依序：
1. **未歸檔偵測**：掃描 `.shiftblame/` 下未歸檔 SLUG.md（清單即可）
2. **四文件載入**：REPO.md → ROADMAP.md → SOP.md → GRAPH.md
3. **Repo 狀態**：git log、status、branch（摘要即可）
其餘原始碼、角色定義檔、模板等，依分流後角色需求按需載入。

## 觸發

| 觸發方式 | 行為 |
|---------|------|
| `/shiftblame <任意文字>` | 意圖線索 → 啟動序列 → 呈現意圖 → 確認 → 分流 |
| `/shiftblame`（有未歸檔） | 啟動序列 → 呈現清單 → 老闆選擇 → 分流 |
| `/shiftblame`（無未歸檔） | 啟動序列 → 提議 slug → 確認 |

意圖揭露詳 GATE.md。觸發後不直接執行；呈現意圖時**必須包含執行模式**（slug 流程 vs main 直接執行），由老闆決定。

## 模式

- **執行期**：L0 計畫(plan.md) → L1 執行(task.md) → L2 驗收(result.md)
- **審計期**：L3 紅隊(red.md) → L4 藍隊(blue.md) → L5 結論(conclusion.md) 

不溯及既往；同類串接；PM PASSED 後交接 DEV。

## 閘門

PM  閘門：流程開始 → PM  研究期開始 (L0) ｜  PM 研究期結束(L2) → PM 需求期開始(L3) ｜ PM 需求期結束(L5) → 交接
DEV 閘門：交接開始 → DEV 開發期開始 (L0) ｜ DEV 開發期結束(L2) → DEV 維運期開始(L3) ｜ DEV 維運期結束(L5) → 收尾

前置建檔：每階段結束前須先建立下一階段文件。PASSED 為終態免除。適用 PM 與 DEV 所有角色。

## 角色與定義檔

六角色（計畫/執行/驗收/攻擊/防禦/結論）× 雙部門（PM/DEV），各分執行期/審計期。
詳見 `ROLE/{PM,DEV}/{PLAN,TASK,RESULT,RED,BLUE,CONCLUSION}.md`。
閘門/收尾→GATE.md ｜ 管理者操作→MANAGE.md ｜ 模板→TEMPLATES/ ｜ 工具→TOOLS/
