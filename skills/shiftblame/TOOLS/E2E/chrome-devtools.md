# Chrome DevTools MCP — 網頁端到端驗證

## 適用

網頁應用端到端驗證。

## 能力

截圖與 DOM 快照、點擊/填寫/拖曳/鍵盤操作、網路請求監控、Console 訊息檢查、Lighthouse、Heap 快照。

## 使用

- G2 驗證：開頁 → 操作 → 截圖/DOM/console/API 檢查 → 確認符合 G1 規格。
- 驗證結果寫入 G2.md 收斂或管理者狀態揭露。
- 不可用時降級 CLI smoke test＋老闆肉眼覆核；未覆蓋的視覺/互動行為標未驗。
