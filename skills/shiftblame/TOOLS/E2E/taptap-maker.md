# taptap-maker — Maker build/runtime/e2e 驗證

## 適用

TapTap Maker / UrhoX Lua 專案 build、preview、runtime 啟動與互動驗證。

## 能力

Maker MCP 具體 tool schema 以啟用時 tool list 為準。常見能力包含 build/preview 類操作；build 只代表編譯或遠端載入成功，不等於 runtime 行為或 e2e 通過。

## 使用

- post-EXECUTOR 交付時，Maker build 可列為自驗或 smoke 證據，不得替代 e2e。
- runtime/e2e 應覆蓋啟動、錯誤輸出、關鍵互動、必要截圖或預覽檢查；未跑即標未驗。
- 純 Lua 模組可優先用本機 Lua 離線 e2e；渲染/視覺項再用 Maker preview 或老闆肉眼。
