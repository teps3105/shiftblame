---
title: EXECUTE/DISPATCH
---

# DISPATCH — 紅藍隊派工

task.md 的 `review` 欄位固定為 `local`。同一 slug 內所有任務一律由本環境子代理依序產出 `red.md` 與 `blue.md`。

同一任務的攻防順序固定為 `result.md`（工作成果）→ BossConfirm（老闆確認 result.md 無需修改）→ `red.md` → `blue.md` → `conclusion.md` → Result Check（五檔）→ CHECKED → BossConfirm → PASSED。以下段落僅供管理者參考，不得出現在派工 prompt 中。管理者必須先確認 `result.md` 已存在且格式有效，且老闆已 BossConfirm 確認無需修改，才能呼叫紅隊；必須先確認 `red.md` 存在且格式有效，才能呼叫藍隊；必須先確認 `blue.md` 存在且格式有效，才能由管理者寫入 `conclusion.md`。

L2 BossConfirm 不通過時返回 DECLARED，更新 task.md 宣告段落後重新 BossConfirm → APPROVED → EXECUTED → BossConfirm，通過後才呼叫紅隊。L4 藍隊 FAIL 退回 L2 原地修復（EXECUTED），執行者修正 result.md → BossConfirm → L3→L4→L5，採增量攻防：不得刪除既有 red.md / blue.md 紀錄，新回合攻防追加在既有紀錄之後（以 `---` 與回合標題分隔）。L5 BossConfirm FAIL 退回 L1 重新宣告。執行者、紅隊與藍隊皆使用本環境子代理，不得並行啟動。
