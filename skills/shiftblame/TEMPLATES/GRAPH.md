---
title: GRAPH
type: FOUR_FILE
role: graph
status: active
updated: <YYYY-MM-DD>
---
# GRAPH — 專案可視化圖譜

> 視覺化追蹤專案進度、slug 依賴與架構關係。每次收尾時更新。

## 流程圖

```mermaid
graph LR
    A[老闆觸發] --> C[G1 計畫]
    C --> E[G2 開發 NNN]
    E --> G[管理者收尾]
```

## 狀態圖

```mermaid
stateDiagram-v2
    [*] --> PLANNED : G1 出口
    PLANNED --> DEVELOPED : G2 出口
    DEVELOPED --> PASSED : 管理者收尾

    DEVELOPED --> DEVELOPED : NNN commit→老闆指示推進下一 NNN
```

## 依賴圖

（歸檔後更新 slug 間依賴關係）

```mermaid
graph TD
    （slug 依賴關係圖）
```

## 進度統計

| 指標 | 數值 |
|------|------|
| 已歸檔 slug | 0 |
| 進行中 slug | 0 |
| 總 NNN 迭代次數 | 0 |
| 已知 BUG 數 | 0 |

## 架構演化

| 日期 | 變更 | 觸發 slug |
|------|------|-----------|
| （收尾時追加） | | |

## Obsidian 筆記查詢

> 查詢範圍只含四文件、PRD、PID；archive 與開發中 slug 可視但不列入連接完整性。

### 未完成 PRD

> PRD `status` 三態（原則 6）：`draft`=未完成（列此）、`implemented`=已固化、`archived`=已否決。

```dataview
TABLE domain, status, priority, updated, pid
FROM "PRD"
WHERE type = "PRD" AND status = "draft"
SORT priority DESC, updated DESC
```

### PID

> PID `status`（原則 6.4）：`implemented`=現行標準、`superseded`=被新標準取代（歷史事實保留可視，不過濾）。

```dataview
TABLE domain, status, updated, prd
FROM "PID"
WHERE type = "PID"
SORT updated DESC
```

## References

- [[REPO]]
- [[ROADMAP]]
- [[SOP]]
