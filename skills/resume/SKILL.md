---
name: resume
description: 繼續之前未完成的 slug/ms，基於既有 G1~G3 重新核對後接續工作。
---
# shiftblame:resume — 繼續未完成的 slug/ms

> **shiftblame:think 分發目標**：shiftblame:think 理解老闆要恢復未完成工作後分發至此。位置：從任何中斷點恢復 → 依短帳本接續，必要時基於既有 G1~G3 重新核對。

當老闆要恢復未完成工作時執行（由 shiftblame:think 分發）。用於 session 中斷後恢復既有未完成的工作。

先 `load skill: shiftblame`，主對話 秘書依 SKILL §9 讀取脈絡，再執行：

## 流程

0. **秘書讀取脈絡**（主對話）：依 §9 依序唯讀 `<repo>/.shiftblame/SOP.md`、`<repo>/.shiftblame/ROADMAP.md`、未歸檔的 `<slug>`（SLUG＋定案索引）、`<repo>/.shiftblame/archive/`。
   - 依 SKILL §3「溯及既往」盤點既有內容，舊命名與交接敘事同樣適用。盤點與清理紀錄寫 tmp；封存或受保護內容依既有路由處理，保持未解決項可見。
   - **兩條恢復路徑共同前置**：以 `sb state` 核對 root、slug／ms 及原節點，接入異常先依 think 的恢復規則處理。若 flow-state 有 `g1Contract`，先驗封存 G1 hash；偏離時保留 `last_save`，將差異記 tmp 並循既有修約路徑處理，交接成功與否都不能跳過契約核對。
1. **找出未完成的 slug/ms**：
   - 僅一個未完成 → 提議 resume 它。
   - 多個未完成 → 列出供老闆選，**等待老闆指定**後才 resume（提議不等於授權）。
   - 無未完成 → 提示「無未完成 slug，請透過 shiftblame:think 開新工作」。
   - 老闆指定 → 直接 resume 指定者。
2. **偵測 shiftblame:save 落點**：檢查 SLUG frontmatter 是否有 `last_save`。
   - **有 `last_save`** → **接續工作**（不重問確認）：從 SLUG §8 的回指讀取 `<repo>/.shiftblame/tmp/<slug>/handoff.md`，核對 slug／ms、階段、commit 與 flow-state、該段已產生的 G 檔及實況。成功核對後才**清除 `last_save` 標記**，在原節點接續已授權的「下一步」，跳過 step 3-4。缺檔、不可讀、回指的可見或實體位置越出 tmp、內容與實況矛盾時，保留標記，走 step 3-4 重建可驗落點；依 save 的保存與讀回順序更新 tmp 交接及 SLUG 回指後才消費標記。交接文件不能變更正式定義或擴大授權。
   - **無 `last_save`** → 落點不明，走重新核對（step 3-4）。
3. **依原節點重建落點**（非清空重寫，不向老闆重問）：以 flow-state 為節點依據，核對已存在、該段應承接的文件與實況。intent／requirement 承接 SLUG 與已有需求草案；research 承接 G1 與已有技術草案；plan 承接 G1／G2 與已有計畫草案；執行層承接已定稿的 G1~G3。後續階段尚未產生的文件不當作遺失，也不為 resume 提前產出。codebase 差異只能作為可行性證據，不能反向改義需求。依承載歸屬核對現有文件：
   - 仍成立 → 保留。
   - G2／G3 過時但仍 CONFORMS → 對應面向單調細化。
   - G1 hash 偏離、契約不足或衝突 → 停止；以 `tmp/amendment.md` 記錄原條款／新條款／影響範圍，經老闆確認後 `回 intent（sb next intent）`——修約是改 G1 的唯一路徑。
4. **從原節點接續**：將可驗落點寫入 tmp，按原節點繼續未完工作。到達既有放行邊時才按 §10 核對三對六向並驗相應授權與對抗；resume 本身不切換階段，交接遺失也不把 research／verify 等節點轉成 build。

## 邊界

- resume 是**恢復既有未完成工作**，不是開新 slug 或開新 ms（開新 ms＝老闆「開新 ms」授權＋sb next intent --new-ms 留痕，由 shiftblame:think 分發）。
- **二層判斷**：`last_save` 標記（接續落點）→ 無標記（重新核對 G1~G3）。有 `last_save` 且交接讀回核對成功時接續不重問確認，核對失敗則保留標記並重新核對。
- 重新核對（無 `last_save` 或交接不可用時）基於既有內容，保留仍成立者，不從零重寫；已放行 G1 的任何語意變更都走顯式修約（SKILL §1.4.1），不以 resume 繞過契約鎖定。
- SLUG §4 節點依當前實際狀態標記，§8 只留交接路徑。對話、工作過程與交接紀錄一律 tmp；遇到既有 SLUG 交接敘事，先移入 tmp 並讀回，再改為回指。
