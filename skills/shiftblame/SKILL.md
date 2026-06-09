---
name: shiftblame
description: "AI Agents 協作框架。UTF-8。回饋即意圖，不直接執行。四出口×正→反→收斂三輪辯論。"
---
# shiftblame — AI Agents 協作框架

正反回饋迴圈框架。會話由老闆自由管理。
1. **回饋即意圖**：老闆回饋為意圖確認素材，僅供當前對話參考與意圖揭露使用
2. **SOP 紀律**：可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
3. **PRD/PID 筆記本**：老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈
4. **先提出再質疑**：正方提出→反方質疑，四出口各正→反→收斂三輪辯論
5. **迭代收斂**：以最後收斂為基線全部重跑

## 啟動序列

每次觸發**僅載入索引層**，按需讀取所需檔案。依序：
1. **未歸檔偵測**：掃描 `.shiftblame/` 下未歸檔 SLUG.md
2. **四文件載入**：REPO.md → ROADMAP.md → SOP.md → GRAPH.md
3. **Repo 狀態**：git log、status、branch
4. **租約載入檢查**：確認 SOP.md（長期）已載入；確認 SLUG.md 第 7 節（中期）；載入 SKILL+GATE+MANAGE 即短期租約生效。若長期未載入回入口閘門 FAIL
其餘依需求按需載入。

## 觸發

`/shiftblame <文字>` 啟動序列→呈現意圖→確認→分流。`/shiftblame`（無參數）呈現未歸檔清單供選擇或提議新 slug。觸發後不直接執行，呈現意圖須含執行模式，由老闆決定。

## 出口迴圈

四出口：計畫（G1）→開發（G2）→驗收（G3）→展望（G4）。每出口正→反→收斂自動推進。閘門詳 GATE.md；G1 入口詳 ROLE/G1.md；管理者→MANAGE.md；模板→TEMPLATES/；工具→TOOLS/。分支：同 slug 用 `feat/<slug>`，變更走此分支。
