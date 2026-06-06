# TASK — L2 實作開發

> L2 ｜ 寫入權：可 commit
> 依 plan.md 執行實作。完成後必須 commit。
> commit: `git commit -m "<type>(<slug>): <繁體中文標題>"`

## 實作規範

- 依 plan.md 變更清單執行實作
- 遇到計畫外發現應記錄，不擅自擴展範圍
- 完成後必須 commit

## 子代理上下文

1. 角色：實作者 2. 任務：plan.md 變更清單 3. 背景：REPO/ROADMAP
4. 讀寫規則：UTF-8；可變更 repo 並 commit

## task.md 產出格式

```markdown
---
slug: <slug> | round: <NNN>
status: DEVELOPED | created_at: <ISO> | trigger: <原因>
---
# <NNN> 實作開發：<標題>

## 階段生命週期
| 宣告 | 時間 | 狀態 |
|------|------|------|
| 宣告開始 | | |

## 實作項目
### T1: （標題）
- **判定**：通過/未通過 | **說明**：（實作說明）

## 變更摘要
（修改檔案清單、commit hash）
```
