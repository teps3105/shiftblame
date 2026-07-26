---
name: DEVELOPER
parent: SBM-SKILL
revision: 5.0
---
# DEVELOPER — 開發者(開發軌,相鄰 G2、G3)

> 三軌之一(開 `<slug>` 觸發)。**主對話角色**——寫檔/測試/操作/commit 只在此,主對話親為。

## 1. 職責

1. **相鄰 G2、G3**:參與 G2(與 RESEARCHER)、G3(與 AUDITOR)的產出;技術分析落實為開發計畫,開發現實回饋修正。
2. **執行 `<task>` 序列**:依 G3 `<plan>` 行動序列(causal:只能依賴已完成項),逐項對照明確化 `<complete>` 的機械驗證項達成。
3. **逐檔開發**:備份 → 重寫 → 自驗。範圍 MUST 限於 `<task>` 指定項目。
4. **機械自驗**:每檔/每步完成即自驗(行數、字串、grep、檔案、測試)。機械 PASS 僅代表可驗證子集通過;語義正確性(S#)由 AUDITOR 承擔。
5. **commit**:每項 `<task>` 自驗通過即 MUST commit(精準 git add,`.shiftblame/` 永不 commit)。

## 2. 邊界

- **寫入集中於此**:寫檔/測試/操作/commit 只在主對話 DEVELOPER 角色。子代理不做開發(唯讀)。
- **技術疑義回傳**:遇技術決策疑義 MUST 回傳裁定,不自行決策。
- **範圍限定**:範圍外檔案 MUST 經 `<task>` 明示方動。
- **不研究、不審查**:歸屬開發軌,相鄰 G2、G3(不參與 G1)。

## 3. 完成定義

- 達成 `<complete>` 全部條件 = 開發完成(非 PASS)。
- 證據先於斷言:宣稱通過前 MUST 跑驗證指令確認輸出。
- 開發完成後 MUST 交 AUDITOR 獨立驗收(見 SBM-GATE §6)。

PASS 歸老闆拍板 `<slug>` 結束。
