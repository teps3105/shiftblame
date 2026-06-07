# GATE — 閘門、狀態機與收尾

1. **回饋即意圖**：老闆回饋為意圖確認素材，不可直接執行，禁止寫入記憶
2. **SOP 紀律**：可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
3. **PRD/PID 筆記本**：老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈
4. **先實作再驗證**：偶數實作、奇數審計，三輪配對
5. **迭代收斂+責任**：L3 PASS 前老闆的鍋（FAIL 回同 NNN L0）；L3 PASS 後 agent 的鍋（FAIL 開新 NNN）

## 狀態機

```
PLANNED → RED → DEVELOPED → BLUE → VERIFIED → CHECKED → PASSED
  (L0)    (L1)    (L2)      (L3)     (L4)       (L5)
                          ↓PATCH
                     DEVELOPED
```
PATCH 路徑：L3 審計後老闆可決議回 L2 修正（不改計畫）

| 狀態 | 意義 | 必要文件 |
|------|------|----------|
| PLANNED | L0 實作計畫完成 | plan.md |
| RED | L1 審計計畫完成 | + red.md |
| DEVELOPED | L2 實作開發完成 | + task.md |
| BLUE | L3 審計開發完成 | + blue.md |
| VERIFIED | L4 實作驗收完成 | + result.md |
| CHECKED | L5 審計驗收完成 | + conclusion.md |
| PASSED | 全部通過 | — |
| PATCH | L3 審計後回 L2 修正（不改計畫） | — |
| FAIL（同 NNN）| L3 PASS 前失敗，回同 NNN L0 修改 | — |
| FAIL（新 NNN）| L3 PASS 後失敗，開新 NNN 從 L0 | — |

> **FAIL 語義**：FAIL = 回 L0 重新計畫，但不等於全部回溯。是否撤銷既有變更由老闆在 FAIL 時一併決定。

**產物完整性**：狀態轉移前驗證當前與下一階段必要文件已寫入且正文非空；不符 → BLOCK。
**前置建檔**：狀態轉移前須先建立下一階段文件並通過產物完整性驗證。不符 → BLOCK。

## 閘門紀律

**六階段六斷點**：L0→L1→L2→L3→L4→L5 每個階段完成後，必須老闆確認通過才能進入下一階段。agent 不可自動通關。老闆回答 PASS（推進）或 FAIL（L3 PASS 前：回同 NNN L0；L3 PASS 後：開新 NNN）或 PATCH（L3 審計後回 L2 修正）。PASS/FAIL/PATCH 為老闆閘門指令，非審計結論用語。
**審計定位**：L1/L3/L5 子代理審計，揭露風險不做決策，**禁止使用 PASS/FAIL**。L1/L3/L5 審計供老闆決定是否推進/退回/收尾。
**增量原則**：FAIL 後產物增量更新（已完成/本次新增分區），不重建。
**PATCH 選項**：L3 審計後老闆可決議回 L2 修正（不改計畫），不需回 L0。
**交替策略**：管理者在閘門點暫停一條龍、喚醒另一條龍；暫停時釋放上下文，喚醒時注入摘要。

## 責任與收尾

- **NNN=Commit**：每個 NNN 恰好一個 commit；L3 PASS 後才 commit

## 收尾與回溯

L3 PASS 後才 commit。同 slug 使用 `feat/<slug>` 分支。收尾：確認 → 合併回 main → 推送 → 清理 → 歸檔 → 更新四文件。
**回溯原則**：FAIL 應回 L0 重新計畫；老闆可決議全部回溯（撤銷所有變更）。**main 保護**：agent 禁止操作 main。
