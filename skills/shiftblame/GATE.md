# GATE — 閘門、狀態機與收尾

1. **回饋即意圖**：老闆回饋為意圖確認素材，不可直接執行，禁止寫入記憶
2. **SOP 紀律**：可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
3. **PRD/PID 筆記本**：老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈
4. **先實作再驗證**：偶數實作、奇數審計，三輪配對
5. **迭代收斂**：L3 PASS 前 FAIL 回同 NNN L0；L3 PASS 後 FAIL 開新 NNN
6. **Shift Blame**：L0~L3 PASS 前老闆的鍋；L3 PASS 後 agent 的鍋

## 狀態機

```
PLANNED → RED → DEVELOPED → BLUE → VERIFIED → CHECKED → PASSED
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
| FAIL（同 NNN）| L3 PASS 前失敗，回同 NNN L0 修改 | — |
| FAIL（新 NNN）| L3 PASS 後失敗，開新 NNN 從 L0 | — |

**產物完整性**：狀態轉移前驗證當前與下一階段必要文件已寫入且正文非空；不符 → BLOCK。
**前置建檔**：狀態轉移前須先建立下一階段文件並通過產物完整性驗證。不符 → BLOCK。

## 閘門紀律

**六階段六斷點**：L0→L1→L2→L3→L4→L5 每個階段完成後，必須老闆確認通過才能進入下一階段。agent 不可自動通關。老闆回答 PASS（推進）或 FAIL（L3 PASS 前：回同 NNN L0；L3 PASS 後：開新 NNN）。
**審計定位**：L1/L3/L5 子代理獨立審計，揭露風險不做決策。L2/L4 參照審計結果評估。L5 審計供老闆參考決定是否收尾。

## 責任界線

- **L3 PASS 前**：老闆的鍋 — 計畫可反覆修改，老闆全權決定
- **L3 PASS 後**：agent 的鍋 — 開新 NNN 從 L0，不修補
- **NNN=Commit**：每個 NNN 恰好一個 commit，NNN 數量 = commit 數量

## Commit 與收尾

L3 PASS 後才 commit。同 slug 使用 `feat/<slug>` 分支。收尾：確認 → 合併回 main → 推送 → 清理 → 歸檔 → 更新四文件。
**回溯原則**：錯誤不修補，回分支重做。**main 保護**：agent 禁止操作 main。
