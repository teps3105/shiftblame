# GATE — 閘門與收尾

1. **回饋即意圖**：老闆回饋為意圖確認素材，僅供當前對話參考與意圖揭露使用
2. **SOP 約束**：可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
3. **先提案再質疑**：正方提案→反方質疑→管理者收斂，四出口各三輪辯論
4. **迭代收斂**：管理者以最後收斂為基線全部重跑
5. **雙模式分流**：slug 管線走 `feat/<slug>`；簡易模式管理者在 main 操作（老闆授權）

Slug 狀態序：PLANNED→DEVELOPED→VERIFIED→PROSPECTED→PASSED。簡易狀態序：PROPOSED→QUESTIONED→CONVERGED→PASSED。FAIL 以收斂為基線重跑。

## 閘門生命週期

**Slug START**：驗證上游→載入三層租約（SOP｜SLUG §7｜SKILL+GATE+MANAGE）→揭露目標→**暫停等老闆確認**。
**Slug END**：呈現管理者收斂+下一步→老闆 PASS/FAIL。反方 H/M/L 標註，不做決策。
**簡易 START**：載入 SOP（長期租約）→揭露目標→**暫停等老闆確認**。
**簡易 END**：呈現管理者收斂→老闆 PASS→管理者在 main commit。FAIL 重跑正→反→收斂。

## 收尾

Slug 管線：G4 PASS→提交→收尾（確認→合併→推送→清理→歸檔）或暫停。簡易模式：PASS→commit→結束。
