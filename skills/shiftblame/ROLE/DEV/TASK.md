# DEV TASK — L1 執行任務
> L1 ｜ 開發期 ｜ 寫入權：可 commit ｜ 上游：shared/handoff.md

依 plan.md 將技術 5W1H 翻譯為技術 GWT，執行實作、程式碼變更、測試撰寫。
commit: `git commit -m "<type>(<slug>): <繁體中文標題>"`

## 面向差異

| | 開發面向 | 維運面向 |
|---|---|---|
| L1 重點 | 程式碼實作、API 開發、前端接線 | 使用者視角維運、端到端流程測試 |

## 子代理上下文
1. 角色：DEV 執行 2. 任務：plan.md 摘要 3. 背景：REPO/ROADMAP
4. 上游：shared/handoff.md 5. 讀寫：UTF-8，臨時檔放 .shiftblame/tmp/

## task.md 產出格式

```markdown
---
slug: <slug>
role: DEV
aspect: <開發/維運>
round: <NNN>
status: EXECUTED
created_at: <ISO 8601>
trigger: <觸發原因>
review: local
upstream: <上游 conclusion.md 路徑或 null>
---

# DEV/<NNN> 執行：<標題>

## 階段生命週期

| 宣告 | 時間 | 狀態 |
|------|------|------|
| 宣告開始 | | |
| 宣告完成 | | |
| 宣告通過 | | |

## 執行成果

（變更摘要、修改檔案清單、GWT 驗證結果）
```
