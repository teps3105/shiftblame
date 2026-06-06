# GATE — 閘門、狀態機與收尾

1. **寫入權分化**：PM 任何階段不得變更 repo 檔案；DEV 所有階段可變更 repo 並 commit
2. **回饋即意圖**：老闆回饋為意圖確認素材，不可直接執行，禁止寫入記憶
3. **PM 程式碼邊界**：PM 可閱讀程式碼作為規格與研究素材，但不得定義實作方式；具體實作計畫為 DEV 職責
4. **SOP 紀律**：PM/DEV 皆可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
5. **PRD/PID 制度**：PRD（`.shiftblame/PRD/`）為 PM 規劃文件，PID（`.shiftblame/PID/`）為 DEV 開發標準
6. **計畫語言**：L0 建立 5W1H 邏輯 → L2 翻譯為 GWT 可執行語言

## 狀態機
```
PLANNED → RED → TRANSLATED → BLUE → IMPLEMENTED → CHECKED → PASSED
  (L0)    (L1)    (L2)       (L3)     (L4)         (L5)
```
| 狀態 | 意義 | 必要文件 |
|------|------|----------|
| PLANNED | L0 計畫完成 | plan.md |
| RED | L1 審計計畫完成 | + red.md |
| TRANSLATED | L2 翻譯完成 | + task.md |
| BLUE | L3 審計翻譯完成 | + blue.md |
| IMPLEMENTED | L4 實作完成，已 commit | + result.md |
| CHECKED | L5 審計實作完成 | + conclusion.md |
| PASSED | 全部通過（可能帶技術債） | — |
**產物完整性**：狀態轉移前驗證當前與下一階段必要文件已寫入且正文非空；不符 → BLOCK。
**前置建檔**：狀態轉移前須先建立下一階段文件並通過產物完整性驗證。不符 → BLOCK。
**交接紀律**：角色交接僅在 L5 PASSED 後生效，提前宣告交接 → BLOCK。

## 審查序列

**意圖揭露**：修改 PRD/PID/SOP 時須向老闆確認。
L0 計畫(plan.md) → L1 審計計畫(red.md) → L2 翻譯(task.md) → L3 審計翻譯(blue.md) → L4 實作(result.md) → L5 審計實作(conclusion.md) → 收尾

## 分流路由

依 NNN 狀態恢復：PLANNED→L1；RED→L2；TRANSLATED→L3；BLUE→L4；IMPLEMENTED→L5；CHECKED→PASSED 後置；PASSED→BLOCK。

## 退回與追加

- 審計失敗：退回對應工作階段修復（L1→L0；L3→L2；L5→L4）
- 不溯及既往，問題記為技術債
- 追加超過原計畫 50%（累積）→ 應退回 L0

## Commit 與收尾

L4 實作完成後必須 commit。收尾：slug 結束 → 確認 → 合併 → 推送 → 清理 → 歸檔 → 更新四文件。
**回溯原則**：錯誤不以後續提交修正，回所屬分支（`git reset --hard`）重做後重新 merge。無分支則在 main reset。已推送用 `--force` 覆蓋。
