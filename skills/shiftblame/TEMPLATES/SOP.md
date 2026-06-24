---
title: SOP
type: FOUR_FILE
role: sop
status: active
updated: <YYYY-MM-DD>
---
# SOP — 專案執行準則

> 記錄執行準則、目標與未完成/已完成項目。三層租約的長期層。
> 所有長期目標、當前目標、目標附加條件都只能寫入本文件，不另創其他平行目標文件。

## 當前目標

（所有目標統一寫入此處，含長期目標、當前目標、目標附加條件）

## 已知問題

（變更前體驗記錄的使用者體驗、缺陷、BUG 等問題。修正後標記解決狀態）

## 反面教訓（方向性，非單案）

（方向錯誤被否決撤回時，提煉為方向性紀律記於此。不保留單案 slug 名與具體系統內容；單案完整過程隨 slug 歸 `archive/`。記住方向教訓，但不把任何單案的具體系統當成原則的範圍界定。）

## 執行準則

（專案特定的執行規範、慣例、約束。ROLE/ 涵蓋職責範圍+越權防線，專案細項由此處增補）

### 定義檔規範

- 定義檔（skills/shiftblame/）不限行數，以完整覆蓋職責範圍為原則
- 遵循單一權威原則：每條規則只在一個檔案定義，其他檔案引用
- 遵循正向表述原則：用具體動作描述；否定句僅用於邊界定義
- **方向修正須重整非貼上**：方向變更時重寫相關段落，禁止行內「※修正：...」覆蓋原文。舊版本需保留移 `archive/`，不留行內補釘
- **移除錯誤歷史，不堆疊**：錯誤的方向/機制/假設直接移除並重寫為當前真相，不在文件堆疊「撤回標註/方向變更聲明/※原本是 X 現改為 Y」這類回溯性敘述。文件只呈現當前真相；錯誤歷史由 `archive/` 承擔。需記「為何不走某錯誤路」時，以提煉過的紀律/反面教訓形式寫，不保留錯誤方向的具體內容
- YAML front matter 不計入行數
- UTF-8 編碼

### NNN=Commit 紀律

- 每個 NNN 走完整輪（正→反→收斂→實作意圖揭露→老闆確認→實作；commit 與驗收解耦，驗收機制見框架 SKILL 核心原則「選用外部角色整合」：NNN 可選／老闆覆核免驗／slug 末強制，本專案 SOP 不重述）後，管理者提交一次 commit。NNN 層級無 gate/PASS/FAIL，推進時機由老闆指示
- Commit 訊息格式：`<type>: <繁體中文描述>`（例：`feat: 強化常態地圖雲氣流動`，**不帶 slug scope**）
- Type：feat / fix / docs / style / refactor / test / chore / build / ci / perf / revert
- Merge commit：`merge(slug): <繁體中文成果>`（slug 僅出現在 merge commit）

### Commit 紀律

- 所有 commit 由管理者執行，正方/反方禁止 commit
- Slug 管線 commit 在 `feat/<slug>` 分支

### 租約載入

- Slug 管線三層租約：SOP（長期）｜SLUG §7（中期）｜SKILL+GATE+MANAGE+ROLE/G1+G2（短期）
- 長期租約未載入 → 入口閘門 FAIL

### 會話管理

- 會話由老闆自由管理，agent 不主動結束會話
- .shiftblame/ 不在 repo 中（gitignore）

### 本地產物管理

- 啟動腳本、建置流程、服務 PID、Web export 產物與 runtime 輸出等本地產物須納入 `.gitignore`
- 可提交正式產物須明確標示
- `.shiftblame/` 永遠不 stage、不 commit、不 push

### 目標統一約束

- 所有長期目標、當前目標、目標附加條件只能寫入本文件「當前目標」區
- 不另創 ROADMAP 目標區或其他平行目標文件

## 未完成項目

（待執行項目清單，收尾時從管理者回歸更新同步）

## 已完成項目

（按時間倒序列出已完成的功能 slug）

| 日期 | Slug | 摘要 |
|------|------|------|
| | | |

## References

- [[REPO]]
- [[ROADMAP]]
- [[GRAPH]]
