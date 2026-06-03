# DEV TASK — L1 執行

> 階段：L1 ｜ 執行者：依複雜度（對話內 / 子代理）｜ 上下文：見 MANAGE.md

## 職責

DEV 為第二部門，上游為 PM。

- 技術規劃、設計、執行
- 後端 + API + 前端接線 + 資源管理
- 不得自行決定前端設計，依 PM 規格執行
- 履行品質控制職責（自行驗收、功能驗證）

## 工具鏈參照

- 執行工具見 `TOOLS/` 目錄（設計工具、端到端驗證工具等），依專案類型對應使用

## L1 階段定義

L1 為**執行**階段。BossConfirm 通過後，執行者直接執行所有產出。

### 執行規範

- 依本輪計畫執行所有產出（程式碼實作、文件修改、測試撰寫等）
- 依 PM conclusion.md 定義本輪可見功能
- 建立技術前置內容
- GWT 逐條跑通
- commit 格式：`<type>: <繁體中文標題>`
- 計畫不可更動（已 PASSED 的前輪計畫範圍不得變更）
- **所有測試在 L1 完成**：GWT 逐條驗證、邊界測試、端到端實機驗收。L4 不重跑測試，僅做品質團隊角度的防禦驗證
- 程式碼執行完成後 commit，進入 L2 驗收
- 程式碼 EXECUTED 後鎖定，L3/L4 期間不得修改（發現問題退回 DECLARED 重新宣告）

### 子代理上下文需求

若判定為高複雜度需開子代理，派工 prompt 必須提供：

1. **角色**：DEV 執行者
2. **任務**：本輪計畫（管理者摘要）
3. **背景**：REPO.md、ROADMAP.md（管理者摘要）
4. **上游**：PM conclusion.md（下游必讀）
5. **讀寫規則**：Claude 環境優先使用 Read/Write/Edit Tool；Codex 使用 Get-Content/apply_patch/Out-File（均 -Encoding UTF8）。禁止未指定 UTF8 讀取中文 Markdown。臨時檔案存放 `.shiftblame/tmp/`。

## task.md 產出格式

```markdown
---
slug: <slug>
role: DEV
round: <NNN>
status: PENDING
created_at: <ISO 8601>
trigger: <觸發原因>
review: local
upstream: <上游 conclusion.md 路徑或 null>
---

# DEV/<NNN> <觸發原因>任務：<標題>

## 執行成果

（執行者填入 — 變更摘要、修改檔案清單、驗證方式與結果）
```
