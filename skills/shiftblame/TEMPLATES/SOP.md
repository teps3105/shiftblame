# SOP — 專案執行準則

> 記錄執行準則、目標與未完成/已完成項目。三層租約的長期層。
> 所有長期目標、當前目標、目標附加條件都只能寫入本文件，不另創其他平行目標文件。

## 當前目標

（所有目標統一寫入此處，含長期目標、當前目標、目標附加條件）

## 已知問題

（變更前體驗記錄的使用者體驗、缺陷、BUG 等問題。修正後標記解決狀態）

## 執行準則

（專案特定的執行規範、慣例、約束。ROLE/ 涵蓋職責範圍+越權防線，專案細項由此處增補）

### 定義檔規範

- 定義檔（skills/shiftblame/）不限行數，以完整覆蓋職責範圍為原則
- 遵循單一權威原則：每條規則只在一個檔案定義，其他檔案引用
- 遵循正向表述原則：用具體動作描述；否定句僅用於邊界定義
- YAML front matter 不計入行數
- UTF-8 編碼

### NNN=Commit 紀律

- G2 每個 NNN 迭代收斂後，管理者提交一次 commit
- Commit 訊息格式：`<type>(slug): <繁體中文描述>`（例：`feat(map-ui): 強化常態地圖雲氣流動`）
- Type：feat / fix / docs / style / refactor / test / chore / build / ci / perf / revert
- Merge commit：`chore(slug): 合併<繁體中文成果>`

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
