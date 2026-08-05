---
name: sb-do
description: 確認 G1~G3 完稿，核對 §10 一致後放行進入開發。
---
# sb-do — 確認完稿，放行進入開發

當使用者要求「完稿」「可以開始做了」「放行開發」「sb-do」時執行本 prompt。用於三權制衡完成、老闆確認完稿後，放行進入開發。

先 `load skill: shiftblame`，主對話 SECRETARY 執行：

## 流程

0. **SECRETARY 核對 §10 一致性**（主對話）：讀取當前 `<nnn>` 的 G1／G2／G3，親自核對兩兩雙向一致（三對六向）。
1. **放行判定**：
   - **三對六向全成立** + AUDITOR／RESEARCHER 角色子代理已透過 SECRETARY 代派子代理複核對應外部獨立研究（結論存 `tmp/`） → 放行。SLUG §3 節點從 `三權制衡（G1↔G2↔G3）` 推進到 `開發`。
   - **任一向缺漏** → **拒絕放行**，提示具體缺漏（如「G2 §1 技術分析未回指 G1 需求 R3」），要求對應角色子代理調整自己文件後重核。
   - 外部獨立研究未取得 → **不得放行**（文件不得定稿，SKILL §3）。
2. **放行後進入開發**：主對話 SECRETARY 依 G3 實作計畫採多循環螺旋開發（§1.4），派發**落地側三權**執行每個功能（commit 單位）；驗收節點是**里程碑**（G3 §1.5）。每個功能：SECRETARY 派發 DEVELOPER 寫實作碼（依 G2）→ TESTER 寫測試定義「過」（依 G3）→ ACCEPTOR 把東西修到綠燈、驗收「完成」（對照 G1）→ SECRETARY 讀 `tmp/` 三份產出後**判決合格才 commit（獨佔）**。低複雜度功能 SECRETARY MAY 直接執行不派發落地側三權。該里程碑所有功能 commit 完成後才在里程碑邊界做階段驗收。**commit 與所有判決（合格/返工）由 SECRETARY 獨佔**；落地側子代理（DEVELOPER/TESTER/ACCEPTOR）可在授權範圍內寫 repo（DEVELOPER 寫實作碼、TESTER 寫測試碼、ACCEPTOR 不碰實作碼／測試邏輯但可寫測試環境配套並可跑測試命令）但皆不可 commit；顧問側子代理（AUDITOR/RESEARCHER/PLANNER）對 repo 唯讀。

## 邊界

- 本 prompt 是**放行 gate**，不產出新文件、不改需求；只核對既有 G1~G3 一致性並推進節點。
- 一致性核對以 §10 為唯一判準；不得以「看起來一致」繞過逐項核對。
- 放行後進入開發；開發中發現問題，改用 sb-req／sb-method／sb-plan 退回對應權。
