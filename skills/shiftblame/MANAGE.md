# MANAGE — 管理者協調與操作

管理者負責協調、派工、管線、閘門、歸檔。讀寫含中文文件須指定 UTF-8。

## 決策表

| # | 輸入 | 部門 | 期別 |
|---|------|------|------|
| 1 | 研究事項 | PM（研究品管） | 研究期（L0~L2）/ 品管期（L3~L5） |
| 2 | 開發事項 | DEV（開發維運） | 開發期（L0~L2）/ 維運期（L3~L5） |
| 3 | 功能開發 | PM → DEV | 各自兩期 |
| 4 | 提問答詢 | 直接回答 | — |

提問判定：輸入涉及未歸檔 slug 則非提問，須進入意圖確認。

**面向自動綁定**：PM 研究期=研究面向、品管期=品管面向；DEV 開發期=開發面向、維運期=維運面向。

## 管線閘門表

| 閘門 | 條件 |
|:----:|------|
| 執行期 | 意圖揭露 → L0 計畫(plan.md) → L1 執行(task.md, commit) → L2 驗收(result.md) |
| 驗證期 | 意圖揭露 → L3 紅隊(red.md) → L4 藍隊(blue.md) → L5 結論(conclusion.md) → 收尾 |
| 收尾 | 詳 GATE.md「Commit 與收尾」 |

## 目錄結構

```
.shiftblame/<slug>/
├── SLUG.md              ← 管線狀態（唯一允許根目錄）
├── shared/handoff.md    ← PM→DEV 交接
├── PM/<NNN>/{plan,task,result,red,blue,conclusion}.md
└── DEV/<NNN>/{plan,task,result,red,blue,conclusion}.md
```

禁止產物直接放在 `<slug>/` 或 `<ROLE>/` 根目錄。跨部門交接資料存入 `shared/`，不得外洩。

## 流程操作

建立 slug：`mkdir -p .shiftblame/<slug>/shared .shiftblame/<slug>/<ROLE>/001`
L1 commit：`git add <變更檔案> && git commit -m "<type>(<slug>): <標題>"`（禁止 force-add .shiftblame/，流程文件不入 repo）
跨部門分支：`git checkout -b feat/<slug>`；單一部門：直接在 main 操作
交接：PM PASSED → 彙整 conclusion.md 至 `shared/handoff.md`
歸檔：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`

## 觸發流程

1. 讀取後標指定或搜尋未歸檔 SLUG.md → 掌握管線狀態
2. 呈現理解到的意圖 → 與老闆溝通確認
3. 歸屬判定（當前 NNN / 新 NNN）→ 分流（執行期 / 驗證期）
