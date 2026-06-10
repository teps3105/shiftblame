---
slug: <slug>
status: planned
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
# <slug>

> 記錄當前 slug 開發狀態。生命週期：PLANNED→DEVELOPED→EXPERIENCED→PASSED。

## 1. 本輪目標

（管理者填入 G1 計畫目標，對應 G1 5W1H）

## 2. 行為狀態

`<NNN>.<出口>：<狀態>`

| NNN | 出口 | 狀態 | 備註 |
|-----|------|------|------|
| 001 | G1 | PLANNED | 初始計畫 |
| 001 | G2 | — | 待開發 |

狀態序：PLANNED→DEVELOPED→EXPERIENCED→PASSED

## 3. 子代理策略

diverge=<N> | strategy=<描述> | audit=<覆蓋率/一致性>

（管理者調度時填入：子代理數量、視角分配、是否盲獨立）

## 4. 技術債清單

| 編號 | 來源 | 描述 | 建議 | 狀態 |
|------|------|------|------|------|
| （G2 反方質疑記入技術債） | | | | 待處理 |

## 5. FAIL 與交接

- **FAIL**：以收斂為基線增量增加，開新 NNN
- **交接摘要**：管理者從 FEATURE.md 彙整 3~5 行白話寫入此處（收尾時填入）

## 6. G(n).md 格式

- 路徑：`.shiftblame/<slug>/<NNN>/G(n).md`
- YAML front matter：`slug | nnn | gate | status | created_at`
- 正文結構：正方→反方→收斂，各段首行追溯性標註 `[正方: name | 反方: name | 收斂: name]`
- 命名：`<role>-<topic>`
- 質疑標註：D/E + H/M/L

## 7. 租約有效期

臨時規範，三層租約的中期層。格式：

```
[編號] 描述 | 日期 | 升級SOP/隨歸檔失效
```

歸檔前逐條標記處理狀態（升級至 SOP 或隨歸檔失效）。
