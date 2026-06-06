# GATE — 閘門、狀態機與收尾

1. **回饋即意圖**：老闆回饋為意圖確認素材，不可直接執行，禁止寫入記憶
2. **SOP 紀律**：可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
3. **PRD/PID 制度**：PRD（`.shiftblame/PRD/`）為規劃文件，PID（`.shiftblame/PID/`）為開發標準
4. **先實作再驗證**：偶數實作、奇數審計，三輪配對
5. **迭代收斂**：FAIL 推進下一 NNN
6. **Shift Blame**：L0~L1 老闆的鍋；L2 起 agent 的鍋

## 狀態機

```
PLANNED → RED → DEVELOPED → BLUE → VERIFIED → CHECKED → PASSED/FAIL
  (L0)    (L1)    (L2)      (L3)     (L4)       (L5)
```

| 狀態 | 意義 | 必要文件 |
|------|------|----------|
| PLANNED | L0 實作計畫完成 | plan.md |
| RED | L1 審計計畫完成 | + red.md |
| DEVELOPED | L2 實作開發完成 | + task.md |
| BLUE | L3 審計開發完成 | + blue.md |
| VERIFIED | L4 實作驗收完成 | + result.md |
| CHECKED | L5 審計驗收完成 | + conclusion.md |
| PASSED | 全部通過 | — |
| FAIL | 任何階段失敗，開新 NNN 從 L0 重跑 | — |

**產物完整性**：狀態轉移前驗證當前與下一階段必要文件已寫入且正文非空；不符 → BLOCK。
**前置建檔**：狀態轉移前須先建立下一階段文件並通過產物完整性驗證。不符 → BLOCK。

## 責任界線

- **L0~L1**：老闆的鍋 — 計畫可反覆修改，老闆全權決定
- **L2 起**：agent 的鍋 — 任何問題開新 NNN 從 L0 重跑，不修補
- **NNN=Commit**：每個 NNN 恰好一個 commit，NNN 數量 = commit 數量

## 分流路由

依 NNN 狀態恢復：PLANNED→L1；RED→L2；DEVELOPED→L3；BLUE→L4；VERIFIED→L5；CHECKED→PASSED 後置；PASSED→BLOCK。

## 退回與追加

- 審計失敗：退回對應實作階段修復（L1→L0；L3→L2；L5→L4）
- 不溯及既往，問題記為技術債
- 追加超過原計畫 50%（累積）→ 應退回 L0

## Commit 與收尾

L2 實作完成後必須 commit。同 slug 使用 `feat/<slug>` 分支。收尾：確認 → 合併回 main → 推送 → 清理 → 歸檔 → 更新四文件。
**回溯原則**：錯誤不修補，回分支重做。**main 保護**：agent 禁止操作 main。
