# GRAPH — 專案可視化圖譜

> 視覺化追蹤專案進度、slug 依賴與架構關係。每次收尾時更新。

## 流程圖

```mermaid
graph LR
    A[老闆觸發] --> B{模式?}
    B -->|Slug 管線| C[G1 計畫]
    B -->|簡易模式| D[START]
    C --> E[G2 開發 NNN]
    E --> F[體驗者]
    F --> G[收尾]
    D --> H[正方提案]
    H --> I[反方質疑]
    I --> J[收斂]
    J --> K[PASS→commit]
```

## 狀態圖

```mermaid
stateDiagram-v2
    [*] --> PLANNED : G1 出口
    PLANNED --> DEVELOPED : G2 出口
    DEVELOPED --> EXPERIENCED : 體驗者完成
    EXPERIENCED --> PASSED : 管理者收尾

    DEVELOPED --> DEVELOPED : NNN FAIL→新 NNN
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
| 體驗者回饋 BUG 數 | 0 |

## 架構演化

| 日期 | 變更 | 觸發 slug |
|------|------|-----------|
| （收尾時追加） | | |
