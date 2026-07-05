# godot-mcp — Godot runtime/e2e 驗證

## 適用

Godot 專案 runtime 行為驗證、錯誤輸出檢查、玩家-facing 互動粗驗。

## 能力

`run_project`、`stop_project`、`get_debug_output`、`get_godot_version`；可搭配場景/節點工具準備驗證環境。

## 使用

- runtime 行為用 `run_project` 跑專案，`get_debug_output` 取錯誤。
- 視覺結果仍走 VISION 或老闆肉眼；未實際跑專案即標未驗。
- 不可用時降級手動跑專案並記錄未自動化項。
