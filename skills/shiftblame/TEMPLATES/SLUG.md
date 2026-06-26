---
slug: <slug>
status: in_progress
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
# <slug>

> 記錄當前 slug 開發狀態。生命週期：IN_PROGRESS→PASSED。

## 1. 本輪目標

（管理者填入目標，源自老闆意圖）

## 2. 行為狀態

每個 NNN = 一輪雙軌平行正→反→收斂。G1（外部研究規劃視角）與 G2（內部技術實作視角）同時進行。

| NNN | G1 狀態 | G2 狀態 | 老闆指示 | 備註 |
|-----|---------|---------|----------|------|
| 001 | — | — | — | 初始輪 |

NNN 狀態：START → 正方 → 反方 → 收斂 → 實作 → commit。NNN 層級無 gate/PASS/FAIL，推進由老闆指示。Slug：IN_PROGRESS → PASSED（老闆拍板 slug 結束）。

## 3. 子代理策略

固定雙子代理：G1（外部研究規劃視角）+ G2（內部技術實作視角）。子代理身份可跨 NNN 續用。

（管理者調度時填入：G1/G2 子代理的續用狀態、本輪視角重點）

## 4. 技術債清單

| 編號 | 來源 | 描述 | 建議 | 狀態 |
|------|------|------|------|------|
| （反方質疑記入技術債） | | | | 待處理 |

## 5. 推進與交接

- **推進**：NNN 走完整輪（正→反→收斂→實作）並 commit 後，由老闆指示推進到下一個 NNN；老闆指示「退回／撤銷」時不提交。NNN 層級無 gate/PASS/FAIL
- **交接摘要**：管理者彙整最終 NNN 雙軌收斂結論 3~5 行白話寫入此處（收尾時填入）

## 6. G(n).md 格式

- 路徑：`.shiftblame/<slug>/<NNN>/G1.md` + `.shiftblame/<slug>/<NNN>/G2.md`（每 NNN 同時產出兩份）
- Slug 鏈白名單：`<slug>/` 僅含 `SLUG.md` 與 `<NNN>/`；`<NNN>/` 僅含 `G1.md` 與 `G2.md`（見 SKILL.md「`.shiftblame/` 內部佈局」）
- YAML front matter：`slug | nnn | role | status | created_at`
- 正文結構：正方→反方→收斂，各段首行追溯性標註 `[正方: name | 反方: name | 收斂: name]`
- 命名：`<role>-<topic>`
- 質疑標註：D/E + H/M/L

## 7. 租約有效期

臨時規範，三層租約的中期層。格式：

```
[編號] 描述 | 日期 | 升級SOP/隨歸檔失效
```

歸檔前逐條標記處理狀態（升級至 SOP 或隨歸檔失效）。
