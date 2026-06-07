# RESULT — L4 實作驗收

> L4 ｜ 依複雜度 ｜ 定義 GWT 驗收標準
> 依 plan.md 5W1H 與 task.md 實作成果，定義驗收 GWT（Given/When/Then）。

## 驗收規範

- 依 5W1H 將計畫翻譯為 GWT 可驗收條件
- GWT 條件明確、可執行、可驗證
- 每項驗收對應 plan.md 變更清單項目

## 子代理上下文

1. 角色：驗收定義者 2. 任務：plan.md + task.md
3. 背景：REPO/ROADMAP 4. 讀寫規則：UTF-8

## result.md 產出格式

```markdown
---
slug: <slug> | round: <NNN>
status: VERIFIED | created_at: <ISO>
---
# result.md — <slug> <NNN>

## 階段生命週期
| 宣告 | 時間 | 狀態 |
|------|------|------|
| 宣告開始 | | |

## 驗收 GWT
### G1: （標題）
- **Given**：（前提條件）
- **When**：（觸發動作）
- **Then**：（預期結果）
- **對應計畫項**：（plan.md 項目編號）

## 綜合結論
（驗收範圍說明）

> 後續由子代理審計（L5 CONCLUSION）
```
