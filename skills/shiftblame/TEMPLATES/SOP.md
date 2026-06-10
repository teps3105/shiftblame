# SOP — 全局標準文件

> 記錄執行準則與未完成/已完成項目。三層租約的長期層。

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
- Commit 訊息格式：`<type>: <slug>—<簡述>`
- Type：feat / fix / refactor / docs / test

### Commit 紀律

- 所有 commit 由管理者執行，正方/反方禁止 commit
- Slug 管線 commit 在 `feat/<slug>` 分支
- 簡易模式 commit 在 main（老闆授權）
- 簡易模式僅提交 repo 檔案，.shiftblame/ 不入 repo

### 租約載入

- Slug 管線三層租約：SOP（長期）｜SLUG §7（中期）｜閘門對應 ROLE + SKILL+GATE+MANAGE+EXPERIENCE（短期）
- 簡易模式：SOP（長期）+ SKILL+GATE+MANAGE+EXPERIENCE（短期）
- 長期租約未載入 → 入口閘門 FAIL

### 會話管理

- 會話由老闆自由管理，agent 不主動結束會話
- .shiftblame/ 不在 repo 中（gitignore）

## 未完成項目

（待執行項目清單，收尾時從體驗者回饋同步）

## 已完成項目

（按時間倒序列出已完成的功能 slug）

| 日期 | Slug | 摘要 |
|------|------|------|
| | | |
