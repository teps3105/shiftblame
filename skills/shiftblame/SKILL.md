---
name: shiftblame
description: "AI Agents 協作框架。UTF-8。回饋即意圖，不直接執行。先實作再驗證：實作→審計三輪配對。"
---
# shiftblame — AI Agents 協作框架

單一角色，交錯六階段管線。會話由老闆自由管理。

1. **回饋即意圖**：老闆回饋為意圖確認素材，不可直接執行，禁止寫入記憶
2. **SOP 紀律**：可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
3. **PRD/PID 筆記本**：老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈
4. **先實作再驗證**：偶數實作、奇數審計，三輪配對（計畫/開發/驗收）
5. **迭代收斂**：FAIL 推進下一 NNN，直到老闆認可
6. **Shift Blame**：L0~L1 老闆的鍋；L2 起 agent 的鍋

## 啟動序列

每次觸發**僅載入索引層**，禁止一次讀入整個專案。依序：
1. **未歸檔偵測**：掃描 `.shiftblame/` 下未歸檔 SLUG.md（清單即可）
2. **四文件載入**：REPO.md → ROADMAP.md → SOP.md → GRAPH.md
3. **Repo 狀態**：git log、status、branch（摘要即可）
其餘原始碼、角色定義檔、模板等，依需求按需載入。

## 觸發

| 觸發方式 | 行為 |
|---------|------|
| `/shiftblame <任意文字>` | 意圖線索 → 啟動序列 → 呈現意圖 → 確認 → 分流 |
| `/shiftblame`（有未歸檔） | 啟動序列 → 呈現清單 → 老闆選擇 → 分流 |
| `/shiftblame`（無未歸檔） | 啟動序列 → 提議 slug → 確認 |
| 任何階段 FAIL | 自動觸發 → 同 slug 開新 NNN（L0 重跑）|

意圖揭露詳 GATE.md。觸發後不直接執行；呈現意圖時**必須包含執行模式**（slug 流程 vs main 直接執行），由老闆決定。

## 模式

L0 實作計畫(plan.md) → L1 審計計畫(red.md) → L2 實作開發(task.md) → L3 審計開發(blue.md) → L4 實作驗收(result.md) → L5 審計驗收(conclusion.md)
偶數＝實作，奇數＝審計。任何階段 FAIL → 同 slug 開新 NNN 從 L0 重跑。

## 閘門

閘門：流程開始(L0) → L5 PASSED → 收尾
六階段六斷點：每個階段完成後，必須老闆確認通過才能進入下一階段。不可自動通關。老闆只回答 pass（推進）或 fail（開新 NNN 從 L0）。
前置建檔：每階段結束前須先建立下一階段文件。PASSED 為終態免除。
分支：同 slug 使用 `feat/<slug>` 分支，agent 禁止直接操作 main。

## 角色與定義檔

六角色（實作計畫/審計計畫/實作開發/審計開發/實作驗收/審計驗收）。詳見 `ROLE/{PLAN,RED,TASK,BLUE,RESULT,CONCLUSION}.md`。
閘門/收尾→GATE.md ｜ 管理者操作→MANAGE.md ｜ 模板→TEMPLATES/ ｜ 工具→TOOLS/
