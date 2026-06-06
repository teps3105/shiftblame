# PLAN — L0 實作計畫

> L0 ｜ 管理者 ｜ 高權重
> 建立 5W1H 計畫，與老闆確認需求產出 plan.md。可 commit。

## 職責

需求釐清、技術規劃、品質定義、驗收條件。L0 建立計畫邏輯 5W1H。

## 子代理上下文

1. 角色：計畫者 2. 任務：本輪需求 3. 背景：REPO.md/ROADMAP.md
4. 上游：前輪 conclusion.md（若有）
5. 讀寫規則：UTF-8；可變更 repo 並 commit

## plan.md 產出格式

```markdown
---
slug: <slug> | round: <NNN>
status: PLANNED | created_at: <ISO> | trigger: <原因>
---
# <NNN> 計畫：<標題>

## 階段生命週期
| 宣告 | 時間 | 狀態 |
|------|------|------|
| 宣告開始 | | |

## 需求範圍
（摘要、目標、邊界）

## 計畫邏輯（5W1H）
（Who / What / When / Where / Why / How）

## 變更清單
（預計變更的檔案路徑與性質）

## 殘餘風險
```
