---
name: sb-end
description: 結束當前 slug 並執行完整收尾保鮮；嚴格檢查 PASS 前置條件。
---
# sb-end — 結束 slug 並執行完整收尾保鮮

> **sb-think 分發目標**：sb-think 理解老闆要結束 slug（PASS）後分發至此。位置：nnn 完成後老闆 PASS → 完整收尾保鮮 → archive。

當老闆要結束這個 slug 時執行（由 sb-think 分發）。對應 SKILL §2 的 PASS checkpoint 與 §6「結束 `<slug>`」路由。

先 `load skill: shiftblame`，再執行：

## 1. 嚴格檢查 PASS 前置條件（SKILL §2）

逐項核對，**任一未滿足即停止並提示老闆**，不執行收尾：

- **當前 `<nnn>` 三者重審通過**：§6 三面向制衡與重審
- **輕量保鮮完成（§1.7.1）**：SLUG 技術債／臨時租約已寫回
- **證據完整**：G3 行為證據齊全
- **無未驗項**：審計 無「未驗」標記；應跑 e2e 皆已跑

任一未滿足 → 提示具體缺項，建議先收斂當前 nnn（或走重大例外遷移回 G1，SKILL §1.4.1）後再結束。

## 2. 前置通過 → 執行完整收尾保鮮（SKILL §1.7.2）

1. SLUG `status` 改為 `passed`。
2. 從當下 codebase、設定、測試入口重寫 `SOP.md`；保留仍成立的配置與規範，刪除已取代或無法查核者。
3. 重新整理 `ROADMAP.md`：移除已完成項，部分完成者改寫為剩餘方向；不得藉保鮮新增未授權需求。
4. **保鮮 repo 內文件（`docs/`、`README.md`）**——逐項盤點 docs/ 下每個系統文件是否與 codebase 一致（系統已移除→刪文件；行為已變→更新；新完成系統→補文件）；README 的說明、安裝、使用是否仍準確。寫法對照 `assets/DOCS.md` 判準。與 SOP／ROADMAP 同級，MUST NOT 跳過。
5. 依 SOP 盤點測試資產；探索性內容留 `.shiftblame/tmp/`。
6. 依分支政策合併、推送與清理。
7. 將 `.shiftblame/<slug>/` 移至 `archive/`。

## 邊界

- 老闆要求即為結束意圖（PASS 授權）；但**品質門檻不可繞過**。
- 收尾僅限當前 `<slug>`；不影響其他已歸檔 slug。
- 新增產品目標、改變邊界或擴張剩餘方向成新需求，仍須老闆授權。
