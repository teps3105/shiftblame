---
title: GRAPH
type: FOUR_FILE
role: graph
status: active
updated: <YYYY-MM-DD>
---
# GRAPH — 專案可視化圖譜

> 收尾時更新。視覺化追蹤專案進度、slug 依賴與架構關係。

## 進度統計

| 指標 | 數值 |
|------|------|
| 已歸檔 slug | 0 |
| 進行中 slug | 0 |
| 總 NNN 迭代次數 | 0 |
| 已知 BUG 數 | 0 |

## 架構演化與歸檔紀錄

| 日期/Slug | 變更／成果 | 觸發 slug／殘留技術債 |
|-----------|-----------|----------------------|
| （收尾時追加） | | |

## Obsidian 筆記查詢

> 範圍只含四文件、PRD、PID；archive 與開發中 slug 可視但不列入連接完整性。PRD `status`：`draft`／`implemented`／`archived`（原則 6）；PID `status`：`implemented`／`superseded`（原則 6.4，歷史事實保留不過濾）。

**未完成 PRD**（`draft`）／ **PID**（`implemented`+`superseded`）：

```dataview
TABLE domain, status, priority, updated, pid
FROM "PRD"
WHERE type = "PRD" AND status = "draft"
SORT priority DESC, updated DESC
```

```dataview
TABLE domain, status, updated, prd
FROM "PID"
WHERE type = "PID"
SORT updated DESC
```

## References

- [[REPO]]、[[ROADMAP]]、[[SOP]]
