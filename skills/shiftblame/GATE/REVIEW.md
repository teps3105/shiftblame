---
title: GATE/REVIEW
---

# G2 — 閘門審查

**時機**：向老闆 `BossConfirm` 確認前。

**順序**：同一任務必須嚴格序列執行，不得並行紅藍隊：

1. 執行者完成工作成果並寫入 result.md（狀態 EXECUTED）。
2. 管理者向老闆 BossConfirm（確認 result.md 無需修改）。通過 → 繼續；老闆要求修改 → 返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm。
3. L2 BossConfirm 通過後，才呼叫紅隊。紅隊攻擊 result.md 並將報告寫入 `red.md`。管理者驗證 `red.md` 已產出且格式有效；若未產出，重新呼叫紅隊。
4. `red.md` 存在且格式有效後，才呼叫藍隊。藍隊讀取 `task.md`（宣告段落）、`result.md`、`red.md` 後將攻防對照報告寫入 `blue.md`。管理者驗證 `blue.md` 已產出且格式有效；若未產出，重新呼叫藍隊。藍隊 FAIL → 退回 L2 原地修復（EXECUTED），修復後 BossConfirm → L3→L4→L5（見 L4 FAIL 修復閘門）。
5. `red.md`、`blue.md` 皆存在且格式有效後，管理者依紅藍回饋寫入 conclusion.md，進入 CONCLUSION。
6. 管理者執行 Result Check（檢查五檔齊全且格式有效），通過後進入 CHECKED。
7. 管理者向老闆 `BossConfirm`，通過後進入 PASSED；FAIL → 退回 L1 重新宣告（DECLARED）。
8. 管理者依「上下文監控與壓縮」規則，在流程中持續監控上下文用量，於適當時機強制觸發壓縮。

## 檢查

目前任務目錄下 `result.md`、`red.md`、`blue.md`、`conclusion.md` 是否皆存在，且每檔皆含 YAML frontmatter 與繁體中文內容。`result.md` 必須承載該角色的工作成果，以目標導向產出（不要求固定段式格式）。不得以同名 `.md` 檔替代。`conclusion.md` 必須包含最終結論、紅藍整合摘要、跨角色推進聲明。

## PRD/SOP 參照檢查

PM 角色若存在相關 PRD 文件，應已參照 PRD 研究需求與制定規範；DEV 角色若存在相關 SOP 文件，必須已按照 SOP 執行開發。PRD/SOP 為非強制參照（不存在時不阻塞閘門）。

| 情境 | 動作 |
|------|------|
| 五檔皆存在 | 通過，可詢問老闆 |
| 缺 `result.md` | BLOCK：先完成執行者產出，不得呼叫紅隊或藍隊 |
| 缺 `red.md` | BLOCK：先呼叫紅隊，不得呼叫藍隊 |
| 缺 `blue.md` | BLOCK：先呼叫藍隊 |
| 缺 `conclusion.md` | BLOCK：先完成結論產出 |
| 缺對應內容型別或另建產物檔替代 `result.md` | BLOCK：重寫 `result.md`，不得跳過該輪 |
| 檔案為空、無 YAML frontmatter、或格式無效 | BLOCK：重派對應員工，不得跳過該輪 |
