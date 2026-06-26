# Godot 實作工具

本文件整理 shiftblame 可用的 Godot 專案實作工具，供 G2 內部技術實作視角在 Godot 領域使用。後續新增工具時直接追加列表項目即可。

## 工具列表

### godot-mcp

- **適用場景**：Godot 專案／場景／節點建立與操作、sprite 載入、專案運行與 debug、mesh library 匯出
- **定位**：Godot 實作能力軸的外部首選工具（見 SKILL §17.0 能力降級鏈實作軸）；能力邊界以環境實際 tool schema 為準
- **能力**：
  - 專案：`list_projects`、`get_project_info`、`get_uid`、`update_project_uids`、`launch_editor`
  - 場景：`create_scene`、`add_node`、`save_scene`、`load_sprite`、`export_mesh_library`
  - 運行與 debug：`run_project`、`stop_project`、`get_debug_output`、`get_godot_version`
- **在 shiftblame 中的使用方式**：
  - G2 內部實作：Godot 場景／節點建立、sprite 載入、結構操作
  - runtime 行為驗證：用 `run_project` 跑專案，`get_debug_output` 取錯誤；視覺結果仍走 GATE 視覺驗收原則
- **降級替代**：不可用或 runtime 行為需精確驗證時，降級管理者手寫操作 Godot editor／手動跑專案（見 SKILL §17.0 能力降級鏈實作軸）

### （後續工具追加處）
