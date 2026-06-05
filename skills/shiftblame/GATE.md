# GATE — 閘門、狀態機與收尾

1. **寫入權分化**：PM 任何階段不得變更 repo 檔案（產物僅存 .shiftblame/）；DEV 所有階段可變更 repo 並 commit（含維運期直接修復）
2. **回饋即意圖**：老闆回饋為意圖確認素材，不可直接執行

## 狀態機

```
PLANNED → EXECUTED → APPROVED → RED → BLUE → CHECKED → PASSED
  (L0)      (L1)      (L2)     (L3)   (L4)    (L5)
```

| 狀態 | 意義 | 必要文件 |
|------|------|----------|
| PLANNED | L0 完成 | plan.md |
| EXECUTED | L1 完成，已 commit | + task.md |
| APPROVED | L2 通過 | + result.md |
| RED | L3 完成 | + red.md |
| BLUE | L4 完成 | + blue.md |
| CHECKED | 六檔齊全 | + conclusion.md |
| PASSED | L5 通過（可能帶技術債） | — |

**產物完整性**：狀態轉移前驗證必要文件已寫入 `<slug>/<ROLE>/<NNN>/`，含 frontmatter（slug/role/aspect/round/status）且正文非空；不符 → BLOCK。每階段完成時一併執行此檢查。

## 審查序列

**意圖揭露**：進入 L0 或 L3 前，管理者向老闆揭露手段、範圍、可調整項目。各項目須具體到老闆可判斷是否充分，老闆確認後進入。

**執行期**：L0 計畫(plan.md) → L1 執行(task.md, commit) → L2 驗收(result.md)
**驗證期**：L3 紅隊(red.md) → L4 藍隊(blue.md) → L5 結論(conclusion.md) → 收尾

L3/L4 序列執行，不得並行。

## 分流路由

驗證期恢復依 NNN 狀態：APPROVED→意圖揭露→L3；RED→讀 red.md→L4；BLUE→L4；CHECKED→PASSED 後置（更新 SLUG.md、commit）；PLANNED/EXECUTED→BLOCK（未完成執行期）；PASSED→BLOCK（已完成）。

## 退回與追加

- L0~L2：計畫問題→L0；執行問題→L1；驗收問題→L2 直接修復
- PM L3~L5：不溯及既往，記為技術債
- DEV L3~L5：可直接修復並 commit（維運期屬開發一部分）
- 追加超過原計畫 50%（累積）→ 應退回 L0

## Commit 與收尾

L1 完成後必須 commit。期別結束：有產品變更則 commit，無則跳過。
收尾：slug 結束 → 確認 → 合併 → 推送 → 清理 → 歸檔（遷移至 archive/） → 更新四文件（REPO/ROADMAP/PID/GRAPH）。

**回溯原則**：錯誤不以後續提交修正，回所屬分支（`git reset --hard`）重做後重新 merge。無分支則在 main reset。已推送用 `--force` 覆蓋。
