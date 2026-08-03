---
name: sb-review
description: 開發收斂——提交證據、三者重審、進入 nnn 完成（合併開發→證據→重審→nnn完成）。
---
# sb-review — 開發收斂，進入 nnn 完成

當使用者要求「開發完成了」「提交驗收」「收斂」「sb-review」時執行本 prompt。用於開發完成後的收斂——提交證據、三者重審、進入 nnn 完成。

先 `load skill: shiftblame`，主對話 SECRETARY 執行：

## 流程

0. **SECRETARY 確認開發完成**（主對話）：G3 所有里程碑驗收合格（§1.4 所有里程碑的階段驗收通過，含每個里程碑所有功能已 commit）。
1. **提交證據**（主對話 SECRETARY）：彙整 G3 行為證據與未驗項；證據描述使用者可觀察的行為，不以檔案、字串、grep 命中代替。
2. **三者各自重審主導文件**（SECRETARY 派發三個角色子代理）：
   - AUDITOR 角色對照 G1 驗收，回報符合／未驗／駁回；MUST 請 SECRETARY 代派唯讀審查子代理取得獨立意見（結論存 `tmp/`，子代理不能派生子代理，SKILL §3）。
   - RESEARCHER 角色對照 G2 技術。
   - PLANNER 角色對照 G3 實作計畫。
3. **收斂判定**（主對話 SECRETARY）：
   - **三者皆通過** + SECRETARY 已代派獨立審核子代理（結論存 `tmp/` 供 AUDITOR 複核） + 片段清空 → 進入 nnn 完成。SLUG §3 節點推進到 `nnn 完成`。
   - **任一不通過** → 回三權制衡（同 nnn），提示具體問題。
   - 應跑未跑的 e2e MUST 標「未驗」，不得進入 nnn 完成。
4. **輕量保鮮**（§1.7.1）：SECRETARY 更新 SLUG 技術債／臨時租約；不動 SOP／ROADMAP／archive。

## 邊界

- 本 prompt 是**開發收斂的唯一顯式入口**；未輸入不得從開發推進到 nnn 完成。
- 收斂以三者重審 + §10 一致性為判準；不得以「開發做完了」直接推進。
- nnn 完成後，老闆決定開新 nnn（sb-next）或結束 slug（sb-end）。
