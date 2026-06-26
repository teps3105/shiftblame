# 圖像識別工具

本文件整理 shiftblame 可用的圖像／影像識別工具，供視覺驗收粗篩與圖像理解使用。後續新增工具時直接追加列表項目即可。

## 工具列表

### ai-vision-mcp

- **適用場景**：UI 截圖比對、圖像內容理解、物件偵測、回歸粗篩、影片內容分析
- **定位**：圖像識別能力軸的外部首選工具（見 SKILL §17.0 圖像識別輔助）；**只能當「有無回歸」的粗篩，不得單獨據以 PASS**——最終裁判是老闆的眼睛（GATE 視覺驗收原則 4 不變）
- **能力**：
  - `analyze_image`：單圖內容理解（general／palette／hierarchy／components 模式）
  - `analyze_video`：影片內容與時序理解（可指定片段與取樣率）
  - `compare_images`：多圖比對（layout／配色／排版一致性）
  - `detect_objects_in_image`：物件偵測＋標註框輸出
- **在 shiftblame 中的使用方式**：
  - 視覺驗收粗篩：UI／玩家-facing／入口類變更先以 ai-vision 比對前後截圖，產出粗篩結論
  - 粗篩與老闆直覺衝突時預設相信老闆；最終 PASS 須老闆親眼看過
- **降級替代**：精度不足時降級 codex rescue 派圖像識別任務，或降級老闆肉眼直接判斷（見 SKILL §17.0 圖像識別輔助）

### （後續工具追加處）
